import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The Durable Object runtime is not available under Vitest, so the sandbox
 * base is a stub. The lifecycle logic under test only uses `schedule`,
 * `deleteSchedules`, `destroy` and `ctx.storage`, which the harness supplies.
 */
const sandboxModule = vi.hoisted(() => {
  class SandboxBase {
    async onStart(): Promise<void> {}
    async destroy(): Promise<void> {}
    async schedule(_when: Date | number, _callback: string): Promise<unknown> {
      return undefined;
    }
    deleteSchedules(_name: string): void {}
  }
  return { SandboxBase, getSandbox: vi.fn() };
});

vi.mock("@cloudflare/sandbox", () => ({
  Sandbox: sandboxModule.SandboxBase,
  getSandbox: sandboxModule.getSandbox,
}));

import { RUNNER_MAX_LIFETIME_MS, Sandbox } from "../index";

type Storage = {
  get: (key: string) => Promise<unknown>;
  put: (key: string, value: number) => Promise<void>;
  delete: (key: string) => Promise<boolean>;
};

type Harness = {
  onStart: () => Promise<void>;
  reapExpiredRunner: () => Promise<void>;
  destroy: ReturnType<typeof vi.fn>;
  schedule: ReturnType<typeof vi.fn>;
  deleteSchedules: ReturnType<typeof vi.fn>;
  ctx: { storage: Storage };
};

/** A Sandbox instance without running the DO constructor. */
const makeSandbox = (storedDeadline?: number) => {
  const values = new Map<string, number>();
  if (storedDeadline !== undefined) values.set("runnerDeadline", storedDeadline);
  const storage: Storage = {
    get: async (key) => values.get(key),
    put: async (key, value) => {
      values.set(key, value);
    },
    delete: async (key) => values.delete(key),
  };
  const sandbox = Object.create(Sandbox.prototype) as Harness;
  sandbox.ctx = { storage };
  sandbox.destroy = vi.fn(async () => undefined);
  sandbox.schedule = vi.fn(async () => undefined);
  sandbox.deleteSchedules = vi.fn();
  return { sandbox, values };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runner sandbox lifecycle", () => {
  it("exports the Sandbox class the container binding requires", () => {
    expect(Sandbox.name).toBe("Sandbox");
    expect(Object.getPrototypeOf(Sandbox)).toBe(sandboxModule.SandboxBase);
  });

  it("arms a durable reaper alarm on container start", async () => {
    const onStart = vi.spyOn(sandboxModule.SandboxBase.prototype, "onStart");
    const { sandbox, values } = makeSandbox();
    const before = Date.now();

    await sandbox.onStart();

    expect(onStart).toHaveBeenCalledTimes(1);
    const deadline = values.get("runnerDeadline") as number;
    expect(deadline).toBeGreaterThanOrEqual(before + RUNNER_MAX_LIFETIME_MS);
    expect(deadline).toBeLessThanOrEqual(Date.now() + RUNNER_MAX_LIFETIME_MS);
    expect(sandbox.deleteSchedules).toHaveBeenCalledWith("reapExpiredRunner");
    expect(sandbox.schedule).toHaveBeenCalledWith(new Date(deadline), "reapExpiredRunner");
  });

  it("keeps the original deadline across a container restart", async () => {
    const stored = Date.now() + 60_000;
    const { sandbox, values } = makeSandbox(stored);

    await sandbox.onStart();

    expect(values.get("runnerDeadline")).toBe(stored);
    expect(sandbox.schedule).toHaveBeenCalledWith(new Date(stored), "reapExpiredRunner");
  });

  it("reschedules instead of destroying when the alarm fires early", async () => {
    const stored = Date.now() + 60_000;
    const { sandbox } = makeSandbox(stored);

    await sandbox.reapExpiredRunner();

    expect(sandbox.destroy).not.toHaveBeenCalled();
    expect(sandbox.schedule).toHaveBeenCalledWith(new Date(stored), "reapExpiredRunner");
  });

  it("destroys the sandbox and clears the deadline once expired", async () => {
    const { sandbox, values } = makeSandbox(Date.now() - 1);

    await sandbox.reapExpiredRunner();

    expect(sandbox.destroy).toHaveBeenCalledTimes(1);
    expect(sandbox.deleteSchedules).toHaveBeenCalledWith("reapExpiredRunner");
    expect(values.has("runnerDeadline")).toBe(false);
  });
});
