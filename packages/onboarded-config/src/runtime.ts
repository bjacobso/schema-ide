import {
  createSchemaIdeArtifactRuntime,
  type SchemaIdeArtifactRuntime,
  type SchemaIdeDocumentFormat,
  type SourceFile,
} from "@schema-ide/core";
import type { ArtifactProjectDeclaration } from "@schema-ide/artifacts";
import {
  OnboardedArtifactProject,
  createOnboardedArtifactProject,
  type OnboardedArtifactProjectConfig,
} from "./artifacts";
import { OnboardedRelationWorkspaceSchema, createOnboardedRelationWorkspace } from "./relations";
import { OnboardedAccountWorkspaceSchema, type AccountWorkspaceValue } from "./workspace";

export interface CreateOnboardedArtifactRuntimeOptions {
  readonly files: readonly SourceFile[];
  readonly activeFile?: string | null | undefined;
  readonly workspaceId?: string | undefined;
  readonly defaultFormat?: SchemaIdeDocumentFormat | undefined;
  readonly project?: ArtifactProjectDeclaration<string, any, any> | undefined;
}

export type OnboardedArtifactRuntime = SchemaIdeArtifactRuntime<AccountWorkspaceValue>;

export function createOnboardedArtifactRuntime({
  files,
  activeFile = files[0]?.path ?? null,
  workspaceId = "onboarded-account-yaml",
  defaultFormat = "yaml",
  project = OnboardedArtifactProject,
}: CreateOnboardedArtifactRuntimeOptions): OnboardedArtifactRuntime {
  return createSchemaIdeArtifactRuntime<AccountWorkspaceValue>({
    schema: OnboardedAccountWorkspaceSchema as any,
    relationSchema: OnboardedRelationWorkspaceSchema,
    relationValue: createOnboardedRelationWorkspace,
    files,
    activeFile,
    activeFormat: defaultFormat,
    project,
    workspaceId,
  });
}

export function createOnboardedArtifactRuntimeFromProjectConfig({
  config,
  files,
  activeFile = files[0]?.path ?? null,
}: {
  readonly config: OnboardedArtifactProjectConfig;
  readonly files: readonly SourceFile[];
  readonly activeFile?: string | null | undefined;
}): OnboardedArtifactRuntime {
  return createOnboardedArtifactRuntime({
    files,
    activeFile,
    workspaceId: config.id,
    defaultFormat: config.defaultFormat,
    project: createOnboardedArtifactProject(config),
  });
}
