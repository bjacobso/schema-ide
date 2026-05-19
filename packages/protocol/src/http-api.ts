import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform";
import { Schema } from "effect";
import {
  OpenRouterChatCompletionResponseSchema,
  OpenRouterChatRequestSchema,
  SchemaIdeHealthResponseSchema,
  SchemaIdeModelsResponseSchema,
} from "./chat";

export class SchemaIdeServerError extends Schema.TaggedError<SchemaIdeServerError>()(
  "SchemaIdeServerError",
  { message: Schema.String },
  HttpApiSchema.annotations({ status: 500 }),
) {}

export class SchemaIdeUpstreamError extends Schema.TaggedError<SchemaIdeUpstreamError>()(
  "SchemaIdeUpstreamError",
  {
    message: Schema.String,
    upstreamStatus: Schema.optional(Schema.Number),
  },
  HttpApiSchema.annotations({ status: 502 }),
) {}

export class SchemaIdeChatApiGroup extends HttpApiGroup.make("chat")
  .add(
    HttpApiEndpoint.post("complete", "/chat")
      .setPayload(OpenRouterChatRequestSchema)
      .addSuccess(OpenRouterChatCompletionResponseSchema)
      .addError(SchemaIdeServerError)
      .addError(SchemaIdeUpstreamError),
  )
  .add(
    HttpApiEndpoint.post("stream", "/chat/stream")
      .setPayload(OpenRouterChatRequestSchema)
      .addSuccess(Schema.String)
      .addError(SchemaIdeServerError)
      .addError(SchemaIdeUpstreamError),
  )
  .add(HttpApiEndpoint.get("models", "/models").addSuccess(SchemaIdeModelsResponseSchema))
  .add(HttpApiEndpoint.get("health", "/healthz").addSuccess(SchemaIdeHealthResponseSchema)) {}

export class SchemaIdeHttpApi extends HttpApi.make("SchemaIdeHttpApi")
  .add(SchemaIdeChatApiGroup)
  .prefix("/v1") {}
