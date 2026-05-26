import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { buildMappedSessions } from '@shared/matcher';
import type { AppSettings } from '@shared/types';
import { getSettings, updateSettings } from './settings';
import { copyResumeCommand } from './resume';

export function registerIpcHandlers(): void {
  ipcMain.handle('sessions:list', async () => {
    const settings = getSettings();
    return buildMappedSessions({ settings });
  });

  ipcMain.handle('settings:get', () => getSettings());

  ipcMain.handle('settings:set', (_e, patch: Partial<AppSettings>) => {
    return updateSettings(patch);
  });

  ipcMain.handle('resume:copy', (_e, sessionId: string) => {
    return copyResumeCommand(sessionId);
  });

  ipcMain.handle('repo:pick', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: 'Choose Git repository',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('shell:openExternal', (_e, url: string) => {
    return shell.openExternal(url);
  });
}
