import preview from "#.storybook/preview";
import { Code } from "@tom/ui/tomui/code";

const meta = preview.meta({
  title: "web/Code",
  component: Code,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
});

export const TypeScript = meta.story({
  args: {
    lang: "ts",
    code: "const total = items.length;",
  },
});

export const Tsx = meta.story({
  args: {
    lang: "tsx",
    code: "const greeting = <span>Hello</span>;",
  },
});

export const Bash = meta.story({
  args: {
    lang: "bash",
    code: "pnpm install",
  },
});

export const Jsonc = meta.story({
  args: {
    lang: "jsonc",
    code: '{ // site name\n  "name": "tom" }',
  },
});

export const Css = meta.story({
  args: {
    lang: "css",
    code: ".card { display: flex; }",
  },
});

export const WithHighlight = meta.story({
  args: {
    lang: "bash",
    code: "export API_KEY={{apiKey}}",
    values: { apiKey: { value: "sk_live_123", highlight: true } },
  },
});

export const Block = meta.story({
  render: () => <Code.Block lang="tsx" code={'const greeting = "Hello!";'} />,
});
