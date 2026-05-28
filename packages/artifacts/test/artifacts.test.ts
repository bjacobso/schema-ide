import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import {
  ArtifactApi,
  ArtifactHandler,
  ArtifactMatcher,
  ArtifactRef,
  ArtifactRegistry,
  ArtifactType,
  CachePolicy,
  Cost,
} from "../src";

const ParsedConfig = Schema.Struct({
  name: Schema.String,
  enabled: Schema.Boolean,
});

const Json = ArtifactType.make("json")
  .match(ArtifactMatcher.extension("json"))
  .match(ArtifactMatcher.mime("application/json"))
  .view("parsedValue", {
    input: Schema.Struct({ content: Schema.String }),
    output: ParsedConfig,
    error: Schema.Struct({ code: Schema.String }),
    annotations: {
      cost: Cost.low,
      cache: CachePolicy.contentHash,
      mediaType: "application/json",
    },
  });

const Artifacts = ArtifactApi.make("workspace").add(Json);

describe("schema-ide-artifacts", () => {
  it("inspects capabilities for matching artifact refs", () => {
    const capabilities = ArtifactApi.capabilities(Artifacts, ArtifactRef.path("config/demo.json"));

    expect(capabilities).toHaveLength(1);
    expect(capabilities[0]).toMatchObject({
      type: "json",
      view: "parsedValue",
      id: "json.parsedValue",
      annotations: {
        cost: "low",
        cache: "contentHash",
        mediaType: "application/json",
      },
    });
  });

  it("materializes a view through an exact handler binding", async () => {
    const registry = ArtifactRegistry.make(Artifacts).addHandler(
      ArtifactHandler.make(Json.view("parsedValue"), ({ input }) =>
        Effect.try({
          try: () => JSON.parse(input.content) as unknown,
          catch: (error) => error,
        }),
      ),
    );

    const value = await Effect.runPromise(
      registry.view(ArtifactRef.path("config/demo.json"), "parsedValue", {
        content: '{"name":"Demo","enabled":true}',
      }),
    );

    expect(value).toEqual({ name: "Demo", enabled: true });
  });

  it("uses metadata matchers when the ref has no useful path", () => {
    const capabilities = ArtifactApi.capabilities(Artifacts, ArtifactRef.blob("blob-1"), {
      mimeType: "application/json",
    });

    expect(capabilities.map((capability) => capability.id)).toEqual(["json.parsedValue"]);
  });

  it("validates handler input before execution", async () => {
    const registry = ArtifactRegistry.make(Artifacts).addHandler(
      ArtifactHandler.make(Json.view("parsedValue"), () =>
        Effect.succeed({ name: "Demo", enabled: true }),
      ),
    );

    const result = await Effect.runPromise(
      Effect.match(registry.view(ArtifactRef.path("config/demo.json"), "parsedValue", {}), {
        onFailure: (error) => error,
        onSuccess: () => ({ _tag: "UnexpectedSuccess" }),
      }),
    );

    expect(result).toMatchObject({
      _tag: "ArtifactSchemaValidationError",
      phase: "input",
      view: "json.parsedValue",
    });
  });

  it("validates handler output after execution", async () => {
    const registry = ArtifactRegistry.make(Artifacts).addHandler(
      ArtifactHandler.make(Json.view("parsedValue"), () =>
        Effect.succeed({ name: "Demo", enabled: "yes" } as never),
      ),
    );

    const result = await Effect.runPromise(
      Effect.match(
        registry.view(ArtifactRef.path("config/demo.json"), "parsedValue", {
          content: '{"name":"Demo","enabled":true}',
        }),
        {
          onFailure: (error) => error,
          onSuccess: () => ({ _tag: "UnexpectedSuccess" }),
        },
      ),
    );

    expect(result).toMatchObject({
      _tag: "ArtifactSchemaValidationError",
      phase: "output",
      view: "json.parsedValue",
    });
  });

  it("validates and wraps handler failures", async () => {
    const registry = ArtifactRegistry.make(Artifacts).addHandler(
      ArtifactHandler.make(Json.view("parsedValue"), () => Effect.fail({ code: "parse-failed" })),
    );

    const result = await Effect.runPromise(
      Effect.match(
        registry.view(ArtifactRef.path("config/demo.json"), "parsedValue", {
          content: '{"name":"Demo","enabled":true}',
        }),
        {
          onFailure: (error) => error,
          onSuccess: () => ({ _tag: "UnexpectedSuccess" }),
        },
      ),
    );

    expect(result).toEqual({
      _tag: "ArtifactHandlerFailed",
      view: "json.parsedValue",
      error: { code: "parse-failed" },
    });
  });
});
