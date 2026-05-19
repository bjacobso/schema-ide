import { Effect, Match } from "effect";
import YAML from "yaml";
import { SchemaIdeFileTypeError } from "../file-type-error";
import { YamlFileTypeDefinition } from "../file-type-definitions/yaml";
import { JsonPatchOperation } from "../file-type-operations/json-patch";
import type { SchemaIdeFileTypePlugin } from "../file-type";
import { applyJsonPatchEffect } from "../file-type-support/json-patch";
import { parseDiagnostic } from "../file-type-support/parse-diagnostics";

export const YamlFileTypePlugin: SchemaIdeFileTypePlugin = {
  ...YamlFileTypeDefinition,
  parse: (text, path) =>
    Effect.sync(() => {
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
    }),
  stringify: (value) => Effect.succeed(YAML.stringify(value)),
  applyOperation: (input) =>
    Match.value(input.operation).pipe(
      Match.when(JsonPatchOperation.name, () =>
        Effect.gen(function* () {
          const parsed = yield* YamlFileTypePlugin.parse(input.file.content, input.file.path);
          if (!parsed.success) {
            return yield* Effect.fail(
              new SchemaIdeFileTypeError(`Cannot patch invalid YAML: ${parsed.diagnostic.message}`),
            );
          }
          const nextValue = yield* applyJsonPatchEffect(parsed.value, input.args);
          const content = yield* YamlFileTypePlugin.stringify!(nextValue, input.file.path);
          return {
            file: { path: input.file.path, content },
            result: { value: nextValue },
          };
        }),
      ),
      Match.orElse((operation) =>
        Effect.fail(new SchemaIdeFileTypeError(`Unsupported YAML operation: ${operation}`)),
      ),
    ),
};
