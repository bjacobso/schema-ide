# Cloudflare Workspace Strategy

## Goal

Add a hosted Cloudflare workspace mode, deployed with Alchemy v2, where a
browser can open a dedicated Schema IDE workspace by UUID:

```text
/                    in-memory playground demo
/demo                create a Durable Object backed demo workspace
/demo/:workspaceId   open the Durable Object backed demo workspace
```

Each workspace should be isolated from every other workspace, support the same
file operations as the local and in-memory modes, and keep the initial
implementation small enough to ship without adding account management,
collaboration, or artifact storage.

This is additive. The Cloudflare mode must run side by side with the existing
browser memory demo and local filesystem modes.

## Current Modes

Schema IDE already has the right boundary: the UI talks to a
`SchemaIdeWorkspaceService`.

- Browser memory mode is best for demos and static examples. It is fast and
  isolated to one browser session, but refreshes lose state.
- Local filesystem mode is best for local authoring and local agent work. It
  reads and writes a real directory and serves the existing workspace RPC
  endpoint.
- Cloudflare hosted mode should be best for shareable, persisted workspaces. It
  gives every UUID its own remote workspace without requiring a local process.
- Cloudflare currently hosts the playground and API, but not persisted hosted
  workspaces.

The Cloudflare strategy should add a third service implementation instead of
forking the editor.

## Side-by-Side Strategy

All modes should share the same editor surface and workspace protocol:

```text
SchemaIdeWorkspaceView
  -> SchemaIdeWorkspaceService
     -> createMemoryWorkspaceClient(...)
     -> createRpcWorkspaceClient("") for local filesystem server
     -> createRpcWorkspaceClient("/v1/demo-workspaces/:workspaceId/rpc") for Cloudflare
```

Mode selection should be explicit:

- `/` is always the browser memory demo in Cloudflare deployments.
- `/demo` is a launcher for creating a persisted demo workspace from a
  registered schema/template.
- `/demo/:workspaceId` always uses the remote Durable Object workspace.
- Local dev with `pnpm dev` can keep probing the local filesystem RPC endpoint
  only when the app is not on a hosted demo route.
- Future product wrappers can choose a mode from config instead of changing the
  editor internals.

Keep `/w/:workspaceId` only as a backwards-compatible alias or redirect if it
has already been shared. New hosted demo links should use `/demo/:workspaceId`.

## Template Registry Strategy

The durable demo launcher needs a way to choose the schema for a new workspace.
Start with a small workspace template registry instead of a full plugin system:

```ts
export interface WorkspaceTemplate {
  readonly id: string;
  readonly name: string;
  readonly description?: string | undefined;
  readonly schema: SchemaIdeInputSchema;
  readonly files: readonly SourceFile[];
  readonly defaultFormat?: SchemaIdeDocumentFormat | undefined;
}
```

The MVP registry can wrap the existing `schemaIdeExamples`. Consumers deploying
their own Cloudflare version should be able to provide a different registry to
both the frontend launcher and the Cloudflare runtime:

```ts
createSchemaIdeCloudflareDemo({
  templates: [workflowTemplate, onboardedConfigTemplate, customerTemplate],
});
```

The Durable Object stores the selected `templateId` in metadata. On load,
`/demo/:workspaceId` fetches workspace metadata and resolves that `templateId`
against the same registry so validation, reflection, previews, and default files
stay consistent.

## Recommended MVP

Use one SQLite-backed Durable Object per workspace UUID.

```text
Browser
  -> /demo/:workspaceId
  -> createRpcWorkspaceClient("/v1/demo-workspaces/:workspaceId/rpc")
  -> Worker route
  -> Durable Object idFromName(workspaceId)
  -> workspace files + revision in Durable Object storage
```

Durable Object memory can cache the current snapshot while the object is warm,
but it should not be the source of truth. Durable Objects can be evicted when
idle, so the MVP should persist workspace state in Durable Object storage from
the start. Do not add R2 or Workers KV to the critical path yet.

Deploy this with Alchemy v2 instead of hand-written Wrangler config. Alchemy v2
models infrastructure as Effect resources, so the Worker, Durable Object
namespace, secrets, and Vite SPA can live in one typed stack while the runtime
code still uses Effect services.

## Why Durable Objects First

Durable Objects match the workspace problem:

- A UUID maps naturally to one globally unique object.
- The object is a single coordination point for file mutations.
- Storage is private to that object and strongly consistent.
- SQLite-backed objects support transactional storage and SQL if history or
  indexing becomes useful later.
- The same object can later own WebSocket sessions for live updates.

R2 and Workers KV are useful later, but they solve different problems:

- R2: snapshots, exports, generated PDFs, imported binary assets, long-term
  backups.
- Workers KV: public template indexes, lightweight lookup metadata, cached
  workspace manifests.

Neither should be required for the first hosted workspace loop.

## Alchemy v2 Deployment Shape

Use Alchemy v2 as the deployment boundary:

```text
alchemy.run.ts
  -> Cloudflare Worker
  -> Workspace Durable Object namespace
  -> Vite SPA
  -> OPENROUTER_API_KEY / env bindings
```

Alchemy v2's Durable Object tutorial uses a class exported as a
`Cloudflare.DurableObjectNamespace`, yielded from the Worker init phase, then
called through a typed stub with `getByName(name)`. That maps directly to
`workspaceId`:

```text
const workspaces = yield* WorkspaceObject;
const workspace = workspaces.getByName(workspaceId);
```

The Worker should remain the public HTTP router. The Durable Object should own
workspace state and expose a small typed API to the Worker:

```ts
type WorkspaceObjectApi = {
  initialize(input: InitializeWorkspaceRequest): Effect.Effect<WorkspaceMetadata>;
  getMetadata(): Effect.Effect<WorkspaceMetadata>;
  getSnapshot(): Effect.Effect<WorkspaceSnapshot>;
  applyChange(change: WorkspaceChangeRequest): Effect.Effect<WorkspaceChangeResponse>;
  previewFiles(request: WorkspacePreviewRequest): Effect.Effect<WorkspacePreviewResponse>;
};
```

The external browser contract should still be the existing HTTP/RPC contract.
Do not expose Durable Object RPC directly to the browser in the MVP; route
through the Worker so auth, CORS, URL shape, and compatibility remain centralized.

Alchemy v2 also supports Vite SPA deployment from the same Cloudflare stack.
Use that for the hosted playground instead of maintaining a separate frontend
deployment path for this strategy.

The Cloudflare implementation should be exported from `@schema-ide/cloudflare`
instead of living only in the root `alchemy/` folder. Consumers can import the
runtime Durable Object and hosted workspace router, then use the Alchemy helpers
to compose their own Worker, bindings, env, domains, auth, or storage additions.
The repository's default Alchemy stack should consume those same primitives as a
thin app-specific wrapper.

## MVP User Flow

1. User lands on `/`.
2. Browser renders the in-memory playground demo. No Durable Object state is
   created for `/`.
3. User opens `/demo`.
4. Launcher shows a minimal durable demo creation form:
   - template/example selector
   - "Create workspace" button
5. Browser calls `POST /v1/demo-workspaces`.
6. Worker creates a random UUID, initializes the matching Durable Object from
   the selected template, and returns:

```json
{
  "workspaceId": "8b6f53d5-0c3e-4b8e-8f33-1c0fb57fbe4a",
  "url": "/demo/8b6f53d5-0c3e-4b8e-8f33-1c0fb57fbe4a"
}
```

7. Browser redirects to `/demo/:workspaceId`.
8. IDE connects to `/v1/demo-workspaces/:workspaceId/rpc`.
9. The existing editor reads capabilities, snapshot, diagnostics, and applies
   changes through the RPC client.

## API Shape

Keep the hosted workspace API narrow and namespaced so it can coexist with the
existing local filesystem RPC path:

```text
GET  /v1/demo-templates
POST /v1/demo-workspaces
GET  /v1/demo-workspaces/:workspaceId
POST /v1/demo-workspaces/:workspaceId/rpc
```

Keep the current local filesystem route unchanged:

```text
POST /v1/workspace/rpc
```

That gives the frontend two RPC base URLs:

```text
local filesystem: /v1/workspace
Cloudflare UUID:  /v1/demo-workspaces/:workspaceId/rpc
```

`GET /v1/demo-templates`

```json
[
  {
    "id": "workflow-json",
    "name": "Workflow JSON",
    "description": "A JSON workflow example.",
    "defaultFormat": "json"
  }
]
```

Do not return the full schema from the public template list unless there is a
specific product need. The browser bundle can already contain the templates it
needs for the stock playground; this endpoint exists so customized Cloudflare
deployments can advertise their registered template IDs and display metadata.

`POST /v1/demo-workspaces`

```json
{
  "templateId": "workflow-json"
}
```

`GET /v1/demo-workspaces/:workspaceId`

```json
{
  "workspaceId": "8b6f53d5-0c3e-4b8e-8f33-1c0fb57fbe4a",
  "templateId": "workflow-json",
  "title": "Workflow JSON",
  "createdAt": "2026-05-26T00:00:00.000Z",
  "updatedAt": "2026-05-26T00:00:00.000Z",
  "revision": 3
}
```

`POST /v1/demo-workspaces/:workspaceId/rpc`

Use the existing `SchemaIdeWorkspaceRpcGroup`:

- `GetCapabilities`
- `GetSnapshot`
- `WatchWorkspace`
- `ApplyWorkspaceChange`
- `PreviewWorkspaceFiles`

For the MVP, `WatchWorkspace` can behave like the current HTTP RPC stream if it
works through the existing Effect RPC transport. If that is awkward in Workers,
ship polling first and add WebSockets later.

## Durable Object Data Model

Start with the smallest model that can preserve a workspace:

```sql
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
  path TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS changes (
  revision INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL,
  actor TEXT NOT NULL,
  label TEXT NOT NULL,
  changed_paths TEXT NOT NULL
);
```

Metadata keys:

- `workspaceId`
- `templateId`
- `title`
- `createdAt`
- `updatedAt`
- `revision`
- `defaultFormat`

The object can reconstruct a `WorkspaceSnapshot` by reading `files`, sorting by
path, and running the same reflection logic already used by memory and local
filesystem modes.

## Durable Object Responsibilities

The workspace Durable Object should own:

- path safety checks
- file existence checks
- revision increments
- atomic file mutation
- snapshot generation
- validation/reflection
- change history append
- optional in-memory snapshot cache

The front Worker should own:

- routing
- UUID validation
- mapping UUID to Durable Object ID
- CORS
- static asset serving
- landing page and workspace page fallbacks

## Frontend Changes

Add a hosted mode to the playground shell without removing the existing modes:

- `/` renders `SchemaIdeWorkspaceView` against browser memory only in Cloudflare
  deployments.
- `/demo` renders the durable demo launcher with a registered template/schema
  selector.
- `/demo/:workspaceId` renders `SchemaIdeWorkspaceView` against the matching
  Durable Object workspace.
- The workspace client uses
  `createRpcWorkspaceClient("", "/v1/demo-workspaces/:workspaceId/rpc")`.
- Browser memory examples remain available as the first-viewport demo at `/`.
- Local filesystem probing remains available only for local development routes,
  not for Cloudflare production `/` or `/demo/*` routes.

No editor internals should need to know whether the backing store is local,
memory, or Cloudflare.

Suggested mode resolver:

```text
if URL matches /demo/:workspaceId:
  use Cloudflare remote workspace RPC
else if URL matches /demo:
  render durable demo launcher
else if Cloudflare deployment:
  use browser memory workspace
else if local filesystem RPC probe succeeds:
  use local filesystem workspace
else:
  use browser memory workspace
```

## Package Shape

Keep Cloudflare-specific code out of generic React and core packages.

Current package shape:

```text
packages/cloudflare/src/workspace-object.ts
packages/cloudflare/src/worker-runtime.ts
packages/cloudflare/src/alchemy.ts
packages/cloudflare/src/index.ts
```

`@schema-ide/cloudflare` should export:

- the `SchemaIdeWorkspaceObject` Durable Object class
- hosted workspace route helpers
- Alchemy v2 helpers for creating the Durable Object namespace and Worker
- configuration hooks for route prefixes, binding names, and template registries

The root `alchemy/` files should stay thin app-specific consumers of this
package.

## Implementation Phases

### Phase 1: Hosted Workspace Skeleton

- Move the Cloudflare deployment path to Alchemy v2 patterns.
- Add Durable Object binding and migration to the Cloudflare deployment.
- Add `WorkspaceObject` Durable Object class.
- Add `GET /v1/demo-templates`.
- Add `POST /v1/demo-workspaces`.
- Add `GET /v1/demo-workspaces/:workspaceId`.
- Initialize new workspaces from bundled examples.
- Return UUID and workspace URL.
- Keep existing memory demo and local filesystem server behavior unchanged.

### Phase 2: Workspace RPC

- Route `/v1/demo-workspaces/:workspaceId/rpc` to the matching Durable Object.
- Implement `SchemaIdeWorkspaceService` against Durable Object storage.
- Reuse existing change request and snapshot DTOs.
- Mark capabilities as:

```json
{
  "mode": "remote",
  "workspace": { "readOnly": false },
  "features": {
    "watch": false,
    "write": true,
    "rename": true,
    "delete": true,
    "history": true,
    "previews": true
  }
}
```

Set `watch` to `true` only after streaming or WebSockets are verified.

### Phase 3: Frontend Routing

- Add create-workspace landing page.
- Add `/demo` launcher route.
- Add `/demo/:workspaceId` editor route.
- Connect the IDE to the workspace-specific RPC base URL.
- Preserve browser memory mode at `/`.
- Preserve the current local filesystem probe and label.

### Phase 4: Tests

- Unit test Durable Object path validation and mutation behavior with
  `cloudflare:test` or Miniflare-compatible tooling.
- Contract test hosted RPC against the existing workspace client contract.
- Regression test that memory mode still works without a remote UUID.
- Regression test that local filesystem mode still works when `/v1/workspace/rpc`
  is available.
- Playwright smoke test:
  - create workspace
  - redirect to `/demo/:uuid`
  - edit a file
  - refresh
  - confirm the edit persists

### Phase 5: Optional Storage Extensions

Add these only when there is a concrete product need:

- R2 workspace snapshot export/import.
- R2 binary sidecars for PDFs and generated artifacts.
- KV or D1 workspace directory for listing workspaces by user/account.
- WebSocket-based watch updates from the Durable Object.
- Authentication and share links.

## Non-Goals For MVP

- Multi-user collaboration.
- Authenticated workspace ownership.
- Workspace listing.
- R2 backups.
- KV metadata index.
- Deploying generated artifacts.
- Conflict-free replicated editing.
- Full preview artifact persistence.

## Open Questions

- Which templates should be available on the create-workspace screen?
- Should workspace UUIDs be fully unguessable public links, or should the first
  version require a separate secret token?
- Should chat calls include the workspace UUID so the server can persist agent
  mutations in the same Durable Object?
- Should hosted workspaces have a TTL for unauthenticated demos?

## References

- Cloudflare Durable Objects overview:
  https://developers.cloudflare.com/durable-objects/
- SQLite-backed Durable Object storage:
  https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- Durable Object WebSockets:
  https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- Durable Object lifecycle:
  https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/
- R2 Workers API:
  https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
- Alchemy v2 LLM documentation index:
  https://v2.alchemy.run/llms.txt
- Alchemy v2 Durable Object tutorial:
  https://v2.alchemy.run/tutorial/cloudflare/durable-objects/
- Alchemy v2 Vite SPA tutorial:
  https://v2.alchemy.run/tutorial/cloudflare/vite-spa/
- Alchemy v2 Effect RPC guide:
  https://v2.alchemy.run/guides/effect-rpc/
