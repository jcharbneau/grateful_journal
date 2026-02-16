import React, { useEffect, useMemo, useRef, useState } from "react";

const moods = [
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

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const Prompt = ({ title, rows = 3, value, onChange }) => (
  <div className="prompt-block">
    <div className="prompt-title">{title}</div>
    <textarea
      className="entry lines"
      rows={rows}
      spellCheck="false"
      value={value}
      onChange={onChange}
    />
  </div>
);

export default function App() {
  const today = useMemo(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  }, []);
  const [date, setDate] = useState(today);
  const [entry, setEntry] = useState(null);
  const [status, setStatus] = useState("Idle");
  const [dirty, setDirty] = useState(false);
  const [flipDirection, setFlipDirection] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [entryList, setEntryList] = useState([]);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [monthDates, setMonthDates] = useState([]);
  const [exportStatus, setExportStatus] = useState("Idle");
  const [backupStatus, setBackupStatus] = useState("Idle");
  const saveTimeout = useRef(null);
  const suppressSave = useRef(true);
  const dateRef = useRef(today);

  useEffect(() => {
    let active = true;
    setStatus("Loading");
    setDirty(false);
    suppressSave.current = true;
    window.journal.getEntry(date).then((data) => {
      if (!active) return;
      setEntry(data);
      setStatus("Idle");
      suppressSave.current = false;
    });
    return () => {
      active = false;
    };
  }, [date]);

  useEffect(() => {
    if (!drawerOpen) return;
    window.journal.listEntries(60).then((rows) => setEntryList(rows));
  }, [drawerOpen, date]);

  useEffect(() => {
    if (!drawerOpen) return;
    window.journal.listEntryDates(month).then((dates) => setMonthDates(dates));
  }, [drawerOpen, month]);

  const updateField = (field) => (event) => {
    const value = event.target.value;
    setEntry((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
    setStatus("Unsaved");
  };

  const toggleMood = (mood) => {
    setEntry((prev) => {
      const current = new Set(prev.felt_moods || []);
      if (current.has(mood)) current.delete(mood);
      else current.add(mood);
      return { ...prev, felt_moods: Array.from(current) };
    });
    setDirty(true);
    setStatus("Unsaved");
  };

  const handleSave = async () => {
    if (!entry) return;
    setStatus("Saving");
    try {
      const saved = await window.journal.upsertEntry(entry);
      setEntry(saved);
      setDirty(false);
      setStatus("Saved");
      if (drawerOpen) {
        window.journal.listEntries(60).then((rows) => setEntryList(rows));
        window.journal.listEntryDates(month).then((dates) => setMonthDates(dates));
      }
      setTimeout(() => setStatus("Idle"), 1200);
    } catch (error) {
      setStatus("Error");
    }
  };

  const shiftDate = (days) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    const nextDate = next.toISOString().slice(0, 10);
    triggerFlip(nextDate);
    setDate(nextDate);
  };

  const triggerFlip = (nextDate) => {
    if (!nextDate || nextDate === dateRef.current) return;
    const direction = nextDate > dateRef.current ? "right" : "left";
    setFlipDirection(direction);
    setTimeout(() => setFlipDirection(""), 520);
    dateRef.current = nextDate;
    setMonth(nextDate.slice(0, 7));
  };

  const handleDateChange = (event) => {
    const nextDate = event.target.value;
    if (!nextDate) return;
    triggerFlip(nextDate);
    setDate(nextDate);
  };

  const handleExport = async (format) => {
    setExportStatus("Exporting");
    const result = await window.journal.exportEntries(format);
    if (result && !result.canceled) {
      setExportStatus("Exported");
      setTimeout(() => setExportStatus("Idle"), 1500);
    } else {
      setExportStatus("Idle");
    }
  };

  const handleExportPdf = async () => {
    if (!entry) return;
    setExportStatus("Exporting");
    const result = await window.journal.exportEntryPdf(entry);
    if (result && !result.canceled) {
      setExportStatus("Exported");
      setTimeout(() => setExportStatus("Idle"), 1500);
    } else {
      setExportStatus("Idle");
    }
  };

  const handleBackup = async () => {
    setBackupStatus("Backing up");
    const result = await window.journal.backupDatabase();
    if (result && !result.canceled) {
      setBackupStatus("Backup saved");
      setTimeout(() => setBackupStatus("Idle"), 1500);
    } else {
      setBackupStatus("Idle");
    }
  };

  const handleRestore = async () => {
    setBackupStatus("Restoring");
    const result = await window.journal.restoreDatabase();
    if (result && !result.canceled) {
      const refreshed = await window.journal.getEntry(date);
      setEntry(refreshed);
      if (drawerOpen) {
        window.journal.listEntries(60).then((rows) => setEntryList(rows));
        window.journal.listEntryDates(month).then((dates) => setMonthDates(dates));
      }
      setBackupStatus("Restored");
      setTimeout(() => setBackupStatus("Idle"), 1500);
    } else {
      setBackupStatus("Idle");
    }
  };


  const monthMeta = useMemo(() => {
    const [year, monthValue] = month.split("-").map(Number);
    const first = new Date(year, monthValue - 1, 1);
    const last = new Date(year, monthValue, 0);
    return {
      year,
      month: monthValue,
      firstDay: first.getDay(),
      daysInMonth: last.getDate()
    };
  }, [month]);

  const monthLabel = useMemo(() => {
    const [year, monthValue] = month.split("-");
    const dateValue = new Date(Number(year), Number(monthValue) - 1, 1);
    return dateValue.toLocaleString("default", { month: "long", year: "numeric" });
  }, [month]);

  const calendarWeeks = useMemo(() => {
    const [year, monthValue] = month.split("-").map(Number);
    const daysInMonth = monthMeta.daysInMonth;
    const firstDate = new Date(year, monthValue - 1, 1);
    const firstDayIndex = firstDate.getDay();
    const cells = Array(firstDayIndex).fill(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(day);
    }
    const totalCells = Math.ceil(cells.length / 7) * 7;
    while (cells.length < totalCells) cells.push(null);

    const getWeekNumber = (dateValue) => {
      const target = new Date(dateValue.valueOf());
      const dayNr = (target.getDay() + 6) % 7;
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = new Date(target.getFullYear(), 0, 4);
      const firstDayNr = (firstThursday.getDay() + 6) % 7;
      firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);
      const weekNumber =
        1 + Math.round((target - firstThursday) / (7 * 24 * 60 * 60 * 1000));
      return weekNumber;
    };

    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) {
      const slice = cells.slice(i, i + 7);
      const dayValue = slice.find((value) => value != null) || 1;
      const weekDate = new Date(year, monthValue - 1, dayValue);
      weeks.push({ weekNumber: getWeekNumber(weekDate), days: slice });
    }
    return weeks;
  }, [month, monthMeta.daysInMonth]);

  const entryDatesSet = useMemo(() => new Set(monthDates), [monthDates]);

  useEffect(() => {
    if (!entry || suppressSave.current || !dirty) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);

    saveTimeout.current = setTimeout(() => {
      handleSave();
    }, 800);

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [entry, dirty]);

  if (!entry) return <div className="page">Loading...</div>;

  return (
    <div className="page">
      <header className="page-header">
        <div className="brand">Grateful Journal</div>
        <div className="header-actions">
          <div className="date-save">
            <label className="date-field">
              <span>Date</span>
              <input type="date" value={date} onChange={handleDateChange} />
            </label>
            <button className="save-button" type="button" onClick={handleSave}>
              {status === "Saving"
                ? "Saving..."
                : status === "Saved"
                ? "Saved"
                : status === "Error"
                ? "Retry Save"
                : "Save"}
            </button>
          </div>
          <span className="save-hint">Autosave on</span>
        </div>
      </header>

      <div className="toolbar">
        <button className="ghost-button" type="button" onClick={() => setDrawerOpen(true)}>
          Browse Entries
        </button>
        <div className="export-group">
          <span className="export-label">Export</span>
          <button className="ghost-button" type="button" onClick={() => handleExport("json")}>
            JSON
          </button>
          <button className="ghost-button" type="button" onClick={() => handleExport("csv")}>
            CSV
          </button>
          <button className="ghost-button" type="button" onClick={handleExportPdf}>
            PDF
          </button>
          <span className="export-status">
            {exportStatus === "Exporting"
              ? "Exporting..."
              : exportStatus === "Exported"
              ? "Saved"
              : ""}
          </span>
        </div>
      </div>

      <div className="spread-frame">
        <button className="page-nav left" type="button" aria-label="Previous day" onClick={() => shiftDate(-1)} />
        <div className={`spread ${flipDirection ? `flip-${flipDirection}` : ""}`}>
        <section className="panel morning">
          <div className="panel-title">Morning Meditation</div>
          <Prompt title="Today's Focus" rows={3} value={entry.focus} onChange={updateField("focus")} />
          <Prompt
            title="An Affirmation for Today"
            rows={4}
            value={entry.affirmation}
            onChange={updateField("affirmation")}
          />
          <Prompt
            title="What I'm Grateful For"
            rows={6}
            value={entry.grateful}
            onChange={updateField("grateful")}
          />
          <Prompt
            title="What I'm Excited About Today"
            rows={3}
            value={entry.excited}
            onChange={updateField("excited")}
          />
          <Prompt
            title="How I'll Make Space for Gratitude"
            rows={3}
            value={entry.space}
            onChange={updateField("space")}
          />
        </section>

        <section className="panel evening">
          <div className="panel-title">Evening Reflection</div>
          <Prompt
            title="Good Things That Happened Today"
            rows={4}
            value={entry.good_things}
            onChange={updateField("good_things")}
          />
          <Prompt
            title="Things I Did to Make a Positive Difference Today"
            rows={4}
            value={entry.positive_difference}
            onChange={updateField("positive_difference")}
          />

          <div className="prompt-block">
            <div className="prompt-title">How I Felt Today</div>
            <div className="mood-grid">
              {moods.map((mood) => (
                <label key={mood} className="mood-item">
                  <input
                    type="checkbox"
                    checked={(entry.felt_moods || []).includes(mood)}
                    onChange={() => toggleMood(mood)}
                  />
                  <span>{mood}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="prompt-block notes">
            <div className="prompt-title">Notes</div>
            <textarea
              className="entry lines"
              rows={6}
              spellCheck="false"
              value={entry.notes}
              onChange={updateField("notes")}
            />
          </div>

          <Prompt
            title="A Positive Thought to Carry Me to Sleep"
            rows={3}
            value={entry.sleep_thought}
            onChange={updateField("sleep_thought")}
          />
        </section>
      </div>
        <button className="page-nav right" type="button" aria-label="Next day" onClick={() => shiftDate(1)} />
      </div>

      <div className={`drawer ${drawerOpen ? "open" : ""}`}>
        <div className="drawer-header">
          <div>
            <div className="drawer-title">Journal</div>
            <div className="drawer-subtitle">Browse entries by date</div>
          </div>
          <button className="ghost-button" type="button" onClick={() => setDrawerOpen(false)}>
            Close
          </button>
        </div>

        <div className="calendar">
          <div className="calendar-header">
            <button
              className="icon-button"
              type="button"
              onClick={() => {
                const next = new Date(month + "-01");
                next.setMonth(next.getMonth() - 1);
                setMonth(next.toISOString().slice(0, 7));
              }}
            >
              ◀
            </button>
            <div className="calendar-title">{monthLabel}</div>
            <button
              className="icon-button"
              type="button"
              onClick={() => {
                const next = new Date(month + "-01");
                next.setMonth(next.getMonth() + 1);
                setMonth(next.toISOString().slice(0, 7));
              }}
            >
              ▶
            </button>
          </div>

          <div className="calendar-pickers">
            <label className="picker">
              <span>Month</span>
              <select
                value={Number(month.split("-")[1]) - 1}
                onChange={(event) => {
                  const [year] = month.split("-");
                  const nextMonth = String(Number(event.target.value) + 1).padStart(2, "0");
                  setMonth(`${year}-${nextMonth}`);
                }}
              >
                {monthNames.map((name, index) => (
                  <option value={index} key={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="picker">
              <span>Year</span>
              <select
                value={Number(month.split("-")[0])}
                onChange={(event) => {
                  const [, monthValue] = month.split("-");
                  setMonth(`${event.target.value}-${monthValue}`);
                }}
              >
                {Array.from({ length: 8 }).map((_, index) => {
                  const yearValue = new Date().getFullYear() - 4 + index;
                  return (
                    <option value={yearValue} key={yearValue}>
                      {yearValue}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>

          <div className="calendar-grid">
            <div className="calendar-week-label">WK</div>
            {weekDays.map((day) => (
              <div key={day} className="calendar-day-label">
                {day}
              </div>
            ))}
            {calendarWeeks.map((week) => (
              <React.Fragment key={`week-${week.weekNumber}`}>
                <div className="calendar-week-number">{week.weekNumber}</div>
                {week.days.map((day, index) => {
                  if (!day) {
                    return <div key={`empty-${week.weekNumber}-${index}`} className="calendar-cell empty" />;
                  }
                  const dayValue = `${month}-${String(day).padStart(2, "0")}`;
                  const hasEntry = entryDatesSet.has(dayValue);
                  const isActive = dayValue === date;
                  return (
                    <button
                      key={dayValue}
                      className={`calendar-cell ${hasEntry ? "has-entry" : ""} ${
                        isActive ? "active" : ""
                      }`}
                      type="button"
                      onClick={() => {
                        triggerFlip(dayValue);
                        setDate(dayValue);
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="entry-list">
          {entryList.length === 0 ? (
            <div className="empty-state">No entries yet.</div>
          ) : (
            entryList.map((row) => (
              <button
                key={row.date}
                className={`entry-card ${row.date === date ? "active" : ""}`}
                type="button"
                onClick={() => {
                  triggerFlip(row.date);
                  setDate(row.date);
                }}
              >
                <div className="entry-date">{row.date}</div>
                <div className="entry-snippet">
                  {row.focus || row.good_things || "No details yet."}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="backup-panel">
          <div className="backup-title">Backup & Restore</div>
          <div className="backup-actions">
            <button className="ghost-button" type="button" onClick={handleBackup}>
              Backup
            </button>
            <button className="ghost-button" type="button" onClick={handleRestore}>
              Restore
            </button>
            <span className="backup-status">
              {backupStatus === "Backing up"
                ? "Saving..."
                : backupStatus === "Backup saved"
                ? "Backup saved"
                : backupStatus === "Restoring"
                ? "Restoring..."
                : backupStatus === "Restored"
                ? "Restored"
                : ""}
            </span>
          </div>
        </div>

      </div>
      <div className={`drawer-backdrop ${drawerOpen ? "show" : ""}`} onClick={() => setDrawerOpen(false)} />
    </div>
  );
}
