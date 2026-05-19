import type { SourceFile } from "@schema-ide/core";
import type { WorkspaceSchema } from "@schema-ide/core";
import {
  PromptEvalWorkspaceSchema,
  SurveyWorkspaceSchema,
  WorkflowWorkspaceSchema,
} from "./schemas";

export interface SchemaIdeExample {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly schema: WorkspaceSchema<unknown>;
  readonly files: readonly SourceFile[];
  readonly defaultFormat?: "json" | "yaml" | undefined;
  readonly suggestedPrompts?: readonly string[] | undefined;
}

export const schemaIdeExamples: readonly SchemaIdeExample[] = [
  {
    id: "prompt-evals-json",
    name: "Prompt Evals (JSON)",
    description: "Prompt definitions reference datasets and required template variables.",
    schema: PromptEvalWorkspaceSchema,
    defaultFormat: "json",
    suggestedPrompts: ["Fix the broken eval reference", "Add a regression dataset"],
    files: [
      {
        path: "prompts/support-router.json",
        content: JSON.stringify(
          {
            id: "support-router",
            description: "Route support requests to the right queue.",
            model: "openai/gpt-5.1",
            variables: ["ticket", "queues"],
            template: "Classify {{ticket}} into one of {{queues}}.",
          },
          null,
          2,
        ),
      },
      {
        path: "datasets/support-tickets.json",
        content: JSON.stringify(
          {
            id: "support-tickets",
            description: "Representative support routing cases.",
            cases: [
              {
                id: "refund-request",
                input: "I was charged twice for my subscription.",
                expected: "billing",
              },
            ],
          },
          null,
          2,
        ),
      },
      {
        path: "evals/support-routing.json",
        content: JSON.stringify(
          {
            id: "support-routing",
            title: "Support routing regression",
            promptId: "support-router",
            datasetId: "missing-support-tickets",
            requiredVariables: ["ticket", "queues"],
            checks: ["contains"],
          },
          null,
          2,
        ),
      },
    ],
  },
  {
    id: "prompt-evals-yaml",
    name: "Prompt Evals (YAML)",
    description: "The same prompt/eval workspace using YAML files.",
    schema: PromptEvalWorkspaceSchema,
    defaultFormat: "yaml",
    suggestedPrompts: ["Explain the cross-file validation error", "Add the missing variable"],
    files: [
      {
        path: "prompts/release-notes.yaml",
        content: [
          "id: release-notes",
          "description: Draft concise release notes from merged changes.",
          "model: anthropic/claude-sonnet-4.5",
          "variables:",
          "  - changes",
          "template: |",
          "  Write release notes for {{changes}}.",
          "",
        ].join("\n"),
      },
      {
        path: "datasets/release-changes.yaml",
        content: [
          "id: release-changes",
          "description: Small release note examples.",
          "cases:",
          "  - id: validation-copy",
          "    input: Added clearer validation errors.",
          "    expected: validation errors",
          "",
        ].join("\n"),
      },
      {
        path: "evals/release-notes.yaml",
        content: [
          "id: release-notes",
          "title: Release notes quality check",
          "promptId: release-notes",
          "datasetId: release-changes",
          "requiredVariables:",
          "  - changes",
          "  - tone",
          "checks:",
          "  - contains",
          "",
        ].join("\n"),
      },
    ],
  },
  {
    id: "survey-yaml",
    name: "Survey Builder (YAML)",
    description: "Surveys reference reusable question files.",
    schema: SurveyWorkspaceSchema,
    defaultFormat: "yaml",
    suggestedPrompts: ["Create a missing question file", "Summarize the survey schema"],
    files: [
      {
        path: "questions/name.yaml",
        content: "id: name\nprompt: What is your name?\nanswerType: text\n",
      },
      {
        path: "surveys/intake.yaml",
        content: "id: intake\ntitle: Intake Survey\nquestionIds:\n  - name\n  - missing-email\n",
      },
    ],
  },
  {
    id: "workflow-json",
    name: "Workflow Config (JSON)",
    description: "Workflows reference action definitions.",
    schema: WorkflowWorkspaceSchema,
    defaultFormat: "json",
    suggestedPrompts: ["Add the missing webhook action", "Find workflow validation issues"],
    files: [
      {
        path: "actions/notify-channel.json",
        content: JSON.stringify(
          { id: "notify-channel", kind: "email", label: "Notify release channel" },
          null,
          2,
        ),
      },
      {
        path: "workflows/release-checklist.json",
        content: JSON.stringify(
          {
            id: "release-checklist",
            name: "Release checklist",
            actionIds: ["notify-channel", "publish-changelog"],
          },
          null,
          2,
        ),
      },
    ],
  },
];

export function randomSchemaIdeExample(): SchemaIdeExample {
  return (
    schemaIdeExamples[Math.floor(Math.random() * schemaIdeExamples.length)] ?? schemaIdeExamples[0]!
  );
}
