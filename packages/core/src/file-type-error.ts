export class SchemaIdeFileTypeError extends Error {
  readonly _tag = "SchemaIdeFileTypeError";

  constructor(message: string) {
    super(message);
    this.name = "SchemaIdeFileTypeError";
  }
}
