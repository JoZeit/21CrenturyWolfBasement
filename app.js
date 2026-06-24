/* ========================================
   21世纪荒原狼生存指南 - v2 节点系统重构
   ======================================== */

// ============================================================
//  一、数据模型：时长等级 + 行动类型
// ============================================================

const DURATION_GRADES = {
  A: { label: 'A', minutes: 45, name: '45分钟', cssClass: 'grade-a' },
  B: { label: 'B', minutes: 30, name: '30分钟', cssClass: 'grade-b' },
  C: { label: 'C', minutes: 25, name: '25分钟', cssClass: 'grade-c' },
  D: { label: 'D', minutes: 20, name: '20分钟', cssClass: 'grade-d' },
  E: { label: 'E', minutes: 15, name: '15分钟', cssClass: 'grade-e' },
  F: { label: 'F', minutes: 10, name: '10分钟', cssClass: 'grade-f' },
}

const ACTION_TYPES = {
  big_sleep:   { id: 'big_sleep',   name: '大睡眠',   icon: '😴', defaultGrade: 'A', maxPerDay: 10, room: null,
                 desc: '恢复体力与San值的主要途径', settlement: { exp: 1, sanDelta: 3, passionDelta: 1, hpDelta: 2 } },
  small_sleep: { id: 'small_sleep', name: '小睡眠',   icon: '💤', defaultGrade: 'B', maxPerDay: 1,  room: null,
                 desc: '午间小憩', settlement: { exp: 3, sanDelta: 10, passionDelta: 3, hpDelta: 8 } },
  big_eat:     { id: 'big_eat',     name: '大吃饭',   icon: '🍽️', defaultGrade: 'A', maxPerDay: 2,  room: null,
                 subtypes: ['午饭','晚饭','早饭'], desc: '正餐时间', settlement: { exp: 3, sanDelta: 5, passionDelta: 5, hpDelta: 10 } },
  small_eat:   { id: 'small_eat',   name: '小吃饭',   icon: '🥐', defaultGrade: 'D', maxPerDay: 1,  room: null,
                 subtypes: ['早饭','午饭','晚饭'], desc: '轻餐', settlement: { exp: 2, sanDelta: 3, passionDelta: 3, hpDelta: 5 } },
  work_study:  { id: 'work_study',  name: '工作学习', icon: '📚', defaultGrade: 'A', maxPerDay: 10, room: null,
                 subtypes: ['深度学习','浅层学习','自主实践','体育锻炼'],
                 desc: '核心成长节点' },
  walk:        { id: 'walk',        name: '走路',     icon: '🚶', defaultGrade: 'C', maxPerDay: 4,  room: null,
                 subtypes: ['饭后百步走','散步'], desc: '轻度活动', settlement: { exp: 2, sanDelta: 3, passionDelta: 1, hpDelta: 4 } },
  chores:      { id: 'chores',      name: '家务',     icon: '🧹', defaultGrade: 'A', maxPerDay: 4,  room: null,
                 subtypes: ['起床','洗澡','娱乐','整理'], desc: '日常事务' },
  short_break: { id: 'short_break', name: '小休',     icon: '☕', defaultGrade: 'F', maxPerDay: 6,  room: null,
                 requiresAfter: 'work_study', desc: '学习间小憩', settlement: { exp: 1, sanDelta: 3, passionDelta: 2, hpDelta: 1 } },
  long_break:  { id: 'long_break',  name: '大休',     icon: '🛋️', defaultGrade: 'E', maxPerDay: 2,  room: null,
                 requiresAfter: 'work_study', desc: '较长的休息', settlement: { exp: 1, sanDelta: 5, passionDelta: 3, hpDelta: 2 } },
  free:        { id: 'free',        name: '自由',     icon: '🎯', defaultGrade: 'E', maxPerDay: 2,  room: null,
                 desc: '灵活安排', settlement: { exp: 1, sanDelta: 2, passionDelta: 3, hpDelta: 1 } },
}

// 默认预设时间表
const DEFAULT_PRESET = [
  { start: '23:00', action: 'big_sleep',   count: 10 },
  { start: '06:30', action: 'chores',      subtype: '起床' },
  { start: '07:15', action: 'small_eat',   subtype: '早饭' },
  { start: '07:35', action: 'walk',        subtype: '饭后百步走' },
  { start: '08:00', action: 'work_study',  subtype: '深度学习' },
  { start: '08:45', action: 'short_break' },
  { start: '08:55', action: 'work_study',  subtype: '深度学习' },
  { start: '09:40', action: 'long_break' },
  { start: '09:55', action: 'work_study',  subtype: '深度学习' },
  { start: '10:40', action: 'short_break' },
  { start: '10:50', action: 'work_study',  subtype: '深度学习' },
  { start: '11:35', action: 'big_eat',     subtype: '午饭' },
  { start: '12:20', action: 'walk',        subtype: '饭后百步走' },
  { start: '12:45', action: 'small_sleep' },
  { start: '13:15', action: 'free' },
  { start: '13:30', action: 'work_study',  subtype: '深度学习' },
  { start: '14:15', action: 'short_break' },
  { start: '14:25', action: 'work_study',  subtype: '深度学习' },
  { start: '15:10', action: 'long_break' },
  { start: '15:25', action: 'work_study',  subtype: '深度学习' },
  { start: '16:10', action: 'short_break' },
  { start: '16:20', action: 'work_study',  subtype: '深度学习' },
  { start: '17:05', action: 'big_eat',     subtype: '晚饭' },
  { start: '17:50', action: 'walk',        subtype: '饭后百步走' },
  { start: '18:15', action: 'free' },
  { start: '18:30', action: 'work_study',  subtype: '深度学习' },
  { start: '19:15', action: 'short_break' },
  { start: '19:25', action: 'work_study',  subtype: '深度学习' },
  { start: '20:10', action: 'walk',        subtype: '散步' },
  { start: '20:35', action: 'chores',      subtype: '洗澡' },
  { start: '21:20', action: 'chores',      subtype: '娱乐' },
  { start: '22:15', action: 'chores',      subtype: '整理' },
]

// ============================================================
//  二、名言 & 工具函数
// ============================================================

const QUOTES = [
  '新的一天，荒原狼也要好好活下去。',
  '坚持本身就是意义。',
  '今天的你比昨天更强。',
  '看板娘在看着你哦～',
  '每一个节点都是通向更好的自己。',
  '累了就休息，但别放弃。',
  '你的努力，看板娘都知道。',
  '一步一步，就能走出荒原。',
  '勿忘初心，方得始终。',
  '哪怕是微小的进步，也是前进。',
]

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function todayDisplay() {
  const d = new Date()
  const wd = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六']
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ${wd[d.getDay()]}`
}

function randomQuote() { return QUOTES[Math.floor(Math.random() * QUOTES.length)] }

function timeStrToMinutes(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTimeStr(m) {
  const h = Math.floor(m / 60) % 24
  const mm = m % 60
  return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`
}

// ============================================================
//  三、预设 → 每日节点生成
// ============================================================

function generateNodesFromPreset(preset) {
  const nodes = []
  let idCounter = 0

  // 找到"大睡眠"条目（跨天），它从昨天的23:00开始
  // 计算它的 endTime 以便后续节点知道起始时间
  let lastEndMinutes = null

  for (let i = 0; i < preset.length; i++) {
    const entry = preset[i]
    const action = ACTION_TYPES[entry.action]
    if (!action) continue

    const gradeKey = entry.grade || action.defaultGrade
    const grade = DURATION_GRADES[gradeKey]
    if (!grade) continue

    const count = entry.count || 1
    const startMinutes = timeStrToMinutes(entry.start)

    // 如果有上一个节点的结束时间且与当前开始时间不同，存在间隙
    // first node: 大睡眠从前一天23:00开始，所以 lastEndMinutes 就是 startMinutes+count*grade.minutes
    if (lastEndMinutes !== null && lastEndMinutes !== startMinutes) {
      // 时间间隙（理论上预设设计好不会有，但有的话就跳过）
    }

    const totalDuration = count * grade.minutes
    const endMinutes = startMinutes + totalDuration

    nodes.push({
      id: `node-${idCounter++}`,
      startTime: entry.start,
      endTime: minutesToTimeStr(endMinutes),
      actionType: entry.action,
      subtype: entry.subtype || null,
      durationGrade: gradeKey,
      durationMinutes: grade.minutes,
      count: count,
      doneCount: 0,
      done: false,
      log: null,
    })

    lastEndMinutes = endMinutes
  }

  return nodes
}

// ============================================================
//  四、数据持久化
// ============================================================

const STORAGE_KEY = '***'

function getDayData() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      const data = JSON.parse(raw)
      // 检测老格式（有旧的 nodes 结构）
      if (data.nodes && data.nodes.length > 0 && 'type' in data.nodes[0]) {
        return createNewDay() // 迁移到新格式
      }
      if (data.date !== todayStr()) return createNewDay()
      return data
    } catch(e) { return createNewDay() }
  }
  return createNewDay()
}

function createNewDay() {
  const data = {
    date: todayStr(),
    nodes: generateNodesFromPreset(DEFAULT_PRESET),
    stats: defaultStats(),
    preset: DEFAULT_PRESET, // 保存预设以便后续编辑
  }
  saveDayData(data)
  return data
}

function saveDayData(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }

function defaultStats() {
  return {
    hp: 100, hpMax: 100,
    san: 100, sanMax: 100,
    passion: 80, passionMax: 100,
    level: 1, exp: 0, expToNext: 100,
  }
}

// ============================================================
//  五、全局状态
// ============================================================

const state = {
  view: 'bedroom',
  currentNodeId: null,
  studyPhase: null,       // pre | timing | post | settlement
  timer: { total: 25*60, remaining: 25*60, intervalId: null },
  studyLog: { field:'', hasMaterial:'yes', materialDetail:'', preMessage:'', startTime:null, endTime:null, archive:'', knowledge:'', postMessage:'' },
  tempLog: { practiceType:'', practiceNote:'', exerciseType:'', exerciseDuration:'', expType:'', expTitle:'', expNote:'' },
  _lastSettlement: null,
  _currentQuote: randomQuote(), // 缓存名言，同次 render 不变
}

// ============================================================
//  六、数值系统
// ============================================================

function calcFocusSettlement(log, durationMinutes) {
  const hasMat = log.hasMaterial === 'yes'
  const hasArchive = log.archive.trim().length > 0
  const knowledgeCount = log.knowledge.trim().length > 0 ? Math.ceil(log.knowledge.trim().split('\n').filter(l=>l.trim()).length) : 0
  let exp = 10, sanDelta = 0, passionDelta = 0, hpDelta = 0
  if (hasMat) { exp += 5; sanDelta = -3 } else { exp -= 3; sanDelta = -6 }
  if (hasArchive) { exp += 5; passionDelta = 3 } else { passionDelta = -2 }
  exp += knowledgeCount * 3
  exp += Math.floor(durationMinutes / 10)
  if (hasArchive && hasMat) passionDelta += 2
  if (!hasMat) hpDelta = -2
  return { exp, sanDelta, passionDelta, hpDelta, hasMat, hasArchive, knowledgeCount, durationMinutes }
}

function calcPracticeSettlement(type, note) {
  let exp = 8, sanDelta = -2, passionDelta = 0, hpDelta = 0
  if (note.trim().length > 10) { exp += 4; passionDelta = 3 }
  else if (note.trim().length > 0) { exp += 1 }
  return { exp, sanDelta, passionDelta, hpDelta, note }
}

function calcExerciseSettlement(type, duration) {
  const d = parseInt(duration) || 20
  let exp = 6, sanDelta = -2, passionDelta = -1, hpDelta = 5
  if (d >= 30) { exp += 4; hpDelta += 3 } else if (d >= 15) { exp += 2; hpDelta += 1 }
  return { exp, sanDelta, passionDelta, hpDelta, duration: d }
}

function calcExpSettlement(type, title, note) {
  let exp = 5, sanDelta = 3, passionDelta = 1, hpDelta = 0
  if (note.trim().length > 20) { exp += 5; passionDelta += 2 }
  else if (note.trim().length > 0) { exp += 2 }
  return { exp, sanDelta, passionDelta, hpDelta, note }
}

function applySettlement(data, result) {
  const s = data.stats
  s.exp += result.exp
  s.san = Math.max(0, Math.min(s.sanMax, s.san + (result.sanDelta || 0)))
  s.passion = Math.max(0, Math.min(s.passionMax, s.passion + (result.passionDelta || 0)))
  s.hp = Math.max(0, Math.min(s.hpMax, s.hp + (result.hpDelta || 0)))
  while (s.exp >= s.expToNext) {
    s.exp -= s.expToNext
    s.level += 1
    s.expToNext = Math.floor(s.expToNext * 1.3)
    s.hpMax += 10; s.sanMax += 10; s.passionMax += 10
    s.hp = Math.min(s.hpMax, s.hp + 20)
    s.san = Math.min(s.sanMax, s.san + 20)
    s.passion = Math.min(s.passionMax, s.passion + 10)
    showToast(`🎉 升级！Lv.${s.level}！`)
  }
  saveDayData(data)
}

// ============================================================
//  七、UI 工具函数
// ============================================================

function showModal(title, bodyHTML, buttons) {
  const overlay = document.getElementById('modal-overlay')
  overlay.innerHTML = `
    <div class="modal-box">
      <h3>${title}</h3>
      ${bodyHTML}
      <div class="modal-btn-row">
        ${buttons.map(b => `<button class="btn ${b.cls||'btn-outline'}" data-action="${b.action}">${b.label}</button>`).join('')}
      </div>
    </div>`
  overlay.classList.remove('hidden')
  overlay.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      const fn = modalHandlers[e.target.dataset.action]
      if (fn) fn(e)
    })
  })
}

function closeModal() { document.getElementById('modal-overlay').classList.add('hidden') }
const modalHandlers = {}

function showToast(msg) {
  const el = document.createElement('div')
  el.className = 'toast'
  el.textContent = msg
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2000)
}

// ============================================================
//  八、节点索引辅助
// ============================================================

function getNode(data, nodeId) { return data.nodes.find(n => n.id === nodeId) }
function getAction(node) { return ACTION_TYPES[node.actionType] }

// ============================================================
//  九、渲染引擎
// ============================================================

function render() {
  const app = document.getElementById('app')
  const data = getDayData()
  state._currentQuote = randomQuote() // 每次手动触发 render 时换名言

  let html = renderHeader(data) + `<div class="room-view">`

  switch (state.view) {
    case 'bedroom':       html += renderBedroom(data); break
    case 'computer-room': html += renderComputerRoom(data); break
    case 'studio':        html += renderStudio(data); break
    case 'gym':           html += renderGym(data); break
    case 'library':       html += renderLibrary(data); break
    case 'rooms':         html += renderRoomList(); break
    case 'stats-panel':   html += renderStatsPanel(data); break
    default:              html += renderBedroom(data)
  }

  html += `</div>` + renderBottomNav()
  app.innerHTML = html
  bindEvents()
}

// ----- 顶部 -----
function renderHeader(data) {
  const s = data.stats
  return `
    <div class="header">
      <div class="mascot-placeholder">🐱</div>
      <div class="header-info">
        <div class="header-date">${todayDisplay()}</div>
        <div class="header-quote">${state._currentQuote}</div>
      </div>
      <div class="header-level-badge">Lv.${s.level}</div>
    </div>
    <div class="stats-bar">
      <div class="stat-row">
        <span class="stat-icon">❤️</span>
        <div class="stat-track"><div class="stat-fill hp" style="width:${(s.hp/s.hpMax*100).toFixed(0)}%"></div></div>
        <span class="stat-label">${s.hp}/${s.hpMax}</span>
      </div>
      <div class="stat-row">
        <span class="stat-icon">💙</span>
        <div class="stat-track"><div class="stat-fill san" style="width:${(s.san/s.sanMax*100).toFixed(0)}%"></div></div>
        <span class="stat-label">${s.san}/${s.sanMax}</span>
      </div>
      <div class="stat-row">
        <span class="stat-icon">💗</span>
        <div class="stat-track"><div class="stat-fill passion" style="width:${(s.passion/s.passionMax*100).toFixed(0)}%"></div></div>
        <span class="stat-label">${s.passion}/${s.passionMax}</span>
      </div>
      <div class="stat-row exp-row">
        <span class="stat-icon">✨</span>
        <div class="stat-track"><div class="stat-fill exp" style="width:${(s.exp/s.expToNext*100).toFixed(0)}%"></div></div>
        <span class="exp-label">${s.exp}/${s.expToNext}</span>
      </div>
    </div>`
}

// ----- 卧室：节点列表（新模型）-----
function renderBedroom(data) {
  const nodes = data.nodes
  const totalDone = nodes.reduce((sum, n) => sum + n.doneCount, 0)
  const totalCount = nodes.reduce((sum, n) => sum + n.count, 0)
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  let html = `
    <div class="room-header">
      <h2>🏠 卧室</h2>
      <span style="margin-left:auto;font-size:13px;color:var(--text-muted)">${totalDone}/${totalCount}</span>
    </div>
    <div class="node-list">`

  for (const node of nodes) {
    const action = getAction(node)
    if (!action) continue

    const isCurrent = state.currentNodeId === node.id
    const fullyDone = node.done
    const partiallyDone = !fullyDone && node.doneCount > 0
    const grade = DURATION_GRADES[node.durationGrade]

    // 判断是否是当前时间段的节点
    const startMin = timeStrToMinutes(node.startTime)
    // 对于大睡眠（startTime 23:00），它的 endTime 跨天到了今天
    // 处理：如果 startTime > endTime（分钟数），说明跨天了
    const endMin = startMin + node.count * grade.minutes
    const isActiveNow = nowMinutes >= startMin && nowMinutes < endMin

    // 显示标签
    const subtypeLabel = node.subtype ? ` · ${node.subtype}` : ''
    const countLabel = node.count > 1 ? ` ×${node.count}` : ''
    const gradeLabel = grade.label

    // 状态文字
    let statusHTML = ''
    if (fullyDone) {
      statusHTML = '<span class="node-status-done">✅</span>'
    } else if (partiallyDone) {
      statusHTML = `<span class="node-status-progress">${node.doneCount}/${node.count}</span>`
    } else if (isCurrent) {
      statusHTML = '<span class="node-status-active">▶ 进行中</span>'
    } else if (isActiveNow) {
      statusHTML = '<span class="node-status-now">📍 当前时段</span>'
    } else {
      statusHTML = '<span class="node-status-pending">→</span>'
    }

    html += `
      <div class="node-card${fullyDone ? ' done' : ''}${isCurrent ? ' current' : ''}${isActiveNow && !fullyDone ? ' active-now' : ''}"
           data-node-id="${node.id}" data-action="click-node">
        <div class="node-icon">${action.icon}</div>
        <div class="node-info">
          <div class="node-name">${action.name}${subtypeLabel}${countLabel}</div>
          <div class="node-time">${node.startTime} - ${node.endTime} · ${gradeLabel}级(${grade.minutes}min)</div>
        </div>
        ${statusHTML}
        ${!fullyDone ? `<button class="node-edit-btn" data-action="edit-node" data-node-id="${node.id}" title="编辑节点">⚙</button>` : ''}
      </div>`
  }

  html += `</div>`
  return html
}

// ----- 电脑房：专注学习 -----
function renderComputerRoom(data) {
  let html = `
    <div class="room-header">
      <button class="room-back-btn" data-action="back-bedroom">←</button>
      <h2>🖥️ 电脑房</h2>
    </div>
    <div class="study-container">`

  switch (state.studyPhase) {
    case 'pre':        html += renderStudyPre(); break
    case 'timing':     html += renderStudyTiming(); break
    case 'post':       html += renderStudyPost(); break
    case 'settlement': html += renderStudySettlement(); break
    default:
      state.studyPhase = 'pre'
      html += renderStudyPre()
  }
  html += `</div>`
  return html
}

function renderStudyPre() {
  const log = state.studyLog
  return `
    <div class="study-panel">
      <h3>📝 学习前记录</h3>
      <div class="form-group">
        <label>学习领域</label>
        <input type="text" id="study-field" placeholder="例如：前端开发、日语、钢琴..." value="${escHtml(log.field)}">
      </div>
      <div class="form-group">
        <label>学习材料</label>
        <select id="study-material">
          <option value="yes" ${log.hasMaterial==='yes'?'selected':''}>有（已确定的学习材料）</option>
          <option value="no" ${log.hasMaterial==='no'?'selected':''}>无（消耗双倍San值）</option>
        </select>
      </div>
      <div class="form-group">
        <label>材料链接/说明</label>
        <input type="text" id="study-material-detail" placeholder="粘贴链接或描述材料" value="${escHtml(log.materialDetail)}">
      </div>
      <div class="form-group">
        <label>学习前留言（目标/心情）</label>
        <textarea id="study-pre-msg" rows="3" placeholder="今天要学什么？写下来给自己看...">${escHtml(log.preMessage)}</textarea>
      </div>
      <button class="btn btn-primary btn-block btn-lg" data-action="start-study">🚀 开始计时学习</button>
    </div>`
}

function renderStudyTiming() {
  const r = state.timer.remaining
  const display = `${String(Math.floor(r/60)).padStart(2,'0')}:${String(r%60).padStart(2,'0')}`
  return `
    <div class="study-panel">
      <h3>⏰ 学习中…</h3>
      <div class="timer-display">
        <div class="timer-number">${display}</div>
        <div class="timer-status">专注时间 · 心无旁骛</div>
      </div>
      <div class="timer-controls">
        <button class="btn btn-danger" data-action="end-study-early">⏹ 结束节点</button>
      </div>
    </div>`
}

function renderStudyPost() {
  const log = state.studyLog
  const showCheck = log.hasMaterial === 'no'
  return `
    <div class="study-panel">
      <h3>📝 学习后记录</h3>
      <div class="form-group">
        <label>学习存档（笔记/截图/过程资料）</label>
        <textarea id="study-archive" rows="3" placeholder="粘贴笔记或记录重点...">${escHtml(log.archive)}</textarea>
      </div>
      <div class="form-group">
        <label>知识更新（学到了什么？一行一条）</label>
        <textarea id="study-knowledge" rows="3" placeholder="输入学到的新知识，每行一条...">${escHtml(log.knowledge)}</textarea>
      </div>
      ${showCheck ? `
      <div class="form-group" style="background:var(--hp-bg);padding:10px;border-radius:var(--radius-sm);">
        <label style="color:var(--hp);">⚠️ 电子产品自查检验</label>
        <p style="font-size:13px;color:var(--text-light);margin-bottom:8px;">本次学习没有提前准备材料，请诚实检查：是否有错误使用电子产品的情况？</p>
        <select id="study-selfcheck">
          <option value="no">没有，一直在学习</option>
          <option value="yes">有，分心刷手机了</option>
        </select>
      </div>`:''}
      <div class="form-group">
        <label>学习后留言（碎碎念/感想）</label>
        <textarea id="study-post-msg" rows="2" placeholder="学完了，感觉怎么样？">${escHtml(log.postMessage)}</textarea>
      </div>
      <button class="btn btn-accent btn-block btn-lg" data-action="settle-study">💰 结算本次学习</button>
    </div>`
}

function renderStudySettlement() {
  const result = state._lastSettlement
  if (!result) return `<div class="study-panel"><p>结算数据异常</p></div>`
  const sign = v => v>0?'+':''
  const cls = v => v>0?'positive':v<0?'negative':'neutral'
  return `
    <div class="settlement">
      <h3>📊 结算</h3>
      <div class="settlement-exp">✨ 经验 +${result.exp}</div>
      <div class="settlement-item"><span>❤️ 体力</span><span class="settlement-value ${cls(result.hpDelta)}">${sign(result.hpDelta)}${result.hpDelta}</span></div>
      <div class="settlement-item"><span>💙 San值</span><span class="settlement-value ${cls(result.sanDelta)}">${sign(result.sanDelta)}${result.sanDelta}</span></div>
      <div class="settlement-item"><span>💗 热情</span><span class="settlement-value ${cls(result.passionDelta)}">${sign(result.passionDelta)}${result.passionDelta}</span></div>
      <div class="settlement-item"><span>学习时长</span><span class="settlement-value neutral">${result.durationMinutes}分钟</span></div>
      <div class="settlement-item"><span>有无材料</span><span class="settlement-value neutral">${result.hasMat?'✅ 有':'⚠️ 无'}</span></div>
      <div class="settlement-item"><span>有无存档</span><span class="settlement-value neutral">${result.hasArchive?'✅ 有':'❌ 无'}</span></div>
      <div class="settlement-item"><span>知识更新</span><span class="settlement-value neutral">${result.knowledgeCount}条</span></div>
      <button class="btn btn-success btn-block settlement-btn" data-action="confirm-settlement">确认</button>
    </div>`
}

// ----- 画室：自主实践 -----
function renderStudio(data) {
  const log = state.tempLog
  const PRACTICE_TYPES = [
    { id:'drawing',icon:'🎨',name:'画画'},{ id:'singing',icon:'🎤',name:'练歌'},
    { id:'dance',icon:'💃',name:'跳舞'},{ id:'language',icon:'🗣️',name:'语言训练'},
  ]
  return `
    <div class="room-header">
      <button class="room-back-btn" data-action="back-bedroom">←</button>
      <h2>🎨 画室</h2>
    </div>
    <div class="study-container">
      <div class="study-panel">
        <h3>选择实践类型</h3>
        <div class="practice-options">
          ${PRACTICE_TYPES.map(t=>`
            <div class="practice-option${log.practiceType===t.id?' selected':''}" data-action="select-practice" data-value="${t.id}">
              <span class="po-icon">${t.icon}</span>${t.name}
            </div>`).join('')}
        </div>
        <div class="form-group">
          <label>训练心得</label>
          <textarea id="practice-note" rows="3" placeholder="记录今天的练习感受...">${escHtml(log.practiceNote)}</textarea>
        </div>
        <button class="btn btn-primary btn-block btn-lg" data-action="settle-practice">💰 结算</button>
      </div>
    </div>`
}

// ----- 健身房：体育锻炼 -----
function renderGym(data) {
  const log = state.tempLog
  const TYPES = [
    { id:'run',icon:'🏃',name:'跑步'},{ id:'strength',icon:'💪',name:'力量训练'},
    { id:'ball',icon:'⚽',name:'球类'},{ id:'other',icon:'🤸',name:'其他'},
  ]
  return `
    <div class="room-header">
      <button class="room-back-btn" data-action="back-bedroom">←</button>
      <h2>🏃 健身房</h2>
    </div>
    <div class="study-container">
      <div class="study-panel">
        <h3>选择运动类型</h3>
        <div class="practice-options">
          ${TYPES.map(t=>`
            <div class="practice-option${log.exerciseType===t.id?' selected':''}" data-action="select-exercise" data-value="${t.id}">
              <span class="po-icon">${t.icon}</span>${t.name}
            </div>`).join('')}
        </div>
        <div class="form-group">
          <label>运动时长（分钟）</label>
          <input type="number" id="exercise-duration" placeholder="30" value="${log.exerciseDuration}" min="1">
        </div>
        <button class="btn btn-primary btn-block btn-lg" data-action="settle-exercise">💰 结算</button>
      </div>
    </div>`
}

// ----- 书房：增长阅历 -----
function renderLibrary(data) {
  const log = state.tempLog
  const TYPES = [
    { id:'reading',icon:'📚',name:'阅读'},{ id:'movie',icon:'🎬',name:'观影'},{ id:'game',icon:'🎮',name:'游戏'},
  ]
  return `
    <div class="room-header">
      <button class="room-back-btn" data-action="back-bedroom">←</button>
      <h2>📖 书房</h2>
    </div>
    <div class="study-container">
      <div class="study-panel">
        <h3>选择类型</h3>
        <div class="practice-options">
          ${TYPES.map(t=>`
            <div class="practice-option${log.expType===t.id?' selected':''}" data-action="select-exp" data-value="${t.id}">
              <span class="po-icon">${t.icon}</span>${t.name}
            </div>`).join('')}
        </div>
        <div class="form-group">
          <label>作品名称</label>
          <input type="text" id="exp-title" placeholder="输入名称" value="${escHtml(log.expTitle)}">
        </div>
        <div class="form-group">
          <label>感想 / 记录</label>
          <textarea id="exp-note" rows="3" placeholder="写点什么吧...">${escHtml(log.expNote)}</textarea>
        </div>
        <button class="btn btn-primary btn-block btn-lg" data-action="settle-exp">💰 结算</button>
      </div>
    </div>`
}

// ----- 房间列表 -----
function renderRoomList() {
  const rooms = [
    { id:'bedroom',icon:'🏠',name:'卧室',desc:'查看今日节点'},
    { id:'computer-room',icon:'🖥️',name:'电脑房',desc:'专注学习'},
    { id:'studio',icon:'🎨',name:'画室',desc:'自主实践'},
    { id:'gym',icon:'🏃',name:'健身房',desc:'体育锻炼'},
    { id:'library',icon:'📖',name:'书房',desc:'增长阅历'},
  ]
  return `
    <div class="room-header"><h2>🗺️ 房间列表</h2></div>
    <div class="room-grid">
      ${rooms.map(r=>`
        <div class="room-card" data-action="goto-room" data-room="${r.id}">
          <span class="rc-icon">${r.icon}</span>
          <div class="rc-name">${r.name}</div>
          <div class="rc-desc">${r.desc}</div>
        </div>`).join('')}
    </div>`
}

// ----- 数值面板 -----
function renderStatsPanel(data) {
  const s = data.stats
  return `
    <div class="room-header"><h2>📊 个人数值</h2></div>
    <div class="stats-panel">
      <div class="stat-card">
        <div class="stat-card-header">
          <span class="sc-name">❤️ 体力</span>
          <span class="sc-value hp">${s.hp}/${s.hpMax}</span>
        </div>
        <div class="stat-track"><div class="stat-fill hp" style="width:${(s.hp/s.hpMax*100).toFixed(0)}%"></div></div>
        <div class="stat-desc">代表身体健康状态。锻炼可以恢复，过度学习会消耗。</div>
        <button class="btn btn-outline btn-sm" data-action="edit-stat" data-stat="hp" style="margin-top:8px;font-size:12px;">✏️ 手动调整</button>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <span class="sc-name">💙 San值（理性）</span>
          <span class="sc-value san">${s.san}/${s.sanMax}</span>
        </div>
        <div class="stat-track"><div class="stat-fill san" style="width:${(s.san/s.sanMax*100).toFixed(0)}%"></div></div>
        <div class="stat-desc">代表精神专注力。有准备的学习消耗少，无准备消耗双倍。</div>
        <button class="btn btn-outline btn-sm" data-action="edit-stat" data-stat="san" style="margin-top:8px;font-size:12px;">✏️ 手动调整</button>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <span class="sc-name">💗 热情</span>
          <span class="sc-value passion">${s.passion}/${s.passionMax}</span>
        </div>
        <div class="stat-track"><div class="stat-fill passion" style="width:${(s.passion/s.passionMax*100).toFixed(0)}%"></div></div>
        <div class="stat-desc">代表内在动力。有成就感会提升，敷衍了事会下降。</div>
        <button class="btn btn-outline btn-sm" data-action="edit-stat" data-stat="passion" style="margin-top:8px;font-size:12px;">✏️ 手动调整</button>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <span class="sc-name">⬆️ 生存等级 Lv.${s.level}</span>
          <span class="sc-value" style="color:var(--gold);">✨${s.exp}/${s.expToNext}</span>
        </div>
        <div class="stat-track"><div class="stat-fill exp" style="width:${(s.exp/s.expToNext*100).toFixed(0)}%"></div></div>
        <div class="stat-desc">综合经验积累。每日登录、完成节点、认真记录均可获得经验。</div>
      </div>
    </div>`
}

// ----- 底部导航 -----
function renderBottomNav() {
  const items = [
    { view:'bedroom',icon:'🏠',label:'卧室' },
    { view:'computer-room',icon:'🖥️',label:'学习' },
    { view:'rooms',icon:'🗺️',label:'房间' },
    { view:'stats-panel',icon:'📊',label:'数值' },
  ]
  return `<div class="bottom-nav">${items.map(item=>`
    <button class="nav-item${state.view===item.view?' active':''}" data-action="nav-to" data-view="${item.view}">
      <span class="nav-icon">${item.icon}</span>${item.label}
    </button>`).join('')}</div>`
}

// ============================================================
//  十、事件绑定
// ============================================================

function bindEvents() {
  const app = document.getElementById('app')

  // 点击节点
  app.querySelectorAll('[data-action="click-node"]').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('[data-action="edit-node"]')) return // 编辑按钮单独处理
      const card = e.currentTarget
      if (card.classList.contains('done')) return
      handleNodeClick(card.dataset.nodeId)
    })
  })

  // 编辑节点按钮
  app.querySelectorAll('[data-action="edit-node"]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation()
      handleEditNode(el.dataset.nodeId)
    })
  })

  // 回到卧室
  app.querySelectorAll('[data-action="back-bedroom"]').forEach(el => {
    el.addEventListener('click', () => {
      if (state.timer.intervalId) { if (!confirm('学习计时进行中，确定返回吗？')) return; stopTimer() }
      goToBedroom()
    })
  })

  // 开始学习
  app.querySelectorAll('[data-action="start-study"]').forEach(el => el.addEventListener('click', handleStartStudy))
  // 提前结束
  app.querySelectorAll('[data-action="end-study-early"]').forEach(el => el.addEventListener('click', handleEndStudyEarly))
  // 结算学习
  app.querySelectorAll('[data-action="settle-study"]').forEach(el => el.addEventListener('click', handleSettleStudy))
  // 确认结算
  app.querySelectorAll('[data-action="confirm-settlement"]').forEach(el => el.addEventListener('click', handleConfirmSettlement))

  // 实践
  app.querySelectorAll('[data-action="select-practice"]').forEach(el => el.addEventListener('click', ()=>{ state.tempLog.practiceType=el.dataset.value; render() }))
  app.querySelectorAll('[data-action="settle-practice"]').forEach(el => el.addEventListener('click', handleSettlePractice))

  // 锻炼
  app.querySelectorAll('[data-action="select-exercise"]').forEach(el => el.addEventListener('click', ()=>{ state.tempLog.exerciseType=el.dataset.value; render() }))
  app.querySelectorAll('[data-action="settle-exercise"]').forEach(el => el.addEventListener('click', handleSettleExercise))

  // 阅历
  app.querySelectorAll('[data-action="select-exp"]').forEach(el => el.addEventListener('click', ()=>{ state.tempLog.expType=el.dataset.value; render() }))
  app.querySelectorAll('[data-action="settle-exp"]').forEach(el => el.addEventListener('click', handleSettleExp))

  // 导航
  app.querySelectorAll('[data-action="nav-to"]').forEach(el => el.addEventListener('click', ()=>{
    if (state.timer.intervalId) { if (!confirm('学习计时进行中，确定切换吗？')) return; stopTimer() }
    navigateTo(el.dataset.view)
  }))

  // 房间卡片
  app.querySelectorAll('[data-action="goto-room"]').forEach(el => el.addEventListener('click', ()=>navigateTo(el.dataset.room)))

  // 手动调整数值
  app.querySelectorAll('[data-action="edit-stat"]').forEach(el => el.addEventListener('click', ()=>handleEditStat(el.dataset.stat)))
}

// ============================================================
//  十一、节点点击处理（路由）
// ============================================================

function handleNodeClick(nodeId) {
  const data = getDayData()
  const node = getNode(data, nodeId)
  if (!node || node.done) return
  const action = getAction(node)
  if (!action) return

  state.currentNodeId = nodeId

  switch (node.actionType) {
    case 'work_study':
      // 根据子类型路由
      if (node.subtype === '体育锻炼') {
        state.view = 'gym'
        state.tempLog.exerciseType = ''
        state.tempLog.exerciseDuration = ''
      } else if (node.subtype === '自主实践') {
        state.view = 'studio'
        state.tempLog.practiceType = ''
        state.tempLog.practiceNote = ''
      } else {
        // 深度学习 / 浅层学习 → 电脑房
        state.view = 'computer-room'
        state.studyPhase = 'pre'
        state.studyLog = { field:'', hasMaterial:'yes', materialDetail:'', preMessage:'', startTime:null, endTime:null, archive:'', knowledge:'', postMessage:'' }
      }
      render()
      break

    case 'chores':
      if (node.subtype === '起床') {
        showModal('☀️ 起床', '<p style="color:var(--text-light)">新的一天开始了！看板娘在等你哦。</p>', [
          { label:'起床！', action:'do-wakeup', cls:'btn-primary' },
        ])
        modalHandlers['do-wakeup'] = () => { completeSimpleNode(nodeId); closeModal(); showToast('☀️ 早安！新的一天开始了！') }
      } else if (node.subtype === '娱乐') {
        showModal('🎮 娱乐', '<p style="color:var(--text-light)">适当放松是必要的，享受当下吧。</p>', [
          { label:'标记完成', action:'do-chore', cls:'btn-accent' },
        ])
        modalHandlers['do-chore'] = () => { completeSimpleNode(nodeId); closeModal(); showToast('🎮 休息好了继续加油！') }
      } else {
        // 洗澡、整理等
        completeSimpleNode(nodeId)
        showToast(`${action.icon} ${action.name}${node.subtype?'·'+node.subtype:''} 标记完成！`)
      }
      break

    case 'big_sleep':
      showModal('😴 大睡眠', '<p style="color:var(--text-light)">好好休息才能恢复状态。明天见！</p>', [
        { label:'晚安', action:'do-bigsleep', cls:'btn-primary' },
      ])
      modalHandlers['do-bigsleep'] = () => {
        // 大睡眠全部标记完成
        const d = getDayData()
        const nd = getNode(d, nodeId)
        if (nd) { nd.doneCount = nd.count; nd.done = true; nd.log = { settledAt: Date.now() } }
        const settlement = action.settlement
        if (settlement) applySettlement(d, { exp: settlement.exp * node.count, sanDelta: settlement.sanDelta * node.count, passionDelta: settlement.passionDelta * node.count, hpDelta: settlement.hpDelta * node.count })
        saveDayData(d)
        closeModal()
        showToast('🌙 晚安！明天见！')
        render()
      }
      break

    case 'small_sleep':
      showModal('💤 小睡眠', '<p style="color:var(--text-light)">午间小憩，充电后再出发。</p>', [
        { label:'开始休息', action:'do-smallsleep', cls:'btn-primary' },
      ])
      modalHandlers['do-smallsleep'] = () => { completeSimpleNode(nodeId); closeModal(); showToast('💤 休息完毕，精力恢复！') }
      break

    case 'big_eat':
    case 'small_eat':
      showModal(`${action.icon} ${action.name}${node.subtype?' · '+node.subtype:''}`,
        '<p style="color:var(--text-light)">好好吃饭，补充能量。</p>', [
        { label:'标记完成', action:'do-eat', cls:'btn-primary' },
      ])
      modalHandlers['do-eat'] = () => { completeSimpleNode(nodeId); closeModal(); showToast('🍽️ 吃饱了继续战斗！') }
      break

    case 'walk':
    case 'short_break':
    case 'long_break':
    case 'free':
      completeSimpleNode(nodeId)
      showToast(`${action.icon} ${action.name} 标记完成！`)
      break

    default:
      completeSimpleNode(nodeId)
      showToast(`${action.icon} ${action.name} 完成！`)
  }
}

// 简单节点：使用预设结算值
function completeSimpleNode(nodeId) {
  const data = getDayData()
  const node = getNode(data, nodeId)
  if (!node || node.done) return
  node.doneCount = node.count
  node.done = true
  node.log = { settledAt: Date.now() }
  const action = getAction(node)
  if (action && action.settlement) {
    applySettlement(data, {
      exp: action.settlement.exp * node.count,
      sanDelta: action.settlement.sanDelta * node.count,
      passionDelta: action.settlement.passionDelta * node.count,
      hpDelta: action.settlement.hpDelta * node.count,
    })
  } else {
    applySettlement(data, { exp: node.count * 2, sanDelta: 1, passionDelta: 1, hpDelta: 1 })
  }
  saveDayData(data)
  render()
}

// ============================================================
//  十二、节点编辑
// ============================================================

function handleEditNode(nodeId) {
  const data = getDayData()
  const node = getNode(data, nodeId)
  if (!node || node.done) return

  const gradeOptions = Object.entries(DURATION_GRADES).map(([k,v])=>
    `<option value="${k}" ${node.durationGrade===k?'selected':''}>${v.label}级 - ${v.name}</option>`).join('')

  const subtypeOptions = () => {
    const action = getAction(node)
    if (!action || !action.subtypes) return ''
    return action.subtypes.map(s=>`<option value="${s}" ${node.subtype===s?'selected':''}>${s}</option>`).join('')
  }

  showModal('⚙️ 编辑节点',
    `<div class="form-group">
      <label>时长等级</label>
      <select id="edit-grade">${gradeOptions}</select>
    </div>
    ${node.actionType !== 'work_study' ? '' : `
    <div class="form-group">
      <label>子类型</label>
      <select id="edit-subtype">${subtypeOptions()}</select>
    </div>`}
    <div class="form-group">
      <label>起始时间</label>
      <input type="time" id="edit-start" value="${node.startTime}">
    </div>`,
    [
      { label:'保存', action:'save-node-edit', cls:'btn-primary' },
      { label:'取消', action:'cancel-modal', cls:'btn-outline' },
    ]
  )
  modalHandlers['save-node-edit'] = () => {
    const data = getDayData()
    const nd = getNode(data, nodeId)
    if (!nd) { closeModal(); return }
    nd.durationGrade = document.getElementById('edit-grade')?.value || nd.durationGrade
    const newSubtype = document.getElementById('edit-subtype')?.value
    if (newSubtype !== undefined) nd.subtype = newSubtype
    const newStart = document.getElementById('edit-start')?.value
    if (newStart) {
      nd.startTime = newStart
      const grade = DURATION_GRADES[nd.durationGrade]
      const endMin = timeStrToMinutes(newStart) + nd.count * grade.minutes
      nd.endTime = minutesToTimeStr(endMin)
    }
    saveDayData(data)
    closeModal()
    render()
    showToast('✅ 节点已更新')
  }
}

// ============================================================
//  十三、数值手动调整
// ============================================================

function handleEditStat(stat) {
  const data = getDayData()
  const s = data.stats
  const labels = { hp:'❤️ 体力', san:'💙 San值', passion:'💗 热情' }
  const current = stat === 'hp' ? s.hp : stat === 'san' ? s.san : s.passion
  const max = stat === 'hp' ? s.hpMax : stat === 'san' ? s.sanMax : s.passionMax

  showModal(`✏️ 调整${labels[stat]}`,
    `<div class="form-group">
      <label>当前值 (上限 ${max})</label>
      <input type="number" id="edit-stat-val" value="${current}" min="0" max="${max}">
    </div>`,
    [
      { label:'保存', action:'save-stat-edit', cls:'btn-primary' },
      { label:'取消', action:'cancel-modal', cls:'btn-outline' },
    ]
  )
  modalHandlers['save-stat-edit'] = () => {
    const val = parseInt(document.getElementById('edit-stat-val')?.value)
    if (isNaN(val)) { closeModal(); return }
    const d = getDayData()
    if (stat === 'hp') d.stats.hp = Math.max(0, Math.min(d.stats.hpMax, val))
    else if (stat === 'san') d.stats.san = Math.max(0, Math.min(d.stats.sanMax, val))
    else if (stat === 'passion') d.stats.passion = Math.max(0, Math.min(d.stats.passionMax, val))
    saveDayData(d)
    closeModal()
    render()
    showToast(`✅ ${labels[stat]} 已调整`)
  }
}

modalHandlers['cancel-modal'] = () => closeModal()

// ============================================================
//  十四、学习流程（保持原有逻辑）
// ============================================================

function handleStartStudy() {
  state.studyLog.field = document.getElementById('study-field')?.value || ''
  state.studyLog.hasMaterial = document.getElementById('study-material')?.value || 'yes'
  state.studyLog.materialDetail = document.getElementById('study-material-detail')?.value || ''
  state.studyLog.preMessage = document.getElementById('study-pre-msg')?.value || ''
  if (!state.studyLog.field.trim()) { showToast('请填写学习领域'); return }
  state.studyLog.startTime = Date.now()
  state.studyPhase = 'timing'
  state.timer.remaining = state.timer.total
  render()
  startTimer()
}

function handleEndStudyEarly() {
  stopTimer()
  state.studyLog.endTime = Date.now()
  state.studyPhase = 'post'
  render()
}

function handleSettleStudy() {
  state.studyLog.archive = document.getElementById('study-archive')?.value || ''
  state.studyLog.knowledge = document.getElementById('study-knowledge')?.value || ''
  state.studyLog.postMessage = document.getElementById('study-post-msg')?.value || ''
  const durationMinutes = Math.max(1, Math.ceil((state.studyLog.endTime - state.studyLog.startTime) / 60000))
  state._lastSettlement = calcFocusSettlement(state.studyLog, durationMinutes)
  state.studyPhase = 'settlement'
  render()
}

function handleConfirmSettlement() {
  const data = getDayData()
  const node = getNode(data, state.currentNodeId)
  if (node) { node.doneCount = node.count; node.done = true; node.log = { ...state.studyLog } }
  applySettlement(data, state._lastSettlement)
  state._lastSettlement = null

  if (state.studyLog.hasMaterial === 'no') {
    const sc = document.getElementById('study-selfcheck')?.value
    if (sc === 'yes') {
      data.stats.san = Math.max(0, data.stats.san - 5)
      data.stats.passion = Math.max(0, data.stats.passion - 3)
      saveDayData(data)
      showToast('⚠️ 自查发现分心，San-5，热情-3')
    }
  }
  goToBedroom()
  showToast('✅ 学习记录已保存！')
}

// ============================================================
//  十五、实践/锻炼/阅历结算
// ============================================================

function handleSettlePractice() {
  state.tempLog.practiceNote = document.getElementById('practice-note')?.value || ''
  if (!state.tempLog.practiceType) { showToast('请选择实践类型'); return }
  if (!state.tempLog.practiceNote.trim()) { showToast('请填写训练心得'); return }
  const data = getDayData()
  const node = getNode(data, state.currentNodeId)
  const result = calcPracticeSettlement(state.tempLog.practiceType, state.tempLog.practiceNote)
  if (node) { node.doneCount = node.count; node.done = true; node.log = { ...state.tempLog } }
  applySettlement(data, result)
  goToBedroom()
  showToast('🎨 实践记录已保存！')
}

function handleSettleExercise() {
  state.tempLog.exerciseDuration = document.getElementById('exercise-duration')?.value || ''
  if (!state.tempLog.exerciseType) { showToast('请选择运动类型'); return }
  if (!state.tempLog.exerciseDuration || parseInt(state.tempLog.exerciseDuration) < 1) { showToast('请输入有效时长'); return }
  const data = getDayData()
  const node = getNode(data, state.currentNodeId)
  const result = calcExerciseSettlement(state.tempLog.exerciseType, state.tempLog.exerciseDuration)
  if (node) { node.doneCount = node.count; node.done = true; node.log = { ...state.tempLog } }
  applySettlement(data, result)
  goToBedroom()
  showToast('🏃 运动记录已保存！')
}

function handleSettleExp() {
  state.tempLog.expTitle = document.getElementById('exp-title')?.value || ''
  state.tempLog.expNote = document.getElementById('exp-note')?.value || ''
  if (!state.tempLog.expType) { showToast('请选择阅历类型'); return }
  if (!state.tempLog.expTitle.trim()) { showToast('请输入作品名称'); return }
  const data = getDayData()
  const node = getNode(data, state.currentNodeId)
  const result = calcExpSettlement(state.tempLog.expType, state.tempLog.expTitle, state.tempLog.expNote)
  if (node) { node.doneCount = node.count; node.done = true; node.log = { ...state.tempLog } }
  applySettlement(data, result)
  goToBedroom()
  showToast('📖 阅历记录已保存！')
}

// ============================================================
//  十六、导航 & 计时器
// ============================================================

function goToBedroom() {
  state.view = 'bedroom'
  state.studyPhase = null
  state.currentNodeId = null
  render()
}

function navigateTo(view) {
  if (view === state.view) return
  if (['computer-room','studio','gym','library'].includes(state.view)) {
    if (state.timer.intervalId) stopTimer()
    state.studyPhase = null
    state.currentNodeId = null
  }
  state.view = view
  render()
}

function startTimer() {
  if (state.timer.intervalId) return
  state.timer.intervalId = setInterval(() => {
    state.timer.remaining -= 1
    if (state.timer.remaining <= 0) {
      state.timer.remaining = 0
      stopTimer()
      state.studyLog.endTime = Date.now()
      state.studyPhase = 'post'
      render()
      showToast('⏰ 时间到！')
      return
    }
    const timerEl = document.querySelector('.timer-number')
    const statusEl = document.querySelector('.timer-status')
    if (timerEl) {
      const mins = Math.floor(state.timer.remaining / 60)
      const secs = state.timer.remaining % 60
      timerEl.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`
    }
  }, 1000)
}

function stopTimer() {
  if (state.timer.intervalId) {
    clearInterval(state.timer.intervalId)
    state.timer.intervalId = null
  }
}

// ============================================================
//  十七、辅助函数
// ============================================================

function escHtml(str) {
  if (!str) return ''
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// ============================================================
//  十八、初始化
// ============================================================

function init() {
  const data = getDayData()
  // 确保每天的有效数据
  if (!data.nodes || data.nodes.length === 0) {
    const fresh = createNewDay()
    Object.assign(data, fresh)
  }
  render()
}

document.addEventListener('DOMContentLoaded', init)
