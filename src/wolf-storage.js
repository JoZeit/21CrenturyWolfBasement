/* ============================================================
   wolf-storage.js — 持久化层
   localStorage（当日缓存）+ IndexedDB（历史日志归档）
   ============================================================ */

;(function () {
  if (!window.Wolf) window.Wolf = {}

  const STORAGE_KEY = '***'
  const DB_NAME = 'wolf-basement'
  const DB_VERSION = 2

  let db = null

  // ==================== IndexedDB 初始化 ====================
  function openDB() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db)
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = function (e) {
        const d = e.target.result
        // 每日数据归档
        if (!d.objectStoreNames.contains('dayHistory')) {
          d.createObjectStore('dayHistory', { keyPath: 'date' })
        }
        // 操作日志
        if (!d.objectStoreNames.contains('actionLog')) {
          const logStore = d.createObjectStore('actionLog', { keyPath: 'id', autoIncrement: true })
          logStore.createIndex('date', 'date', { unique: false })
          logStore.createIndex('type', 'type', { unique: false })
          logStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
        // 预设配置
        if (!d.objectStoreNames.contains('config')) {
          d.createObjectStore('config', { keyPath: 'key' })
        }
        // 三树长期数据
        if (!d.objectStoreNames.contains('trees')) {
          d.createObjectStore('trees', { keyPath: 'key' })
        }
      }
      req.onsuccess = function (e) { db = e.target.result; resolve(db) }
      req.onerror = function (e) { console.error('IndexedDB 初始化失败', e.target.error); reject(e.target.error) }
    })
  }

  // ==================== 当日数据（localStorage） ====================
  Wolf.getDayData = function () {
    var raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        var data = JSON.parse(raw)
        // 旧格式迁移
        if (data.nodes && data.nodes.length > 0 && 'type' in data.nodes[0]) {
          return Wolf.createNewDay()
        }
        if (data.date !== Wolf.todayStr()) return Wolf.createNewDay()
        // 补全缺失字段（v2→v3 迁移）
        Wolf._migrateData(data)
        return data
      } catch(e) { return Wolf.createNewDay() }
    }
    return Wolf.createNewDay()
  }

  Wolf._migrateData = function (data) {
    var s = data.stats
    var changed = false
    // 补全能力值字段
    if (s.survivalLevel === undefined) { s.survivalLevel = 1; s.survivalExp = s.exp || 0; changed = true }
    if (s.healthLevel === undefined) { s.healthLevel = 1; s.healthExp = 0; changed = true }
    if (s.focusLevel === undefined) { s.focusLevel = 1; s.focusExp = 0; changed = true }
    if (s.faithLevel === undefined) { s.faithLevel = 1; s.faithExp = 0; changed = true }
    if (!s.dailyTasks || !s.dailyTasks.length) {
      s.dailyTasks = Wolf.DEFAULT_TASKS.map(function (t) {
        return Object.assign({}, t, { completed: false, claimed: false, isCustom: false })
      })
      changed = true
    }
    if (s.hpMax === undefined || s.hpMax === 100) { s.hpMax = 50; changed = true }
    if (s.sanMax === undefined || s.sanMax === 100) { s.sanMax = 50; changed = true }
    if (s.passionMax === undefined || s.passionMax === 100) { s.passionMax = 50; changed = true }
    // 清理旧字段
    delete s.exp; delete s.expToNext; delete s.level
    if (changed) Wolf.saveDayData(data)
  }

  Wolf.createNewDay = function () {
    var data = {
      date: Wolf.todayStr(),
      nodes: Wolf.generateNodesFromPreset(Wolf.DEFAULT_PRESET),
      stats: Wolf.defaultStats(),
      preset: Wolf.DEFAULT_PRESET,
    }
    // 新的一天：刷新状态值（根据前一天睡眠完成度）
    Wolf.refreshDailyStatus(data)
    Wolf.saveDayData(data)
    return data
  }

  Wolf.saveDayData = function (data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  Wolf.defaultStats = function () {
    var abs = Wolf.defaultAbilities()
    return {
      // 状态值（每日波动）
      hp: 50, hpMax: 50,
      san: 50, sanMax: 50,
      passion: 50, passionMax: 50,
      // 能力值（累积升级）
      survivalLevel: abs.survivalLevel, survivalExp: abs.survivalExp,
      healthLevel: abs.healthLevel, healthExp: abs.healthExp,
      focusLevel: abs.focusLevel, focusExp: abs.focusExp,
      faithLevel: abs.faithLevel, faithExp: abs.faithExp,
      skills: abs.skills,
      // 任务
      dailyTasks: Wolf.DEFAULT_TASKS.map(function (t) {
        return Object.assign({}, t, { completed: false, claimed: false, isCustom: false })
      }),
    }
  }

  // ==================== 每日归档到 IndexedDB ====================
  Wolf.archiveDay = async function () {
    try {
      const data = Wolf.getDayData()
      if (!data || !data.nodes) return

      const dayRecord = {
        date: data.date,
        nodes: data.nodes,
        stats: data.stats,
        preset: data.preset,
        archivedAt: Date.now(),
      }
      await openDB()
      const tx = db.transaction('dayHistory', 'readwrite')
      tx.objectStore('dayHistory').put(dayRecord)
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(true)
        tx.onerror = () => reject(tx.error)
      })
    } catch (e) {
      console.error('归档失败', e)
    }
  }

  // ==================== 操作日志（IndexedDB） ====================
  Wolf.saveLog = async function (logEntry) {
    try {
      await openDB()
      const entry = {
        ...logEntry,
        date: logEntry.date || Wolf.todayStr(),
        timestamp: Date.now(),
      }
      const tx = db.transaction('actionLog', 'readwrite')
      tx.objectStore('actionLog').add(entry)
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(true)
        tx.onerror = () => reject(tx.error)
      })
    } catch (e) {
      console.error('保存日志失败', e)
    }
  }

  // 查询日志
  Wolf.queryLogs = async function (options = {}) {
    const { date, dateFrom, dateTo, type, limit = 100, offset = 0 } = options
    try {
      await openDB()
      const tx = db.transaction('actionLog', 'readonly')
      const store = tx.objectStore('actionLog')
      const results = []

      return new Promise((resolve, reject) => {
        let cursorReq
        if (date) {
          cursorReq = store.index('date').openCursor(IDBKeyRange.only(date))
        } else {
          cursorReq = store.index('timestamp').openCursor(null, 'prev')
        }

        let skipped = 0
        cursorReq.onsuccess = function (e) {
          const cursor = e.target.result
          if (!cursor) { resolve(results); return }

          const log = cursor.value

          // 日期范围过滤
          if (dateFrom && log.date < dateFrom) { cursor.continue(); return }
          if (dateTo && log.date > dateTo) { cursor.continue(); return }
          if (type && log.type !== type) { cursor.continue(); return }

          if (skipped < offset) { skipped++; cursor.continue(); return }
          if (results.length >= limit) { resolve(results); return }

          results.push(log)
          cursor.continue()
        }
        cursorReq.onerror = () => reject(cursorReq.error)
      })
    } catch (e) {
      console.error('查询日志失败', e)
      return []
    }
  }

  // 生成日报
  Wolf.generateDailyReport = async function (targetDate) {
    const date = targetDate || Wolf.todayStr()
    try {
      // 先看 IndexedDB 里有没有归档数据
      await openDB()
      const tx = db.transaction(['dayHistory', 'actionLog'], 'readonly')
      const dayReq = tx.objectStore('dayHistory').get(date)

      return new Promise((resolve, reject) => {
        dayReq.onsuccess = async function () {
          let dayData = dayReq.result

          // 如果是今天，用 localStorage 的数据
          if (date === Wolf.todayStr()) {
            dayData = Wolf.getDayData()
          }

          if (!dayData) { resolve(null); return }

          const nodes = dayData.nodes || []
          const stats = dayData.stats || {}
          const totalNodes = nodes.reduce((s, n) => s + n.count, 0)
          const doneNodes = nodes.reduce((s, n) => s + n.doneCount, 0)
          const fullyDone = nodes.filter(n => n.done).length
          const totalNodeTypes = nodes.length
          const focusMinutes = nodes
            .filter(n => n.actionType === 'work_study' && n.done)
            .reduce((s, n) => s + n.durationMinutes * n.doneCount, 0)

          const report = {
            date,
            stats: {
              level: stats.level || 1,
              exp: stats.exp || 0,
              hp: stats.hp || 0, hpMax: stats.hpMax || 100,
              san: stats.san || 0, sanMax: stats.sanMax || 100,
              passion: stats.passion || 0, passionMax: stats.passionMax || 100,
            },
            completion: { totalNodes, doneNodes, fullyDone, totalNodeTypes },
            focusMinutes,
            generatedAt: Date.now(),
          }
          resolve(report)
        }
        dayReq.onerror = () => resolve(null)
      })
    } catch (e) {
      console.error('生成日报失败', e)
      return null
    }
  }

  // 生成周报
  Wolf.generateWeeklyReport = async function () {
    const today = new Date()
    const reports = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      const report = await Wolf.generateDailyReport(dateStr)
      if (report) reports.push(report)
    }

    if (reports.length === 0) return null

    const summary = {
      totalFocusMinutes: reports.reduce((s, r) => s + r.focusMinutes, 0),
      totalNodesDone: reports.reduce((s, r) => s + r.completion.doneNodes, 0),
      avgCompletion: reports.reduce((s, r) => s + (r.completion.totalNodes > 0 ? r.completion.doneNodes / r.completion.totalNodes : 0), 0) / reports.length,
      currentStats: reports[reports.length - 1]?.stats,
      days: reports,
      generatedAt: Date.now(),
    }
    return summary
  }

  // 生成月报
  Wolf.generateMonthlyReport = async function () {
    const today = new Date()
    const reports = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      const report = await Wolf.generateDailyReport(dateStr)
      if (report) reports.push(report)
    }

    if (reports.length === 0) return null

    const summary = {
      totalFocusMinutes: reports.reduce((s, r) => s + r.focusMinutes, 0),
      totalNodesDone: reports.reduce((s, r) => s + r.completion.doneNodes, 0),
      activeDays: reports.length,
      avgCompletion: reports.reduce((s, r) => s + (r.completion.totalNodes > 0 ? r.completion.doneNodes / r.completion.totalNodes : 0), 0) / reports.length,
      currentStats: reports[reports.length - 1]?.stats,
      days: reports,
      generatedAt: Date.now(),
    }
    return summary
  }

  // ==================== 预设配置持久化（IndexedDB） ====================
  Wolf.savePreset = async function (preset) {
    try {
      await openDB()
      const tx = db.transaction('config', 'readwrite')
      tx.objectStore('config').put({ key: 'preset', value: preset })
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(true)
        tx.onerror = () => reject(tx.error)
      })
    } catch (e) {
      console.error('保存预设失败', e)
    }
  }

  Wolf.loadPreset = async function () {
    try {
      await openDB()
      const tx = db.transaction('config', 'readonly')
      const req = tx.objectStore('config').get('preset')
      return new Promise((resolve) => {
        req.onsuccess = () => resolve(req.result ? req.result.value : null)
        req.onerror = () => resolve(null)
      })
    } catch (e) {
      return null
    }
  }

  // ==================== 三树持久化（IndexedDB，长期数据） ====================
  Wolf.saveTrees = async function (trees) {
    try {
      await openDB()
      var tx = db.transaction('trees', 'readwrite')
      tx.objectStore('trees').put({ key: 'trees', value: trees })
      return new Promise(function (resolve, reject) {
        tx.oncomplete = function () { resolve(true) }
        tx.onerror = function () { reject(tx.error) }
      })
    } catch (e) { console.error('保存三树失败', e) }
  }

  Wolf.loadTrees = async function () {
    try {
      await openDB()
      var tx = db.transaction('trees', 'readonly')
      var req = tx.objectStore('trees').get('trees')
      return new Promise(function (resolve) {
        req.onsuccess = function () {
          resolve(req.result ? req.result.value : Wolf.defaultTrees())
        }
        req.onerror = function () { resolve(Wolf.defaultTrees()) }
      })
    } catch (e) { return Wolf.defaultTrees() }
  }

  window.Wolf = Wolf
})()
