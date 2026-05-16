import {
  Activity,
  BookOpen,
  Download,
  ShieldCheck,
  Smartphone,
  User,
  Wifi,
  Info,
  Sparkles,
} from "lucide-react";

export type SettingsTabId =
  | "overview"
  | "connection"
  | "mobile"
  | "health"
  | "notebooklm"
  | "curator"
  | "profiles"
  | "backup"
  | "about";

export const SETTINGS_TABS: {
  id: SettingsTabId;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: "overview", label: "Overview", icon: <Activity size={14} /> },
  { id: "connection", label: "Connection", icon: <Wifi size={14} /> },
  { id: "mobile", label: "Mobile", icon: <Smartphone size={14} /> },
  { id: "health", label: "Health", icon: <ShieldCheck size={14} /> },
  { id: "notebooklm", label: "NotebookLM", icon: <BookOpen size={14} /> },
  { id: "curator", label: "Curator", icon: <Sparkles size={14} /> },
  { id: "profiles", label: "Profiles", icon: <User size={14} /> },
  { id: "backup", label: "Backup", icon: <Download size={14} /> },
  { id: "about", label: "About", icon: <Info size={14} /> },
];
