import type {
  ProfileInfo,
  ProfileCreateOptions,
  ProfileCreateResult,
  ProfilesChangedEvent,
} from "./hermes-api-common.types";

export interface HermesWorkspaceAPI {
  // Sessions
  listSessions: (
    limit?: number,
    offset?: number,
    profile?: string,
  ) => Promise<
    Array<{
      id: string;
      profile: string;
      source: string;
      startedAt: number;
      updatedAt: number;
      endedAt: number | null;
      messageCount: number;
      model: string;
      title: string | null;
      preview: string;
    }>
  >;
  getSessionMessages: (
    sessionId: string,
    profile?: string,
  ) => Promise<
    Array<{
      id: number;
      role: "user" | "assistant" | "tool";
      content: string;
      timestamp: number;
      tool_calls?: string;
      tool_name?: string;
    }>
  >;

  // Profiles
  listProfiles: () => Promise<ProfileInfo[]>;
  createProfile: (
    name: string,
    options?: boolean | ProfileCreateOptions,
  ) => Promise<ProfileCreateResult>;
  deleteProfile: (
    name: string,
  ) => Promise<{ success: boolean; error?: string }>;
  setActiveProfile: (name: string) => Promise<boolean>;
  onProfilesChanged: (
    callback: (event: ProfilesChangedEvent) => void,
  ) => () => void;

  // Projects Sidebar
  selectProjectDirectory: () => Promise<string | null>;
  readDirectory: (
    dirPath: string,
  ) => Promise<Array<{ name: string; isDirectory: boolean; path: string }>>;
  getObsidianVault: () => Promise<{
    path: string | null;
    name: string;
    exists: boolean;
    noteCount: number;
    totalFiles: number;
  }>;
  setObsidianVault: (path: string) => Promise<{
    path: string | null;
    name: string;
    exists: boolean;
    noteCount: number;
    totalFiles: number;
  }>;

  // Memory
  readMemory: (profile?: string) => Promise<{
    memory: { content: string; exists: boolean; lastModified: number | null };
    user: { content: string; exists: boolean; lastModified: number | null };
    stats: { totalSessions: number; totalMessages: number };
  }>;

  addMemoryEntry: (
    content: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  updateMemoryEntry: (
    index: number,
    content: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  removeMemoryEntry: (index: number, profile?: string) => Promise<boolean>;
  writeUserProfile: (
    content: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;

  // Soul
  readSoul: (profile?: string) => Promise<string>;
  writeSoul: (content: string, profile?: string) => Promise<boolean>;
  resetSoul: (profile?: string) => Promise<string>;

  // Tools
  getToolsets: (
    profile?: string,
  ) => Promise<
    Array<{ key: string; label: string; description: string; enabled: boolean }>
  >;
  setToolsetEnabled: (
    key: string,
    enabled: boolean,
    profile?: string,
  ) => Promise<boolean>;

  // Skills
  listInstalledSkills: (
    profile?: string,
  ) => Promise<
    Array<{ name: string; category: string; description: string; path: string }>
  >;
  listBundledSkills: () => Promise<
    Array<{
      name: string;
      description: string;
      category: string;
      source: string;
      installed: boolean;
    }>
  >;
  getSkillContent: (skillPath: string) => Promise<string>;
  installSkill: (
    identifier: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  uninstallSkill: (
    name: string,
    profile?: string,
  ) => Promise<{ success: boolean; error?: string }>;

  // Session cache
  listCachedSessions: (
    limit?: number,
    offset?: number,
    profile?: string,
  ) => Promise<
    Array<{
      id: string;
      profile: string;
      title: string;
      startedAt: number;
      updatedAt: number;
      source: string;
      messageCount: number;
      model: string;
    }>
  >;
  syncSessionCache: (profile?: string) => Promise<
    Array<{
      id: string;
      profile: string;
      title: string;
      startedAt: number;
      updatedAt: number;
      source: string;
      messageCount: number;
      model: string;
    }>
  >;
  updateSessionTitle: (
    sessionId: string,
    title: string,
    profile?: string,
  ) => Promise<void>;

  // Session search
  searchSessions: (
    query: string,
    limit?: number,
    profile?: string,
  ) => Promise<
    Array<{
      sessionId: string;
      profile: string;
      title: string | null;
      startedAt: number;
      updatedAt: number;
      source: string;
      messageCount: number;
      model: string;
      snippet: string;
    }>
  >;

  // Session profile mapping
  getSessionProfiles: () => Promise<Record<string, string>>;

  // Credential Pool
  getCredentialPool: () => Promise<
    Record<string, Array<Record<string, unknown>>>
  >;
  setCredentialPool: (
    provider: string,
    entries: Array<Record<string, unknown>>,
  ) => Promise<boolean>;

  // Models
  listModels: () => Promise<
    Array<{
      id: string;
      name: string;
      provider: string;
      model: string;
      baseUrl: string;
      createdAt: number;
    }>
  >;
  listModelCatalog: () => Promise<
    Array<{
      provider: string;
      model: string;
      name: string;
      description: string;
      baseUrl: string;
      source: "catalog" | "fallback";
    }>
  >;
  addModel: (
    name: string,
    provider: string,
    model: string,
    baseUrl: string,
  ) => Promise<{
    id: string;
    name: string;
    provider: string;
    model: string;
    baseUrl: string;
    createdAt: number;
  }>;
  removeModel: (id: string) => Promise<boolean>;
  updateModel: (id: string, fields: Record<string, string>) => Promise<boolean>;
}
