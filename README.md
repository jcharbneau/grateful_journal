# Grateful Journal (Local App)

Local-first gratitude journaling app inspired by a two-page book spread. Runs on macOS and Windows 11 using Electron.

## Product Idea

- Emulate the physical journal experience: two-page spread, ruled lines, focused prompts.
- Keep data local and private; no server required.
- Quick daily workflow with morning and evening reflections.

## Layout Based On the Book Spread

Left page (Morning Meditation):
- Today's Focus
- An Affirmation for Today
- What I'm Grateful For
- What I'm Excited About Today
- How I'll Make Space for Gratitude

Right page (Evening Reflection):
- Good Things That Happened Today
- Things I Did to Make a Positive Difference Today
- How I Felt Today (checkbox list)
- Notes
- A Positive Thought to Carry Me to Sleep

## Features Implemented

- Local SQLite storage with autosave per date.
- Browse entries drawer with calendar (month/year picker + week numbers) and recent list.
- JSON, CSV, and PDF export via save dialog.
- Backup and restore of the local database.
- Page navigation triangles and subtle page flip animation.

## Data Storage (Local Only)

- Implemented: SQLite via `better-sqlite3`.
- Stored in `~/.grateful-journal/journal.sqlite`.
- This file lives in each user's OS home data directory and is never committed.

## Native Module Prereqs (better-sqlite3)

- macOS: install Xcode Command Line Tools
  - `xcode-select --install`
- Windows 11: install Build Tools for Visual Studio (C++ workload)
  - https://visualstudio.microsoft.com/visual-cpp-build-tools/

These are only needed for building native deps locally. CI or packaged builds will vendor the prebuilt binaries.

## Prompts Used to Define This App

- Build a local Mac/Windows app (Electron) that mirrors the book spread.
- Scaffold the app structure and choose best local storage.
- Persist entries per date and autosave.
- Add navigation triangles, page flip animation, and align Save to the date field.
- Add calendar/list browsing and export.

## Run (Development)

```bash
npm install
npm run electron:dev
```

## Build

```bash
npm run electron:build
```
