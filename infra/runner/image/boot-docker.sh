#!/bin/bash
set -euo pipefail

daemon_pid=

# shellcheck disable=SC2329 # Invoked through the signal and EXIT traps.
stop_docker() {
	if [[ -n "$daemon_pid" ]]; then
		kill -TERM "$daemon_pid" 2>/dev/null || true
		wait "$daemon_pid" 2>/dev/null || true
	fi
}
trap stop_docker EXIT INT TERM

# Cloudflare Containers run in Firecracker microVMs: no user namespaces and
# no /dev/fuse, so rootless dockerd (rootlesskit + fuse-overlayfs) cannot
# start. Run ROOTFUL dockerd instead (the documented Cloudflare DinD
# pattern), with iptables disabled — the platform does not support iptables
# manipulation — and let the storage driver auto-detect (falls back to vfs).
# The docker group on the socket gives the `runner` user access. `--bridge=none`
# skips docker0 creation (the platform forbids netlink bridge setup); job
# containers reach the network via `--network=host` (docker-shim.sh).
/usr/local/bin/dockerd \
	--host="$DOCKER_HOST" \
	--group=docker \
	--bridge=none \
	--iptables=false \
	--ip6tables=false &
daemon_pid=$!

for _ in {1..150}; do
	if runuser --user runner -- \
		env DOCKER_HOST="$DOCKER_HOST" /usr/local/bin/docker-real version \
		>/dev/null 2>&1; then
		echo "Docker is ready"
		wait "$daemon_pid"
		exit $?
	fi

	if ! kill -0 "$daemon_pid" 2>/dev/null; then
		wait "$daemon_pid"
		exit $?
	fi
	sleep 0.2
done

echo "Docker did not become ready within 30 seconds" >&2
exit 1
