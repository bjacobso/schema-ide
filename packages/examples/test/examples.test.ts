import { describe, expect, it } from "vitest";
import { validateSchemaIdeValue } from "@schema-ide/core";
import { randomSchemaIdeExample, schemaIdeExamples } from "../src";

describe("schema-ide-examples", () => {
  it("exports valid playground examples", () => {
    expect(schemaIdeExamples.length).toBeGreaterThan(0);
    expect(randomSchemaIdeExample()).toBeDefined();

    for (const example of schemaIdeExamples) {
      const result = validateSchemaIdeValue({
        schema: example.schema,
        files: example.files,
        activeFile: example.files[0]?.path ?? null,
        activeFormat: example.defaultFormat ?? "json",
      });

      expect(result.routeMatches.length).toBeGreaterThan(0);
    }
  });
});
