const { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

let mainWindow;
let tray;
let saveSizeTimer;

const DEFAULT_WIDTH = 420;
const DEFAULT_HEIGHT = 470;
const MIN_WIDTH = 340;
const MAX_WIDTH = 600;
const ASPECT_RATIO = DEFAULT_WIDTH / DEFAULT_HEIGHT;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(Number(value) || min)));
}

function sizeStatePath() {
  return path.join(app.getPath("userData"), "window-size.json");
}

function loadWindowSize() {
  try {
    const saved = JSON.parse(fs.readFileSync(sizeStatePath(), "utf8"));
    const width = clamp(saved.width, MIN_WIDTH, MAX_WIDTH);
    return { width, height: Math.round(width / ASPECT_RATIO) };
  } catch {
    return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  }
}

function saveWindowSize() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const [width, height] = mainWindow.getSize();
  fs.writeFileSync(sizeStatePath(), JSON.stringify({ width, height }, null, 2));
}

function scheduleWindowSizeSave() {
  clearTimeout(saveSizeTimer);
  saveSizeTimer = setTimeout(saveWindowSize, 240);
}

function resizeWindow(width) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const nextWidth = clamp(width, MIN_WIDTH, MAX_WIDTH);
  mainWindow.setSize(nextWidth, Math.round(nextWidth / ASPECT_RATIO), false);
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const { width: windowWidth, height: windowHeight } = loadWindowSize();
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.max(0, width - windowWidth - 18),
    y: Math.max(0, height - windowHeight - 18),
    transparent: true,
    frame: false,
    resizable: true,
    minWidth: MIN_WIDTH,
    minHeight: Math.round(MIN_WIDTH / ASPECT_RATIO),
    maxWidth: MAX_WIDTH,
    maxHeight: Math.round(MAX_WIDTH / ASPECT_RATIO),
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setAspectRatio(ASPECT_RATIO);

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("OrbitBit renderer failed to load", { errorCode, errorDescription, validatedURL });
  });

  const devUrl = process.env.ORBITBIT_DEV_URL;
  const loadPromise = devUrl
    ? mainWindow.loadURL(devUrl)
    : mainWindow.loadFile(path.join(__dirname, "..", "dist", "client", "index.html"));
  loadPromise.catch((error) => console.error("OrbitBit renderer load rejected", error));
  mainWindow.on("resize", scheduleWindowSizeSave);
  mainWindow.on("closed", () => { mainWindow = null; });
}

function createTray() {
  const iconPath = app.isPackaged
    ? path.join(__dirname, "..", "dist", "client", "assets", "orbitbit-icon.png")
    : path.join(__dirname, "..", "public", "assets", "orbitbit-icon.png");
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 20, height: 20 });
  tray = new Tray(icon);
  tray.setToolTip("OrbitBit · 轨道团子");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "显示 OrbitBit", click: () => mainWindow?.show() },
    { label: "暂时隐藏", click: () => mainWindow?.hide() },
    {
      label: "大小",
      submenu: [
        { label: "小巧", click: () => resizeWindow(340) },
        { label: "标准", click: () => resizeWindow(420) },
        { label: "舒展", click: () => resizeWindow(520) },
      ],
    },
    { type: "separator" },
    { label: "退出", click: () => app.quit() },
  ]));
  tray.on("double-click", () => mainWindow?.show());
}

app.whenReady().then(() => { createWindow(); createTray(); });
app.on("window-all-closed", (event) => event.preventDefault());
ipcMain.on("window:minimize", () => mainWindow?.hide());
ipcMain.on("window:quit", () => app.quit());
ipcMain.on("window:pin", (_event, value) => mainWindow?.setAlwaysOnTop(Boolean(value)));
ipcMain.on("window:pointer-mode", (_event, interactive) => {
  mainWindow?.setIgnoreMouseEvents(!interactive, { forward: true });
});
ipcMain.on("window:resize-to", (_event, width) => resizeWindow(width));
