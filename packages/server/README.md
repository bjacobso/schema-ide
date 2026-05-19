# @schema-ide/server

Standalone Effect HTTP server for the Schema IDE OpenRouter proxy.
Use this package when the browser should call a local `/v1` API instead of holding a model key.
It implements the protocol-owned `SchemaIdeHttpApi` with a swappable OpenRouter client service.
The package can boot without host web, runtime, or node app routes.
This package is the extraction target for `@schema-ide/server`.

```bash
pnpm --dir packages/server dev
```

The dev server starts with a local debug responder when no key is present. Set `SCHEMA_IDE_OPENROUTER_API_KEY` or `OPENROUTER_API_KEY` to proxy real model calls through OpenRouter.

Build and run the package binary with:

```bash
pnpm --dir packages/server build
pnpm --dir packages/server start
```

Set `SCHEMA_IDE_STATIC_DIR` to serve a built playground from the same process while keeping `/v1` reserved for the HTTP API:

```bash
pnpm playground:build
SCHEMA_IDE_STATIC_DIR=../../apps/playground/dist pnpm --dir packages/server start
```

```ts
import { runSchemaIdeHttpServer } from "@schema-ide/server";

await runSchemaIdeHttpServer({
  openRouterApiKey: process.env.SCHEMA_IDE_OPENROUTER_API_KEY!,
  port: 4317,
  staticDir: "../../apps/playground/dist",
});
```
