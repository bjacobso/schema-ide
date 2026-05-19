import { Effect, Match } from "effect";
import { SchemaIdeFileTypeError } from "../file-type-error";
import { JsonFileTypeDefinition } from "../file-type-definitions/json";
import { JsonPatchOperation } from "../file-type-operations/json-patch";
import type { SchemaIdeFileTypePlugin } from "../file-type";
import { applyJsonPatchEffect } from "../file-type-support/json-patch";
import { jsonErrorPosition, parseDiagnostic } from "../file-type-support/parse-diagnostics";

export const JsonFileTypePlugin: SchemaIdeFileTypePlugin = {
  ...JsonFileTypeDefinition,
  parse: (text, path) =>
    Effect.sync(() => {
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
    }),
  stringify: (value) => Effect.succeed(`${JSON.stringify(value, null, 2)}\n`),
  applyOperation: (input) =>
    Match.value(input.operation).pipe(
      Match.when(JsonPatchOperation.name, () =>
        Effect.gen(function* () {
          const parsed = yield* JsonFileTypePlugin.parse(input.file.content, input.file.path);
          if (!parsed.success) {
            return yield* Effect.fail(
              new SchemaIdeFileTypeError(`Cannot patch invalid JSON: ${parsed.diagnostic.message}`),
            );
          }
          const nextValue = yield* applyJsonPatchEffect(parsed.value, input.args);
          const content = yield* JsonFileTypePlugin.stringify!(nextValue, input.file.path);
          return {
            file: { path: input.file.path, content },
            result: { value: nextValue },
          };
        }),
      ),
      Match.orElse((operation) =>
        Effect.fail(new SchemaIdeFileTypeError(`Unsupported JSON operation: ${operation}`)),
      ),
    ),
};
