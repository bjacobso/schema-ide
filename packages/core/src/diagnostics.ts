import { ParseResult } from "effect";
import type { SchemaIdeDiagnostic, SchemaIdeValidationSummary } from "./types";

export function summarizeDiagnostics(
  diagnostics: readonly SchemaIdeDiagnostic[],
): SchemaIdeValidationSummary {
  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    errorCount: diagnostics.filter((diagnostic) => diagnostic.severity === "error").length,
    warningCount: diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length,
    infoCount: diagnostics.filter((diagnostic) => diagnostic.severity === "info").length,
  };
}

export function parseErrorToDiagnostics({
  error,
  path,
  source = "schema",
}: {
  readonly error: ParseResult.ParseError;
  readonly path: string | null;
  readonly source?: SchemaIdeDiagnostic["source"];
}): readonly SchemaIdeDiagnostic[] {
  const issues = ParseResult.ArrayFormatter.formatErrorSync(error);

  if (issues.length === 0) {
    return [
      {
        path,
        severity: "error",
        source,
        message: ParseResult.TreeFormatter.formatErrorSync(error),
      },
    ];
  }

  return issues.map((issue) => ({
    path,
    severity: "error",
    source,
    message: issue.message,
    documentPath: issue.path.length > 0 ? formatIssuePath(issue.path) : undefined,
  }));
}

export function formatIssuePath(path: readonly PropertyKey[]): string {
  return path.map((part) => String(part)).join(".");
}
