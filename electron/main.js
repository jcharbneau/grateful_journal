const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
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

  ipcMain.handle("journal:backup-db", async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Backup Journal Database",
      defaultPath: "grateful-journal-backup.sqlite",
      filters: [{ name: "SQLite", extensions: ["sqlite"] }]
    });

    if (canceled || !filePath) return { canceled: true };
    await db.backupDatabase(filePath);
    return { canceled: false, filePath };
  });

  ipcMain.handle("journal:restore-db", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "Restore Journal Database",
      filters: [{ name: "SQLite", extensions: ["sqlite", "db"] }],
      properties: ["openFile"]
    });

    if (canceled || !filePaths || filePaths.length === 0) return { canceled: true };
    db.restoreDatabase(filePaths[0]);
    return { canceled: false, filePath: filePaths[0] };
  });

  ipcMain.handle("journal:get-data-dir", () => {
    return db.getDataDir();
  });

  ipcMain.handle("journal:open-data-dir", async () => {
    const dir = db.getDataDir();
    const result = await shell.openPath(dir);
    return { error: result || null };
  });

  ipcMain.handle("journal:get-settings", () => {
    return db.getSettings();
  });

  ipcMain.handle("journal:update-settings", (_event, settings) => {
    return db.updateSettings(settings);
  });

  ipcMain.handle("journal:update-last-opened", (_event, date) => {
    return db.updateLastOpenedDate(date);
  });

  const pdfMoods = [
    "Happy",
    "Content",
    "Proud",
    "Hopeful",
    "Loving",
    "Connected",
    "Balanced",
    "Joyful",
    "Relaxed",
    "Creative",
    "Excited",
    "Neutral",
    "Insecure",
    "Discouraged",
    "Drained",
    "Sad",
    "Scared",
    "Angry",
    "Annoyed",
    "Anxious",
    "Stressed",
    "Overwhelmed"
  ];

  const escapeHtml = (value) => {
    if (!value) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  ipcMain.handle("journal:export-entry-pdf", async (_event, entry) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Export Entry to PDF",
      defaultPath: `grateful-journal-${entry.date}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }]
    });

    if (canceled || !filePath) return { canceled: true };

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              font-family: "Georgia", "Times New Roman", serif;
              background: #f7f2ea;
              color: #2f2a25;
            }
            .page {
              padding: 36px 40px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 24px;
            }
            .brand {
              letter-spacing: 0.35em;
              text-transform: uppercase;
              font-size: 20px;
            }
            .date {
              font-family: "Arial", sans-serif;
              text-transform: uppercase;
              letter-spacing: 0.2em;
              font-size: 11px;
            }
            .spread {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 24px;
            }
            .panel {
              background: #fffaf2;
              border: 1px solid rgba(47, 42, 37, 0.2);
              border-radius: 18px;
              padding: 18px 20px;
            }
            .panel-title {
              letter-spacing: 0.3em;
              text-transform: uppercase;
              font-size: 14px;
              margin-bottom: 12px;
            }
            .prompt-title {
              font-family: "Arial", sans-serif;
              letter-spacing: 0.3em;
              text-transform: uppercase;
              font-size: 9px;
              color: rgba(47, 42, 37, 0.6);
              margin-bottom: 6px;
            }
            .prompt-value {
              font-family: "Arial", sans-serif;
              font-size: 12px;
              padding-bottom: 10px;
              border-bottom: 1px solid rgba(47, 42, 37, 0.15);
              margin-bottom: 12px;
              white-space: pre-wrap;
              min-height: 18px;
            }
            .moods {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 6px 12px;
              font-family: "Arial", sans-serif;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.2em;
            }
            .mood-item { display: flex; gap: 6px; align-items: center; }
            .checkbox {
              width: 10px; height: 10px; border: 1px solid rgba(47, 42, 37, 0.4);
              background: #fff; display: inline-block;
            }
            .checked { background: #b39c7b; border-color: #b39c7b; }
            .notes {
              min-height: 60px;
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <div class="brand">Grateful Journal</div>
              <div class="date">Date ${escapeHtml(entry.date)}</div>
            </div>
            <div class="spread">
              <div class="panel">
                <div class="panel-title">Morning Meditation</div>
                <div class="prompt-title">Today's Focus</div>
                <div class="prompt-value">${escapeHtml(entry.focus)}</div>
                <div class="prompt-title">An Affirmation for Today</div>
                <div class="prompt-value">${escapeHtml(entry.affirmation)}</div>
                <div class="prompt-title">What I'm Grateful For</div>
                <div class="prompt-value">${escapeHtml(entry.grateful)}</div>
                <div class="prompt-title">What I'm Excited About Today</div>
                <div class="prompt-value">${escapeHtml(entry.excited)}</div>
                <div class="prompt-title">How I'll Make Space for Gratitude</div>
                <div class="prompt-value">${escapeHtml(entry.space)}</div>
              </div>
              <div class="panel">
                <div class="panel-title">Evening Reflection</div>
                <div class="prompt-title">Good Things That Happened Today</div>
                <div class="prompt-value">${escapeHtml(entry.good_things)}</div>
                <div class="prompt-title">Things I Did to Make a Positive Difference Today</div>
                <div class="prompt-value">${escapeHtml(entry.positive_difference)}</div>
                <div class="prompt-title">How I Felt Today</div>
                <div class="moods">
                  ${pdfMoods
                    .map((mood) => {
                      const checked = entry.felt_moods && entry.felt_moods.includes(mood);
                      return `<div class="mood-item"><span class="checkbox ${
                        checked ? "checked" : ""
                      }"></span>${mood}</div>`;
                    })
                    .join("")}
                </div>
                <div class="prompt-title">Notes</div>
                <div class="prompt-value notes">${escapeHtml(entry.notes)}</div>
                <div class="prompt-title">A Positive Thought to Carry Me to Sleep</div>
                <div class="prompt-value">${escapeHtml(entry.sleep_thought)}</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const pdfWindow = new BrowserWindow({
      show: false,
      width: 1200,
      height: 900,
      webPreferences: {
        offscreen: true
      }
    });

    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdfData = await pdfWindow.webContents.printToPDF({ printBackground: true });
    fs.writeFileSync(filePath, pdfData);
    pdfWindow.close();
    return { canceled: false, filePath };
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
