import { defineSchemaIdeProject } from "@schema-ide/cli";
import { OnboardedArtifactProject } from "./artifacts";
import { OnboardedRelationWorkspaceSchema, createOnboardedRelationWorkspace } from "./relations";
import { OnboardedAccountWorkspaceBaseSchema, OnboardedAccountWorkspaceSchema } from "./workspace";

export const OnboardedConfigWorkspace = defineSchemaIdeProject({
  id: "onboarded-account-yaml",
  project: OnboardedArtifactProject,
  schema: OnboardedAccountWorkspaceSchema,
  relationInputSchema: OnboardedAccountWorkspaceBaseSchema as any,
  relationSchema: OnboardedRelationWorkspaceSchema,
  relationValue: createOnboardedRelationWorkspace,
  defaultFormat: "yaml",
  include: ["**/*.yaml", "**/*.pdf", "**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.webp"],
});
