import { describe, expect, expectTypeOf, it } from "vitest";
import { Effect, Schema } from "effect";
import { PDFDocument } from "pdf-lib";
import {
  BuiltInFileTypeDefinitions,
  JsonFileTypeDefinition,
  JsonPatchOperation,
  OperationDef,
  PdfFileTypeDefinition,
  PdfFileTypePlugin,
  PdfRect,
  Workspace,
  applyFileTypeOperationEffect,
  applyFileTypeOperationServiceEffect,
  applyFileTypeOperationSync,
  applyWorkspaceChange,
  createReflection,
  createVersionedWorkspace,
  getSchemaIdeCompletions,
  getSchemaIdeDefinitions,
  getSchemaIdeHover,
  getSchemaIdeQuickFixes,
  makeSchemaIdeFileTypeRegistryLayer,
  parseYaml,
  redoWorkspaceChange,
  inspectFileEffect,
  inspectFileServiceEffect,
  inspectFileSync,
  undoWorkspaceChange,
  validateSchemaIdeValue,
  validateSingleDocument,
  YamlFileTypeDefinition,
  type SchemaIdeFileTypePlugin,
  type WorkspaceRoutes,
} from "../src";

const ConfigSchema = Schema.Struct({
  name: Schema.String,
  enabled: Schema.Boolean,
});

describe("schema-ide-core", () => {
  it("exposes definition-only file type metadata separately from plugin implementations", () => {
    expect(BuiltInFileTypeDefinitions.map((definition) => definition.id)).toEqual([
      "json",
      "yaml",
      "pdf",
    ]);
    expect(BuiltInFileTypeDefinitions.map((definition) => definition.id)).not.toContain(
      "json_patch",
    );
    expect(PdfFileTypeDefinition.operations?.map((operation) => operation.name)).toEqual([
      "update_form_annotations",
      "render_page_screenshot",
    ]);
    const updateOperation = PdfFileTypeDefinition.operations?.[0];
    expect(updateOperation).toBeDefined();
    expect("parametersJsonSchema" in updateOperation!).toBe(false);
    expect(OperationDef.toJson(updateOperation!)).toMatchObject({
      name: "update_form_annotations",
      parametersJsonSchema: {
        type: "object",
        required: ["annotationDoc"],
      },
      outputJsonSchema: {
        type: "object",
        required: [
          "operation",
          "coordinateSystem",
          "fieldsCreated",
          "fieldsRemoved",
          "pages",
          "annotationCount",
        ],
      },
    });
    expect("parse" in PdfFileTypeDefinition).toBe(false);
    expect(PdfFileTypePlugin).toMatchObject(PdfFileTypeDefinition);
  });

  it("models json_patch as a shared operation, not a file type definition", () => {
    expect(JsonPatchOperation.name).toBe("json_patch");
    expect(JsonFileTypeDefinition.operations).toEqual([JsonPatchOperation]);
    expect(YamlFileTypeDefinition.operations).toEqual([JsonPatchOperation]);

    const operationInfo = OperationDef.toJson(JsonPatchOperation);
    expect(operationInfo).toMatchObject({
      name: "json_patch",
      mutates: true,
      parametersJsonSchema: {
        type: "object",
        required: ["patch"],
      },
      outputJsonSchema: {
        type: "object",
        required: ["value"],
      },
    });
    expect("parametersSchema" in operationInfo).toBe(false);
  });

  it("derives PDF contract types from Effect schemas", () => {
    expect(Schema.decodeUnknownSync(PdfRect)({ x: 1, y: 2, width: 3, height: 4 })).toEqual({
      x: 1,
      y: 2,
      width: 3,
      height: 4,
    });
    expect(() =>
      Schema.decodeUnknownSync(PdfRect)({ x: 1, y: 2, width: "3", height: 4 }),
    ).toThrow();
  });

  it("validates JSON and YAML documents with Effect Schema", () => {
    expect(
      validateSingleDocument({
        schema: ConfigSchema,
        content: '{"name":"Demo","enabled":true}',
        format: "json",
        path: "config.json",
      }).value,
    ).toEqual({ name: "Demo", enabled: true });

    expect(
      Schema.decodeUnknownSync(parseYaml(ConfigSchema))("name: Demo\nenabled: true\n"),
    ).toEqual({ name: "Demo", enabled: true });
  });

  it("inspects files and applies file type plugin operations", () => {
    const validInspection = inspectFileSync({
      path: "config.json",
      content: '{"name":"Demo","enabled":true}',
    });

    expect(validInspection).toMatchObject({
      path: "config.json",
      fileType: "json",
      parsedData: { name: "Demo", enabled: true },
      diagnostics: [],
    });
    expect(validInspection.operations.map((operation) => operation.name)).toContain("json_patch");

    const invalidInspection = inspectFileSync({
      path: "broken.yaml",
      content: "name: [unterminated\n",
    });
    expect(invalidInspection.fileType).toBe("yaml");
    expect(invalidInspection.diagnostics[0]).toMatchObject({
      path: "broken.yaml",
      severity: "error",
      source: "yaml-parse",
    });

    const patched = applyFileTypeOperationSync({
      file: { path: "config.json", content: '{"name":"Demo","enabled":true}' },
      operation: "json_patch",
      args: {
        patch: [{ op: "replace", path: "/enabled", value: false }],
      },
    });

    expect(JSON.parse(patched.file.content)).toEqual({ name: "Demo", enabled: false });

    expect(() =>
      applyFileTypeOperationSync({
        file: { path: "config.json", content: '{"name":"Demo","enabled":true}' },
        operation: "json_patch",
        args: {},
      }),
    ).toThrow("Invalid json operation arguments for json_patch");
  });

  it("runs file type inspection and operations through the Effect registry service", async () => {
    const customPlugin: SchemaIdeFileTypePlugin = {
      id: "custom",
      label: "Custom",
      extensions: [".custom"],
      operations: [
        {
          name: "uppercase",
          description: "Uppercase the file content.",
          mutates: true,
          outputSchema: Schema.Struct({ changed: Schema.Boolean }),
        },
      ],
      parse: (text) => Effect.succeed({ success: true, value: { text } }),
      stringify: (value) =>
        Effect.succeed(typeof value === "string" ? value : JSON.stringify(value)),
      applyOperation: (input) =>
        Effect.succeed({
          file: { path: input.file.path, content: input.file.content.toUpperCase() },
          result: { changed: true },
        }),
    };
    const layer = makeSchemaIdeFileTypeRegistryLayer([customPlugin]);

    const inspection = await Effect.runPromise(
      inspectFileServiceEffect({ path: "note.custom", content: "hello" }).pipe(
        Effect.provide(layer),
      ),
    );
    const operation = await Effect.runPromise(
      applyFileTypeOperationServiceEffect({
        file: { path: "note.custom", content: "hello" },
        operation: "uppercase",
        args: {},
      }).pipe(Effect.provide(layer)),
    );

    expect(inspection).toMatchObject({
      fileType: "custom",
      parsedData: { text: "hello" },
      operations: [{ name: "uppercase" }],
    });
    expect(operation).toEqual({
      file: { path: "note.custom", content: "HELLO" },
      result: { changed: true },
    });
  });

  it("validates file type operation outputs when an output schema is defined", async () => {
    const customPlugin: SchemaIdeFileTypePlugin = {
      id: "custom",
      label: "Custom",
      extensions: [".custom"],
      operations: [
        {
          name: "bad_output",
          description: "Return invalid output.",
          mutates: true,
          outputSchema: Schema.Struct({ changed: Schema.Boolean }),
        },
      ],
      parse: (text) => Effect.succeed({ success: true, value: { text } }),
      applyOperation: (input) =>
        Effect.succeed({
          file: input.file,
          result: { changed: "yes" },
        }),
    };
    const layer = makeSchemaIdeFileTypeRegistryLayer([customPlugin]);

    await expect(
      Effect.runPromise(
        applyFileTypeOperationServiceEffect({
          file: { path: "note.custom", content: "hello" },
          operation: "bad_output",
          args: {},
        }).pipe(Effect.provide(layer)),
      ),
    ).rejects.toThrow("Invalid custom operation output for bad_output");
  });

  it("inspects PDF metadata and applies annotation widgets", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([200, 100]);
    const content = bytesToBase64(await pdf.save());
    const file = { path: "forms/intake.pdf", content };

    const inspection = await Effect.runPromise(inspectFileEffect(file));
    expect(inspection).toMatchObject({
      fileType: "pdf",
      parsedData: {
        kind: "pdf",
        pageCount: 1,
        pages: [{ page: 1, width: 200, height: 100 }],
        fields: [],
      },
    });
    expect(inspection.operations.map((operation) => operation.name)).toEqual([
      "update_form_annotations",
      "render_page_screenshot",
    ]);

    const updated = await Effect.runPromise(
      applyFileTypeOperationEffect({
        file,
        operation: "update_form_annotations",
        args: {
          annotationDoc: {
            formName: "intake",
            pages: [
              {
                page: 1,
                width: 200,
                height: 100,
                annotations: [
                  {
                    id: "name",
                    type: "text",
                    label: "Name",
                    bbox: { x: 10, y: 20, width: 80, height: 12 },
                    required: true,
                  },
                ],
              },
            ],
          },
        },
      }),
    );

    const updatedInspection = await Effect.runPromise(inspectFileEffect(updated.file));
    expect(updated.result).toMatchObject({
      operation: "update_form_annotations",
      annotationCount: 1,
      fieldsCreated: ["annotation.page_1.name"],
    });
    expect(updatedInspection).toMatchObject({
      parsedData: {
        fields: [
          {
            name: "annotation.page_1.name",
            type: "text",
            required: true,
            widgets: [
              {
                page: 1,
                rect: { x: 10, y: 68, width: 80, height: 12 },
                screenshotRect: { x: 10, y: 20, width: 80, height: 12 },
              },
            ],
          },
        ],
      },
    });

    await expect(
      Effect.runPromise(
        applyFileTypeOperationEffect({
          file: updated.file,
          operation: "render_page_screenshot",
          args: { page: 1, scale: 1 },
        }),
      ),
    ).rejects.toThrow("PDF page screenshot rendering requires a host renderer");
  });

  it("validates cross-file workspace references", () => {
    const FormSchema = Schema.Struct({
      id: Schema.String,
      fields: Schema.Array(Schema.Struct({ id: Schema.String })),
    });
    const PolicySchema = Schema.Struct({
      id: Schema.String,
      formId: Schema.String,
      requiredFieldIds: Schema.Array(Schema.String),
    });
    const WorkspaceSchema = Workspace.Struct({
      forms: Workspace.files("forms/*.json", FormSchema).pipe(Workspace.indexBy("id")),
      policies: Workspace.files("policies/*.json", PolicySchema).pipe(Workspace.indexBy("id")),
    }).pipe(
      Workspace.validate<any>("refs", ({ forms, policies }, issue) => {
        for (const policy of policies.values()) {
          const form = forms.get(policy.formId);
          if (!form) continue;
          for (const fieldId of policy.requiredFieldIds) {
            if (!form.fields.some((field: { readonly id: string }) => field.id === fieldId)) {
              issue.at(`policies.${policy.id}.requiredFieldIds`, `Unknown field: ${fieldId}`);
            }
          }
        }
      }),
    );

    const result = validateSchemaIdeValue({
      schema: WorkspaceSchema,
      activeFile: "policies/check.json",
      activeFormat: "json",
      files: [
        { path: "forms/consent.json", content: '{"id":"consent","fields":[{"id":"name"}]}' },
        {
          path: "policies/check.json",
          content: '{"id":"check","formId":"consent","requiredFieldIds":["name","signature"]}',
        },
      ],
    });

    expect(result.summary.valid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.message)).toContain(
      "Unknown field: signature",
    );
    expect(
      result.diagnostics.find((diagnostic) => diagnostic.message === "Unknown field: signature"),
    ).toMatchObject({
      path: "policies/check.json",
      documentPath: "policies.check.requiredFieldIds",
      line: 1,
    });
  });

  it("preserves workspace route ids and decoded file types at the type level", () => {
    const ActionSchema = Schema.Struct({
      id: Schema.String,
      label: Schema.String,
    });
    const WorkflowSchema = Schema.Struct({
      id: Schema.String,
      actionIds: Schema.Array(Schema.String),
    });
    type Action = typeof ActionSchema.Type;
    type Workflow = typeof WorkflowSchema.Type;

    const WorkspaceSchema = Workspace.Struct({
      actions: Workspace.files("actions/*.json", ActionSchema).pipe(
        Workspace.annotations({ identifier: "Actions" }),
        Workspace.indexBy("id"),
      ),
      workflows: Workspace.files("workflows/*.json", WorkflowSchema).pipe(
        Workspace.values(),
        Workspace.annotations({ identifier: "Workflows" }),
      ),
    });

    expectTypeOf<WorkspaceRoutes<typeof WorkspaceSchema>>().toEqualTypeOf<{
      Actions: Action;
      Workflows: Workflow;
    }>();
    expect(WorkspaceSchema.reflect().map((schema) => schema.id)).toEqual(["Actions", "Workflows"]);
  });

  it("tracks workspace revisions and supports undo and redo", () => {
    const initialFiles = [{ path: "config.json", content: '{"name":"Demo","enabled":true}' }];
    const workspace = createVersionedWorkspace(initialFiles);

    const edited = applyWorkspaceChange(
      workspace,
      { type: "writeFile", path: "config.json", content: '{"name":"Edited","enabled":true}' },
      { actor: "user", label: "Save config.json", timestamp: 1 },
    );

    expect(edited.files).toEqual([
      { path: "config.json", content: '{"name":"Edited","enabled":true}' },
    ]);
    expect(edited.revisions).toHaveLength(1);
    expect(edited.revisions[0]).toMatchObject({
      id: "rev-1",
      actor: "user",
      label: "Save config.json",
      patch: {
        type: "writeFile",
        path: "config.json",
        before: initialFiles[0],
        after: { path: "config.json", content: '{"name":"Edited","enabled":true}' },
      },
    });

    const undone = undoWorkspaceChange(edited);
    expect(undone.files).toEqual(initialFiles);
    expect(undone.cursor).toBe(-1);

    const redone = redoWorkspaceChange(undone);
    expect(redone.files).toEqual(edited.files);
    expect(redone.cursor).toBe(0);
  });

  it("truncates redo revisions after a new edit", () => {
    const workspace = createVersionedWorkspace([{ path: "a.json", content: "{}\n" }]);
    const first = applyWorkspaceChange(
      workspace,
      { type: "writeFile", path: "a.json", content: '{"step":1}\n' },
      { actor: "user", label: "Save a.json", timestamp: 1 },
    );
    const second = applyWorkspaceChange(
      first,
      { type: "writeFile", path: "a.json", content: '{"step":2}\n' },
      { actor: "agent", label: "write_file a.json", turnId: "turn-1", toolCallId: "call-1" },
    );

    const afterUndo = undoWorkspaceChange(second);
    const branched = applyWorkspaceChange(
      afterUndo,
      { type: "createFile", path: "b.json", content: "{}\n" },
      { actor: "user", label: "Create b.json", timestamp: 3 },
    );

    expect(branched.revisions.map((revision) => revision.label)).toEqual([
      "Save a.json",
      "Create b.json",
    ]);
    expect(redoWorkspaceChange(branched)).toBe(branched);
  });

  it("records agent turn and tool call metadata on revisions", () => {
    const workspace = createVersionedWorkspace([]);
    const next = applyWorkspaceChange(
      workspace,
      { type: "createFile", path: "forms/intake.yaml", content: "id: intake\n" },
      {
        actor: "agent",
        label: "create_file forms/intake.yaml",
        turnId: "turn-123",
        toolCallId: "tool-456",
      },
    );

    expect(next.revisions[0]).toMatchObject({
      actor: "agent",
      label: "create_file forms/intake.yaml",
      turnId: "turn-123",
      toolCallId: "tool-456",
    });
  });

  it("derives completions, hover, and quick fixes from generated JSON Schema", () => {
    const schema = Schema.Struct({
      id: Schema.String.annotate({ description: "Stable identifier" }),
      kind: Schema.Literal("survey", "workflow"),
      enabled: Schema.Boolean,
    }).annotate({ title: "Config" });
    const files = [{ path: "config.json", content: '{"id":"demo"}\n' }];
    const validation = validateSchemaIdeValue({
      schema,
      files,
      activeFile: "config.json",
      activeFormat: "json",
    });
    const reflection = createReflection({
      schema,
      files,
      activeFile: "config.json",
      activeFormat: "json",
      validation,
    });

    expect(reflection.activeJsonSchema).toMatchObject({
      type: "object",
      required: ["id", "kind", "enabled"],
    });

    expect(
      getSchemaIdeCompletions({
        reflection,
        path: "config.json",
        content: files[0]!.content,
      })?.options.map((option) => option.label),
    ).toEqual(["kind", "enabled"]);

    expect(
      getSchemaIdeHover({
        reflection,
        path: "config.json",
        content: files[0]!.content,
        offset: files[0]!.content.indexOf("id") + 1,
      })?.content,
    ).toContain("Stable identifier");

    expect(
      getSchemaIdeQuickFixes({
        reflection,
        path: "config.json",
        content: files[0]!.content,
      }).map((fix) => fix.title),
    ).toEqual(['Add required field "kind"', 'Add required field "enabled"']);
  });

  it("builds schema-driven cross-file definition and reference locations", () => {
    const FormSchema = Schema.Struct({ id: Schema.String });
    const PolicySchema = Schema.Struct({ id: Schema.String, formId: Schema.String });
    const WorkspaceSchema = Workspace.Struct({
      forms: Workspace.files("forms/*.json", FormSchema),
      policies: Workspace.files("policies/*.json", PolicySchema),
    });
    const files = [
      { path: "forms/intake.json", content: '{"id":"intake"}\n' },
      { path: "policies/check.json", content: '{"id":"check","formId":"intake"}\n' },
    ];
    const validation = validateSchemaIdeValue({
      schema: WorkspaceSchema,
      files,
      activeFile: "policies/check.json",
      activeFormat: "json",
    });
    const reflection = createReflection({
      schema: WorkspaceSchema,
      files,
      activeFile: "policies/check.json",
      activeFormat: "json",
      validation,
    });

    const offset = files[1]!.content.lastIndexOf("intake") + 1;
    expect(
      getSchemaIdeDefinitions({
        reflection,
        path: "policies/check.json",
        content: files[1]!.content,
        offset,
      }).map((definition) => definition.path),
    ).toEqual(["forms/intake.json"]);
  });
});

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(offset, offset + chunkSize));
  }
  return btoa(binary);
}
