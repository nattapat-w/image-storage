import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startApiServer } from "./api-dev-run.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profile = process.argv[2] ?? "local";
const envPath = path.join(root, "apps", "api", `.env.${profile}`);
const examplePath = `${envPath}.example`;

function parseEnvFile(filePath) {
  const env = { ...process.env };
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

if (!fs.existsSync(envPath)) {
  console.error(`Missing ${path.relative(root, envPath)}`);
  console.error(`Copy: cp apps/api/.env.${profile}.example apps/api/.env.${profile}`);
  if (fs.existsSync(examplePath)) {
    console.error(`(template: ${path.relative(root, examplePath)})`);
  }
  process.exit(1);
}

const env = parseEnvFile(envPath);
console.log(`[api] env profile: ${profile} (${path.relative(root, envPath)})`);

startApiServer({ root, env });
