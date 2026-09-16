import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profile = process.argv[2] ?? "local";
const envPath = path.join(root, "apps", "api", `.env.${profile}`);

if (!fs.existsSync(envPath)) {
  console.error(`Missing ${path.relative(root, envPath)}`);
  process.exit(1);
}

console.log(`[api] Docker profile: ${profile} (${path.relative(root, envPath)})`);
console.log("[api] Linux container runs `go run` — bypasses Windows Device Guard on local .exe");

const dockerArgs = [
  "run",
  "--rm",
  "-p",
  "8080:8080",
  "-v",
  `${root}:/work`,
  "-w",
  "/work/apps/api",
  "--env-file",
  envPath,
  "-e",
  "HOST=0.0.0.0",
  "golang:1.24-bookworm",
  "go",
  "run",
  "./cmd/server",
];

const child = spawn("docker", dockerArgs, {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code) => process.exit(code ?? 1));
