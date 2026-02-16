const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("app", {
  platform: process.platform,
  versions: process.versions
});

contextBridge.exposeInMainWorld("journal", {
  getEntry: (date) => ipcRenderer.invoke("journal:get-entry", date),
  upsertEntry: (entry) => ipcRenderer.invoke("journal:upsert-entry", entry),
  listEntries: (limit) => ipcRenderer.invoke("journal:list-entries", limit),
  listEntryDates: (yearMonth) => ipcRenderer.invoke("journal:list-entry-dates", yearMonth),
  exportEntries: (format) => ipcRenderer.invoke("journal:export-entries", format),
  backupDatabase: () => ipcRenderer.invoke("journal:backup-db"),
  restoreDatabase: () => ipcRenderer.invoke("journal:restore-db"),
  exportEntryPdf: (entry) => ipcRenderer.invoke("journal:export-entry-pdf", entry),
  getDataDir: () => ipcRenderer.invoke("journal:get-data-dir"),
  openDataDir: () => ipcRenderer.invoke("journal:open-data-dir")
});
