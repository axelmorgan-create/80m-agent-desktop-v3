import { useI18n } from "../../components/useI18n";
import type { MemoryData } from "./memoryTypes";

interface MemoryUserProfilePanelProps {
  user: MemoryData["user"];
  userContent: string;
  userEditing: boolean;
  userSaved: boolean;
  setUserContent: (value: string) => void;
  setUserEditing: (value: boolean) => void;
  onSaveUserProfile: () => void;
}

export function MemoryUserProfilePanel({
  user,
  userContent,
  userEditing,
  userSaved,
  setUserContent,
  setUserEditing,
  onSaveUserProfile,
}: MemoryUserProfilePanelProps): React.JSX.Element {
  const { t } = useI18n();

  return (
    <div className="memory-profile">
      <div className="memory-profile-header">
        <span className="memory-profile-hint">
          {t("memory.userProfileHint")}
        </span>
        {userSaved && (
          <span
            style={{
              color: "var(--success)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {t("common.saved")}
          </span>
        )}
      </div>
      <textarea
        className="memory-profile-textarea"
        value={userContent}
        onChange={(e) => {
          setUserContent(e.target.value);
          setUserEditing(true);
        }}
        placeholder={t("memory.userProfilePlaceholder")}
        rows={8}
      />
      <div className="memory-profile-footer">
        <span className="memory-entry-chars">
          {t("memory.chars", { count: userContent.length })} / {user.charLimit}{" "}
          {t("memory.chars", { count: 1 }).split(" ")[1]}
        </span>
        {userEditing && (
          <button
            className="btn btn-primary btn-sm"
            onClick={onSaveUserProfile}
          >
            {t("memory.saveProfile")}
          </button>
        )}
      </div>
    </div>
  );
}
