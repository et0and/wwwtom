import type { PlopTypes } from "@turbo/gen";

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  // Web app generator
  plop.setGenerator("web-app", {
    description: "Create a new web application",
    prompts: [
      {
        type: "list",
        name: "framework",
        message: "Which framework?",
        choices: [
          { name: "SolidStart (Vinxi + Cloudflare)", value: "solid-start" },
          { name: "Astro (Cloudflare adapter)", value: "astro" },
          { name: "TanStack Start", value: "tanstack-start" },
          { name: "Next.js (OpenNext)", value: "next" },
        ],
      },
      {
        type: "input",
        name: "name",
        message: "App name (e.g., blog, store):",
        validate: (input: string) => {
          if (!input) return "Name is required";
          if (!/^[a-z0-9-]+$/.test(input)) {
            return "Name must be lowercase letters, numbers, and hyphens only";
          }
          return true;
        },
      },
    ],
    actions: (data) => {
      const framework = (data as any).framework;
      const name = (data as any).name;
      const actions: PlopTypes.ActionType[] = [];

      // Copy framework-specific template
      actions.push({
        type: "addMany",
        destination: `apps/{{name}}`,
        templateFiles: `turbo/generators/templates/${framework}/**/*`,
        base: `turbo/generators/templates/${framework}`,
        abortOnFail: true,
      });

      return actions;
    },
  });

  // API generator
  plop.setGenerator("api", {
    description: "Create a new API application",
    prompts: [
      {
        type: "list",
        name: "framework",
        message: "Which framework?",
        choices: [
          { name: "Hono", value: "hono-api" },
          { name: "Elysia", value: "elysia-api" },
        ],
      },
      {
        type: "input",
        name: "name",
        message: "API name (e.g., api-v2, internal-api):",
        validate: (input: string) => {
          if (!input) return "Name is required";
          if (!/^[a-z0-9-]+$/.test(input)) {
            return "Name must be lowercase letters, numbers, and hyphens only";
          }
          return true;
        },
      },
    ],
    actions: (data) => {
      const framework = (data as any).framework;

      return [
        {
          type: "addMany",
          destination: `apps/{{name}}`,
          templateFiles: `turbo/generators/templates/${framework}/**/*`,
          base: `turbo/generators/templates/${framework}`,
          abortOnFail: true,
        },
      ];
    },
  });
}
