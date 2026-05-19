import { readdir, readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createReflection,
  formatForPath,
  validateSchemaIdeValue,
  type SchemaIdeDocumentFormat,
  type SchemaIdeInputSchema,
  type SchemaIdeReflection,
  type SourceFile,
  type WorkspaceRouteMap,
} from "@schema-ide/core";

export const defaultCliInclude = ["**/*.json", "**/*.yaml", "**/*.yml"] as const;
export const defaultCliExclude = [".git/**", "node_modules/**", "dist/**", "coverage/**"] as const;

export interface SchemaIdeCliWorkspace<
  A = unknown,
  Routes extends WorkspaceRouteMap = WorkspaceRouteMap,
> {
  readonly id?: string | undefined;
  readonly schema: SchemaIdeInputSchema<A, Routes>;
  readonly defaultFormat?: SchemaIdeDocumentFormat | undefined;
  readonly include?: readonly string[] | undefined;
  readonly exclude?: readonly string[] | undefined;
}

export interface ReadSourceFilesOptions {
  readonly directory: string;
  readonly include?: readonly string[] | undefined;
  readonly exclude?: readonly string[] | undefined;
}

export interface ValidateWorkspaceDirectoryOptions<
  A = unknown,
  Routes extends WorkspaceRouteMap = WorkspaceRouteMap,
> {
  readonly workspace: SchemaIdeCliWorkspace<A, Routes>;
  readonly directory: string;
  readonly activeFile?: string | null | undefined;
}

export interface WorkspaceConfigModule<
  A = unknown,
  Routes extends WorkspaceRouteMap = WorkspaceRouteMap,
> {
  readonly default?: SchemaIdeCliWorkspace<A, Routes> | undefined;
  readonly workspace?: SchemaIdeCliWorkspace<A, Routes> | undefined;
}

export function defineSchemaIdeWorkspace<A, Routes extends WorkspaceRouteMap = WorkspaceRouteMap>(
  workspace: SchemaIdeCliWorkspace<A, Routes>,
): SchemaIdeCliWorkspace<A, Routes> {
  return workspace;
}

export async function loadSchemaIdeWorkspaceConfig(
  configPath: string,
): Promise<SchemaIdeCliWorkspace> {
  const resolvedPath = resolve(configPath);
  const module = await importConfigModule(resolvedPath);
  const workspace = module.default ?? module.workspace;

  if (!workspace || typeof workspace !== "object" || !("schema" in workspace)) {
    throw new Error(
      `Schema IDE config must export a workspace definition as default or named "workspace": ${configPath}`,
    );
  }

  return workspace as SchemaIdeCliWorkspace;
}

export async function readSourceFilesFromDirectory({
  directory,
  include = defaultCliInclude,
  exclude = defaultCliExclude,
}: ReadSourceFilesOptions): Promise<readonly SourceFile[]> {
  const root = resolve(directory);
  const rootStat = await stat(root);

  if (!rootStat.isDirectory()) {
    throw new Error(`Workspace directory is not a directory: ${directory}`);
  }

  const files: SourceFile[] = [];
  await collectSourceFiles(root, root, include, exclude, files);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export async function validateWorkspaceDirectory<
  A,
  Routes extends WorkspaceRouteMap = WorkspaceRouteMap,
>({
  workspace,
  directory,
  activeFile,
}: ValidateWorkspaceDirectoryOptions<A, Routes>): Promise<SchemaIdeReflection> {
  const files = await readSourceFilesFromDirectory({
    directory,
    include: workspace.include,
    exclude: workspace.exclude,
  });
  const selectedFile = resolveActiveFile(files, activeFile);
  const activeFormat = selectedFile
    ? formatForPath(selectedFile.path, workspace.defaultFormat ?? "json")
    : (workspace.defaultFormat ?? "json");
  const validation = validateSchemaIdeValue({
    schema: workspace.schema,
    files,
    activeFile: selectedFile?.path ?? null,
    activeFormat,
  });

  return createReflection({
    schema: workspace.schema,
    files,
    activeFile: selectedFile?.path ?? null,
    activeFormat,
    validation,
  });
}

async function collectSourceFiles(
  root: string,
  directory: string,
  include: readonly string[],
  exclude: readonly string[],
  files: SourceFile[],
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = resolve(directory, entry.name);
    const path = normalizeWorkspacePath(relative(root, absolutePath));

    if (matchesAny(path, exclude)) {
      continue;
    }

    if (entry.isDirectory()) {
      await collectSourceFiles(root, absolutePath, include, exclude, files);
      continue;
    }

    if (!entry.isFile() || !matchesAny(path, include)) {
      continue;
    }

    files.push({
      path,
      content: await readFile(absolutePath, "utf8"),
    });
  }
}

async function importConfigModule(configPath: string): Promise<WorkspaceConfigModule> {
  if (isTypeScriptPath(configPath)) {
    const { tsImport } = await import("tsx/esm/api");
    return (await tsImport(configPath, import.meta.url)) as WorkspaceConfigModule;
  }

  const url = pathToFileURL(configPath).href;
  return (await import(url)) as WorkspaceConfigModule;
}

function isTypeScriptPath(path: string): boolean {
  return /\.(?:c|m)?tsx?$/.test(path);
}

function resolveActiveFile(
  files: readonly SourceFile[],
  activeFile: string | null | undefined,
): SourceFile | null {
  if (!activeFile) return files[0] ?? null;

  const normalized = normalizeWorkspacePath(activeFile);
  return files.find((file) => file.path === normalized) ?? files[0] ?? null;
}

function matchesAny(path: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchGlob(pattern, path));
}

function matchGlob(pattern: string, path: string): boolean {
  return globToRegExp(normalizeWorkspacePath(pattern)).test(normalizeWorkspacePath(path));
}

function globToRegExp(pattern: string): RegExp {
  let source = "^";

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === undefined) continue;
    const next = pattern[index + 1];
    const afterNext = pattern[index + 2];

    if (char === "*" && next === "*" && afterNext === "/") {
      source += "(?:.*/)?";
      index += 2;
      continue;
    }

    if (char === "*" && next === "*") {
      source += ".*";
      index += 1;
      continue;
    }

    if (char === "*") {
      source += "[^/]*";
      continue;
    }

    if (char === "?") {
      source += "[^/]";
      continue;
    }

    source += escapeRegExp(char);
  }

  return new RegExp(`${source}$`);
}

function normalizeWorkspacePath(path: string): string {
  const normalized = path.split(sep).join("/");
  return normalized.replace(/^\.\//, "").replace(/^\/+/, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function resolveWorkspacePath(directory: string, path: string): string {
  return isAbsolute(path) ? path : resolve(directory, path);
}
