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
  exportEntryPdf: (entry) => ipcRenderer.invoke("journal:export-entry-pdf", entry)
});
