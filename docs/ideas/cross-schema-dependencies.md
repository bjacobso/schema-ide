# Cross-Schema Dependencies

How should a schema declare that it depends on another schema — possibly cyclically, possibly on a specific value rather than just identity — in a way that's typed, FP-native, and mechanically recoverable for the IDE and the agent?

## Goals

- Declare the dependency **at the field that owns it**, not in a sidecar config.
- Support **cycles** (forms ↔ policies) without breaking type inference.
- Make the resulting dep graph **mechanically recoverable** so the IDE and the agent can both reason over it.
- Stay Effect-native: lean on `Schema.annotations`, the `R` channel, and transforms.

## Patterns

### 1. Annotations (substrate)

```ts
PolicyId.annotations({ refersTo: () => Policy, by: "id" });
```

Cheap. A reflection pass crawls every schema's AST, collects `refersTo` annotations, and builds the graph. Cycles handled by the thunk. Downside: completely untyped — nothing stops you from pointing at a schema that doesn't have an `id` field. Fine as a substrate, not enough on its own.

### 2. Branded IDs carry the reference in the type system

```ts
const PolicyId = Schema.String.pipe(Schema.brand("PolicyId"));
const FormId = Schema.String.pipe(Schema.brand("FormId"));

const Form = Schema.Struct({
  id: FormId,
  governedBy: PolicyId, // dependency is in the *type*, not a comment
});
```

The dep graph is "which branded IDs appear in which schemas." Zero ceremony, fully typed, the agent's tools can offer completion ("you wrote `governedBy:` — here are the PolicyIds in the workspace"). Combines with #1: the brand carries the type, the annotation carries the resolver.

### 3. `Ref` combinator over the workspace (`R` channel)

The `R` channel on `Schema` lets a schema _require_ a service to decode:

```ts
const Ref = <A, K extends keyof A>(target: () => Schema.Schema<A>, key: K) =>
  Schema.transformOrFail(Schema.String, target(), {
    decode: (id) => Effect.flatMap(Workspace, (w) => w.lookup(target(), key, id)),
    encode: (a) => Effect.succeed(String(a[key])),
  });

const Form = Schema.Struct({
  policy: Ref(() => Policy, "id"), // decodes string → full Policy entity
});
```

Now validation _is_ resolution. The reflection automatically knows Form depends on Policy because the schema literally can't decode without `WorkspaceContext`. Cycles handled by the thunk. The existing `"cross-file"` diagnostic source falls out for free: an unresolved `Ref` is a structured `ParseError` with a path the reflection already knows how to surface.

**This is the move to build the system around.**

### 4. Bidirectional refs via paired annotations

Backrefs should be declarative, not maintained by hand:

```ts
const Policy = Schema.Struct({
  id: PolicyId,
  appliesTo: Schema.Array(Ref(() => Form, "id")),
}).annotations({
  inverse: { appliesTo: "governedBy" }, // declares the backref pair
});
```

The reflection enforces: every `Form.governedBy = "p1"` must appear in `Policy("p1").appliesTo`. Inverse declared once, validated automatically on both sides. This is the lens-like relationship missing from most schema libraries.

### 5. Host graph indexing

If a host application owns a graph store, schemas can _emit facts_ about their relationships and the dep graph becomes queryable like everything else:

```ts
const Form = Schema.Struct({...}).annotations({
  facts: [
    [":form", ":governed-by", ":policy"],
    [":form", ":requires-policy-value", ":policy/allow-email"],
  ],
});
```

A startup pass dumps these into the store. Then "what depends on `policy.allow-email`?" is a graph query, "is there a cycle?" is a graph query, "show me the dep graph for this file" is a saved view. This is not portable enough for the core package, but it is a useful host integration pattern.

### 6. Contract-style "depends on a value"

The most ambitious — Form depends not on Policy _existing_ but on a predicate over its value:

```ts
const EmailField = Schema.Struct({...}).pipe(
  requires(Policy, (p) => p.allow_email === true, {
    message: "email field needs policy.allow_email",
  }),
);
```

`requires` is a transform that pulls the relevant Policy out of `WorkspaceContext` and checks the predicate. Failure becomes a structured diagnostic with both file paths attached. Effectively `Schema.filterEffect` aimed at another schema's value.

## Recommended stack

1. Brand all IDs (#2).
2. Build `Ref` on top of the `R` channel (#3).
3. Add `inverse` annotations for declarative backrefs (#4).
4. Emit Datalog facts from the resulting graph (#5) for queryability.
5. Annotations (#1) are the substrate underneath.
6. `requires` (#6) is the natural extension once #3 exists.

## Why this feels Effect-native

Dependencies aren't config. They're:

- **Structure in the schema type itself** (via brands), and
- **Requirements in the schema's `R` channel** (via `Ref`).

The dep graph isn't something you declare separately and keep in sync — it's something the type system already knows, and the reflection reads it off.

## Open questions

- How does `WorkspaceContext` get threaded through the existing `validateWorkspace()` call? Likely a `Layer` constructed from the current `SourceTree`.
- Performance: `Ref` decoding eagerly resolves the full target entity. Lazy proxy? Or accept it because workspaces are small?
- How do `inverse` annotations interact with partial workspaces (where one side of the pair isn't loaded yet)? Warning, not error?
- Cycle detection in `inverse` chains — needed, or does the bipartite structure prevent it?
- MCP exposure: should the dep graph be its own tool (`get_dependencies(path)`) or folded into reflection?
