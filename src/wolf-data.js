/* ============================================================
   wolf-data.js — 数据模型、常量、工具函数
   ============================================================ */

const Wolf = window.Wolf || {}

// ==================== 时长等级 ====================
Wolf.DURATION_GRADES = {
  A: { label: 'A', minutes: 45, name: '45分钟', cssClass: 'grade-a' },
  B: { label: 'B', minutes: 30, name: '30分钟', cssClass: 'grade-b' },
  C: { label: 'C', minutes: 25, name: '25分钟', cssClass: 'grade-c' },
  D: { label: 'D', minutes: 20, name: '20分钟', cssClass: 'grade-d' },
  E: { label: 'E', minutes: 15, name: '15分钟', cssClass: 'grade-e' },
  F: { label: 'F', minutes: 10, name: '10分钟', cssClass: 'grade-f' },
}

// ==================== 行动类型 ====================
Wolf.ACTION_TYPES = {
  big_sleep: {
    id: 'big_sleep', name: '大睡眠', icon: '😴', defaultGrade: 'A', maxPerDay: 10, room: null,
    desc: '恢复体力与San值的主要途径', category: 'rest',
    completionGoal: '记录是否按时入睡', passThreshold: 100,
    hpPerNode: 0, sanPerNode: 0, passionPerNode: 0,  // 由每日结算统一处理
  },
  small_sleep: {
    id: 'small_sleep', name: '小睡眠', icon: '💤', defaultGrade: 'B', maxPerDay: 1, room: null,
    desc: '午间小憩', category: 'rest',
    completionGoal: '记录是否午休', passThreshold: 100,
  },
  big_eat: {
    id: 'big_eat', name: '大吃饭', icon: '🍽️', defaultGrade: 'A', maxPerDay: 2, room: null,
    subtypes: ['午饭','晚饭','早饭'], desc: '正餐时间', category: 'sustain',
    completionGoal: '按时进食', passThreshold: 100,
    hpRestore: 15,  // 每顿恢复体力
  },
  small_eat: {
    id: 'small_eat', name: '小吃饭', icon: '🥐', defaultGrade: 'D', maxPerDay: 1, room: null,
    subtypes: ['早饭','午饭','晚饭'], desc: '轻餐', category: 'sustain',
    completionGoal: '按时进食', passThreshold: 100,
    hpRestore: 8,
  },
  work_study: {
    id: 'work_study', name: '工作学习', icon: '📚', defaultGrade: 'A', maxPerDay: 10, room: null,
    subtypes: ['深度学习','浅层学习','自主实践','体育锻炼'], desc: '核心成长节点', category: 'work',
    completionGoal: '完成学习目标并填写log', passThreshold: 60,
    hpCost: 5, sanCost: 8,  // 每个完成节点消耗
  },
  walk: {
    id: 'walk', name: '走路', icon: '🚶', defaultGrade: 'C', maxPerDay: 4, room: null,
    subtypes: ['饭后百步走','散步'], desc: '轻度活动', category: 'sustain',
    completionGoal: '散步完成', passThreshold: 100,
    hpCost: 3, sanCost: 0,
  },
  chores: {
    id: 'chores', name: '家务', icon: '🧹', defaultGrade: 'A', maxPerDay: 4, room: null,
    subtypes: ['起床','洗澡','娱乐','整理'], desc: '日常事务', category: 'sustain',
    completionGoal: '事务完成', passThreshold: 100,
  },
  short_break: {
    id: 'short_break', name: '小休', icon: '☕', defaultGrade: 'F', maxPerDay: 6, room: null,
    requiresAfter: 'work_study', desc: '学习间小憩', category: 'rest',
    completionGoal: '休息', passThreshold: 100,
    sanRestore: 3,
  },
  long_break: {
    id: 'long_break', name: '大休', icon: '🛋️', defaultGrade: 'E', maxPerDay: 2, room: null,
    requiresAfter: 'work_study', desc: '较长的休息', category: 'rest',
    completionGoal: '休息', passThreshold: 100,
    sanRestore: 5,
  },
  free: {
    id: 'free', name: '自由', icon: '🎯', defaultGrade: 'E', maxPerDay: 2, room: null,
    desc: '灵活安排', category: 'free',
    completionGoal: '自由活动', passThreshold: 100,
  },
}

// ============================================================
//  新数值系统 v3 — 状态值 + 能力值 + 完成度评分
// ============================================================

// === 能力等级表：每级所需经验 = baseExp × growth^(level-1) ===
Wolf.ABILITY_LEVELS = {
  survival: { name: '生存等级', icon: '⬆️', baseExp: 100, growth: 1.3 },
  health:   { name: '健康等级', icon: '🏥', baseExp: 80,  growth: 1.25 },
  focus:    { name: '专注力',   icon: '🧠', baseExp: 80,  growth: 1.25 },
  faith:    { name: '信念',     icon: '🔥', baseExp: 80,  growth: 1.25 },
}

// === 计算升到下一级所需经验 ===
Wolf.expToNextLevel = function (abilityKey, currentLevel) {
  var cfg = Wolf.ABILITY_LEVELS[abilityKey]
  if (!cfg) return 100
  return Math.floor(cfg.baseExp * Math.pow(cfg.growth, currentLevel - 1))
}

// === 状态值默认上限（初始全 50，受能力等级加成） ===
Wolf.BASE_STATUS_MAX = { hp: 50, san: 50, passion: 50 }

// === 能力等级 → 状态值上限 ===
Wolf.getStatusMax = function (stats, key) {
  var base = Wolf.BASE_STATUS_MAX[key]
  switch (key) {
    case 'hp': return base + (stats.healthLevel - 1) * 10
    case 'san': return base + (stats.focusLevel - 1) * 10
    case 'passion': return base + (stats.faithLevel - 1) * 10
    default: return base
  }
}

// === 默认能力值 ===
Wolf.defaultAbilities = function () {
  return {
    survivalLevel: 1, survivalExp: 0,
    healthLevel: 1,   healthExp: 0,
    focusLevel: 1,    focusExp: 0,
    faithLevel: 1,    faithExp: 0,
    skills: {},
  }
}

// === 默认每日任务模板 ===
Wolf.DEFAULT_TASKS = [
  { id: 'daily-sleep',    name: '睡满6小时',    icon: '😴', desc: '完成 8 个以上大睡眠节点',
    condition: { type: 'node_count', actionType: 'big_sleep', minCount: 8 },
    reward: { survivalExp: 20, expLabel: '生存经验 +20' }, autoComplete: true },
  { id: 'daily-meals',    name: '按时吃饭',      icon: '🍽️', desc: '完成所有吃饭节点',
    condition: { type: 'node_count', actionType: 'big_eat', minCount: 2 },
    reward: { survivalExp: 10, expLabel: '生存经验 +10' }, autoComplete: true },
  { id: 'daily-exercise', name: '坚持锻炼',      icon: '🏃', desc: '完成体育锻炼节点',
    condition: { type: 'node_count', actionType: 'work_study', subtype: '体育锻炼', minCount: 1 },
    reward: { healthExp: 15, expLabel: '健康经验 +15' }, autoComplete: true },
  { id: 'daily-focus',    name: '深度学习',      icon: '📚', desc: '完成 2 个以上深度学习节点',
    condition: { type: 'node_count', actionType: 'work_study', subtype: '深度学习', minCount: 2 },
    reward: { focusExp: 15, expLabel: '专注经验 +15' }, autoComplete: true },
  { id: 'daily-review',   name: '每日回顾',      icon: '📝', desc: '完成所有节点的 log 填写',
    condition: { type: 'all_logged' },
    reward: { survivalExp: 20, faithExp: 10, expLabel: '生存+20 信念+10' }, autoComplete: true },
]

// === 检查任务条件 ===
Wolf.checkTaskCondition = function (task, nodes) {
  var cond = task.condition
  if (!cond) return false
  switch (cond.type) {
    case 'node_count':
      var count = 0
      nodes.forEach(function (n) {
        if (!n.done) return
        if (n.actionType === cond.actionType) {
          if (cond.subtype) { if (n.subtype === cond.subtype) count++ }
          else { count++ }
        }
      })
      return count >= (cond.minCount || 1)
    case 'all_logged':
      var allDone = nodes.every(function (n) { return n.done })
      if (!allDone) return false
      return nodes.every(function (n) { return n.log && n.log.completionScore !== undefined })
    default: return false
  }
}

// === 完成度常量 ===
Wolf.COMPLETION = {
  PASS_THRESHOLD: 60,
  LATE_PENALTY: 0.2,
  PERFECT_BONUS: 1.5,
}

// === 完成度 → 收益倍率 ===
Wolf.getCompletionMultiplier = function (score, isLate) {
  if (score < Wolf.COMPLETION.PASS_THRESHOLD) return 0
  if (score >= 100) return Wolf.COMPLETION.PERFECT_BONUS
  if (isLate) return Wolf.COMPLETION.LATE_PENALTY
  return 1.0
}

// ============================================================
//  三树系统 — 知识树 / 技能树 / 阅历树（长期数据，存 IndexedDB）
// ============================================================

// === 默认三树 ===
Wolf.defaultTrees = function () {
  return {
    knowledge: { domains: {}, inspirationPool: [] },
    skills: {
      drawing:   { id:'drawing',   name:'绘画',   icon:'🎨', level:1, exp:0, log:[] },
      singing:   { id:'singing',   name:'声乐',   icon:'🎤', level:1, exp:0, log:[] },
      dance:     { id:'dance',     name:'舞蹈',   icon:'💃', level:1, exp:0, log:[] },
      language:  { id:'language',  name:'语言',   icon:'🗣️',   level:1, exp:0, log:[] },
      coding:    { id:'coding',    name:'编程',   icon:'💻', level:1, exp:0, log:[] },
    },
    experience: { reading:[], movie:[], game:[], other:[] },
  }
}

// === 技能树等级成长 ===
Wolf.skillExpToNext = function (level) {
  return Math.floor(50 * Math.pow(1.3, level - 1))
}

// === 阅历树类型 ===
Wolf.EXP_TYPES = {
  reading: { icon:'📚', name:'阅读' },
  movie:   { icon:'🎬', name:'观影' },
  game:    { icon:'🎮', name:'游戏' },
  other:   { icon:'📌', name:'其他' },
}

// ==================== 默认预设时间表（紧接排列，无间隙） ====================
Wolf.DEFAULT_PRESET = [
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
  { start: '22:05', action: 'chores',      subtype: '整理' },
]

// ==================== 名言 ====================
Wolf.QUOTES = [
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

// ==================== 工具函数 ====================

Wolf.todayStr = function () {
  var d = new Date()
  // 一天范围：前日23:00 → 今日22:59
  // 如果当前时间 >= 23:00，算作"明天"的日期
  if (d.getHours() >= 23) {
    d.setDate(d.getDate() + 1)
  }
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}

Wolf.todayDisplay = function () {
  const d = new Date()
  const wd = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六']
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ${wd[d.getDay()]}`
}

Wolf.randomQuote = function () {
  return Wolf.QUOTES[Math.floor(Math.random() * Wolf.QUOTES.length)]
}

Wolf.timeStrToMinutes = function (t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

Wolf.minutesToTimeStr = function (m) {
  const h = Math.floor(m / 60) % 24
  const mm = m % 60
  return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`
}

Wolf.escHtml = function (str) {
  if (!str) return ''
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// ==================== 预设 → 每日节点生成（count>1 自动拆分，时间紧接排列） ====================
Wolf.generateNodesFromPreset = function (preset) {
  var nodes = []
  var idCounter = 0
  var cursorMinutes = null  // 紧接排列的光标

  for (var i = 0; i < preset.length; i++) {
    var entry = preset[i]
    var action = Wolf.ACTION_TYPES[entry.action]
    if (!action) continue

    var gradeKey = entry.grade || action.defaultGrade
    var grade = Wolf.DURATION_GRADES[gradeKey]
    if (!grade) continue

    var count = entry.count || 1

    for (var c = 0; c < count; c++) {
      var startMinutes
      if (c === 0 && cursorMinutes === null) {
        // 第一个节点：用预设的 startTime
        startMinutes = Wolf.timeStrToMinutes(entry.start)
        cursorMinutes = startMinutes
      } else {
        // 后续节点：紧接上一个节点的结束时间
        startMinutes = cursorMinutes
      }

      var endMinutes = startMinutes + grade.minutes

      nodes.push({
        id: 'node-' + (idCounter++),
        startTime: Wolf.minutesToTimeStr(startMinutes),
        endTime: Wolf.minutesToTimeStr(endMinutes),
        actionType: entry.action,
        subtype: entry.subtype || null,
        durationGrade: gradeKey,
        durationMinutes: grade.minutes,
        count: 1,
        doneCount: 0,
        done: false,
        log: null,
      })

      cursorMinutes = endMinutes
    }
  }

  return nodes
}

// ==================== 辅助查询 ====================
Wolf.getNode = function (data, nodeId) { return data.nodes.find(n => n.id === nodeId) }
Wolf.getAction = function (node) { return Wolf.ACTION_TYPES[node.actionType] }

// 判断节点是否过期（当前时间超过节点结束时间）
Wolf.isNodeLate = function (node) {
  if (!node) return false
  var now = new Date()
  var nowMinutes = now.getHours() * 60 + now.getMinutes()
  var endMinutes = Wolf.timeStrToMinutes(node.endTime)
  // 处理跨天情况（如 23:00-06:30）
  if (endMinutes < Wolf.timeStrToMinutes(node.startTime)) {
    endMinutes += 24 * 60
  }
  return nowMinutes > endMinutes
}
