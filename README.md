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

- `/Volumes/YourDrive/Trading Journal/journal.db`
- `/Volumes/YourDrive/Trading Journal/images`

## Tech Stack

- React
- Vite
- Electron
- better-sqlite3
- electron-builder

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
