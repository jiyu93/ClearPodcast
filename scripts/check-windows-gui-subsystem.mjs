#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const WINDOWS_GUI_SUBSYSTEM = 2;
const WINDOWS_CUI_SUBSYSTEM = 3;
const executablePath = process.argv[2];

if (!executablePath) {
  throw new Error("usage: node scripts/check-windows-gui-subsystem.mjs <exe>");
}

const resolvedPath = path.resolve(executablePath);
const subsystem = readPeSubsystem(resolvedPath);

if (subsystem !== WINDOWS_GUI_SUBSYSTEM) {
  const label =
    subsystem === WINDOWS_CUI_SUBSYSTEM
      ? "Windows CUI / console"
      : `subsystem ${subsystem}`;
  throw new Error(
    `${resolvedPath} is ${label}; Windows release executables must use Windows GUI subsystem`,
  );
}

console.log(`Verified Windows GUI subsystem for ${resolvedPath}`);

function readPeSubsystem(filePath) {
  const data = fs.readFileSync(filePath);
  if (data.length < 0x40 || data.toString("ascii", 0, 2) !== "MZ") {
    throw new Error(`${filePath} is not a PE executable`);
  }

  const peHeaderOffset = data.readUInt32LE(0x3c);
  if (data.toString("ascii", peHeaderOffset, peHeaderOffset + 4) !== "PE\u0000\u0000") {
    throw new Error(`${filePath} does not contain a valid PE header`);
  }

  const optionalHeaderOffset = peHeaderOffset + 24;
  const magic = data.readUInt16LE(optionalHeaderOffset);
  if (magic !== 0x10b && magic !== 0x20b) {
    throw new Error(`${filePath} has unsupported PE optional header magic ${magic}`);
  }

  return data.readUInt16LE(optionalHeaderOffset + 68);
}
