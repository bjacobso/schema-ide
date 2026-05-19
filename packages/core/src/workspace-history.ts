import type { SourceFile } from "./types";
import { normalizePath } from "./virtual-fs";

export type WorkspaceRevisionActor = "user" | "agent" | "system";

export interface WorkspaceRevisionMetadata {
  readonly actor: WorkspaceRevisionActor;
  readonly label: string;
  readonly turnId?: string | undefined;
  readonly toolCallId?: string | undefined;
  readonly timestamp?: number | undefined;
}

export type WorkspaceChange =
  | { readonly type: "writeFile"; readonly path: string; readonly content: string }
  | { readonly type: "createFile"; readonly path: string; readonly content: string }
  | { readonly type: "deleteFile"; readonly path: string }
  | { readonly type: "renameFile"; readonly fromPath: string; readonly toPath: string }
  | { readonly type: "replaceFiles"; readonly files: readonly SourceFile[] };

export type WorkspacePatch =
  | {
      readonly type: "writeFile";
      readonly path: string;
      readonly before: SourceFile | null;
      readonly after: SourceFile;
    }
  | {
      readonly type: "deleteFile";
      readonly path: string;
      readonly before: SourceFile;
    }
  | {
      readonly type: "renameFile";
      readonly fromPath: string;
      readonly toPath: string;
      readonly before: SourceFile;
      readonly after: SourceFile;
    }
  | {
      readonly type: "replaceFiles";
      readonly before: readonly SourceFile[];
      readonly after: readonly SourceFile[];
    };

export interface WorkspaceRevision {
  readonly id: string;
  readonly parentId: string | null;
  readonly timestamp: number;
  readonly actor: WorkspaceRevisionActor;
  readonly label: string;
  readonly turnId?: string | undefined;
  readonly toolCallId?: string | undefined;
  readonly patch: WorkspacePatch;
  readonly files: readonly SourceFile[];
}

export interface VersionedWorkspaceState {
  readonly initialFiles: readonly SourceFile[];
  readonly files: readonly SourceFile[];
  readonly revisions: readonly WorkspaceRevision[];
  readonly cursor: number;
  readonly revisionSequence: number;
}

export function createVersionedWorkspace(
  files: readonly SourceFile[] = [],
): VersionedWorkspaceState {
  const normalizedFiles = normalizeFiles(files);
  return {
    initialFiles: normalizedFiles,
    files: normalizedFiles,
    revisions: [],
    cursor: -1,
    revisionSequence: 0,
  };
}

export function applyWorkspaceChange(
  state: VersionedWorkspaceState,
  change: WorkspaceChange,
  metadata: WorkspaceRevisionMetadata,
): VersionedWorkspaceState {
  const patch = createPatch(state.files, change);
  if (!patch) return state;

  const nextFiles = filesFromPatch(state.files, patch);
  const revisions = state.revisions.slice(0, state.cursor + 1);
  const parentId = state.cursor >= 0 ? (state.revisions[state.cursor]?.id ?? null) : null;
  const nextSequence = state.revisionSequence + 1;
  const revision: WorkspaceRevision = {
    id: `rev-${nextSequence}`,
    parentId,
    timestamp: metadata.timestamp ?? Date.now(),
    actor: metadata.actor,
    label: metadata.label,
    turnId: metadata.turnId,
    toolCallId: metadata.toolCallId,
    patch,
    files: nextFiles,
  };

  return {
    ...state,
    files: nextFiles,
    revisions: [...revisions, revision],
    cursor: revisions.length,
    revisionSequence: nextSequence,
  };
}

export function undoWorkspaceChange(state: VersionedWorkspaceState): VersionedWorkspaceState {
  if (state.cursor < 0) return state;
  const previousFiles =
    state.cursor === 0 ? state.initialFiles : (state.revisions[state.cursor - 1]?.files ?? []);
  return {
    ...state,
    files: previousFiles,
    cursor: state.cursor - 1,
  };
}

export function redoWorkspaceChange(state: VersionedWorkspaceState): VersionedWorkspaceState {
  const nextRevision = state.revisions[state.cursor + 1];
  if (!nextRevision) return state;
  return {
    ...state,
    files: nextRevision.files,
    cursor: state.cursor + 1,
  };
}

export function checkoutWorkspaceRevision(
  state: VersionedWorkspaceState,
  revisionId: string | null,
): VersionedWorkspaceState {
  if (revisionId === null) return { ...state, files: state.initialFiles, cursor: -1 };
  const index = state.revisions.findIndex((revision) => revision.id === revisionId);
  if (index === -1) throw new Error(`Unknown workspace revision: ${revisionId}`);
  return { ...state, files: state.revisions[index]!.files, cursor: index };
}

export function canUndoWorkspaceChange(state: VersionedWorkspaceState): boolean {
  return state.cursor >= 0;
}

export function canRedoWorkspaceChange(state: VersionedWorkspaceState): boolean {
  return state.cursor + 1 < state.revisions.length;
}

export function getCurrentWorkspaceRevision(
  state: VersionedWorkspaceState,
): WorkspaceRevision | null {
  return state.cursor >= 0 ? (state.revisions[state.cursor] ?? null) : null;
}

export function getWorkspacePatchPaths(patch: WorkspacePatch): readonly string[] {
  switch (patch.type) {
    case "writeFile":
    case "deleteFile":
      return [patch.path];
    case "renameFile":
      return [patch.fromPath, patch.toPath];
    case "replaceFiles":
      return [
        ...new Set([
          ...patch.before.map((file) => file.path),
          ...patch.after.map((file) => file.path),
        ]),
      ].sort();
  }
}

function createPatch(files: readonly SourceFile[], change: WorkspaceChange): WorkspacePatch | null {
  switch (change.type) {
    case "writeFile": {
      const path = normalizePath(change.path);
      const before = findFile(files, path);
      const after = { path, content: change.content };
      if (before?.content === after.content) return null;
      return { type: "writeFile", path, before, after };
    }
    case "createFile": {
      const path = normalizePath(change.path);
      if (findFile(files, path)) throw new Error(`File already exists: ${path}`);
      return { type: "writeFile", path, before: null, after: { path, content: change.content } };
    }
    case "deleteFile": {
      const path = normalizePath(change.path);
      const before = findFile(files, path);
      if (!before) throw new Error(`File not found: ${path}`);
      return { type: "deleteFile", path, before };
    }
    case "renameFile": {
      const fromPath = normalizePath(change.fromPath);
      const toPath = normalizePath(change.toPath);
      const before = findFile(files, fromPath);
      if (!before) throw new Error(`File not found: ${fromPath}`);
      if (fromPath === toPath) return null;
      if (findFile(files, toPath)) throw new Error(`File already exists: ${toPath}`);
      return {
        type: "renameFile",
        fromPath,
        toPath,
        before,
        after: { path: toPath, content: before.content },
      };
    }
    case "replaceFiles": {
      const before = normalizeFiles(files);
      const after = normalizeFiles(change.files);
      if (filesEqual(before, after)) return null;
      return { type: "replaceFiles", before, after };
    }
  }
}

function filesFromPatch(
  files: readonly SourceFile[],
  patch: WorkspacePatch,
): readonly SourceFile[] {
  switch (patch.type) {
    case "writeFile":
      return sortFiles(
        patch.before
          ? files.map((file) => (file.path === patch.path ? patch.after : file))
          : [...files, patch.after],
      );
    case "deleteFile":
      return files.filter((file) => file.path !== patch.path);
    case "renameFile":
      return sortFiles(files.map((file) => (file.path === patch.fromPath ? patch.after : file)));
    case "replaceFiles":
      return patch.after;
  }
}

function normalizeFiles(files: readonly SourceFile[]): readonly SourceFile[] {
  const byPath = new Map<string, SourceFile>();
  for (const file of files) {
    const path = normalizePath(file.path);
    byPath.set(path, { path, content: file.content });
  }
  return sortFiles([...byPath.values()]);
}

function sortFiles(files: readonly SourceFile[]): readonly SourceFile[] {
  return [...files].sort((left, right) => left.path.localeCompare(right.path));
}

function findFile(files: readonly SourceFile[], path: string): SourceFile | null {
  return files.find((file) => file.path === path) ?? null;
}

function filesEqual(left: readonly SourceFile[], right: readonly SourceFile[]): boolean {
  return (
    left.length === right.length &&
    left.every((file, index) => {
      const other = right[index];
      return other?.path === file.path && other.content === file.content;
    })
  );
}
