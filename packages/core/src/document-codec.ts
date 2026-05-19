import { Result, Schema, SchemaGetter, SchemaIssue } from "effect";
import YAML from "yaml";
import {
  BuiltInFileTypeRegistry,
  documentCodecFromFileTypePlugin,
  JsonFileTypePlugin,
  YamlFileTypePlugin,
  type SchemaIdeFileTypeRegistryService,
} from "./file-type";
import type {
  SchemaIdeDocumentCodec,
  SchemaIdeDocumentFormat,
  SchemaIdeParseResult,
} from "./types";

export const JsonDocumentCodec: SchemaIdeDocumentCodec =
  documentCodecFromFileTypePlugin(JsonFileTypePlugin);

export const YamlDocumentCodec: SchemaIdeDocumentCodec =
  documentCodecFromFileTypePlugin(YamlFileTypePlugin);

export const BuiltInDocumentCodecs = [JsonDocumentCodec, YamlDocumentCodec] as const;

export function codecForFormat(
  format: SchemaIdeDocumentFormat,
  registry: SchemaIdeFileTypeRegistryService = BuiltInFileTypeRegistry,
): SchemaIdeDocumentCodec {
  return documentCodecFromFileTypePlugin(registry.pluginForFormat(format));
}

export function codecForPath(
  path: string,
  fallbackFormat: SchemaIdeDocumentFormat = "json",
  registry: SchemaIdeFileTypeRegistryService = BuiltInFileTypeRegistry,
): SchemaIdeDocumentCodec {
  return documentCodecFromFileTypePlugin(registry.pluginForPath(path, fallbackFormat));
}

export function formatForPath(
  path: string,
  fallbackFormat: SchemaIdeDocumentFormat = "json",
  registry: SchemaIdeFileTypeRegistryService = BuiltInFileTypeRegistry,
): SchemaIdeDocumentFormat {
  return codecForPath(path, fallbackFormat, registry).format;
}

export function parseDocument(
  text: string,
  format: SchemaIdeDocumentFormat,
  path?: string | null,
  registry: SchemaIdeFileTypeRegistryService = BuiltInFileTypeRegistry,
): SchemaIdeParseResult<unknown> {
  return codecForFormat(format, registry).parse(text, path);
}

export function stringifyDocument(
  value: unknown,
  format: SchemaIdeDocumentFormat,
  registry: SchemaIdeFileTypeRegistryService = BuiltInFileTypeRegistry,
): string {
  return codecForFormat(format, registry).stringify(value);
}

export const parseYaml: {
  <A>(schema: Schema.Schema<A>): Schema.Codec<A, string>;
  (): Schema.Codec<unknown, string>;
} = <A>(schema?: Schema.Schema<A>) => {
  const target = schema ?? Schema.Unknown;
  return Schema.String.pipe(
    Schema.decodeTo(target, {
      decode: SchemaGetter.transform((input: string) => YAML.parse(input)),
      encode: SchemaGetter.transform((value: unknown) => YAML.stringify(value)),
    }),
  ) as never;
};

export function decodeYamlEither<A>(
  schema: Schema.Schema<A>,
  text: string,
): Result.Result<A, SchemaIssue.Issue> {
  return Schema.decodeUnknownResult(parseYaml(schema) as never)(text) as Result.Result<
    A,
    SchemaIssue.Issue
  >;
}
