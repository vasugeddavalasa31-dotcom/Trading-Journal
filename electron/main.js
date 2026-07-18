import { app, BrowserWindow, dialog, ipcMain, protocol } from 'electron'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import fs from 'node:fs/promises'
import { existsSync, mkdirSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const isDev = !app.isPackaged
const appRoot = path.resolve(__dirname, '..')
const rendererUrl = 'http://localhost:5173'

// Log unhandled errors so we can diagnose packaged-app issues
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})

const defaultState = {
  theme: 'forest',
  selectedDate: new Date().toISOString().slice(0, 10),
  entries: {},
}

let mainWindow = null
let storageRoot = null

// ─── Paths ────────────────────────────────────────────────────────────────────

function configPath() {
  return path.join(app.getPath('userData'), 'journal-config.json')
}

function journalDataPath() {
  return storageRoot ? path.join(storageRoot, 'journal.json') : null
}

// ─── Config (where the user chose to store data) ──────────────────────────────

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

// ─── Storage init ─────────────────────────────────────────────────────────────

function ensureStorageDir(rootDir) {
  mkdirSync(rootDir, { recursive: true })
  mkdirSync(path.join(rootDir, 'images'), { recursive: true })
}

async function initStorage() {
  const config = await readConfig()
  if (config.storageRoot && existsSync(config.storageRoot)) {
    storageRoot = config.storageRoot
    ensureStorageDir(storageRoot)
  }
}

function storageInfo() {
  return {
    isConfigured: Boolean(storageRoot),
    storageRoot,
    databasePath: storageRoot ? path.join(storageRoot, 'journal.json') : null,
    imagesPath: storageRoot ? path.join(storageRoot, 'images') : null,
  }
}

// ─── State: read / write JSON ─────────────────────────────────────────────────

async function loadState() {
  const dataPath = journalDataPath()
  if (!dataPath) return defaultState

  try {
    const raw = await fs.readFile(dataPath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return defaultState
  }
}

async function saveState(nextState) {
  const dataPath = journalDataPath()
  if (!dataPath) {
    throw new Error('Choose a journal folder before saving.')
  }

  await fs.mkdir(path.dirname(dataPath), { recursive: true })
  await fs.writeFile(dataPath, JSON.stringify(nextState, null, 2))
  return nextState
}

// ─── Folder picker ────────────────────────────────────────────────────────────

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
  ensureStorageDir(storageRoot)
  await writeConfig({ storageRoot })
  return storageInfo()
}

// ─── Images ───────────────────────────────────────────────────────────────────

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
  if (!filePath) return { ok: true }
  try {
    await fs.unlink(filePath)
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

// ─── Window ───────────────────────────────────────────────────────────────────

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

  // Surface renderer errors in main process stderr
  mainWindow.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) console.error('[renderer]', message)
  })

  // Auto-open DevTools if the page fails to load
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[did-fail-load]', code, desc, url)
    if (!isDev) mainWindow.webContents.openDevTools()
  })

  if (isDev) {
    mainWindow.loadURL(rendererUrl)
    mainWindow.webContents.openDevTools()
  } else {
    const indexPath = path.join(appRoot, 'dist', 'index.html')
    console.log('[main] loading:', indexPath)
    mainWindow.loadFile(indexPath)
  }
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

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

// ─── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('journal:get-storage-info', async () => storageInfo())
ipcMain.handle('journal:choose-storage-folder', async () => chooseStorageFolder())
ipcMain.handle('journal:load-state', async () => loadState())
ipcMain.handle('journal:save-state', async (_event, nextState) => saveState(nextState))
ipcMain.handle('journal:save-images', async (_event, payload) => saveImages(payload))
ipcMain.handle('journal:delete-image', async (_event, filePath) => deleteImage(filePath))
