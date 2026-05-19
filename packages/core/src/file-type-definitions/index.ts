export {
  JsonPatchOperation,
  JsonPatchOutput,
  JsonPatchParametersSchema,
} from "../file-type-operations/json-patch";
export { JsonFileTypeDefinition } from "./json";
export {
  PdfAnnotation,
  PdfAnnotationDocumentSchema,
  PdfAnnotationDocument,
  PdfAnnotationPage,
  PdfAnnotationPageSchema,
  PdfAnnotationSchema,
  PdfContentEncoding,
  PdfFieldMetadata,
  PdfFileTypeDefinition,
  PdfMetadata,
  PdfPageMetadata,
  PdfRect,
  PdfRectSchema,
  PdfWidgetMetadata,
  RenderPageScreenshotOperation,
  RenderPageScreenshotOutput,
  RenderPageScreenshotParametersSchema,
  UpdateFormAnnotationsOperation,
  UpdateFormAnnotationsOutput,
  UpdateFormAnnotationsParametersSchema,
} from "./pdf";
export { YamlFileTypeDefinition } from "./yaml";
export type {
  SchemaIdeFileTypeDefinition,
  SchemaIdeFileTypeOperationDefinition,
  SchemaIdeFileTypeOperationInfo,
} from "../file-type-definition";
export { OperationDef } from "../file-type-definition";

import { JsonFileTypeDefinition } from "./json";
import { PdfFileTypeDefinition } from "./pdf";
import { YamlFileTypeDefinition } from "./yaml";

export const BuiltInFileTypeDefinitions = [
  JsonFileTypeDefinition,
  YamlFileTypeDefinition,
  PdfFileTypeDefinition,
] as const;
