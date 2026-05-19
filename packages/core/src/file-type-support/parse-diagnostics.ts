import type { SchemaIdeDiagnostic } from "../types";

export function parseDiagnostic({
  path,
  source,
  message,
  position,
}: {
  readonly path?: string | null | undefined;
  readonly source: "json-parse" | "yaml-parse";
  readonly message: string;
  readonly position?: { readonly line: number; readonly column: number } | undefined;
}): SchemaIdeDiagnostic {
  return {
    path: path ?? null,
    severity: "error",
    message,
    source,
    ...(position ? { line: position.line, column: position.column } : {}),
  };
}

export function jsonErrorPosition(
  text: string,
  error: unknown,
): { readonly line: number; readonly column: number } | undefined {
  if (!(error instanceof SyntaxError)) return undefined;
  const match = error.message.match(/position (\d+)/);
  if (!match?.[1]) return undefined;

  const position = Number.parseInt(match[1], 10);
  if (!Number.isFinite(position)) return undefined;

  const prefix = text.slice(0, position);
  const lines = prefix.split(/\r?\n/);
  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
}
