import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Build API into apps/api/bin and run it (not `go run`).
 * Corporate Windows App Control often blocks executables under %LocalAppData%\go-build.
 */
export function startApiServer({ root, env }) {
  const apiDir = path.join(root, "apps", "api");
  const binName = process.platform === "win32" ? "api.exe" : "api";
  const binDir = path.join(apiDir, "bin");
  const binPath = path.join(binDir, binName);
  const relOut = path.join("bin", binName);

  fs.mkdirSync(binDir, { recursive: true });
  const goCache = path.join(apiDir, ".cache", "go-build");
  fs.mkdirSync(goCache, { recursive: true });

  const goEnv = { ...env, GOCACHE: goCache };

  console.log(
    `[api] building ${relOut} (project bin — not %LocalAppData%\\go-build)`,
  );
  const build = spawnSync("go", ["build", "-o", relOut, "./cmd/server"], {
    cwd: apiDir,
    env: goEnv,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }

  if (!fs.existsSync(binPath)) {
    console.error(`[api] missing binary after build: ${binPath}`);
    process.exit(1);
  }

  // Direct spawn(binPath) on Windows often throws spawn UNKNOWN when Device Guard blocks the .exe.
  const child =
    process.platform === "win32"
      ? spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", binPath], {
          cwd: apiDir,
          env,
          stdio: "inherit",
        })
      : spawn(binPath, [], {
          cwd: apiDir,
          env,
          stdio: "inherit",
        });

  child.on("error", (err) => {
    console.error("[api] failed to start API process:", err.message);
    printWindowsPolicyHint();
    process.exit(1);
  });

  child.on("exit", (code) => process.exit(code ?? 1));
  return child;
}

function printWindowsPolicyHint() {
  if (process.platform !== "win32") return;
  console.error("");
  console.error(
    "[api] Windows Device Guard / App Control may block locally built Go binaries.",
  );
  console.error(
    "[api] Use Docker for the API:  pnpm dev:docker   (or pnpm dev:api:docker with pnpm dev:web)",
  );
  console.error(
    "[api] Or ask IT to allow: apps/api/bin/api.exe (or Go dev under your project folder).",
  );
  console.error("");
}
