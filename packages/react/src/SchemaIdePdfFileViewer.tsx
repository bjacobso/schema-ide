import { useMemo } from "react";
import type { SourceFile } from "@schema-ide/core";

export function SchemaIdePdfFileViewer({ file }: { readonly file: SourceFile }) {
  const dataUrl = useMemo(() => pdfContentToDataUrl(file.content), [file.content]);

  if (!dataUrl) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/20 p-[var(--schema-ide-content-padding)]">
        <div className="max-w-sm rounded-md border bg-background p-[var(--schema-ide-content-padding)] text-sm text-muted-foreground">
          Unable to display PDF content.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 bg-muted/20">
      <iframe title={file.path} src={dataUrl} className="h-full w-full border-0 bg-background" />
    </div>
  );
}

export function isPdfPath(path: string | null | undefined): boolean {
  return path?.toLowerCase().endsWith(".pdf") ?? false;
}

export function pdfContentToDataUrl(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  if (/^data:application\/pdf[^,]*;base64,/i.test(trimmed)) return trimmed;

  if (trimmed.startsWith("%PDF")) {
    return binaryStringPdfToDataUrl(trimmed);
  }

  return `data:application/pdf;base64,${trimmed.replace(/\s+/g, "")}`;
}

function binaryStringPdfToDataUrl(content: string): string | null {
  if (typeof globalThis.btoa !== "function") return null;
  try {
    return `data:application/pdf;base64,${globalThis.btoa(content)}`;
  } catch {
    return null;
  }
}
