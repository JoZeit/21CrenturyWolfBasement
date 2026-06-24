/* ============================================================
   wolf-state.js — 全局状态管理、结算引擎、计时器、导航
   ============================================================ */

;(function () {
  if (!window.Wolf) window.Wolf = {}

  // ==================== 全局状态 ====================
  Wolf.state = {
    view: 'bedroom',
    currentNodeId: null,
    studyPhase: null,
    timer: { total: 25*60, remaining: 25*60, intervalId: null },
    studyLog: {
      field: '', hasMaterial: 'yes', materialDetail: '', preMessage: '',
      startTime: null, endTime: null, archive: '', knowledge: '', postMessage: '',
    },
    tempLog: {
      practiceType: '', practiceNote: '',
      exerciseType: '', exerciseDuration: '',
      expType: '', expTitle: '', expNote: '',
    },
    _lastSettlement: null,
    _currentQuote: Wolf.randomQuote(),
    trees: null,  // 三树数据（异步加载）
    treeTab: 'knowledge',  // knowledge | skills | experience
  }

  // ==================== 结算引擎 v3（完成度评分 + 能力经验） ====================

  // 节点完成度评分（0-100）
  Wolf.scoreNodeCompletion = function (node, log) {
    var action = Wolf.getAction(node)
    if (!action) return 0
    var score = 0
    var cat = action.category

    switch (node.actionType) {
      case 'work_study':
        if (node.subtype === '体育锻炼') {
          score = 100  // 锻炼只要做了就是完成
        } else if (node.subtype === '自主学习' || node.subtype === '画画' || node.subtype === '练歌' || node.subtype === '跳舞' || node.subtype === '语言训练') {
          score = log.practiceNote && log.practiceNote.trim().length > 0 ? 80 : 0
        } else {
          // 深度学习/浅层学习
          score = 30  // 基础分
          if (log.field && log.field.trim())   score += 10
          if (log.hasMaterial === 'yes')        score += 15
          if (log.archive && log.archive.trim()) score += 20
          if (log.knowledge && log.knowledge.trim()) score += 15
          if (log.postMessage && log.postMessage.trim()) score += 10
        }
        break

      case 'big_sleep':
      case 'small_sleep':
        score = 100  // 睡了就是睡了
        break

      case 'big_eat':
      case 'small_eat':
        score = 100
        break

      case 'chores':
        score = node.subtype === '起床' ? 100 : 100
        break

      case 'walk':
      case 'short_break':
      case 'long_break':
      case 'free':
        score = 100
        break

      default:
        score = 100
    }

    return Math.min(100, Math.max(0, score))
  }

  // 完成度 → 收益结果
  Wolf.calcCompletionResult = function (node, log, isLate) {
    var score = Wolf.scoreNodeCompletion(node, log)
    var multi = Wolf.getCompletionMultiplier(score, isLate)
    var action = Wolf.getAction(node)

    var result = {
      completionScore: score,
      multiplier: multi,
      passed: multi > 0,
      isLate: !!isLate,
      survivalExp: 0, healthExp: 0, focusExp: 0, faithExp: 0,
      hpDelta: 0, sanDelta: 0, passionDelta: 0,
    }

    if (!result.passed) return result  // 失败，无收益

    switch (node.actionType) {
      case 'work_study':
        if (node.subtype === '体育锻炼') {
          result.healthExp = Math.floor(10 * multi)
          result.hpDelta = -(action.hpCost || 5) * 2  // 锻炼消耗2×
          result.sanDelta = -(action.sanCost || 8)
        } else {
          result.focusExp = Math.floor(8 * multi)
          result.survivalExp = Math.floor(5 * multi)
          result.hpDelta = -(action.hpCost || 5)
          result.sanDelta = -(action.sanCost || 8)
        }
        break

      case 'big_sleep':
        result.survivalExp = Math.floor(1 * multi)
        break

      case 'small_sleep':
        result.survivalExp = Math.floor(2 * multi)
        break

      case 'big_eat':
        result.survivalExp = Math.floor(2 * multi)
        result.hpDelta = (action.hpRestore || 15)
        break

      case 'small_eat':
        result.survivalExp = Math.floor(1 * multi)
        result.hpDelta = (action.hpRestore || 8)
        break

      case 'short_break':
        result.sanDelta = (action.sanRestore || 3)
        break

      case 'long_break':
        result.sanDelta = (action.sanRestore || 5)
        break

      default:
        result.survivalExp = Math.floor(2 * multi)
    }

    return result
  }

  // 应用结算到数据（新 v3）
  Wolf.applyCompletionResult = function (data, result) {
    var s = data.stats
    if (!result.passed) return  // 失败不操作

    // 状态值变化
    s.hp = Math.max(0, Math.min(s.hpMax, s.hp + (result.hpDelta || 0)))
    s.san = Math.max(0, Math.min(s.sanMax, s.san + (result.sanDelta || 0)))
    s.passion = Math.max(0, Math.min(s.passionMax, s.passion + (result.passionDelta || 0)))

    // 能力经验累积 + 升级
    Wolf._addAbilityExp(s, 'survival', result.survivalExp || 0)
    Wolf._addAbilityExp(s, 'health', result.healthExp || 0)
    Wolf._addAbilityExp(s, 'focus', result.focusExp || 0)
    Wolf._addAbilityExp(s, 'faith', result.faithExp || 0)

    Wolf.saveDayData(data)
  }

  // 给某项能力加经验并检查升级
  Wolf._addAbilityExp = function (s, key, amount) {
    if (amount <= 0) return
    var keyMap = { survival: 'survivalExp', health: 'healthExp', focus: 'focusExp', faith: 'faithExp' }
    var lvMap = { survival: 'survivalLevel', health: 'healthLevel', focus: 'focusLevel', faith: 'faithLevel' }
    var expKey = keyMap[key]
    var lvKey = lvMap[key]
    if (expKey === undefined || lvKey === undefined) return

    s[expKey] += amount
    var nextExp = Wolf.expToNextLevel(key, s[lvKey])
    while (s[expKey] >= nextExp) {
      s[expKey] -= nextExp
      s[lvKey] += 1
      nextExp = Wolf.expToNextLevel(key, s[lvKey])

      // 升级时更新对应状态上限
      switch (key) {
        case 'health': s.hpMax = Wolf.getStatusMax(s, 'hp'); break
        case 'focus': s.sanMax = Wolf.getStatusMax(s, 'san'); break
        case 'faith': s.passionMax = Wolf.getStatusMax(s, 'passion'); break
      }

      var label = Wolf.ABILITY_LEVELS[key] ? Wolf.ABILITY_LEVELS[key].name : key
      Wolf.showToast('🎉 ' + label + ' 升级！Lv.' + s[lvKey] + '！')
    }
  }

  // ==================== 每日刷新状态值 ====================
  Wolf.refreshDailyStatus = function (data) {
    var nodes = data.nodes
    var s = data.stats

    // 更新上限（由能力等级决定）
    s.hpMax = Wolf.getStatusMax(s, 'hp')
    s.sanMax = Wolf.getStatusMax(s, 'san')
    s.passionMax = Wolf.getStatusMax(s, 'passion')

    // 统计睡眠完成度
    var sleepNodes = nodes.filter(function (n) { return n.actionType === 'big_sleep' })
    var sleepDone = sleepNodes.filter(function (n) { return n.done }).length
    var sleepTotal = sleepNodes.length || 1
    var sleepRatio = sleepDone / sleepTotal

    // 如果当天还没睡过（新一天），默认满状态
    if (sleepDone === 0) sleepRatio = 1

    // 吟唱完成度（起床节点）
    var wakeNode = nodes.find(function (n) { return n.actionType === 'chores' && n.subtype === '起床' })
    var wakeDone = wakeNode && wakeNode.done ? 1 : 0
    // 新一天默认已吟唱
    if (!wakeNode || !wakeNode.done) wakeDone = 1

    // 体力：睡眠完成% × 上限
    s.hp = Math.floor(sleepRatio * s.hpMax)

    // San值：同上
    s.san = Math.floor(sleepRatio * s.sanMax)

    // 热情：(睡眠% × 0.4 + 吟唱% × 0.6) × 上限
    var passionRatio = sleepRatio * 0.4 + wakeDone * 0.6
    s.passion = Math.floor(passionRatio * s.passionMax)

    Wolf.saveDayData(data)
  }

  // 热情按节点进度消耗（到最后一个节点归零）
  Wolf.calcPassionProgress = function (data) {
    var nodes = data.nodes
    var totalNodes = nodes.length
    if (totalNodes === 0) return
    var doneCount = nodes.filter(function (n) { return n.done }).length
    // 已完成节点后面的节点中，热情线性下降
    // 当前热情 = 余量 × (剩余节点数 / 总节点数)
    var remaining = totalNodes - doneCount
    var s = data.stats
    s.passion = Math.max(0, Math.floor(s.passion * remaining / totalNodes))
    Wolf.saveDayData(data)
  }

  // ==================== 导航 ====================

  Wolf.goToBedroom = function () {
    Wolf.state.view = 'bedroom'
    Wolf.state.studyPhase = null
    Wolf.state.currentNodeId = null
    Wolf.render()
  }

  Wolf.navigateTo = function (view) {
    if (view === Wolf.state.view) return
    if (['computer-room','studio','gym','library'].includes(Wolf.state.view)) {
      if (Wolf.state.timer.intervalId) Wolf.stopTimer()
      Wolf.state.studyPhase = null
      Wolf.state.currentNodeId = null
    }
    Wolf.state.view = view
    Wolf.render()
  }

  // ==================== 计时器 ====================

  Wolf.startTimer = function () {
    if (Wolf.state.timer.intervalId) return
    Wolf.state.timer.intervalId = setInterval(function () {
      Wolf.state.timer.remaining -= 1
      if (Wolf.state.timer.remaining <= 0) {
        Wolf.state.timer.remaining = 0
        Wolf.stopTimer()
        Wolf.state.studyLog.endTime = Date.now()
        Wolf.state.studyPhase = 'post'
        Wolf.render()
        Wolf.showToast('⏰ 时间到！')
        return
      }
      const timerEl = document.querySelector('.timer-number')
      if (timerEl) {
        const mins = Math.floor(Wolf.state.timer.remaining / 60)
        const secs = Wolf.state.timer.remaining % 60
        timerEl.textContent = String(mins).padStart(2,'0') + ':' + String(secs).padStart(2,'0')
      }
    }, 1000)
  }

  Wolf.stopTimer = function () {
    if (Wolf.state.timer.intervalId) {
      clearInterval(Wolf.state.timer.intervalId)
      Wolf.state.timer.intervalId = null
    }
  }

  // ==================== 节点操作（积木系统） ====================

  // 生成唯一节点 ID
  Wolf._nextNodeId = function () {
    var data = Wolf.getDayData()
    var maxId = 0
    data.nodes.forEach(function (n) {
      var num = parseInt(n.id.replace('node-', ''))
      if (num > maxId) maxId = num
    })
    return 'node-' + (maxId + 1)
  }

  // 添加新节点（默认空节点，插在指定位置之后）
  Wolf.addNode = function (afterNodeId) {
    var data = Wolf.getDayData()
    var nodes = data.nodes
    var insertIdx = nodes.length

    if (afterNodeId) {
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].id === afterNodeId) { insertIdx = i + 1; break }
      }
    }

    // 默认值：E 级（15分钟），开始时间为插入位置后
    var defaultGrade = 'E'
    var grade = Wolf.DURATION_GRADES[defaultGrade]

    var newStart = '08:00'
    if (insertIdx > 0 && insertIdx <= nodes.length) {
      newStart = nodes[insertIdx - 1].endTime
    }
    var startMin = Wolf.timeStrToMinutes(newStart)
    var endMin = startMin + grade.minutes

    var newNode = {
      id: Wolf._nextNodeId(),
      startTime: newStart,
      endTime: Wolf.minutesToTimeStr(endMin),
      actionType: null,       // 空节点
      subtype: null,
      durationGrade: defaultGrade,
      durationMinutes: grade.minutes,
      count: 1,
      doneCount: 0,
      done: false,
      log: null,
    }

    // 重新计算之后节点的时间
    nodes.splice(insertIdx, 0, newNode)
    Wolf._recalculateTimes(nodes, insertIdx)
    Wolf.saveDayData(data)
    return newNode
  }

  // 删除节点
  Wolf.deleteNode = function (nodeId) {
    var data = Wolf.getDayData()
    var nodes = data.nodes
    var idx = -1
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id === nodeId) { idx = i; break }
    }
    if (idx === -1) return
    var deleted = nodes.splice(idx, 1)[0]
    if (idx < nodes.length) Wolf._recalculateTimes(nodes, idx)
    Wolf.saveDayData(data)
    return deleted
  }

  // 移动节点（direction: 'up' | 'down'）
  Wolf.moveNode = function (nodeId, direction) {
    var data = Wolf.getDayData()
    var nodes = data.nodes
    var idx = -1
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id === nodeId) { idx = i; break }
    }
    if (idx === -1) return

    var targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= nodes.length) return

    // 交换节点（保留时间属性，之后统一重算）
    var temp = nodes[idx]
    nodes[idx] = nodes[targetIdx]
    nodes[targetIdx] = temp

    // 重新计算时间
    Wolf._recalculateTimes(nodes, Math.min(idx, targetIdx))
    Wolf.saveDayData(data)
  }

  // 复制节点（在下方插入一个相同属性但为空的节点）
  Wolf.duplicateNode = function (nodeId) {
    var data = Wolf.getDayData()
    var node = Wolf.getNode(data, nodeId)
    if (!node) return
    var newNode = {
      id: Wolf._nextNodeId(),
      startTime: node.endTime,
      endTime: Wolf.minutesToTimeStr(Wolf.timeStrToMinutes(node.endTime) + node.durationMinutes * node.count),
      actionType: null,  // 复制的节点默认为空
      subtype: null,
      durationGrade: node.durationGrade,
      durationMinutes: node.durationMinutes,
      count: node.count,
      doneCount: 0,
      done: false,
      log: null,
    }
    var idx = -1
    for (var i = 0; i < data.nodes.length; i++) {
      if (data.nodes[i].id === nodeId) { idx = i; break }
    }
    data.nodes.splice(idx + 1, 0, newNode)
    Wolf._recalculateTimes(data.nodes, idx + 1)
    Wolf.saveDayData(data)
    return newNode
  }

  // 清空当日所有节点
  Wolf.clearAllNodes = function () {
    var data = Wolf.getDayData()
    data.nodes = []
    Wolf.saveDayData(data)
  }

  // 加载预设（替换当前节点列表）
  Wolf.loadPresetNodes = function (preset) {
    var data = Wolf.getDayData()
    data.nodes = Wolf.generateNodesFromPreset(preset || Wolf.DEFAULT_PRESET)
    data.preset = preset || Wolf.DEFAULT_PRESET
    Wolf.saveDayData(data)
  }

  // 设置节点行动类型
  Wolf.setNodeAction = function (nodeId, actionType, subtype) {
    var data = Wolf.getDayData()
    var node = Wolf.getNode(data, nodeId)
    if (!node) return
    node.actionType = actionType
    node.subtype = subtype || null
    Wolf.saveDayData(data)
  }

  // 重新计算从某索引开始所有节点的开始/结束时间
  Wolf._recalculateTimes = function (nodes, fromIdx) {
    if (fromIdx === 0) {
      var first = nodes[0]
      if (!first) return
      var firstStart = Wolf.timeStrToMinutes(first.startTime)
      first.endTime = Wolf.minutesToTimeStr(firstStart + first.durationMinutes * first.count)
    }
    for (var i = fromIdx; i < nodes.length; i++) {
      var prev = i > 0 ? nodes[i - 1] : null
      var cur = nodes[i]
      if (prev) {
        cur.startTime = prev.endTime
      }
      var startMin = Wolf.timeStrToMinutes(cur.startTime)
      cur.endTime = Wolf.minutesToTimeStr(startMin + cur.durationMinutes * cur.count)
    }
  }

  // ==================== 三树操作 ====================

  // 确保三树已加载（供结算时调用）
  Wolf._ensureTreesLoaded = function (callback) {
    if (Wolf.state.trees) { callback(); return }
    Wolf.loadTrees().then(function (trees) {
      Wolf.state.trees = trees
      callback()
    })
  }

  // 知识树：添加知识条目
  Wolf.addKnowledgeEntry = function (domain, branch, entryData) {
    var trees = Wolf.state.trees
    if (!trees) return
    if (!trees.knowledge.domains[domain]) trees.knowledge.domains[domain] = { icon: '📁', branches: {} }
    if (!trees.knowledge.domains[domain].branches[branch]) trees.knowledge.domains[domain].branches[branch] = { entries: [] }
    trees.knowledge.domains[domain].branches[branch].entries.push({
      id: 'k' + Date.now(),
      title: entryData.title || '',
      content: entryData.content || '',
      source: entryData.source || '',
      createdAt: new Date().toISOString(),
    })
    Wolf.saveTrees(trees)
  }

  // 知识树：添加灵感
  Wolf.addInspiration = function (content) {
    var trees = Wolf.state.trees
    if (!trees) return
    trees.knowledge.inspirationPool.push({
      id: 'i' + Date.now(),
      content: content,
      date: Wolf.todayStr(),
      timestamp: Date.now(),
    })
    Wolf.saveTrees(trees)
  }

  // 技能树：增加经验（同时记录文本条目）
  Wolf.addSkillExp = function (skillId, amount, note) {
    var trees = Wolf.state.trees
    if (!trees || !trees.skills[skillId]) return
    var skill = trees.skills[skillId]
    skill.exp += amount
    // 记录训练条目
    skill.log.push({
      id: 's' + Date.now(),
      date: Wolf.todayStr(),
      content: note || '',
      expGained: amount,
      createdAt: Date.now(),
    })
    var nextExp = Wolf.skillExpToNext(skill.level)
    while (skill.exp >= nextExp) {
      skill.exp -= nextExp
      skill.level += 1
      nextExp = Wolf.skillExpToNext(skill.level)
      Wolf.showToast('🎯 ' + skill.name + ' 升级！Lv.' + skill.level + '！')
    }
    Wolf.saveTrees(trees)
  }

  // 通用：删除三树条目
  Wolf.deleteTreeEntry = function (treeType, path, entryId) {
    var trees = Wolf.state.trees
    if (!trees) return
    var arr = Wolf._resolveTreePath(trees, treeType, path)
    if (!arr) return
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === entryId) { arr.splice(i, 1); break }
    }
    Wolf.saveTrees(trees)
  }

  // 通用：更新三树条目文本
  Wolf.updateTreeEntry = function (treeType, path, entryId, updates) {
    var trees = Wolf.state.trees
    if (!trees) return
    var arr = Wolf._resolveTreePath(trees, treeType, path)
    if (!arr) return
    var entry = arr.find(function (e) { return e.id === entryId })
    if (!entry) return
    Object.keys(updates).forEach(function (k) { entry[k] = updates[k] })
    Wolf.saveTrees(trees)
  }

  // 路径解析辅助
  Wolf._resolveTreePath = function (trees, treeType, path) {
    if (treeType === 'knowledge') {
      // path: 'domain|branch'
      var parts = path.split('|')
      var dom = trees.knowledge.domains[parts[0]]
      if (!dom) return null
      if (parts[1]) {
        var br = dom.branches[parts[1]]
        return br ? br.entries : null
      }
      return dom.entries || null
    }
    if (treeType === 'inspiration') return trees.knowledge.inspirationPool
    if (treeType === 'skill') {
      // path: skillId
      var sk = trees.skills[path]
      return sk ? sk.log : null
    }
    if (treeType === 'experience') {
      // path: type (reading/movie/game/other)
      return trees.experience[path] || null
    }
    return null
  }

  // 阅历树：添加记录
  Wolf.addExperienceEntry = function (type, entryData) {
    var trees = Wolf.state.trees
    if (!trees || !trees.experience[type]) return
    trees.experience[type].push({
      id: 'e' + Date.now(),
      title: entryData.title || '',
      note: entryData.note || '',
      date: Wolf.todayStr(),
      rating: entryData.rating || 0,
      createdAt: Date.now(),
    })
    Wolf.saveTrees(trees)
  }

  // ==================== 任务系统 ====================

  // 检查并自动完成每日任务
  Wolf.checkAndAutoCompleteTasks = function (data) {
    var tasks = data.stats.dailyTasks
    if (!tasks || !tasks.length) return
    var nodes = data.nodes
    var changed = false

    tasks.forEach(function (task) {
      if (!task.autoComplete || task.claimed) return
      var met = Wolf.checkTaskCondition(task, nodes)
      if (met && !task.completed) {
        task.completed = true
        changed = true
        Wolf.showToast('📋 任务「' + task.name + '」已完成！去任务页领取奖励～')
      }
    })

    if (changed) Wolf.saveDayData(data)
  }

  // 领取任务奖励
  Wolf.claimTaskReward = function (data, taskId) {
    var tasks = data.stats.dailyTasks
    var task = tasks.find(function (t) { return t.id === taskId })
    if (!task || !task.completed || task.claimed) return null

    task.claimed = true
    // 发放奖励
    var reward = task.reward
    if (reward.survivalExp) Wolf._addAbilityExp(data.stats, 'survival', reward.survivalExp)
    if (reward.healthExp) Wolf._addAbilityExp(data.stats, 'health', reward.healthExp)
    if (reward.focusExp) Wolf._addAbilityExp(data.stats, 'focus', reward.focusExp)
    if (reward.faithExp) Wolf._addAbilityExp(data.stats, 'faith', reward.faithExp)

    Wolf.saveDayData(data)
    return reward
  }

  // 撤销节点完成
  Wolf.undoNode = function (nodeId) {
    var data = Wolf.getDayData()
    var node = Wolf.getNode(data, nodeId)
    if (!node || !node.done) return false

    var log = node.log
    var result = null

    // 从 log 中提取结算结果
    if (log && log.settlementResult) {
      result = log.settlementResult
    }
    if (!result) return false

    // 反结算——状态值
    var s = data.stats
    if (result.hpDelta) s.hp = Math.max(0, Math.min(s.hpMax, s.hp - result.hpDelta))
    if (result.sanDelta) s.san = Math.max(0, Math.min(s.sanMax, s.san - result.sanDelta))
    if (result.passionDelta) s.passion = Math.max(0, Math.min(s.passionMax, s.passion - result.passionDelta))
    // 反结算——能力经验
    if (result.survivalExp) s.survivalExp = Math.max(0, s.survivalExp - result.survivalExp)
    if (result.healthExp) s.healthExp = Math.max(0, s.healthExp - result.healthExp)
    if (result.focusExp) s.focusExp = Math.max(0, s.focusExp - result.focusExp)
    if (result.faithExp) s.faithExp = Math.max(0, s.faithExp - result.faithExp)

    // 重置节点状态
    node.done = false
    node.doneCount = 0
    node.log = null

    // 记录撤销日志
    Wolf.saveLog({
      type: 'undo_node',
      actionType: node.actionType,
      subtype: node.subtype || '',
      result: result,
    })

    Wolf.saveDayData(data)
    return true
  }

  Wolf.recordLog = async function (type, detail) {
    const data = Wolf.getDayData()
    await Wolf.saveLog({
      type: type,
      nodeId: Wolf.state.currentNodeId,
      actionType: detail.actionType || '',
      subtype: detail.subtype || '',
      result: detail.result || {},
      notes: detail.notes || '',
      statsAfter: { ...data.stats },
    })
  }

  window.Wolf = Wolf
})()
