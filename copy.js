// this demo copies a file. it follows the c example here as closely as 
// possible
// https://github.com/axboe/liburing/blob/master/examples/io_uring-cp.c
// this is not a robust or performant implementation but it works for the 
// happy path and only serves as a working demonstration of how to use the 
// iouring module

// import the built in filesystem library
const { fs } = just.library('fs')
// import the system library, for exec
const { sys } = just.library('sys')
// import the net library, for exec
const { net } = just.library('net')
// import the iouring library, second param is optional and can be used to 
// specify the path of the shared object to load. otherwise it will look in 
// /usr/local/lib/just for the shared object
const { iouring } = just.library('iouring')

// throwing a SystemError will output the current errno and strerror(errno)
const { SystemError } = just
// import some constants and functions so we don't have to type so much
const { O_RDONLY, O_WRONLY, O_CREAT, O_TRUNC } = fs
const { EAGAIN } = net
const { open, isFile, fstat } = fs
const { calloc } = sys
const { close } = net

const RINGSIZE = 256
const BLOCKSIZE	= 128 * 1024

// these buffers will be used to hold the data being read and written
const buffers = new Array(RINGSIZE).fill(0)
  .map((v, index) => ({ buf: calloc(1, BLOCKSIZE), index }))
// we keep track of which buffers are waiting on reads or writes here
const wQ = {}
const rQ = {}

const randomfd = just.fs.open('/dev/urandom')

function getRandom (size = 256) {
  const random = new ArrayBuffer(size)
  net.read(randomfd, random, 0, size)
  return random
}

function dd (path = 'rootfs', blockSize = 4096, count = 1) {
  const fd = fs.open(path, O_WRONLY | O_CREAT)
  for (let i = 0; i < count; i++) {
    net.write(fd, getRandom(blockSize), blockSize)
  }
  net.close(fd)
}

function readQueue (infd, ring, size, offset) {
  const sqe = iouring.getSQE(ring)
  if (!sqe) return 1
  const { buf, index } = buffers.shift()
  buf._offset = offset
  rQ[index] = buf
  iouring.prepReadV(sqe, infd, buf, offset, index)
  return 0
}

function writeQueue (outfd, ring, index) {
  const sqe = iouring.getSQE(ring)
  if (!sqe) return 1
  const buf = rQ[index]
  wQ[index] = buf
  delete rQ[index]
  iouring.prepWriteV(sqe, outfd, buf, buf._offset, index)
  return 0
}

function copyFile (infd, outfd, ring, size) {
  let remaining = size
  let writes = 0
  let reads = 0
  let offset = 0
  while (size || remaining) {
    let hadReads = reads
    let gotComp = false
    while (size) {
      let thisSize = size
      if (reads + writes >= RINGSIZE) break
      if (!thisSize) break
      if (thisSize > BLOCKSIZE) thisSize = BLOCKSIZE
      if (readQueue(infd, ring, thisSize, offset)) break
      size -= thisSize
      offset += thisSize
      reads++
    }
    if (hadReads !== reads) {
      if (iouring.submit(ring) < 0) break
    }
    gotComp = false
    const res = [0, 0]
    while (remaining) {
      let rc = 0
      let event
      if (!gotComp) {
        iouring.waitCQE(ring, res)
        const [ret, cqe] = res
        rc = ret
        event = cqe
        gotComp = true
      } else {
        iouring.peekCQE(ring, res)
        const [ret, cqe] = res
        rc = ret
        event = cqe
        if (rc === -EAGAIN) {
          event = null
          rc = 0
        }
      }
      if (rc < 0) return 1
      if (!event) break
      iouring.getData(event, res)
      const [bytes, index] = res
      if (bytes < 0) {
        return 1
      } else if (bytes !== BLOCKSIZE) {
        continue
      }
      if (rQ[index]) {
        writeQueue (outfd, ring, index)
        if (iouring.submit(ring) < 0) break
        remaining -= bytes
        reads--
        writes++
      } else {
        const buf = wQ[index]
        delete wQ[index]
        buffers.push({ buf, index })
        writes--
      }
      iouring.cqeSeen(ring, event)
    }
  }
  while (writes) {
    const res = [0, 0]
    iouring.waitCQE(ring, res)
    const [ret, cqe] = res
    if (ret) return 1
    iouring.getData(cqe, res)
    const [bytes, index] = res
    iouring.cqeSeen(ring, cqe)
    writes--
  }
  return 0
}

// read the command line args, with defaults
const [
  inFileName = '/dev/shm/in.bin',
  outFileName = '/dev/shm/out.bin'
] = just.args[0] === 'just' ? just.args.slice(2) : just.args.slice(1)

// create a 1.0 GB input file filled with random bytes if it does not exist
if (!isFile(inFileName)) dd(inFileName, 65536, 16 * 1024)

// open the input file
const infd = fs.open(inFileName, O_RDONLY)
if (infd < 0) throw new SystemError(`fs.open ${inFileName}`)

// open the output file for writing
// 436 is octal 0644 but we cannot do octal in strict mode, on by default
// if you want to use octal, run with --no-use-strict
const outfd = fs.open(outFileName, O_WRONLY | O_CREAT | O_TRUNC, 436)
if (outfd < 0) throw new SystemError(`fs.open ${outFileName}`)

// create io_uring queue, with size 64
const ring = iouring.queueInit(RINGSIZE)
if (!ring) throw new SystemError('iouring.queueInit')

// get input file size
const stat = new BigUint64Array(20)
fstat(infd, stat)
const [, mode,,,,,, size] = stat

// copy the file
copyFile (infd, outfd, ring, Number(size))

// close the files and clean up the ring. leaving a dirty ring is never good =)
close(infd)
close(outfd)
close(randomfd)
iouring.queueExit(ring)
