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

const openDb = () => {
  ensureDataDir();
  migrateLegacyDb();
  const db = new Database(dbPath);
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
      "SELECT date, focus, good_things, updated_at FROM entries ORDER BY date DESC LIMIT ?"
    )
    .all(limit);
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

module.exports = {
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
  }
};
