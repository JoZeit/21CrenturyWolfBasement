/* ============================================================
   wolf-views.js v2.1 — 视图渲染引擎（横屏游戏风适配版）
   ============================================================ */

;(function () {
  if (!window.Wolf) window.Wolf = {}

  // ==================== 主渲染入口 ====================
  Wolf.render = function () {
    var data = Wolf.getDayData()

    // 更新顶部栏
    Wolf._updateHeader(data)
    // 更新看板娘
    Wolf._updateMascot()
    // 更新底部导航
    Wolf._updateFooter()

    // 渲染内容区
    var zone = document.getElementById('content-zone')
    if (!zone) return

    var html = Wolf._renderStatsBar(data)

    switch (Wolf.state.view) {
      case 'bedroom':       html += Wolf.renderBedroom(data); break
      case 'computer-room': html += Wolf.renderComputerRoom(data); break
      case 'studio':        html += Wolf.renderStudio(data); break
      case 'gym':           html += Wolf.renderGym(data); break
      case 'library':       html += Wolf.renderLibrary(data); break
      case 'rooms':         html += Wolf.renderRoomList(); break
      case 'stats-panel':   html += Wolf.renderStatsPanel(data); break
      case 'logs':          html += '<div class="room-header"><h2>📋 操作日志</h2></div><div class="study-panel" id="log-container"><p style="text-align:center;color:var(--text-muted);padding:30px 0;">加载中...</p></div>'; break
      case 'reports':       html += '<div class="room-header"><h2>📊 报表</h2></div><div class="study-panel" id="report-container"><p style="text-align:center;color:var(--text-muted);padding:30px 0;">加载中...</p></div>'; break
      case 'tasks':        html += Wolf.renderTasks(data); break
      case 'trees':        html += Wolf.renderTrees(); break
      default:              html += Wolf.renderBedroom(data)
    }

    zone.innerHTML = html
    Wolf.bindEvents()

    // 异步视图
    if (Wolf.state.view === 'logs') Wolf._renderLogsAsync()
    if (Wolf.state.view === 'reports') Wolf._renderReportsAsync()
    if (Wolf.state.view === 'trees') Wolf._renderTreesAsync()
  }

  // ==================== 更新顶部栏 ====================
  Wolf._updateHeader = function (data) {
    var s = data.stats
    var dateEl = document.getElementById('gh-date')
    var levelEl = document.getElementById('gh-level')
    var expEl = document.getElementById('gh-exp')
    if (dateEl) dateEl.textContent = Wolf.todayDisplay()
    if (levelEl) levelEl.textContent = 'Lv.' + s.survivalLevel
    if (expEl) expEl.textContent = '✨ ' + s.survivalExp + '/' + Wolf.expToNextLevel('survival', s.survivalLevel)
  }

  // ==================== 更新看板娘 ====================
  Wolf._updateMascot = function () {
    var dialogEl = document.getElementById('dialog-text')
    if (dialogEl) {
      Wolf.state._currentQuote = Wolf.randomQuote()
      dialogEl.textContent = Wolf.state._currentQuote
    }
  }

  // ==================== 更新底部导航激活态 ====================
  Wolf._updateFooter = function () {
    var footer = document.getElementById('game-footer')
    if (!footer) return
    var items = footer.querySelectorAll('.ft-nav-item')
    items.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.view === Wolf.state.view)
    })
  }

  // ==================== 跳转到当前时间节点 ====================
  Wolf.gotoCurrentNode = function () {
    // 先确保在卧室视图
    if (Wolf.state.view !== 'bedroom') {
      if (Wolf.state.timer.intervalId) { Wolf.stopTimer() }
      Wolf.state.view = 'bedroom'
      Wolf.state.studyPhase = null
      Wolf.render()
    }

    setTimeout(function () {
      var data = Wolf.getDayData()
      var nodes = data.nodes
      var now = new Date()
      var nowMinutes = now.getHours() * 60 + now.getMinutes()
      var targetId = null

      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i]
        var grade = Wolf.DURATION_GRADES[n.durationGrade]
        var startMin = Wolf.timeStrToMinutes(n.startTime)
        var endMin = startMin + n.count * grade.minutes
        if (nowMinutes >= startMin && nowMinutes < endMin) {
          targetId = n.id
          break
        }
      }

      if (!targetId) {
        for (var j = 0; j < nodes.length; j++) {
          var nn = nodes[j]
          var sm = Wolf.timeStrToMinutes(nn.startTime)
          if (sm > nowMinutes) { targetId = nn.id; break }
        }
      }

      if (targetId) {
        var el = document.querySelector('.node-card[data-node-id="' + targetId + '"]')
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.style.transition = 'all .15s'
          el.style.boxShadow = '0 0 20px var(--fire-glow)'
          el.style.borderColor = 'var(--fire)'
          setTimeout(function () {
            el.style.boxShadow = ''
            el.style.borderColor = ''
          }, 1500)
        }
      } else {
        Wolf.showToast('📍 没有后续节点了')
      }
    }, 200)
  }

  // ==================== 紧凑统计条（状态值） ====================
  Wolf._renderStatsBar = function (data) {
    var s = data.stats
    return '\
      <div class="stats-bar-h">\
        <div class="stat-mini">\
          <span class="stat-mini-icon">❤️</span>\
          <div class="stat-mini-body">\
            <div class="stat-mini-label"><span>体力</span><span class="stat-mini-val">' + s.hp + '/' + s.hpMax + '</span></div>\
            <div class="stat-mini-track"><div class="stat-mini-fill hp" style="width:' + (s.hp/s.hpMax*100).toFixed(0) + '%"></div></div>\
          </div>\
        </div>\
        <div class="stat-mini">\
          <span class="stat-mini-icon">💙</span>\
          <div class="stat-mini-body">\
            <div class="stat-mini-label"><span>San值</span><span class="stat-mini-val">' + s.san + '/' + s.sanMax + '</span></div>\
            <div class="stat-mini-track"><div class="stat-mini-fill san" style="width:' + (s.san/s.sanMax*100).toFixed(0) + '%"></div></div>\
          </div>\
        </div>\
        <div class="stat-mini">\
          <span class="stat-mini-icon">💗</span>\
          <div class="stat-mini-body">\
            <div class="stat-mini-label"><span>热情</span><span class="stat-mini-val">' + s.passion + '/' + s.passionMax + '</span></div>\
            <div class="stat-mini-track"><div class="stat-mini-fill passion" style="width:' + (s.passion/s.passionMax*100).toFixed(0) + '%"></div></div>\
          </div>\
        </div>\
      </div>\
      <div class="exp-bar-full">\
        <span class="stat-mini-icon">✨</span>\
        <div class="stat-mini-body">\
          <div class="stat-mini-label"><span>生存经验</span><span class="stat-mini-val">' + s.survivalExp + '/' + Wolf.expToNextLevel('survival', s.survivalLevel) + '</span></div>\
          <div class="stat-mini-track"><div class="stat-mini-fill exp" style="width:' + (s.survivalExp / Wolf.expToNextLevel('survival', s.survivalLevel) * 100).toFixed(0) + '%"></div></div>\
        </div>\
      </div>'
  }

  // ==================== 卧室：积木式节点列表 ====================
  Wolf.renderBedroom = function (data) {
    var nodes = data.nodes
    var totalDone = nodes.reduce(function (s, n) { return s + n.doneCount }, 0)
    var totalCount = nodes.reduce(function (s, n) { return s + n.count }, 0)
    var now = new Date()
    var nowMinutes = now.getHours() * 60 + now.getMinutes()

    // 工具栏
    var html = '\
      <div class="room-header">\
        <h2>🏠 卧室</h2>\
        <span class="room-subtitle">' + totalDone + '/' + totalCount + '</span>\
      </div>\
      <div class="node-toolbar">\
        <button class="btn btn-sm btn-outline" data-action="add-node" title="添加空节点">+ 添加节点</button>\
        <button class="btn btn-sm btn-outline" data-action="load-preset" title="加载默认预设">📋 加载预设</button>\
        <button class="btn btn-sm btn-outline" data-action="goto-now" title="跳转到当前时间节点" style="color:var(--fire);">📍 现在</button>\
        ' + (nodes.length > 0 ? '<button class="btn btn-sm btn-outline" data-action="clear-day" title="清空当日节点" style="color:var(--hp);">🗑️ 清空</button>' : '') + '\
      </div>\
      <div class="node-list">'

    if (nodes.length === 0) {
      html += '\
        <div class="node-empty-hint">\
          <div class="empty-icon">🧩</div>\
          <div class="empty-title">今天还没有节点</div>\
          <div class="empty-desc">点击上方「添加节点」开始搭建你的一天<br>或者「加载预设」使用默认时间表</div>\
        </div>'
    }

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i]
      var action = Wolf.getAction(node)  // null for empty nodes
      var isEmpty = !action

      var isCurrent = Wolf.state.currentNodeId === node.id
      var fullyDone = node.done
      var partiallyDone = !fullyDone && node.doneCount > 0
      var grade = Wolf.DURATION_GRADES[node.durationGrade]

      var startMin = Wolf.timeStrToMinutes(node.startTime)
      var endMin = startMin + node.count * grade.minutes
      var isActiveNow = nowMinutes >= startMin && nowMinutes < endMin

      var subtypeLabel = node.subtype && action ? ' · ' + node.subtype : ''
      var countLabel = node.count > 1 ? ' ×' + node.count : ''
      var gradeLabel = grade.label

      // 状态标识
      var statusHTML = ''
      if (fullyDone) {
        statusHTML = '<span class="node-status-done">✅</span>'
      } else if (partiallyDone) {
        statusHTML = '<span class="node-status-progress">' + node.doneCount + '/' + node.count + '</span>'
      } else if (isCurrent) {
        statusHTML = '<span class="node-status-active">▶ 进行中</span>'
      } else if (isActiveNow && !isEmpty) {
        statusHTML = '<span class="node-status-now">📍 当前时段</span>'
      } else if (isEmpty) {
        statusHTML = '<span class="node-status-empty">⬡ 待填充</span>'
      } else {
        statusHTML = '<span class="node-status-pending">→</span>'
      }

      var cardClass = 'node-card'
      if (fullyDone) cardClass += ' done'
      if (isCurrent) cardClass += ' current'
      if (isActiveNow && !fullyDone) cardClass += ' active-now'
      if (isEmpty && !fullyDone) cardClass += ' empty-slot'

      html += '\
        <div class="' + cardClass + '" data-node-id="' + node.id + '" data-action="click-node" draggable="true" data-node-index="' + i + '">\
          <div class="node-icon">' + (isEmpty ? '➕' : action.icon) + '</div>\
          <div class="node-info">\
            <div class="node-name">' + (isEmpty ? '<em style="color:var(--text-muted);">空槽位 — 点击选择行动</em>' : action.name + subtypeLabel + countLabel) + '</div>\
            <div class="node-time">' + node.startTime + ' - ' + node.endTime + ' · ' + gradeLabel + '级(' + grade.minutes + 'min)</div>\
          </div>\
          ' + statusHTML + '\
          <div class="node-actions-row">\
            ' + (i > 0 ? '<button class="node-move-btn" data-action="move-node" data-node-id="' + node.id + '" data-direction="up" title="上移">▲</button>' : '<span class="node-move-spacer"></span>') + '\
            ' + (i < nodes.length - 1 ? '<button class="node-move-btn" data-action="move-node" data-node-id="' + node.id + '" data-direction="down" title="下移">▼</button>' : '<span class="node-move-spacer"></span>') + '\
            ' + (!fullyDone ? '<button class="node-edit-btn" data-action="edit-node" data-node-id="' + node.id + '" title="编辑">⚙</button>' : '<span class="node-move-spacer"></span>') + '\
            ' + (!fullyDone ? '<button class="node-delete-btn" data-action="delete-node" data-node-id="' + node.id + '" title="删除">✕</button>' : '<span class="node-move-spacer"></span>') + '\
            ' + (fullyDone ? '<button class="node-undo-btn" data-action="undo-node" data-node-id="' + node.id + '" title="撤销完成">↩</button>' : '<span class="node-move-spacer"></span>') + '\
          </div>\
        </div>'
    }

    html += '</div>'
    return html
  }

  // ==================== 电脑房 ====================
  Wolf.renderComputerRoom = function (data) {
    var html = '\
      <div class="room-header">\
        <button class="room-back-btn" data-action="back-bedroom">← 返回</button>\
        <h2>🖥️ 电脑房</h2>\
      </div>\
      <div class="study-container">'

    switch (Wolf.state.studyPhase) {
      case 'pre':        html += Wolf._renderStudyPre(); break
      case 'timing':     html += Wolf._renderStudyTiming(); break
      case 'post':       html += Wolf._renderStudyPost(); break
      case 'settlement': html += Wolf._renderStudySettlement(); break
      default:
        Wolf.state.studyPhase = 'pre'
        html += Wolf._renderStudyPre()
    }
    html += '</div>'
    return html
  }

  Wolf._renderStudyPre = function () {
    var log = Wolf.state.studyLog
    return '\
      <div class="study-panel">\
        <h3>📝 学习前记录</h3>\
        <div class="form-group">\
          <label>学习领域</label>\
          <input type="text" id="study-field" placeholder="例如：前端开发、日语、钢琴..." value="' + Wolf.escHtml(log.field) + '">\
        </div>\
        <div class="form-group">\
          <label>学习材料</label>\
          <select id="study-material">\
            <option value="yes"' + (log.hasMaterial==='yes'?' selected':'') + '>有（已确定的学习材料）</option>\
            <option value="no"' + (log.hasMaterial==='no'?' selected':'') + '>无（消耗双倍San值）</option>\
          </select>\
        </div>\
        <div class="form-group">\
          <label>材料链接/说明</label>\
          <input type="text" id="study-material-detail" placeholder="粘贴链接或描述材料" value="' + Wolf.escHtml(log.materialDetail) + '">\
        </div>\
        <div class="form-group">\
          <label>学习前留言（目标/心情）</label>\
          <textarea id="study-pre-msg" rows="3" placeholder="今天要学什么？写下来给自己看...">' + Wolf.escHtml(log.preMessage) + '</textarea>\
        </div>\
        <button class="btn btn-primary btn-block btn-lg" data-action="start-study">🚀 开始计时学习</button>\
      </div>'
  }

  Wolf._renderStudyTiming = function () {
    var r = Wolf.state.timer.remaining
    var display = String(Math.floor(r/60)).padStart(2,'0') + ':' + String(r%60).padStart(2,'0')
    return '\
      <div class="study-panel">\
        <h3>⏰ 学习中…</h3>\
        <div class="timer-display">\
          <div class="timer-number">' + display + '</div>\
          <div class="timer-status">专注时间 · 心无旁骛</div>\
        </div>\
        <div class="timer-controls">\
          <button class="btn btn-danger" data-action="end-study-early">⏹ 结束节点</button>\
        </div>\
      </div>'
  }

  Wolf._renderStudyPost = function () {
    var log = Wolf.state.studyLog
    var showCheck = log.hasMaterial === 'no'
    return '\
      <div class="study-panel">\
        <h3>📝 学习后记录</h3>\
        <div class="form-group">\
          <label>学习存档（笔记/截图/过程资料）</label>\
          <textarea id="study-archive" rows="3" placeholder="粘贴笔记或记录重点...">' + Wolf.escHtml(log.archive) + '</textarea>\
        </div>\
        <div class="form-group">\
          <label>知识更新（学到了什么？一行一条）</label>\
          <textarea id="study-knowledge" rows="3" placeholder="输入学到的新知识，每行一条...">' + Wolf.escHtml(log.knowledge) + '</textarea>\
        </div>\
        ' + (showCheck ? '\
        <div class="form-group" style="background:var(--hp-bg);padding:10px;border-radius:var(--radius-sm);">\
          <label style="color:var(--hp);">⚠️ 电子产品自查检验</label>\
          <p style="font-size:12px;color:var(--text-dim);margin-bottom:8px;">本次学习没有提前准备材料，请诚实检查：是否有错误使用电子产品的情况？</p>\
          <select id="study-selfcheck">\
            <option value="no">没有，一直在学习</option>\
            <option value="yes">有，分心刷手机了</option>\
          </select>\
        </div>' : '') + '\
        <div class="form-group">\
          <label>学习后留言（碎碎念/感想）</label>\
          <textarea id="study-post-msg" rows="2" placeholder="学完了，感觉怎么样？">' + Wolf.escHtml(log.postMessage) + '</textarea>\
        </div>\
        <button class="btn btn-accent btn-block btn-lg" data-action="settle-study">💰 结算本次学习</button>\
      </div>'
  }

  Wolf._renderStudySettlement = function () {
    // 新 v3 结算在确认时直接计算，这里只显示占位
    return '\
      <div class="settlement">\
        <h3>📊 结算确认</h3>\
        <p style="text-align:center;color:var(--text-dim);padding:16px 0;">根据学习记录计算得分...<br>完成后显示完成度评分</p>\
        <button class="btn btn-success btn-block settlement-btn" data-action="confirm-settlement">💰 确认结算</button>\
      </div>'
  }

  // ==================== 画室 ====================
  Wolf.renderStudio = function (data) {
    var log = Wolf.state.tempLog
    var TYPES = [
      { id:'drawing',icon:'🎨',name:'画画' },{ id:'singing',icon:'🎤',name:'练歌' },
      { id:'dance',icon:'💃',name:'跳舞' },{ id:'language',icon:'🗣️',name:'语言训练' },
    ]
    var html = '\
      <div class="room-header">\
        <button class="room-back-btn" data-action="back-bedroom">← 返回</button>\
        <h2>🎨 画室</h2>\
      </div>\
      <div class="study-container">\
        <div class="study-panel">\
          <h3>选择实践类型</h3>\
          <div class="practice-options">'
    for (var i = 0; i < TYPES.length; i++) {
      var t = TYPES[i]
      html += '\
            <div class="practice-option' + (log.practiceType===t.id?' selected':'') + '" data-action="select-practice" data-value="' + t.id + '">\
              <span class="po-icon">' + t.icon + '</span>' + t.name + '</div>'
    }
    html += '\
          </div>\
          <div class="form-group">\
            <label>训练心得</label>\
            <textarea id="practice-note" rows="3" placeholder="记录今天的练习感受...">' + Wolf.escHtml(log.practiceNote) + '</textarea>\
          </div>\
          <button class="btn btn-primary btn-block btn-lg" data-action="settle-practice">💰 结算</button>\
        </div></div>'
    return html
  }

  // ==================== 健身房 ====================
  Wolf.renderGym = function (data) {
    var log = Wolf.state.tempLog
    var TYPES = [
      { id:'run',icon:'🏃',name:'跑步' },{ id:'strength',icon:'💪',name:'力量训练' },
      { id:'ball',icon:'⚽',name:'球类' },{ id:'other',icon:'🤸',name:'其他' },
    ]
    var html = '\
      <div class="room-header">\
        <button class="room-back-btn" data-action="back-bedroom">← 返回</button>\
        <h2>🏃 健身房</h2>\
      </div>\
      <div class="study-container">\
        <div class="study-panel">\
          <h3>选择运动类型</h3>\
          <div class="practice-options">'
    for (var i = 0; i < TYPES.length; i++) {
      var t = TYPES[i]
      html += '\
            <div class="practice-option' + (log.exerciseType===t.id?' selected':'') + '" data-action="select-exercise" data-value="' + t.id + '">\
              <span class="po-icon">' + t.icon + '</span>' + t.name + '</div>'
    }
    html += '\
          </div>\
          <div class="form-group">\
            <label>运动时长（分钟）</label>\
            <input type="number" id="exercise-duration" placeholder="30" value="' + log.exerciseDuration + '" min="1">\
          </div>\
          <button class="btn btn-primary btn-block btn-lg" data-action="settle-exercise">💰 结算</button>\
        </div></div>'
    return html
  }

  // ==================== 书房 ====================
  Wolf.renderLibrary = function (data) {
    var log = Wolf.state.tempLog
    var TYPES = [
      { id:'reading',icon:'📚',name:'阅读' },{ id:'movie',icon:'🎬',name:'观影' },{ id:'game',icon:'🎮',name:'游戏' },
    ]
    var html = '\
      <div class="room-header">\
        <button class="room-back-btn" data-action="back-bedroom">← 返回</button>\
        <h2>📖 书房</h2>\
      </div>\
      <div class="study-container">\
        <div class="study-panel">\
          <h3>选择类型</h3>\
          <div class="practice-options">'
    for (var i = 0; i < TYPES.length; i++) {
      var t = TYPES[i]
      html += '\
            <div class="practice-option' + (log.expType===t.id?' selected':'') + '" data-action="select-exp" data-value="' + t.id + '">\
              <span class="po-icon">' + t.icon + '</span>' + t.name + '</div>'
    }
    html += '\
          </div>\
          <div class="form-group">\
            <label>作品名称</label>\
            <input type="text" id="exp-title" placeholder="输入名称" value="' + Wolf.escHtml(log.expTitle) + '">\
          </div>\
          <div class="form-group">\
            <label>感想 / 记录</label>\
            <textarea id="exp-note" rows="3" placeholder="写点什么吧...">' + Wolf.escHtml(log.expNote) + '</textarea>\
          </div>\
          <button class="btn btn-primary btn-block btn-lg" data-action="settle-exp">💰 结算</button>\
        </div></div>'
    return html
  }

  // ==================== 房间列表 ====================
  Wolf.renderRoomList = function () {
    var rooms = [
      { id:'bedroom',icon:'🏠',name:'卧室',desc:'查看今日节点' },
      { id:'computer-room',icon:'🖥️',name:'电脑房',desc:'专注学习' },
      { id:'studio',icon:'🎨',name:'画室',desc:'自主实践' },
      { id:'gym',icon:'🏃',name:'健身房',desc:'体育锻炼' },
      { id:'library',icon:'📖',name:'书房',desc:'增长阅历' },
    ]
    var html = '<div class="room-header"><h2>🗺️ 房间列表</h2></div><div class="room-grid">'
    for (var i = 0; i < rooms.length; i++) {
      var r = rooms[i]
      html += '\
        <div class="room-card" data-action="goto-room" data-room="' + r.id + '">\
          <span class="rc-icon">' + r.icon + '</span>\
          <div class="rc-name">' + r.name + '</div>\
          <div class="rc-desc">' + r.desc + '</div>\
        </div>'
    }
    html += '</div>'
    return html
  }

  // ==================== 数值面板 ====================
  Wolf.renderStatsPanel = function (data) {
    var s = data.stats
    var survNext = Wolf.expToNextLevel('survival', s.survivalLevel)
    return '\
      <div class="room-header"><h2>📊 个人数值</h2></div>\
      <div class="stats-panel">\
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;letter-spacing:2px;">—— 状态值（每日波动） ——</div>\
        <div class="stat-card">\
          <div class="stat-card-header">\
            <span class="sc-name">❤️ 体力</span>\
            <span class="sc-value hp">' + s.hp + '/' + s.hpMax + '</span>\
          </div>\
          <div class="stat-track"><div class="stat-fill hp" style="width:' + (s.hp/s.hpMax*100).toFixed(0) + '%"></div></div>\
          <div class="stat-desc">睡眠恢复 · 进食补充 · 锻炼2×消耗 · 学习1×消耗</div>\
          <button class="btn btn-outline btn-sm" data-action="edit-stat" data-stat="hp" style="margin-top:8px;font-size:12px;">✏️</button>\
        </div>\
        <div class="stat-card">\
          <div class="stat-card-header">\
            <span class="sc-name">💙 San值</span>\
            <span class="sc-value san">' + s.san + '/' + s.sanMax + '</span>\
          </div>\
          <div class="stat-track"><div class="stat-fill san" style="width:' + (s.san/s.sanMax*100).toFixed(0) + '%"></div></div>\
          <div class="stat-desc">睡眠恢复 · 学习消耗 · 决策难度倍率</div>\
          <button class="btn btn-outline btn-sm" data-action="edit-stat" data-stat="san" style="margin-top:8px;font-size:12px;">✏️</button>\
        </div>\
        <div class="stat-card">\
          <div class="stat-card-header">\
            <span class="sc-name">💗 热情</span>\
            <span class="sc-value passion">' + s.passion + '/' + s.passionMax + '</span>\
          </div>\
          <div class="stat-track"><div class="stat-fill passion" style="width:' + (s.passion/s.passionMax*100).toFixed(0) + '%"></div></div>\
          <div class="stat-desc">(睡眠%×0.4 + 吟唱%×0.6)×上限 · 随进度消耗</div>\
          <button class="btn btn-outline btn-sm" data-action="edit-stat" data-stat="passion" style="margin-top:8px;font-size:12px;">✏️</button>\
        </div>\
        <div style="font-size:12px;color:var(--text-muted);margin:8px 0;letter-spacing:2px;">—— 能力值（累积升级） ——</div>\
        <div class="stat-card">\
          <div class="stat-card-header">\
            <span class="sc-name">⬆️ 生存等级 Lv.' + s.survivalLevel + '</span>\
            <span class="sc-value" style="color:var(--fire);">✨' + s.survivalExp + '/' + survNext + '</span>\
          </div>\
          <div class="stat-track"><div class="stat-fill exp" style="width:' + (s.survivalExp/survNext*100).toFixed(0) + '%"></div></div>\
          <div class="stat-desc">综合经验。完成节点和任务获得。</div>\
        </div>\
        <div class="stat-card">\
          <div class="stat-card-header">\
            <span class="sc-name">🏥 健康 Lv.' + s.healthLevel + ' → 体力上限+' + ((s.healthLevel-1)*10) + '</span>\
            <span class="sc-value hp">' + s.healthExp + '/' + Wolf.expToNextLevel('health',s.healthLevel) + '</span>\
          </div>\
          <div class="stat-track"><div class="stat-fill hp" style="width:' + (s.healthExp/Wolf.expToNextLevel('health',s.healthLevel)*100).toFixed(0) + '%"></div></div>\
          <div class="stat-desc">锻炼完成获得健康经验</div>\
        </div>\
        <div class="stat-card">\
          <div class="stat-card-header">\
            <span class="sc-name">🧠 专注力 Lv.' + s.focusLevel + ' → San上限+' + ((s.focusLevel-1)*10) + '</span>\
            <span class="sc-value san">' + s.focusExp + '/' + Wolf.expToNextLevel('focus',s.focusLevel) + '</span>\
          </div>\
          <div class="stat-track"><div class="stat-fill san" style="width:' + (s.focusExp/Wolf.expToNextLevel('focus',s.focusLevel)*100).toFixed(0) + '%"></div></div>\
          <div class="stat-desc">深度学习获得专注经验</div>\
        </div>\
        <div class="stat-card">\
          <div class="stat-card-header">\
            <span class="sc-name">🔥 信念 Lv.' + s.faithLevel + ' → 热情上限+' + ((s.faithLevel-1)*10) + '</span>\
            <span class="sc-value passion">' + s.faithExp + '/' + Wolf.expToNextLevel('faith',s.faithLevel) + '</span>\
          </div>\
          <div class="stat-track"><div class="stat-fill passion" style="width:' + (s.faithExp/Wolf.expToNextLevel('faith',s.faithLevel)*100).toFixed(0) + '%"></div></div>\
          <div class="stat-desc">认真记录获得信念经验</div>\
        </div>\
        <div style="text-align:center;margin-top:12px;">\
          <button class="btn btn-outline btn-sm" data-action="reset-stats" style="font-size:12px;color:var(--hp);margin-right:6px;">🔄 初始化数值</button>\
          <button class="btn btn-outline btn-sm" data-action="nav-to" data-view="tasks" style="font-size:12px;">📋 每日任务</button>\
        </div>\
      </div>'
  }

  // ==================== 日志视图（日报总结） ====================
  Wolf._renderLogsAsync = async function () {
    var container = document.getElementById('log-container')
    if (!container) return

    // 用当天数据直接生成日报
    var data = Wolf.getDayData()
    var nodes = data.nodes
    var s = data.stats

    var totalNodes = nodes.length
    var doneNodes = nodes.filter(function (n) { return n.done }).length
    var failedNodes = nodes.filter(function (n) { return n.done && n.log && n.log.completionScore !== undefined && n.log.completionScore < 60 }).length
    var passedNodes = doneNodes - failedNodes
    var emptyNodes = nodes.filter(function (n) { return !n.actionType }).length

    // 按类型统计
    var typeStats = {}
    nodes.forEach(function (n) {
      if (!n.done || !n.actionType) return
      var key = n.actionType + (n.subtype ? '|' + n.subtype : '')
      if (!typeStats[key]) typeStats[key] = { count: 0, totalScore: 0, scored: 0 }
      typeStats[key].count++
      if (n.log && n.log.completionScore !== undefined) {
        typeStats[key].totalScore += n.log.completionScore
        typeStats[key].scored++
      }
    })

    var html = '<div class="room-header"><h2>📋 今日总结</h2><span class="room-subtitle">' + Wolf.todayStr() + '</span></div>'

    if (totalNodes === 0) {
      html += '<div class="study-panel"><p style="text-align:center;color:var(--text-muted);padding:40px 0;">今天还没有节点<br>加载预设或手动添加节点开始新的一天</p></div>'
      container.innerHTML = html
      return
    }

    // 总体概览
    html += '\
      <div class="study-panel" style="margin-bottom:10px;">\
        <h4 style="color:var(--warm-light);margin-bottom:10px;">📊 完成概览</h4>\
        <div class="settlement-item"><span>节点总数</span><span>' + totalNodes + '</span></div>\
        <div class="settlement-item"><span>已完成</span><span style="color:var(--success);">' + doneNodes + '</span></div>\
        <div class="settlement-item"><span>✅ 通过</span><span style="color:var(--success);">' + passedNodes + '</span></div>\
        <div class="settlement-item"><span>❌ 未达标</span><span style="color:var(--hp);">' + failedNodes + '</span></div>\
        <div class="settlement-item"><span>⬡ 空节点</span><span style="color:var(--text-muted);">' + emptyNodes + '</span></div>\
        <div class="settlement-item"><span>完成率</span><span>' + (totalNodes > 0 ? (doneNodes/totalNodes*100).toFixed(1) : 0) + '%</span></div>\
      </div>'

    // 能力变化
    html += '\
      <div class="study-panel" style="margin-bottom:10px;">\
        <h4 style="color:var(--warm-light);margin-bottom:10px;">📈 今日状态</h4>\
        <div class="settlement-item"><span>❤️ 体力</span><span>' + s.hp + '/' + s.hpMax + '</span></div>\
        <div class="settlement-item"><span>💙 San值</span><span>' + s.san + '/' + s.sanMax + '</span></div>\
        <div class="settlement-item"><span>💗 热情</span><span>' + s.passion + '/' + s.passionMax + '</span></div>\
        <div class="settlement-item"><span>⬆️ 生存 Lv.' + s.survivalLevel + '</span><span>✨' + s.survivalExp + '/' + Wolf.expToNextLevel('survival',s.survivalLevel) + '</span></div>\
        <div class="settlement-item"><span>🏥 健康 Lv.' + s.healthLevel + '</span><span>' + s.healthExp + '/' + Wolf.expToNextLevel('health',s.healthLevel) + '</span></div>\
        <div class="settlement-item"><span>🧠 专注 Lv.' + s.focusLevel + '</span><span>' + s.focusExp + '/' + Wolf.expToNextLevel('focus',s.focusLevel) + '</span></div>\
        <div class="settlement-item"><span>🔥 信念 Lv.' + s.faithLevel + '</span><span>' + s.faithExp + '/' + Wolf.expToNextLevel('faith',s.faithLevel) + '</span></div>\
      </div>'

    // 按类型详细
    if (Object.keys(typeStats).length > 0) {
      html += '<div class="study-panel"><h4 style="color:var(--warm-light);margin-bottom:10px;">📝 分类详情</h4>'
      Object.keys(typeStats).sort().forEach(function (key) {
        var ts = typeStats[key]
        var parts = key.split('|')
        var action = Wolf.ACTION_TYPES[parts[0]]
        var name = (action ? action.name : parts[0]) + (parts[1] ? ' · ' + parts[1] : '')
        var avgScore = ts.scored > 0 ? (ts.totalScore / ts.scored).toFixed(0) : '-'
        html += '<div class="settlement-item"><span>' + (action ? action.icon : '') + ' ' + name + '</span><span>' + ts.count + '次' + (ts.scored > 0 ? ' · 均分' + avgScore : '') + '</span></div>'
      })
      html += '</div>'
    }

    container.innerHTML = html
  }

  // ==================== 三树视图 ====================
  Wolf.renderTrees = function () {
    return '\
      <div class="room-header"><h2>🌳 三树系统</h2></div>\
      <div class="tree-tabs">\
        <button class="tree-tab' + (Wolf.state.treeTab==='knowledge'?' active':'') + '" data-action="tree-tab" data-tab="knowledge">📚 知识树</button>\
        <button class="tree-tab' + (Wolf.state.treeTab==='skills'?' active':'') + '" data-action="tree-tab" data-tab="skills">🎯 技能树</button>\
        <button class="tree-tab' + (Wolf.state.treeTab==='experience'?' active':'') + '" data-action="tree-tab" data-tab="experience">📖 阅历树</button>\
      </div>\
      <div id="tree-content" class="study-panel" style="margin-top:8px;">\
        <p style="text-align:center;color:var(--text-muted);padding:30px 0;">加载中...</p>\
      </div>'
  }

  Wolf._renderTreesAsync = async function () {
    // 确保三树已加载
    if (!Wolf.state.trees) {
      Wolf.state.trees = await Wolf.loadTrees()
    }
    var trees = Wolf.state.trees
    var container = document.getElementById('tree-content')
    if (!container) return

    var html = ''
    switch (Wolf.state.treeTab) {
      case 'knowledge': html = Wolf._renderKnowledgeTree(trees); break
      case 'skills':    html = Wolf._renderSkillTree(trees); break
      case 'experience':html = Wolf._renderExperienceTree(trees); break
      default: html = '<p>未知页签</p>'
    }
    container.innerHTML = html
    Wolf._bindTreeEvents()
  }

  Wolf._bindTreeEvents = function () {
    var container = document.getElementById('tree-content')
    if (!container) return
    container.querySelectorAll('[data-action="delete-tree-entry"]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation()
        Wolf.handleDeleteTreeEntry(el.dataset.tree, el.dataset.path, el.dataset.entryId)
      })
    })
    container.querySelectorAll('[data-action="edit-tree-entry"]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation()
        Wolf.handleEditTreeEntry(el.dataset.tree, el.dataset.path, el.dataset.entryId)
      })
    })
  }

  Wolf._renderKnowledgeTree = function (trees) {
    var domains = trees.knowledge.domains
    var domainNames = Object.keys(domains)
    var pool = trees.knowledge.inspirationPool || []
    var html = ''

    if (domainNames.length === 0) {
      html += '<p style="text-align:center;color:var(--text-muted);padding:20px 0;">知识树还是空的<br>完成学习节点后知识会自动收录</p>'
    } else {
      for (var d = 0; d < domainNames.length; d++) {
        var dn = domainNames[d]
        var domain = domains[dn]
        html += '<div style="margin-bottom:10px;"><div style="font-weight:700;color:var(--warm-light);margin-bottom:4px;">' + (domain.icon||'📁') + ' ' + dn + '</div>'
        var branches = Object.keys(domain.branches || {})
        for (var b = 0; b < branches.length; b++) {
          var bn = branches[b]
          var branch = domain.branches[bn]
          var entries = branch.entries || []
          html += '<div style="margin-left:16px;margin-bottom:4px;"><span style="color:var(--text-dim);font-size:12px;">▸ ' + bn + ' (' + entries.length + '条)</span></div>'
          for (var e = 0; e < entries.length; e++) {
            html += '<div class="node-card" style="margin-left:32px;padding:6px 10px;font-size:12px;cursor:default;opacity:.8;"><div class="node-icon" style="font-size:14px;">📝</div><div class="node-info"><div class="node-name" style="font-size:12px;">' + entries[e].title + '</div></div><button class="btn btn-sm btn-outline" data-action="edit-tree-entry" data-tree="knowledge" data-path="' + dn + '|' + bn + '" data-entry-id="' + entries[e].id + '" style="font-size:10px;padding:2px 6px;margin-left:4px;">✏️</button><button class="btn btn-sm btn-outline" data-action="delete-tree-entry" data-tree="knowledge" data-path="' + dn + '|' + bn + '" data-entry-id="' + entries[e].id + '" style="font-size:10px;padding:2px 6px;color:var(--hp);">✕</button></div>'
          }
          html += '</div>'
        }
        html += '</div>'
      }
    }

    // 灵感池
    if (pool.length > 0) {
      html += '<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);"><div style="font-weight:700;color:var(--fire);margin-bottom:4px;">💡 灵感池 (' + pool.length + ')</div>'
      for (var p = pool.length - 1; p >= 0; p--) {
        html += '<div class="node-card" style="padding:6px 10px;font-size:12px;cursor:default;opacity:.8;"><div class="node-icon" style="font-size:14px;">💭</div><div class="node-info"><div class="node-name" style="font-size:12px;">' + pool[p].content.substring(0, 80) + '</div><div class="node-time">' + pool[p].date + '</div></div><button class="btn btn-sm btn-outline" data-action="edit-tree-entry" data-tree="inspiration" data-path="" data-entry-id="' + pool[p].id + '" style="font-size:10px;padding:2px 6px;margin-left:4px;">✏️</button><button class="btn btn-sm btn-outline" data-action="delete-tree-entry" data-tree="inspiration" data-path="" data-entry-id="' + pool[p].id + '" style="font-size:10px;padding:2px 6px;color:var(--hp);">✕</button></div>'
      }
      html += '</div>'
    }

    return html
  }

  Wolf._renderSkillTree = function (trees) {
    var skills = trees.skills
    var skillIds = Object.keys(skills)
    var html = ''

    if (skillIds.length === 0) {
      html += '<p style="text-align:center;color:var(--text-muted);padding:20px 0;">技能树还是空的</p>'
      return html
    }

    for (var s = 0; s < skillIds.length; s++) {
      var sk = skills[skillIds[s]]
      var nextExp = Wolf.skillExpToNext(sk.level)
      var log = sk.log || []

      html += '\
        <div class="skill-branch">\
          <div class="skill-header">\
            <span class="skill-icon">' + (sk.icon||'🎯') + '</span>\
            <span class="skill-name">' + sk.name + '</span>\
            <span class="skill-level">Lv.' + sk.level + '</span>\
            <span class="skill-exp">' + sk.exp + '/' + nextExp + '</span>\
          </div>\
          <div class="skill-track"><div class="stat-fill exp" style="width:' + (sk.exp/nextExp*100).toFixed(0) + '%"></div></div>'

      if (log.length === 0) {
        html += '<p style="font-size:11px;color:var(--text-muted);padding:4px 0 12px 30px;">尚无训练记录</p>'
      } else {
        html += '<div class="skill-log">'
        for (var l = log.length - 1; l >= 0; l--) {
          var entry = log[l]
          html += '\
            <div class="skill-entry">\
              <div class="skill-entry-dot"></div>\
              <div class="skill-entry-card">\
                <div class="skill-entry-meta">' + entry.date + ' · ✨+' + entry.expGained + '</div>\
                <div class="skill-entry-text">' + (entry.content || '<em style="color:var(--text-muted);">无文本记录</em>') + '</div>\
                <div class="skill-entry-actions">\
                  <button class="btn btn-sm btn-outline" data-action="edit-tree-entry" data-tree="skill" data-path="' + sk.id + '" data-entry-id="' + entry.id + '" style="font-size:10px;padding:2px 8px;">✏️</button>\
                  <button class="btn btn-sm btn-outline" data-action="delete-tree-entry" data-tree="skill" data-path="' + sk.id + '" data-entry-id="' + entry.id + '" style="font-size:10px;padding:2px 8px;color:var(--hp);">✕</button>\
                </div>\
              </div>\
            </div>'
        }
        html += '</div>'
      }
      html += '</div>'
    }
    return html
  }

  Wolf._renderExperienceTree = function (trees) {
    var exp = trees.experience
    var types = ['reading','movie','game','other']
    var html = ''
    var hasAny = false

    for (var t = 0; t < types.length; t++) {
      var type = types[t]
      var items = exp[type] || []
      if (items.length === 0) continue
      hasAny = true
      var typeInfo = Wolf.EXP_TYPES[type] || { icon:'📌', name:type }
      html += '<div style="margin-bottom:8px;"><div style="font-weight:700;color:var(--warm-light);margin-bottom:4px;">' + typeInfo.icon + ' ' + typeInfo.name + ' (' + items.length + ')</div>'
      for (var i = items.length - 1; i >= Math.max(0, items.length - 5); i--) {
        html += '<div class="node-card" style="padding:8px 10px;cursor:default;opacity:.85;"><div class="node-icon" style="font-size:16px;">' + typeInfo.icon + '</div><div class="node-info"><div class="node-name" style="font-size:13px;">' + items[i].title + '</div><div class="node-time">' + items[i].date + (items[i].note ? ' · ' + items[i].note.substring(0,40) : '') + '</div></div></div>'
      }
      html += '</div>'
    }

    if (!hasAny) {
      html += '<p style="text-align:center;color:var(--text-muted);padding:20px 0;">阅历树还是空的<br>在书房记录阅读/观影/游戏后会出现在这里</p>'
    }
    return html
  }

  // ==================== 任务面板 ====================
  Wolf.renderTasks = function (data) {
    var tasks = data.stats.dailyTasks || []
    var html = '<div class="room-header"><h2>📋 每日任务</h2></div>'

    if (tasks.length === 0) {
      html += '<div class="study-panel"><p style="text-align:center;color:var(--text-muted);padding:40px 0;">暂无任务<br>在数值面板点击初始化来加载默认任务</p></div>'
      return html
    }

    html += '<div class="task-list" style="display:flex;flex-direction:column;gap:8px;">'
    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i]
      var statusIcon, statusCls, actionBtn = ''

      if (t.claimed) {
        statusIcon = '✅'
        statusCls = 'done'
      } else if (t.completed) {
        statusIcon = '🎁'
        statusCls = 'current'
        actionBtn = '<button class="btn btn-accent btn-sm" data-action="claim-task" data-task-id="' + t.id + '" style="margin-left:auto;font-size:11px;">领取奖励</button>'
      } else {
        statusIcon = t.icon || '📌'
        statusCls = ''
      }

      html += '\
        <div class="node-card ' + statusCls + '" style="cursor:default;">\
          <div class="node-icon">' + statusIcon + '</div>\
          <div class="node-info">\
            <div class="node-name">' + t.name + '</div>\
            <div class="node-time">' + (t.desc || '') + (t.reward && t.reward.expLabel ? ' · 奖励：' + t.reward.expLabel : '') + '</div>\
          </div>\
          ' + actionBtn + '\
        </div>'
    }
    html += '</div>'
    return html
  }
  Wolf._renderReportsAsync = async function () {
    var container = document.getElementById('report-container')
    if (!container) return

    // 先渲染日报
    var report = await Wolf.generateDailyReport()
    if (report && report.stats) {
      container.innerHTML = '\
        <h4 style="text-align:center;color:var(--fire);margin-bottom:12px;">📅 ' + report.date + ' 日报</h4>\
        <div class="settlement-item"><span>完成节点</span><span>' + (report.completion ? report.completion.doneNodes + '/' + report.completion.totalNodes : '-') + '</span></div>\
        <div class="settlement-item"><span>专注时长</span><span>' + (report.focusMinutes || 0) + ' 分钟</span></div>\
        <div class="settlement-item"><span>❤️ 体力</span><span>' + (report.stats.hp || 0) + '/' + (report.stats.hpMax || 100) + '</span></div>\
        <div class="settlement-item"><span>💙 San值</span><span>' + (report.stats.san || 0) + '/' + (report.stats.sanMax || 100) + '</span></div>\
        <div class="settlement-item"><span>💗 热情</span><span>' + (report.stats.passion || 0) + '/' + (report.stats.passionMax || 100) + '</span></div>\
        <div class="settlement-item"><span>⬆️ 等级</span><span>Lv.' + (report.stats.level || 1) + ' ✦ ' + (report.stats.exp || 0) + '</span></div>'
    } else {
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px 0;">暂无数据</p>'
    }
  }

  // ==================== Toast ====================
  Wolf.showToast = function (msg) {
    var el = document.createElement('div')
    el.className = 'toast'
    el.textContent = msg
    document.body.appendChild(el)
    setTimeout(function () { el.remove() }, 2000)
  }

  // ==================== Modal ====================
  Wolf.showModal = function (title, bodyHTML, buttons) {
    var overlay = document.getElementById('modal-overlay')
    var btnHTML = ''
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i]
      btnHTML += '<button class="btn ' + (b.cls||'btn-outline') + '" data-action="' + b.action + '">' + b.label + '</button>'
    }
    overlay.innerHTML = '\
      <div class="modal-box">\
        <h3>' + title + '</h3>\
        ' + bodyHTML + '\
        <div class="modal-btn-row">' + btnHTML + '</div>\
      </div>'
    overlay.classList.remove('hidden')
    overlay.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        var fn = Wolf.modalHandlers[e.target.dataset.action]
        if (fn) fn(e)
      })
    })
  }

  Wolf.closeModal = function () { document.getElementById('modal-overlay').classList.add('hidden') }
  Wolf.modalHandlers = {}

  // ==================== 空节点 → 行动选择弹窗 ====================
  Wolf.showActionPicker = function (nodeId) {
    var data = Wolf.getDayData()
    var node = Wolf.getNode(data, nodeId)
    if (!node) return

    // 按房间分组行动
    var roomGroups = [
      {
        room: '🖥️ 电脑房',
        actions: [
          { type: 'work_study', subtype: '深度学习', icon: '📚', desc: '深度专注学习' },
          { type: 'work_study', subtype: '浅层学习', icon: '📖', desc: '浏览/复习类学习' },
        ]
      },
      {
        room: '🎨 画室',
        actions: [
          { type: 'work_study', subtype: '画画', icon: '🎨', desc: '绘画练习' },
          { type: 'work_study', subtype: '练歌', icon: '🎤', desc: '声乐练习' },
          { type: 'work_study', subtype: '跳舞', icon: '💃', desc: '舞蹈练习' },
          { type: 'work_study', subtype: '语言训练', icon: '🗣️', desc: '语言学习' },
        ]
      },
      {
        room: '🏃 健身房',
        actions: [
          { type: 'work_study', subtype: '体育锻炼', icon: '🏃', desc: '体能训练' },
        ]
      },
      {
        room: '📖 书房',
        actions: [
          { type: 'work_study', subtype: '阅读', icon: '📚', desc: '阅读积累' },
          { type: 'work_study', subtype: '观影', icon: '🎬', desc: '影视鉴赏' },
          { type: 'work_study', subtype: '游戏', icon: '🎮', desc: '游戏体验' },
        ]
      },
      {
        room: '🏠 生活',
        actions: [
          { type: 'big_eat', subtype: '午饭', icon: '🍽️', desc: '大吃饭' },
          { type: 'big_eat', subtype: '晚饭', icon: '🍽️', desc: '大吃饭' },
          { type: 'small_eat', subtype: '早饭', icon: '🥐', desc: '小吃饭' },
          { type: 'walk', subtype: '饭后百步走', icon: '🚶', desc: '走路' },
          { type: 'walk', subtype: '散步', icon: '🚶', desc: '散步' },
          { type: 'short_break', subtype: null, icon: '☕', desc: '学习间小憩' },
          { type: 'long_break', subtype: null, icon: '🛋️', desc: '较长休息' },
          { type: 'free', subtype: null, icon: '🎯', desc: '自由安排' },
          { type: 'big_sleep', subtype: null, icon: '😴', desc: '大睡眠' },
          { type: 'small_sleep', subtype: null, icon: '💤', desc: '小睡眠' },
          { type: 'chores', subtype: '起床', icon: '☀️', desc: '起床' },
          { type: 'chores', subtype: '洗澡', icon: '🚿', desc: '洗澡' },
          { type: 'chores', subtype: '娱乐', icon: '🎮', desc: '娱乐放松' },
          { type: 'chores', subtype: '整理', icon: '🧹', desc: '整理收纳' },
        ]
      },
    ]

    var bodyHTML = '<div style="max-height:60vh;overflow-y:auto;">'
    bodyHTML += '<p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">📌 为节点 <b>' + node.startTime + '-' + node.endTime + '</b> 选择行动</p>'

    for (var g = 0; g < roomGroups.length; g++) {
      var group = roomGroups[g]
      bodyHTML += '<div style="margin-bottom:10px;"><div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px;letter-spacing:1px;">' + group.room + '</div><div style="display:flex;flex-wrap:wrap;gap:6px;">'
      for (var a = 0; a < group.actions.length; a++) {
        var act = group.actions[a]
        bodyHTML += '\
          <button class="action-chip" data-action="pick-action"\
            data-node-id="' + nodeId + '"\
            data-action-type="' + act.type + '"\
            data-subtype="' + (act.subtype || '') + '"\
            title="' + act.desc + '">\
            <span class="chip-icon">' + act.icon + '</span>' + (act.subtype || Wolf.ACTION_TYPES[act.type].name) + '\
          </button>'
      }
      bodyHTML += '</div></div>'
    }

    // 也支持自定义
    bodyHTML += '\
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">\
        <label style="font-size:12px;color:var(--text-dim);">或自定义行动名称</label>\
        <div style="display:flex;gap:6px;margin-top:4px;">\
          <input type="text" id="custom-action-name" placeholder="输入行动名称..." style="flex:1;">\
          <button class="btn btn-sm btn-outline" data-action="pick-custom" data-node-id="' + nodeId + '">确定</button>\
        </div>\
      </div>'

    bodyHTML += '</div>'

    // 注册 modal 事件处理（modal 在 #modal-overlay 中，需要走 modalHandlers）
    Wolf.modalHandlers['pick-action'] = function (e) {
      var el = e.target.closest('[data-action="pick-action"]')
      if (!el) return
      var nodeId = el.dataset.nodeId
      var actionType = el.dataset.actionType
      var subtype = el.dataset.subtype || null
      Wolf.setNodeAction(nodeId, actionType, subtype)
      Wolf.closeModal()
      Wolf.render()
      var action = Wolf.ACTION_TYPES[actionType]
      Wolf.showToast('🧩 ' + (action ? action.name : '行动') + (subtype ? '·' + subtype : '') + ' 已设置')
    }
    Wolf.modalHandlers['pick-custom'] = function () {
      var nameInput = document.getElementById('custom-action-name')
      var name = nameInput ? nameInput.value.trim() : ''
      if (!name) { Wolf.showToast('请输入行动名称'); return }
      Wolf.setNodeAction(nodeId, 'free', name)
      Wolf.closeModal()
      Wolf.render()
      Wolf.showToast('🧩 自定义行动「' + name + '」已设置')
    }

    Wolf.showModal('🧩 选择行动', bodyHTML, [
      { label: '取消', action: 'cancel-modal', cls: 'btn-outline' },
    ])
  }

  window.Wolf = Wolf
})()
