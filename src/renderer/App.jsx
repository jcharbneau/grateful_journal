import React, { useEffect, useMemo, useRef, useState } from "react";
import journalImage from "../assets/journal-spread.jpg";

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

const systemTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const timeZoneOptions = (() => {
  if (typeof Intl.supportedValuesOf === "function") {
    return Intl.supportedValuesOf("timeZone");
  }
  return [systemTimeZone, "UTC"];
})();

const Prompt = ({ title, rows = 3, value, onChange, maxChars }) => (
  <div className="prompt-block">
    <div className="prompt-title">{title}</div>
    <textarea
      className="entry lines"
      rows={rows}
      spellCheck="false"
      value={value}
      onChange={onChange}
      maxLength={maxChars}
    />
    {typeof maxChars === "number" && (
      <div className="entry-count">
        {String((value || "").length).padStart(3, "0")}/{maxChars}
      </div>
    )}
  </div>
);

const promptSets = [
  {
    focus: "Today's Focus",
    affirmation: "An Affirmation for Today",
    grateful: "What I'm Grateful For",
    excited: "What I'm Excited About Today",
    space: "How I'll Make Space for Gratitude",
    good_things: "Good Things That Happened Today",
    positive_difference: "Things I Did to Make a Positive Difference Today",
    moods: "How I Felt Today",
    notes: "Notes",
    sleep_thought: "A Positive Thought to Carry Me to Sleep"
  },
  {
    focus: "Today's Intention",
    affirmation: "A Kind Word for Myself",
    grateful: "Gratitude Notes",
    excited: "One Thing I'm Looking Forward To",
    space: "How I'll Make Space for Calm",
    good_things: "Highlights from Today",
    positive_difference: "Ways I Showed Up Today",
    moods: "My Mood Today",
    notes: "Notes",
    sleep_thought: "A Thought to End the Day"
  },
  {
    focus: "Where I'll Place My Attention",
    affirmation: "An Encouraging Reminder",
    grateful: "Small Gratitudes",
    excited: "Energy I'm Bringing Today",
    space: "How I'll Create Space",
    good_things: "Wins from Today",
    positive_difference: "How I Made a Difference",
    moods: "Feelings I Noticed",
    notes: "Notes",
    sleep_thought: "One Last Gentle Thought"
  }
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

const formatInline = (value) => {
  return value
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
};

const renderMarkdown = (value) => {
  const safe = escapeHtml(value || "");
  const lines = safe.split("\n");
  const parts = [];
  let inList = false;

  lines.forEach((line) => {
    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch) {
      if (!inList) {
        parts.push("<ul>");
        inList = true;
      }
      parts.push(`<li>${formatInline(listMatch[1])}</li>`);
      return;
    }

    if (inList) {
      parts.push("</ul>");
      inList = false;
    }

    if (line.trim() === "") {
      parts.push("<br />");
      return;
    }

    parts.push(`<p>${formatInline(line)}</p>`);
  });

  if (inList) parts.push("</ul>");
  return parts.join("");
};

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
  const [dataDir, setDataDir] = useState("");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [settingsStatus, setSettingsStatus] = useState("Idle");
  const [searchQuery, setSearchQuery] = useState("");
  const [moodFilter, setMoodFilter] = useState("");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [focusSection, setFocusSection] = useState("");
  const eveningRef = useRef(null);
  const [promptSetIndex, setPromptSetIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
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
    window.journal.listEntries(200).then((rows) => setEntryList(rows));
  }, [drawerOpen, date]);

  useEffect(() => {
    if (!drawerOpen) return;
    window.journal.listEntryDates(month).then((dates) => setMonthDates(dates));
  }, [drawerOpen, month]);

  useEffect(() => {
    window.journal.getDataDir().then((dir) => setDataDir(dir));
  }, []);

  useEffect(() => {
    window.journal.getSettings().then((data) => {
      setSettings(data);
      if (data.default_date_view === "last_opened" && data.last_opened_date) {
        dateRef.current = data.last_opened_date;
        setDate(data.last_opened_date);
      }
      if (!data.first_run_complete) {
        setOnboardingOpen(true);
      }
    });
  }, []);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 18) {
      setFocusSection("evening");
      setTimeout(() => {
        eveningRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 350);
    } else {
      setFocusSection("morning");
    }
  }, []);

  useEffect(() => {
    if (!settings || !settings.reminder_enabled) return;
    if (!("Notification" in window)) return;

    const [hours, minutes] = settings.reminder_time.split(":").map(Number);
    const scheduleNext = () => {
      const now = new Date();
      const next = new Date();
      next.setHours(hours, minutes, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      const delay = next.getTime() - now.getTime();
      return window.setTimeout(() => {
        const todayKey = new Date().toISOString().slice(0, 10);
        if (window.__lastReminderDate !== todayKey) {
          window.__lastReminderDate = todayKey;
          new Notification("Grateful Journal", {
            body: "Take a moment for your journal today."
          });
          window.journal.trayNudge();
        }
        scheduleNext();
      }, delay);
    };

    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    let timeoutId = scheduleNext();
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [settings]);

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
      setStatus("Safe");
      if (drawerOpen) {
        window.journal.listEntries(60).then((rows) => setEntryList(rows));
        window.journal.listEntryDates(month).then((dates) => setMonthDates(dates));
      }
      setTimeout(() => setStatus("Idle"), 1400);
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

  const handleOpenDataDir = async () => {
    await window.journal.openDataDir();
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

  const promptTitles = useMemo(() => promptSets[promptSetIndex], [promptSetIndex]);

  const filteredEntries = useMemo(() => {
    if (!searchQuery && !moodFilter) return entryList;
    const query = searchQuery.trim().toLowerCase();
    return entryList.filter((row) => {
      const matchesMood = moodFilter
        ? Array.isArray(row.felt_moods) && row.felt_moods.includes(moodFilter)
        : true;
      if (!query) return matchesMood;
      const haystack = `${row.focus || ""} ${row.good_things || ""} ${row.notes || ""}`.toLowerCase();
      return matchesMood && haystack.includes(query);
    });
  }, [entryList, searchQuery, moodFilter]);

  const summary = useMemo(() => {
    if (!entry) return { words: 0, moods: 0, updatedAt: null };
    const fields = [
      entry.focus,
      entry.affirmation,
      entry.grateful,
      entry.excited,
      entry.space,
      entry.good_things,
      entry.positive_difference,
      entry.notes,
      entry.sleep_thought
    ];
    const words = fields
      .join(" ")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    return {
      words,
      moods: (entry.felt_moods || []).length,
      updatedAt: entry.updated_at || null
    };
  }, [entry]);

  const lastSavedLabel = useMemo(() => {
    if (!summary.updatedAt) return "Not saved yet";
    const savedDate = new Date(summary.updatedAt);
    if (Number.isNaN(savedDate.getTime())) return "Not saved yet";
    return savedDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }, [summary.updatedAt]);

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

  useEffect(() => {
    window.journal.updateLastOpened(date);
  }, [date]);

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
                : status === "Safe"
                ? "Your thoughts are safe"
                : status === "Error"
                ? "Retry Save"
                : "Save"}
            </button>
          </div>
          <span className="save-hint">Autosave on</span>
        </div>
      </header>

      <div className="toolbar">
        <div className="toolbar-left">
          <button className="ghost-button" type="button" onClick={() => setDrawerOpen(true)}>
            Browse Entries
          </button>
          <button className="ghost-button" type="button" onClick={() => setAboutOpen(true)}>
            About
          </button>
          <button className="ghost-button" type="button" onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={() => setPromptSetIndex(Math.floor(Math.random() * promptSets.length))}
          >
            Shuffle Prompts
          </button>
          <button className="ghost-button" type="button" onClick={() => setPreviewOpen(true)}>
            Preview
          </button>
        </div>
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

      <div className="summary-bar">
        <span>Today: {summary.words} words</span>
        <span>{summary.moods} moods</span>
        <span>Last saved: {lastSavedLabel}</span>
      </div>

      <div className="spread-frame">
        <button className="page-nav left" type="button" aria-label="Previous day" onClick={() => shiftDate(-1)} />
        <div className={`spread ${flipDirection ? `flip-${flipDirection}` : ""}`}>
        <section className={`panel morning ${focusSection === "morning" ? "focus" : ""}`}>
          <div className="panel-title">Morning Meditation</div>
          <Prompt
            title={promptTitles.focus}
            rows={3}
            value={entry.focus}
            onChange={updateField("focus")}
            maxChars={280}
          />
          <Prompt
            title={promptTitles.affirmation}
            rows={4}
            value={entry.affirmation}
            onChange={updateField("affirmation")}
            maxChars={360}
          />
          <Prompt
            title={promptTitles.grateful}
            rows={6}
            value={entry.grateful}
            onChange={updateField("grateful")}
            maxChars={520}
          />
          <Prompt
            title={promptTitles.excited}
            rows={3}
            value={entry.excited}
            onChange={updateField("excited")}
            maxChars={280}
          />
          <Prompt
            title={promptTitles.space}
            rows={3}
            value={entry.space}
            onChange={updateField("space")}
            maxChars={280}
          />
        </section>

        <section ref={eveningRef} className={`panel evening ${focusSection === "evening" ? "focus" : ""}`}>
          <div className="panel-title">Evening Reflection</div>
          <Prompt
            title={promptTitles.good_things}
            rows={4}
            value={entry.good_things}
            onChange={updateField("good_things")}
            maxChars={420}
          />
          <Prompt
            title={promptTitles.positive_difference}
            rows={4}
            value={entry.positive_difference}
            onChange={updateField("positive_difference")}
            maxChars={420}
          />

          <div className="prompt-block">
            <div className="prompt-title">{promptTitles.moods}</div>
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
            <div className="prompt-title">{promptTitles.notes}</div>
            <textarea
              className="entry lines"
              rows={6}
              spellCheck="false"
              value={entry.notes}
              onChange={updateField("notes")}
              maxLength={600}
            />
            <div className="entry-count">
              {String((entry.notes || "").length).padStart(3, "0")}/600
            </div>
          </div>

          <Prompt
            title={promptTitles.sleep_thought}
            rows={3}
            value={entry.sleep_thought}
            onChange={updateField("sleep_thought")}
            maxChars={280}
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
          <div className="entry-filters">
            <input
              type="text"
              placeholder="Search entries"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <select value={moodFilter} onChange={(event) => setMoodFilter(event.target.value)}>
              <option value="">All moods</option>
              {moods.map((mood) => (
                <option key={mood} value={mood}>
                  {mood}
                </option>
              ))}
            </select>
          </div>
          {filteredEntries.length === 0 ? (
            <div className="empty-state">
              <div>What is one small thing you are looking forward to today?</div>
              <span>Start with today's focus or a quick gratitude note.</span>
            </div>
          ) : (
            filteredEntries.map((row) => (
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
          <div className="data-location">
            <div className="data-label">Data Location</div>
            <div className="data-path">{dataDir || ""}</div>
            <button className="ghost-button" type="button" onClick={handleOpenDataDir}>
              Open Folder
            </button>
          </div>
        </div>

      </div>
      <div className={`drawer-backdrop ${drawerOpen ? "show" : ""}`} onClick={() => setDrawerOpen(false)} />

      {aboutOpen && (
        <div className="about-overlay" onClick={() => setAboutOpen(false)}>
          <div className="about-panel" onClick={(event) => event.stopPropagation()}>
            <div className="about-header">
              <div>
                <div className="about-title">About Grateful Journal</div>
                <div className="about-subtitle">It all started with a image...</div>
              </div>
              <button className="ghost-button" type="button" onClick={() => setAboutOpen(false)}>
                Close
              </button>
            </div>

            <div className="about-hero">
              <img className="about-image" src={journalImage} alt="Journal spread inspiration" />
            </div>

            <div className="about-section">
              <div className="about-section-title">The Tool</div>
              <p>
                Grateful Journal is a local-first, two-page daily ritual inspired by a physical notebook
                spread. It keeps your entries private on your machine and makes journaling feel calm and
                tactile without sacrificing search, export, or backup.
              </p>
            </div>

            <div className="about-section">
              <div className="about-section-title">Motivation</div>
              <p>
                The goal is to preserve the intention of handwritten journaling while giving you modern
                conveniences: daily prompts, autosave, and easy exports. It is designed to feel like paper,
                not software.
              </p>
            </div>

            <div className="about-section">
              <div className="about-section-title">About Jesse Charbneau</div>
              <p>
                Jesse is an engineering leader focused on data, web, and platform development with more
                than 25 years of experience. Highlights include modernizing Glassdoor's data infrastructure
                to handle 300B+ annual events and building Ubisoft's global marketing analytics platform.
                He is based in the Cincinnati metropolitan area.
              </p>
              <p className="about-links">
                <a href="https://www.jessecharbneau.com" target="_blank" rel="noreferrer">
                  jessecharbneau.com
                </a>
                <span>·</span>
                <a href="https://www.linkedin.com/in/jcharbneau" target="_blank" rel="noreferrer">
                  LinkedIn: in/jcharbneau
                </a>
                <span>·</span>
                <a href="https://github.com/jcharbneau" target="_blank" rel="noreferrer">
                  GitHub: jcharbneau
                </a>
              </p>
            </div>

            <div className="about-section">
              <div className="about-section-title">Prompts Summary</div>
              <p>
                Build a local Mac/Windows journal that mirrors the book spread, persist entries by date,
                add autosave, calendar browsing, export, page navigation, and an intentional, paper-like
                layout.
              </p>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && settings && (
        <div className="about-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="settings-panel" onClick={(event) => event.stopPropagation()}>
            <div className="about-header">
              <div>
                <div className="about-title">Settings</div>
                <div className="about-subtitle">Personalize your journal</div>
              </div>
              <button className="ghost-button" type="button" onClick={() => setSettingsOpen(false)}>
                Close
              </button>
            </div>

            <div className="settings-grid">
              <label className="settings-field">
                <span>Display Name</span>
                <input
                  type="text"
                  value={settings.name}
                  onChange={(event) => setSettings({ ...settings, name: event.target.value })}
                />
              </label>

              <label className="settings-field">
                <span>Time Zone</span>
                <select
                  value={settings.timezone}
                  onChange={(event) => setSettings({ ...settings, timezone: event.target.value })}
                >
                  {timeZoneOptions.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </label>

              <label className="settings-field">
                <span>Default Date View</span>
                <select
                  value={settings.default_date_view}
                  onChange={(event) =>
                    setSettings({ ...settings, default_date_view: event.target.value })
                  }
                >
                  <option value="today">Today</option>
                  <option value="last_opened">Last Opened</option>
                </select>
              </label>

              <label className="settings-field checkbox">
                <span>Daily Reminder</span>
                <input
                  type="checkbox"
                  checked={Boolean(settings.reminder_enabled)}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      reminder_enabled: event.target.checked ? 1 : 0
                    })
                  }
                />
              </label>

              <label className="settings-field">
                <span>Reminder Time (Local)</span>
                <input
                  type="time"
                  value={settings.reminder_time}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      reminder_time: event.target.value
                    })
                  }
                />
              </label>
            </div>

            <div className="settings-actions">
              <button
                className="save-button"
                type="button"
                onClick={async () => {
                  setSettingsStatus("Saving");
                  const saved = await window.journal.updateSettings(settings);
                  setSettings(saved);
                  setSettingsStatus("Saved");
                  setTimeout(() => setSettingsStatus("Idle"), 1200);
                }}
              >
                {settingsStatus === "Saving"
                  ? "Saving..."
                  : settingsStatus === "Saved"
                  ? "Saved"
                  : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewOpen && entry && (
        <div className="about-overlay" onClick={() => setPreviewOpen(false)}>
          <div className="settings-panel markdown-preview" onClick={(event) => event.stopPropagation()}>
            <div className="about-header">
              <div>
                <div className="about-title">Markdown Preview</div>
                <div className="about-subtitle">Basic formatting only</div>
              </div>
              <button className="ghost-button" type="button" onClick={() => setPreviewOpen(false)}>
                Close
              </button>
            </div>

            <div className="markdown-section">
              <div className="about-section-title">{promptTitles.focus}</div>
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.focus) }} />
            </div>
            <div className="markdown-section">
              <div className="about-section-title">{promptTitles.affirmation}</div>
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.affirmation) }} />
            </div>
            <div className="markdown-section">
              <div className="about-section-title">{promptTitles.grateful}</div>
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.grateful) }} />
            </div>
            <div className="markdown-section">
              <div className="about-section-title">{promptTitles.excited}</div>
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.excited) }} />
            </div>
            <div className="markdown-section">
              <div className="about-section-title">{promptTitles.space}</div>
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.space) }} />
            </div>
            <div className="markdown-section">
              <div className="about-section-title">{promptTitles.good_things}</div>
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.good_things) }} />
            </div>
            <div className="markdown-section">
              <div className="about-section-title">{promptTitles.positive_difference}</div>
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.positive_difference) }} />
            </div>
            <div className="markdown-section">
              <div className="about-section-title">{promptTitles.notes}</div>
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.notes) }} />
            </div>
            <div className="markdown-section">
              <div className="about-section-title">{promptTitles.sleep_thought}</div>
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.sleep_thought) }} />
            </div>
          </div>
        </div>
      )}

      {onboardingOpen && settings && (
        <div className="about-overlay" onClick={() => setOnboardingOpen(false)}>
          <div className="settings-panel" onClick={(event) => event.stopPropagation()}>
            <div className="about-header">
              <div>
                <div className="about-title">Welcome</div>
                <div className="about-subtitle">Your journal stays local</div>
              </div>
            </div>

            <div className="about-section">
              <div className="about-section-title">Privacy First</div>
              <p>Your entries never leave this computer. Everything is stored locally in a private folder.</p>
            </div>

            <div className="data-location">
              <div className="data-label">Data Location</div>
              <div className="data-path">{dataDir || ""}</div>
              <button className="ghost-button" type="button" onClick={handleOpenDataDir}>
                Open Folder
              </button>
            </div>

            <div className="settings-actions">
              <button
                className="save-button"
                type="button"
                onClick={async () => {
                  const saved = await window.journal.updateSettings({
                    ...settings,
                    first_run_complete: 1
                  });
                  setSettings(saved);
                  setOnboardingOpen(false);
                }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
