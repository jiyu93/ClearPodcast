#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"),
);
const version = packageJson.version;
const appPath = path.join(
  repoRoot,
  "src-tauri",
  "target",
  "release",
  "bundle",
  "macos",
  "ClearPodcast.app",
);
const releaseDir = path.join(repoRoot, "localfiles", "releases");
const zipPath = path.join(
  releaseDir,
  `ClearPodcast-${version}-macos-arm64-cpu.zip`,
);

run(process.execPath, [path.join(repoRoot, "scripts", "stage-macos-cpu-resources.mjs")]);
run("npm", [
  "run",
  "tauri",
  "build",
  "--",
  "--bundles",
  "app",
  "--config",
  path.join("src-tauri", "tauri.release.conf.json"),
]);

if (!fs.existsSync(appPath)) {
  throw new Error(`Tauri app bundle was not found after build: ${appPath}`);
}

fs.mkdirSync(releaseDir, { recursive: true });
fs.rmSync(zipPath, { force: true });
run("ditto", ["-c", "-k", "--norsrc", "--keepParent", appPath, zipPath], {
  cwd: path.dirname(appPath),
});

const archiveSize = fs.statSync(zipPath).size;
console.log(`Created ${zipPath}`);
console.log(`Archive size: ${formatBytes(archiveSize)}`);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status}`);
  }
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = units.shift();

  while (value >= 1024 && units.length > 0) {
    value /= 1024;
    unit = units.shift();
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
}
