#!/usr/bin/env node
import { runSchemaIdeHttpServer } from "./node";

const rawPort = process.env["SCHEMA_IDE_PORT"];
const apiKey = process.env["SCHEMA_IDE_OPENROUTER_API_KEY"] ?? process.env["OPENROUTER_API_KEY"];
const port = Number.parseInt(rawPort ?? "4317", 10);
const staticDir = process.env["SCHEMA_IDE_STATIC_DIR"];

if (!apiKey) {
  console.warn(
    "Schema IDE server is using the local debug chat adapter. Set SCHEMA_IDE_OPENROUTER_API_KEY or OPENROUTER_API_KEY to use OpenRouter.",
  );
}

if (!Number.isFinite(port)) {
  console.error(`Invalid SCHEMA_IDE_PORT: ${rawPort}`);
  process.exit(1);
}

const server = await runSchemaIdeHttpServer({
  openRouterApiKey: apiKey,
  port,
  referer: process.env["SCHEMA_IDE_REFERER"] ?? "http://127.0.0.1:4318",
  staticDir,
  title: process.env["SCHEMA_IDE_TITLE"] ?? "Schema IDE Playground",
});

console.log(`Schema IDE HTTP server listening on http://127.0.0.1:${server.port}/v1`);
if (staticDir) {
  console.log(`Schema IDE playground listening on http://127.0.0.1:${server.port}/`);
}

let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await server.close();
};

process.on("SIGINT", () => {
  void close().finally(() => process.exit(0));
});
process.on("SIGTERM", () => {
  void close().finally(() => process.exit(0));
});

await new Promise(() => {});
