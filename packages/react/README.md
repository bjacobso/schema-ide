# @schema-ide/react

React UI surface for editing a Schema IDE workspace.
It renders the file list, CodeMirror editor, schema-derived form view, patch proposal panel, diagnostics/debug panels, and chat panel.
The component accepts a raw Effect Schema or a `WorkspaceSchema` from the core package.
Bring your own chat adapter, including the local debug adapter or HTTP agent adapter.
This package is the extraction target for `@schema-ide/react`.

```tsx
import { SchemaIde } from "@schema-ide/react";
import { createSchemaIdeChatAdapter } from "@schema-ide/agent";
import { PromptEvalWorkspaceSchema } from "@schema-ide/examples";

<SchemaIde
  schema={PromptEvalWorkspaceSchema}
  initialFiles={[]}
  defaultFormat="yaml"
  chat={createSchemaIdeChatAdapter({ baseUrl: "/v1" })}
/>;
```

```tsx
import { Schema } from "effect";
import { SchemaIde } from "@schema-ide/react";

const SettingsSchema = Schema.Struct({
  id: Schema.String,
  enabled: Schema.Boolean,
});

<SchemaIde schema={SettingsSchema} value={settings} onChange={setSettings} defaultFormat="yaml" />;
```
