# File Type Plugins

Schema IDE file handling is split into a lightweight definition and an Effect runtime
implementation.

`SchemaIdeFileTypeDefinition` is safe to import for documentation, prompt generation, and
tool discovery. It contains only:

- id, label, extensions, and media types
- operation names, descriptions, mutation flags, and Effect parameter schemas

Import these definitions from the definition-only entrypoint:

```ts
import {
  BuiltInFileTypeDefinitions,
  PdfFileTypeDefinition,
} from "@schema-ide/core/file-type-definitions";
```

That entrypoint does not import the runtime plugin implementations or libraries such as `pdf-lib`.
Operation definitions are created with `OperationDef.make` and carry `parametersSchema` and
`outputSchema` values. Agent-facing JSON Schema is generated only when needed:

```ts
import { OperationDef, JsonPatchOperation } from "@schema-ide/core/file-type-definitions";

const operation = OperationDef.toJson(JsonPatchOperation);
// operation.parametersJsonSchema is derived from JsonPatchOperation.parametersSchema
// operation.outputJsonSchema is derived from JsonPatchOperation.outputSchema
```

Data contracts in definition modules are schema-first. For example, the PDF rectangle contract is
exported as both the Effect schema value and its derived TypeScript type:

```ts
export const PdfRect = Schema.Struct({ ... });
export type PdfRect = typeof PdfRect.Type;
```

`SchemaIdeFileTypePlugin` extends the definition with Effect-powered parsing, inspection,
serialization, and operation handlers. A plugin owns one file family:

- extension and media type matching
- parsing into structured data plus diagnostics
- serialization back to file content
- metadata extraction
- named operations that can update the file through structured arguments

Built-in implementations live in `packages/core/src/file-types/`, one file type per file:

- `json.ts`
- `pdf.ts`
- `yaml.ts`

Built-in definitions live in `packages/core/src/file-type-definitions/`, also one file type per
file:

- `json.ts`
- `pdf.ts`
- `yaml.ts`

Shared operation definitions live in `packages/core/src/file-type-operations/`.

Shared helpers that are not themselves file types live in `packages/core/src/file-type-support/`.

The core contract is Effect-based. Parsing invalid user content is not an Effect failure; it returns a normal inspection with diagnostics. Effect failures are reserved for runtime/plugin failures such as an unsupported operation.

## Built-ins

JSON, YAML, and PDF are registered as built-in file type plugins. JSON and YAML expose:

- parsed data through `inspectFileEffect` / `inspect_file`
- parse errors as structured diagnostics
- `json_patch`, an RFC 6902-style `add`, `replace`, and `remove` operation

PDF exposes:

- parsed metadata through `inspectFileEffect` / `inspect_file`
- page dimensions in PDF points
- AcroForm field and widget metadata
- `update_form_annotations`, which creates form widgets from an annotation document
- `render_page_screenshot`, a host-renderer contract for page images

PDF content is represented as a string in one of these forms:

- base64 PDF bytes
- `data:application/pdf;base64,...`
- a binary string starting with `%PDF`

## PDF Metadata Shape

`inspect_file` on a PDF returns `parsedData` shaped like:

```ts
{
  kind: "pdf";
  encoding: "base64" | "data-url" | "binary-string";
  byteLength: number;
  headerVersion: string | null;
  pageCount: number;
  pages: Array<{ page: number; width: number; height: number; rotation: number }>;
  fields: Array<{
    name: string;
    type:
      | "button"
      | "checkbox"
      | "dropdown"
      | "option-list"
      | "radio"
      | "signature"
      | "text"
      | "unknown";
    required: boolean;
    readOnly: boolean;
    widgets: Array<{
      page: number | null;
      rect: { x: number; y: number; width: number; height: number };
      screenshotRect: { x: number; y: number; width: number; height: number } | null;
    }>;
  }>;
  hasXFA: boolean;
}
```

`rect` uses PDF coordinates: bottom-left origin, PDF points.
`screenshotRect` converts each widget back into top-left screenshot coordinates:

```ts
screenshotY = pageHeight - pdfY - height;
```

## PDF Annotation Update Shape

Use `apply_file_type_operation` with `operation: "update_form_annotations"`:

```ts
{
  annotationDoc: {
    formName?: string;
    pages: [
      {
        page: number;
        width?: number;
        height?: number;
        annotations: [
          {
            id: string;
            type: "text" | "multiline" | "date" | "checkbox" | "radio" | "signature";
            label: string;
            bbox: { x: number; y: number; width: number; height: number };
            group?: string;
            value?: string | boolean;
            required?: boolean;
            confidence?: number;
            notes?: string;
          }
        ];
      }
    ];
  };
  coordinateSystem?: "screenshot-pixels" | "pdf-points";
  fieldNamePrefix?: string;
  removeExisting?: boolean;
}
```

The default coordinate system is `screenshot-pixels`, matching browser/page screenshots with top-left origin. The plugin converts to PDF widget coordinates:

```ts
pdfX = bbox.x;
pdfY = pageHeight - bbox.y - bbox.height;
pdfWidth = bbox.width;
pdfHeight = bbox.height;
```

Generated field names default to:

```ts
annotation.page_${page}.${id}
```

For radio annotations, the plugin creates one PDF radio group per `group` and one option per annotation id.

## PDF Screenshot Contract

`render_page_screenshot` is intentionally a contract in this core plugin. `pdf-lib` can inspect and mutate AcroForms, but it does not rasterize pages. A host agent repo should implement this with `pdf-to-img`, Poppler, Puppeteer, or another renderer and return:

```ts
{
  page: number;
  imagePath: string;
  width: number;
  height: number;
  scale: number;
  coordinateSystem: "top-left-pixels";
}
```

The older codec APIs still work:

- `codecForPath`
- `parseDocument`
- `stringifyDocument`
- workspace validation and route matching

Those APIs now delegate to a `SchemaIdeFileTypeRegistryService`.

## Agent Flow

The agent receives generic plugin tools:

- `list_file_type_plugins`
- `get_file_type_tools`
- `inspect_file`
- `apply_file_type_operation`

That keeps model-facing tools stable as new file types are added. A PDF plugin can add annotation updates, screenshots, page metadata, or form extraction without adding a new hard-coded agent tool.

Recommended system prompt block:

```text
File type plugin workflow:
- Use get_file_type_tools with a path or fileType before applying file-type-specific operations.
- Use inspect_file when you need parsed data, PDF page metadata, form fields, widget rectangles, or parse diagnostics.
- Use apply_file_type_operation only with an operation returned by get_file_type_tools or inspect_file.
- For JSON/YAML structural edits, prefer apply_file_type_operation with json_patch over whole-file rewrites.
- For PDFs, inspect_file returns page and AcroForm metadata. update_form_annotations expects an annotationDoc with page bboxes; default bboxes use screenshot pixels with top-left origin.
- render_page_screenshot is a host-renderer contract. If it reports that no renderer is installed, explain that a PDF rasterizer must be wired by the host.
```

`get_file_type_tools` accepts either:

```ts
{
  path: "forms/intake.pdf";
}
```

or:

```ts
{
  fileType: "pdf";
}
```

It returns the matching plugin, operations, and suggested next tool calls.

For documentation or prompt-only contexts, use the definition lookup helper instead of a runtime
registry:

```ts
import { fileTypeDefinitionForLookup, fileTypeToolHelp } from "@schema-ide/agent";

const definition = fileTypeDefinitionForLookup({ path: "forms/intake.pdf" });
const help = definition ? fileTypeToolHelp({ plugin: definition, path: "forms/intake.pdf" }) : null;
```

## React Integration

`<SchemaIde />` accepts a `fileTypes` prop. The component builds a registry from those plugins and threads it through validation, preview parsing, file creation, and agent tools.
