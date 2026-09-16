import { execSync } from "node:child_process";

const ports = process.argv.slice(2).map(Number).filter((n) => n > 0);
if (ports.length === 0) {
  console.error("usage: node scripts/free-ports.mjs <port>...");
  process.exit(1);
}

const isWin = process.platform === "win32";

function listeningPids(port) {
  if (isWin) {
    let out = "";
    try {
      out = execSync("netstat -ano", { encoding: "utf8" });
    } catch {
      return [];
    }
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes("LISTENING")) continue;
      const parts = line.trim().split(/\s+/);
      const local = parts[1] ?? "";
      if (!local.endsWith(`:${port}`)) continue;
      const pid = parts.at(-1);
      if (pid && pid !== "0") pids.add(pid);
    }
    return [...pids];
  }

  try {
    const out = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, {
      encoding: "utf8",
    });
    return out.trim().split(/\s+/).filter(Boolean);
  } catch {
    return [];
  }
}

function kill(pid) {
  if (isWin) {
    execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    return;
  }
  execSync(`kill -9 ${pid}`, { stdio: "ignore" });
}

for (const port of ports) {
  for (const pid of listeningPids(port)) {
    try {
      kill(pid);
      console.log(`killed pid ${pid} on :${port}`);
    } catch {
      // already gone
    }
  }
}
