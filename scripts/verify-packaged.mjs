import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const executable = resolve(process.argv[2] ?? "release/win-unpacked/OrbitBit.exe");
const port = Number(process.argv[3] ?? 9223);

if (!existsSync(executable)) {
  throw new Error(`Executable not found: ${executable}`);
}

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function findPageTarget() {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
      if (page) return page;
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(`DevTools target did not become available: ${lastError?.message ?? "unknown error"}`);
}

function evaluate(target, expression) {
  return new Promise((resolveEvaluation, rejectEvaluation) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    const timeout = setTimeout(() => {
      socket.close();
      rejectEvaluation(new Error("Timed out while evaluating the packaged renderer"));
    }, 10_000);

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({
        id: 1,
        method: "Runtime.evaluate",
        params: { expression, returnByValue: true },
      }));
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id !== 1) return;
      clearTimeout(timeout);
      socket.close();
      if (message.error || message.result?.exceptionDetails) {
        rejectEvaluation(new Error(JSON.stringify(message.error ?? message.result.exceptionDetails)));
        return;
      }
      resolveEvaluation(message.result.result.value);
    });

    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      rejectEvaluation(new Error("Could not connect to the packaged renderer"));
    });
  });
}

const child = spawn(executable, [`--remote-debugging-port=${port}`], {
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: "1" },
});

let childOutput = "";
child.stdout.on("data", (chunk) => { childOutput += String(chunk); });
child.stderr.on("data", (chunk) => { childOutput += String(chunk); });

try {
  const target = await findPageTarget();
  let result;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    result = await evaluate(target, `(() => {
      const character = document.querySelector('.pet-wrap img');
      const backgroundOf = (selector) => {
        const element = document.querySelector(selector);
        return element ? getComputedStyle(element).backgroundColor : null;
      };
      return {
        readyState: document.readyState,
        shell: document.body.dataset.shell,
        title: document.title,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        characterLoaded: Boolean(character?.complete && character.naturalWidth > 0),
        controls: document.querySelectorAll('button').length,
        backgrounds: {
          html: getComputedStyle(document.documentElement).backgroundColor,
          body: getComputedStyle(document.body).backgroundColor,
          root: backgroundOf('#root'),
          stage: backgroundOf('.desktop-stage')
        },
        text: document.body.innerText.slice(0, 200),
        html: document.documentElement.outerHTML.slice(0, 500),
        resources: performance.getEntriesByType('resource').map((entry) => entry.name)
      };
    })()`);
    if (
      result.readyState === "complete"
      && result.shell === "desktop"
      && result.characterLoaded
      && result.controls >= 6
      && result.viewport.width >= 340
      && result.viewport.width <= 600
      && Math.abs(result.viewport.width / result.viewport.height - 420 / 470) < 0.01
      && Object.values(result.backgrounds).every((color) => color === "rgba(0, 0, 0, 0)")
    ) break;
    await delay(250);
  }

  console.log(JSON.stringify({ targetUrl: target.url, ...result }, null, 2));

  if (
    result.readyState !== "complete"
    || result.shell !== "desktop"
    || !result.characterLoaded
    || result.controls < 6
    || result.viewport.width < 340
    || result.viewport.width > 600
    || Math.abs(result.viewport.width / result.viewport.height - 420 / 470) >= 0.01
    || !Object.values(result.backgrounds).every((color) => color === "rgba(0, 0, 0, 0)")
  ) {
    if (childOutput.trim()) console.error(childOutput.trim());
    throw new Error("Packaged renderer did not load the expected OrbitBit desktop UI");
  }

  await evaluate(target, "window.orbitbitDesktop?.resizeTo(520); true");
  await delay(500);
  const resized = await evaluate(target, "({ width: window.innerWidth, height: window.innerHeight })");
  console.log(JSON.stringify({ resizeCheck: resized }, null, 2));
  if (resized.width !== 520 || Math.abs(resized.width / resized.height - 420 / 470) >= 0.01) {
    throw new Error("Packaged window did not resize to the expected fixed aspect ratio");
  }
  await evaluate(target, "window.orbitbitDesktop?.resizeTo(420); true");
  await delay(500);
} finally {
  child.kill();
}
