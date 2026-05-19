import type { SchemaIdeFileTypeDefinition } from "../file-type-definition";
import { JsonPatchOperation } from "../file-type-operations/json-patch";

export const YamlFileTypeDefinition = {
  id: "yaml",
  label: "YAML",
  extensions: [".yaml", ".yml"],
  mediaTypes: ["application/yaml", "text/yaml"],
  operations: [JsonPatchOperation],
} satisfies SchemaIdeFileTypeDefinition;
