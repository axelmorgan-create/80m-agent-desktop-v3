import type { RefObject } from "react";
import {
  Bell,
  ChartLine,
  Clock,
  Code,
  Mail,
  Search,
} from "lucide-react";
import icon from "../../assets/icon.png";
import { useI18n } from "../../components/useI18n";

interface ChatEmptyStateProps {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  setInput: (value: string) => void;
}

export function ChatEmptyState({
  inputRef,
  setInput,
}: ChatEmptyStateProps): React.JSX.Element {
  const { t } = useI18n();
  const suggestions = [
    {
      icon: <Search size={16} />,
      label: t("chat.suggestionSearch"),
      prompt: "Search the web for today's top tech news",
    },
    {
      icon: <Bell size={16} />,
      label: t("chat.suggestionReminder"),
      prompt: "Set a reminder to check emails every day at 9 AM",
    },
    {
      icon: <Mail size={16} />,
      label: t("chat.suggestionEmail"),
      prompt: "Read my latest emails and summarize them",
    },
    {
      icon: <Code size={16} />,
      label: t("chat.suggestionScript"),
      prompt: "Write a Python script to rename all files in a folder",
    },
    {
      icon: <Clock size={16} />,
      label: t("chat.suggestionSchedule"),
      prompt: "Schedule a cron job to back up my database every night",
    },
    {
      icon: <ChartLine size={16} />,
      label: t("chat.suggestionAnalyze"),
      prompt: "Analyze this CSV file and show key insights",
    },
  ];

  return (
    <div className="chat-empty">
      <div className="chat-empty-icon">
        <img src={icon} width={64} height={64} alt="" />
      </div>
      <div className="chat-empty-text">{t("chat.emptyTitle")}</div>
      <div className="chat-empty-hint">{t("chat.emptyHint")}</div>
      <div className="chat-empty-suggestions">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.label}
            className="chat-suggestion"
            onClick={() => {
              setInput(suggestion.prompt);
              inputRef.current?.focus();
            }}
          >
            {suggestion.icon}
            {suggestion.label}
          </button>
        ))}
      </div>
    </div>
  );
}
