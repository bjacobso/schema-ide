import type { SchemaIdeFileTypeDefinition } from "../file-type-definition";
import { JsonPatchOperation } from "../file-type-operations/json-patch";

export const JsonFileTypeDefinition = {
  id: "json",
  label: "JSON",
  extensions: [".json"],
  mediaTypes: ["application/json"],
  operations: [JsonPatchOperation],
} satisfies SchemaIdeFileTypeDefinition;
