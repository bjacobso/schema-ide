import { Effect, Schema } from "effect";
import { Tool, Toolkit } from "effect/unstable/ai";
import {
  applyFileTypeOperationEffect,
  BuiltInFileTypeRegistry,
  inspectFileEffect,
} from "@schema-ide/core";
import {
  fileTypePluginForLookup,
  fileTypeToolHelp,
  SchemaIdeFileTypeToolSystemPrompt,
} from "./file-type-tool-prompt";
import { OperationDef } from "@schema-ide/core/file-type-definitions";
import type { SchemaIdeToolRuntime } from "./types";
import type { OpenRouterToolDefinition } from "@schema-ide/protocol";

export interface SchemaIdeToolExecution {
  readonly args: Record<string, unknown>;
  readonly result: unknown;
  readonly isError: boolean;
}

const ToolFailure = Schema.Struct({
  error: Schema.String,
});

const ValidationSummary = Schema.Struct({
  valid: Schema.Boolean,
  errorCount: Schema.Number,
  warningCount: Schema.Number,
  infoCount: Schema.Number,
});

const MutationResult = Schema.Struct({
  success: Schema.Boolean,
  path: Schema.String,
  validation: ValidationSummary,
});

const FileEdit = Schema.Struct({
  path: Schema.String.annotate({ description: "Workspace path to write." }),
  content: Schema.String.annotate({ description: "Complete file content after the edit." }),
  create: Schema.optional(
    Schema.Boolean.annotate({
      description: "When true, the path must not exist before the edit.",
    }),
  ),
});

const MultiEditResult = Schema.Struct({
  success: Schema.Boolean,
  changedPaths: Schema.Array(Schema.String),
  validation: ValidationSummary,
});

const FileTypeOperationResult = Schema.Struct({
  success: Schema.Boolean,
  path: Schema.String,
  operation: Schema.String,
  result: Schema.Unknown,
  validation: ValidationSummary,
});

export const FileTypeToolSystemPrompt = SchemaIdeFileTypeToolSystemPrompt;

export const ListFilesTool = Tool.make("list_files", {
  description: "List all in-memory files in the Schema IDE workspace.",
  success: Schema.Struct({
    files: Schema.Array(Schema.String),
    count: Schema.Number,
  }),
  failure: ToolFailure,
  failureMode: "return",
});

export const ReadFileTool = Tool.make("read_file", {
  description: "Read one in-memory file by path.",
  parameters: Schema.Struct({
    path: Schema.String.annotate({ description: "Path of the file to read." }),
  }),
  success: Schema.Struct({
    path: Schema.String,
    content: Schema.String,
  }),
  failure: ToolFailure,
  failureMode: "return",
});

export const GrepFilesTool = Tool.make("grep_files", {
  description:
    "Search all in-memory files for a literal string and return matching lines with paths and line numbers.",
  parameters: Schema.Struct({
    query: Schema.String.annotate({ description: "Literal text to search for." }),
  }),
  success: Schema.Struct({
    matches: Schema.Array(
      Schema.Struct({
        path: Schema.String,
        line: Schema.Number,
        content: Schema.String,
      }),
    ),
    count: Schema.Number,
  }),
  failure: ToolFailure,
  failureMode: "return",
});

export const ListFileTypePluginsTool = Tool.make("list_file_type_plugins", {
  description:
    "List registered file type plugins and the operations each plugin can perform on matching files.",
  success: Schema.Struct({
    plugins: Schema.Array(Schema.Unknown),
  }),
  failure: ToolFailure,
  failureMode: "return",
});

export const GetFileTypeToolsTool = Tool.make("get_file_type_tools", {
  description:
    "Look up the file type plugin, agent workflow instructions, and available structured operations for a file path or file type id.",
  parameters: Schema.Struct({
    path: Schema.optional(
      Schema.String.annotate({
        description: "Workspace path whose file type tools should be returned.",
      }),
    ),
    fileType: Schema.optional(
      Schema.String.annotate({
        description: "File type id such as json, yaml, or pdf. Used when path is omitted.",
      }),
    ),
  }),
  success: Schema.Struct({
    lookup: Schema.Unknown,
  }),
  failure: ToolFailure,
  failureMode: "return",
});

export const InspectFileTool = Tool.make("inspect_file", {
  description:
    "Inspect a file using its registered file type plugin. Returns parsed data, parse diagnostics, metadata, and available operations.",
  parameters: Schema.Struct({
    path: Schema.String.annotate({ description: "Path of the file to inspect." }),
  }),
  success: Schema.Struct({
    inspection: Schema.Unknown,
  }),
  failure: ToolFailure,
  failureMode: "return",
});

export const CreateFileTool = Tool.make("create_file", {
  description: "Create a new in-memory file. Fails if the path already exists.",
  parameters: Schema.Struct({
    path: Schema.String.annotate({ description: "Path for the new file." }),
    content: Schema.String.annotate({ description: "Complete file content." }),
  }),
  success: MutationResult,
  failure: ToolFailure,
  failureMode: "return",
});

export const WriteFileTool = Tool.make("write_file", {
  description:
    "Replace the complete content of an existing in-memory file. Use create_file for new files.",
  parameters: Schema.Struct({
    path: Schema.String.annotate({ description: "Path of the file to replace." }),
    content: Schema.String.annotate({ description: "Complete replacement file content." }),
  }),
  success: MutationResult,
  failure: ToolFailure,
  failureMode: "return",
});

export const ReplaceFileContentTool = Tool.make("replace_file_content", {
  description:
    "Replace a literal text span inside an existing in-memory file. Use this for focused edits.",
  parameters: Schema.Struct({
    path: Schema.String.annotate({ description: "Path of the file to edit." }),
    search: Schema.String.annotate({ description: "Exact text to replace." }),
    replace: Schema.String.annotate({ description: "Replacement text." }),
    replaceAll: Schema.optional(
      Schema.Boolean.annotate({
        description: "When true, replace every occurrence. Defaults to false.",
      }),
    ),
  }),
  success: MutationResult,
  failure: ToolFailure,
  failureMode: "return",
});

export const ValidateWorkspaceTool = Tool.make("validate_workspace", {
  description: "Validate the current in-memory files with the active Effect Schema.",
  success: Schema.Struct({
    summary: ValidationSummary,
    diagnostics: Schema.Array(Schema.Unknown),
    routeMatches: Schema.Array(Schema.Unknown),
  }),
  failure: ToolFailure,
  failureMode: "return",
});

export const GetJsonSchemaTool = Tool.make("get_json_schema", {
  description:
    "Return the generated JSON Schema for the active file or for a specific schema route id.",
  parameters: Schema.Struct({
    schemaId: Schema.optional(
      Schema.String.annotate({
        description: "Optional schema route id. Omit to get the active file schema.",
      }),
    ),
  }),
  success: Schema.Struct({
    schema: Schema.Unknown,
  }),
  failure: ToolFailure,
  failureMode: "return",
});

export const GetDiagnosticsTool = Tool.make("get_diagnostics", {
  description: "Return the current structured diagnostics without mutating files.",
  success: Schema.Struct({
    diagnostics: Schema.Array(Schema.Unknown),
    validation: ValidationSummary,
  }),
  failure: ToolFailure,
  failureMode: "return",
});

export const ApplyEditsTool = Tool.make("apply_edits", {
  description:
    "Atomically apply complete-file edits. The whole batch is rejected if validation fails.",
  parameters: Schema.Struct({
    edits: Schema.Array(FileEdit),
    validate: Schema.optional(
      Schema.Boolean.annotate({
        description: "Validate before committing. Defaults to true.",
      }),
    ),
  }),
  success: MultiEditResult,
  failure: ToolFailure,
  failureMode: "return",
});

export const ApplyFileTypeOperationTool = Tool.make("apply_file_type_operation", {
  description:
    "Apply a named operation exposed by the file's registered file type plugin, such as json_patch for JSON or YAML files.",
  parameters: Schema.Struct({
    path: Schema.String.annotate({ description: "Path of the file to update." }),
    operation: Schema.String.annotate({ description: "Plugin operation name to run." }),
    args: Schema.Unknown.annotate({
      description: "Operation-specific arguments. Inspect the file or list plugins first.",
    }),
    validate: Schema.optional(
      Schema.Boolean.annotate({
        description: "Validate before committing. Defaults to true.",
      }),
    ),
  }),
  success: FileTypeOperationResult,
  failure: ToolFailure,
  failureMode: "return",
});

export const ProposePatchTool = Tool.make("propose_patch", {
  description:
    "Prepare a multi-file patch for user approval without mutating the workspace. Use this in plan mode.",
  parameters: Schema.Struct({
    label: Schema.String.annotate({ description: "Short human-readable proposal label." }),
    edits: Schema.Array(FileEdit),
  }),
  success: Schema.Struct({
    id: Schema.String,
    label: Schema.String,
    changedPaths: Schema.Array(Schema.String),
    validation: ValidationSummary,
    diagnostics: Schema.Array(Schema.Unknown),
  }),
  failure: ToolFailure,
  failureMode: "return",
});

export const SchemaIdeToolkit = Toolkit.make(
  ListFilesTool,
  ReadFileTool,
  GrepFilesTool,
  ListFileTypePluginsTool,
  GetFileTypeToolsTool,
  InspectFileTool,
  CreateFileTool,
  WriteFileTool,
  ReplaceFileContentTool,
  ValidateWorkspaceTool,
  GetJsonSchemaTool,
  GetDiagnosticsTool,
  ApplyEditsTool,
  ApplyFileTypeOperationTool,
  ProposePatchTool,
);

type SchemaIdeToolEntry = {
  readonly tool: Tool.Any;
  readonly handle: (
    tools: SchemaIdeToolRuntime,
    args: Record<string, unknown>,
  ) => unknown | Promise<unknown>;
};

const toolEntries = [
  {
    tool: ListFilesTool,
    handle: (tools) => {
      const files = tools.listFiles();
      return { files, count: files.length };
    },
  },
  {
    tool: ReadFileTool,
    handle: (tools, args) => {
      const { path } = args as Tool.Parameters<typeof ReadFileTool>;
      const file = tools.readFile(path);
      return file ?? { error: `File not found: ${path}` };
    },
  },
  {
    tool: GrepFilesTool,
    handle: (tools, args) => {
      const { query } = args as Tool.Parameters<typeof GrepFilesTool>;
      const matches = tools.searchFiles(query);
      return { matches, count: matches.length };
    },
  },
  {
    tool: ListFileTypePluginsTool,
    handle: (tools) => {
      const registry = tools.fileTypes ?? BuiltInFileTypeRegistry;
      return {
        plugins: registry.plugins.map((plugin) => ({
          id: plugin.id,
          label: plugin.label,
          extensions: plugin.extensions,
          mediaTypes: plugin.mediaTypes ?? [],
          operations: (plugin.operations ?? []).map(OperationDef.toJson),
        })),
      };
    },
  },
  {
    tool: GetFileTypeToolsTool,
    handle: (tools, args) => {
      const { path, fileType } = args as Tool.Parameters<typeof GetFileTypeToolsTool>;
      if (!path && !fileType) return { error: "Provide path or fileType." };
      const registry = tools.fileTypes ?? BuiltInFileTypeRegistry;
      const plugin = fileTypePluginForLookup({ path, fileType, registry });
      if (!plugin) return { error: `Unknown file type: ${fileType}` };
      return {
        lookup: {
          query: {
            ...(path ? { path } : {}),
            ...(fileType ? { fileType } : {}),
          },
          ...fileTypeToolHelp({ plugin, path }),
        },
      };
    },
  },
  {
    tool: InspectFileTool,
    handle: (tools, args) => {
      const { path } = args as Tool.Parameters<typeof InspectFileTool>;
      const file = tools.readFile(path);
      if (!file) return { error: `File not found: ${path}` };
      return Effect.runPromise(
        inspectFileEffect(file, { registry: tools.fileTypes ?? BuiltInFileTypeRegistry }),
      ).then((inspection) => ({
        inspection: {
          ...inspection,
          operations: inspection.operations.map(OperationDef.toJson),
        },
      }));
    },
  },
  {
    tool: CreateFileTool,
    handle: (tools, args) => {
      const { path, content } = args as Tool.Parameters<typeof CreateFileTool>;
      tools.createFile({ path, content });
      return { success: true, path, validation: tools.validateWorkspace().validationSummary };
    },
  },
  {
    tool: WriteFileTool,
    handle: (tools, args) => {
      const { path, content } = args as Tool.Parameters<typeof WriteFileTool>;
      if (!tools.readFile(path)) return { error: `File not found: ${path}` };
      tools.writeFile({ path, content });
      return { success: true, path, validation: tools.validateWorkspace().validationSummary };
    },
  },
  {
    tool: ReplaceFileContentTool,
    handle: (tools, args) => {
      const { path, search, replace, replaceAll } = args as Tool.Parameters<
        typeof ReplaceFileContentTool
      >;
      const file = tools.readFile(path);
      if (!file) return { error: `File not found: ${path}` };
      if (!file.content.includes(search)) {
        return { error: `Search text not found in ${path}` };
      }

      const content =
        replaceAll === true
          ? file.content.split(search).join(replace)
          : file.content.replace(search, replace);
      tools.writeFile({ path, content });
      return { success: true, path, validation: tools.validateWorkspace().validationSummary };
    },
  },
  {
    tool: ValidateWorkspaceTool,
    handle: (tools) => {
      const reflection = tools.validateWorkspace();
      return {
        summary: reflection.validationSummary,
        diagnostics: reflection.diagnostics,
        routeMatches: reflection.routeMatches,
      };
    },
  },
  {
    tool: GetJsonSchemaTool,
    handle: (tools, args) => {
      const { schemaId } = args as Tool.Parameters<typeof GetJsonSchemaTool>;
      return { schema: tools.getJsonSchema(schemaId ?? null) };
    },
  },
  {
    tool: GetDiagnosticsTool,
    handle: (tools) => {
      const reflection = tools.validateWorkspace();
      return {
        diagnostics: reflection.diagnostics,
        validation: reflection.validationSummary,
      };
    },
  },
  {
    tool: ApplyEditsTool,
    handle: (tools, args) => {
      const { edits, validate } = args as Tool.Parameters<typeof ApplyEditsTool>;
      return {
        success: true,
        ...tools.applyEdits(edits, { validate }),
      };
    },
  },
  {
    tool: ApplyFileTypeOperationTool,
    handle: (tools, args) => {
      const { path, operation, validate } = args as Tool.Parameters<
        typeof ApplyFileTypeOperationTool
      >;
      const file = tools.readFile(path);
      if (!file) return { error: `File not found: ${path}` };

      const operationArgs = isRecord(args["args"]) ? args["args"] : {};
      return Effect.runPromise(
        applyFileTypeOperationEffect(
          { file, operation, args: operationArgs },
          { registry: tools.fileTypes ?? BuiltInFileTypeRegistry },
        ),
      ).then((result) => {
        const applied = tools.applyEdits([result.file], { validate });
        return {
          success: true,
          path,
          operation,
          result: result.result,
          validation: applied.validation,
        };
      });
    },
  },
  {
    tool: ProposePatchTool,
    handle: (tools, args) => {
      const { label, edits } = args as Tool.Parameters<typeof ProposePatchTool>;
      const proposal = tools.proposePatch(label, edits);
      return {
        id: proposal.id,
        label: proposal.label,
        changedPaths: proposal.edits.map((edit) => edit.path),
        validation: proposal.validation,
        diagnostics: proposal.diagnostics,
      };
    },
  },
] satisfies readonly SchemaIdeToolEntry[];

const toolRegistry = new Map<string, SchemaIdeToolEntry>(
  toolEntries.map((entry) => [entry.tool.name, entry]),
);

export const openRouterSchemaIdeTools: readonly OpenRouterToolDefinition[] = toolEntries.map(
  (entry) => ({
    type: "function",
    function: {
      name: entry.tool.name,
      description: getToolDescription(entry.tool),
      parameters: getToolJsonSchema(entry.tool),
    },
  }),
);

const planModeAllowedTools: ReadonlySet<string> = new Set([
  ListFilesTool.name,
  ReadFileTool.name,
  GrepFilesTool.name,
  ListFileTypePluginsTool.name,
  GetFileTypeToolsTool.name,
  InspectFileTool.name,
  ValidateWorkspaceTool.name,
  GetJsonSchemaTool.name,
  GetDiagnosticsTool.name,
  ProposePatchTool.name,
]);

export function openRouterSchemaIdeToolsForMode({
  planMode = false,
}: {
  readonly planMode?: boolean | undefined;
} = {}): readonly OpenRouterToolDefinition[] {
  if (!planMode) return openRouterSchemaIdeTools;
  return openRouterSchemaIdeTools.filter((tool) => planModeAllowedTools.has(tool.function.name));
}

export function decodeSchemaIdeToolArgs(
  name: string,
  rawArguments: string,
):
  | { readonly args: Record<string, unknown> }
  | { readonly error: string; readonly args: Record<string, unknown> } {
  const entry = toolRegistry.get(name);
  if (!entry) return { error: `Unknown tool: ${name}`, args: {} };

  let raw: unknown;
  try {
    raw = rawArguments.trim() ? JSON.parse(rawArguments) : {};
  } catch (error) {
    return {
      error: `Invalid JSON arguments for ${name}: ${error instanceof Error ? error.message : String(error)}`,
      args: { rawArguments },
    };
  }

  try {
    const args = Schema.decodeUnknownSync(entry.tool.parametersSchema as any)(raw);
    return { args: args as Record<string, unknown> };
  } catch (error) {
    return {
      error: `Invalid arguments for ${name}: ${error instanceof Error ? error.message : String(error)}`,
      args: isRecord(raw) ? raw : { rawArguments },
    };
  }
}

export function executeSchemaIdeToolCall(
  tools: SchemaIdeToolRuntime,
  name: string,
  rawArguments: string,
  options: { readonly planMode?: boolean | undefined } = {},
): SchemaIdeToolExecution {
  if (options.planMode && !planModeAllowedTools.has(name)) {
    return {
      args: {},
      result: {
        error: `Tool ${name} is disabled in plan mode. Use propose_patch for edits.`,
      },
      isError: true,
    };
  }

  const decoded = decodeSchemaIdeToolArgs(name, rawArguments);
  if ("error" in decoded) {
    return { args: decoded.args, result: { error: decoded.error }, isError: true };
  }

  const entry = toolRegistry.get(name);
  if (!entry) {
    return { args: decoded.args, result: { error: `Unknown tool: ${name}` }, isError: true };
  }

  try {
    const result = entry.handle(tools, decoded.args);
    if (isPromiseLike(result)) {
      return {
        args: decoded.args,
        result: { error: `Tool ${name} is asynchronous. Use executeSchemaIdeToolCallAsync.` },
        isError: true,
      };
    }
    return { args: decoded.args, result, isError: isToolError(result) };
  } catch (error) {
    return {
      args: decoded.args,
      result: { error: error instanceof Error ? error.message : String(error) },
      isError: true,
    };
  }
}

export async function executeSchemaIdeToolCallAsync(
  tools: SchemaIdeToolRuntime,
  name: string,
  rawArguments: string,
  options: { readonly planMode?: boolean | undefined } = {},
): Promise<SchemaIdeToolExecution> {
  if (options.planMode && !planModeAllowedTools.has(name)) {
    return {
      args: {},
      result: {
        error: `Tool ${name} is disabled in plan mode. Use propose_patch for edits.`,
      },
      isError: true,
    };
  }

  const decoded = decodeSchemaIdeToolArgs(name, rawArguments);
  if ("error" in decoded) {
    return { args: decoded.args, result: { error: decoded.error }, isError: true };
  }

  const entry = toolRegistry.get(name);
  if (!entry) {
    return { args: decoded.args, result: { error: `Unknown tool: ${name}` }, isError: true };
  }

  try {
    const result = await entry.handle(tools, decoded.args);
    return { args: decoded.args, result, isError: isToolError(result) };
  } catch (error) {
    return {
      args: decoded.args,
      result: { error: error instanceof Error ? error.message : String(error) },
      isError: true,
    };
  }
}

function isToolError(result: unknown): boolean {
  return isRecord(result) && typeof result["error"] === "string";
}

function getToolDescription(tool: Tool.Any): string {
  return Tool.getDescription(tool as any) ?? "";
}

function getToolJsonSchema(tool: Tool.Any): unknown {
  return Tool.getJsonSchema(tool as any);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return isRecord(value) && typeof value["then"] === "function";
}
