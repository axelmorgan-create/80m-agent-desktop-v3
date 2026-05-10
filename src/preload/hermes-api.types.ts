import type { HermesAutomationAPI } from "./hermes-api-automation.types";
import type { HermesChatAPI } from "./hermes-api-chat.types";
import type { HermesClawUpdatesAPI } from "./hermes-api-claw-updates.types";
import type { HermesDesktopAPI } from "./hermes-api-desktop.types";
import type { HermesRuntimeAPI } from "./hermes-api-runtime.types";
import type { HermesWorkspaceAPI } from "./hermes-api-workspace.types";

export * from "./hermes-api-common.types";
export type { HermesAutomationAPI } from "./hermes-api-automation.types";
export type { HermesChatAPI } from "./hermes-api-chat.types";
export type { HermesClawUpdatesAPI } from "./hermes-api-claw-updates.types";
export type { HermesDesktopAPI } from "./hermes-api-desktop.types";
export type { HermesRuntimeAPI } from "./hermes-api-runtime.types";
export type { HermesWorkspaceAPI } from "./hermes-api-workspace.types";

export interface HermesAPI
  extends
    HermesRuntimeAPI,
    HermesChatAPI,
    HermesWorkspaceAPI,
    HermesClawUpdatesAPI,
    HermesAutomationAPI,
    HermesDesktopAPI {}
