#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const supportedPlatforms = new Set(["windows-x64"]);
const platform = parsePlatform(process.argv.slice(2));

if (!supportedPlatforms.has(platform)) {
  throw new Error(`unsupported notices platform: ${platform}`);
}

const manifest = readJson(path.join(repoRoot, "packaging", `artifacts.${platform}.json`));
const runtimeSource = resolveRuntimeSource(manifest);
const packageJson = readJson(path.join(repoRoot, "package.json"));
const outputDir = path.join(repoRoot, "packaging", "licenses", platform);
const outputPath = path.join(outputDir, "THIRD_PARTY_NOTICES.txt");

const notices = [
  headerSection(),
  pythonRuntimeSection(runtimeSource),
  pythonPackageSection(runtimeSource),
  pythonCudaSection(runtimeSource),
  npmSection(),
  cargoSection(),
].join("\n\n");

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `${notices}\n`, "utf8");
console.log(`Generated ${path.relative(repoRoot, outputPath)}`);

function parsePlatform(args) {
  const explicitIndex = args.indexOf("--platform");
  if (explicitIndex >= 0) {
    return args[explicitIndex + 1];
  }
  return args[0] ?? "windows-x64";
}

function headerSection() {
  return [
    "ClearPodcast third-party notices",
    "=================================",
    "",
    `Platform: ${platform}`,
    `ClearPodcast version: ${packageJson.version}`,
    "",
    "This file lists third-party software included in, or compiled into, the",
    "ClearPodcast Windows x64 portable artifact. It is generated from the",
    "Windows Python runtime metadata, package-lock.json, and Cargo metadata.",
    "",
    "Packaged Python wheel metadata and license files are preserved under:",
    "",
    "  clearpodcast/runtimes/windows-x64/Lib/site-packages/*.dist-info/",
    "",
    "The CPython runtime license is preserved at:",
    "",
    "  clearpodcast/runtimes/windows-x64/LICENSE.txt",
  ].join("\n");
}

function pythonRuntimeSection(runtimeSourcePath) {
  const pyvenv = readPyvenvConfig(path.join(runtimeSourcePath, "pyvenv.cfg"));
  const version = pyvenv.version_info ?? "unknown";
  const baseHome = fs.realpathSync(
    process.env.CLEARPODCAST_WINDOWS_PYTHON_BASE_SOURCE ?? pyvenv.home,
  );
  const baseLicense = path.join(baseHome, "LICENSE.txt");

  return [
    "CPython runtime",
    "---------------",
    "",
    `- CPython ${version}`,
    "- License: Python Software Foundation License",
    `- Packaged license file: clearpodcast/runtimes/windows-x64/LICENSE.txt`,
    `- Source license file present: ${isFile(baseLicense) ? "yes" : "no"}`,
  ].join("\n");
}

function pythonPackageSection(runtimeSourcePath) {
  const packages = collectPythonPackages(runtimeSourcePath);
  return [
    `Python packages (${packages.length})`,
    "--------------------",
    "",
    "These packages are installed in the bundled Windows Python runtime. The",
    "listed license files and METADATA files are preserved in the artifact.",
    "",
    packages
      .map((pkg) =>
        formatEntry(`${pkg.name} ${pkg.version}`, [
          ["License", pkg.licenseSummary || "see package metadata"],
          ["Metadata", pkg.metadataPath],
          [
            "License files",
            pkg.licenseFiles.length ? pkg.licenseFiles : ["see METADATA"],
          ],
        ]),
      )
      .join("\n\n"),
  ].join("\n");
}

function pythonCudaSection(runtimeSourcePath) {
  const torchLib = path.join(runtimeSourcePath, "Lib", "site-packages", "torch", "lib");
  const dlls = isDirectory(torchLib)
    ? fs
        .readdirSync(torchLib)
        .filter((name) => name.toLowerCase().endsWith(".dll"))
        .filter((name) => /^(cu|nv|torch|c10|uv|zlib|libiomp|shm)/i.test(name))
        .sort((left, right) => left.localeCompare(right))
    : [];

  return [
    `CUDA and native runtime libraries (${dlls.length})`,
    "--------------------------------------",
    "",
    "The Windows PyTorch CUDA wheel includes native runtime DLLs in:",
    "",
    "  clearpodcast/runtimes/windows-x64/Lib/site-packages/torch/lib/",
    "",
    "The corresponding PyTorch package metadata and license/notice files are",
    "listed in the Python package section above. Detected DLLs:",
    "",
    wrapList(dlls),
  ].join("\n");
}

function npmSection() {
  const lock = readJson(path.join(repoRoot, "package-lock.json"));
  const packages = Object.entries(lock.packages ?? {})
    .filter(([packagePath, info]) => packagePath.startsWith("node_modules/") && !info.dev)
    .map(([packagePath, info]) => ({
      name: packagePath.replace(/^node_modules\//, ""),
      version: info.version ?? "unknown",
      license: normalizeLicense(info.license) || "see package metadata",
      resolved: info.resolved ?? "",
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return [
    `Bundled npm runtime packages (${packages.length})`,
    "--------------------------------",
    "",
    "The desktop web assets are built from these runtime npm packages. Build-only",
    "devDependencies are not listed here because node_modules is not shipped in",
    "the portable artifact.",
    "",
    packages
      .map((pkg) =>
        formatEntry(`${pkg.name} ${pkg.version}`, [
          ["License", pkg.license],
          ["Resolved package", pkg.resolved || "not recorded"],
        ]),
      )
      .join("\n\n"),
  ].join("\n");
}

function cargoSection() {
  const metadata = runJson("cargo", [
    "metadata",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "--format-version",
    "1",
    "--locked",
    "--filter-platform",
    "x86_64-pc-windows-msvc",
  ]);
  const root = metadata.resolve?.root;
  const packageById = new Map(metadata.packages.map((pkg) => [pkg.id, pkg]));
  const included = new Set();
  const visit = (id) => {
    const node = metadata.resolve?.nodes?.find((entry) => entry.id === id);
    if (!node) {
      return;
    }
    for (const dep of node.deps ?? []) {
      if (dep.pkg === root || included.has(dep.pkg)) {
        continue;
      }
      included.add(dep.pkg);
      visit(dep.pkg);
    }
  };
  visit(root);

  const crates = Array.from(included)
    .map((id) => packageById.get(id))
    .filter(Boolean)
    .map((pkg) => ({
      name: pkg.name,
      version: pkg.version,
      license:
        normalizeLicense(pkg.license) ||
        licenseFileLabel(pkg.license_file) ||
        "see crate metadata",
      repository: pkg.repository || pkg.homepage || "",
    }))
    .sort((left, right) => `${left.name} ${left.version}`.localeCompare(`${right.name} ${right.version}`));

  return [
    `Rust crates compiled into the Windows app (${crates.length})`,
    "----------------------------------------------",
    "",
    "This list is generated from Cargo metadata filtered for",
    "x86_64-pc-windows-msvc.",
    "",
    crates
      .map((crate) =>
        formatEntry(`${crate.name} ${crate.version}`, [
          ["License", crate.license],
          ["Repository/homepage", crate.repository || "not recorded"],
        ]),
      )
      .join("\n\n"),
  ].join("\n");
}

function collectPythonPackages(runtimeSourcePath) {
  const sitePackages = path.join(runtimeSourcePath, "Lib", "site-packages");
  return fs
    .readdirSync(sitePackages, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(".dist-info"))
    .map((entry) => {
      const distInfoPath = path.join(sitePackages, entry.name);
      const metadataPath = path.join(distInfoPath, "METADATA");
      const metadata = isFile(metadataPath)
        ? parseMetadata(fs.readFileSync(metadataPath, "utf8"))
        : {};
      const name = first(metadata.Name) ?? distInfoName(entry.name).name;
      const version = first(metadata.Version) ?? distInfoName(entry.name).version;
      const licenseFiles = collectLicenseFiles(distInfoPath).map((filePath) =>
        packagedRuntimePath(path.relative(runtimeSourcePath, filePath)),
      );

      return {
        name,
        version,
        licenseSummary: pythonLicenseSummary(metadata),
        metadataPath: packagedRuntimePath(path.relative(runtimeSourcePath, metadataPath)),
        licenseFiles,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function pythonLicenseSummary(metadata) {
  const expression = first(metadata["License-Expression"]);
  const license = normalizeLicense(first(metadata.License));
  const classifiers = (metadata.Classifier ?? [])
    .filter((value) => value.startsWith("License ::"))
    .map((value) => value.replace(/^License ::\s*/, ""));

  return [expression, license, ...classifiers]
    .filter(Boolean)
    .filter(uniqueFilter)
    .join("; ");
}

function collectLicenseFiles(distInfoPath) {
  const files = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile() && /^(license|notice|copying)/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
  };
  visit(distInfoPath);
  return files.sort((left, right) => left.localeCompare(right));
}

function parseMetadata(text) {
  const output = {};
  let currentKey = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line) {
      break;
    }
    if (/^\s/.test(line) && currentKey) {
      const values = output[currentKey];
      values[values.length - 1] = `${values[values.length - 1]}\n${line.trim()}`;
      continue;
    }
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) {
      continue;
    }
    currentKey = match[1];
    output[currentKey] ??= [];
    output[currentKey].push(match[2]);
  }
  return output;
}

function distInfoName(name) {
  const cleaned = name.replace(/\.dist-info$/, "");
  const match = cleaned.match(/^(.+)-([^-]+)$/);
  return {
    name: match?.[1] ?? cleaned,
    version: match?.[2] ?? "unknown",
  };
}

function readPyvenvConfig(filePath) {
  const config = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^=]+?)\s*=\s*(.*)$/);
    if (match) {
      config[match[1].trim()] = match[2].trim();
    }
  }
  return config;
}

function resolveRuntimeSource(manifest) {
  const artifact = manifest.artifacts.find((item) => item.kind === "runtime");
  if (!artifact) {
    throw new Error("runtime artifact was not found in manifest");
  }
  return path.resolve(
    repoRoot,
    process.env.CLEARPODCAST_WINDOWS_RUNTIME_SOURCE ?? artifact.source,
  );
}

function packagedRuntimePath(relativePath) {
  return `clearpodcast/runtimes/windows-x64/${toPosix(relativePath)}`;
}

function formatEntry(title, fields) {
  const lines = [`- ${title}`];
  for (const [label, value] of fields) {
    if (Array.isArray(value)) {
      lines.push(`  ${label}:`);
      for (const item of value) {
        lines.push(`    - ${item}`);
      }
    } else {
      lines.push(`  ${label}: ${value}`);
    }
  }
  return lines.join("\n");
}

function wrapList(values) {
  if (!values.length) {
    return "  (none detected)";
  }
  return values.map((value) => `- ${value}`).join("\n");
}

function normalizeLicense(value) {
  if (!value) {
    return "";
  }
  const normalized = String(value).replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > 160) {
    return "";
  }
  return normalized;
}

function licenseFileLabel(value) {
  return value ? `license file: ${value}` : "";
}

function uniqueFilter(value, index, values) {
  return values.indexOf(value) === index;
}

function first(values) {
  return Array.isArray(values) ? values[0] : undefined;
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function isFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function isDirectory(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function runJson(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}
