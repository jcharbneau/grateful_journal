const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 980,
    minHeight: 720,
    backgroundColor: "#f4efe6",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  } else {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  }
};

app.whenReady().then(() => {
  createWindow();

  let db;
  try {
    db = require("./db");
  } catch (error) {
    dialog.showErrorBox(
      "Database Setup Error",
      "Failed to load the SQLite module. Ensure build tools are installed, then run npm install again."
    );
    throw error;
  }

  ipcMain.handle("journal:get-entry", (_event, date) => {
    return db.getEntry(date);
  });

  ipcMain.handle("journal:upsert-entry", (_event, entry) => {
    return db.upsertEntry(entry);
  });

  ipcMain.handle("journal:list-entries", (_event, limit) => {
    return db.listEntries(limit || 30);
  });

  ipcMain.handle("journal:list-entry-dates", (_event, yearMonth) => {
    return db.listEntryDates(yearMonth);
  });

  ipcMain.handle("journal:export-entries", async (_event, format) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Export Journal",
      defaultPath: `grateful-journal.${format}`,
      filters: [
        format === "json"
          ? { name: "JSON", extensions: ["json"] }
          : { name: "CSV", extensions: ["csv"] }
      ]
    });

    if (canceled || !filePath) return { canceled: true };

    const entries = db.getAllEntries();
    let output = "";

    if (format === "json") {
      output = JSON.stringify(entries, null, 2);
    } else {
      const headers = [
        "date",
        "focus",
        "affirmation",
        "grateful",
        "excited",
        "space",
        "good_things",
        "positive_difference",
        "felt_moods",
        "notes",
        "sleep_thought",
        "updated_at"
      ];

      const escapeValue = (value) => {
        const stringValue = value == null ? "" : String(value);
        return `"${stringValue.replace(/"/g, '""')}"`;
      };

      const rows = entries.map((entry) =>
        headers
          .map((key) =>
            key === "felt_moods"
              ? escapeValue((entry.felt_moods || []).join("; "))
              : escapeValue(entry[key])
          )
          .join(",")
      );

      output = [headers.join(","), ...rows].join("\n");
    }

    fs.writeFileSync(filePath, output, "utf8");
    return { canceled: false, filePath };
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
