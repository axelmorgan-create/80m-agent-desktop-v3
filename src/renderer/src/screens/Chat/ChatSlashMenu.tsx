import type { RefObject } from "react";
import { Slash } from "lucide-react";
import { useI18n } from "../../components/useI18n";
import type { SlashCommand } from "./chatTypes";

interface ChatSlashMenuProps {
  commands: SlashCommand[];
  menuRef: RefObject<HTMLDivElement | null>;
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  onSelect: (command: SlashCommand) => void;
}

export function ChatSlashMenu({
  commands,
  menuRef,
  selectedIndex,
  setSelectedIndex,
  onSelect,
}: ChatSlashMenuProps): React.JSX.Element {
  const { t } = useI18n();

  return (
    <div className="slash-menu" ref={menuRef}>
      <div className="slash-menu-header">
        <Slash size={12} />
        {t("chat.commandsTitle")}
      </div>
      <div className="slash-menu-list">
        {commands.map((cmd, i) => (
          <button
            key={cmd.name}
            className={`slash-menu-item ${i === selectedIndex ? "slash-menu-item-active" : ""}`}
            onMouseEnter={() => setSelectedIndex(i)}
            onClick={() => onSelect(cmd)}
          >
            <span className="slash-menu-item-name">{cmd.name}</span>
            <span className="slash-menu-item-desc">{cmd.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
