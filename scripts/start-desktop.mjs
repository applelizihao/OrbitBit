import { spawn } from "node:child_process";
import process from "node:process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const electronCommand = process.platform === "win32" ? "node_modules\\.bin\\electron.cmd" : "node_modules/.bin/electron";

const vite = spawn(npmCommand, ["run", "dev", "--", "--host", "127.0.0.1", "--port", "4173", "--strictPort"], {
  stdio: "inherit",
  shell: false,
});

let electron;
const timer = setInterval(async () => {
  try {
    const response = await fetch("http://127.0.0.1:4173");
    if (!response.ok) return;
    clearInterval(timer);
    electron = spawn(electronCommand, ["."], {
      stdio: "inherit",
      env: { ...process.env, ORBITBIT_DEV_URL: "http://127.0.0.1:4173" },
      shell: false,
    });
    electron.on("exit", shutdown);
  } catch {
    // Vite is still warming up.
  }
}, 250);

function shutdown(code = 0) {
  clearInterval(timer);
  if (!vite.killed) vite.kill();
  process.exit(typeof code === "number" ? code : 0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
vite.on("exit", (code) => {
  if (!electron) shutdown(code ?? 1);
});
