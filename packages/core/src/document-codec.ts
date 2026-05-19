import { Either, ParseResult, Schema } from "effect";
import YAML from "yaml";
import type {
  SchemaIdeDiagnostic,
  SchemaIdeDocumentCodec,
  SchemaIdeDocumentFormat,
  SchemaIdeParseResult,
} from "./types";

export const JsonDocumentCodec: SchemaIdeDocumentCodec = {
  format: "json",
  extensions: [".json"],
  parse: (text, path) => {
    try {
      return { success: true, value: JSON.parse(text) };
    } catch (error) {
      return {
        success: false,
        diagnostic: parseDiagnostic({
          path: path ?? null,
          source: "json-parse",
          message: error instanceof Error ? error.message : "Invalid JSON",
          position: jsonErrorPosition(text, error),
        }),
      };
    }
  },
  stringify: (value) => `${JSON.stringify(value, null, 2)}\n`,
};

export const YamlDocumentCodec: SchemaIdeDocumentCodec = {
  format: "yaml",
  extensions: [".yaml", ".yml"],
  parse: (text, path) => {
    const document = YAML.parseDocument(text, { prettyErrors: false });
    const error = document.errors[0];

    if (error) {
      const linePos = error.linePos?.[0];
      return {
        success: false,
        diagnostic: parseDiagnostic({
          path: path ?? null,
          source: "yaml-parse",
          message: error.message,
          position: linePos ? { line: linePos.line, column: linePos.col } : undefined,
        }),
      };
    }

    try {
      return { success: true, value: document.toJSON() };
    } catch (error_) {
      return {
        success: false,
        diagnostic: parseDiagnostic({
          path: path ?? null,
          source: "yaml-parse",
          message: error_ instanceof Error ? error_.message : "Invalid YAML",
        }),
      };
    }
  },
  stringify: (value) => YAML.stringify(value),
};

export const BuiltInDocumentCodecs = [JsonDocumentCodec, YamlDocumentCodec] as const;

export function codecForFormat(format: SchemaIdeDocumentFormat): SchemaIdeDocumentCodec {
  return format === "yaml" ? YamlDocumentCodec : JsonDocumentCodec;
}

export function codecForPath(
  path: string,
  fallbackFormat: SchemaIdeDocumentFormat = "json",
): SchemaIdeDocumentCodec {
  const lower = path.toLowerCase();
  return (
    BuiltInDocumentCodecs.find((codec) =>
      codec.extensions.some((extension) => lower.endsWith(extension)),
    ) ?? codecForFormat(fallbackFormat)
  );
}

export function formatForPath(
  path: string,
  fallbackFormat: SchemaIdeDocumentFormat = "json",
): SchemaIdeDocumentFormat {
  return codecForPath(path, fallbackFormat).format;
}

export function parseDocument(
  text: string,
  format: SchemaIdeDocumentFormat,
  path?: string | null,
): SchemaIdeParseResult<unknown> {
  return codecForFormat(format).parse(text, path);
}

export function stringifyDocument(value: unknown, format: SchemaIdeDocumentFormat): string {
  return codecForFormat(format).stringify(value);
}

export const parseYaml: {
  <A, I, R>(schema: Schema.Schema<A, I, R>): Schema.Schema<A, string, R>;
  (): Schema.Schema<unknown, string>;
} = <A, I, R>(schema?: Schema.Schema<A, I, R>) => {
  const target = schema ?? Schema.Unknown;
  return Schema.transformOrFail(Schema.String, target, {
    strict: false,
    decode: (input, _options, ast) =>
      ParseResult.try({
        try: () => YAML.parse(input),
        catch: (error) =>
          new ParseResult.Type(ast, input, error instanceof Error ? error.message : "Invalid YAML"),
      }),
    encode: (value, _options, ast) =>
      ParseResult.try({
        try: () => YAML.stringify(value),
        catch: (error) =>
          new ParseResult.Type(
            ast,
            value,
            error instanceof Error ? error.message : "Could not encode YAML",
          ),
      }),
  }) as never;
};

export function decodeYamlEither<A, I>(
  schema: Schema.Schema<A, I, never>,
  text: string,
): Either.Either<A, ParseResult.ParseError> {
  return Schema.decodeUnknownEither(parseYaml(schema))(text);
}

function parseDiagnostic({
  path,
  source,
  message,
  position,
}: {
  readonly path?: string | null | undefined;
  readonly source: "json-parse" | "yaml-parse";
  readonly message: string;
  readonly position?: { readonly line: number; readonly column: number } | undefined;
}): SchemaIdeDiagnostic {
  return {
    path: path ?? null,
    severity: "error",
    message,
    source,
    ...(position ? { line: position.line, column: position.column } : {}),
  };
}

function jsonErrorPosition(
  text: string,
  error: unknown,
): { readonly line: number; readonly column: number } | undefined {
  if (!(error instanceof SyntaxError)) return undefined;
  const match = error.message.match(/position (\d+)/);
  if (!match?.[1]) return undefined;

  const position = Number.parseInt(match[1], 10);
  if (!Number.isFinite(position)) return undefined;

  const prefix = text.slice(0, position);
  const lines = prefix.split(/\r?\n/);
  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
}
