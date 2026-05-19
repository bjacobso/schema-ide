import {
  PDFButton,
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFField,
  PDFOptionList,
  PDFRadioGroup,
  PDFSignature,
  PDFTextField,
  type PDFPage,
} from "pdf-lib";
import { Effect, Match } from "effect";
import { SchemaIdeFileTypeError } from "../file-type-error";
import type { SchemaIdeFileTypeInspectionExtra, SchemaIdeFileTypePlugin } from "../file-type";
import {
  PdfFileTypeDefinition,
  RenderPageScreenshotOperation,
  UpdateFormAnnotationsOperation,
  type PdfAnnotation,
  type PdfAnnotationDocument,
  type PdfContentEncoding,
  type PdfFieldMetadata,
  type PdfMetadata,
  type PdfRect,
} from "../file-type-definitions/pdf";
import type { SchemaIdeDiagnostic } from "../types";

export const PdfFileTypePlugin: SchemaIdeFileTypePlugin = {
  ...PdfFileTypeDefinition,
  parse: (text, path) =>
    Effect.sync(() => {
      try {
        const decoded = decodePdfContent(text);
        const headerVersion = detectPdfHeaderVersion(decoded.bytes);
        if (!headerVersion) {
          return {
            success: false,
            diagnostic: pdfDiagnostic(path, "PDF content does not start with a %PDF header."),
          };
        }
        return {
          success: true,
          value: {
            kind: "pdf",
            encoding: decoded.encoding,
            byteLength: decoded.bytes.byteLength,
            headerVersion,
          },
        };
      } catch (error) {
        return {
          success: false,
          diagnostic: pdfDiagnostic(
            path,
            error instanceof Error ? error.message : "Invalid PDF content.",
          ),
        };
      }
    }),
  inspect: (file): Effect.Effect<SchemaIdeFileTypeInspectionExtra, SchemaIdeFileTypeError> =>
    Effect.gen(function* () {
      const metadata = yield* loadPdfMetadataEffect(file.content);
      return {
        parsedData: metadata,
        metadata: {
          pageCount: metadata.pageCount,
          fieldCount: metadata.fields.length,
          byteLength: metadata.byteLength,
          hasXFA: metadata.hasXFA,
        },
      };
    }),
  applyOperation: (input) =>
    Match.value(input.operation).pipe(
      Match.when(RenderPageScreenshotOperation.name, () => unavailableScreenshotRenderer(input)),
      Match.when(UpdateFormAnnotationsOperation.name, () => updatePdfFormAnnotations(input)),
      Match.orElse((operation) =>
        Effect.fail(new SchemaIdeFileTypeError(`Unsupported PDF operation: ${operation}`)),
      ),
    ),
};

function unavailableScreenshotRenderer(
  input: Parameters<NonNullable<SchemaIdeFileTypePlugin["applyOperation"]>>[0],
) {
  const args = parseScreenshotArgs(input.args);
  return Effect.fail(
    new SchemaIdeFileTypeError(
      `PDF page screenshot rendering requires a host renderer. Contract: ${JSON.stringify({
        page: args.page,
        scale: args.scale,
        outputPath: args.outputPath ?? null,
        returns: {
          page: "number",
          imagePath: "string",
          width: "number",
          height: "number",
          scale: "number",
          coordinateSystem: "top-left-pixels",
        },
      })}`,
    ),
  );
}

function updatePdfFormAnnotations(
  input: Parameters<NonNullable<SchemaIdeFileTypePlugin["applyOperation"]>>[0],
) {
  return Effect.gen(function* () {
    const result = yield* updateFormAnnotationsEffect(input.file.content, input.args);
    return {
      file: { path: input.file.path, content: result.content },
      result: result.summary,
    };
  });
}

async function loadPdfMetadata(content: string): Promise<PdfMetadata> {
  const decoded = decodePdfContent(content);
  const pdf = await PDFDocument.load(decoded.bytes, { ignoreEncryption: true });
  const pages = pdf.getPages();
  const form = pdf.getForm();
  const pageMetadata = pages.map((page, index) => ({
    page: index + 1,
    width: page.getWidth(),
    height: page.getHeight(),
    rotation: page.getRotation().angle,
  }));

  return {
    kind: "pdf",
    encoding: decoded.encoding,
    byteLength: decoded.bytes.byteLength,
    headerVersion: detectPdfHeaderVersion(decoded.bytes),
    ...optionalMetadata({
      title: pdf.getTitle(),
      author: pdf.getAuthor(),
      subject: pdf.getSubject(),
      keywords: pdf.getKeywords(),
      creator: pdf.getCreator(),
      producer: pdf.getProducer(),
      creationDate: pdf.getCreationDate()?.toISOString(),
      modificationDate: pdf.getModificationDate()?.toISOString(),
    }),
    pageCount: pdf.getPageCount(),
    pages: pageMetadata,
    fields: form.getFields().map((field) => fieldMetadata(field, pages)),
    hasXFA: form.hasXFA(),
    coordinateSystems: {
      pdf: "bottom-left-points",
      screenshot: "top-left-pixels",
    },
    operations: {
      updateFormAnnotations: "update_form_annotations",
      renderPageScreenshot: "render_page_screenshot",
    },
  };
}

function loadPdfMetadataEffect(
  content: string,
): Effect.Effect<PdfMetadata, SchemaIdeFileTypeError> {
  return Effect.tryPromise({
    try: () => loadPdfMetadata(content),
    catch: (error) =>
      new SchemaIdeFileTypeError(
        error instanceof Error ? error.message : `Failed to load PDF: ${String(error)}`,
      ),
  });
}

async function updateFormAnnotations(
  content: string,
  args: Readonly<Record<string, unknown>>,
): Promise<{
  readonly content: string;
  readonly summary: Readonly<Record<string, unknown>>;
}> {
  const decoded = decodePdfContent(content);
  const pdf = await PDFDocument.load(decoded.bytes, { ignoreEncryption: true });
  const form = pdf.getForm();
  const annotationDoc = parseAnnotationDocument(args);
  const coordinateSystem = parseCoordinateSystem(args);
  const fieldNamePrefix =
    typeof args["fieldNamePrefix"] === "string" ? args["fieldNamePrefix"] : "annotation";
  const removeExisting = args["removeExisting"] !== false;

  validateAnnotationDocument(annotationDoc, pdf.getPages(), coordinateSystem);

  const removedFields = removeExisting
    ? removeFieldsWithPrefix(form, fieldNamePrefix ? `${fieldNamePrefix}.` : "")
    : [];
  const fieldsCreated: string[] = [];
  const radioGroups = new Map<string, ReturnType<typeof form.createRadioGroup>>();

  for (const pageDoc of annotationDoc.pages) {
    const page = pdf.getPage(pageDoc.page - 1);
    for (const annotation of pageDoc.annotations) {
      const fieldName = fieldNameForAnnotation(fieldNamePrefix, pageDoc.page, annotation);
      fieldsCreated.push(fieldName);
      const pdfRect =
        coordinateSystem === "pdf-points"
          ? annotation.bbox
          : screenshotRectToPdfRect(annotation.bbox, page.getHeight());
      const appearance = {
        x: pdfRect.x,
        y: pdfRect.y,
        width: pdfRect.width,
        height: pdfRect.height,
        borderWidth: 0,
      };

      if (annotation.type === "checkbox") {
        const field = form.createCheckBox(fieldName);
        applyRequired(field, annotation);
        field.addToPage(page, appearance);
        if (annotation.value === true || annotation.value === "true") field.check();
        continue;
      }

      if (annotation.type === "radio") {
        const group = annotation.group ?? "default";
        const groupName = sanitizePdfFieldName(`${fieldNamePrefix}.radio.${group}`);
        const radioGroup =
          radioGroups.get(groupName) ??
          (() => {
            const created = form.createRadioGroup(groupName);
            radioGroups.set(groupName, created);
            return created;
          })();
        const option = sanitizePdfFieldName(annotation.id);
        radioGroup.addOptionToPage(option, page, appearance);
        if (annotation.value === true || annotation.value === option) radioGroup.select(option);
        continue;
      }

      const field = form.createTextField(fieldName);
      applyRequired(field, annotation);
      if (annotation.type === "multiline") field.enableMultiline();
      if (typeof annotation.value === "string") field.setText(annotation.value);
      field.addToPage(page, appearance);
    }
  }

  const bytes = await pdf.save();
  return {
    content: encodePdfContent(bytes, decoded.encoding),
    summary: {
      operation: UpdateFormAnnotationsOperation.name,
      coordinateSystem,
      fieldsCreated,
      fieldsRemoved: removedFields,
      pages: annotationDoc.pages.map((page) => page.page),
      annotationCount: annotationDoc.pages.reduce(
        (count, page) => count + page.annotations.length,
        0,
      ),
    },
  };
}

function updateFormAnnotationsEffect(
  content: string,
  args: Readonly<Record<string, unknown>>,
): Effect.Effect<
  {
    readonly content: string;
    readonly summary: Readonly<Record<string, unknown>>;
  },
  SchemaIdeFileTypeError
> {
  return Effect.tryPromise({
    try: () => updateFormAnnotations(content, args),
    catch: (error) =>
      error instanceof SchemaIdeFileTypeError
        ? error
        : new SchemaIdeFileTypeError(
            error instanceof Error ? error.message : `Failed to update PDF: ${String(error)}`,
          ),
  });
}

function fieldMetadata(field: PDFField, pages: readonly PDFPage[]): PdfFieldMetadata {
  return {
    name: field.getName(),
    type: fieldType(field),
    required: field.isRequired(),
    readOnly: field.isReadOnly(),
    widgets: field.acroField.getWidgets().map((widget) => {
      const rect = widget.getRectangle();
      const page = pageNumberForWidget(widget.P()?.toString(), pages);
      const pageHeight = page ? pages[page - 1]?.getHeight() : undefined;
      return {
        page,
        rect,
        screenshotRect:
          pageHeight === undefined
            ? null
            : {
                x: rect.x,
                y: pageHeight - rect.y - rect.height,
                width: rect.width,
                height: rect.height,
              },
      };
    }),
  };
}

function fieldType(field: PDFField): PdfFieldMetadata["type"] {
  if (field instanceof PDFButton) return "button";
  if (field instanceof PDFCheckBox) return "checkbox";
  if (field instanceof PDFDropdown) return "dropdown";
  if (field instanceof PDFOptionList) return "option-list";
  if (field instanceof PDFRadioGroup) return "radio";
  if (field instanceof PDFSignature) return "signature";
  if (field instanceof PDFTextField) return "text";
  return "unknown";
}

function pageNumberForWidget(
  pageRef: string | undefined,
  pages: readonly PDFPage[],
): number | null {
  if (!pageRef) return null;
  const index = pages.findIndex((page) => page.ref.toString() === pageRef);
  return index === -1 ? null : index + 1;
}

function parseAnnotationDocument(args: Readonly<Record<string, unknown>>): PdfAnnotationDocument {
  const raw = args["annotationDoc"] ?? args;
  if (!isRecord(raw) || !Array.isArray(raw["pages"])) {
    throw new SchemaIdeFileTypeError("update_form_annotations requires annotationDoc.pages.");
  }
  return raw as unknown as PdfAnnotationDocument;
}

function parseCoordinateSystem(
  args: Readonly<Record<string, unknown>>,
): "screenshot-pixels" | "pdf-points" {
  const coordinateSystem = args["coordinateSystem"] ?? "screenshot-pixels";
  if (coordinateSystem !== "screenshot-pixels" && coordinateSystem !== "pdf-points") {
    throw new SchemaIdeFileTypeError(
      'coordinateSystem must be "screenshot-pixels" or "pdf-points".',
    );
  }
  return coordinateSystem;
}

function parseScreenshotArgs(args: Readonly<Record<string, unknown>>): {
  readonly page: number;
  readonly scale: number;
  readonly outputPath?: string | undefined;
} {
  const page = typeof args["page"] === "number" ? args["page"] : Number.NaN;
  if (!Number.isInteger(page) || page < 1) {
    throw new SchemaIdeFileTypeError("render_page_screenshot requires a 1-based page number.");
  }
  const scale = typeof args["scale"] === "number" && args["scale"] > 0 ? args["scale"] : 1;
  return {
    page,
    scale,
    ...(typeof args["outputPath"] === "string" ? { outputPath: args["outputPath"] } : {}),
  };
}

function validateAnnotationDocument(
  doc: PdfAnnotationDocument,
  pdfPages: readonly PDFPage[],
  coordinateSystem: "screenshot-pixels" | "pdf-points",
): void {
  const ids = new Set<string>();
  for (const pageDoc of doc.pages) {
    if (!Number.isInteger(pageDoc.page) || pageDoc.page < 1 || pageDoc.page > pdfPages.length) {
      throw new SchemaIdeFileTypeError(
        `Annotation page is outside PDF page range: ${pageDoc.page}`,
      );
    }
    const pdfPage = pdfPages[pageDoc.page - 1];
    if (!pdfPage) throw new SchemaIdeFileTypeError(`PDF page not found: ${pageDoc.page}`);
    const pageWidth = pageDoc.width ?? pdfPage.getWidth();
    const pageHeight = pageDoc.height ?? pdfPage.getHeight();
    if (pageWidth <= 0 || pageHeight <= 0) {
      throw new SchemaIdeFileTypeError(`Annotation page ${pageDoc.page} has invalid dimensions.`);
    }

    for (const annotation of pageDoc.annotations) {
      if (!annotation.id) throw new SchemaIdeFileTypeError("Annotation id is required.");
      if (ids.has(annotation.id)) {
        throw new SchemaIdeFileTypeError(`Duplicate annotation id: ${annotation.id}`);
      }
      ids.add(annotation.id);
      if (annotation.type === "radio" && !annotation.group) {
        throw new SchemaIdeFileTypeError(`Radio annotation ${annotation.id} requires group.`);
      }
      if (
        annotation.confidence !== undefined &&
        (annotation.confidence < 0 || annotation.confidence > 1)
      ) {
        throw new SchemaIdeFileTypeError(`Annotation ${annotation.id} confidence must be 0..1.`);
      }
      validateRect(annotation.id, annotation.bbox, pageWidth, pageHeight, coordinateSystem);
    }
  }
}

function validateRect(
  id: string,
  rect: PdfRect,
  pageWidth: number,
  pageHeight: number,
  coordinateSystem: "screenshot-pixels" | "pdf-points",
): void {
  if (
    !Number.isFinite(rect.x) ||
    !Number.isFinite(rect.y) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    throw new SchemaIdeFileTypeError(`Annotation ${id} has invalid bbox.`);
  }
  if (
    rect.x < 0 ||
    rect.y < 0 ||
    rect.x + rect.width > pageWidth ||
    rect.y + rect.height > pageHeight
  ) {
    throw new SchemaIdeFileTypeError(
      `Annotation ${id} bbox is outside page bounds for ${coordinateSystem}.`,
    );
  }
}

function removeFieldsWithPrefix(
  form: ReturnType<PDFDocument["getForm"]>,
  prefix: string,
): string[] {
  if (!prefix) return [];
  const removed: string[] = [];
  for (const field of form.getFields()) {
    const name = field.getName();
    if (name.startsWith(prefix)) {
      form.removeField(field);
      removed.push(name);
    }
  }
  return removed;
}

function fieldNameForAnnotation(prefix: string, page: number, annotation: PdfAnnotation): string {
  const base =
    annotation.type === "radio" && annotation.group
      ? `${prefix}.page_${page}.${annotation.group}.${annotation.id}`
      : `${prefix}.page_${page}.${annotation.id}`;
  return sanitizePdfFieldName(base);
}

function sanitizePdfFieldName(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]+/g, "_").replace(/^\.+|\.+$/g, "") || "field";
}

function screenshotRectToPdfRect(rect: PdfRect, pageHeight: number): PdfRect {
  return {
    x: rect.x,
    y: pageHeight - rect.y - rect.height,
    width: rect.width,
    height: rect.height,
  };
}

function applyRequired(field: PDFField, annotation: PdfAnnotation): void {
  if (annotation.required) field.enableRequired();
}

function decodePdfContent(content: string): {
  readonly bytes: Uint8Array;
  readonly encoding: PdfContentEncoding;
} {
  const trimmed = content.trim();
  const dataUrlMatch = /^data:application\/pdf;base64,(?<data>[A-Za-z0-9+/=_-]+)$/i.exec(trimmed);
  if (dataUrlMatch?.groups?.["data"]) {
    return { bytes: base64ToBytes(dataUrlMatch.groups["data"]), encoding: "data-url" };
  }
  if (trimmed.startsWith("%PDF")) {
    return { bytes: binaryStringToBytes(content), encoding: "binary-string" };
  }
  return { bytes: base64ToBytes(trimmed), encoding: "base64" };
}

function encodePdfContent(bytes: Uint8Array, encoding: PdfContentEncoding): string {
  const base64 = bytesToBase64(bytes);
  if (encoding === "data-url") return `data:application/pdf;base64,${base64}`;
  if (encoding === "binary-string") return bytesToBinaryString(bytes);
  return base64;
}

function detectPdfHeaderVersion(bytes: Uint8Array): string | null {
  const header = bytesToBinaryString(bytes.slice(0, 16));
  const match = header.match(/^%PDF-(\d+\.\d+)/);
  return match?.[1] ?? null;
}

function base64ToBytes(base64: string): Uint8Array {
  try {
    const normalized = base64.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized);
    return binaryStringToBytes(binary);
  } catch {
    throw new SchemaIdeFileTypeError("PDF content must be a PDF binary string or base64 PDF.");
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(bytesToBinaryString(bytes));
}

function binaryStringToBytes(value: string): Uint8Array {
  return Uint8Array.from(value, (character) => character.charCodeAt(0) & 0xff);
}

function bytesToBinaryString(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(offset, offset + chunkSize));
  }
  return binary;
}

function pdfDiagnostic(path: string | null | undefined, message: string): SchemaIdeDiagnostic {
  return {
    path: path ?? null,
    severity: "error",
    source: "file-type",
    message,
  };
}

function optionalMetadata(
  metadata: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(metadata).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
