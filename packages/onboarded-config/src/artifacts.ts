import {
  createSchemaIdeArtifactRuntime,
  type SchemaIdeArtifactRuntime,
  type SourceFile,
} from "@schema-ide/core";
import { OnboardedRelationWorkspaceSchema, createOnboardedRelationWorkspace } from "./relations";
import { OnboardedAccountWorkspaceSchema, type AccountWorkspaceValue } from "./workspace";

export interface CreateOnboardedArtifactRuntimeOptions {
  readonly files: readonly SourceFile[];
  readonly activeFile?: string | null | undefined;
  readonly workspaceId?: string | undefined;
}

export type OnboardedArtifactRuntime = SchemaIdeArtifactRuntime<AccountWorkspaceValue>;

export function createOnboardedArtifactRuntime({
  files,
  activeFile = files[0]?.path ?? null,
  workspaceId = "onboarded-account-yaml",
}: CreateOnboardedArtifactRuntimeOptions): OnboardedArtifactRuntime {
  return createSchemaIdeArtifactRuntime({
    schema: OnboardedAccountWorkspaceSchema,
    relationSchema: OnboardedRelationWorkspaceSchema,
    relationValue: createOnboardedRelationWorkspace,
    files,
    activeFile,
    activeFormat: "yaml",
    workspaceId,
  });
}
