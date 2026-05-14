/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* global chrome */

const DEFAULT_URL = "http://127.0.0.1:8780";

const companionUrlInput = document.getElementById("companionUrl");
const captureButton = document.getElementById("captureButton");
const connectButton = document.getElementById("connectButton");
const saveEndpointButton = document.getElementById("saveEndpointButton");
const resetConnectionButton = document.getElementById("resetConnectionButton");
const statusEl = document.getElementById("status");
const connectionChip = document.getElementById("connectionChip");
const connectionLabel = document.getElementById("connectionLabel");
const connectionSub = document.getElementById("connectionSub");

let settings = {
  companionUrl: DEFAULT_URL,
  pairingToken: "",
};

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_URL).replace(/\/+$/, "");
}

function setStatus(message, tone = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${tone}`.trim();
}

function setConnectionState(state, label, detail) {
  document.body.dataset.connection = state;
  connectionChip.textContent =
    state === "connected"
      ? "Ready"
      : state === "offline"
        ? "Offline"
        : "Linking";
  connectionLabel.textContent = label;
  connectionSub.textContent = detail;
}

function setBusy(isBusy, label = "Working") {
  captureButton.disabled = isBusy;
  connectButton.disabled = isBusy;
  saveEndpointButton.disabled = isBusy;
  resetConnectionButton.disabled = isBusy;
  if (isBusy) captureButton.textContent = label;
  else captureButton.textContent = "Save to Cortex";
}

async function persistSettings(nextSettings = settings) {
  settings = {
    ...settings,
    ...nextSettings,
    companionUrl: normalizeBaseUrl(nextSettings.companionUrl),
  };
  await chrome.storage.sync.set(settings);
  companionUrlInput.value = settings.companionUrl;
}

async function loadSettings() {
  settings = await chrome.storage.sync.get({
    companionUrl: DEFAULT_URL,
    pairingToken: "",
  });
  settings.companionUrl = normalizeBaseUrl(settings.companionUrl);
  companionUrlInput.value = settings.companionUrl;
}

async function readJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const error = new Error(
      payload.error || `Desktop returned HTTP ${response.status}.`,
    );
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function desktopFetch(path, options = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.token !== false && settings.pairingToken
      ? { "X-80M-Pairing-Token": settings.pairingToken }
      : {}),
  };
  const response = await fetch(`${settings.companionUrl}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return readJsonResponse(response);
}

async function connectToDesktop({ quiet = false } = {}) {
  if (!quiet) setStatus("Connecting to 80M Desktop...");
  setConnectionState("connecting", "Connecting", settings.companionUrl);

  const response = await fetch(`${settings.companionUrl}/api/clipper/connect`, {
    method: "POST",
  });
  const payload = await readJsonResponse(response);
  if (!payload.pairingToken) {
    throw new Error("Desktop did not return a local clipper token.");
  }

  await persistSettings({
    companionUrl: settings.companionUrl,
    pairingToken: payload.pairingToken,
  });
  const vaultName = payload.vault?.name || "Cortex";
  setConnectionState("connected", "Connected", vaultName);
  if (!quiet) setStatus("Desktop linked.", "success");
  return payload;
}

async function checkConnection() {
  if (!settings.pairingToken) {
    await connectToDesktop({ quiet: true });
    return;
  }

  try {
    const status = await desktopFetch("/api/status");
    setConnectionState(
      "connected",
      "Connected",
      status.model?.profile || "80M Desktop",
    );
  } catch (error) {
    if (error?.status === 401) {
      await connectToDesktop({ quiet: true });
      return;
    }
    setConnectionState("offline", "Desktop not found", settings.companionUrl);
    setStatus(error?.message || String(error), "error");
  }
}

function extractPage() {
  const pickMeta = (...names) => {
    for (const name of names) {
      const meta =
        document.querySelector(`meta[name="${name}"]`) ||
        document.querySelector(`meta[property="${name}"]`);
      const content = meta?.getAttribute("content")?.trim();
      if (content) return content;
    }
    return "";
  };

  const canonical =
    document.querySelector('link[rel="canonical"]')?.href || location.href;
  const selection = window.getSelection()?.toString().trim() || "";
  const bodyText = document.body?.innerText || "";

  return {
    title: document.title || canonical,
    url: canonical,
    text: bodyText.slice(0, 45000),
    selection: selection.slice(0, 5000),
    excerpt: pickMeta("description", "og:description", "twitter:description"),
    byline: pickMeta("author", "article:author"),
    siteName: pickMeta("og:site_name", "application-name"),
  };
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found.");
  return tab;
}

async function captureCurrentPage(retried = false) {
  if (!settings.pairingToken) {
    await connectToDesktop({ quiet: true });
  }

  const tab = await getActiveTab();
  let injected;
  try {
    [injected] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPage,
    });
  } catch {
    throw new Error("Chrome will not allow this page to be captured.");
  }

  const result = injected?.result;
  if (!result?.text && !result?.selection) {
    throw new Error("No readable page text found.");
  }

  try {
    return await desktopFetch("/api/cortex/clip", {
      method: "POST",
      body: result,
    });
  } catch (error) {
    if (!retried && error?.status === 401) {
      await connectToDesktop({ quiet: true });
      return captureCurrentPage(true);
    }
    throw error;
  }
}

captureButton.addEventListener("click", async () => {
  setBusy(true, "Saving");
  setStatus("Sending page to Cortex...");
  try {
    const result = await captureCurrentPage();
    setConnectionState("connected", "Connected", "Saved to second brain");
    setStatus(`Saved: ${result.title}`, "success");
  } catch (error) {
    setConnectionState("error", "Needs attention", settings.companionUrl);
    setStatus(error?.message || String(error), "error");
  } finally {
    setBusy(false);
  }
});

connectButton.addEventListener("click", async () => {
  setBusy(true, "Connecting");
  try {
    await connectToDesktop();
  } catch (error) {
    setConnectionState("offline", "Desktop not found", settings.companionUrl);
    setStatus(error?.message || String(error), "error");
  } finally {
    setBusy(false);
  }
});

saveEndpointButton.addEventListener("click", async () => {
  setBusy(true, "Connecting");
  try {
    await persistSettings({
      companionUrl: normalizeBaseUrl(companionUrlInput.value),
      pairingToken: "",
    });
    await connectToDesktop();
  } catch (error) {
    setConnectionState("offline", "Desktop not found", settings.companionUrl);
    setStatus(error?.message || String(error), "error");
  } finally {
    setBusy(false);
  }
});

resetConnectionButton.addEventListener("click", async () => {
  setBusy(true, "Connecting");
  try {
    await persistSettings({
      companionUrl: normalizeBaseUrl(companionUrlInput.value),
      pairingToken: "",
    });
    await connectToDesktop();
  } catch (error) {
    setConnectionState("offline", "Desktop not found", settings.companionUrl);
    setStatus(error?.message || String(error), "error");
  } finally {
    setBusy(false);
  }
});

loadSettings()
  .then(checkConnection)
  .catch((error) => {
    setConnectionState("offline", "Desktop not found", DEFAULT_URL);
    setStatus(error?.message || String(error), "error");
  });
