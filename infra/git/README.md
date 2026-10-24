# git

Self-hosted Git service on Cloudflare, built with `alchemy/Git`: the Git
smart-HTTP wire, a REST management plane, and the GitHub REST facade, backed by
Durable Objects (refs + registry) and R2 (packs + clone bundles).

## Auth

GitHub OAuth through Better Auth, the same provider the editor uses. Only
emails on the admin allowlist (`TOM_CMS_ADMIN_EMAILS`, falling back to
`CMS_ADMIN_EMAILS` in the `TOM_SECRETS` bundle) can create an account. `git`
clients authenticate with a per-user API key sent as the HTTP Basic password
(username is ignored).

The same GitHub OAuth app as the editor must list these callback URLs:

- `https://git.tom.so/api/auth/callback/github` (production)
- `https://<stage>-git.tom.so/api/auth/callback/github` (other stages)
- `http://localhost:8790/api/auth/callback/github` (`alchemy dev`)

## Commands

```bash
pnpm dev:git                                     # local workerd on :8790
ALCHEMY_STAGE=production pnpm deploy:git         # deploy
ALCHEMY_STAGE=production pnpm destroy:git        # destroy
```

`alchemy deploy` applies `git/migrations` to the auth D1 database and registers
the Durable Object classes.

## Use

1. Open `https://git.tom.so/`, sign in with GitHub, and create an API key.
2. Create a repository (owner is a free-form namespace; there are no per-user
   namespaces):

```bash
curl -u "x:$GIT_KEY" -X POST https://git.tom.so/api/v1/repos \
  -H "content-type: application/json" \
  -d '{"owner":"tom","name":"wwwtom"}'
```

3. Push and clone with the key as the password:

```bash
git remote add origin https://git.tom.so/tom/wwwtom.git
git -c credential.helper= push -u origin main
git -c credential.helper= clone https://git.tom.so/tom/wwwtom.git verify
```

`gh api` and Octokit work against the same host through the GitHub facade.

## Storage

- `wwwtom-git-auth` D1 — Better Auth accounts, sessions, API keys.
- `GitObjects` R2 — packs, large objects, and clone bundles. Retained in
  production; destroyed with disposable stages.
- `GitRepo` / `GitRegistry` Durable Objects — per-repo refs and the
  owner/name lookup.
