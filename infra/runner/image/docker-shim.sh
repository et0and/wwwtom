#!/bin/bash
set -euo pipefail

real_docker=${DOCKER_REAL:-/usr/local/bin/docker-real}
uses_runner_network=false
expect_network=false

for argument in "$@"; do
	if $expect_network; then
		[[ "$argument" == github_network_* ]] && uses_runner_network=true
		expect_network=false
		continue
	fi

	case "$argument" in
	--network)
		expect_network=true
		;;
	--network=*)
		[[ "$argument" == --network=github_network_* ]] && uses_runner_network=true
		;;
	esac
done

if ! $uses_runner_network || [[ "${1:-}" != create && "${1:-}" != run ]]; then
	exec "$real_docker" "$@"
fi

# Cloudflare disables iptables in nested Docker. Use the supported host network
# for runner-managed containers so pulls and job traffic can reach the network.
arguments=()
skip_next=false
for argument in "$@"; do
	if $skip_next; then
		skip_next=false
		continue
	fi

	case "$argument" in
	--network)
		arguments+=(--network host)
		skip_next=true
		;;
	--network=github_network_*)
		arguments+=(--network=host)
		;;
	--network-alias)
		skip_next=true
		;;
	--network-alias=*)
		;;
	*)
		arguments+=("$argument")
		;;
	esac
done

exec "$real_docker" "${arguments[@]}"
