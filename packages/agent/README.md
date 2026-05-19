# @schema-ide/agent

Agent-facing chat adapters and schema-driven workspace tools for Schema IDE.
Use this package to let a model list, read, grep, create, write, replace, atomically apply, propose, and validate files.
Tool definitions are derived from Effect Schema and exported in OpenRouter-compatible shape.
The HTTP adapter talks to the standalone `/v1/chat` API from the protocol package.
This package is the extraction target for `@schema-ide/agent`.
Set `planMode` on a chat turn to expose read-only tools plus `propose_patch`, leaving final application to the user.

```ts
import { createSchemaIdeChatAdapter } from "@schema-ide/agent";

const chat = createSchemaIdeChatAdapter({
  baseUrl: "/v1",
  defaultModel: "anthropic/claude-sonnet-4.5",
});
```
