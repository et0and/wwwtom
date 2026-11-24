import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCommandPolicy,
  HOOK_BYPASS_REASON,
  NONINTERACTIVE_VCS_ENV,
} from "./vcs-command-policy.mjs";

const blocked = { action: "block", reason: HOOK_BYPASS_REASON };

const bypasses = [
  "git commit --no-verify -m wip",
  "git commit --no-verif -m wip",
  "git push --no-verify",
  "git merge --no-verify feature",
  "cd sub && git commit -m 'wip' --no-verify",
  "/usr/bin/git commit --no-verify",
  "git commit -n -m wip",
  "git commit -nm wip",
  "git commit -anm wip",
  "git commit -m wip -n",
  "git -C . commit -n",
  "git -c core.hooksPath=/dev/null commit -m wip",
  "git -c core.hookspath=/dev/null commit -m wip",
  "git config core.hooksPath .nohooks",
  "git config set core.hooksPath .nohooks",
  "LEFTHOOK=0 git commit -m wip",
  "HUSKY=0 git commit -m wip",
  "HUSKY=false git commit -m wip",
  "env HUSKY=0 git commit -m wip",
  "export HUSKY=0",
  "rm -rf .git/hooks",
  "echo exit 0 > .git/hooks/pre-commit",
  "cat noop >> .git/hooks/pre-commit",
  "chmod -x .git/hooks/pre-commit",
  "rm -rf .husky",
  "echo exit 0 > .husky/pre-commit",
  "cat noop >> .husky/pre-commit",
  'bash -c "git commit --no-verify"',
  "sh -c 'git commit -n -m wip'",
];

const ordinary = [
  "git status",
  "git commit -m 'add -n flag docs'",
  "git commit -m '--no-verify is banned'",
  "git commit -m wip",
  "git commit -am wip",
  "git commit -F msg.txt -- -n",
  "git commit --message -nope",
  "git commit --author -n -m wip",
  "git log -n 5",
  "git push -n origin main",
  "git add -n .",
  "git config --get core.hooksPath",
  "ls .git/hooks",
  "cat .git/hooks/pre-commit",
  "ls .husky",
  "cat .husky/pre-commit",
  "pnpm lint",
  "grep -rn no-verify docs",
  "some-tool --no-verify",
  "HUSKY=1 git commit -m wip",
];

test("leaves unrelated shell commands unchanged", () => {
  assert.deepEqual(applyCommandPolicy("pnpm test"), {
    action: "allow",
    command: "pnpm test",
  });
});

test("prevents Git and Jujutsu from opening an editor", () => {
  assert.deepEqual(applyCommandPolicy("cd repo && git rebase -i HEAD~2"), {
    action: "allow",
    command: `${NONINTERACTIVE_VCS_ENV}cd repo && git rebase -i HEAD~2`,
  });
  assert.deepEqual(applyCommandPolicy("jj describe"), {
    action: "allow",
    command: `${NONINTERACTIVE_VCS_ENV}jj describe`,
  });
});

test("blocks every way to skip or disable the hooks", () => {
  assert.deepEqual(
    bypasses.filter((command) => applyCommandPolicy(command).action !== "block"),
    [],
  );
});

test("allows ordinary commands that only look like a bypass", () => {
  assert.deepEqual(
    ordinary.filter((command) => applyCommandPolicy(command).action !== "allow"),
    [],
  );
});

const quote = (text) => `'${text.replaceAll("'", "'\\''")}'`;

const messages = ["'quoted' -n", "--no-verify", "wip\nnext", "HUSKY=0"];

test("never blocks a commit for the words in its message", () => {
  for (const message of messages) {
    assert.equal(applyCommandPolicy(`git commit -m ${quote(message)}`).action, "allow");
  }
});

test("blocks a bypass whatever the commit message says", () => {
  for (const message of messages) {
    const commands = [
      `git commit -n -m ${quote(message)}`,
      `git commit -m ${quote(message)} --no-verify`,
      `HUSKY=0 git commit -m ${quote(message)}`,
      `bash -c ${quote(`git commit -nm ${quote(message)}`)}`,
    ];

    for (const command of commands) {
      assert.deepEqual(applyCommandPolicy(command), blocked);
    }
  }
});
