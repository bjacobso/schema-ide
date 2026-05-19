import { Schema } from "effect";

export const OpenRouterToolCallSchema = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal("function"),
  function: Schema.Struct({
    name: Schema.String,
    arguments: Schema.String,
  }),
});

export type OpenRouterToolCall = typeof OpenRouterToolCallSchema.Type;

export const OpenRouterToolDefinitionSchema = Schema.Struct({
  type: Schema.Literal("function"),
  function: Schema.Struct({
    name: Schema.String,
    description: Schema.String,
    parameters: Schema.Unknown,
  }),
});

export type OpenRouterToolDefinition = typeof OpenRouterToolDefinitionSchema.Type;

export const OpenRouterSystemMessageSchema = Schema.Struct({
  role: Schema.Literal("system"),
  content: Schema.String,
});

export const OpenRouterUserMessageSchema = Schema.Struct({
  role: Schema.Literal("user"),
  content: Schema.String,
});

export const OpenRouterAssistantMessageSchema = Schema.Struct({
  role: Schema.Literal("assistant"),
  content: Schema.optional(Schema.NullOr(Schema.String)),
  tool_calls: Schema.optional(Schema.Array(OpenRouterToolCallSchema)),
});

export const OpenRouterAssistantResponseMessageSchema = Schema.Struct({
  role: Schema.optional(Schema.Literal("assistant")),
  content: Schema.optional(Schema.NullOr(Schema.String)),
  tool_calls: Schema.optional(Schema.Array(OpenRouterToolCallSchema)),
});

export const OpenRouterToolMessageSchema = Schema.Struct({
  role: Schema.Literal("tool"),
  tool_call_id: Schema.String,
  content: Schema.String,
});

export const OpenRouterMessageSchema = Schema.Union(
  OpenRouterSystemMessageSchema,
  OpenRouterUserMessageSchema,
  OpenRouterAssistantMessageSchema,
  OpenRouterToolMessageSchema,
);

export type OpenRouterMessage = typeof OpenRouterMessageSchema.Type;
export type OpenRouterAssistantMessage = typeof OpenRouterAssistantMessageSchema.Type;
export type OpenRouterAssistantResponseMessage =
  typeof OpenRouterAssistantResponseMessageSchema.Type;

export const OpenRouterChatRequestSchema = Schema.Struct({
  model: Schema.String,
  messages: Schema.Array(OpenRouterMessageSchema),
  tools: Schema.optional(Schema.Array(OpenRouterToolDefinitionSchema)),
});

export type OpenRouterChatRequest = typeof OpenRouterChatRequestSchema.Type;

export const OpenRouterChatCompletionResponseSchema = Schema.Struct({
  choices: Schema.Array(
    Schema.Struct({
      message: OpenRouterAssistantResponseMessageSchema,
    }),
  ),
});

export type OpenRouterChatCompletionResponse = typeof OpenRouterChatCompletionResponseSchema.Type;

export const SchemaIdeModelSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
});

export type SchemaIdeModel = typeof SchemaIdeModelSchema.Type;

export const SchemaIdeModelsResponseSchema = Schema.Struct({
  models: Schema.Array(SchemaIdeModelSchema),
});

export type SchemaIdeModelsResponse = typeof SchemaIdeModelsResponseSchema.Type;

export const SchemaIdeHealthResponseSchema = Schema.Struct({
  ok: Schema.Literal(true),
});

export type SchemaIdeHealthResponse = typeof SchemaIdeHealthResponseSchema.Type;
