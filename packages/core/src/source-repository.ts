import type { SourceFile, SourceTree } from "./types";
import {
  deleteFile as deleteVirtualFile,
  sourceFilesToVirtualFs,
  virtualFsToSourceTree,
  writeFile as writeVirtualFile,
  type VirtualFSState,
} from "./virtual-fs";

export interface SourceRepository {
  readonly readTree: () => SourceTree;
  readonly writeFile: (file: SourceFile) => void;
  readonly deleteFile: (path: string) => void;
  readonly replaceTree: (tree: SourceTree) => void;
}

export function createMemorySourceRepository({
  getFs,
  setFs,
}: {
  readonly getFs: () => VirtualFSState;
  readonly setFs: (fs: VirtualFSState) => void;
}): SourceRepository {
  return {
    readTree: () => virtualFsToSourceTree(getFs()),
    writeFile: (file) => setFs(writeVirtualFile(getFs(), file.path, file.content)),
    deleteFile: (path) => setFs(deleteVirtualFile(getFs(), path)),
    replaceTree: (tree) => setFs(sourceFilesToVirtualFs(tree.files)),
  };
}
