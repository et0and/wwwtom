# infra/turso — Turso as Code

Alchemy + Effect provider set for the [Turso Platform API](https://docs.turso.tech/api-reference)
(`api.turso.tech`). Manages `Location` (read-only catalog), `Group`, `Database`
and `DatabaseToken` with the same `Stack`/`Stage` lifecycle as the rest of
`wwwtom`.

- OpenAPI spec pinned at `schemas.ts:1` — `https://docs.turso.tech/api-reference/openapi.json`.

## Why not `@tursodatabase/api`

Turso publishes a real OpenAPI spec, so this module is written against that spec
rather than the community client. The client was evaluated and rejected because
it is behind the live API in three ways that each break a resource here:

| Gap                                                                                             | Consequence                                                                                                                                               |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No `GET`/`PATCH .../configuration` on databases or groups                                       | No size limit, delete protection, allowed IPs/VPCs, block reads/writes, or group delete protection. `TURSO_SIZE_LIMIT` could not be applied after create. |
| `LocationKeys` is 31 legacy three-letter codes (`ams`, `lhr`, `iad`)                            | The spec's example location is `aws-us-east-1`. A valid `TURSO_LOCATION` does not typecheck.                                                              |
| `Database` drops `delete_protection` and `parent`; `Group` drops `uuid` and `delete_protection` | State loses the protection flag and the branch parent, so a diff cannot see a dangerous setting.                                                          |

Check the gap list against the pinned spec before re-adding the dependency. If
the client catches up, `http.ts` and `schemas.ts` are the only files that change.

## Architecture

```
TursoCredentials (org slug + platform token from TOM_SECRETS, token in Redacted)
      ↓
TursoHttp (Fetch + Bearer, typed errors: NotFound/Conflict/InvalidArgument/HttpError)
      ↓
Provider set: Location | Group | Database | DatabaseToken  (alchemy/Resource)
      ↓
Stack "wwwtom-turso" (Cloudflare.state for persistence)
```

- The organization slug comes from the credential, not from props. Turso
  deprecated unrestricted cross-org tokens, so a token acts on exactly one
  organization and repeating the slug on every resource would only invite
  mistakes. There is no `Organization` resource: it cannot be created, changed or
  deleted, and the slug is already known from `TursoCredentials`.
- Turso resources carry no `notes`/`description` field, so there is nowhere to
  write an ownership marker. Providers return plain attributes from `read`, which
  Alchemy treats as owned: adoption of a pre-existing group or database is
  silent and needs no `--adopt`.
- `list` returns an empty array on purpose. Turso's list endpoints are unfiltered
  per organization, so enumerating them would let `alchemy nuke` delete the
  shared `default` group and every production database in it.

## Prerequisites

1. A Turso organization (`turso org list` to find the slug).
2. A platform token scoped to that organization. Unrestricted tokens are
   deprecated.
3. The list of locations the databases run in, from `GET /v1/locations`.

## Getting credentials

Mint a token scoped to the organization:

```bash
turso auth api-tokens mint wwwtom-infra --org wwwtom
```

A group-scoped token (`--group default --read-only`) is enough for reads but
cannot create the group, so the first production deploy needs organization
scope.

Keep the two values as `TURSO_ORG` and `TURSO_API_TOKEN` in the `TOM_SECRETS`
bundle. Explicit env wins over the bundle. Neither value is ever logged: the
token stays in `Redacted` (`credentials.ts:6`).

## Environment

```bash
# infra/.dev.vars (never committed)

# TOM_SECRETS keys — the credential
TOM_SECRETS={"TURSO_ORG":"wwwtom","TURSO_API_TOKEN":"..."}

# Plain deploy configuration — not secrets
TURSO_LOCATION=aws-eu-west-1   # group primary location; only needed to create the group
TURSO_GROUP=default            # group name
TURSO_SIZE_LIMIT=              # optional, e.g. 1gb
TURSO_TOKEN_TTL_DAYS=90        # SQL token lifetime; default 90
```

Alchemy loads this file via `ALCHEMY_ENV_FILE` (default `infra/.dev.vars`).

## What the stack declares

| Resource        | Production                              | Other stages     |
| --------------- | --------------------------------------- | ---------------- |
| `Location`      | declared from `TURSO_LOCATION`          | —                |
| `Group`         | declared; adopts `default` if it exists | —                |
| `Database`      | `wwwtom`                                | `wwwtom-<stage>` |
| `DatabaseToken` | declared, 90-day lifetime               | declared         |

Location and Group are **not** declared outside production.
Turso gives an organization one `default` group, and extra groups are limited to
Scaler, Pro and Enterprise plans. A preview teardown that declared the group
would delete every production database inside it. Databases are the stage-scoped
boundary instead.

## Immutable fields

Turso exposes no rename and no move, so the providers refuse rather than
silently ignore a change that cannot be applied:

- `Group.location` and `Group.extensions` are create-only.
- `Database.name` and `Database.group` identify the database.

A mismatch fails the deploy with a message naming the fix — change the logical
id, or delete and recreate by hand. Deleting a group deletes every database in
it, so a "replace" action is never the right answer here.

`Group.location` is only a create input. When the stack does not declare one, an
adopted group is left alone; a declared value that disagrees with the group fails
the deploy. `primary` is read as the current location field, with the deprecated
`locations` array as fallback.

## Mutable settings

Turso serves the mutable settings from a separate `.../configuration` endpoint
for both groups and databases. The providers read it and compare each declared
field against the applied value, so:

- A converged database costs one extra `GET` and no write. The `PATCH` is only
  sent when a declared `sizeLimit`, `deleteProtection`, `blockReads`,
  `blockWrites`, `allowedIps` or `allowedAwsVpcIds` disagrees with Turso.
- The applied values become attributes, so a diff can see a protection flag
  someone turned off by hand.
- An empty `allowedIps` list clears the restriction, because Turso reports the
  applied list and `[]` is compared as "no restriction".

## Tokens

`DatabaseToken` mints a **SQL-engine JWT** scoped to one database. This is a
different credential from the control-plane platform token.

- Turso never returns a minted token, so `read` returns the stored attributes
  unchanged. Without that, every deploy would re-mint and invalidate the token
  the workers are using.
- `expiresInDays` drives real rotation: `diff` reports a replace once the stored
  `expiresAt` has passed, so a static 90-day value still rotates.
- Turso can only invalidate **every** token for a database at once. `delete` is
  therefore a no-op and `nuke` skips the resource, so a stack teardown leaves the
  token valid until it expires.

The JWT stays in `Redacted` and the stack output reports only the database name
and expiry.

## Quick start

```ts
// infra/turso/turso.run.ts — the current declaration
const location = yield * Location("primary", { code: config.location });
const group = yield * Group("default", { name: config.group, location: config.location });
const database = yield * Database("wwwtom", { name: "wwwtom", group: group.name });
const token =
  yield *
  DatabaseToken("wwwtom", {
    database: database.name,
    expiresInDays: 90,
  });
```

Deploy:

```bash
ALCHEMY_STAGE=production pnpm deploy:turso
# local plan without touching Turso
ALCHEMY_STAGE=dev pnpm --filter @tom/infra exec alchemy plan turso/turso.run.ts --stage dev
```

Turso is **not** in the `pnpm deploy` chain. Run it deliberately: a production
deploy creates a real, billable database and mints a real credential.

## Testing

```bash
pnpm --filter @tom/infra test
```

`makeFakeTursoHttpLayer` (`fake.ts:88`) is an in-memory Turso: it mirrors `409`
on duplicate names, answers `404` for unknown groups and databases, and returns
the `{ name }` style shapes the real API does. No network, no credentials.

## Troubleshooting

- `CredentialsError: TURSO_API_TOKEN must be…` — the bundle is missing the key,
  or `ALCHEMY_ENV_FILE` did not load. Check `infra/.dev.vars`.
- `HttpError` with `401` or `token contains an invalid number of segments` — the
  token is not a Turso platform token, or the `TURSO_ORG` slug does not match the
  organization the token is scoped to.
- `409 Conflict` on group create — a group with that name already exists, but a
  different stage created it. Confirm the location matches.
- `InvalidArgument: a group cannot be moved` — `TURSO_LOCATION` differs from the
  adopted group's region. Set it back, or create a new group on a paid plan.
- `403` — the token is group-scoped but the deploy needs organization scope.
  Re-mint with `--org` and no `--group`.
- A database exists but the stack wants to create it — names are lowercase
  letters, numbers and dashes only. Check the stage suffix.

## References

- [Turso Platform API](https://docs.turso.tech/api-reference)
- [Authentication](https://docs.turso.tech/api-reference/authentication)
- [Branching](https://docs.turso.tech/features/branching) — not modelled here
- [Point-in-time recovery](https://docs.turso.tech/features/point-in-time-recovery) — not modelled here
