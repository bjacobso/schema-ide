import { JSONSchema, Option, SchemaAST } from "effect";
import type { AnySchema, ReflectedSchema } from "./types";

export function reflectEffectSchema({
  id,
  schema,
  match,
}: {
  readonly id: string;
  readonly schema: AnySchema;
  readonly match?: string | undefined;
}): ReflectedSchema {
  return {
    id,
    title: optionString(SchemaAST.getTitleAnnotation(schema.ast)),
    description: optionString(SchemaAST.getDescriptionAnnotation(schema.ast)),
    match,
    jsonSchema: safeJsonSchema(schema),
  };
}

export function safeJsonSchema(schema: AnySchema): unknown {
  try {
    return JSONSchema.make(schema);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not generate JSON Schema",
    };
  }
}

function optionString(value: Option.Option<string>): string | undefined {
  return Option.isSome(value) ? value.value : undefined;
}
