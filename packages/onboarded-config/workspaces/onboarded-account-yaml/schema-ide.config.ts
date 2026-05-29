import { readFileSync } from "node:fs";
import { defineSchemaIdeProject } from "@schema-ide/cli";
import {
  OnboardedAccountWorkspaceBaseSchema,
  OnboardedAccountWorkspaceSchema,
  OnboardedRelationWorkspaceSchema,
  createOnboardedArtifactProject,
  createOnboardedRelationWorkspace,
  parseOnboardedArtifactProjectConfig,
} from "../../src/index";

const artifactProjectConfig = parseOnboardedArtifactProjectConfig(
  readFileSync(new URL("./artifact-project.yaml", import.meta.url), "utf8"),
);

export default defineSchemaIdeProject({
  id: artifactProjectConfig.id,
  project: createOnboardedArtifactProject(artifactProjectConfig),
  schema: OnboardedAccountWorkspaceSchema,
  relationInputSchema: OnboardedAccountWorkspaceBaseSchema as any,
  relationSchema: OnboardedRelationWorkspaceSchema,
  relationValue: createOnboardedRelationWorkspace,
  defaultFormat: artifactProjectConfig.defaultFormat,
  include: artifactProjectConfig.include,
});
