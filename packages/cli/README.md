# @schema-ide/cli

Local command-line validation for Schema IDE workspaces.

Use this package when you want the same schema routing and diagnostics used by
the React IDE and agent tools, but against files on disk.

## Config

Create a config module that exports a workspace definition:

```ts
import { Schema } from "effect";
import { Workspace } from "@schema-ide/core";
import { defineSchemaIdeWorkspace } from "@schema-ide/cli";

const Action = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
});

const Workflow = Schema.Struct({
  id: Schema.String,
  actionIds: Schema.Array(Schema.String),
});

export default defineSchemaIdeWorkspace({
  id: "workflow",
  defaultFormat: "json",
  schema: Workspace.Struct({
    actions: Workspace.files("actions/*.json", Action).pipe(Workspace.indexBy("id")),
    workflows: Workspace.files("workflows/*.json", Workflow).pipe(Workspace.indexBy("id")),
  }).pipe(
    Workspace.validate<any>("workflow refs", ({ actions, workflows }, issue) => {
      for (const workflow of workflows.values()) {
        for (const actionId of workflow.actionIds) {
          if (!actions.has(actionId)) {
            issue.at(`workflows.${workflow.id}.actionIds`, `Unknown action: ${actionId}`);
          }
        }
      }
    }),
  ),
});
```

## Commands

Validate a directory:

```bash
schema-ide validate --schema ./schema-ide.config.ts --dir .
```

Print machine-readable diagnostics for local agents:

```bash
schema-ide validate --schema ./schema-ide.config.ts --dir . --json
```

Inspect route matches:

```bash
schema-ide routes --schema ./schema-ide.config.ts --dir .
```

Print reflected JSON Schema for a route:

```bash
schema-ide schema --schema ./schema-ide.config.ts --dir . --schema-id Workflows
```

The `validate` and `inspect` commands exit with code `1` when validation has
errors. Usage and CLI errors exit with code `2`.

By default, the CLI reads `**/*.json`, `**/*.yaml`, and `**/*.yml`, excluding
`.git/**`, `node_modules/**`, `dist/**`, and `coverage/**`. Override that in the
config with `include` and `exclude`.
