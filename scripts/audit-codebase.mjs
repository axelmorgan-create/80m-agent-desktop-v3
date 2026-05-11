#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const strict = process.argv.includes("--strict");

const scanRoots = [
  "src/main",
  "src/preload",
  "src/renderer/src/components",
  "src/renderer/src/screens",
  "src/renderer/src/assets/styles",
];

const sourceExtensions = new Set([".ts", ".tsx", ".css"]);
const largeLineThresholds = {
  ".ts": 600,
  ".tsx": 600,
  ".css": 1800,
};

function walk(dir) {
  if (!existsSync(dir)) return [];

  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) return walk(fullPath);
    return [fullPath];
  });
}

function lineCount(filePath) {
  const text = readFileSync(filePath, "utf8");
  if (text.length === 0) return 0;
  return text.split(/\r\n|\r|\n/).length;
}

function relative(filePath) {
  return path.relative(root, filePath);
}

const files = scanRoots
  .flatMap((scanRoot) => walk(path.join(root, scanRoot)))
  .filter((filePath) => sourceExtensions.has(path.extname(filePath)));

const entries = files
  .map((filePath) => ({
    path: filePath,
    relativePath: relative(filePath),
    extension: path.extname(filePath),
    lines: lineCount(filePath),
  }))
  .sort((a, b) => b.lines - a.lines);

const oversized = entries.filter(
  (entry) => entry.lines > largeLineThresholds[entry.extension],
);

const mainCssPath = path.join(root, "src/renderer/src/assets/main.css");
const stylesDir = path.join(root, "src/renderer/src/assets/styles");
const manifestImports = existsSync(mainCssPath)
  ? [...readFileSync(mainCssPath, "utf8").matchAll(/@import\s+"(.+?)";/g)].map(
      (match) => match[1],
    )
  : [];
const importedStyleFiles = new Set(
  manifestImports.map((importPath) =>
    path.normalize(path.join(path.dirname(mainCssPath), importPath)),
  ),
);
const styleFiles = existsSync(stylesDir)
  ? readdirSync(stylesDir)
      .filter((entry) => entry.endsWith(".css"))
      .map((entry) => path.join(stylesDir, entry))
  : [];
const missingStyleImports = styleFiles.filter(
  (filePath) => !importedStyleFiles.has(path.normalize(filePath)),
);
const missingImportTargets = manifestImports
  .map((importPath) => path.join(path.dirname(mainCssPath), importPath))
  .filter((filePath) => !existsSync(filePath));

function readRelativeFile(relativePath) {
  const filePath = path.join(root, relativePath);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

const requiredModulePaths = [
  "src/main/settings-audit-utils.ts",
  "src/renderer/src/components/80m/SettingsFrame.tsx",
  "src/renderer/src/components/80m/SettingsPanelContent.tsx",
  "src/renderer/src/components/80m/useAgentPreviewDock.ts",
  "src/renderer/src/components/80m/useChatRuntimeEvents.ts",
  "src/renderer/src/screens/Memory/MemoryHeader.tsx",
  "src/renderer/src/screens/Memory/MemoryNeuralMapPanel.tsx",
  "src/renderer/src/screens/Memory/MemoryTabs.tsx",
  "src/renderer/src/screens/Memory/MemoryVaultTreeNode.tsx",
  "src/renderer/src/screens/Schedules/SchedulesCreateModal.tsx",
  "src/renderer/src/screens/Schedules/SchedulesDeleteModal.tsx",
];
const missingRequiredModules = requiredModulePaths.filter(
  (relativePath) => !existsSync(path.join(root, relativePath)),
);

const layoutSource = readRelativeFile(
  "src/renderer/src/components/80m/Layout80m.tsx",
);
const workspaceSource = readRelativeFile(
  "src/renderer/src/components/80m/ConversationWorkspace.tsx",
);
const projectsSource = readRelativeFile(
  "src/renderer/src/components/80m/ProjectsSidebar.tsx",
);
const borderlessShellStyles = readRelativeFile(
  "src/renderer/src/assets/styles/13a-borderless-shell.css",
);

const rendererContractFailures = [];
if (
  !/if\s*\(\s*showProjectsSidebar\s*\)[\s\S]*handleProjectChange\(null\)/.test(
    layoutSource,
  )
) {
  rendererContractFailures.push(
    "Project toolbar must close the active project",
  );
}
if (!workspaceSource.includes("Close project:")) {
  rendererContractFailures.push(
    "Project toolbar tooltip must expose close mode",
  );
}
if (
  !/className="file-tree-project-name"[\s\S]*onProjectChange\(null\)/.test(
    projectsSource,
  )
) {
  rendererContractFailures.push(
    "Project root folder must close the active project",
  );
}
if (
  !/\[data-theme\]\s+\.app-titlebar\s*\{[\s\S]*pointer-events:\s*none/.test(
    borderlessShellStyles,
  )
) {
  rendererContractFailures.push(
    "Invisible titlebar must not intercept top toolbar controls",
  );
}
if (
  !/\[data-theme\]\s+\.app-titlebar-controls\s*\{[\s\S]*pointer-events:\s*auto/.test(
    borderlessShellStyles,
  )
) {
  rendererContractFailures.push(
    "Window controls must stay clickable when titlebar shell is transparent",
  );
}

console.log("80m codebase audit");
console.log("");
console.log("Largest source files:");
entries.slice(0, 12).forEach((entry, index) => {
  console.log(
    `${String(index + 1).padStart(2, " ")}. ${entry.relativePath} - ${entry.lines} lines`,
  );
});

console.log("");
if (oversized.length === 0) {
  console.log("Oversized files: none");
} else {
  console.log("Oversized files to prioritize:");
  oversized.forEach((entry) => {
    console.log(`- ${entry.relativePath} - ${entry.lines} lines`);
  });
}

console.log("");
if (missingStyleImports.length === 0 && missingImportTargets.length === 0) {
  console.log("Style manifest: ok");
} else {
  if (missingStyleImports.length > 0) {
    console.log("Style modules not imported by main.css:");
    missingStyleImports.forEach((filePath) => {
      console.log(`- ${relative(filePath)}`);
    });
  }
  if (missingImportTargets.length > 0) {
    console.log("main.css imports missing files:");
    missingImportTargets.forEach((filePath) => {
      console.log(`- ${relative(filePath)}`);
    });
  }
}

console.log("");
if (missingRequiredModules.length === 0) {
  console.log("Cleanup module boundaries: ok");
} else {
  console.log("Cleanup module boundaries missing files:");
  missingRequiredModules.forEach((relativePath) => {
    console.log(`- ${relativePath}`);
  });
}

console.log("");
if (rendererContractFailures.length === 0) {
  console.log("Renderer interaction contracts: ok");
} else {
  console.log("Renderer interaction contract failures:");
  rendererContractFailures.forEach((failure) => {
    console.log(`- ${failure}`);
  });
}

if (
  strict &&
  (oversized.length > 0 ||
    missingStyleImports.length > 0 ||
    missingImportTargets.length > 0 ||
    missingRequiredModules.length > 0 ||
    rendererContractFailures.length > 0)
) {
  process.exitCode = 1;
}
