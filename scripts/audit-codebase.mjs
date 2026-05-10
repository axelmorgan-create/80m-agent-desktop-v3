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

if (
  strict &&
  (oversized.length > 0 ||
    missingStyleImports.length > 0 ||
    missingImportTargets.length > 0)
) {
  process.exitCode = 1;
}
