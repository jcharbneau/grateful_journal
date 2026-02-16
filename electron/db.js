const path = require("path");
const Database = require("better-sqlite3");
const { app } = require("electron");

const dbPath = path.join(app.getPath("userData"), "journal.sqlite");
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
  getEntry,
  upsertEntry,
  listEntries,
  listEntryDates,
  getAllEntries
};
