#!/bin/bash
set -euo pipefail

cleanup_url=$RUNNER_CLEANUP_URL
cleanup_token=$RUNNER_CLEANUP_TOKEN
unset RUNNER_CLEANUP_TOKEN RUNNER_CLEANUP_URL

cleanup() {
	status=$?
	trap - EXIT

	curl --fail --silent --show-error \
		--connect-timeout 10 \
		--max-time 60 \
		--retry 5 \
		--retry-all-errors \
		--request DELETE \
		--header "Authorization: Bearer $cleanup_token" \
		"$cleanup_url" || true

	exit "$status"
}
trap cleanup EXIT

for _ in {1..150}; do
	if runuser --user runner --preserve-environment -- \
		/usr/local/bin/docker version >/dev/null 2>&1; then
		break
	fi
	sleep 0.2
done

if ! runuser --user runner --preserve-environment -- \
	/usr/local/bin/docker version >/dev/null 2>&1; then
	echo "Docker is unavailable" >&2
	exit 1
fi

# shellcheck disable=SC2016 # Expand runner variables after dropping privileges.
runuser --user runner --preserve-environment -- /bin/bash -c '
  set -euo pipefail
  cd /opt/actions-runner
  ./config.sh --unattended --ephemeral --disableupdate --no-default-labels \
    --url "$RUNNER_URL" --token "$RUNNER_TOKEN" \
    --name "$RUNNER_NAME" --labels "$RUNNER_LABELS" \
    --work /workspace/_work
  unset RUNNER_TOKEN

  # Run in the background so an idle watchdog can monitor for job
  # assignment. The runner spawns a Runner.Worker process only when GitHub
  # assigns a job; if none appears within 5 minutes the listener is killed
  # and the cleanup trap fires DELETE, destroying the sandbox. This is the
  # first line of defense against idle instances billing forever — the
  # sandbox sleepAfter is the backstop. stdout stays untouched so the
  # waitForLog listening-for-jobs check still sees it.
  #
  # pgrep -x matches the exact process name, so the watchdog never matches
  # its own shell (unlike -f, which would see the script text in its own
  # cmdline and never fire).
  ./run.sh &
  runner_pid=$!

  for _ in $(seq 1 30); do
    sleep 10
    if pgrep -x Runner.Worker >/dev/null 2>&1; then
      break
    fi
  done

  if ! pgrep -x Runner.Worker >/dev/null 2>&1; then
    echo "No job assigned within 5 minutes; shutting down" >&2
    kill "$runner_pid" 2>/dev/null || true
  fi
  wait "$runner_pid"
'
