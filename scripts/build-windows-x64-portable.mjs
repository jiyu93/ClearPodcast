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
const targetReleaseDir = path.join(repoRoot, "src-tauri", "target", "release");
const sourceExe = path.join(targetReleaseDir, "clearpodcast-tauri.exe");
const resourceRoot = path.join(repoRoot, "src-tauri", "resources", "clearpodcast");
const releaseDir = path.join(repoRoot, "localfiles", "releases");
const portableName = `ClearPodcast-${version}-windows-x64`;
const portableDir = path.join(releaseDir, portableName);
const zipPath = path.join(releaseDir, `${portableName}.zip`);

if (process.platform !== "win32") {
  throw new Error("Windows x64 portable builds must run on Windows.");
}

run(process.execPath, [path.join(repoRoot, "scripts", "stage-windows-x64-resources.mjs")]);
run("cmd.exe", ["/d", "/s", "/c", "npm run tauri build -- --no-bundle"]);

if (!fs.existsSync(sourceExe)) {
  throw new Error(`Tauri release executable was not found after build: ${sourceExe}`);
}

fs.mkdirSync(releaseDir, { recursive: true });
fs.rmSync(portableDir, { recursive: true, force: true });
fs.mkdirSync(portableDir, { recursive: true });

fs.copyFileSync(sourceExe, path.join(portableDir, "ClearPodcast.exe"));
for (const dllPath of findRootDlls(targetReleaseDir)) {
  fs.copyFileSync(dllPath, path.join(portableDir, path.basename(dllPath)));
}
copyTree(resourceRoot, path.join(portableDir, "clearpodcast"));

fs.rmSync(zipPath, { force: true });
run("tar.exe", ["-a", "-c", "-f", zipPath, portableName], { cwd: releaseDir });

console.log(`Created ${portableDir}`);
console.log(`Created ${zipPath}`);
console.log(`Portable folder size: ${formatBytes(directorySize(portableDir))}`);
console.log(`Archive size: ${formatBytes(fs.statSync(zipPath).size)}`);

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

function findRootDlls(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".dll"))
    .map((entry) => path.join(directory, entry.name));
}

function copyTree(source, destination) {
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyTree(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

function directorySize(directory) {
  let total = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      total += directorySize(entryPath);
    } else if (entry.isFile()) {
      total += fs.statSync(entryPath).size;
    }
  }
  return total;
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
