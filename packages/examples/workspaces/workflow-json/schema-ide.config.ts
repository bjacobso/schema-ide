import { defineSchemaIdeWorkspace } from "@schema-ide/cli";
import { WorkflowArtifactProject, WorkflowWorkspaceSchema } from "../../src/schemas";

export default defineSchemaIdeWorkspace({
  id: "workflow-json",
  schema: WorkflowWorkspaceSchema,
  artifactProject: WorkflowArtifactProject,
  defaultFormat: "json",
  include: ["**/*.json"],
});
