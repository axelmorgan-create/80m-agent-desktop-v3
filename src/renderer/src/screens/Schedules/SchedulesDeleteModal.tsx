import type React from "react";
import { X } from "../../assets/icons";
import { useI18n } from "../../components/useI18n";

interface SchedulesDeleteModalProps {
  jobId: string;
  actionInProgress: string | null;
  onCancel: () => void;
  onRemove: (jobId: string) => void;
}

export function SchedulesDeleteModal({
  jobId,
  actionInProgress,
  onCancel,
  onRemove,
}: SchedulesDeleteModalProps): React.JSX.Element {
  const { t } = useI18n();

  return (
    <div className="skills-detail-overlay" onClick={onCancel}>
      <div
        className="schedules-modal schedules-modal-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="schedules-modal-header">
          <h3>{t("schedules.deleteTaskTitle")}</h3>
          <button className="btn-ghost" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <div className="schedules-modal-body">
          <p className="schedules-confirm-text">
            {t("schedules.deleteConfirmText")}
          </p>
        </div>
        <div className="schedules-modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onCancel}>
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => onRemove(jobId)}
            disabled={actionInProgress === jobId}
          >
            {actionInProgress === jobId
              ? t("schedules.deleting")
              : t("schedules.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
