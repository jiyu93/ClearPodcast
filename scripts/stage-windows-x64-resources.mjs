#!/usr/bin/env node

import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifestPath = path.join(repoRoot, "packaging", "artifacts.windows-x64.json");
const skipNames = new Set([".DS_Store", "__pycache__"]);
const skipExtensions = new Set([".pyc", ".pyo"]);

function main() {
  assertWindowsHost();
  generateThirdPartyNotices();
  const manifest = readJson(manifestPath);
  const resourceRoot = resolveRepoPath(manifest.resource_root);

  fs.rmSync(resourceRoot, { recursive: true, force: true });
  fs.mkdirSync(resourceRoot, { recursive: true });
  fs.writeFileSync(path.join(resourceRoot, ".gitkeep"), "\n");

  const stagedArtifacts = [];
  for (const artifact of manifest.artifacts) {
    stagedArtifacts.push(stageArtifact(artifact, resourceRoot));
  }

  const generatedManifest = {
    schema_version: manifest.schema_version,
    package_id: manifest.package_id,
    resource_root: "clearpodcast",
    generated_at_utc: new Date().toISOString(),
    artifacts: stagedArtifacts,
  };

  const generatedManifestPath = resolveRepoPath(manifest.generated_manifest_path);
  fs.mkdirSync(path.dirname(generatedManifestPath), { recursive: true });
  fs.writeFileSync(
    generatedManifestPath,
    `${JSON.stringify(generatedManifest, null, 2)}\n`,
  );

  console.log(`Staged ${stagedArtifacts.length} artifacts into ${resourceRoot}`);
  console.log(`Generated ${generatedManifestPath}`);
}

function generateThirdPartyNotices() {
  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, "scripts", "generate-third-party-notices.mjs"), "windows-x64"],
    {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`third-party notice generation failed with ${result.status}`);
  }
}

function assertWindowsHost() {
  if (process.platform !== "win32") {
    throw new Error("Windows x64 resource staging must run on Windows.");
  }
}

function stageArtifact(artifact, resourceRoot) {
  const source = resolveRepoPath(overrideSource(artifact) ?? artifact.source);
  const destination = path.join(resourceRoot, artifact.artifact_path);

  if (!fs.existsSync(source)) {
    throw new Error(`source for ${artifact.id} was not found: ${source}`);
  }

  if (artifact.kind === "runtime") {
    stagePythonRuntime(source, destination);
  } else {
    copyTree(source, destination);
  }

  for (const check of artifact.required_file_sha256 ?? []) {
    const filePath = path.join(destination, check.path);
    const actual = sha256File(filePath);
    if (actual !== check.sha256) {
      throw new Error(
        `${artifact.id} required file ${check.path} sha256 mismatch: expected ${check.sha256}, got ${actual}`,
      );
    }
  }

  return {
    id: artifact.id,
    kind: artifact.kind,
    platform: artifact.platform,
    version: artifact.version,
    artifact_path: artifact.artifact_path,
    source: path.relative(repoRoot, source),
    sha256: {
      mode: "directory-tree",
      value: sha256Directory(destination),
    },
    required_file_sha256: artifact.required_file_sha256 ?? [],
  };
}

function stagePythonRuntime(venvSource, destination) {
  const pyvenv = readPyvenvConfig(path.join(venvSource, "pyvenv.cfg"));
  const baseSource = fs.realpathSync(
    process.env.CLEARPODCAST_WINDOWS_PYTHON_BASE_SOURCE ?? pyvenv.home,
  );

  if (!baseSource || !fs.existsSync(baseSource)) {
    throw new Error(
      `could not resolve a self-contained Python base for ${venvSource}; set CLEARPODCAST_WINDOWS_PYTHON_BASE_SOURCE`,
    );
  }

  copyTree(baseSource, destination, {
    skipRootEntries: new Set(["site-packages"]),
  });

  const venvSitePackages = path.join(venvSource, "Lib", "site-packages");
  const runtimeSitePackages = path.join(destination, "Lib", "site-packages");

  if (!isDirectory(venvSitePackages)) {
    throw new Error(`venv site-packages was not found: ${venvSitePackages}`);
  }

  fs.rmSync(runtimeSitePackages, { recursive: true, force: true });
  copyTree(venvSitePackages, runtimeSitePackages);

  const python = path.join(destination, "python.exe");
  if (!fs.existsSync(python)) {
    throw new Error(`staged Python executable was not found: ${python}`);
  }
}

function copyTree(source, destination, options = {}) {
  const sourceStat = fs.lstatSync(source);
  fs.rmSync(destination, { recursive: true, force: true });

  if (sourceStat.isSymbolicLink()) {
    copyTree(fs.realpathSync(source), destination, options);
  } else if (sourceStat.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true });
    copyDirectoryContents(source, destination, options);
  } else {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
    fs.chmodSync(destination, sourceStat.mode);
  }
}

function copyDirectoryContents(source, destination, options = {}, relative = "") {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (shouldSkip(entry.name)) {
      continue;
    }

    if (!relative && options.skipRootEntries?.has(entry.name)) {
      continue;
    }

    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    const entryRelative = path.join(relative, entry.name);
    const stat = fs.lstatSync(sourcePath);

    if (stat.isSymbolicLink()) {
      copyTree(fs.realpathSync(sourcePath), destinationPath);
    } else if (stat.isDirectory()) {
      fs.mkdirSync(destinationPath, { recursive: true });
      fs.chmodSync(destinationPath, stat.mode);
      copyDirectoryContents(sourcePath, destinationPath, options, entryRelative);
    } else if (stat.isFile()) {
      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      fs.copyFileSync(sourcePath, destinationPath);
      fs.chmodSync(destinationPath, stat.mode);
    } else {
      console.warn(`Skipping unsupported file type: ${entryRelative}`);
    }
  }
}

function sha256Directory(directory) {
  const hash = crypto.createHash("sha256");
  const entries = collectEntries(directory).sort((left, right) =>
    left.relative.localeCompare(right.relative),
  );

  for (const entry of entries) {
    hash.update(entry.kind);
    hash.update("\0");
    hash.update(entry.relative);
    hash.update("\0");
    if (entry.kind === "file") {
      hash.update(sha256File(entry.absolute));
    } else if (entry.kind === "symlink") {
      hash.update(fs.readlinkSync(entry.absolute));
    }
    hash.update("\0");
  }

  return hash.digest("hex");
}

function collectEntries(directory, relative = "") {
  const output = [];
  for (const entry of fs.readdirSync(path.join(directory, relative), {
    withFileTypes: true,
  })) {
    if (shouldSkip(entry.name)) {
      continue;
    }

    const entryRelative = path.join(relative, entry.name);
    const absolute = path.join(directory, entryRelative);
    const stat = fs.lstatSync(absolute);

    if (stat.isSymbolicLink()) {
      output.push({ kind: "symlink", relative: entryRelative, absolute });
    } else if (stat.isDirectory()) {
      output.push({ kind: "directory", relative: entryRelative, absolute });
      output.push(...collectEntries(directory, entryRelative));
    } else if (stat.isFile()) {
      output.push({ kind: "file", relative: entryRelative, absolute });
    }
  }
  return output;
}

function sha256File(filePath) {
  if (!isFile(filePath)) {
    throw new Error(`sha256 input was not a file: ${filePath}`);
  }

  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function readPyvenvConfig(filePath) {
  if (!isFile(filePath)) {
    throw new Error(`pyvenv.cfg was not found: ${filePath}`);
  }

  const config = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^=]+?)\s*=\s*(.*)$/);
    if (match) {
      config[match[1].trim()] = match[2].trim();
    }
  }
  return config;
}

function shouldSkip(name) {
  return skipNames.has(name) || skipExtensions.has(path.extname(name));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isFile(filePath) {
  try {
    return fs.lstatSync(filePath).isFile();
  } catch {
    return false;
  }
}

function isDirectory(filePath) {
  try {
    return fs.lstatSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function resolveRepoPath(value) {
  return path.resolve(repoRoot, value);
}

function overrideSource(artifact) {
  if (artifact.kind === "runtime") {
    return process.env.CLEARPODCAST_WINDOWS_RUNTIME_SOURCE;
  }
  if (artifact.kind === "model") {
    return process.env.CLEARPODCAST_RESEMBLE_MODEL_SOURCE;
  }
  return undefined;
}

main();
