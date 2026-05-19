import { Effect } from "effect";
import { SchemaIdeFileTypeError } from "../file-type-error";
export { JsonPatchOperation } from "../file-type-operations/json-patch";

interface JsonPatchOperationInput {
  readonly op: "add" | "replace" | "remove";
  readonly path: string;
  readonly value?: unknown;
}

export function applyJsonPatchEffect(
  value: unknown,
  args: Readonly<Record<string, unknown>>,
): Effect.Effect<unknown, SchemaIdeFileTypeError> {
  return Effect.try({
    try: () => applyJsonPatch(value, parseJsonPatch(args)),
    catch: (error) =>
      error instanceof SchemaIdeFileTypeError
        ? error
        : new SchemaIdeFileTypeError(error instanceof Error ? error.message : String(error)),
  });
}

function parseJsonPatch(
  args: Readonly<Record<string, unknown>>,
): readonly JsonPatchOperationInput[] {
  const patch = args["patch"];
  if (!Array.isArray(patch)) {
    throw new SchemaIdeFileTypeError("json_patch requires a patch array.");
  }

  return patch.map((operation, index) => {
    if (!isRecord(operation)) {
      throw new SchemaIdeFileTypeError(`Patch operation ${index} must be an object.`);
    }
    const op = operation["op"];
    const path = operation["path"];
    if (op !== "add" && op !== "replace" && op !== "remove") {
      throw new SchemaIdeFileTypeError(`Patch operation ${index} has unsupported op.`);
    }
    if (typeof path !== "string") {
      throw new SchemaIdeFileTypeError(`Patch operation ${index} requires a string path.`);
    }
    return {
      op,
      path,
      ...(Object.hasOwn(operation, "value") ? { value: operation["value"] } : {}),
    };
  });
}

function applyJsonPatch(value: unknown, patch: readonly JsonPatchOperationInput[]): unknown {
  let current = cloneJsonValue(value);
  for (const operation of patch) {
    current = applyJsonPatchOperation(current, operation);
  }
  return current;
}

function applyJsonPatchOperation(value: unknown, operation: JsonPatchOperationInput): unknown {
  const tokens = parseJsonPointer(operation.path);
  if (tokens.length === 0) {
    if (operation.op === "remove") return null;
    return operation.value;
  }

  const parent = resolveJsonPointerParent(value, tokens);
  const key = tokens.at(-1);
  if (key === undefined) {
    throw new SchemaIdeFileTypeError("Patch path is empty.");
  }

  if (Array.isArray(parent)) {
    applyArrayPatch(parent, key, operation);
    return value;
  }

  if (isRecord(parent)) {
    applyObjectPatch(parent, key, operation);
    return value;
  }

  throw new SchemaIdeFileTypeError(`Patch parent is not an object or array: ${operation.path}`);
}

function applyArrayPatch(parent: unknown[], key: string, operation: JsonPatchOperationInput): void {
  const index = key === "-" ? parent.length : Number.parseInt(key, 10);
  if (!Number.isInteger(index) || index < 0 || index > parent.length) {
    throw new SchemaIdeFileTypeError(`Invalid array patch index: ${key}`);
  }

  if (operation.op === "add") {
    parent.splice(index, 0, operation.value);
    return;
  }

  if (index >= parent.length) {
    throw new SchemaIdeFileTypeError(`Array patch index is out of bounds: ${key}`);
  }

  if (operation.op === "replace") {
    parent[index] = operation.value;
    return;
  }

  parent.splice(index, 1);
}

function applyObjectPatch(
  parent: Record<string, unknown>,
  key: string,
  operation: JsonPatchOperationInput,
): void {
  if (operation.op === "add") {
    parent[key] = operation.value;
    return;
  }

  if (!Object.hasOwn(parent, key)) {
    throw new SchemaIdeFileTypeError(`Patch path does not exist: ${operation.path}`);
  }

  if (operation.op === "replace") {
    parent[key] = operation.value;
    return;
  }

  delete parent[key];
}

function resolveJsonPointerParent(value: unknown, tokens: readonly string[]): unknown {
  let current = value;
  for (const token of tokens.slice(0, -1)) {
    if (Array.isArray(current)) {
      const index = Number.parseInt(token, 10);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        throw new SchemaIdeFileTypeError(`Patch path does not exist: ${tokens.join("/")}`);
      }
      current = current[index];
      continue;
    }

    if (isRecord(current) && Object.hasOwn(current, token)) {
      current = current[token];
      continue;
    }

    throw new SchemaIdeFileTypeError(`Patch path does not exist: /${tokens.join("/")}`);
  }
  return current;
}

function parseJsonPointer(path: string): readonly string[] {
  if (path === "") return [];
  if (!path.startsWith("/")) {
    throw new SchemaIdeFileTypeError(`JSON Pointer must start with "/": ${path}`);
  }
  return path
    .slice(1)
    .split("/")
    .map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function cloneJsonValue(value: unknown): unknown {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
