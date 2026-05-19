import { Context, Effect, Layer, Schema } from "effect";
import type {
  SchemaIdeFileTypeDefinition,
  SchemaIdeFileTypeOperationDefinition,
} from "./file-type-definition";
import { SchemaIdeFileTypeError } from "./file-type-error";
import { JsonFileTypePlugin } from "./file-types/json";
import { PdfFileTypePlugin } from "./file-types/pdf";
import { YamlFileTypePlugin } from "./file-types/yaml";
import type {
  SchemaIdeDiagnostic,
  SchemaIdeDocumentCodec,
  SchemaIdeDocumentFormat,
  SchemaIdeParseResult,
  SourceFile,
} from "./types";

export type {
  SchemaIdeFileTypeDefinition,
  SchemaIdeFileTypeOperationDefinition,
  SchemaIdeFileTypeOperationInfo,
} from "./file-type-definition";
export {
  BuiltInFileTypeDefinitions,
  JsonFileTypeDefinition,
  JsonPatchOperation,
  OperationDef,
  PdfAnnotation,
  PdfAnnotationDocument,
  PdfAnnotationPage,
  PdfContentEncoding,
  PdfFieldMetadata,
  PdfFileTypeDefinition,
  PdfMetadata,
  PdfPageMetadata,
  PdfRect,
  PdfWidgetMetadata,
  RenderPageScreenshotOperation,
  UpdateFormAnnotationsOperation,
  YamlFileTypeDefinition,
} from "./file-type-definitions";
export { SchemaIdeFileTypeError } from "./file-type-error";
export { JsonFileTypePlugin } from "./file-types/json";
export { PdfFileTypePlugin } from "./file-types/pdf";
export { YamlFileTypePlugin } from "./file-types/yaml";

export interface SchemaIdeFileTypeInspection {
  readonly path: string;
  readonly fileType: string;
  readonly format: SchemaIdeDocumentFormat;
  readonly extensions: readonly string[];
  readonly mediaTypes: readonly string[];
  readonly diagnostics: readonly SchemaIdeDiagnostic[];
  readonly parsedData?: unknown;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly operations: readonly SchemaIdeFileTypeOperationDefinition[];
}

export interface SchemaIdeFileTypeInspectionExtra {
  readonly diagnostics?: readonly SchemaIdeDiagnostic[] | undefined;
  readonly parsedData?: unknown;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

export interface SchemaIdeFileTypeOperationInput {
  readonly file: SourceFile;
  readonly operation: string;
  readonly args: Readonly<Record<string, unknown>>;
}

export interface SchemaIdeFileTypeOperationResult {
  readonly file: SourceFile;
  readonly result: unknown;
}

export interface SchemaIdeFileTypePlugin extends SchemaIdeFileTypeDefinition {
  readonly parse: (
    text: string,
    path?: string | null,
  ) => Effect.Effect<SchemaIdeParseResult<unknown>, SchemaIdeFileTypeError>;
  readonly stringify?: (
    value: unknown,
    path?: string | null,
  ) => Effect.Effect<string, SchemaIdeFileTypeError>;
  readonly inspect?: (
    file: SourceFile,
    parsed: SchemaIdeParseResult<unknown>,
  ) => Effect.Effect<SchemaIdeFileTypeInspectionExtra, SchemaIdeFileTypeError>;
  readonly applyOperation?: (
    input: SchemaIdeFileTypeOperationInput,
  ) => Effect.Effect<SchemaIdeFileTypeOperationResult, SchemaIdeFileTypeError>;
}

export interface SchemaIdeFileTypeRegistryService {
  readonly plugins: readonly SchemaIdeFileTypePlugin[];
  readonly pluginForFormat: (
    format: SchemaIdeDocumentFormat,
    fallbackFormat?: SchemaIdeDocumentFormat,
  ) => SchemaIdeFileTypePlugin;
  readonly pluginForPath: (
    path: string,
    fallbackFormat?: SchemaIdeDocumentFormat,
  ) => SchemaIdeFileTypePlugin;
  readonly inspectFile: (
    file: SourceFile,
    fallbackFormat?: SchemaIdeDocumentFormat,
  ) => Effect.Effect<SchemaIdeFileTypeInspection, SchemaIdeFileTypeError>;
  readonly applyOperation: (
    input: SchemaIdeFileTypeOperationInput,
    fallbackFormat?: SchemaIdeDocumentFormat,
  ) => Effect.Effect<SchemaIdeFileTypeOperationResult, SchemaIdeFileTypeError>;
}

export class SchemaIdeFileTypeRegistry extends Context.Service<
  SchemaIdeFileTypeRegistry,
  SchemaIdeFileTypeRegistryService
>()("schema-ide/FileTypeRegistry") {}

export const BuiltInFileTypePlugins = [
  JsonFileTypePlugin,
  YamlFileTypePlugin,
  PdfFileTypePlugin,
] as const;

export function makeSchemaIdeFileTypeRegistry(
  plugins: readonly SchemaIdeFileTypePlugin[] = [],
): SchemaIdeFileTypeRegistryService {
  const orderedPlugins = mergeFileTypePlugins([...BuiltInFileTypePlugins, ...plugins]);

  const pluginForFormat = (
    format: SchemaIdeDocumentFormat,
    fallbackFormat: SchemaIdeDocumentFormat = "json",
  ) =>
    orderedPlugins.find((plugin) => plugin.id === format) ??
    orderedPlugins.find((plugin) => plugin.id === fallbackFormat) ??
    JsonFileTypePlugin;

  const pluginForPath = (
    path: string,
    fallbackFormat: SchemaIdeDocumentFormat = "json",
  ): SchemaIdeFileTypePlugin => {
    const lower = path.toLowerCase();
    return (
      orderedPlugins.find((plugin) =>
        plugin.extensions.some((extension) => lower.endsWith(extension)),
      ) ?? pluginForFormat(fallbackFormat)
    );
  };

  return {
    plugins: orderedPlugins,
    pluginForFormat,
    pluginForPath,
    inspectFile: (file, fallbackFormat = "json") =>
      Effect.gen(function* () {
        const plugin = pluginForPath(file.path, fallbackFormat);
        const parsed = yield* plugin.parse(file.content, file.path);
        const extra: SchemaIdeFileTypeInspectionExtra = plugin.inspect
          ? yield* plugin.inspect(file, parsed)
          : {};
        const diagnostics = extra.diagnostics ?? (parsed.success ? [] : [parsed.diagnostic]);
        return {
          path: file.path,
          fileType: plugin.id,
          format: plugin.id,
          extensions: plugin.extensions,
          mediaTypes: plugin.mediaTypes ?? [],
          diagnostics,
          ...(extra.parsedData !== undefined
            ? { parsedData: extra.parsedData }
            : parsed.success
              ? { parsedData: parsed.value }
              : {}),
          ...(extra.metadata ? { metadata: extra.metadata } : {}),
          operations: plugin.operations ?? [],
        };
      }),
    applyOperation: (input, fallbackFormat = "json") =>
      Effect.gen(function* () {
        const plugin = pluginForPath(input.file.path, fallbackFormat);
        if (!plugin.applyOperation) {
          return yield* Effect.fail(
            new SchemaIdeFileTypeError(`File type ${plugin.id} does not support operations.`),
          );
        }
        const args = yield* decodeOperationArgs(plugin, input);
        const result = yield* plugin.applyOperation({ ...input, args });
        return yield* decodeOperationOutput(plugin, input.operation, result);
      }),
  };
}

export const BuiltInFileTypeRegistry = makeSchemaIdeFileTypeRegistry();

export const makeSchemaIdeFileTypeRegistryLayer = (
  plugins: readonly SchemaIdeFileTypePlugin[] = [],
) => Layer.succeed(SchemaIdeFileTypeRegistry, makeSchemaIdeFileTypeRegistry(plugins));

export function documentCodecFromFileTypePlugin(
  plugin: SchemaIdeFileTypePlugin,
): SchemaIdeDocumentCodec {
  return {
    format: plugin.id,
    extensions: plugin.extensions,
    parse: (text, path) => Effect.runSync(plugin.parse(text, path)),
    stringify: (value) => Effect.runSync(stringifyWith(plugin, value)),
  };
}

export function inspectFileEffect(
  file: SourceFile,
  options: {
    readonly registry?: SchemaIdeFileTypeRegistryService | undefined;
    readonly fallbackFormat?: SchemaIdeDocumentFormat | undefined;
  } = {},
): Effect.Effect<SchemaIdeFileTypeInspection, SchemaIdeFileTypeError> {
  return (options.registry ?? BuiltInFileTypeRegistry).inspectFile(file, options.fallbackFormat);
}

export function inspectFileServiceEffect(
  file: SourceFile,
  options: {
    readonly fallbackFormat?: SchemaIdeDocumentFormat | undefined;
  } = {},
): Effect.Effect<SchemaIdeFileTypeInspection, SchemaIdeFileTypeError, SchemaIdeFileTypeRegistry> {
  return Effect.gen(function* () {
    const registry = yield* SchemaIdeFileTypeRegistry;
    return yield* registry.inspectFile(file, options.fallbackFormat);
  });
}

export function inspectFileSync(
  file: SourceFile,
  options: {
    readonly registry?: SchemaIdeFileTypeRegistryService | undefined;
    readonly fallbackFormat?: SchemaIdeDocumentFormat | undefined;
  } = {},
): SchemaIdeFileTypeInspection {
  return Effect.runSync(inspectFileEffect(file, options));
}

export function applyFileTypeOperationEffect(
  input: SchemaIdeFileTypeOperationInput,
  options: {
    readonly registry?: SchemaIdeFileTypeRegistryService | undefined;
    readonly fallbackFormat?: SchemaIdeDocumentFormat | undefined;
  } = {},
): Effect.Effect<SchemaIdeFileTypeOperationResult, SchemaIdeFileTypeError> {
  return (options.registry ?? BuiltInFileTypeRegistry).applyOperation(
    input,
    options.fallbackFormat,
  );
}

export function applyFileTypeOperationServiceEffect(
  input: SchemaIdeFileTypeOperationInput,
  options: {
    readonly fallbackFormat?: SchemaIdeDocumentFormat | undefined;
  } = {},
): Effect.Effect<
  SchemaIdeFileTypeOperationResult,
  SchemaIdeFileTypeError,
  SchemaIdeFileTypeRegistry
> {
  return Effect.gen(function* () {
    const registry = yield* SchemaIdeFileTypeRegistry;
    return yield* registry.applyOperation(input, options.fallbackFormat);
  });
}

export function applyFileTypeOperationSync(
  input: SchemaIdeFileTypeOperationInput,
  options: {
    readonly registry?: SchemaIdeFileTypeRegistryService | undefined;
    readonly fallbackFormat?: SchemaIdeDocumentFormat | undefined;
  } = {},
): SchemaIdeFileTypeOperationResult {
  return Effect.runSync(applyFileTypeOperationEffect(input, options));
}

function stringifyWith(
  plugin: SchemaIdeFileTypePlugin,
  value: unknown,
  path?: string | null,
): Effect.Effect<string, SchemaIdeFileTypeError> {
  if (!plugin.stringify) {
    return Effect.fail(new SchemaIdeFileTypeError(`File type ${plugin.id} cannot stringify.`));
  }
  return plugin.stringify(value, path);
}

function mergeFileTypePlugins(
  plugins: readonly SchemaIdeFileTypePlugin[],
): readonly SchemaIdeFileTypePlugin[] {
  return [...new Map(plugins.map((plugin) => [plugin.id, plugin])).values()];
}

function decodeOperationArgs(
  plugin: SchemaIdeFileTypePlugin,
  input: SchemaIdeFileTypeOperationInput,
): Effect.Effect<Readonly<Record<string, unknown>>, SchemaIdeFileTypeError> {
  const operation = plugin.operations?.find((candidate) => candidate.name === input.operation);
  const parametersSchema = operation?.parametersSchema;
  if (!parametersSchema) return Effect.succeed(input.args);

  return Effect.try({
    try: () => Schema.decodeUnknownSync(parametersSchema as never)(input.args),
    catch: (error) =>
      new SchemaIdeFileTypeError(
        `Invalid ${plugin.id} operation arguments for ${input.operation}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ),
  }).pipe(
    Effect.flatMap((decoded) =>
      isRecord(decoded)
        ? Effect.succeed(decoded)
        : Effect.fail(
            new SchemaIdeFileTypeError(
              `Invalid ${plugin.id} operation arguments for ${input.operation}: expected an object.`,
            ),
          ),
    ),
  );
}

function decodeOperationOutput(
  plugin: SchemaIdeFileTypePlugin,
  operationName: string,
  result: SchemaIdeFileTypeOperationResult,
): Effect.Effect<SchemaIdeFileTypeOperationResult, SchemaIdeFileTypeError> {
  const operation = plugin.operations?.find((candidate) => candidate.name === operationName);
  const outputSchema = operation?.outputSchema;
  if (!outputSchema) return Effect.succeed(result);

  return Effect.try({
    try: () => Schema.decodeUnknownSync(outputSchema as never)(result.result),
    catch: (error) =>
      new SchemaIdeFileTypeError(
        `Invalid ${plugin.id} operation output for ${operationName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ),
  }).pipe(
    Effect.map((decoded) => ({
      ...result,
      result: decoded,
    })),
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
