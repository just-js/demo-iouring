FROM gitpod/workspace-full:latest
RUN sudo install-packages curl unzip xz-utils libsqlite3-dev gzip make tar g++ tclsh libffi-dev libz-dev
WORKDIR /home/gitpod/.just
RUN sudo chown gitpod:gitpod /home/gitpod/.just
RUN sh -c "$(curl -sSL https://raw.githubusercontent.com/just-js/just/current/install.sh)"
RUN sudo chown -R gitpod:gitpod /home/gitpod/.just
RUN make -C just runtime
RUN sudo make -C just install
RUN make -C just libs
ENV JUST_HOME=/home/gitpod/.just/just
ENV JUST_TARGET=/home/gitpod/.just/just
RUN make -C just/modules/iouring library
RUN sudo make -C just/modules/iouring install
RUN sudo chown -R gitpod:gitpod /home/gitpod/.just
WORKDIR /workspace
RUN ln -s /home/gitpod/.just/just .just
CMD ["/bin/bash"]
