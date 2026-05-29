import { defineSchemaIdeWorkspace } from "@schema-ide/cli";
import { PromptEvalArtifactProject, PromptEvalWorkspaceSchema } from "../../src/schemas";

export default defineSchemaIdeWorkspace({
  id: "prompt-evals-yaml",
  schema: PromptEvalWorkspaceSchema,
  artifactProject: PromptEvalArtifactProject,
  defaultFormat: "yaml",
  include: ["**/*.yaml"],
});
