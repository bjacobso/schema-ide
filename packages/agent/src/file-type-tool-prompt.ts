import type { SchemaIdeFileTypeRegistryService } from "@schema-ide/core";
import {
  BuiltInFileTypeDefinitions,
  OperationDef,
  type SchemaIdeFileTypeDefinition,
} from "@schema-ide/core/file-type-definitions";

export const SchemaIdeFileTypeToolSystemPrompt = [
  "File type plugin workflow:",
  "- Use get_file_type_tools with a path or fileType before applying file-type-specific operations.",
  "- Use inspect_file when you need parsed data, PDF page metadata, form fields, widget rectangles, or parse diagnostics.",
  "- Use apply_file_type_operation only with an operation returned by get_file_type_tools or inspect_file.",
  "- For JSON/YAML structural edits, prefer apply_file_type_operation with json_patch over whole-file rewrites.",
  "- For PDFs, inspect_file returns page and AcroForm metadata. update_form_annotations expects an annotationDoc with page bboxes; default bboxes use screenshot pixels with top-left origin.",
  "- render_page_screenshot is a host-renderer contract. If it reports that no renderer is installed, explain that a PDF rasterizer must be wired by the host.",
].join("\n");

export function fileTypeToolHelp({
  plugin,
  path,
}: {
  readonly plugin: SchemaIdeFileTypeDefinition;
  readonly path?: string | undefined;
}): {
  readonly plugin: {
    readonly id: string;
    readonly label: string;
    readonly extensions: readonly string[];
    readonly mediaTypes: readonly string[];
  };
  readonly operations: readonly unknown[];
  readonly tools: readonly unknown[];
  readonly instructions: readonly string[];
} {
  return {
    plugin: {
      id: plugin.id,
      label: plugin.label,
      extensions: plugin.extensions,
      mediaTypes: plugin.mediaTypes ?? [],
    },
    operations: (plugin.operations ?? []).map(OperationDef.toJson),
    tools: [
      ...(path
        ? [
            {
              name: "inspect_file",
              args: { path },
              useWhen:
                "Need parsed data, metadata, diagnostics, or operation details for this file.",
            },
          ]
        : []),
      {
        name: "apply_file_type_operation",
        args: path
          ? { path, operation: "<operation name>", args: "<operation args>" }
          : { path: "<file path>", operation: "<operation name>", args: "<operation args>" },
        useWhen: "Need to run a structured operation exposed by this file type.",
      },
    ],
    instructions: instructionsForPlugin(plugin),
  };
}

export function fileTypeDefinitionForLookup({
  path,
  fileType,
  definitions = BuiltInFileTypeDefinitions,
}: {
  readonly path?: string | undefined;
  readonly fileType?: string | undefined;
  readonly definitions?: readonly SchemaIdeFileTypeDefinition[] | undefined;
}): SchemaIdeFileTypeDefinition | null {
  if (path) {
    const lower = path.toLowerCase();
    return (
      definitions.find((definition) =>
        definition.extensions.some((extension) => lower.endsWith(extension)),
      ) ?? null
    );
  }
  if (fileType) return definitions.find((definition) => definition.id === fileType) ?? null;
  return null;
}

export function fileTypePluginForLookup({
  path,
  fileType,
  registry,
}: {
  readonly path?: string | undefined;
  readonly fileType?: string | undefined;
  readonly registry: SchemaIdeFileTypeRegistryService;
}): SchemaIdeFileTypeDefinition | null {
  if (path) return registry.pluginForPath(path);
  if (fileType) return registry.plugins.find((plugin) => plugin.id === fileType) ?? null;
  return null;
}

function instructionsForPlugin(plugin: SchemaIdeFileTypeDefinition): readonly string[] {
  if (plugin.id === "pdf") {
    return [
      "Call inspect_file first to get page sizes, existing fields, and widget rectangles.",
      "PDF widget rects use bottom-left PDF points. screenshotRect uses top-left screenshot pixels.",
      "update_form_annotations defaults to screenshot-pixels and converts bbox with pdfY = pageHeight - y - height.",
      "Use render_page_screenshot only when the host has wired a PDF renderer.",
    ];
  }

  if (plugin.id === "json" || plugin.id === "yaml") {
    return [
      "Call inspect_file to parse the document and surface syntax errors.",
      "Use json_patch for structural add, replace, and remove edits.",
      "Validate the workspace after mutating files.",
    ];
  }

  return [
    "Call inspect_file to learn the parsed shape, metadata, diagnostics, and available operations.",
    "Use only operation names returned by this lookup or inspect_file.",
  ];
}
