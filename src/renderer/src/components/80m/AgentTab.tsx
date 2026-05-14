import React from "react";
import { motion } from "framer-motion";

type AgentId =
  | "prawnius"
  | "claudnelius"
  | "knowledge_knaight"
  | "knaight_of_affairs"
  | "sirclawthchilds"
  | "labrina"
  | "clawdette";

interface AgentConfig {
  id: AgentId;
  name: string;
  color: string;
  icon: "Bot" | "PenTool" | "Search" | "CheckCircle2";
  role: string;
}

const AGENTS: AgentConfig[] = [
  {
    id: "prawnius",
    name: "Prawnius",
    color: "#00d4ff",
    icon: "Bot",
    role: "Quick Tasks",
  },
  {
    id: "claudnelius",
    name: "Claudnelius",
    color: "#06b6d4",
    icon: "PenTool",
    role: "Code & Design",
  },
  {
    id: "knowledge_knaight",
    name: "Knowledge Knaight",
    color: "#22d3ee",
    icon: "Search",
    role: "Cortex Keeper",
  },
  {
    id: "knaight_of_affairs",
    name: "Knaight of Affairs",
    color: "#38bdf8",
    icon: "CheckCircle2",
    role: "Scheduling",
  },
  {
    id: "sirclawthchilds",
    name: "Sir Clawthchilds",
    color: "#0ea5e9",
    icon: "CheckCircle2",
    role: "Finance",
  },
  {
    id: "labrina",
    name: "Labrina",
    color: "#14b8a6",
    icon: "PenTool",
    role: "Analytical",
  },
  {
    id: "clawdette",
    name: "Clawdette",
    color: "#0891b2",
    icon: "CheckCircle2",
    role: "Creative Ops",
  },
];

const ICONS: Record<AgentConfig["icon"], React.ReactNode> = {
  Bot: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 8V4H8" />
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M7 14h.01M12 14h.01M17 14h.01" />
    </svg>
  ),
  PenTool: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 19 7-7 3 3-7 7-3-3z" />
      <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="m2 2 7.586 7.586" />
      <circle cx="11" cy="11" r="2" />
    </svg>
  ),
  Search: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  ),
  CheckCircle2: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
};

interface AgentTabProps {
  agent: AgentConfig;
  isActive: boolean;
  isWorking: boolean;
  onClick: () => void;
}

export const AgentTab: React.FC<AgentTabProps> = ({
  agent,
  isActive,
  isWorking,
  onClick,
}) => {
  return (
    <motion.button
      className={`agent-tab${isActive ? " active" : ""}`}
      onClick={onClick}
      style={{ "--agent-color": agent.color } as React.CSSProperties}
      whileTap={{ scale: 0.95 }}
      title={`${agent.name} — ${agent.role}`}
    >
      <span className="agent-tab-icon" style={{ color: agent.color }}>
        {ICONS[agent.icon]}
      </span>
      <span className="agent-tab-name">{agent.name}</span>
      <span className={`agent-tab-status ${isWorking ? "working" : "idle"}`} />
    </motion.button>
  );
};

export { AGENTS };
export type { AgentId, AgentConfig };
