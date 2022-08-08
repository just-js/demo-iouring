FROM ubuntu:latest AS pre-build
RUN apt update
RUN apt upgrade -y
RUN apt install -y g++ curl make tar gzip

FROM pre-build AS builder
WORKDIR /build
RUN sh -c "$(curl -sSL https://raw.githubusercontent.com/just-js/just/current/install.sh)"
RUN make -C just install
ENV JUST_HOME=/build/just
ENV JUST_TARGET=/build/just
RUN make -C just/modules/iouring library
WORKDIR /app
COPY copy.js ./
RUN just build --clean --static copy.js

FROM gcr.io/distroless/static:latest
WORKDIR /app
COPY --from=builder /app/copy /app/copy
CMD ["./copy"]
