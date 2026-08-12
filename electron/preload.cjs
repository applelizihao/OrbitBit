const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("orbitbitDesktop", {
  isDesktop: true,
  minimize: () => ipcRenderer.send("window:minimize"),
  quit: () => ipcRenderer.send("window:quit"),
  togglePin: (value) => ipcRenderer.send("window:pin", Boolean(value)),
  setInteractive: (value) => ipcRenderer.send("window:pointer-mode", Boolean(value)),
  resizeTo: (width) => ipcRenderer.send("window:resize-to", Number(width)),
});
