import {
  Brain,
  Calendar,
  CheckCircle2,
  CircleEllipsis,
  DollarSign,
  FileText,
  Folder,
  MessageSquare,
  Radio,
  RefreshCw,
  User,
  Users,
} from "lucide-react";
import type {
  NeuralCluster,
  NeuralClusterDefinition,
  NeuralVaultIndex,
} from "./memoryTypes";
import { entryMatchesCluster } from "./memoryUtils";

export function buildNeuralClusterDefinitions(): NeuralClusterDefinition[] {
  return [
    {
      id: "streams",
      label: "Inbox",
      description: "Captures, sparks, voice notes, and unprocessed inputs.",
      keywords: [
        "inbox",
        "capture",
        "captures",
        "spark",
        "sparks",
        "voice",
        "stream",
        "input",
      ],
      icon: <Radio size={18} />,
      x: 18,
      y: 34,
    },
    {
      id: "sync",
      label: "Vault Sync",
      description:
        "Every indexed markdown note in the configured Obsidian vault.",
      keywords: [],
      icon: <RefreshCw size={18} />,
      x: 38,
      y: 22,
    },
    {
      id: "habits",
      label: "Tasks",
      description: "Tasks, habits, todos, active work, and Kanban material.",
      keywords: [
        "task",
        "tasks",
        "todo",
        "todos",
        "habit",
        "habits",
        "kanban",
        "active task",
      ],
      icon: <CheckCircle2 size={18} />,
      x: 53,
      y: 17,
    },
    {
      id: "projects",
      label: "Projects",
      description: "Client work, project folders, roadmaps, and deliverables.",
      keywords: [
        "project",
        "projects",
        "client",
        "clients",
        "roadmap",
        "deliverable",
        "launch",
        "work",
      ],
      icon: <Folder size={18} />,
      x: 67,
      y: 25,
    },
    {
      id: "contacts",
      label: "People",
      description:
        "Contacts, client profiles, teams, vendors, and people notes.",
      keywords: [
        "people",
        "person",
        "contact",
        "contacts",
        "client",
        "clients",
        "team",
        "vendor",
        "crm",
      ],
      icon: <Users size={18} />,
      x: 83,
      y: 36,
    },
    {
      id: "calendar",
      label: "Calendar",
      description:
        "Dates, daily logs, weekly reviews, meetings, and schedules.",
      keywords: [
        "calendar",
        "schedule",
        "meeting",
        "meetings",
        "event",
        "events",
        "weekly",
        "monthly",
        "review",
      ],
      icon: <Calendar size={18} />,
      x: 82,
      y: 50,
    },
    {
      id: "cortex",
      label: "Knowledge",
      description:
        "Research, indexes, MOCs, reference notes, and second-brain material.",
      keywords: [
        "cortex",
        "knowledge",
        "research",
        "reference",
        "index",
        "moc",
        "wiki",
        "second brain",
        "memory",
      ],
      icon: <Brain size={18} />,
      x: 78,
      y: 62,
    },
    {
      id: "more",
      label: "Unsorted",
      description: "Vault notes that did not match a focused brain area yet.",
      keywords: [],
      icon: <CircleEllipsis size={18} />,
      x: 86,
      y: 78,
    },
    {
      id: "finance",
      label: "Finance",
      description:
        "Money, transactions, invoices, billing, budgets, and tax notes.",
      keywords: [
        "finance",
        "money",
        "transaction",
        "transactions",
        "invoice",
        "invoices",
        "billing",
        "budget",
        "tax",
        "stripe",
        "sales",
      ],
      icon: <DollarSign size={18} />,
      x: 63,
      y: 80,
    },
    {
      id: "daily",
      label: "Daily",
      description:
        "Daily notes, journals, logs, and personal operating rhythm.",
      keywords: [
        "daily",
        "journal",
        "journals",
        "log",
        "logs",
        "today",
        "morning",
        "evening",
      ],
      icon: <Calendar size={18} />,
      x: 45,
      y: 86,
    },
    {
      id: "chat",
      label: "Chat",
      description:
        "Chat sessions, transcripts, messages, and agent conversations.",
      keywords: [
        "chat",
        "chats",
        "conversation",
        "conversations",
        "message",
        "messages",
        "session",
        "sessions",
        "transcript",
      ],
      icon: <MessageSquare size={18} />,
      x: 28,
      y: 73,
    },
    {
      id: "agents",
      label: "Agents",
      description:
        "Agent rosters, assistant profiles, Hermes notes, and automations.",
      keywords: [
        "agent",
        "agents",
        "assistant",
        "assistants",
        "hermes",
        "profile",
        "profiles",
        "round table",
        "automation",
      ],
      icon: <User size={18} />,
      x: 18,
      y: 61,
    },
    {
      id: "notes",
      label: "Notes",
      description: "All indexed markdown notes from the selected vault.",
      keywords: [],
      icon: <FileText size={18} />,
      x: 17,
      y: 47,
    },
  ];
}

export function buildNeuralNodes(
  vaultIndex: NeuralVaultIndex,
  vaultNoteCount = 0,
): NeuralCluster[] {
  const definitions = buildNeuralClusterDefinitions();
  const specificVaultClusters = definitions.filter(
    (cluster) => !["sync", "more", "notes"].includes(cluster.id),
  );
  const unassignedNotes = vaultIndex.notes.filter(
    (note) =>
      !specificVaultClusters.some((cluster) =>
        entryMatchesCluster(note, cluster),
      ),
  );
  const unassignedFolders = vaultIndex.folders.filter(
    (folder) =>
      !specificVaultClusters.some((cluster) =>
        entryMatchesCluster(folder, cluster),
      ),
  );

  return definitions.map((cluster) => {
    const notes =
      cluster.id === "more"
        ? unassignedNotes
        : vaultIndex.notes.filter((note) => entryMatchesCluster(note, cluster));
    const folders =
      cluster.id === "more"
        ? unassignedFolders
        : vaultIndex.folders.filter((folder) =>
            entryMatchesCluster(folder, cluster),
          );
    const value =
      cluster.id === "sync" || cluster.id === "notes"
        ? vaultIndex.notes.length || vaultNoteCount
        : notes.length || folders.length;
    return { ...cluster, value, notes, folders };
  });
}
