# Trading Journal

Local-first trading journal desktop app built with Electron, React, and SQLite.

It is designed around a calendar workflow:

- click a date on the home calendar
- review or create multiple trades for that day
- break each trade down by timeframe
- upload chart screenshots
- track PnL, outcome, setup category, tags, and notes
- store everything locally on your machine or an external drive

## Features

- Calendar-first home screen
- Dedicated journal page for each selected day
- Multiple trades per date
- Multiple timeframe sections per trade
- Image uploads for chart reviews
- Predefined assets plus manual symbol entry
- Trade outcome tracking: `Win`, `Loss`, `Breakeven`
- PnL tracking
- Setup categories and free-form trade tags
- Dashboard stats for win rate, total PnL, top setup, and top tag
- Branding settings with custom brand name and logo
- Backup export and import
- Local desktop storage with SQLite and image folders
- External drive support for storage location
- Theme switching

## Storage

When running in Electron, the app saves to a folder you choose in `Settings`.

Typical folder contents:

- `journal.db`
- `images/`

Example external-drive setup:

- macOS: `/Volumes/YourDrive/Trading Journal/journal.db`
- macOS: `/Volumes/YourDrive/Trading Journal/images`
- Windows: `E:\Trading Journal\journal.db`
- Windows: `E:\Trading Journal\images`

## Tech Stack

- React
- Vite
- Electron
- better-sqlite3
- electron-builder

## Requirements

- Node.js 24+
- npm 11+

## Local Development

Install dependencies:

```bash
npm install
```

Run the desktop app in development mode:

```bash
npm run dev
```

This starts:

1. the Vite renderer
2. an Electron window
3. an Electron-native rebuild for `better-sqlite3`

## Build Checks

Run lint:

```bash
npm run lint
```

Build the renderer:

```bash
npm run build
```

## Create a Mac DMG

Build the macOS installer:

```bash
npm run dist:mac
```

The generated `.dmg` will be placed in:

```bash
release/
```

## Create a Windows EXE Installer

Run this on a Windows machine:

```bash
npm install
npm run dist:win
```

This builds a Windows installer using NSIS. The generated installer will be placed in:

```bash
release/
```

Expected output example:

```bash
release/Trading-Journal-Setup-0.0.0.exe
```

Important note:

- build Windows installers on Windows
- build macOS installers on macOS

## How Windows Users Can Install and Use It

1. Clone or download the project on a Windows computer.
2. Open PowerShell or Command Prompt in the project folder.
3. Install dependencies:

```bash
npm install
```

4. Build the Windows installer:

```bash
npm run dist:win
```

5. Open the generated `.exe` from the `release` folder.
6. Install the app like a normal Windows program.
7. Launch `Trading Journal` from the Start Menu or desktop shortcut.
8. Open `Settings`.
9. Click `Choose folder`.
10. Pick a local folder or an external drive folder for journal storage.
11. Go back to `Journal` and start logging trades.

## How To Use

1. Open the app.
2. Go to `Settings`.
3. Click `Choose folder`.
4. Pick or create a folder on your local disk or external drive.
5. Go back to `Journal`.
6. Click a date on the calendar.
7. Add trades, timeframes, notes, screenshots, PnL, and tags.

## Backups

Use the `Settings` page to:

- export a JSON backup of the full journal
- import a previous backup

## Branding

The app includes configurable branding fields:

- brand name
- small label
- home title
- home description
- optional logo upload

This makes it easy to re-use the app for different brands or users.

## Notes

- The app is local-first.
- If you use an external drive, keep it connected while using the journal.
- If the drive is disconnected, the app will not be able to save until the folder is available again.
- The current macOS build is unsigned, so macOS may show a first-open warning.
