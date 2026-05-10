import type React from "react";
import type { Dispatch, SetStateAction } from "react";
import { X } from "../../assets/icons";
import { useI18n } from "../../components/useI18n";
import { DELIVER_TARGETS, type FrequencyType } from "./schedulesTypes";

interface SchedulesCreateModalProps {
  newName: string;
  setNewName: Dispatch<SetStateAction<string>>;
  newPrompt: string;
  setNewPrompt: Dispatch<SetStateAction<string>>;
  newDeliver: string;
  setNewDeliver: Dispatch<SetStateAction<string>>;
  newNoAgent: boolean;
  setNewNoAgent: Dispatch<SetStateAction<boolean>>;
  newScript: string;
  setNewScript: Dispatch<SetStateAction<string>>;
  newWorkdir: string;
  setNewWorkdir: Dispatch<SetStateAction<string>>;
  frequency: FrequencyType;
  setFrequency: Dispatch<SetStateAction<FrequencyType>>;
  minutesInterval: string;
  setMinutesInterval: Dispatch<SetStateAction<string>>;
  hourlyInterval: string;
  setHourlyInterval: Dispatch<SetStateAction<string>>;
  dailyTime: string;
  setDailyTime: Dispatch<SetStateAction<string>>;
  weeklyDay: string;
  setWeeklyDay: Dispatch<SetStateAction<string>>;
  weeklyTime: string;
  setWeeklyTime: Dispatch<SetStateAction<string>>;
  customCron: string;
  setCustomCron: Dispatch<SetStateAction<string>>;
  isScheduleValid: boolean;
  actionInProgress: string | null;
  onClose: () => void;
  onCreate: () => void;
}

export function SchedulesCreateModal({
  newName,
  setNewName,
  newPrompt,
  setNewPrompt,
  newDeliver,
  setNewDeliver,
  newNoAgent,
  setNewNoAgent,
  newScript,
  setNewScript,
  newWorkdir,
  setNewWorkdir,
  frequency,
  setFrequency,
  minutesInterval,
  setMinutesInterval,
  hourlyInterval,
  setHourlyInterval,
  dailyTime,
  setDailyTime,
  weeklyDay,
  setWeeklyDay,
  weeklyTime,
  setWeeklyTime,
  customCron,
  setCustomCron,
  isScheduleValid,
  actionInProgress,
  onClose,
  onCreate,
}: SchedulesCreateModalProps): React.JSX.Element {
  const { t } = useI18n();

  return (
    <div className="skills-detail-overlay" onClick={onClose}>
      <div className="schedules-modal" onClick={(e) => e.stopPropagation()}>
        <div className="schedules-modal-header">
          <h3>{t("schedules.newTask")}</h3>
          <button className="btn-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="schedules-modal-body">
          <div className="schedules-field">
            <label className="schedules-field-label">
              {t("schedules.name")}
            </label>
            <input
              className="input"
              type="text"
              placeholder={t("schedules.namePlaceholder")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="schedules-field">
            <label className="schedules-field-label">
              {t("schedules.frequency")}{" "}
              <span className="schedules-required">*</span>
            </label>
            <div className="schedules-freq-pills">
              {(
                [
                  ["minutes", t("schedules.frequencyMinutes")],
                  ["hourly", t("schedules.frequencyHourly")],
                  ["daily", t("schedules.frequencyDaily")],
                  ["weekly", t("schedules.frequencyWeekly")],
                  ["custom", t("schedules.frequencyCustom")],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  className={`schedules-freq-pill ${frequency === val ? "active" : ""}`}
                  onClick={() => setFrequency(val)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {frequency === "minutes" && (
            <div className="schedules-field">
              <label className="schedules-field-label">
                {t("schedules.minutesInterval")}
              </label>
              <select
                className="input"
                value={minutesInterval}
                onChange={(e) => setMinutesInterval(e.target.value)}
              >
                {["5", "10", "15", "30", "45"].map((v) => (
                  <option key={v} value={v}>
                    {t("schedules.everyNMinutes", { n: v })}
                  </option>
                ))}
              </select>
            </div>
          )}

          {frequency === "hourly" && (
            <div className="schedules-field">
              <label className="schedules-field-label">
                {t("schedules.hoursInterval")}
              </label>
              <select
                className="input"
                value={hourlyInterval}
                onChange={(e) => setHourlyInterval(e.target.value)}
              >
                {["1", "2", "3", "4", "6", "8", "12"].map((v) => (
                  <option key={v} value={v}>
                    {t("schedules.everyNHours", { n: v })}
                  </option>
                ))}
              </select>
            </div>
          )}

          {frequency === "daily" && (
            <div className="schedules-field">
              <label className="schedules-field-label">
                {t("schedules.executionTime")}
              </label>
              <input
                className="input"
                type="time"
                value={dailyTime}
                onChange={(e) => setDailyTime(e.target.value)}
              />
            </div>
          )}

          {frequency === "weekly" && (
            <>
              <div className="schedules-field">
                <label className="schedules-field-label">
                  {t("schedules.weekday")}
                </label>
                <select
                  className="input"
                  value={weeklyDay}
                  onChange={(e) => setWeeklyDay(e.target.value)}
                >
                  {[
                    ["1", t("schedules.monday")],
                    ["2", t("schedules.tuesday")],
                    ["3", t("schedules.wednesday")],
                    ["4", t("schedules.thursday")],
                    ["5", t("schedules.friday")],
                    ["6", t("schedules.saturday")],
                    ["0", t("schedules.sunday")],
                  ].map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="schedules-field">
                <label className="schedules-field-label">
                  {t("schedules.executionTime")}
                </label>
                <input
                  className="input"
                  type="time"
                  value={weeklyTime}
                  onChange={(e) => setWeeklyTime(e.target.value)}
                />
              </div>
            </>
          )}

          {frequency === "custom" && (
            <div className="schedules-field">
              <label className="schedules-field-label">
                {t("schedules.cronExpression")}
              </label>
              <input
                className="input"
                type="text"
                placeholder={t("schedules.cronPlaceholder")}
                value={customCron}
                onChange={(e) => setCustomCron(e.target.value)}
              />
              <div className="schedules-field-hint">
                {t("schedules.cronHint")}
              </div>
            </div>
          )}
          <div className="schedules-field">
            <label className="schedules-field-label">
              {t("schedules.prompt")}
            </label>
            <textarea
              className="input schedules-textarea"
              placeholder={t("schedules.promptPlaceholder")}
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              rows={3}
            />
          </div>
          <div className="schedules-field">
            <label className="schedules-field-label">v0.13 Watchdog</label>
            <label className="schedules-check-row">
              <input
                type="checkbox"
                checked={newNoAgent}
                onChange={(e) => setNewNoAgent(e.target.checked)}
              />
              Run script without an agent
            </label>
            {newNoAgent && (
              <div className="schedules-no-agent-grid">
                <input
                  className="input"
                  type="text"
                  placeholder="~/.hermes/scripts/check-disk.sh"
                  value={newScript}
                  onChange={(e) => setNewScript(e.target.value)}
                />
                <input
                  className="input"
                  type="text"
                  placeholder="Optional absolute workdir"
                  value={newWorkdir}
                  onChange={(e) => setNewWorkdir(e.target.value)}
                />
              </div>
            )}
            <div className="schedules-field-hint">
              No-agent jobs deliver script stdout directly; empty output is
              silent.
            </div>
          </div>
          <div className="schedules-field">
            <label className="schedules-field-label">
              {t("schedules.deliverTo")}
            </label>
            <select
              className="input"
              value={newDeliver}
              onChange={(e) => setNewDeliver(e.target.value)}
            >
              {DELIVER_TARGETS.map((target) => (
                <option key={target.value} value={target.value}>
                  {target.label}
                </option>
              ))}
            </select>
            <div className="schedules-field-hint">
              {t("schedules.deliverHint")}
            </div>
          </div>
        </div>
        <div className="schedules-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-primary"
            onClick={onCreate}
            disabled={!isScheduleValid || actionInProgress === "creating"}
          >
            {actionInProgress === "creating"
              ? t("schedules.creating")
              : t("schedules.create")}
          </button>
        </div>
      </div>
    </div>
  );
}
