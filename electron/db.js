const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { app } = require("electron");

const dataDir = path.join(app.getPath("home"), ".grateful-journal");
const dbPath = path.join(dataDir, "journal.sqlite");
const legacyPath = path.join(app.getPath("userData"), "journal.sqlite");

const ensureDataDir = () => {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
};

const migrateLegacyDb = () => {
  if (fs.existsSync(dbPath)) return;
  if (!fs.existsSync(legacyPath)) return;
  ensureDataDir();
  fs.renameSync(legacyPath, dbPath);
};

const dbStatus = {
  recovered: false,
  recoveryPath: null,
  error: null
};

const ensureSettingsColumns = (db) => {
  const existing = db.prepare("PRAGMA table_info(settings)").all().map((row) => row.name);
  const addColumn = (name, type) => {
    if (!existing.includes(name)) {
      db.exec(`ALTER TABLE settings ADD COLUMN ${name} ${type}`);
    }
  };

  addColumn("reminder_enabled", "INTEGER");
  addColumn("reminder_time", "TEXT");
  addColumn("first_run_complete", "INTEGER");
};

const openDb = () => {
  ensureDataDir();
  migrateLegacyDb();
  let db;
  try {
    db = new Database(dbPath);
  } catch (error) {
    dbStatus.error = error.message;
    if (fs.existsSync(dbPath)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const recoveryPath = path.join(dataDir, `journal.sqlite.corrupt-${stamp}`);
      fs.renameSync(dbPath, recoveryPath);
      dbStatus.recovered = true;
      dbStatus.recoveryPath = recoveryPath;
    }
    db = new Database(dbPath);
  }

  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      date TEXT PRIMARY KEY,
      focus TEXT,
      affirmation TEXT,
      grateful TEXT,
      excited TEXT,
      space TEXT,
      good_things TEXT,
      positive_difference TEXT,
      felt_moods TEXT,
      notes TEXT,
      sleep_thought TEXT,
      updated_at TEXT
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT,
      timezone TEXT,
      default_date_view TEXT,
      reminder_enabled INTEGER,
      reminder_time TEXT,
      first_run_complete INTEGER,
      last_opened_date TEXT,
      updated_at TEXT
    );
  `);
  ensureSettingsColumns(db);
  return db;
};

let db = openDb();

const emptyEntry = (date) => ({
  date,
  focus: "",
  affirmation: "",
  grateful: "",
  excited: "",
  space: "",
  good_things: "",
  positive_difference: "",
  felt_moods: [],
  notes: "",
  sleep_thought: ""
});

const getEntry = (date) => {
  const row = db.prepare("SELECT * FROM entries WHERE date = ?").get(date);
  if (!row) return emptyEntry(date);

  return {
    ...row,
    felt_moods: row.felt_moods ? JSON.parse(row.felt_moods) : []
  };
};

const upsertEntry = (entry) => {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO entries (
      date,
      focus,
      affirmation,
      grateful,
      excited,
      space,
      good_things,
      positive_difference,
      felt_moods,
      notes,
      sleep_thought,
      updated_at
    ) VALUES (
      @date,
      @focus,
      @affirmation,
      @grateful,
      @excited,
      @space,
      @good_things,
      @positive_difference,
      @felt_moods,
      @notes,
      @sleep_thought,
      @updated_at
    )
    ON CONFLICT(date) DO UPDATE SET
      focus = excluded.focus,
      affirmation = excluded.affirmation,
      grateful = excluded.grateful,
      excited = excluded.excited,
      space = excluded.space,
      good_things = excluded.good_things,
      positive_difference = excluded.positive_difference,
      felt_moods = excluded.felt_moods,
      notes = excluded.notes,
      sleep_thought = excluded.sleep_thought,
      updated_at = excluded.updated_at
  `);

  stmt.run({
    ...entry,
    felt_moods: JSON.stringify(entry.felt_moods || []),
    updated_at: now
  });

  return getEntry(entry.date);
};

const listEntries = (limit = 30) => {
  return db
    .prepare(
      "SELECT date, focus, good_things, notes, felt_moods, updated_at FROM entries ORDER BY date DESC LIMIT ?"
    )
    .all(limit)
    .map((row) => ({
      ...row,
      felt_moods: row.felt_moods ? JSON.parse(row.felt_moods) : []
    }));
};

const listEntryDates = (yearMonth) => {
  return db
    .prepare("SELECT date FROM entries WHERE date LIKE ? ORDER BY date ASC")
    .all(`${yearMonth}-%`)
    .map((row) => row.date);
};

const getAllEntries = () => {
  return db.prepare("SELECT * FROM entries ORDER BY date ASC").all().map((row) => ({
    ...row,
    felt_moods: row.felt_moods ? JSON.parse(row.felt_moods) : []
  }));
};

const getSettings = () => {
  const row = db.prepare("SELECT * FROM settings WHERE id = 1").get();
  const defaults = {
    name: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    default_date_view: "today",
    reminder_enabled: 0,
    reminder_time: "20:30",
    first_run_complete: 0,
    last_opened_date: null
  };

  if (!row) {
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO settings (id, name, timezone, default_date_view, reminder_enabled, reminder_time, first_run_complete, last_opened_date, updated_at) VALUES (1, @name, @timezone, @default_date_view, @reminder_enabled, @reminder_time, @first_run_complete, @last_opened_date, @updated_at)"
    ).run({
      ...defaults,
      updated_at: now
    });
    return defaults;
  }

  return {
    name: row.name || "",
    timezone: row.timezone || defaults.timezone,
    default_date_view: row.default_date_view || "today",
    reminder_enabled: row.reminder_enabled ?? defaults.reminder_enabled,
    reminder_time: row.reminder_time || defaults.reminder_time,
    first_run_complete: row.first_run_complete ?? defaults.first_run_complete,
    last_opened_date: row.last_opened_date || null
  };
};

const updateSettings = (settings) => {
  const current = getSettings();
  const merged = {
    ...current,
    ...settings
  };
  const now = new Date().toISOString();

  db.prepare(
    `
      INSERT INTO settings (id, name, timezone, default_date_view, reminder_enabled, reminder_time, first_run_complete, last_opened_date, updated_at)
      VALUES (1, @name, @timezone, @default_date_view, @reminder_enabled, @reminder_time, @first_run_complete, @last_opened_date, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        timezone = excluded.timezone,
        default_date_view = excluded.default_date_view,
        reminder_enabled = excluded.reminder_enabled,
        reminder_time = excluded.reminder_time,
        first_run_complete = excluded.first_run_complete,
        last_opened_date = excluded.last_opened_date,
        updated_at = excluded.updated_at
    `
  ).run({
    ...merged,
    updated_at: now
  });

  return getSettings();
};

const updateLastOpenedDate = (date) => {
  const current = getSettings();
  return updateSettings({
    ...current,
    last_opened_date: date
  });
};

module.exports = {
  getDataDir: () => dataDir,
  getDbPath: () => dbPath,
  getEntry,
  upsertEntry,
  listEntries,
  listEntryDates,
  getAllEntries,
  backupDatabase: async (filePath) => {
    await db.backup(filePath);
  },
  restoreDatabase: (filePath) => {
    db.close();
    ensureDataDir();
    fs.copyFileSync(filePath, dbPath);
    db = openDb();
  },
  getSettings,
  updateSettings,
  updateLastOpenedDate,
  getDbStatus: () => ({ ...dbStatus })
};
