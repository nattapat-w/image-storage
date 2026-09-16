import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const useGpu = process.argv.includes("--gpu");

function composeArgs(...rest) {
  if (useGpu) {
    return ["compose", "-f", "docker-compose.yml", "-f", "docker-compose.gpu.yml", ...rest];
  }
  return ["compose", ...rest];
}

function run(label, args, { optional = false } = {}) {
  console.log(`[ollama] ${label}`);
  const result = spawnSync("docker", args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0 && !optional) {
    process.exit(result.status ?? 1);
  }
}

run(`starting ollama container${useGpu ? " (GPU)" : ""}`, composeArgs("--profile", "ollama", "up", "-d", "ollama"));

run("pulling base model moondream (~1.7 GB, first run only)", composeArgs(
  "exec",
  "-T",
  "ollama",
  "ollama",
  "pull",
  "moondream",
));

run("removing old phototagger model if present", composeArgs(
  "exec",
  "-T",
  "ollama",
  "ollama",
  "rm",
  "phototagger",
), { optional: true });

run("creating phototagger from Modelfile", composeArgs(
  "exec",
  "-T",
  "ollama",
  "ollama",
  "create",
  "phototagger",
  "-f",
  "/modelfiles/Modelfile",
));

console.log("[ollama] ready — enable IMAGE_CLASSIFIER=ollama in apps/api/.env.supabase (or .env.local)");
