import { app, BrowserWindow, Menu } from 'electron';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { registerIpcHandlers } from './ipc';

const isDev = !app.isPackaged;

function resolveWindowIcon(): string | undefined {
  // dev: build/icon.png 需先跑 npm run build:icon 產出;若無則回傳 undefined 讓 Electron 用預設
  // packaged: 由 electron-builder 透過 extraResources 複製到 resources/icon.png
  const candidate = isDev
    ? join(__dirname, '../../build/icon.png')
    : join(process.resourcesPath, 'icon.png');
  return existsSync(candidate) ? candidate : undefined;
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 820,
    minHeight: 520,
    title: 'Claude Branch Map',
    icon: resolveWindowIcon(),
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}

app.whenReady().then(() => {
  if (!isDev) Menu.setApplicationMenu(null);
  registerIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
