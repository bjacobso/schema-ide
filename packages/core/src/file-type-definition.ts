import { Schema } from "effect";
import type { SchemaIdeDocumentFormat } from "./types";

export interface SchemaIdeFileTypeOperationDefinition {
  readonly name: string;
  readonly description: string;
  readonly mutates: boolean;
  readonly parametersSchema?: Schema.Top | undefined;
  readonly outputSchema?: Schema.Top | undefined;
}

export interface SchemaIdeFileTypeDefinition {
  readonly id: SchemaIdeDocumentFormat;
  readonly label: string;
  readonly extensions: readonly string[];
  readonly mediaTypes?: readonly string[] | undefined;
  readonly operations?: readonly SchemaIdeFileTypeOperationDefinition[] | undefined;
}

export interface SchemaIdeFileTypeOperationInfo {
  readonly name: string;
  readonly description: string;
  readonly mutates: boolean;
  readonly parametersJsonSchema?: unknown;
  readonly outputJsonSchema?: unknown;
}

export const OperationDef = {
  make<const Name extends string>(
    definition: SchemaIdeFileTypeOperationDefinition & {
      readonly name: Name;
    },
  ): SchemaIdeFileTypeOperationDefinition & { readonly name: Name } {
    return definition;
  },
  toJsonSchema(schema: Schema.Top | undefined): unknown | undefined {
    return schema ? Schema.toJsonSchemaDocument(schema).schema : undefined;
  },
  toJson(operation: SchemaIdeFileTypeOperationDefinition): SchemaIdeFileTypeOperationInfo {
    const parametersJsonSchema = OperationDef.toJsonSchema(operation.parametersSchema);
    const outputJsonSchema = OperationDef.toJsonSchema(operation.outputSchema);
    return {
      name: operation.name,
      description: operation.description,
      mutates: operation.mutates,
      ...(parametersJsonSchema ? { parametersJsonSchema } : {}),
      ...(outputJsonSchema ? { outputJsonSchema } : {}),
    };
  },
};
