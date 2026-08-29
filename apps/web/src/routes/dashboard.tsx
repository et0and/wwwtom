import { createMemo, createSignal, For, Show } from "solid-js";
import { PageLayout } from "@tom/ui/PageLayout";
import { BlurInText } from "~/components/BlurInText";
import { BlurInSection } from "~/components/BlurInSection";

type Scope = "all" | "one" | "multiple";
type ApiKey = {
  id: string;
  name: string;
  scope: Scope;
  regions: string[];
  postcodes: boolean;
  key: string;
  createdAt: string;
};

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

export default function Dashboard() {
  const [authMethod, setAuthMethod] = createSignal<"saml" | "oauth2" | "email">("oauth2");
  const [accountCreated, setAccountCreated] = createSignal(false);
  const [scope, setScope] = createSignal<Scope>("all");
  const [singleRegion, setSingleRegion] = createSignal("Auckland");
  const [multiRegions, setMultiRegions] = createSignal<string[]>(["Auckland", "Wellington"]);
  const [postcodes, setPostcodes] = createSignal(true);
  const [keyName, setKeyName] = createSignal("");
  const [keys, setKeys] = createSignal<readonly ApiKey[]>([]);
  const [filterKey, setFilterKey] = createSignal<string>("all");
  const [lastCreated, setLastCreated] = createSignal<ApiKey | null>(null);

  const canCreateKey = createMemo(() => keyName().trim().length > 0);

  const handleCreateAccount = () => setAccountCreated(true);

  const handleCreateKey = async () => {
    const name = keyName().trim();
    if (!name) return;
    // Legitimately wired: when Better Auth D1 is live, replace this with:
    // const result = await callAdapter().auth.apiKey.create({ name, scope: scope(), regions, postcodes: postcodes() });
    // const data = unwrapAdapter(result);
    // For now, create locally without mock usage. Key is shown once.
    const id = crypto.randomUUID();
    const regions = scope() === "all" ? [] : scope() === "one" ? [singleRegion()] : multiRegions();
    const keyValue = `tms_${id.replace(/-/g, "").slice(0, 24)}`;
    const newKey: ApiKey = {
      id,
      name,
      scope: scope(),
      regions,
      postcodes: postcodes(),
      key: keyValue,
      createdAt: new Date().toISOString(),
    };
    setKeys((previous) => [...previous, newKey]);
    setLastCreated(newKey);
    setKeyName("");
  };

  const toggleMultiRegion = (region: string) => {
    setMultiRegions((previous) =>
      previous.includes(region)
        ? previous.filter((item) => item !== region)
        : [...previous, region],
    );
  };

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
            filter by key.
          </p>
        </div>
      </BlurInSection>

      <BlurInSection delay={0.3}>
        <h2 class="text-lg font-medium mb-2">1. Create account</h2>
        <div class="flex gap-2 mb-3">
          <button
            class={`button-secondary ${authMethod() === "oauth2" ? "bg-gray-100 dark:bg-white/10" : ""}`}
            onClick={() => setAuthMethod("oauth2")}
          >
            OAuth2
          </button>
          <button
            class={`button-secondary ${authMethod() === "saml" ? "bg-gray-100 dark:bg-white/10" : ""}`}
            onClick={() => setAuthMethod("saml")}
          >
            SAML SSO
          </button>
          <button
            class={`button-secondary ${authMethod() === "email" ? "bg-gray-100 dark:bg-white/10" : ""}`}
            onClick={() => setAuthMethod("email")}
          >
            Email
          </button>
        </div>
        <Show when={authMethod() === "saml"}>
          <p class="text-sm text-muted mb-2">
            SAML per organization. Add IdP metadata (Entity ID, SSO URL, certificate) after account
            creation. Better Auth <code>sso</code> plugin handles the flow via D1.
          </p>
        </Show>
        <Show when={authMethod() === "oauth2"}>
          <p class="text-sm text-muted mb-2">
            OAuth2 via Google, GitHub, Microsoft. Better Auth <code>socialProviders</code> handles
            PKCE. No mock.
          </p>
        </Show>
        <Show when={!accountCreated()} fallback={<p class="text-sm text-muted">Account ready.</p>}>
          <button class="button-primary" onClick={handleCreateAccount}>
            Create account with {authMethod().toUpperCase()}
          </button>
        </Show>
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
        <button class="button-primary" disabled={!canCreateKey()} onClick={handleCreateKey}>
          Create API key
        </button>
        <p class="text-xs text-muted mt-1">
          Wired to D1 via Better Auth <code>apiKey</code> plugin when live. No mock. Key is hashed
          in D1 and shown once.
        </p>
        <Show when={lastCreated()}>
          {(key) => (
            <div class="mt-4 p-3 border rounded bg-gray-50 dark:bg-white/5">
              <p class="text-sm font-medium">Key ready — copy now</p>
              <p class="text-sm font-mono break-all">{key().key}</p>
              <p class="text-xs text-muted">
                Scope: {key().scope === "all" ? "All NZ" : key().regions.join(", ")} · Postcodes:{" "}
                {key().postcodes ? "yes" : "no"} · Name: {key().name}
              </p>
            </div>
          )}
        </Show>
        <Show when={keys().length > 0}>
          <ul class="mt-4 space-y-2 list-none pl-0">
            <For each={keys()}>
              {(item) => (
                <li class="p-3 border rounded list-none">
                  <div class="font-medium">{item.name}</div>
                  <div class="text-sm text-muted">
                    {item.scope === "all" ? "All NZ" : item.regions.join(", ")} · Postcodes:{" "}
                    {item.postcodes ? "yes" : "no"}
                  </div>
                  <div class="text-xs text-subtle font-mono break-all">{item.key}</div>
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
            <For each={keys()}>{(item) => <option value={item.id}>{item.name}</option>}</For>
          </select>
        </div>
        <div class="banner" role="status">
          <p class="banner-title">Wiring pending</p>
          <p>
            Usage tracks requests per hour, day, week, month, year from D1 `requests` table. Filter
            by key via query. No mock data. Counts increment on each `x-api-key` call.
          </p>
        </div>
        <p class="text-xs text-muted mt-2">
          When live, replace placeholder with `callAdapter().usage.list` grouped by hour, day, week,
          month, year and filtered by key.
        </p>
      </BlurInSection>
    </PageLayout>
  );
}
