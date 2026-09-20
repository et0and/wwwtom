import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

/**
 * Sign-in landing page: GitHub OAuth, then mint a Git API key to use as the
 * HTTP Basic password. Static markup only — no request data is interpolated.
 */
const HOME_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>tom git</title>
</head>
<body>
<main>
<h1>tom git</h1>
<p id="status">Loading…</p>
<button id="sign-in" hidden>Sign in with GitHub</button>
<button id="create-key" hidden>Create API key</button>
<pre id="key" hidden></pre>
</main>
<script>
const status = document.getElementById("status");
const signIn = document.getElementById("sign-in");
const createKey = document.getElementById("create-key");
const keyOutput = document.getElementById("key");

const requestJson = async (url, init) => {
  try {
    const response = await fetch(url, init);
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
};

const createApiKey = async () => {
  createKey.disabled = true;
  const body = await requestJson("/api/auth/api-key/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "git" }),
  });
  createKey.disabled = false;
  if (!body || !body.key) {
    status.textContent = "Could not create a key. Reload and try again.";
    return;
  }
  keyOutput.textContent = body.key;
  keyOutput.hidden = false;
  status.textContent = "Copy the key now - it is shown once. Use it as the git password.";
};

const start = async () => {
  const session = await requestJson("/api/auth/get-session");
  if (session && session.user) {
    status.textContent = "Signed in as " + session.user.email;
    createKey.hidden = false;
    createKey.addEventListener("click", createApiKey);
    return;
  }
  status.textContent = "Sign in with GitHub to push or clone.";
  signIn.hidden = false;
  signIn.addEventListener("click", async () => {
    signIn.disabled = true;
    const body = await requestJson("/api/auth/sign-in/social", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "github", callbackURL: "/" }),
    });
    if (body && body.url) {
      location.href = body.url;
      return;
    }
    signIn.disabled = false;
    status.textContent = "Sign-in failed. Reload and try again.";
  });
};

start();
</script>
</body>
</html>
`;

export const homePage = (): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.html(HOME_HTML);
