export {
  normalizeLocalPath,
  readDesktopJson,
  resolveExistingLocalPath,
  writeDesktopJson,
} from "./desktop-config";
export {
  startWorkspaceWatch,
  stopWorkspaceWatch,
  type WorkspaceFileChange,
} from "./workspace-watch";
export {
  getDocumentPreview,
  writeDocumentContent,
  type DocumentPreview,
  type DocumentPreviewKind,
} from "./document-preview";
export { getObsidianVaultInfo, type ObsidianVaultInfo } from "./obsidian-vault";
export {
  audioExtensionFromMime,
  synthesizeSpeech,
  transcribeAudioFile,
  writeFloatWav,
} from "./desktop-audio";
