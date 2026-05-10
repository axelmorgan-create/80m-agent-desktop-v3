import type React from "react";

export interface MemoryEntry {
  index: number;
  content: string;
}

export interface MemoryData {
  memory: {
    content: string;
    exists: boolean;
    lastModified: number | null;
    entries: MemoryEntry[];
    charCount: number;
    charLimit: number;
  };
  user: {
    content: string;
    exists: boolean;
    lastModified: number | null;
    charCount: number;
    charLimit: number;
  };
  stats: { totalSessions: number; totalMessages: number };
}

export interface FileNode {
  name: string;
  isDirectory: boolean;
  path: string;
}

export interface VaultIndexEntry {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  depth: number;
}

export interface GraphNote {
  id: string;
  path: string;
  name: string;
  relativePath: string;
  linkCount: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface NeuralVaultIndex {
  folders: VaultIndexEntry[];
  notes: VaultIndexEntry[];
  scannedEntries: number;
  truncated: boolean;
  graphNotes: GraphNote[];
  graphEdges: GraphEdge[];
}

export interface ObsidianVaultInfo {
  path: string | null;
  name: string;
  exists: boolean;
  noteCount: number;
  totalFiles: number;
}

export interface DocumentPreviewData {
  path: string;
  name: string;
  exists: boolean;
  kind:
    | "text"
    | "markdown"
    | "image"
    | "pdf"
    | "office"
    | "directory"
    | "binary"
    | "missing";
  size: number;
  fileUrl?: string;
  content?: string;
  truncated?: boolean;
  error?: string;
}

export interface MemoryProviderInfo {
  name: string;
  description: string;
  installed: boolean;
  active: boolean;
  envVars: string[];
}

export type NeuralClusterId =
  | "streams"
  | "sync"
  | "habits"
  | "projects"
  | "contacts"
  | "calendar"
  | "cortex"
  | "more"
  | "finance"
  | "daily"
  | "chat"
  | "agents"
  | "notes";

export interface NeuralClusterDefinition {
  id: NeuralClusterId;
  label: string;
  description: string;
  keywords: string[];
  icon: React.JSX.Element;
  x: number;
  y: number;
}

export interface NeuralCluster extends NeuralClusterDefinition {
  value: number;
  notes: VaultIndexEntry[];
  folders: VaultIndexEntry[];
}
