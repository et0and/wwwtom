import { describe, expect, it } from "vitest";
import { SIMULATOR_HEADER, isSimulatorRequest, simulatorEnv } from "../simulator";
import { testEnv } from "../test/helpers";

const SIMULATOR_URL = "http://127.0.0.1:8789";

const withHeader = (value?: string): Request =>
  new Request("http://localhost/content/posts", {
    headers: value === undefined ? {} : { [SIMULATOR_HEADER]: value },
  });

describe("isSimulatorRequest", () => {
  it("is false when the header is absent", () => {
    expect(isSimulatorRequest(withHeader())).toBe(false);
  });

  it("is false when the header is present but empty", () => {
    expect(isSimulatorRequest(withHeader(""))).toBe(false);
  });

  it("is true for any non-empty value", () => {
    expect(isSimulatorRequest(withHeader("1"))).toBe(true);
    expect(isSimulatorRequest(withHeader("yes"))).toBe(true);
  });
});

describe("simulatorEnv", () => {
  const production = testEnv({ API_URL: "https://api.tom.so" });

  it("rewrites the upstream URL when the header and SIMULATOR_URL are both present", () => {
    const env = simulatorEnv({ ...production, SIMULATOR_URL }, withHeader("1"));
    expect(env.API_URL).toBe(SIMULATOR_URL);
  });

  it("drops the api binding so the simulator rewrite wins", () => {
    const binding = { fetch: async () => new Response("live") };
    const env = simulatorEnv({ ...production, SIMULATOR_URL, API: binding }, withHeader("1"));
    expect(env.API).toBeUndefined();
    expect(env.API_URL).toBe(SIMULATOR_URL);
  });

  it("leaves the env alone without the header", () => {
    const env = simulatorEnv({ ...production, SIMULATOR_URL }, withHeader());
    expect(env.API_URL).toBe("https://api.tom.so");
  });

  it("leaves the env alone without SIMULATOR_URL, so the header cannot redirect traffic", () => {
    const env = simulatorEnv(production, withHeader("1"));
    expect(env.API_URL).toBe("https://api.tom.so");
  });

  it("rejects an empty header even when SIMULATOR_URL is set", () => {
    const env = simulatorEnv({ ...production, SIMULATOR_URL }, withHeader(""));
    expect(env.API_URL).toBe("https://api.tom.so");
  });
});
