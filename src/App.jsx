import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const ASSET_OPTIONS = ['NQ', 'ES', 'MNQ', 'MES', 'BTC', 'ETH', 'Gold', 'EURUSD']
const TIMEFRAME_OPTIONS = ['Day', '4H', '1H', '30M', '15M', '5M', '1M']
const SETUP_OPTIONS = ['Breakout', 'Reversal', 'Pullback', 'Range', 'News', 'Liquidity Sweep']
const OUTCOME_OPTIONS = ['Win', 'Loss', 'Breakeven']
const THEME_OPTIONS = [
  {
    id: 'forest',
    name: 'Clean Professional',
    description: 'Dark green command-center look with calm contrast.',
  },
  {
    id: 'ember',
    name: 'Trading Desk',
    description: 'Black and red high-conviction look for active review.',
  },
  {
    id: 'mist',
    name: 'Minimal Light',
    description: 'Blue-gray light workspace with softer contrast.',
  },
]

const browserStorageKey = 'trading-journal-state-v1'

const formatDateKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatMonthLabel = (date) =>
  date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

const formatReadableDate = (dateKey) =>
  new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

const formatPnl = (value) => {
  const amount = Number(value) || 0
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount)
}

const parseTagString = (value) =>
  value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

const createTimeframe = () => ({
  id: crypto.randomUUID(),
  timeframe: 'Day',
  bias: '',
  setup: '',
  entry: '',
  exit: '',
  reason: '',
  notes: '',
  images: [],
})

const createTrade = () => ({
  id: crypto.randomUUID(),
  asset: 'NQ',
  customAsset: '',
  direction: 'Long',
  summary: '',
  emotions: '',
  executionScore: '3',
  outcome: 'Win',
  pnl: '',
  setupCategory: 'Breakout',
  tags: [],
  review: '',
  timeframeNotes: [createTimeframe()],
})

const createDefaultState = () => {
  const todayKey = formatDateKey(new Date())
  return {
    theme: 'forest',
    selectedDate: todayKey,
    branding: {
      label: 'Paper to Payout',
      headline: 'Calendar-first trade replay',
      subheadline: 'Trading Journal',
      homeTitle: 'Choose a trading day to enter the journal.',
      homeDescription:
        'Your calendar is the main workspace. Click any date to open that day, review trades, upload charts, and write reasoning across timeframes.',
      logo: '',
    },
    entries: {},
  }
}

const browserStorage = {
  load() {
    try {
      const raw = localStorage.getItem(browserStorageKey)
      return raw ? JSON.parse(raw) : createDefaultState()
    } catch {
      return createDefaultState()
    }
  },
  save(nextState) {
    localStorage.setItem(browserStorageKey, JSON.stringify(nextState))
  },
}

function App() {
  const desktopApi = window.journalApi ?? null
  const [appState, setAppState] = useState(createDefaultState)
  const [activePanel, setActivePanel] = useState('journal')
  const [pageView, setPageView] = useState('home')
  const [visibleMonth, setVisibleMonth] = useState(new Date())
  const [storageInfo, setStorageInfo] = useState({
    isConfigured: false,
    storageRoot: null,
    databasePath: null,
    imagesPath: null,
  })
  const [isReady, setIsReady] = useState(false)
  const [saveStatus, setSaveStatus] = useState('Preparing journal...')
  const [saveError, setSaveError] = useState('')
  const [importStatus, setImportStatus] = useState('')
  const hasHydratedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const initialize = async () => {
      try {
        if (desktopApi) {
          const [info, savedState] = await Promise.all([
            desktopApi.getStorageInfo(),
            desktopApi.loadState(),
          ])
          if (cancelled) {
            return
          }
          setStorageInfo(info)
          setAppState({
            ...createDefaultState(),
            ...savedState,
            branding: {
              ...createDefaultState().branding,
              ...(savedState.branding ?? {}),
            },
          })
          setVisibleMonth(new Date(`${savedState.selectedDate}T00:00:00`))
          setSaveStatus(
            info.isConfigured
              ? 'Auto-saving to your selected journal folder.'
              : 'Pick a storage folder in Settings to start saving on your drive.',
          )
        } else {
          const savedState = browserStorage.load()
          if (cancelled) {
            return
          }
          setAppState({
            ...createDefaultState(),
            ...savedState,
            branding: {
              ...createDefaultState().branding,
              ...(savedState.branding ?? {}),
            },
          })
          setVisibleMonth(new Date(`${savedState.selectedDate}T00:00:00`))
          setSaveStatus('Auto-saving in browser storage.')
        }
      } catch (error) {
        setSaveError(error.message || 'Unable to load the journal.')
      } finally {
        hasHydratedRef.current = true
        setIsReady(true)
      }
    }

    initialize()

    return () => {
      cancelled = true
    }
  }, [desktopApi])

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return
    }

    const persist = async () => {
      try {
        if (desktopApi) {
          if (!storageInfo.isConfigured) {
            setSaveStatus('Pick a storage folder in Settings to enable desktop saving.')
            return
          }
          await desktopApi.saveState(appState)
          setSaveStatus('Saved to your local journal storage.')
        } else {
          browserStorage.save(appState)
          setSaveStatus('Saved in browser storage.')
        }
        setSaveError('')
      } catch (error) {
        setSaveError(error.message || 'Unable to save the journal.')
      }
    }

    persist()
  }, [appState, desktopApi, storageInfo.isConfigured])

  useEffect(() => {
    document.documentElement.dataset.theme = appState.theme
  }, [appState.theme])

  useEffect(() => {
    setVisibleMonth(new Date(`${appState.selectedDate}T00:00:00`))
  }, [appState.selectedDate])

  const branding = appState.branding ?? createDefaultState().branding
  const selectedTrades = appState.entries[appState.selectedDate] ?? []
  const savedDays = Object.values(appState.entries).filter((trades) => trades.length > 0).length
  const allTrades = useMemo(
    () =>
      Object.entries(appState.entries).flatMap(([dateKey, trades]) =>
        trades.map((trade) => ({ ...trade, dateKey })),
      ),
    [appState.entries],
  )

  const overallStats = useMemo(() => {
    const wins = allTrades.filter((trade) => trade.outcome === 'Win').length
    const losses = allTrades.filter((trade) => trade.outcome === 'Loss').length
    const breakeven = allTrades.filter((trade) => trade.outcome === 'Breakeven').length
    const totalPnL = allTrades.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0)
    const winRate = allTrades.length ? Math.round((wins / allTrades.length) * 100) : 0

    const tagCounts = {}
    const setupCounts = {}
    for (const trade of allTrades) {
      setupCounts[trade.setupCategory] = (setupCounts[trade.setupCategory] ?? 0) + 1
      for (const tag of trade.tags ?? []) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
      }
    }

    const topTag = Object.entries(tagCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'None'
    const topSetup =
      Object.entries(setupCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'None'

    return {
      totalPnL,
      wins,
      losses,
      breakeven,
      winRate,
      topTag,
      topSetup,
      totalTrades: allTrades.length,
      savedDays,
    }
  }, [allTrades, savedDays])

  const selectedDayStats = (() => {
    const dayPnL = selectedTrades.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0)
    const wins = selectedTrades.filter((trade) => trade.outcome === 'Win').length
    const losses = selectedTrades.filter((trade) => trade.outcome === 'Loss').length
    return {
      dayPnL,
      wins,
      losses,
      count: selectedTrades.length,
    }
  })()

  const dailySummaries = useMemo(() => {
    const entries = {}
    for (const [dateKey, trades] of Object.entries(appState.entries)) {
      entries[dateKey] = {
        pnl: trades.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0),
        count: trades.length,
        wins: trades.filter((trade) => trade.outcome === 'Win').length,
      }
    }
    return entries
  }, [appState.entries])

  const calendarDays = useMemo(() => {
    const year = visibleMonth.getFullYear()
    const month = visibleMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const startOffset = (firstDay.getDay() + 6) % 7
    const startDate = new Date(year, month, 1 - startOffset)

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + index)
      const dateKey = formatDateKey(date)
      return {
        date,
        dateKey,
        summary: dailySummaries[dateKey] ?? { pnl: 0, count: 0, wins: 0 },
        isCurrentMonth: date.getMonth() === month,
        isSelected: dateKey === appState.selectedDate,
        isToday: dateKey === formatDateKey(new Date()),
      }
    })
  }, [appState.selectedDate, dailySummaries, visibleMonth])

  const updateTradesForSelectedDate = (updater) => {
    setAppState((current) => {
      const currentTrades = current.entries[current.selectedDate] ?? []
      const nextTrades = updater(currentTrades)
      return {
        ...current,
        entries: {
          ...current.entries,
          [current.selectedDate]: nextTrades,
        },
      }
    })
  }

  const addTrade = () => {
    updateTradesForSelectedDate((trades) => [...trades, createTrade()])
  }

  const removeTrade = (tradeId) => {
    updateTradesForSelectedDate((trades) => trades.filter((trade) => trade.id !== tradeId))
  }

  const updateTrade = (tradeId, updater) => {
    updateTradesForSelectedDate((trades) =>
      trades.map((trade) => (trade.id === tradeId ? updater(trade) : trade)),
    )
  }

  const updateTimeframe = (tradeId, timeframeId, field, value) => {
    updateTrade(tradeId, (trade) => ({
      ...trade,
      timeframeNotes: trade.timeframeNotes.map((item) =>
        item.id === timeframeId ? { ...item, [field]: value } : item,
      ),
    }))
  }

  const addTimeframe = (tradeId) => {
    updateTrade(tradeId, (trade) => ({
      ...trade,
      timeframeNotes: [...trade.timeframeNotes, createTimeframe()],
    }))
  }

  const removeTimeframe = (tradeId, timeframeId) => {
    updateTrade(tradeId, (trade) => ({
      ...trade,
      timeframeNotes:
        trade.timeframeNotes.length === 1
          ? trade.timeframeNotes
          : trade.timeframeNotes.filter((item) => item.id !== timeframeId),
    }))
  }

  const openDate = (dateKey) => {
    setAppState((current) => ({ ...current, selectedDate: dateKey }))
    setPageView('detail')
  }

  const fileToDataUrl = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.readAsDataURL(file)
    })

  const handleImagesSelected = async (tradeId, timeframeId, files) => {
    try {
      const preparedFiles = await Promise.all(
        Array.from(files).map(async (file) => ({
          name: file.name,
          dataUrl: await fileToDataUrl(file),
        })),
      )

      const images = desktopApi
        ? await desktopApi.saveImages({
            dateKey: appState.selectedDate,
            tradeId,
            timeframeId,
            files: preparedFiles,
          })
        : preparedFiles.map((file) => ({
            id: crypto.randomUUID(),
            name: file.name,
            src: file.dataUrl,
            filePath: null,
          }))

      updateTrade(tradeId, (trade) => ({
        ...trade,
        timeframeNotes: trade.timeframeNotes.map((item) =>
          item.id === timeframeId
            ? { ...item, images: [...item.images, ...images] }
            : item,
        ),
      }))
      setSaveError('')
    } catch (error) {
      setSaveError(error.message || 'Unable to save uploaded images.')
    }
  }

  const removeImage = async (tradeId, timeframeId, image) => {
    try {
      if (desktopApi && image.filePath) {
        await desktopApi.deleteImage(image.filePath)
      }
      updateTrade(tradeId, (trade) => ({
        ...trade,
        timeframeNotes: trade.timeframeNotes.map((item) =>
          item.id === timeframeId
            ? {
                ...item,
                images: item.images.filter((currentImage) => currentImage.id !== image.id),
              }
            : item,
        ),
      }))
    } catch (error) {
      setSaveError(error.message || 'Unable to remove image.')
    }
  }

  const chooseStorageFolder = async () => {
    if (!desktopApi) {
      return
    }

    try {
      const nextInfo = await desktopApi.chooseStorageFolder()
      setStorageInfo(nextInfo)
      setSaveStatus('Journal folder connected. New changes will save there automatically.')
      setSaveError('')
      if (nextInfo.isConfigured) {
        await desktopApi.saveState(appState)
      }
    } catch (error) {
      setSaveError(error.message || 'Unable to choose a storage folder.')
    }
  }

  const exportBackup = () => {
    const fileName = `${branding.label.replace(/\s+/g, '-').toLowerCase()}-backup-${formatDateKey(new Date())}.json`
    const blob = new Blob([JSON.stringify(appState, null, 2)], {
      type: 'application/json',
    })
    const href = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = fileName
    anchor.click()
    URL.revokeObjectURL(href)
  }

  const importBackup = async (file) => {
    if (!file) {
      return
    }

    try {
      const raw = await file.text()
      const parsed = JSON.parse(raw)
      setAppState({
        ...createDefaultState(),
        ...parsed,
        branding: {
          ...createDefaultState().branding,
          ...(parsed.branding ?? {}),
        },
      })
      setImportStatus(`Imported backup from ${file.name}.`)
    } catch {
      setImportStatus('Unable to import that backup file.')
    }
  }

  const updateBranding = (field, value) => {
    setAppState((current) => ({
      ...current,
      branding: {
        ...branding,
        [field]: value,
      },
    }))
  }

  if (!isReady) {
    return <div className="loading-screen">Preparing your trading journal...</div>
  }

  return (
    <div className="app-shell single-column">
      <header className="global-topbar">
        <div className="topbar-brand">
          <p className="eyebrow">{branding.subheadline}</p>
        </div>

        <div className="topbar-center">
          <span className="brand-badge">
            {branding.logo ? <img src={branding.logo} alt={branding.label} className="brand-logo" /> : null}
            {branding.label}
          </span>
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className={activePanel === 'journal' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActivePanel('journal')}
          >
            Journal
          </button>
          <button
            type="button"
            className={activePanel === 'settings' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActivePanel('settings')}
          >
            Settings
          </button>
        </div>
      </header>

      {activePanel === 'journal' ? (
        <main className={`view-shell ${pageView === 'detail' ? 'detail-open' : 'home-open'}`}>
          <section className="view-panel home-view">
            <div className="hero-strip">
              <div>
                <p className="eyebrow">Journal home</p>
                <h2>{branding.homeTitle}</h2>
                <p className="hero-copy">{branding.homeDescription}</p>
              </div>

              <div className="hero-stats">
                <div className="stat-pill">
                  <span>Saved days</span>
                  <strong>{overallStats.savedDays}</strong>
                </div>
                <div className="stat-pill">
                  <span>Total trades</span>
                  <strong>{overallStats.totalTrades}</strong>
                </div>
                <div className="stat-pill">
                  <span>Net PnL</span>
                  <strong className={overallStats.totalPnL >= 0 ? 'gain' : 'loss'}>
                    {formatPnl(overallStats.totalPnL)}
                  </strong>
                </div>
                <div className="stat-pill">
                  <span>Win rate</span>
                  <strong>{overallStats.winRate}%</strong>
                </div>
              </div>
            </div>

            <div className="dashboard-strip">
              <div className="spotlight-card">
                <p className="section-label">Performance</p>
                <h3>
                  {overallStats.wins}W / {overallStats.losses}L / {overallStats.breakeven}BE
                </h3>
                <p>Track the global outcome mix across your full journal.</p>
              </div>
              <div className="spotlight-card">
                <p className="section-label">Most used setup</p>
                <h3>{overallStats.topSetup}</h3>
                <p>Most repeated setup category across all recorded trades.</p>
              </div>
              <div className="spotlight-card">
                <p className="section-label">Top tag</p>
                <h3>{overallStats.topTag}</h3>
                <p>Most frequent tag across your recent reviewed trades.</p>
              </div>
            </div>

            <div className="calendar-stage">
              <div className="calendar-stage-header">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() =>
                    setVisibleMonth(
                      new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1),
                    )
                  }
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <div className="calendar-title">
                  <p className="section-label">Main calendar</p>
                  <h2>{formatMonthLabel(visibleMonth)}</h2>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() =>
                    setVisibleMonth(
                      new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1),
                    )
                  }
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>

              <div className="weekdays home-weekdays">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className="calendar-grid home-calendar-grid">
                {calendarDays.map((day) => (
                  <button
                    key={day.dateKey}
                    type="button"
                    className={[
                      'day-tile',
                      'day-tile-large',
                      day.isCurrentMonth ? '' : 'muted',
                      day.isSelected ? 'selected' : '',
                      day.isToday ? 'today' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => openDate(day.dateKey)}
                  >
                    <span className="day-number">{day.date.getDate()}</span>
                    <span className="day-meta">
                      {day.summary.count > 0
                        ? `${day.summary.count} trade${day.summary.count > 1 ? 's' : ''}`
                        : 'Open day'}
                    </span>
                    <span className={day.summary.pnl >= 0 ? 'day-pnl gain' : 'day-pnl loss'}>
                      {day.summary.count > 0 ? formatPnl(day.summary.pnl) : 'No PnL'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="view-panel detail-view">
            <div className="detail-header">
              <div className="detail-heading">
                <button type="button" className="ghost-button" onClick={() => setPageView('home')}>
                  Back
                </button>
                <div>
                  <p className="eyebrow">Selected day</p>
                  <h2>{formatReadableDate(appState.selectedDate)}</h2>
                </div>
              </div>

              <div className="detail-actions">
                <label className="inline-date-picker">
                  <span>Jump to date</span>
                  <input
                    type="date"
                    value={appState.selectedDate}
                    onChange={(event) =>
                      setAppState((current) => ({
                        ...current,
                        selectedDate: event.target.value,
                      }))
                    }
                  />
                </label>
                <button type="button" className="primary-button" onClick={addTrade}>
                  Add trade
                </button>
              </div>
            </div>

            <div className="detail-grid">
              <div className="entry-panel">
                <div className="panel-heading">
                  <div>
                    <p className="section-label">Daily journal</p>
                    <h3>Trades for {formatReadableDate(appState.selectedDate)}</h3>
                  </div>
                </div>

                {selectedTrades.length === 0 ? (
                  <div className="empty-state">
                    <h3>No trades saved for this day yet.</h3>
                    <p>
                      Start with one trade, then add timeframe reasoning, PnL, tags, and chart images
                      as needed.
                    </p>
                  </div>
                ) : (
                  <div className="trade-list">
                    {selectedTrades.map((trade, index) => (
                      <article key={trade.id} className="trade-card">
                        <div className="trade-card-header">
                          <div>
                            <p className="section-label">Trade {index + 1}</p>
                            <h3>{trade.customAsset || trade.asset}</h3>
                          </div>
                          <button
                            type="button"
                            className="ghost-button danger"
                            onClick={() => removeTrade(trade.id)}
                          >
                            Remove trade
                          </button>
                        </div>

                        <div className="form-grid four-up">
                          <label>
                            <span>Predefined asset</span>
                            <select
                              value={trade.asset}
                              onChange={(event) =>
                                updateTrade(trade.id, (currentTrade) => ({
                                  ...currentTrade,
                                  asset: event.target.value,
                                }))
                              }
                            >
                              {ASSET_OPTIONS.map((asset) => (
                                <option key={asset} value={asset}>
                                  {asset}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label>
                            <span>Manual asset</span>
                            <input
                              type="text"
                              placeholder="Type custom symbol"
                              value={trade.customAsset}
                              onChange={(event) =>
                                updateTrade(trade.id, (currentTrade) => ({
                                  ...currentTrade,
                                  customAsset: event.target.value,
                                }))
                              }
                            />
                          </label>

                          <label>
                            <span>Direction</span>
                            <select
                              value={trade.direction}
                              onChange={(event) =>
                                updateTrade(trade.id, (currentTrade) => ({
                                  ...currentTrade,
                                  direction: event.target.value,
                                }))
                              }
                            >
                              <option value="Long">Long</option>
                              <option value="Short">Short</option>
                              <option value="Both">Both</option>
                            </select>
                          </label>

                          <label>
                            <span>Setup category</span>
                            <select
                              value={trade.setupCategory}
                              onChange={(event) =>
                                updateTrade(trade.id, (currentTrade) => ({
                                  ...currentTrade,
                                  setupCategory: event.target.value,
                                }))
                              }
                            >
                              {SETUP_OPTIONS.map((setup) => (
                                <option key={setup} value={setup}>
                                  {setup}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <div className="form-grid four-up">
                          <label>
                            <span>Outcome</span>
                            <select
                              value={trade.outcome}
                              onChange={(event) =>
                                updateTrade(trade.id, (currentTrade) => ({
                                  ...currentTrade,
                                  outcome: event.target.value,
                                }))
                              }
                            >
                              {OUTCOME_OPTIONS.map((outcome) => (
                                <option key={outcome} value={outcome}>
                                  {outcome}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label>
                            <span>PnL</span>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="125.50"
                              value={trade.pnl}
                              onChange={(event) =>
                                updateTrade(trade.id, (currentTrade) => ({
                                  ...currentTrade,
                                  pnl: event.target.value,
                                }))
                              }
                            />
                          </label>

                          <label>
                            <span>Tags</span>
                            <input
                              type="text"
                              placeholder="A+, opening range, discipline"
                              value={(trade.tags ?? []).join(', ')}
                              onChange={(event) =>
                                updateTrade(trade.id, (currentTrade) => ({
                                  ...currentTrade,
                                  tags: parseTagString(event.target.value),
                                }))
                              }
                            />
                          </label>

                          <label>
                            <span>Execution score</span>
                            <input
                              type="range"
                              min="1"
                              max="5"
                              value={trade.executionScore}
                              onChange={(event) =>
                                updateTrade(trade.id, (currentTrade) => ({
                                  ...currentTrade,
                                  executionScore: event.target.value,
                                }))
                              }
                            />
                          </label>
                        </div>

                        <div className="form-grid">
                          <label>
                            <span>Trade summary</span>
                            <textarea
                              rows="3"
                              placeholder="What was the main idea for this trade?"
                              value={trade.summary}
                              onChange={(event) =>
                                updateTrade(trade.id, (currentTrade) => ({
                                  ...currentTrade,
                                  summary: event.target.value,
                                }))
                              }
                            />
                          </label>

                          <label>
                            <span>Execution notes</span>
                            <textarea
                              rows="3"
                              placeholder="How did you feel and how well did you execute?"
                              value={trade.emotions}
                              onChange={(event) =>
                                updateTrade(trade.id, (currentTrade) => ({
                                  ...currentTrade,
                                  emotions: event.target.value,
                                }))
                              }
                            />
                          </label>
                        </div>

                        <label>
                          <span>Post-trade review</span>
                          <textarea
                            rows="3"
                            placeholder="What worked, what failed, and what to repeat next time?"
                            value={trade.review}
                            onChange={(event) =>
                              updateTrade(trade.id, (currentTrade) => ({
                                ...currentTrade,
                                review: event.target.value,
                              }))
                            }
                          />
                        </label>

                        <div className="timeframe-section">
                          <div className="panel-heading compact">
                            <div>
                              <p className="section-label">Timeframes</p>
                              <h4>Break down the same trade across your chart views.</h4>
                            </div>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => addTimeframe(trade.id)}
                            >
                              Add timeframe
                            </button>
                          </div>

                          <div className="timeframe-list">
                            {trade.timeframeNotes.map((item, timeframeIndex) => (
                              <section key={item.id} className="timeframe-card">
                                <div className="trade-card-header">
                                  <div>
                                    <p className="section-label">Frame {timeframeIndex + 1}</p>
                                    <h4>{item.timeframe}</h4>
                                  </div>
                                  <button
                                    type="button"
                                    className="ghost-button"
                                    onClick={() => removeTimeframe(trade.id, item.id)}
                                    disabled={trade.timeframeNotes.length === 1}
                                  >
                                    Remove
                                  </button>
                                </div>

                                <div className="form-grid three-up">
                                  <label>
                                    <span>Timeframe</span>
                                    <select
                                      value={item.timeframe}
                                      onChange={(event) =>
                                        updateTimeframe(
                                          trade.id,
                                          item.id,
                                          'timeframe',
                                          event.target.value,
                                        )
                                      }
                                    >
                                      {TIMEFRAME_OPTIONS.map((timeframe) => (
                                        <option key={timeframe} value={timeframe}>
                                          {timeframe}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  <label>
                                    <span>Bias</span>
                                    <input
                                      type="text"
                                      placeholder="Bullish, bearish, neutral"
                                      value={item.bias}
                                      onChange={(event) =>
                                        updateTimeframe(trade.id, item.id, 'bias', event.target.value)
                                      }
                                    />
                                  </label>

                                  <label>
                                    <span>Setup</span>
                                    <input
                                      type="text"
                                      placeholder="Liquidity sweep, breakout, pullback"
                                      value={item.setup}
                                      onChange={(event) =>
                                        updateTimeframe(trade.id, item.id, 'setup', event.target.value)
                                      }
                                    />
                                  </label>
                                </div>

                                <div className="form-grid three-up">
                                  <label>
                                    <span>Entry</span>
                                    <input
                                      type="text"
                                      placeholder="Entry level"
                                      value={item.entry}
                                      onChange={(event) =>
                                        updateTimeframe(trade.id, item.id, 'entry', event.target.value)
                                      }
                                    />
                                  </label>

                                  <label>
                                    <span>Exit</span>
                                    <input
                                      type="text"
                                      placeholder="Exit level"
                                      value={item.exit}
                                      onChange={(event) =>
                                        updateTimeframe(trade.id, item.id, 'exit', event.target.value)
                                      }
                                    />
                                  </label>

                                  <label>
                                    <span>Reason</span>
                                    <input
                                      type="text"
                                      placeholder="Why this timeframe mattered"
                                      value={item.reason}
                                      onChange={(event) =>
                                        updateTimeframe(trade.id, item.id, 'reason', event.target.value)
                                      }
                                    />
                                  </label>
                                </div>

                                <label>
                                  <span>Notes</span>
                                  <textarea
                                    rows="4"
                                    placeholder="Write your reasoning and what the chart showed here."
                                    value={item.notes}
                                    onChange={(event) =>
                                      updateTimeframe(trade.id, item.id, 'notes', event.target.value)
                                    }
                                  />
                                </label>

                                <div className="image-upload-block">
                                  <label className="upload-dropzone">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      multiple
                                      onChange={(event) => {
                                        if (event.target.files?.length) {
                                          handleImagesSelected(trade.id, item.id, event.target.files)
                                        }
                                        event.target.value = ''
                                      }}
                                    />
                                    <span>Upload timeframe images</span>
                                    <small>PNG, JPG, or screenshot snippets of your setup.</small>
                                  </label>

                                  {item.images.length > 0 ? (
                                    <div className="image-grid">
                                      {item.images.map((image) => (
                                        <figure key={image.id} className="image-card">
                                          <img src={image.src} alt={image.name} />
                                          <figcaption>
                                            <span>{image.name}</span>
                                            <button
                                              type="button"
                                              className="ghost-button danger"
                                              onClick={() => removeImage(trade.id, item.id, image)}
                                            >
                                              Delete
                                            </button>
                                          </figcaption>
                                        </figure>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              </section>
                            ))}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <aside className="insight-panel">
                <div className="spotlight-card">
                  <p className="section-label">Current day</p>
                  <h3>{selectedDayStats.count} trades on this date</h3>
                  <p className={selectedDayStats.dayPnL >= 0 ? 'gain' : 'loss'}>
                    Net PnL: {formatPnl(selectedDayStats.dayPnL)}
                  </p>
                </div>

                <div className="spotlight-card">
                  <p className="section-label">Outcome split</p>
                  <h3>
                    {selectedDayStats.wins} wins / {selectedDayStats.losses} losses
                  </h3>
                  <p>Review daily distribution before moving to the next session.</p>
                </div>

                <div className="spotlight-card">
                  <p className="section-label">Save status</p>
                  <h3>{saveStatus}</h3>
                  <p>
                    {desktopApi
                      ? storageInfo.isConfigured
                        ? storageInfo.storageRoot
                        : 'No journal folder selected yet.'
                      : 'This session is using browser storage fallback.'}
                  </p>
                  {saveError ? <p className="error-text">{saveError}</p> : null}
                </div>
              </aside>
            </div>
          </section>
        </main>
      ) : (
        <main className="settings-layout">
          <section className="settings-panel">
            <div className="panel-heading">
              <div>
                <p className="section-label">Appearance</p>
                <h3>Theme settings</h3>
              </div>
            </div>

            <div className="theme-grid">
              {THEME_OPTIONS.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  className={theme.id === appState.theme ? 'theme-card selected' : 'theme-card'}
                  onClick={() =>
                    setAppState((current) => ({
                      ...current,
                      theme: theme.id,
                    }))
                  }
                >
                  <span className={`theme-preview ${theme.id}`}></span>
                  <strong>{theme.name}</strong>
                  <p>{theme.description}</p>
                </button>
              ))}
            </div>

            <div className="storage-panel">
              <div className="panel-heading compact">
                <div>
                  <p className="section-label">Branding</p>
                  <h3>Customize app identity</h3>
                </div>
              </div>

              <div className="form-grid two-up">
                <label>
                  <span>Brand name</span>
                  <input
                    type="text"
                    value={branding.label}
                    placeholder="Paper to Payout"
                    onChange={(event) => updateBranding('label', event.target.value)}
                  />
                </label>

                <label>
                  <span>Small label</span>
                  <input
                    type="text"
                    value={branding.subheadline}
                    placeholder="Trading Journal"
                    onChange={(event) => updateBranding('subheadline', event.target.value)}
                  />
                </label>
              </div>

              <div className="form-grid two-up">
                <label>
                  <span>Home title</span>
                  <input
                    type="text"
                    value={branding.homeTitle}
                    placeholder="Choose a trading day to enter the journal."
                    onChange={(event) => updateBranding('homeTitle', event.target.value)}
                  />
                </label>

                <label className="upload-brand">
                  <span>Brand logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        const dataUrl = await fileToDataUrl(file)
                        updateBranding('logo', dataUrl)
                      }
                      event.target.value = ''
                    }}
                  />
                  <small>Upload a logo to show inside the centered brand pill.</small>
                </label>
              </div>

              <label>
                <span>Home description</span>
                <textarea
                  rows="4"
                  value={branding.homeDescription}
                  placeholder="Describe the journal experience."
                  onChange={(event) => updateBranding('homeDescription', event.target.value)}
                />
              </label>

              {branding.logo ? (
                <div className="logo-preview-row">
                  <img src={branding.logo} alt={branding.label} className="logo-preview" />
                  <button
                    type="button"
                    className="ghost-button danger"
                    onClick={() => updateBranding('logo', '')}
                  >
                    Remove logo
                  </button>
                </div>
              ) : null}
            </div>

            <div className="storage-panel">
              <div className="panel-heading compact">
                <div>
                  <p className="section-label">Backups</p>
                  <h3>Export and import your journal</h3>
                </div>
              </div>

              <div className="backup-actions">
                <button type="button" className="primary-button" onClick={exportBackup}>
                  Export backup
                </button>
                <label className="secondary-button file-button">
                  Import backup
                  <input
                    type="file"
                    accept="application/json"
                    onChange={(event) => importBackup(event.target.files?.[0])}
                  />
                </label>
              </div>
              {importStatus ? <p className="settings-note">{importStatus}</p> : null}
            </div>

            <div className="storage-panel">
              <div className="panel-heading compact">
                <div>
                  <p className="section-label">Storage location</p>
                  <h3>Where your journal files live</h3>
                </div>
                {desktopApi ? (
                  <button type="button" className="primary-button" onClick={chooseStorageFolder}>
                    Choose folder
                  </button>
                ) : null}
              </div>

              <div className="storage-details">
                <p>
                  <strong>Mode:</strong>{' '}
                  {desktopApi ? 'Electron desktop storage' : 'Browser fallback storage'}
                </p>
                <p>
                  <strong>Folder:</strong> {storageInfo.storageRoot || 'Not selected'}
                </p>
                <p>
                  <strong>Database:</strong> {storageInfo.databasePath || 'Not available'}
                </p>
                <p>
                  <strong>Images:</strong> {storageInfo.imagesPath || 'Not available'}
                </p>
                {saveError ? <p className="error-text">{saveError}</p> : null}
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  )
}

export default App
