import { defineSchemaIdeWorkspace } from "@schema-ide/cli";
import { PromptEvalArtifactProject, PromptEvalWorkspaceSchema } from "../../src/schemas";

export default defineSchemaIdeWorkspace({
  id: "prompt-evals-json",
  schema: PromptEvalWorkspaceSchema,
  artifactProject: PromptEvalArtifactProject,
  defaultFormat: "json",
  include: ["**/*.json"],
});
