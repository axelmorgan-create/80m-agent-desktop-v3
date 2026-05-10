import type { HermesAPI } from "./hermes-api.types";
import { hermesAutomationApi } from "./hermes-api-automation";
import { hermesChatApi } from "./hermes-api-chat";
import { hermesClawUpdatesApi } from "./hermes-api-claw-updates";
import { hermesDesktopApi } from "./hermes-api-desktop";
import { hermesRuntimeApi } from "./hermes-api-runtime";
import { hermesWorkspaceApi } from "./hermes-api-workspace";

export const hermesAPI = {
  ...hermesRuntimeApi,
  ...hermesChatApi,
  ...hermesWorkspaceApi,
  ...hermesClawUpdatesApi,
  ...hermesAutomationApi,
  ...hermesDesktopApi,
} as HermesAPI;
