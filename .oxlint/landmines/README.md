# landmines

Vendored copy of [@interfere/landmines](https://github.com/interfere-inc/landmines)
at `92084b12872103b0f9245c0325ab571df00a574b` (MIT, see [LICENSE](./LICENSE)).
Registered as the `landmines` jsPlugin in the root `.oxlintrc.json`.

## Enabled rules

- `strict-msw` — every MSW start must use `onUnhandledRequest: "error"`.
- `no-fixed-sleep` — await a signal instead of a fixed real-time delay.
- `no-flake-masking` — no retries or raised timeouts.
- `no-unsignaled-poll` — await an event instead of polling recorder/spy state.

The last three carry per-file `allow` counts in `.oxlintrc.json` for existing
violations. The counts ratchet down: the rule reports when a file has fewer
violations than its allowance, so shrink or remove entries as tests are fixed.

## Disabled rules

These are vendored and registered but not enabled because they conflict with
this repo's conventions:

- `no-test-doubles` — tests use `vi.fn` observation spies and shared setup.
- `no-comments` — TSDoc is used across packages.
- `no-explicit-return-types` — boundaries require explicit return types.
- `colocated-tests` / `test-file-names` — tests live in `__tests__` directories.
- `package-exports` — packages expose public namespaces through wildcard exports.
