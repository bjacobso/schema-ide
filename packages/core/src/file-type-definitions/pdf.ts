import { Schema } from "effect";
import { OperationDef } from "../file-type-definition";
import type { SchemaIdeFileTypeDefinition } from "../file-type-definition";

export const PdfContentEncoding = Schema.Literals(["base64", "data-url", "binary-string"]);
export type PdfContentEncoding = typeof PdfContentEncoding.Type;

export const PdfRect = Schema.Struct({
  x: Schema.Number.annotate({ description: "Left coordinate." }),
  y: Schema.Number.annotate({ description: "Top screenshot pixel or bottom-left PDF point." }),
  width: Schema.Number.annotate({ description: "Rectangle width." }),
  height: Schema.Number.annotate({ description: "Rectangle height." }),
});
export type PdfRect = typeof PdfRect.Type;

export const PdfPageMetadata = Schema.Struct({
  page: Schema.Number,
  width: Schema.Number,
  height: Schema.Number,
  rotation: Schema.Number,
});
export type PdfPageMetadata = typeof PdfPageMetadata.Type;

export const PdfWidgetMetadata = Schema.Struct({
  page: Schema.NullOr(Schema.Number),
  rect: PdfRect,
  screenshotRect: Schema.NullOr(PdfRect),
});
export type PdfWidgetMetadata = typeof PdfWidgetMetadata.Type;

export const PdfFieldMetadata = Schema.Struct({
  name: Schema.String,
  type: Schema.Literals([
    "button",
    "checkbox",
    "dropdown",
    "option-list",
    "radio",
    "signature",
    "text",
    "unknown",
  ]),
  required: Schema.Boolean,
  readOnly: Schema.Boolean,
  widgets: Schema.Array(PdfWidgetMetadata),
});
export type PdfFieldMetadata = typeof PdfFieldMetadata.Type;

export const PdfMetadata = Schema.Struct({
  kind: Schema.Literal("pdf"),
  encoding: PdfContentEncoding,
  byteLength: Schema.Number,
  headerVersion: Schema.NullOr(Schema.String),
  title: Schema.optional(Schema.String),
  author: Schema.optional(Schema.String),
  subject: Schema.optional(Schema.String),
  keywords: Schema.optional(Schema.String),
  creator: Schema.optional(Schema.String),
  producer: Schema.optional(Schema.String),
  creationDate: Schema.optional(Schema.String),
  modificationDate: Schema.optional(Schema.String),
  pageCount: Schema.Number,
  pages: Schema.Array(PdfPageMetadata),
  fields: Schema.Array(PdfFieldMetadata),
  hasXFA: Schema.Boolean,
  coordinateSystems: Schema.Struct({
    pdf: Schema.Literal("bottom-left-points"),
    screenshot: Schema.Literal("top-left-pixels"),
  }),
  operations: Schema.Struct({
    updateFormAnnotations: Schema.Literal("update_form_annotations"),
    renderPageScreenshot: Schema.Literal("render_page_screenshot"),
  }),
});
export type PdfMetadata = typeof PdfMetadata.Type;

export const PdfAnnotation = Schema.Struct({
  id: Schema.String.annotate({ description: "Stable annotation identifier." }),
  type: Schema.Literals(["text", "multiline", "date", "checkbox", "radio", "signature"]).annotate({
    description: "PDF widget type to create.",
  }),
  label: Schema.String.annotate({ description: "Human-readable field label." }),
  bbox: PdfRect.annotate({ description: "Annotation rectangle." }),
  group: Schema.optional(
    Schema.String.annotate({
      description: "Required for radio annotations; groups options into one radio field.",
    }),
  ),
  value: Schema.optional(
    Schema.Union([Schema.String, Schema.Boolean]).annotate({
      description: "Initial field value.",
    }),
  ),
  required: Schema.optional(
    Schema.Boolean.annotate({ description: "Whether the field should be required." }),
  ),
  confidence: Schema.optional(
    Schema.Number.annotate({ description: "Detection confidence between 0 and 1." }),
  ),
  notes: Schema.optional(Schema.String.annotate({ description: "Optional implementation notes." })),
});
export type PdfAnnotation = typeof PdfAnnotation.Type;

export const PdfAnnotationPage = Schema.Struct({
  page: Schema.Number.annotate({ description: "1-based PDF page number." }),
  width: Schema.optional(Schema.Number.annotate({ description: "Page width." })),
  height: Schema.optional(Schema.Number.annotate({ description: "Page height." })),
  annotations: Schema.Array(PdfAnnotation).annotate({
    description: "Annotations to create on this page.",
  }),
});
export type PdfAnnotationPage = typeof PdfAnnotationPage.Type;

export const PdfAnnotationDocument = Schema.Struct({
  formName: Schema.optional(Schema.String.annotate({ description: "Optional source form name." })),
  pages: Schema.Array(PdfAnnotationPage).annotate({
    description: "Pages containing annotations.",
  }),
});
export type PdfAnnotationDocument = typeof PdfAnnotationDocument.Type;

export const PdfRectSchema = PdfRect;
export const PdfAnnotationSchema = PdfAnnotation;
export const PdfAnnotationPageSchema = PdfAnnotationPage;
export const PdfAnnotationDocumentSchema = PdfAnnotationDocument;

export const UpdateFormAnnotationsParametersSchema = Schema.Struct({
  annotationDoc: PdfAnnotationDocument.annotate({
    description: "Complete annotation document to apply.",
  }),
  coordinateSystem: Schema.optional(
    Schema.Literals(["screenshot-pixels", "pdf-points"]).annotate({
      description: "Coordinate system for annotation bboxes. Defaults to screenshot-pixels.",
    }),
  ),
  fieldNamePrefix: Schema.optional(
    Schema.String.annotate({
      description: 'Generated PDF field prefix. Defaults to "annotation".',
    }),
  ),
  removeExisting: Schema.optional(
    Schema.Boolean.annotate({
      description: "Remove existing generated fields with the same prefix before creating widgets.",
    }),
  ),
});

export const RenderPageScreenshotParametersSchema = Schema.Struct({
  page: Schema.Number.annotate({ description: "1-based page number to render." }),
  scale: Schema.optional(Schema.Number.annotate({ description: "Render scale. Defaults to 1." })),
  outputPath: Schema.optional(
    Schema.String.annotate({
      description: "Optional host path where the image should be written.",
    }),
  ),
});

export const UpdateFormAnnotationsOutput = Schema.Struct({
  operation: Schema.Literal("update_form_annotations"),
  coordinateSystem: Schema.Literals(["screenshot-pixels", "pdf-points"]),
  fieldsCreated: Schema.Array(Schema.String),
  fieldsRemoved: Schema.Array(Schema.String),
  pages: Schema.Array(Schema.Number),
  annotationCount: Schema.Number,
});
export type UpdateFormAnnotationsOutput = typeof UpdateFormAnnotationsOutput.Type;

export const RenderPageScreenshotOutput = Schema.Struct({
  page: Schema.Number,
  imagePath: Schema.String,
  width: Schema.Number,
  height: Schema.Number,
  scale: Schema.Number,
  coordinateSystem: Schema.Literal("top-left-pixels"),
});
export type RenderPageScreenshotOutput = typeof RenderPageScreenshotOutput.Type;

export const UpdateFormAnnotationsOperation = OperationDef.make({
  name: "update_form_annotations",
  description:
    "Replace generated PDF form annotation widgets from an annotation document. Annotation bboxes default to screenshot pixels with top-left origin and are converted to PDF bottom-left coordinates.",
  mutates: true,
  parametersSchema: UpdateFormAnnotationsParametersSchema,
  outputSchema: UpdateFormAnnotationsOutput,
});

export const RenderPageScreenshotOperation = OperationDef.make({
  name: "render_page_screenshot",
  description:
    "Render one PDF page to an image. This plugin exposes the contract, but actual rasterization must be supplied by a renderer such as pdf-to-img, Poppler, or Puppeteer in the host agent repo.",
  mutates: false,
  parametersSchema: RenderPageScreenshotParametersSchema,
  outputSchema: RenderPageScreenshotOutput,
});

export const PdfFileTypeDefinition = {
  id: "pdf",
  label: "PDF",
  extensions: [".pdf"],
  mediaTypes: ["application/pdf"],
  operations: [UpdateFormAnnotationsOperation, RenderPageScreenshotOperation],
} satisfies SchemaIdeFileTypeDefinition;
