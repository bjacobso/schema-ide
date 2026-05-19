# Plan: Consumer-Packaged Domain IDEs

Schema IDE should be usable as a foundation for domain-specific IDE packages. A consumer should be able to bring their own workspace schema, examples, previews, tools, and documentation, then ship a package that exposes a tailored IDE without forking `@schema-ide/react`.

## Goal

Enable packages like:

```ts
import { WorkflowIde } from "@acme/workflow-ide";

export function App() {
  return <WorkflowIde initialFiles={files} onFilesChange={setFiles} />;
}
```

where `@acme/workflow-ide` wraps Schema IDE with:

- domain schemas
- workspace routing
- preview components
- domain-specific chat/tool instructions
- examples/templates
- optional branding and UI chrome

## Non-goals

- Turn Schema IDE into a plugin marketplace.
- Require consumers to publish packages through a Schema IDE registry.
- Make consumers fork internal React components.
- Add host-application-specific Open Ontology concepts to Schema IDE.

## Target Consumer Shape

A consumer should be able to author:

```ts
import { defineSchemaIdeProduct } from "@schema-ide/react";
import { WorkflowWorkspaceSchema } from "./schemas";
import { WorkflowPreview } from "./previews/workflow-preview";
import { workflowExamples } from "./examples";

export const WorkflowIdeProduct = defineSchemaIdeProduct({
  id: "workflow",
  title: "Workflow IDE",
  schema: WorkflowWorkspaceSchema,
  previews: [
    {
      id: "workflow-preview",
      schemaId: "Workflows",
      label: "Workflow",
      component: WorkflowPreview,
    },
  ],
  examples: workflowExamples,
  assistant: {
    systemPrompt: "You help users edit workflow definitions.",
  },
});

export const WorkflowIde = WorkflowIdeProduct.Component;
```

Consumers can still use `<SchemaIde />` directly, but product definitions give them a clean packaging story.

## Proposed API

```ts
export interface SchemaIdeProduct<A = unknown> {
  readonly id: string;
  readonly title: ReactNode;
  readonly schema: SchemaIdeInputSchema<A>;
  readonly defaultFormat?: SchemaIdeDocumentFormat;
  readonly allowedFormats?: readonly SchemaIdeDocumentFormat[];
  readonly previews?: readonly SchemaIdePreviewRegistration[];
  readonly examples?: readonly SchemaIdeExample[];
  readonly assistant?: SchemaIdeAssistantProfile;
  readonly ui?: SchemaIdeUiProfile;
}

export function defineSchemaIdeProduct<A>(product: SchemaIdeProduct<A>): DefinedSchemaIdeProduct<A>;
```

The returned product exposes:

```ts
interface DefinedSchemaIdeProduct<A> {
  readonly id: string;
  readonly schema: SchemaIdeInputSchema<A>;
  readonly Component: ComponentType<SchemaIdeProductComponentProps<A>>;
  readonly createProps: (props?: Partial<SchemaIdeProps<A>>) => SchemaIdeProps<A>;
}
```

This keeps the wrapper package tiny while preserving normal React composition.

## Consumer Package Layout

Recommended layout:

```
workflow-ide/
├── src/
│   ├── index.ts
│   ├── product.tsx
│   ├── schemas.ts
│   ├── previews/
│   │   └── workflow-preview.tsx
│   ├── examples.ts
│   └── tools.ts
├── package.json
└── README.md
```

The package can expose:

```ts
export { WorkflowIde, WorkflowIdeProduct } from "./product";
export { WorkflowWorkspaceSchema, WorkflowSchema } from "./schemas";
```

## Extension Points

### Schemas

Consumers provide an Effect Schema or Workspace Schema:

```ts
schema: WorkflowWorkspaceSchema;
```

Workspace schemas remain the main way to route files to schema ids:

```ts
Workspace.files("workflows/*.yaml", WorkflowSchema).pipe(
  Workspace.annotations({ identifier: "Workflows" }),
);
```

### Previews

Consumers register previews by `schemaId`:

```ts
previews: [
  {
    id: "workflow-graph",
    schemaId: "Workflows",
    label: "Graph",
    component: WorkflowGraphPreview,
  },
];
```

Preview components receive parsed value, file metadata, reflection, diagnostics, and read-only state.

### Examples and Templates

Add a small shared example type:

```ts
export interface SchemaIdeExample {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly files: readonly SourceFile[];
}
```

Schema IDE can render an optional example picker when products provide examples. Consumers may also use examples outside the IDE.

### Assistant Profile

Consumers should be able to provide domain-specific assistant behavior without replacing the chat implementation:

```ts
interface SchemaIdeAssistantProfile {
  readonly systemPrompt?: string;
  readonly suggestedPrompts?: readonly string[];
  readonly tools?: readonly SchemaIdeToolDefinition[];
}
```

Initial version can support `systemPrompt` and `suggestedPrompts`; custom tools can follow after the agent-tool API stabilizes.

### UI Profile

Keep UI customization modest:

```ts
interface SchemaIdeUiProfile {
  readonly emptyState?: ReactNode;
  readonly headerActions?: ReactNode;
  readonly hideDebugByDefault?: boolean;
}
```

Avoid broad theming in the first pass. Consumers can wrap the component with their own theme provider or container.

## Package Boundary

`@schema-ide/react` should expose stable composition APIs:

- `<SchemaIde />`
- `defineSchemaIdeProduct(...)`
- preview registration types
- example types
- assistant profile types

`@schema-ide/core` should remain React-free:

- workspace schema
- validation
- parsing
- reflection
- source maps

Consumer packages should not import internal files like:

```ts
@schema-ide/react/src/SchemaIde
```

Everything needed for product wrapping should come from public exports.

## Data Flow

```
consumer package
   │
   ├── schemas ───────────────┐
   ├── previews ──────────────┤
   ├── examples ──────────────┤
   └── assistant profile ─────┤
                              ▼
                    defineSchemaIdeProduct
                              │
                              ▼
                      Product Component
                              │
                              ▼
                          <SchemaIde />
```

## Implementation Phases

### Phase 1: Public Product Definition

- Add `defineSchemaIdeProduct` to `@schema-ide/react`.
- Add product, example, assistant profile, and UI profile types.
- Return a simple component that passes configured props through to `<SchemaIde />`.
- Add isolated tests for prop merging and product component export.

### Phase 2: Examples

- Add optional example metadata and public `SchemaIdeExample` type.
- Support example picker either inside `<SchemaIde />` or as a helper component.
- Keep `@schema-ide/examples` compatible with the same type.

### Phase 3: Assistant Customization

- Add assistant profile support to the local chat adapter path.
- Include product title/schema ids/examples in assistant context.
- Add suggested prompt UI if provided.

### Phase 4: Consumer Package Template

- Add a documented package template under `packages/schema-ide/templates/product-package`.
- Include package manifest, schemas, preview, examples, and README.
- Add a smoke test that imports the generated wrapper package shape.

### Phase 5: Optional CLI Scaffold

- Add `schema-ide create-product` only if the template proves useful.
- Keep scaffold output simple and editable.

## Example Product Package

Create a first-party fixture package for validation:

```
packages/schema-ide/product-fixtures/workflow-ide
```

This package should depend only on public `@schema-ide/*` exports. It should prove that a consumer can package a domain-specific IDE without reaching into internals.

## Testing Strategy

- Unit-test `defineSchemaIdeProduct` prop merging.
- Type-test a consumer wrapper that exports `WorkflowIde`.
- Verify preview registrations still work through the product wrapper.
- Verify examples can be selected and loaded.
- Verify package build output exposes stable public types.

## Verification Commands

```bash
pnpm format
pnpm typecheck --filter @schema-ide/react
pnpm test --filter @schema-ide/react
pnpm build --filter @schema-ide/react
pnpm --dir packages/schema-ide typecheck
pnpm --dir packages/schema-ide test
pnpm --dir packages/schema-ide build
```

## Open Questions

- Should `defineSchemaIdeProduct` live in `@schema-ide/react` or a new `@schema-ide/product` package?
- Should examples be part of the core API or only a React/product concern?
- How much assistant customization should be declarative before consumers need a custom chat adapter?
- Should preview components be able to declare their own toolbar actions?
- Should a product wrapper support multiple workspace schemas, or should that be modeled as separate products?
