import type { SourceFile, SourceTree } from "./types";

export interface VirtualFile extends SourceFile {
  readonly lastModified: number;
}

export interface VirtualFSState {
  readonly files: Map<string, VirtualFile>;
}

export function createEmptyFS(): VirtualFSState {
  return { files: new Map() };
}

export function sourceFilesToVirtualFs(files: readonly SourceFile[]): VirtualFSState {
  const now = Date.now();
  return {
    files: new Map(
      files.map((file) => [
        normalizePath(file.path),
        {
          path: normalizePath(file.path),
          content: file.content,
          lastModified: now,
        },
      ]),
    ),
  };
}

export function virtualFsToSourceTree(fs: VirtualFSState): SourceTree {
  return {
    files: [...fs.files.values()]
      .map(({ path, content }) => ({ path, content }))
      .sort((left, right) => left.path.localeCompare(right.path)),
  };
}

export function writeFile(fs: VirtualFSState, path: string, content: string): VirtualFSState {
  const normalized = normalizePath(path);
  const files = new Map(fs.files);
  files.set(normalized, { path: normalized, content, lastModified: Date.now() });
  return { files };
}

export function deleteFile(fs: VirtualFSState, path: string): VirtualFSState {
  const files = new Map(fs.files);
  files.delete(normalizePath(path));
  return { files };
}

export function readFile(fs: VirtualFSState, path: string): SourceFile | null {
  return fs.files.get(normalizePath(path)) ?? null;
}

export function listFiles(fs: VirtualFSState): readonly string[] {
  return [...fs.files.keys()].sort();
}

export function normalizePath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\/+$/, "").replace(/\/+/g, "/");
}
