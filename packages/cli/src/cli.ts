#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import {
  loadSchemaIdeWorkspaceConfig,
  validateWorkspaceDirectory,
  type SchemaIdeCliWorkspace,
} from "./index";
import type { ReflectedSchema, SchemaIdeDiagnostic, SchemaIdeReflection } from "@schema-ide/core";

interface CliOptions {
  readonly command: "validate" | "routes" | "schema" | "inspect" | "help";
  readonly schemaPath: string | null;
  readonly directory: string;
  readonly json: boolean;
  readonly activeFile: string | null;
  readonly schemaId: string | null;
}

interface CliResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export async function runSchemaIdeCli(argv: readonly string[]): Promise<CliResult> {
  const options = parseArgs(argv);

  if (options.command === "help") {
    return { exitCode: 0, stdout: helpText(), stderr: "" };
  }

  if (!options.schemaPath) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: "Missing required --schema <path> option.\n\n" + helpText(),
    };
  }

  const workspace = await loadSchemaIdeWorkspaceConfig(options.schemaPath);
  const reflection = await validateWorkspaceDirectory({
    workspace: workspace as SchemaIdeCliWorkspace,
    directory: options.directory,
    activeFile: options.activeFile,
  });

  if (options.command === "routes") {
    return {
      exitCode: 0,
      stdout: options.json
        ? `${JSON.stringify({ routeMatches: reflection.routeMatches }, null, 2)}\n`
        : formatRoutes(reflection),
      stderr: "",
    };
  }

  if (options.command === "schema") {
    const schema = selectSchema(reflection.schemas, options.schemaId);
    if (!schema) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `Schema not found: ${options.schemaId ?? "(active)"}\n`,
      };
    }

    return {
      exitCode: 0,
      stdout: options.json
        ? `${JSON.stringify(schema, null, 2)}\n`
        : `${JSON.stringify(schema.jsonSchema, null, 2)}\n`,
      stderr: "",
    };
  }

  if (options.command === "inspect") {
    return {
      exitCode: reflection.validationSummary.valid ? 0 : 1,
      stdout: `${JSON.stringify(summarizeReflection(reflection), null, 2)}\n`,
      stderr: "",
    };
  }

  return {
    exitCode: reflection.validationSummary.valid ? 0 : 1,
    stdout: options.json
      ? `${JSON.stringify(
          {
            summary: reflection.validationSummary,
            diagnostics: reflection.diagnostics,
            routeMatches: reflection.routeMatches,
          },
          null,
          2,
        )}\n`
      : formatValidation(reflection),
    stderr: "",
  };
}

function parseArgs(argv: readonly string[]): CliOptions {
  const args = [...argv];
  const first = args[0];
  const command = isCommand(first) ? first : "validate";
  const rest = command === first ? args.slice(1) : args;
  let schemaPath: string | null = null;
  let directory = ".";
  let json = false;
  let activeFile: string | null = null;
  let schemaId: string | null = null;

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === undefined) continue;

    if (arg === "--help" || arg === "-h") {
      return { command: "help", schemaPath, directory, json, activeFile, schemaId };
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--schema" || arg === "-s") {
      schemaPath = requireValue(rest, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--dir" || arg === "-d") {
      directory = requireValue(rest, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--active-file") {
      activeFile = requireValue(rest, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--schema-id") {
      schemaId = requireValue(rest, index, arg);
      index += 1;
      continue;
    }

    if (!arg.startsWith("-")) {
      directory = arg;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return { command, schemaPath, directory, json, activeFile, schemaId };
}

function isCommand(value: string | undefined): value is CliOptions["command"] {
  return (
    value === "validate" ||
    value === "routes" ||
    value === "schema" ||
    value === "inspect" ||
    value === "help"
  );
}

function requireValue(args: readonly string[], index: number, name: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
}

function formatValidation(reflection: SchemaIdeReflection): string {
  const lines = [
    reflection.validationSummary.valid
      ? "Schema IDE validation passed."
      : "Schema IDE validation failed.",
    `errors=${reflection.validationSummary.errorCount} warnings=${reflection.validationSummary.warningCount} info=${reflection.validationSummary.infoCount}`,
  ];

  for (const diagnostic of reflection.diagnostics) {
    lines.push(formatDiagnostic(diagnostic));
  }

  return `${lines.join("\n")}\n`;
}

function formatDiagnostic(diagnostic: SchemaIdeDiagnostic): string {
  const path = diagnostic.path ?? diagnostic.documentPath ?? "(workspace)";
  const location =
    diagnostic.line && diagnostic.column
      ? `${path}:${diagnostic.line}:${diagnostic.column}`
      : diagnostic.line
        ? `${path}:${diagnostic.line}`
        : path;

  return `${diagnostic.severity} ${location} [${diagnostic.source}] ${diagnostic.message}`;
}

function formatRoutes(reflection: SchemaIdeReflection): string {
  const lines = reflection.routeMatches.map((route) => {
    const schemaId = route.schemaId ?? "(unmatched)";
    return `${route.path}\t${schemaId}\t${route.format}`;
  });
  return `${lines.join("\n")}${lines.length ? "\n" : ""}`;
}

function selectSchema(
  schemas: readonly ReflectedSchema[],
  schemaId: string | null,
): ReflectedSchema | null {
  if (schemaId) {
    return schemas.find((schema) => schema.id === schemaId) ?? null;
  }

  return schemas[0] ?? null;
}

function summarizeReflection(reflection: SchemaIdeReflection) {
  return {
    mode: reflection.mode,
    activeFile: reflection.activeFile,
    activeFormat: reflection.activeFormat,
    files: reflection.files.map((file) => file.path),
    summary: reflection.validationSummary,
    diagnostics: reflection.diagnostics,
    routeMatches: reflection.routeMatches,
    schemas: reflection.schemas,
  };
}

function helpText(): string {
  return `Usage: schema-ide <command> --schema <path> [--dir <path>] [--json]

Commands:
  validate   Validate a local directory and print diagnostics.
  routes     Print file-to-schema route matches.
  schema     Print reflected JSON Schema. Use --schema-id for a route.
  inspect    Print files, summary, diagnostics, routes, and schemas as JSON.

Options:
  -s, --schema <path>      Consumer workspace config module.
  -d, --dir <path>         Directory to validate. Defaults to current directory.
      --active-file <path> Active file used for document-mode schemas.
      --schema-id <id>     Schema route id for the schema command.
      --json               Print machine-readable JSON where supported.
  -h, --help               Show this help.
`;
}

const entryPointUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

if (entryPointUrl && import.meta.url === entryPointUrl) {
  try {
    const result = await runSchemaIdeCli(process.argv.slice(2));
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exitCode = result.exitCode;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
