import { ElectronAPI } from "@electron-toolkit/preload";
import type { HermesAPI } from "./hermes-api.types";

declare global {
  interface Window {
    electron: ElectronAPI;
    hermesAPI: HermesAPI;
  }
}
