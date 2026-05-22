import { useMemo, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import MuiSelect, { type SelectChangeEvent } from "@mui/material/Select";
import MuiToggleButton from "@mui/material/ToggleButton";
import MuiToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import {
  Bug,
  ChevronDown,
  ChevronUp,
  FileCode2,
  FilePlus2,
  FolderTree,
  Save,
  Trash2,
} from "lucide-react";
import type { SchemaIdeChatAdapter } from "@schema-ide/agent";
import type {
  SchemaIdeDocumentFormat,
  SchemaIdeReflection,
  WorkspaceRouteMap,
} from "@schema-ide/core";
import type { SchemaIdeWorkspaceService } from "@schema-ide/protocol";
import { Effect } from "effect";
import { getSchemaIdeFileDiagnosticCounts } from "./diagnostics";
import {
  resolveSchemaIdePreview,
  type SchemaIdeEditorMode,
  type SchemaIdePreviewRegistration,
  type SchemaIdePreviewRegistrationForRoutes,
} from "./preview";
import { SchemaIdeChatPanel } from "./SchemaIdeChatPanel";
import { SchemaCodeMirrorEditor } from "./SchemaCodeMirrorEditor";
import { SchemaIdeFileTree } from "./SchemaIdeFileTree";
import { isPdfPath, SchemaIdePdfFileViewer } from "./SchemaIdePdfFileViewer";
import { SchemaIdePreviewView } from "./SchemaIdePreviewView";
import { useSchemaIdeWorkspaceStore } from "./workspace-store";
import { createSchemaIdeWorkspaceToolRuntime } from "./workspace-tool-runtime";

export interface SchemaIdeWorkspaceViewProps<Routes extends WorkspaceRouteMap = WorkspaceRouteMap> {
  readonly workspace: SchemaIdeWorkspaceService;
  readonly chat?: SchemaIdeChatAdapter | undefined;
  readonly title?: ReactNode | undefined;
  readonly showDebug?: boolean | undefined;
  readonly previews?: readonly SchemaIdePreviewRegistrationForRoutes<Routes>[] | undefined;
  readonly defaultMode?: SchemaIdeEditorMode | undefined;
}

export function SchemaIdeWorkspaceView<Routes extends WorkspaceRouteMap = WorkspaceRouteMap>({
  workspace,
  chat,
  title,
  showDebug = true,
  previews = [],
  defaultMode = "code",
}: SchemaIdeWorkspaceViewProps<Routes>) {
  const [editorMode, setEditorMode] = useState<SchemaIdeEditorMode>(defaultMode);
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(null);
  const [debugExpanded, setDebugExpanded] = useState(false);
  const {
    store,
    state,
    capabilities,
    snapshot,
    files,
    selectedFile,
    selectedIsDirty,
    selectedHasConflict,
    reflection,
    readOnly,
  } = useSchemaIdeWorkspaceStore(workspace);
  const fileDiagnosticCounts = useMemo(
    () => getSchemaIdeFileDiagnosticCounts(reflection?.diagnostics ?? []),
    [reflection?.diagnostics],
  );
  const dirtyPaths = useMemo(() => new Set(Object.keys(state.drafts)), [state.drafts]);
  const conflictPaths = useMemo(() => new Set(Object.keys(state.conflicts)), [state.conflicts]);
  const toolRuntime = useMemo(() => createSchemaIdeWorkspaceToolRuntime(store), [store]);
  const showChat = Boolean(chat && capabilities?.agent.enabled);
  const selectedFormat = formatForPath(selectedFile?.path);
  const selectedIsPdf = isPdfPath(selectedFile?.path);
  const previewResolution = useMemo(
    () =>
      reflection
        ? resolveSchemaIdePreview({
            previews: previews as unknown as readonly SchemaIdePreviewRegistration<
              unknown,
              string
            >[],
            reflection: reflection as SchemaIdeReflection,
            file: selectedFile,
            selectedPreviewId,
          })
        : null,
    [previews, reflection, selectedFile, selectedPreviewId],
  );

  if (!snapshot || !reflection) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading workspace...
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
        <div className="flex items-center gap-2 font-medium">
          <FileCode2 className="size-4" />
          {title ?? capabilities?.workspace.title ?? "Schema IDE"}
        </div>
        <Chip
          color={reflection.validationSummary.valid ? "secondary" : "error"}
          label={
            reflection.validationSummary.valid
              ? "Valid"
              : `${reflection.validationSummary.errorCount} errors`
          }
          size="small"
        />
        {capabilities && !capabilities.agent.enabled ? (
          <Chip className="ml-auto" label="Agent hidden" size="small" variant="outlined" />
        ) : null}
      </div>

      {state.error ? (
        <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {state.error}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {showChat && chat ? (
          <div className="min-h-0 shrink-0" style={{ width: 360 }}>
            <SchemaIdeChatPanel
              chat={chat}
              reflection={reflection as SchemaIdeReflection}
              tools={toolRuntime}
              readOnly={readOnly}
            />
          </div>
        ) : null}

        <div className="flex min-h-0 shrink-0 flex-col border-r" style={{ width: 280 }}>
          <div className="flex h-10 items-center gap-2 border-b px-3 text-sm font-medium">
            <FolderTree className="size-4" />
            Files
            <IconButton
              size="small"
              className="ml-auto"
              onClick={() => Effect.runFork(store.addFile)}
              disabled={readOnly}
              title="Add file"
            >
              <FilePlus2 className="size-3.5" />
            </IconButton>
          </div>
          <SchemaIdeFileTree
            files={files}
            activePath={selectedFile?.path}
            diagnosticCounts={fileDiagnosticCounts}
            dirtyPaths={dirtyPaths}
            conflictPaths={conflictPaths}
            onSelectFile={store.setActiveFile}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
            <div className="min-w-0 truncate font-mono text-xs">
              {selectedFile?.path ?? "No file"}
            </div>
            {selectedIsPdf ? (
              <Chip className="ml-auto" label="PDF" size="small" variant="outlined" />
            ) : (
              <MuiToggleButtonGroup
                aria-label="Editor mode"
                exclusive
                onChange={(_, value: SchemaIdeEditorMode | null) => {
                  if (value) setEditorMode(value);
                }}
                size="small"
                value={editorMode}
              >
                <MuiToggleButton value="code">Code</MuiToggleButton>
                <MuiToggleButton value="preview" disabled={!selectedFile}>
                  Preview
                </MuiToggleButton>
              </MuiToggleButtonGroup>
            )}
            {!selectedIsPdf && previewResolution && previewResolution.previews.length > 1 ? (
              <FormControl className="max-w-40" size="small">
                <MuiSelect
                  value={previewResolution.selected.id}
                  onChange={(event: SelectChangeEvent<string>) =>
                    setSelectedPreviewId(event.target.value)
                  }
                  inputProps={{ "aria-label": "Preview" }}
                >
                  {previewResolution.previews.map((preview) => (
                    <MenuItem key={preview.id} value={preview.id}>
                      {preview.label}
                    </MenuItem>
                  ))}
                </MuiSelect>
              </FormControl>
            ) : null}
            {selectedHasConflict ? (
              <Chip
                color="error"
                className={selectedIsPdf ? "text-[10px]" : "ml-auto text-[10px]"}
                label="External conflict"
                size="small"
              />
            ) : selectedIsDirty ? (
              <Chip
                color="secondary"
                className={selectedIsPdf ? "text-[10px]" : "ml-auto text-[10px]"}
                label="Unsaved"
                size="small"
              />
            ) : (
              <span className={selectedIsPdf ? "" : "ml-auto"} />
            )}
            <IconButton
              size="small"
              onClick={() => Effect.runFork(store.saveActiveFile)}
              disabled={readOnly || !selectedFile || !selectedIsDirty}
              title="Save file"
            >
              <Save className="size-3.5" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => Effect.runFork(store.deleteActiveFile)}
              disabled={readOnly || !selectedFile || !capabilities?.features.delete}
              title="Delete file"
            >
              <Trash2 className="size-3.5" />
            </IconButton>
          </div>

          {selectedFile && selectedIsPdf ? (
            <SchemaIdePdfFileViewer file={selectedFile} />
          ) : editorMode === "preview" && selectedFile ? (
            <SchemaIdePreviewView
              file={selectedFile}
              files={files}
              format={selectedFormat}
              reflection={reflection as SchemaIdeReflection}
              resolution={previewResolution}
              previews={
                previews as unknown as readonly SchemaIdePreviewRegistration<unknown, string>[]
              }
              readOnly={readOnly}
              onChange={store.updateActiveFile}
            />
          ) : (
            <SchemaCodeMirrorEditor
              value={selectedFile?.content ?? ""}
              path={selectedFile?.path ?? null}
              format={selectedFormat}
              reflection={reflection}
              readOnly={readOnly || !selectedFile}
              onChange={store.updateActiveFile}
              onSave={() => {
                Effect.runFork(store.saveActiveFile);
              }}
            />
          )}

          {showDebug ? (
            <div className="shrink-0 border-t">
              <div className="flex h-9 items-center gap-2 px-2">
                <Button
                  size="small"
                  variant="text"
                  color="inherit"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => setDebugExpanded((expanded) => !expanded)}
                >
                  <Bug className="size-3.5" />
                  Debug
                  {debugExpanded ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronUp className="size-3.5" />
                  )}
                </Button>
              </div>
              {debugExpanded ? (
                <div className="h-56 border-t">
                  <Box className="h-full" sx={{ overflow: "auto" }}>
                    <pre className="whitespace-pre-wrap p-3 text-xs">
                      {JSON.stringify(
                        {
                          revision: snapshot.revision,
                          capabilities,
                          diagnostics: reflection.diagnostics,
                          routeMatches: reflection.routeMatches,
                          schemas: reflection.schemas,
                          conflicts: state.conflicts,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </Box>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatForPath(path: string | null | undefined): SchemaIdeDocumentFormat {
  return path?.endsWith(".yaml") || path?.endsWith(".yml") ? "yaml" : "json";
}
