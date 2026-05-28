# Vision: Effect Artifacts

What if files were not passive blobs, but typed artifacts that can describe
their own available interpretations?

The idea behind `effect-artifacts` is a small Effect-native primitive for
declaring the semantic surface area of any artifact: JSON, YAML, Markdown, PDF,
image, video, generated output, remote blob, git object, or future media type.
Each artifact type declares the views it can expose, the schemas for those
views, and the handlers that can materialize them.

This is not just a registry of tools. It is a runtime-inspectable artifact
language whose declarations are also executable contracts.

## Core Shape

The central abstraction is an `ArtifactApi`, analogous to `HttpApi`.

```text
ArtifactApi     ~= HttpApi
ArtifactType    ~= HttpApiGroup
ArtifactView    ~= HttpApiEndpoint
ArtifactHandler ~= endpoint handler
Schema          ~= input/output/error contract
Layer           ~= registered implementation
```

An artifact type is a declaration of what a class of artifacts can be:

```ts
const Pdf = ArtifactType.make("pdf")
  .match(ArtifactMatcher.extension("pdf"))
  .match(ArtifactMatcher.mime("application/pdf"))
  .view("markdown", {
    input: PdfMarkdownInput,
    output: PdfMarkdown,
    error: PdfError,
    annotations: {
      cost: Cost.low,
      cache: CachePolicy.contentHash,
      mediaType: "text/markdown",
    },
  })
  .view("pageImages", {
    input: PdfPageImagesInput,
    output: PdfPageImages,
    error: PdfError,
    annotations: {
      cost: Cost.high,
      cache: CachePolicy.contentHash,
      mediaType: "image/png",
    },
  });
```

The declaration says:

- this is a PDF-shaped artifact
- it can be recognized by extension or MIME type
- it can expose a `markdown` view
- it can expose a `pageImages` view
- each view has typed input, output, and error contracts
- each view carries policy metadata like cost, cache, and media type

The handler is separate:

```ts
const PdfMarkdownHandler = ArtifactHandler.make(
  Pdf.view("markdown"),
  ({ ref }) => Effect.tryPromise(() => pdfToMarkdown(ref)),
);
```

That separation matters. The artifact API is the contract. Handlers are just
replaceable implementations.

## Homoiconicity In TypeScript

The interesting property is that the declaration has the same module shape as
the thing the agent needs to inspect.

The TypeScript module is not merely source code that builds a registry. The
module is itself the artifact grammar:

```ts
export const Artifacts = ArtifactApi.make("workspace")
  .add(Pdf)
  .add(Json)
  .add(Yaml)
  .add(Video);
```

At runtime, the harness can inspect this value and recover the schema of the
world:

```ts
const capabilities = ArtifactApi.capabilities(Artifacts, artifactRef);
```

That makes the module homoiconic in the practical TypeScript sense: the program
that declares artifact meaning can be treated as data by the runtime that uses
it. The artifact language is not mirrored into JSON, YAML, or comments. It is
the same Effect Schema value graph that handlers, docs, validation, tools, and
agents consume.

This is the same move that makes `HttpApi` powerful:

- the declaration is typed
- the declaration is inspectable
- the declaration can generate tools, docs, clients, and validators
- the declaration is separate from implementation
- the declaration can be composed as normal TypeScript modules

## Concept Network

### Artifact

An artifact is any addressable thing with interpretable content.

It might be a local path, a remote URL, an S3 object, an R2 blob, a git blob, a
generated file, or an opaque handle owned by a host application.

The core package should not assume local filesystem semantics. A local file is
one kind of artifact, not the primitive.

### Artifact Ref

An `ArtifactRef` is the stable handle passed through the system.

It should carry enough information for host-specific handlers to resolve the
artifact without forcing every consumer into the same storage model.

Possible shapes:

```ts
{ _tag: "Path", path: string }
{ _tag: "Url", url: string }
{ _tag: "Blob", id: string }
{ _tag: "GitBlob", repo: string, oid: string }
```

The ref is the identity. Views are derived from it.

### Matcher

A matcher answers: "which artifact type declarations might apply to this ref?"

Examples:

- extension
- MIME type
- magic bytes
- URI scheme
- host-provided metadata
- schema probe

Matching should be cheap and layered. Extension matching is cheap. Magic byte
inspection may require reading. Content probing may be expensive. The API should
allow matchers to expose that cost.

### View

A view is a typed semantic projection over an artifact.

A PDF can expose:

- markdown
- page images
- embedded images
- metadata
- outline
- OCR text

A video can expose:

- transcript
- keyframes
- chapters
- audio waveform
- metadata

A JSON document can expose:

- parsed value
- inferred schema
- JSONPath query surface
- normalized tree
- diagnostics

The agent should not need to know how to parse every file type. It should ask
the harness what views exist and choose the cheapest useful one.

### Handler

A handler materializes one view.

Handlers are Effect programs. That means they can require services, use layers,
fail with typed errors, stream results, respect interruption, and compose with
cache and policy services.

The same `markdown` view for PDFs could have multiple handlers:

- a fast local parser
- an OCR-backed parser
- a remote document intelligence service
- a host-provided proprietary extractor

The API declaration remains stable while implementations vary by environment.

### Registry

The registry is a composed set of artifact APIs and handlers.

It answers:

- what artifact types are known?
- which type matches this ref?
- what views are available?
- which handler can produce this view?
- what are the input, output, and error schemas?
- what policies apply before invoking the handler?

For an agent harness, this registry is the boundary between model reasoning and
tool execution.

### Policy

Policy should be metadata on views, not bespoke logic hidden in handlers.

Useful policy dimensions:

- cost: low, medium, high
- cache: none, ref, content hash, explicit key
- privacy: local only, remote allowed, redaction required
- latency: interactive, background
- determinism: deterministic, best effort, model generated
- output size: bounded, potentially large, streamable

This lets an agent ask for the lowest-cost useful view first. It also lets a
host block expensive or remote operations before a tool runs.

### Cache

Caching belongs at the harness layer, but the artifact declaration should say
which cache semantics are valid.

Examples:

- cache by artifact identity
- cache by content hash
- cache by input parameters
- never cache
- cache only within a session

The handler should not have to own all of that policy.

### Agent Harness

The agent-facing API can stay small:

```ts
const caps = yield* artifacts.capabilities(ref);
const md = yield* artifacts.view(ref, "markdown");
const frames = yield* artifacts.view(ref, "keyframes", { every: "30s" });
```

The harness performs the mechanical work:

1. resolve the artifact ref
2. match artifact types
3. expose declared capabilities
4. validate view input
5. apply policy
6. call the handler
7. validate output
8. cache or index the result

The model reasons over capabilities. The harness executes contracts.

## Why This Matters For Schema IDE

Schema IDE already treats schemas as source artifacts that can be parsed,
reflected, validated, displayed, edited, and used by an agent.

`effect-artifacts` generalizes that move.

Instead of special-casing "schema files" as the only inspectable units, every
file can declare a typed surface area. A schema module is one artifact type. A
PDF is another. A video is another. A generated report is another.

The IDE and agent can then ask the same questions everywhere:

- what is this?
- what views can it expose?
- what schemas describe those views?
- what tools can materialize them?
- what will it cost?
- is it cacheable?
- can I inspect the declaration before invoking the tool?

This turns the workspace into a graph of typed, inspectable, executable
artifact declarations.

## What Should Stay Out Of The Core

The core package should stay small.

It should not ship PDF parsing, OCR, ffmpeg, transcription, browser rendering,
or cloud SDKs.

The core package should define:

- artifact declarations
- view declarations
- schema contracts
- handler binding
- registry inspection
- matching primitives
- policy annotations
- helper services

Heavy implementations should live in optional packages:

- `effect-artifacts-node`
- `effect-artifacts-pdf`
- `effect-artifacts-video`
- `effect-artifacts-image`
- `effect-artifacts-json`

The core should be useful even if every handler is provided by a host
application.

## Design Pressure

The DSL should describe capabilities, not workflows.

It is tempting to make the registry plan conversions:

```text
pdf -> page images -> OCR text -> markdown -> summary
```

That may become useful later, but it should not be the first primitive. The
first primitive should be simpler:

```text
artifact type declares views
view declares schemas and policy
handler implements the view
harness chooses and invokes views
```

The planning layer can be built on top once the capability graph exists.

## Open Questions

- Should `ArtifactApi` live as a standalone `effect-artifacts` package or under
  a future `@effect/ai` namespace?
- Should matchers be pure declarations, effectful probes, or both?
- How should streaming views be represented: `Stream`, chunked outputs, or
  separate view kinds?
- Should views be globally named strings like `"markdown"` or nominal values
  exported from modules?
- How much of `HttpApi`'s internal design can this mirror without coupling to
  HTTP-specific assumptions?
- Should handlers be resolved by exact view identity, by type/view string pair,
  or by an opaque endpoint value?
- What is the minimal registry API that lets an agent inspect capabilities
  without exposing implementation details?

## North Star

`effect-artifacts` should make files and generated outputs feel like typed
Effect APIs.

A workspace should not be a bag of bytes plus ad hoc tools. It should be a
runtime-inspectable graph of artifacts, views, schemas, policies, and handlers.

The same declaration should be useful to:

- TypeScript type inference
- runtime validation
- tool generation
- agent planning
- docs
- caching
- UI affordances
- host policy

That is the real shape of the idea: artifact declarations as executable,
inspectable schema modules.
