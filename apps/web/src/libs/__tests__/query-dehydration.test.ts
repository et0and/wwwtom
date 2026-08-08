import { describe, expect, it, vi } from "vitest";
import { QueryClient, hydrate } from "@tanstack/solid-query";
import { serializeDehydratedState, waitForQueriesToSettle } from "~/libs/query-dehydration";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

const queryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });

describe("serializeDehydratedState", () => {
  it("serializes successful queries", async () => {
    const client = queryClient();
    await client.prefetchQuery({
      queryKey: ["posts", 1],
      queryFn: async () => ({ data: [{ id: 1 }] }),
    });
    const state = JSON.parse(serializeDehydratedState(client));
    expect(state.queries).toHaveLength(1);
    expect(state.queries[0].queryKey).toEqual(["posts", 1]);
    expect(state.queries[0].state.data).toEqual({ data: [{ id: 1 }] });
  });

  it("escapes < so content cannot break out of the script element", async () => {
    const client = queryClient();
    await client.prefetchQuery({
      queryKey: ["post", "x"],
      queryFn: async () => ({ content: "</script><script>alert(1)</script>" }),
    });
    const serialized = serializeDehydratedState(client);
    expect(serialized).not.toContain("</script>");
    const state = JSON.parse(serialized);
    expect(state.queries[0].state.data.content).toBe("</script><script>alert(1)</script>");
  });

  it("omits failed queries", async () => {
    const client = queryClient();
    await client
      .prefetchQuery({
        queryKey: ["post", "missing"],
        queryFn: async () => {
          throw new Error("Adapter request failed");
        },
      })
      .catch(() => {});
    const state = JSON.parse(serializeDehydratedState(client));
    expect(state.queries).toHaveLength(0);
  });

  it("serializes an empty state for an empty cache", () => {
    const state = JSON.parse(serializeDehydratedState(queryClient()));
    expect(state).toEqual({ mutations: [], queries: [] });
  });
});

describe("waitForQueriesToSettle", () => {
  it("resolves immediately when the cache is empty", async () => {
    await expect(waitForQueriesToSettle(queryClient())).resolves.toBeUndefined();
  });

  it("resolves immediately when every query is already settled", async () => {
    const client = queryClient();
    await client.prefetchQuery({
      queryKey: ["works"],
      queryFn: async () => [{ id: 1 }],
    });
    await expect(waitForQueriesToSettle(client)).resolves.toBeUndefined();
  });

  it("waits for in-flight queries to settle", async () => {
    const client = queryClient();
    const pending = deferred<{ data: [] }>();
    const prefetch = client.prefetchQuery({
      queryKey: ["posts", 1],
      queryFn: () => pending.promise,
    });
    const waitPromise = waitForQueriesToSettle(client);
    let settled = false;
    void waitPromise.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    pending.resolve({ data: [] });
    await Promise.all([waitPromise, prefetch]);
    expect(settled).toBe(true);
  });
});

describe("server-to-client round trip", () => {
  it("hydrates a fresh client with the server-side data", async () => {
    const server = queryClient();
    await server.prefetchQuery({
      queryKey: ["posts", 1],
      queryFn: async () => ({ data: [{ id: 34, title: "A pattern language" }] }),
    });
    const state = JSON.parse(serializeDehydratedState(server));
    const client = queryClient();
    hydrate(client, state);
    expect(client.getQueryData(["posts", 1])).toEqual({
      data: [{ id: 34, title: "A pattern language" }],
    });
  });

  it("keeps the hydrated data fresh so the client does not refetch", async () => {
    const server = queryClient();
    await server.prefetchQuery({
      queryKey: ["posts", 1],
      queryFn: async () => ({ data: [] }),
    });
    const client = queryClient();
    hydrate(client, JSON.parse(serializeDehydratedState(server)));
    const fetchFn = vi.fn(async () => ({ data: [] }));
    const result = await client.fetchQuery({ queryKey: ["posts", 1], queryFn: fetchFn });
    expect(result).toEqual({ data: [] });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
