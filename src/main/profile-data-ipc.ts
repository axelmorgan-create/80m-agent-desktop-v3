import { ipcMain } from "electron";
import {
  createProfile,
  deleteProfile,
  listProfiles,
  setActiveProfile,
  type ProfileCreateOptions,
} from "./profiles";
import { getSessionMessages, listSessions, searchSessions } from "./sessions";
import {
  listCachedSessions,
  syncSessionCache,
  updateSessionTitle,
} from "./session-cache";
import { getSessionProfiles } from "./session-profiles";
import {
  addMemoryEntry,
  readMemory,
  removeMemoryEntry,
  updateMemoryEntry,
  writeUserProfile,
} from "./memory";
import { readSoul, resetSoul, writeSoul } from "./soul";
import {
  getSkillContent,
  installSkill,
  listBundledSkills,
  listInstalledSkills,
  uninstallSkill,
} from "./skills";
import { getToolsets, setToolsetEnabled } from "./tools";

export function registerProfileDataIpc(
  emitProfilesChanged: (source: string) => void,
): void {
  ipcMain.handle(
    "list-sessions",
    (_event, limit?: number, offset?: number, profile?: string) =>
      listSessions(limit, offset, profile),
  );
  ipcMain.handle(
    "get-session-messages",
    (_event, sessionId: string, profile?: string) =>
      getSessionMessages(sessionId, profile),
  );

  ipcMain.handle("list-profiles", async () => listProfiles());
  ipcMain.handle(
    "create-profile",
    async (_event, name: string, options?: boolean | ProfileCreateOptions) => {
      const result = await createProfile(name, options);
      if (result.success) emitProfilesChanged("create-profile");
      return result;
    },
  );
  ipcMain.handle("delete-profile", (_event, name: string) => {
    const result = deleteProfile(name);
    if (result.success) emitProfilesChanged("delete-profile");
    return result;
  });
  ipcMain.handle("set-active-profile", (_event, name: string) => {
    setActiveProfile(name);
    emitProfilesChanged("set-active-profile");
    return true;
  });

  ipcMain.handle("read-memory", (_event, profile?: string) =>
    readMemory(profile),
  );
  ipcMain.handle(
    "add-memory-entry",
    (_event, content: string, profile?: string) =>
      addMemoryEntry(content, profile),
  );
  ipcMain.handle(
    "update-memory-entry",
    (_event, index: number, content: string, profile?: string) =>
      updateMemoryEntry(index, content, profile),
  );
  ipcMain.handle(
    "remove-memory-entry",
    (_event, index: number, profile?: string) =>
      removeMemoryEntry(index, profile),
  );
  ipcMain.handle(
    "write-user-profile",
    (_event, content: string, profile?: string) =>
      writeUserProfile(content, profile),
  );

  ipcMain.handle("read-soul", (_event, profile?: string) => readSoul(profile));
  ipcMain.handle("write-soul", (_event, content: string, profile?: string) =>
    writeSoul(content, profile),
  );
  ipcMain.handle("reset-soul", (_event, profile?: string) =>
    resetSoul(profile),
  );

  ipcMain.handle("get-toolsets", (_event, profile?: string) =>
    getToolsets(profile),
  );
  ipcMain.handle(
    "set-toolset-enabled",
    (_event, key: string, enabled: boolean, profile?: string) =>
      setToolsetEnabled(key, enabled, profile),
  );

  ipcMain.handle("list-installed-skills", (_event, profile?: string) =>
    listInstalledSkills(profile),
  );
  ipcMain.handle("list-bundled-skills", () => listBundledSkills());
  ipcMain.handle("get-skill-content", (_event, skillPath: string) =>
    getSkillContent(skillPath),
  );
  ipcMain.handle(
    "install-skill",
    (_event, identifier: string, profile?: string) =>
      installSkill(identifier, profile),
  );
  ipcMain.handle("uninstall-skill", (_event, name: string, profile?: string) =>
    uninstallSkill(name, profile),
  );

  ipcMain.handle(
    "list-cached-sessions",
    (_event, limit?: number, offset?: number, profile?: string) =>
      listCachedSessions(limit, offset, profile),
  );
  ipcMain.handle("sync-session-cache", (_event, profile?: string) =>
    syncSessionCache(profile),
  );
  ipcMain.handle(
    "update-session-title",
    (_event, sessionId: string, title: string, profile?: string) =>
      updateSessionTitle(sessionId, title, profile),
  );
  ipcMain.handle(
    "search-sessions",
    (_event, query: string, limit?: number, profile?: string) =>
      searchSessions(query, limit, profile),
  );
  ipcMain.handle("get-session-profiles", () => getSessionProfiles());
}
