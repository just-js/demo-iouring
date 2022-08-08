[![Gitpod ready-to-code](https://img.shields.io/badge/Gitpod-ready--to--code-908a85?logo=gitpod)](https://gitpod.io/#https://github.com/just-js/demo-iouring)
# iouring module example

This is a demo of the [just-js](https://just.billywhizz.io/) [iouring module](https://github.com/just-js/modules/tree/main/iouring). It does the same thing
as the example copy [program](https://github.com/axboe/liburing/blob/master/examples/io_uring-cp.c) written in C that comes with liburing

# usage

just copy.js [fromPath] [toPath]

- fromPath: path to the file to copy from, default /tmp/in.bin
- toPath: path to the file to copy to, default /tmp/out.bin

if no arguments are passed and the file /tmp/in.bin does not exist then
the program will create a 1GB file filled with random bytes from /dev/urandom

# build and run locally

## prerequisites

- a working modern linux x86_64 environment with g++, make and curl

## build and install just-js
```bash
sh -c "$(curl -sSL https://raw.githubusercontent.com/just-js/just/current/install.sh)"
sudo make -C just install # installs to /usr/local/bin
export JUST_HOME=$(pwd)/just
export JUST_TARGET=$JUST_HOME
```

## build and install the iouring module
```bash
make -C just/modules/iouring library
sudo make -C just/modules/iouring install install-debug # /usr/local/lib/just
```

## run
```bash
just copy.js
```

## build and run with docker

## build
```bash
docker build -t just-iouring-demo .
```

## run
```bash
docker run -it --rm -v /dev/urandom:/dev/urandom -v /tmp:/tmp just-iouring-demo
```
