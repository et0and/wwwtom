# syntax=docker/dockerfile:1

ARG SANDBOX_VERSION=0.12.5
ARG SANDBOX_DIGEST=sha256:315b14485d6982774521f3e2f605fdf39ba6de6942d65a022048a54967ca0062
FROM docker.io/cloudflare/sandbox:${SANDBOX_VERSION}@${SANDBOX_DIGEST}

ARG RUNNER_VERSION=2.336.0
ARG RUNNER_SHA256=04cf0be1aff4c3ec3554466c39124ca250e3effd8873bb7e8d68535aa9505d5d
ARG DOCKER_VERSION=29.7.2
ARG DOCKER_SHA256=803d433f226db4776e1768fd319fc6c6e4935a456acf84fcc0080818b854bc8f
ARG DOCKER_ROOTLESS_SHA256=15a5cb81f2c5cf15ea21427f2e8241eac0deb2221175f993b5e76926e705ec6a
ARG BUILDX_VERSION=0.36.1
ARG BUILDX_SHA256=48af8a397ebd60178778bf63611dbcebe5f5e7a9be90eb9147b24b9587455778

# Root is required at runtime: boot-docker.sh drops to the `runner` user via
# runuser for the rootless Docker daemon and the actions runner.
# hadolint ignore=DL3002
USER 0

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# apt versions are left unpinned on purpose: the sandbox base image is
# digest-pinned above, so package versions are deterministic at build time.
# hadolint ignore=DL3008
RUN set -eux; \
    apt-get update; \
    apt-get install --yes --no-install-recommends \
      dbus-user-session \
      fuse-overlayfs \
      iproute2 \
      iptables \
      slirp4netns \
      uidmap; \
    useradd --create-home --uid 1001 --user-group --shell /bin/bash runner; \
    echo 'runner:100000:65536' >> /etc/subuid; \
    echo 'runner:100000:65536' >> /etc/subgid; \
    mkdir -p /opt/actions-runner /run/user/1001 /workspace/_work; \
    chmod 0700 /run/user/1001; \
    curl --fail --location --show-error \
      --proto '=https' --proto-redir '=https' \
      --output /tmp/docker.tgz \
      "https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_VERSION}.tgz"; \
    curl --fail --location --show-error \
      --proto '=https' --proto-redir '=https' \
      --output /tmp/docker-rootless.tgz \
      "https://download.docker.com/linux/static/stable/x86_64/docker-rootless-extras-${DOCKER_VERSION}.tgz"; \
    echo "${DOCKER_SHA256}  /tmp/docker.tgz" | sha256sum --check --strict; \
    echo "${DOCKER_ROOTLESS_SHA256}  /tmp/docker-rootless.tgz" | sha256sum --check --strict; \
    tar --extract --gzip --file /tmp/docker.tgz --strip-components 1 --directory /usr/local/bin; \
    tar --extract --gzip --file /tmp/docker-rootless.tgz --strip-components 1 --directory /usr/local/bin; \
    mv /usr/local/bin/docker /usr/local/bin/docker-real; \
    mkdir -p /usr/local/libexec/docker/cli-plugins; \
    curl --fail --location --show-error \
      --proto '=https' --proto-redir '=https' \
      --output /usr/local/libexec/docker/cli-plugins/docker-buildx \
      "https://github.com/docker/buildx/releases/download/v${BUILDX_VERSION}/buildx-v${BUILDX_VERSION}.linux-amd64"; \
    echo "${BUILDX_SHA256}  /usr/local/libexec/docker/cli-plugins/docker-buildx" | sha256sum --check --strict; \
    chmod 0755 /usr/local/libexec/docker/cli-plugins/docker-buildx; \
    /usr/local/bin/docker-real buildx version; \
    curl --fail --location --show-error \
      --proto '=https' --proto-redir '=https' \
      --output /tmp/actions-runner.tar.gz \
      "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"; \
    echo "${RUNNER_SHA256}  /tmp/actions-runner.tar.gz" | sha256sum --check --strict; \
    tar --extract --gzip --file /tmp/actions-runner.tar.gz --directory /opt/actions-runner; \
    /opt/actions-runner/bin/installdependencies.sh; \
    rm -f /tmp/actions-runner.tar.gz /tmp/docker.tgz /tmp/docker-rootless.tgz; \
    rm -rf /var/lib/apt/lists/*; \
    chown -R runner:runner /home/runner /opt/actions-runner /run/user/1001 /workspace/_work

COPY --chmod=0755 boot-docker.sh /usr/local/bin/boot-docker
COPY --chmod=0755 docker-shim.sh /usr/local/bin/docker
COPY --chmod=0755 run-actions-runner.sh /usr/local/bin/run-actions-runner

ENV DOCKER_HOST=unix:///run/user/1001/docker.sock \
    XDG_RUNTIME_DIR=/run/user/1001

# Keep the Sandbox ENTRYPOINT; it starts this command as a managed child.
CMD ["/usr/local/bin/boot-docker"]
