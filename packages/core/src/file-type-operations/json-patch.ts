import { Schema } from "effect";
import { OperationDef } from "../file-type-definition";

const JsonPatchEntrySchema = Schema.Struct({
  op: Schema.Literals(["add", "replace", "remove"]).annotate({
    description: "Patch operation to apply.",
  }),
  path: Schema.String.annotate({
    description: 'RFC 6901 JSON Pointer path, such as "/enabled" or "/items/0".',
  }),
  value: Schema.optional(
    Schema.Unknown.annotate({
      description: "Value for add or replace operations.",
    }),
  ),
});

export const JsonPatchParametersSchema = Schema.Struct({
  patch: Schema.Array(JsonPatchEntrySchema).annotate({
    description: "Ordered RFC 6902-style patch operations.",
  }),
});

export const JsonPatchOutput = Schema.Struct({
  value: Schema.Unknown.annotate({
    description: "Patched parsed document value.",
  }),
});
export type JsonPatchOutput = typeof JsonPatchOutput.Type;

export const JsonPatchOperation = OperationDef.make({
  name: "json_patch",
  description:
    "Apply RFC 6902-style add, replace, and remove operations to the parsed document, then serialize it back to the same file.",
  mutates: true,
  parametersSchema: JsonPatchParametersSchema,
  outputSchema: JsonPatchOutput,
});
