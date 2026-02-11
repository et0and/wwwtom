# Turbo Generators

This directory contains generators for creating new apps and APIs in the monorepo.

## Usage

### Create a new web app:

```bash
bun turbo gen web-app
```

### Create a new API service:

```bash
bun turbo gen api
```

## How it works

The generators use [Plop](https://plopjs.com/) under the hood via `@turbo/gen`. Templates are located in `templates/` and processed using Handlebars syntax (`{{name}}` for variables).

### Template variables

- `{{name}}` - The app/api name you provide when running the generator

### Adding new templates

1. Create a new directory under `templates/`
2. Add your template files with `{{variable}}` placeholders
3. Register the generator in `config.ts`
4. Run `bun turbo gen <generator-name>` to test
