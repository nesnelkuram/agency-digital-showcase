import { spawnSync } from "node:child_process";

// The standalone Firebase CLI can prepend its embedded Node 18 to PATH.
// Keep the project's Node executable when launching Vitest inside the emulator.
const quote = (text) => "'" + text.replaceAll("'", "'\"'\"'") + "'";
const architecture =
  process.platform === "darwin"
    ? `/usr/bin/arch -${process.arch === "arm64" ? "arm64" : "x86_64"} `
    : "";
const command = `${architecture}${quote(process.execPath)} node_modules/vitest/vitest.mjs run tests/exportAudience.test.ts tests/exportAudience.integration.test.ts tests/exportAudienceApi.test.ts`;
const result = spawnSync(
  "firebase",
  [
    "emulators:exec",
    "--only",
    "firestore",
    "--project",
    "demo-export-research",
    "--config",
    "firebase.export.test.json",
    command,
  ],
  {
    stdio: "inherit",
    env: { ...process.env, EXPORT_AUDIENCE_REQUIRE_EMULATOR: "1" },
  },
);
process.exitCode = result.status ?? 1;
