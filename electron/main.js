import { app, BrowserWindow, dialog, ipcMain, protocol } from 'electron'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import fs from 'node:fs/promises'
import { existsSync, mkdirSync } from 'node:fs'
import Database from 'better-sqlite3'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const isDev = !app.isPackaged
const appRoot = path.resolve(__dirname, '..')
const rendererUrl = 'http://localhost:5173'

const defaultState = {
  theme: 'forest',
  selectedDate: new Date().toISOString().slice(0, 10),
  entries: {},
}

let mainWindow = null
let db = null
let storageRoot = null

function configPath() {
  return path.join(app.getPath('userData'), 'journal-config.json')
}

async function readConfig() {
  try {
    const raw = await fs.readFile(configPath(), 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

async function writeConfig(nextConfig) {
  await fs.mkdir(path.dirname(configPath()), { recursive: true })
  await fs.writeFile(configPath(), JSON.stringify(nextConfig, null, 2))
}

function ensureDatabase(rootDir) {
  mkdirSync(rootDir, { recursive: true })
  mkdirSync(path.join(rootDir, 'images'), { recursive: true })

  db = new Database(path.join(rootDir, 'journal.db'))
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS journal_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    )
  `)

  const row = db.prepare('SELECT data FROM journal_state WHERE id = 1').get()
  if (!row) {
    db.prepare('INSERT INTO journal_state (id, data) VALUES (1, ?)').run(
      JSON.stringify(defaultState),
    )
  }
}

async function initStorage() {
  const config = await readConfig()
  if (config.storageRoot && existsSync(config.storageRoot)) {
    storageRoot = config.storageRoot
    ensureDatabase(storageRoot)
  }
}

function storageInfo() {
  return {
    isConfigured: Boolean(storageRoot && db),
    storageRoot,
    databasePath: storageRoot ? path.join(storageRoot, 'journal.db') : null,
    imagesPath: storageRoot ? path.join(storageRoot, 'images') : null,
  }
}

function loadState() {
  if (!db) {
    return defaultState
  }

  const row = db.prepare('SELECT data FROM journal_state WHERE id = 1').get()
  if (!row?.data) {
    return defaultState
  }

  try {
    return JSON.parse(row.data)
  } catch {
    return defaultState
  }
}

function saveState(nextState) {
  if (!db) {
    throw new Error('Choose a journal folder before saving.')
  }

  db.prepare(`
    INSERT INTO journal_state (id, data)
    VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data
  `).run(JSON.stringify(nextState))

  return nextState
}

async function chooseStorageFolder() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose Trading Journal Folder',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Use This Folder',
  })

  if (result.canceled || result.filePaths.length === 0) {
    return storageInfo()
  }

  storageRoot = result.filePaths[0]
  ensureDatabase(storageRoot)
  await writeConfig({ storageRoot })
  return storageInfo()
}

async function saveImages({ dateKey, tradeId, timeframeId, files }) {
  if (!storageRoot) {
    throw new Error('Choose a journal folder before uploading images.')
  }

  const folder = path.join(storageRoot, 'images', dateKey, tradeId, timeframeId)
  await fs.mkdir(folder, { recursive: true })

  const results = []
  for (const file of files) {
    const extension = path.extname(file.name) || '.png'
    const filePath = path.join(folder, `${crypto.randomUUID()}${extension}`)
    const base64 = String(file.dataUrl).split(',')[1] ?? ''
    await fs.writeFile(filePath, Buffer.from(base64, 'base64'))

    results.push({
      id: crypto.randomUUID(),
      name: file.name,
      filePath,
      src: pathToFileURL(filePath).toString(),
    })
  }

  return results
}

async function deleteImage(filePath) {
  if (!filePath) {
    return { ok: true }
  }

  try {
    await fs.unlink(filePath)
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1520,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    title: 'Trading Journal',
    backgroundColor: '#081310',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL(rendererUrl)
  } else {
    mainWindow.loadFile(path.join(appRoot, 'dist', 'index.html'))
  }
}

app.whenReady().then(async () => {
  protocol.handle('journal-media', async (request) => {
    const filePath = decodeURIComponent(request.url.replace('journal-media://', ''))
    return fetch(pathToFileURL(filePath))
  })

  await initStorage()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('journal:get-storage-info', async () => storageInfo())
ipcMain.handle('journal:choose-storage-folder', async () => chooseStorageFolder())
ipcMain.handle('journal:load-state', async () => loadState())
ipcMain.handle('journal:save-state', async (_event, nextState) => saveState(nextState))
ipcMain.handle('journal:save-images', async (_event, payload) => saveImages(payload))
ipcMain.handle('journal:delete-image', async (_event, filePath) => deleteImage(filePath))
