import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { PageLayout } from "@tom/ui/PageLayout";
import { BlurInText } from "~/components/BlurInText";
import { BlurInSection } from "~/components/BlurInSection";
import { callAdapter, unwrapAdapter } from "~/libs/adapter";

type Scope = "all" | "one" | "multiple";

type SessionResult = {
  session?: { user?: { id?: string; name?: string; email?: string } };
} | null;

type ApiKey = {
  id: string;
  name: string | undefined;
  start: string | undefined;
  createdAt: string | number | undefined;
  key: string | undefined;
  metadata: { scope?: Scope; regions?: string[]; postcodes?: boolean } | undefined;
};

type Usage = { hour: number; day: number; week: number; month: number; year: number };

const EMPTY_USAGE: Usage = { hour: 0, day: 0, week: 0, month: 0, year: 0 };

const NZ_REGIONS = [
  "Northland",
  "Auckland",
  "Waikato",
  "Bay of Plenty",
  "Gisborne",
  "Hawke's Bay",
  "Taranaki",
  "Manawatū-Whanganui",
  "Wellington",
  "Tasman",
  "Nelson",
  "Marlborough",
  "West Coast",
  "Canterbury",
  "Otago",
  "Southland",
];

const fetchSession = async (): Promise<SessionResult> => {
  const result = await callAdapter().auth.session.get();
  return unwrapAdapter(result) as SessionResult;
};

const fetchKeys = async (): Promise<readonly ApiKey[]> => {
  try {
    const result = await callAdapter().auth.keys.get();
    return unwrapAdapter(result) as readonly ApiKey[];
  } catch {
    return [];
  }
};

const fetchUsage = async (keyId: string): Promise<Usage> => {
  try {
    const result = await callAdapter().auth.usage.get({ query: { keyId } });
    return unwrapAdapter(result) as Usage;
  } catch {
    return EMPTY_USAGE;
  }
};

export default function Dashboard() {
  const [session, { refetch: refetchSession }] = createResource(fetchSession);
  const [keys, { refetch: refetchKeys }] = createResource(fetchKeys);
  const [name, setName] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [authMessage, setAuthMessage] = createSignal("");
  const [scope, setScope] = createSignal<Scope>("all");
  const [singleRegion, setSingleRegion] = createSignal("Auckland");
  const [multiRegions, setMultiRegions] = createSignal<string[]>(["Auckland", "Wellington"]);
  const [postcodes, setPostcodes] = createSignal(true);
  const [keyName, setKeyName] = createSignal("");
  const [lastCreated, setLastCreated] = createSignal<ApiKey | null>(null);
  const [filterKey, setFilterKey] = createSignal<string>("all");

  const canCreateKey = createMemo(() => keyName().trim().length > 0);

  const [usage] = createResource(filterKey, (keyId) => fetchUsage(keyId));

  const handleSignUp = async () => {
    try {
      await callAdapter().auth["sign-up"].email.post({
        name: name(),
        email: email(),
        password: password(),
      });
      setAuthMessage("Account created and signed in.");
      void refetchSession();
    } catch (error) {
      setAuthMessage(`Sign up failed: ${String(error)}`);
    }
  };

  const handleSignIn = async () => {
    try {
      await callAdapter().auth["sign-in"].email.post({
        email: email(),
        password: password(),
      });
      setAuthMessage("Signed in.");
      void refetchSession();
    } catch (error) {
      setAuthMessage(`Sign in failed: ${String(error)}`);
    }
  };

  const handleSignOut = async () => {
    await callAdapter().auth["sign-out"].post(undefined);
    setAuthMessage("Signed out.");
    void refetchSession();
  };

  const handleGithubSignIn = async () => {
    try {
      const result = await callAdapter().auth["sign-in"].social.post({
        provider: "github",
        callbackURL: `${window.location.origin}/dashboard`,
      });
      const social = unwrapAdapter(result);
      if (social.redirect && social.url) {
        window.location.href = social.url;
      } else {
        setAuthMessage("GitHub sign-in returned no redirect URL.");
        void refetchSession();
      }
    } catch (error) {
      setAuthMessage(`GitHub sign-in failed: ${String(error)}`);
    }
  };

  const handleSsoRegister = () => {
    setAuthMessage(
      "SAML needs your IdP metadata (Entity ID, SSO URL, certificate). Once provided, a samlConfig is stored in D1 per organization and /api/auth/sign-in/sso handles the flow.",
    );
  };

  const handleCreateKey = async () => {
    const nameValue = keyName().trim();
    if (!nameValue) return;
    const regions = scope() === "all" ? [] : scope() === "one" ? [singleRegion()] : multiRegions();
    const result = await callAdapter().auth.keys.post({
      name: nameValue,
      scope: scope(),
      regions,
      postcodes: postcodes(),
    });
    const created = unwrapAdapter(result);
    setLastCreated({
      id: created.id,
      key: created.key,
      name: nameValue,
      createdAt: new Date().toISOString(),
      start: undefined,
      metadata: { scope: scope(), regions, postcodes: postcodes() },
    });
    setKeyName("");
    void refetchKeys();
  };

  const toggleMultiRegion = (region: string) => {
    setMultiRegions((previous) =>
      previous.includes(region)
        ? previous.filter((item) => item !== region)
        : [...previous, region],
    );
  };

  const currentUser = () => session()?.session?.user;

  return (
    <PageLayout
      title="Commercial Dashboard — Demo"
      description="Demo dashboard for address API commercialisation. No charge."
    >
      <BlurInText text="Commercial Dashboard" tag="h1" baseDelay={0.1} step={0.025} />
      <BlurInSection delay={0.2}>
        <div class="banner" role="status">
          <p class="banner-title">Demo — No charge</p>
          <p>
            Create account, choose SAML SSO or OAuth2, define area scope, set postcodes, create API
            key with name, and you are ready. Usage tracks per hour, day, week, month, year with
            filter by key. Auth DB is D1 on the api worker.
          </p>
        </div>
      </BlurInSection>

      <BlurInSection delay={0.3}>
        <h2 class="text-lg font-medium mb-2">1. Account</h2>
        <Show when={currentUser()} fallback={<p class="text-sm text-muted mb-2">Signed out.</p>}>
          <p class="text-sm text-muted mb-2">
            Signed in as {currentUser()?.name ?? currentUser()?.email}.
          </p>
          <button class="button-secondary" onClick={handleSignOut}>
            Sign out
          </button>
        </Show>
        <Show when={!currentUser()}>
          <div class="space-y-2 max-w-md">
            <input
              class="input w-full"
              placeholder="Name (sign up only)"
              value={name()}
              onInput={(event) => setName(event.currentTarget.value)}
            />
            <input
              class="input w-full"
              type="email"
              placeholder="Email"
              value={email()}
              onInput={(event) => setEmail(event.currentTarget.value)}
            />
            <input
              class="input w-full"
              type="password"
              placeholder="Password"
              value={password()}
              onInput={(event) => setPassword(event.currentTarget.value)}
            />
            <div class="flex gap-2">
              <button class="button-primary" onClick={handleSignUp}>
                Create account
              </button>
              <button class="button-secondary" onClick={handleSignIn}>
                Sign in
              </button>
            </div>
          </div>
        </Show>
        <Show when={authMessage()}>
          <p class="text-sm text-muted mt-2">{authMessage()}</p>
        </Show>
        <div class="mt-4 flex gap-2 items-center">
          <button class="button-secondary" onClick={handleSsoRegister}>
            SAML SSO (needs IdP metadata)
          </button>
          <button class="button-secondary" onClick={handleGithubSignIn}>
            Sign in with GitHub
          </button>
        </div>
      </BlurInSection>

      <BlurInSection delay={0.35}>
        <h2 class="text-lg font-medium mb-2">2. Define area scope</h2>
        <div class="flex gap-2 mb-3">
          <button
            class={`button-secondary ${scope() === "all" ? "bg-gray-100 dark:bg-white/10" : ""}`}
            onClick={() => setScope("all")}
          >
            All of New Zealand
          </button>
          <button
            class={`button-secondary ${scope() === "one" ? "bg-gray-100 dark:bg-white/10" : ""}`}
            onClick={() => setScope("one")}
          >
            One region
          </button>
          <button
            class={`button-secondary ${scope() === "multiple" ? "bg-gray-100 dark:bg-white/10" : ""}`}
            onClick={() => setScope("multiple")}
          >
            Multiple regions
          </button>
        </div>
        <Show when={scope() === "one"}>
          <label class="block text-sm font-medium mb-1" for="single-region">
            Region
          </label>
          <select
            id="single-region"
            class="input w-full mb-3"
            value={singleRegion()}
            onChange={(event) => setSingleRegion(event.currentTarget.value)}
          >
            <For each={NZ_REGIONS}>{(region) => <option value={region}>{region}</option>}</For>
          </select>
        </Show>
        <Show when={scope() === "multiple"}>
          <p class="text-sm text-muted mb-1">Select regions</p>
          <div class="grid grid-cols-2 gap-2 mb-3">
            <For each={NZ_REGIONS}>
              {(region) => (
                <label class="flex gap-2 items-center text-sm">
                  <input
                    type="checkbox"
                    checked={multiRegions().includes(region)}
                    onChange={() => toggleMultiRegion(region)}
                  />
                  {region}
                </label>
              )}
            </For>
          </div>
        </Show>
        <label class="flex gap-2 items-center text-sm mb-3">
          <input
            type="checkbox"
            checked={postcodes()}
            onChange={(event) => setPostcodes(event.currentTarget.checked)}
          />
          Include postcodes in results
        </label>
      </BlurInSection>

      <BlurInSection delay={0.4}>
        <h2 class="text-lg font-medium mb-2">3. Create API key</h2>
        <label class="block text-sm font-medium mb-1" for="key-name">
          Key name (required)
        </label>
        <input
          id="key-name"
          class="input w-full mb-2"
          placeholder="My app key"
          value={keyName()}
          onInput={(event) => setKeyName(event.currentTarget.value)}
        />
        <button
          class="button-primary"
          disabled={!canCreateKey() || !currentUser()}
          onClick={handleCreateKey}
        >
          Create API key
        </button>
        <Show when={!currentUser()}>
          <p class="text-xs text-muted mt-1">Sign in to create a key.</p>
        </Show>
        <Show when={lastCreated()}>
          {(key) => (
            <div class="mt-4 p-3 border rounded bg-gray-50 dark:bg-white/5">
              <p class="text-sm font-medium">Key ready — copy now</p>
              <p class="text-sm font-mono break-all">{key().key}</p>
              <p class="text-xs text-muted">
                Scope:{" "}
                {key().metadata?.scope === "all" || !key().metadata?.scope
                  ? "All NZ"
                  : key().metadata?.regions?.join(", ")}{" "}
                · Postcodes: {key().metadata?.postcodes === false ? "no" : "yes"} · Name:{" "}
                {key().name}
              </p>
            </div>
          )}
        </Show>
        <Show when={keys() && keys()!.length > 0}>
          <ul class="mt-4 space-y-2 list-none pl-0">
            <For each={keys()} fallback={null}>
              {(item) => (
                <li class="p-3 border rounded list-none">
                  <div class="font-medium">{item.name}</div>
                  <div class="text-sm text-muted">
                    {item.metadata?.scope === "all" || !item.metadata?.scope
                      ? "All NZ"
                      : item.metadata?.regions?.join(", ")}{" "}
                    · Postcodes: {item.metadata?.postcodes === false ? "no" : "yes"} · id:{" "}
                    {item.start ?? item.id}
                  </div>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </BlurInSection>

      <BlurInSection delay={0.45}>
        <h2 class="text-lg font-medium mb-2">4. Usage</h2>
        <div class="flex gap-2 items-center mb-3">
          <label class="text-sm font-medium" for="filter-key">
            Filter by key
          </label>
          <select
            id="filter-key"
            class="input"
            value={filterKey()}
            onChange={(event) => setFilterKey(event.currentTarget.value)}
          >
            <option value="all">All keys</option>
            <For each={keys()} fallback={null}>
              {(item) => <option value={item.id}>{item.name}</option>}
            </For>
          </select>
        </div>
        <Show
          when={!usage.loading && usage()}
          fallback={<p class="text-sm text-muted">Loading…</p>}
        >
          <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div class="p-3 border rounded">
              <div class="text-xs text-muted">Per hour</div>
              <div class="font-medium">{usage()!.hour.toLocaleString()}</div>
            </div>
            <div class="p-3 border rounded">
              <div class="text-xs text-muted">Per day</div>
              <div class="font-medium">{usage()!.day.toLocaleString()}</div>
            </div>
            <div class="p-3 border rounded">
              <div class="text-xs text-muted">Per week</div>
              <div class="font-medium">{usage()!.week.toLocaleString()}</div>
            </div>
            <div class="p-3 border rounded">
              <div class="text-xs text-muted">Per month</div>
              <div class="font-medium">{usage()!.month.toLocaleString()}</div>
            </div>
            <div class="p-3 border rounded">
              <div class="text-xs text-muted">Per year</div>
              <div class="font-medium">{usage()!.year.toLocaleString()}</div>
            </div>
          </div>
        </Show>
        <p class="text-xs text-muted mt-2">
          Counts come from the D1 `auth_usage` table, recorded on each `x-api-key` search request.
        </p>
      </BlurInSection>
    </PageLayout>
  );
}
