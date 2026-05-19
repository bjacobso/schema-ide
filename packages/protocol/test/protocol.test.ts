import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import {
  OpenRouterChatCompletionResponseSchema,
  OpenRouterChatRequestSchema,
  SchemaIdeHttpApi,
} from "../src";

describe("schema-ide-protocol", () => {
  it("decodes OpenRouter-compatible chat requests and responses", () => {
    const request = Schema.decodeUnknownSync(OpenRouterChatRequestSchema)({
      model: "test/model",
      messages: [{ role: "user", content: "Read a file." }],
      tools: [
        {
          type: "function",
          function: {
            name: "read_file",
            description: "Read a file",
            parameters: { type: "object", properties: { path: { type: "string" } } },
          },
        },
      ],
    });

    const response = Schema.decodeUnknownSync(OpenRouterChatCompletionResponseSchema)({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: "call-1",
                type: "function",
                function: { name: "read_file", arguments: '{"path":"forms/intake.json"}' },
              },
            ],
          },
        },
      ],
    });

    expect(request.messages[0]?.role).toBe("user");
    expect(response.choices[0]?.message.tool_calls?.[0]?.function.name).toBe("read_file");
    expect(SchemaIdeHttpApi).toBeDefined();
  });
});
