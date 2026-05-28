import { Schema } from "effect";
import type { AnySchema, ReflectedSchema } from "./types";

const ReflectedEffectSchemaKey = Symbol.for("@schema-ide/core/reflected-effect-schema");

export function reflectEffectSchema({
  id,
  schema,
  match,
  title,
  description,
}: {
  readonly id: string;
  readonly schema: AnySchema;
  readonly match?: string | undefined;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
}): ReflectedSchema {
  const reflected = {
    id,
    title: title ?? annotationString(schema.ast.annotations?.["title"]),
    description: description ?? annotationString(schema.ast.annotations?.["description"]),
    match,
    jsonSchema: safeJsonSchema(schema),
  };

  Object.defineProperty(reflected, ReflectedEffectSchemaKey, {
    value: schema,
    enumerable: false,
  });

  return reflected;
}

export function safeJsonSchema(schema: AnySchema): unknown {
  try {
    return Schema.toJsonSchemaDocument(schema as never).schema;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not generate JSON Schema",
    };
  }
}

function annotationString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function sourceSchemaFromReflection(
  reflected: ReflectedSchema,
): Schema.Schema<unknown> | undefined {
  return (reflected as { readonly [ReflectedEffectSchemaKey]?: Schema.Schema<unknown> })[
    ReflectedEffectSchemaKey
  ];
}
