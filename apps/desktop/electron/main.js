import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDesktopServer } from '../server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serverInstance = null;
let serverPort = null;

async function ensureServer() {
  if (serverInstance) {
    return serverPort;
  }
  serverInstance = createDesktopServer();
  await new Promise((resolve) => {
    serverInstance.listen(0, '127.0.0.1', () => {
      const address = serverInstance.address();
      serverPort = address.port;
      process.env.GXL_DESKTOP_API = `http://127.0.0.1:${serverPort}`;
      resolve();
    });
  });
  return serverPort;
}

async function createWindow() {
  const port = await ensureServer();
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1280,
    minHeight: 800,
    title: '工小聊',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const url = process.env.GXL_DESKTOP_URL || `http://127.0.0.1:${port}`;
  await win.loadURL(url);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverInstance) {
    try {
      serverInstance.close();
    } catch (error) {
      console.error('关闭内嵌服务失败', error);
    }
  }
});
