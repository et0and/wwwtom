interface KVNamespace {
  get(key: string, options?: { type: "text" } | string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export function getKV() {
  if (typeof globalThis.caches === "undefined") return undefined;
  return (globalThis as any).ANALYTICS_KV as KVNamespace | undefined;
}

export async function incrementPageView(path: string) {
  const kv = getKV();
  if (!kv) return "0";

  const key = `pageview:${path}`;
  const current = await kv.get(key, "text");
  const newValue = (parseInt(current || "0") + 1).toString();

  await kv.put(key, newValue);
  return newValue;
}

export async function getPageView(path: string) {
  const kv = getKV();
  const count = await kv?.get(`pageview:${path}`, "text");
  return count || "0";
}