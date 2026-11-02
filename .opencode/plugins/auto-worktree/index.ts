import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Plugin } from "@opencode/plugin";

// Git worktrees never contain ignored files, so carry the local env across.
const copiedFiles = ["infra/.dev.vars"];

// Sessions created moments before the plugin activates (cold CLI start) still
// get adopted. Anything older was left alone on purpose.
const adoptionWindowMs = 120_000;

const report = (message: string, cause: unknown) => {
  console.error(`auto-worktree: ${message}`, cause);
};

const isWithin = (directory: string, parent: string) =>
  directory === parent || directory.startsWith(`${parent}/`);

const copyMissingFiles = async (source: string, destination: string) => {
  for (const relativePath of copiedFiles) {
    const target = join(destination, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(source, relativePath), target, constants.COPYFILE_EXCL).catch(
      (error: { code?: string }) => {
        if (error.code !== "EEXIST") throw error;
      },
    );
  }
};

const installDependencies = (directory: string) => {
  const child = spawn("pnpm", ["install", "--prefer-offline"], {
    cwd: directory,
    detached: true,
    stdio: "ignore",
  });
  child.on("error", (error) => report("failed to start pnpm install", error));
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      report(`pnpm install exited with code ${code}`, directory);
    }
  });
  child.unref();
};

export default Plugin.define({
  id: "wwwtom.auto-worktree",
  async setup(ctx) {
    const project = ctx.location.project;

    // Worktrees load this plugin too: they only need their local env files.
    if (ctx.location.directory !== project.canonical) {
      await copyMissingFiles(project.canonical, ctx.location.directory).catch((error) =>
        report("failed to copy local files", error),
      );
      return;
    }

    const isInWorktree = async (directory: string) => {
      const worktrees = await ctx.worktree.list({ projectID: project.id });
      return worktrees.some(
        (worktree) => worktree.type === "worktree" && isWithin(directory, worktree.directory),
      );
    };

    const syncWorktrees = async () => {
      const worktrees = await ctx.worktree.list({ projectID: project.id });
      await Promise.all(
        worktrees
          .filter((worktree) => worktree.type === "worktree")
          .map((worktree) => copyMissingFiles(project.canonical, worktree.directory)),
      );
    };

    const moveToWorktree = async (sessionID: string, name: string) => {
      const worktree = await ctx.worktree.create({
        projectID: project.id,
        name,
      });
      await copyMissingFiles(project.canonical, worktree.directory);
      installDependencies(worktree.directory);
      await ctx.session.move({ sessionID, directory: worktree.directory });
    };

    const adoptRecentSessions = async () => {
      const page = await ctx.session.list({
        directory: project.canonical,
        limit: 20,
      });
      const cutoff = Date.now() - adoptionWindowMs;

      for (const session of page.data) {
        if (session.parentID !== undefined) continue;
        if (session.time.created < cutoff) continue;
        if (await isInWorktree(session.location.directory)) continue;

        const messages = await ctx.session.context({ sessionID: session.id });
        if (messages.length > 0) continue;

        await moveToWorktree(session.id, session.id);
      }
    };

    await adoptRecentSessions().catch((error) => report("failed to adopt recent sessions", error));

    void syncWorktrees().catch((error) => report("failed to sync existing worktrees", error));

    const controller = new AbortController();
    void (async () => {
      for await (const event of ctx.event.subscribe({
        signal: controller.signal,
      })) {
        if (event.type !== "session.created") continue;
        const session = event.data;
        if (session.projectID !== project.id) continue;
        if (session.parentID !== undefined) continue;
        if (!isWithin(session.location.directory, project.canonical)) continue;
        if (await isInWorktree(session.location.directory)) continue;

        await moveToWorktree(session.sessionID, session.slug ?? session.sessionID).catch((error) =>
          report("failed to create a worktree for the session", error),
        );
      }
    })().catch((error) => {
      if (controller.signal.aborted) return;
      report("event subscription failed", error);
    });

    return () => controller.abort();
  },
});
