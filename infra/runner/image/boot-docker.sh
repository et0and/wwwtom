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

runuser --user runner -- \
	env \
	DOCKER_HOST="$DOCKER_HOST" \
	HOME=/home/runner \
	LOGNAME=runner \
	USER=runner \
	XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" \
	/usr/local/bin/dockerd-rootless.sh \
	--host="$DOCKER_HOST" \
	--iptables=false \
	--ip6tables=false \
	--storage-driver=fuse-overlayfs &
daemon_pid=$!

for _ in {1..150}; do
	if runuser --user runner -- \
		env DOCKER_HOST="$DOCKER_HOST" /usr/local/bin/docker-real version \
		>/dev/null 2>&1; then
		echo "Rootless Docker is ready"
		wait "$daemon_pid"
		exit $?
	fi

	if ! kill -0 "$daemon_pid" 2>/dev/null; then
		wait "$daemon_pid"
		exit $?
	fi
	sleep 0.2
done

echo "Rootless Docker did not become ready within 30 seconds" >&2
exit 1
