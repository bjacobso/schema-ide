import { describe, expect, expectTypeOf, it } from "vitest";
import { Schema } from "effect";
import {
  diagnosticsForSchemaIdeFile,
  getSchemaIdeFileDiagnosticCounts,
  resolveSchemaIdePreview,
  SchemaIde,
  type SchemaIdePreviewComponentProps,
  type SchemaIdePreviewRegistration,
  type SchemaIdePreviewRegistrationForRoutes,
} from "../src";
import {
  Workspace,
  type SchemaIdeInputSchema,
  type SchemaIdeReflection,
  type WorkspaceRoutes,
} from "@schema-ide/core";

describe("schema-ide-react", () => {
  it("exports the SchemaIde component", () => {
    expect(SchemaIde).toBeTypeOf("function");
  });

  it("resolves previews by active file schema id", () => {
    const previews = [
      makePreview("workflow-graph", "Workflows", "Workflow"),
      makePreview("action-card", "Actions", "Action"),
    ];

    const resolution = resolveSchemaIdePreview({
      previews,
      reflection: makeReflection(),
      file: { path: "workflows/onboarding.json", content: "{}" },
    });

    expect(resolution?.schemaId).toBe("Workflows");
    expect(resolution?.selected.id).toBe("workflow-graph");
    expect(resolution?.jsonSchema).toEqual({ type: "object", title: "Workflow" });
  });

  it("honors a selected preview when multiple previews match", () => {
    const previews = [
      makePreview("workflow-graph", "Workflows", "Workflow Graph"),
      makePreview("workflow-summary", "Workflows", "Workflow Summary"),
    ];

    const resolution = resolveSchemaIdePreview({
      previews,
      reflection: makeReflection(),
      file: { path: "workflows/onboarding.json", content: "{}" },
      selectedPreviewId: "workflow-summary",
    });

    expect(resolution?.previews.map((preview) => preview.id)).toEqual([
      "workflow-graph",
      "workflow-summary",
    ]);
    expect(resolution?.selected.id).toBe("workflow-summary");
  });

  it("does not resolve previews for unmatched files", () => {
    const resolution = resolveSchemaIdePreview({
      previews: [makePreview("workflow-graph", "Workflows", "Workflow")],
      reflection: makeReflection(),
      file: { path: "notes/readme.md", content: "# Notes" },
    });

    expect(resolution).toBeNull();
  });

  it("scopes diagnostics and counts to concrete files", () => {
    const diagnostics = [
      {
        path: "workflows/onboarding.json",
        severity: "error" as const,
        source: "cross-file" as const,
        message: "Unknown action",
      },
      {
        path: "actions/email.json",
        severity: "warning" as const,
        source: "workspace" as const,
        message: "Unused action",
      },
      {
        path: null,
        severity: "error" as const,
        source: "workspace" as const,
        message: "Global workspace error",
      },
    ];

    expect(diagnosticsForSchemaIdeFile(diagnostics, "workflows/onboarding.json")).toEqual([
      diagnostics[0],
    ]);
    expect(diagnosticsForSchemaIdeFile(diagnostics, "actions/email.json")).toEqual([
      diagnostics[1],
    ]);

    const counts = getSchemaIdeFileDiagnosticCounts(diagnostics);
    expect(counts.get("workflows/onboarding.json")).toEqual({
      errors: 1,
      warnings: 0,
      infos: 0,
    });
    expect(counts.get("actions/email.json")).toEqual({
      errors: 0,
      warnings: 1,
      infos: 0,
    });
    expect(counts.has("")).toBe(false);
  });

  it("types preview registrations from workspace route ids", () => {
    const WorkflowSchema = Schema.Struct({
      id: Schema.String,
      actionIds: Schema.Array(Schema.String),
    });
    type Workflow = typeof WorkflowSchema.Type;

    const WorkspaceSchema = Workspace.Struct({
      workflows: Workspace.files("workflows/*.json", WorkflowSchema).pipe(
        Workspace.values(),
        Workspace.annotations({ identifier: "Workflows" }),
      ),
    });
    type Routes = WorkspaceRoutes<typeof WorkspaceSchema>;

    const WorkflowPreview = (_props: SchemaIdePreviewComponentProps<Workflow, "Workflows">) => null;
    const previews = [
      {
        id: "workflow-preview",
        schemaId: "Workflows",
        label: "Workflow",
        component: WorkflowPreview,
      },
    ] satisfies readonly SchemaIdePreviewRegistrationForRoutes<Routes>[];

    expectTypeOf<Routes>().toEqualTypeOf<{ Workflows: Workflow }>();
    expectTypeOf(previews[0]!.component).parameter(0).toMatchTypeOf<{
      readonly value: Workflow | null;
      readonly schemaId: "Workflows";
    }>();
    expectTypeOf(WorkspaceSchema).toMatchTypeOf<SchemaIdeInputSchema<unknown, Routes>>();
  });
});

function makePreview(id: string, schemaId: string, label: string): SchemaIdePreviewRegistration {
  return {
    id,
    schemaId,
    label,
    component: () => null,
  };
}

function makeReflection(): SchemaIdeReflection {
  return {
    mode: "workspace",
    activeFile: "workflows/onboarding.json",
    activeFormat: "json",
    files: [
      { path: "actions/email.json", content: "{}" },
      { path: "workflows/onboarding.json", content: "{}" },
      { path: "notes/readme.md", content: "# Notes" },
    ],
    schemas: [
      {
        id: "Actions",
        jsonSchema: { type: "object", title: "Action" },
      },
      {
        id: "Workflows",
        jsonSchema: { type: "object", title: "Workflow" },
      },
    ],
    activeJsonSchema: { type: "object", title: "Workflow" },
    decodedValue: null,
    diagnostics: [],
    validationSummary: {
      valid: true,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
    },
    routeMatches: [
      {
        path: "actions/email.json",
        schemaId: "Actions",
        format: "json",
      },
      {
        path: "workflows/onboarding.json",
        schemaId: "Workflows",
        format: "json",
      },
      {
        path: "notes/readme.md",
        schemaId: null,
        format: "json",
      },
    ],
  };
}
