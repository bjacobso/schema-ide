import { readFileSync } from "node:fs";
import { defineSchemaIdeWorkspace } from "@schema-ide/cli";
import {
  OnboardedAccountWorkspaceSchema,
  createOnboardedArtifactProject,
  parseOnboardedArtifactProjectConfig,
} from "../../src/index";

const artifactProjectConfig = parseOnboardedArtifactProjectConfig(
  readFileSync(new URL("./artifact-project.yaml", import.meta.url), "utf8"),
);

export default defineSchemaIdeWorkspace({
  id: artifactProjectConfig.id,
  schema: OnboardedAccountWorkspaceSchema,
  artifactProject: createOnboardedArtifactProject(artifactProjectConfig),
  defaultFormat: artifactProjectConfig.defaultFormat,
  include: artifactProjectConfig.include,
});
