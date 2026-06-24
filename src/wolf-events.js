/* ============================================================
   wolf-events.js — 事件绑定 & 节点路由处理
   ============================================================ */

;(function () {
  if (!window.Wolf) window.Wolf = {}

  // ==================== 全局事件绑定 ====================
  Wolf.bindEvents = function () {
    var app = document.getElementById('app')

    // 点击节点（包括空节点）
    app.querySelectorAll('[data-action="click-node"]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        // 排除编辑/移动/删除按钮
        if (e.target.closest('[data-action="edit-node"]')) return
        if (e.target.closest('[data-action="delete-node"]')) return
        if (e.target.closest('[data-action="move-node"]')) return
        var card = e.currentTarget
        if (card.classList.contains('done')) return
        Wolf.handleNodeClick(card.dataset.nodeId)
      })
    })

    // 节点工具栏
    app.querySelectorAll('[data-action="add-node"]').forEach(function (el) {
      el.addEventListener('click', function () {
        Wolf.addNode()
        Wolf.render()
        Wolf.showToast('🧩 已添加空节点')
      })
    })
    app.querySelectorAll('[data-action="goto-now"]').forEach(function (el) {
      el.addEventListener('click', function () { Wolf.gotoCurrentNode() })
    })
    app.querySelectorAll('[data-action="load-preset"]').forEach(function (el) {
      el.addEventListener('click', function () {
        Wolf.showModal('📋 加载预设',
          '<p style="color:var(--text-dim);margin-bottom:12px;">将使用默认时间表替换当前所有节点。<br>已完成节点不会被清除。</p>',
          [
            { label: '确认加载', action: 'confirm-load-preset', cls: 'btn-primary' },
            { label: '取消', action: 'cancel-modal', cls: 'btn-outline' },
          ]
        )
        Wolf.modalHandlers['confirm-load-preset'] = function () {
          Wolf.loadPresetNodes()
          Wolf.closeModal()
          Wolf.render()
          Wolf.showToast('📋 预设已加载')
        }
      })
    })
    app.querySelectorAll('[data-action="clear-day"]').forEach(function (el) {
      el.addEventListener('click', function () {
        Wolf.showModal('🗑️ 清空当日',
          '<p style="color:var(--hp);margin-bottom:12px;">确定要清空今天所有节点吗？<br>已完成节点的记录也会被清除。</p>',
          [
            { label: '确认清空', action: 'confirm-clear-day', cls: 'btn-danger' },
            { label: '取消', action: 'cancel-modal', cls: 'btn-outline' },
          ]
        )
        Wolf.modalHandlers['confirm-clear-day'] = function () {
          Wolf.clearAllNodes()
          Wolf.closeModal()
          Wolf.render()
          Wolf.showToast('🗑️ 当日节点已清空')
        }
      })
    })

    // 节点编辑/删除/移动
    app.querySelectorAll('[data-action="edit-node"]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation()
        Wolf.handleEditNode(el.dataset.nodeId)
      })
    })
    app.querySelectorAll('[data-action="delete-node"]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation()
        Wolf.handleDeleteNodeClick(el.dataset.nodeId)
      })
    })
    app.querySelectorAll('[data-action="move-node"]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation()
        Wolf.moveNode(el.dataset.nodeId, el.dataset.direction)
        Wolf.render()
      })
    })

    // 拖拽排序
    var dragState = { dragging: null, over: null }
    app.querySelectorAll('.node-card[draggable]').forEach(function (el) {
      el.addEventListener('dragstart', function (e) {
        if (el.classList.contains('done')) { e.preventDefault(); return }
        dragState.dragging = el.dataset.nodeId
        el.style.opacity = '0.4'
        e.dataTransfer.effectAllowed = 'move'
      })
      el.addEventListener('dragend', function () {
        el.style.opacity = ''
        document.querySelectorAll('.node-card.drag-over').forEach(function (c) { c.classList.remove('drag-over') })
        dragState.dragging = null
      })
      el.addEventListener('dragover', function (e) {
        e.preventDefault()
        if (!dragState.dragging || el.dataset.nodeId === dragState.dragging) return
        e.dataTransfer.dropEffect = 'move'
        el.classList.add('drag-over')
      })
      el.addEventListener('dragleave', function () {
        el.classList.remove('drag-over')
      })
      el.addEventListener('drop', function (e) {
        e.preventDefault()
        el.classList.remove('drag-over')
        if (!dragState.dragging || el.dataset.nodeId === dragState.dragging) return
        var data = Wolf.getDayData()
        var nodes = data.nodes
        var fromIdx = -1, toIdx = -1
        for (var i = 0; i < nodes.length; i++) {
          if (nodes[i].id === dragState.dragging) fromIdx = i
          if (nodes[i].id === el.dataset.nodeId) toIdx = i
        }
        if (fromIdx < 0 || toIdx < 0) return
        // 移动节点
        var moved = nodes.splice(fromIdx, 1)[0]
        nodes.splice(toIdx, 0, moved)
        Wolf._recalculateTimes(nodes, Math.min(fromIdx, toIdx))
        Wolf.saveDayData(data)
        Wolf.render()
      })
    })

    // 行动选择弹窗事件用 modalHandlers（modal 在 #modal-overlay 中，不在 #app 内）

    // 回到卧室
    app.querySelectorAll('[data-action="back-bedroom"]').forEach(function (el) {
      el.addEventListener('click', function () {
        if (Wolf.state.timer.intervalId) {
          if (!confirm('学习计时进行中，确定返回吗？')) return
          Wolf.stopTimer()
        }
        Wolf.goToBedroom()
      })
    })

    // 开始学习
    app.querySelectorAll('[data-action="start-study"]').forEach(function (el) {
      el.addEventListener('click', Wolf.handleStartStudy)
    })
    // 提前结束
    app.querySelectorAll('[data-action="end-study-early"]').forEach(function (el) {
      el.addEventListener('click', Wolf.handleEndStudyEarly)
    })
    // 结算学习
    app.querySelectorAll('[data-action="settle-study"]').forEach(function (el) {
      el.addEventListener('click', Wolf.handleSettleStudy)
    })
    // 确认结算
    app.querySelectorAll('[data-action="confirm-settlement"]').forEach(function (el) {
      el.addEventListener('click', Wolf.handleConfirmSettlement)
    })

    // 实践
    app.querySelectorAll('[data-action="select-practice"]').forEach(function (el) {
      el.addEventListener('click', function () { Wolf.state.tempLog.practiceType = el.dataset.value; Wolf.render() })
    })
    app.querySelectorAll('[data-action="settle-practice"]').forEach(function (el) {
      el.addEventListener('click', Wolf.handleSettlePractice)
    })

    // 锻炼
    app.querySelectorAll('[data-action="select-exercise"]').forEach(function (el) {
      el.addEventListener('click', function () { Wolf.state.tempLog.exerciseType = el.dataset.value; Wolf.render() })
    })
    app.querySelectorAll('[data-action="settle-exercise"]').forEach(function (el) {
      el.addEventListener('click', Wolf.handleSettleExercise)
    })

    // 阅历
    app.querySelectorAll('[data-action="select-exp"]').forEach(function (el) {
      el.addEventListener('click', function () { Wolf.state.tempLog.expType = el.dataset.value; Wolf.render() })
    })
    app.querySelectorAll('[data-action="settle-exp"]').forEach(function (el) {
      el.addEventListener('click', Wolf.handleSettleExp)
    })

    // 导航
    app.querySelectorAll('[data-action="nav-to"]').forEach(function (el) {
      el.addEventListener('click', function () {
        if (Wolf.state.timer.intervalId) {
          if (!confirm('学习计时进行中，确定切换吗？')) return
          Wolf.stopTimer()
        }
        Wolf.navigateTo(el.dataset.view)
      })
    })

    // 房间卡片
    app.querySelectorAll('[data-action="goto-room"]').forEach(function (el) {
      el.addEventListener('click', function () { Wolf.navigateTo(el.dataset.room) })
    })

    // 手动调整数值
    app.querySelectorAll('[data-action="edit-stat"]').forEach(function (el) {
      el.addEventListener('click', function () { Wolf.handleEditStat(el.dataset.stat) })
    })

    // 重置数值
    app.querySelectorAll('[data-action="reset-stats"]').forEach(function (el) {
      el.addEventListener('click', function () { Wolf.handleResetStats() })
    })

    // 撤销节点
    app.querySelectorAll('[data-action="undo-node"]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation()
        Wolf.handleUndoNode(el.dataset.nodeId)
      })
    })

    // 领取任务奖励
    app.querySelectorAll('[data-action="claim-task"]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation()
        Wolf.handleClaimTask(el.dataset.taskId)
      })
    })

    // 三树页签切换
    app.querySelectorAll('[data-action="tree-tab"]').forEach(function (el) {
      el.addEventListener('click', function () {
        Wolf.state.treeTab = el.dataset.tab
        Wolf._renderTreesAsync()
      })
    })

    // 三树条目删除
    app.querySelectorAll('[data-action="delete-tree-entry"]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation()
        Wolf.handleDeleteTreeEntry(el.dataset.tree, el.dataset.path, el.dataset.entryId)
      })
    })

    // 三树条目编辑
    app.querySelectorAll('[data-action="edit-tree-entry"]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation()
        Wolf.handleEditTreeEntry(el.dataset.tree, el.dataset.path, el.dataset.entryId)
      })
    })
  }

  // ==================== 节点点击路由 ====================
  Wolf.handleNodeClick = function (nodeId) {
    var data = Wolf.getDayData()
    var node = Wolf.getNode(data, nodeId)
    if (!node || node.done) return

    // 空节点 → 弹出行动选择
    if (!node.actionType) {
      Wolf.showActionPicker(nodeId)
      return
    }

    var action = Wolf.getAction(node)
    if (!action) return

    Wolf.state.currentNodeId = nodeId

    switch (node.actionType) {
      case 'work_study':
        if (node.subtype === '体育锻炼') {
          Wolf.state.view = 'gym'
          Wolf.state.tempLog.exerciseType = ''
          Wolf.state.tempLog.exerciseDuration = ''
        } else if (node.subtype === '自主实践') {
          Wolf.state.view = 'studio'
          Wolf.state.tempLog.practiceType = ''
          Wolf.state.tempLog.practiceNote = ''
        } else {
          Wolf.state.view = 'computer-room'
          Wolf.state.studyPhase = 'pre'
          Wolf.state.studyLog = {
            field: '', hasMaterial: 'yes', materialDetail: '', preMessage: '',
            startTime: null, endTime: null, archive: '', knowledge: '', postMessage: '',
          }
        }
        Wolf.render()
        break

      case 'chores':
        if (node.subtype === '起床') {
          Wolf.showModal('☀️ 起床', '<p style="color:var(--text-light)">新的一天开始了！看板娘在等你哦。</p>', [
            { label: '起床！', action: 'do-wakeup', cls: 'btn-primary' },
          ])
          Wolf.modalHandlers['do-wakeup'] = function () {
            Wolf.completeSimpleNode(nodeId)
            Wolf.closeModal()
            Wolf.showToast('☀️ 早安！新的一天开始了！')
          }
        } else if (node.subtype === '娱乐') {
          Wolf.showModal('🎮 娱乐', '<p style="color:var(--text-light)">适当放松是必要的，享受当下吧。</p>', [
            { label: '标记完成', action: 'do-chore', cls: 'btn-accent' },
          ])
          Wolf.modalHandlers['do-chore'] = function () {
            Wolf.completeSimpleNode(nodeId)
            Wolf.closeModal()
            Wolf.showToast('🎮 休息好了继续加油！')
          }
        } else {
          Wolf.completeSimpleNode(nodeId)
          Wolf.showToast(action.icon + ' ' + action.name + (node.subtype ? '·' + node.subtype : '') + ' 标记完成！')
        }
        break

      case 'big_sleep':
        Wolf.showModal('😴 大睡眠', '<p style="color:var(--text-light)">好好休息才能恢复状态。明天见！</p>', [
          { label: '晚安', action: 'do-bigsleep', cls: 'btn-primary' },
        ])
        Wolf.modalHandlers['do-bigsleep'] = function () {
          var d = Wolf.getDayData()
          var nd = Wolf.getNode(d, nodeId)
          if (!nd) { Wolf.closeModal(); return }
          var isLate = Wolf.isNodeLate(nd)
          var score = Wolf.scoreNodeCompletion(nd, {})
          var result = Wolf.calcCompletionResult(nd, {}, isLate)
          nd.doneCount = nd.count
          nd.done = true
          nd.log = { settledAt: Date.now(), completionScore: score, settlementResult: result, isLate: isLate }
          Wolf.applyCompletionResult(d, result)
          Wolf.calcPassionProgress(d)
          Wolf.checkAndAutoCompleteTasks(d)
          Wolf.saveDayData(d)
          Wolf.closeModal()
          Wolf.showToast('🌙 晚安！明天见！')
          // 归档当日数据
          Wolf.archiveDay()
          Wolf.render()
        }
        break

      case 'small_sleep':
        Wolf.showModal('💤 小睡眠', '<p style="color:var(--text-light)">午间小憩，充电后再出发。</p>', [
          { label: '开始休息', action: 'do-smallsleep', cls: 'btn-primary' },
        ])
        Wolf.modalHandlers['do-smallsleep'] = function () {
          Wolf.completeSimpleNode(nodeId)
          Wolf.closeModal()
          Wolf.showToast('💤 休息完毕，精力恢复！')
        }
        break

      case 'big_eat':
      case 'small_eat':
        Wolf.showModal(action.icon + ' ' + action.name + (node.subtype ? ' · ' + node.subtype : ''),
          '<p style="color:var(--text-light)">好好吃饭，补充能量。</p>', [
          { label: '标记完成', action: 'do-eat', cls: 'btn-primary' },
        ])
        Wolf.modalHandlers['do-eat'] = function () {
          Wolf.completeSimpleNode(nodeId)
          Wolf.closeModal()
          Wolf.showToast('🍽️ 吃饱了继续战斗！')
        }
        break

      case 'walk':
      case 'short_break':
      case 'long_break':
      case 'free':
        Wolf.completeSimpleNode(nodeId)
        Wolf.showToast(action.icon + ' ' + action.name + ' 标记完成！')
        break

      default:
        Wolf.completeSimpleNode(nodeId)
        Wolf.showToast(action.icon + ' ' + action.name + ' 完成！')
    }
  }

  // 简单节点完成（新 v3 完成度评分）
  Wolf.completeSimpleNode = function (nodeId) {
    var data = Wolf.getDayData()
    var node = Wolf.getNode(data, nodeId)
    if (!node || node.done) return

    // 评分（检查是否过期补记）
    var isLate = Wolf.isNodeLate(node)
    var score = Wolf.scoreNodeCompletion(node, {})
    var result = Wolf.calcCompletionResult(node, {}, isLate)

    // 标记完成
    node.doneCount = node.count
    node.done = true
    node.log = { settledAt: Date.now(), completionScore: score, settlementResult: result, isLate: isLate }

    // 结算并更新热情进度
    Wolf.applyCompletionResult(data, result)
    Wolf.calcPassionProgress(data)

    // 检查每日任务
    Wolf.checkAndAutoCompleteTasks(data)

    Wolf.saveLog({
      type: 'complete_node',
      actionType: node.actionType,
      subtype: node.subtype || '',
      result: result,
    })
    Wolf.saveDayData(data)
    Wolf.render()
  }

  // ==================== 节点编辑 ====================
  Wolf.handleDeleteNodeClick = function (nodeId) {
    var data = Wolf.getDayData()
    var node = Wolf.getNode(data, nodeId)
    if (!node || node.done) { Wolf.showToast('⚠️ 已完成节点不能删除'); return }
    Wolf.showModal('✕ 删除节点',
      '<p style="color:var(--text-dim);margin-bottom:12px;">确定删除节点 <b>' + node.startTime + '-' + node.endTime + '</b> 吗？</p>',
      [
        { label: '确认删除', action: 'confirm-delete-node', cls: 'btn-danger' },
        { label: '取消', action: 'cancel-modal', cls: 'btn-outline' },
      ]
    )
    Wolf.modalHandlers['confirm-delete-node'] = function () {
      Wolf.deleteNode(nodeId)
      Wolf.closeModal()
      Wolf.render()
      Wolf.showToast('🗑️ 节点已删除')
    }
  }

  Wolf.handleEditNode = function (nodeId) {
    var data = Wolf.getDayData()
    var node = Wolf.getNode(data, nodeId)
    if (!node || node.done) return

    var gradeOptions = ''
    Object.entries(Wolf.DURATION_GRADES).forEach(function (entry) {
      var k = entry[0], v = entry[1]
      gradeOptions += '<option value="' + k + '"' + (node.durationGrade===k?' selected':'') + '>' + v.label + '级 - ' + v.name + '</option>'
    })

    var subtypeOptions = ''
    var action = Wolf.getAction(node)
    if (action && action.subtypes) {
      action.subtypes.forEach(function (s) {
        subtypeOptions += '<option value="' + s + '"' + (node.subtype===s?' selected':'') + '>' + s + '</option>'
      })
    }

    var isEmpty = !node.actionType
    var currentActionLabel = isEmpty ? '（空）' : (action ? action.name + (node.subtype ? ' · ' + node.subtype : '') : '未知')

    Wolf.showModal('⚙️ 编辑节点',
      '<div class="form-group">\
        <label>当前行动</label>\
        <div style="display:flex;align-items:center;gap:8px;">\
          <span style="font-size:13px;color:var(--text-dim);">' + currentActionLabel + '</span>\
          <button class="btn btn-sm btn-outline" data-action="edit-pick-action" data-node-id="' + nodeId + '" style="font-size:11px;padding:4px 10px;">' + (isEmpty ? '选择行动' : '更换') + '</button>\
        </div>\
      </div>\
      <div class="form-group">\
        <label>时长等级</label>\
        <select id="edit-grade">' + gradeOptions + '</select>\
      </div>\
      ' + (node.actionType === 'work_study' && subtypeOptions ? '\
      <div class="form-group">\
        <label>子类型</label>\
        <select id="edit-subtype">' + subtypeOptions + '</select>\
      </div>' : '') + '\
      <div class="form-group">\
        <label>起始时间</label>\
        <input type="time" id="edit-start" value="' + node.startTime + '">\
      </div>\
      <div class="form-group">\
        <label>节数（重复次数）</label>\
        <input type="number" id="edit-count" value="' + node.count + '" min="1" max="24">\
      </div>',
      [
        { label: '保存', action: 'save-node-edit', cls: 'btn-primary' },
        { label: '取消', action: 'cancel-modal', cls: 'btn-outline' },
      ]
    )

    // 编辑弹窗中的行动选择
    Wolf.modalHandlers['edit-pick-action'] = function () {
      Wolf.closeModal()
      Wolf.showActionPicker(nodeId)
    }

    Wolf.modalHandlers['save-node-edit'] = function () {
      var d = Wolf.getDayData()
      var nd = Wolf.getNode(d, nodeId)
      if (!nd) { Wolf.closeModal(); return }
      nd.durationGrade = (document.getElementById('edit-grade') && document.getElementById('edit-grade').value) || nd.durationGrade
      var newSubtype = document.getElementById('edit-subtype')
      if (newSubtype) nd.subtype = newSubtype.value
      var newStart = document.getElementById('edit-start')
      if (newStart && newStart.value) {
        nd.startTime = newStart.value
      }
      var newCount = document.getElementById('edit-count')
      if (newCount && newCount.value) {
        nd.count = Math.max(1, parseInt(newCount.value) || 1)
      }
      var grade = Wolf.DURATION_GRADES[nd.durationGrade]
      nd.durationMinutes = grade.minutes
      nd.endTime = Wolf.minutesToTimeStr(Wolf.timeStrToMinutes(nd.startTime) + nd.durationMinutes * nd.count)
      // 重算后续节点时间
      var idx = -1
      for (var i = 0; i < d.nodes.length; i++) { if (d.nodes[i].id === nodeId) { idx = i; break } }
      if (idx >= 0) Wolf._recalculateTimes(d.nodes, idx + 1)
      Wolf.saveDayData(d)
      Wolf.closeModal()
      Wolf.render()
      Wolf.showToast('✅ 节点已更新')
    }
  }

  // ==================== 数值手动调整 ====================
  Wolf.handleEditStat = function (stat) {
    var data = Wolf.getDayData()
    var s = data.stats
    var labels = { hp: '❤️ 体力', san: '💙 San值', passion: '💗 热情' }
    var current = stat === 'hp' ? s.hp : stat === 'san' ? s.san : s.passion
    var max = stat === 'hp' ? s.hpMax : stat === 'san' ? s.sanMax : s.passionMax

    Wolf.showModal('✏️ 调整' + labels[stat],
      '<div class="form-group">\
        <label>当前值 (上限 ' + max + ')</label>\
        <input type="number" id="edit-stat-val" value="' + current + '" min="0" max="' + max + '">\
      </div>',
      [
        { label: '保存', action: 'save-stat-edit', cls: 'btn-primary' },
        { label: '取消', action: 'cancel-modal', cls: 'btn-outline' },
      ]
    )
    Wolf.modalHandlers['save-stat-edit'] = function () {
      var val = parseInt((document.getElementById('edit-stat-val') && document.getElementById('edit-stat-val').value) || NaN)
      if (isNaN(val)) { Wolf.closeModal(); return }
      var d = Wolf.getDayData()
      if (stat === 'hp') d.stats.hp = Math.max(0, Math.min(d.stats.hpMax, val))
      else if (stat === 'san') d.stats.san = Math.max(0, Math.min(d.stats.sanMax, val))
      else if (stat === 'passion') d.stats.passion = Math.max(0, Math.min(d.stats.passionMax, val))
      Wolf.saveDayData(d)
      Wolf.closeModal()
      Wolf.render()
      Wolf.showToast('✅ ' + labels[stat] + ' 已调整')
    }
  }

  Wolf.modalHandlers['cancel-modal'] = function () { Wolf.closeModal() }

  // ==================== 重置数值 ====================
  Wolf.handleResetStats = function () {
    var data = Wolf.getDayData()
    Wolf.showModal('🔄 初始化数值',
      '<p style="color:var(--hp);margin-bottom:12px;">将数值重置为默认初始值：</p>\
      <div style="font-size:13px;color:var(--text-dim);line-height:1.8;">\
        ❤️ 体力 → 50/50<br>\
        💙 San值 → 50/50<br>\
        💗 热情 → 50/50<br>\
        ⬆️ 生存 Lv.1 · 🏥健康 Lv.1 · 🧠专注 Lv.1 · 🔥信念 Lv.1\
      </div>\
      <p style="font-size:12px;color:var(--text-muted);margin-top:10px;">不影响节点和日志</p>',
      [
        { label: '确认重置', action: 'confirm-reset-stats', cls: 'btn-danger' },
        { label: '取消', action: 'cancel-modal', cls: 'btn-outline' },
      ]
    )
    Wolf.modalHandlers['confirm-reset-stats'] = function () {
      var def = Wolf.defaultStats()
      data.stats.hp = def.hp; data.stats.hpMax = def.hpMax
      data.stats.san = def.san; data.stats.sanMax = def.sanMax
      data.stats.passion = def.passion; data.stats.passionMax = def.passionMax
      data.stats.survivalLevel = def.survivalLevel; data.stats.survivalExp = def.survivalExp
      data.stats.healthLevel = def.healthLevel; data.stats.healthExp = def.healthExp
      data.stats.focusLevel = def.focusLevel; data.stats.focusExp = def.focusExp
      data.stats.faithLevel = def.faithLevel; data.stats.faithExp = def.faithExp
      data.stats.skills = def.skills
      Wolf.saveDayData(data)
      Wolf.closeModal()
      Wolf.render()
      Wolf.showToast('🔄 数值已初始化')
    }
  }

  // ==================== 撤销节点 ====================
  Wolf.handleUndoNode = function (nodeId) {
    var data = Wolf.getDayData()
    var node = Wolf.getNode(data, nodeId)
    if (!node || !node.done) { Wolf.showToast('⚠️ 节点未完成，无需撤销'); return }
    var action = Wolf.getAction(node)
    var label = action ? action.name : '节点'

    Wolf.showModal('↩️ 撤销完成',
      '<p style="color:var(--text-dim);margin-bottom:12px;">确定撤销 <b>' + label + (node.subtype?' · ' + node.subtype:'') + '</b> 的完成状态吗？<br>数值变化将被回退。</p>',
      [
        { label: '确认撤销', action: 'confirm-undo-node', cls: 'btn-accent' },
        { label: '取消', action: 'cancel-modal', cls: 'btn-outline' },
      ]
    )
    Wolf.modalHandlers['confirm-undo-node'] = function () {
      var ok = Wolf.undoNode(nodeId)
      Wolf.closeModal()
      if (ok) {
        Wolf.render()
        Wolf.showToast('↩️ 已完成撤销，数值已回退')
      }
    }
  }

  // ==================== 任务领取 ====================
  Wolf.handleClaimTask = function (taskId) {
    var data = Wolf.getDayData()
    var reward = Wolf.claimTaskReward(data, taskId)
    if (reward) {
      Wolf.render()
      Wolf.showToast('🎁 奖励已领取！' + (reward.expLabel || ''))
    } else {
      Wolf.showToast('⚠️ 奖励已领取或未完成')
    }
  }

  // ==================== 三树条目操作 ====================
  Wolf.handleDeleteTreeEntry = function (treeType, path, entryId) {
    Wolf.showModal('✕ 删除条目',
      '<p style="color:var(--text-dim);margin-bottom:12px;">确定删除这个条目吗？此操作不可撤销。</p>',
      [
        { label: '确认删除', action: 'confirm-delete-tree', cls: 'btn-danger' },
        { label: '取消', action: 'cancel-modal', cls: 'btn-outline' },
      ]
    )
    Wolf.modalHandlers['confirm-delete-tree'] = function () {
      Wolf.deleteTreeEntry(treeType, path, entryId)
      Wolf.closeModal()
      Wolf._renderTreesAsync()
      Wolf.showToast('🗑️ 条目已删除')
    }
  }

  Wolf.handleEditTreeEntry = function (treeType, path, entryId) {
    var trees = Wolf.state.trees
    var entry = null
    var arr = Wolf._resolveTreePath(trees, treeType, path)
    if (arr) entry = arr.find(function (e) { return e.id === entryId })
    if (!entry) { Wolf.showToast('⚠️ 条目未找到'); return }

    var currentText = entry.content || entry.title || ''
    var isKnowledge = treeType === 'knowledge'
    Wolf.showModal('✏️ 编辑条目',
      '<div class="form-group">\
        ' + (isKnowledge ? '<label>标题</label><input type="text" id="edit-entry-title" value="' + Wolf.escHtml(entry.title || '') + '">' : '') + '\
        <label>内容</label>\
        <textarea id="edit-entry-content" rows="4" placeholder="输入文本...">' + Wolf.escHtml(currentText) + '</textarea>\
      </div>',
      [
        { label: '保存', action: 'save-tree-entry', cls: 'btn-primary' },
        { label: '取消', action: 'cancel-modal', cls: 'btn-outline' },
      ]
    )
    Wolf.modalHandlers['save-tree-entry'] = function () {
      var newContent = (document.getElementById('edit-entry-content') && document.getElementById('edit-entry-content').value) || ''
      var updates = { content: newContent }
      if (isKnowledge) {
        var newTitle = (document.getElementById('edit-entry-title') && document.getElementById('edit-entry-title').value) || ''
        updates.title = newTitle
      }
      Wolf.updateTreeEntry(treeType, path, entryId, updates)
      Wolf.closeModal()
      Wolf._renderTreesAsync()
      Wolf.showToast('✅ 条目已更新')
    }
  }

  // ==================== 学习流程 ====================
  Wolf.handleStartStudy = function () {
    Wolf.state.studyLog.field = (document.getElementById('study-field') && document.getElementById('study-field').value) || ''
    Wolf.state.studyLog.hasMaterial = (document.getElementById('study-material') && document.getElementById('study-material').value) || 'yes'
    Wolf.state.studyLog.materialDetail = (document.getElementById('study-material-detail') && document.getElementById('study-material-detail').value) || ''
    Wolf.state.studyLog.preMessage = (document.getElementById('study-pre-msg') && document.getElementById('study-pre-msg').value) || ''
    if (!Wolf.state.studyLog.field.trim()) { Wolf.showToast('请填写学习领域'); return }
    Wolf.state.studyLog.startTime = Date.now()
    Wolf.state.studyPhase = 'timing'
    Wolf.state.timer.remaining = Wolf.state.timer.total
    Wolf.render()
    Wolf.startTimer()
  }

  Wolf.handleEndStudyEarly = function () {
    Wolf.stopTimer()
    Wolf.state.studyLog.endTime = Date.now()
    Wolf.state.studyPhase = 'post'
    Wolf.render()
  }

  Wolf.handleSettleStudy = function () {
    Wolf.state.studyLog.archive = (document.getElementById('study-archive') && document.getElementById('study-archive').value) || ''
    Wolf.state.studyLog.knowledge = (document.getElementById('study-knowledge') && document.getElementById('study-knowledge').value) || ''
    Wolf.state.studyLog.postMessage = (document.getElementById('study-post-msg') && document.getElementById('study-post-msg').value) || ''
    Wolf.state.studyPhase = 'settlement'
    Wolf.render()
  }

  Wolf.handleConfirmSettlement = function () {
    var data = Wolf.getDayData()
    var node = Wolf.getNode(data, Wolf.state.currentNodeId)
    if (!node) { Wolf.goToBedroom(); return }

    // 评分（检查是否过期补记）
    var isLate = Wolf.isNodeLate(node)
    var score = Wolf.scoreNodeCompletion(node, Wolf.state.studyLog)
    var result = Wolf.calcCompletionResult(node, Wolf.state.studyLog, isLate)

    node.doneCount = node.count
    node.done = true
    node.log = {
      settledAt: Date.now(),
      completionScore: score,
      settlementResult: result,
      studyLog: Object.assign({}, Wolf.state.studyLog),
    }

    Wolf.applyCompletionResult(data, result)
    Wolf.calcPassionProgress(data)

    if (Wolf.state.studyLog.hasMaterial === 'no') {
      var scEl = document.getElementById('study-selfcheck')
      var sc = scEl ? scEl.value : 'no'
      if (sc === 'yes') {
        data.stats.san = Math.max(0, data.stats.san - 5)
        data.stats.passion = Math.max(0, data.stats.passion - 3)
        Wolf.saveDayData(data)
        Wolf.showToast('⚠️ 自查发现分心，San-5，热情-3')
      }
    }

    // 检查任务
    Wolf.checkAndAutoCompleteTasks(data)

    Wolf.saveLog({
      type: 'focus_study',
      actionType: node.actionType,
      subtype: node.subtype || '',
      result: result,
      notes: Wolf.state.studyLog.preMessage,
    })

    Wolf.state._lastSettlement = null
    Wolf.goToBedroom()

    // 写入知识树和灵感池
    if (result.passed) {
      Wolf._ensureTreesLoaded(function () {
        if (Wolf.state.studyLog.field) {
          Wolf.addKnowledgeEntry(Wolf.state.studyLog.field, '学习笔记', { title: Wolf.state.studyLog.field, content: Wolf.state.studyLog.knowledge, source: '学习log' })
        }
        if (Wolf.state.studyLog.postMessage) {
          Wolf.addInspiration(Wolf.state.studyLog.postMessage)
        }
      })
    }

    var action = Wolf.getAction(node)
    if (result.passed) {
      Wolf.showToast('✅ 学习完成！得分 ' + score + '，获得 ✨' + (result.survivalExp+result.focusExp) + ' 经验')
    } else {
      Wolf.showToast('❌ 未达及格线（' + score + '分），无收益')
    }
  }

  // ==================== 实践/锻炼/阅历结算（v3） ====================
  Wolf.handleSettlePractice = function () {
    Wolf.state.tempLog.practiceNote = (document.getElementById('practice-note') && document.getElementById('practice-note').value) || ''
    if (!Wolf.state.tempLog.practiceType) { Wolf.showToast('请选择实践类型'); return }
    var data = Wolf.getDayData()
    var node = Wolf.getNode(data, Wolf.state.currentNodeId)
    if (!node) { Wolf.goToBedroom(); return }
    var isLate = Wolf.isNodeLate(node)
    var score = Wolf.scoreNodeCompletion(node, Wolf.state.tempLog)
    var result = Wolf.calcCompletionResult(node, Wolf.state.tempLog, isLate)
    node.doneCount = node.count; node.done = true
    node.log = { settledAt: Date.now(), completionScore: score, settlementResult: result, isLate: isLate }
    Wolf.applyCompletionResult(data, result)
    Wolf.calcPassionProgress(data)
    Wolf.checkAndAutoCompleteTasks(data)
    Wolf.saveLog({ type: 'practice', actionType: node.actionType, subtype: Wolf.state.tempLog.practiceType, result: result })
    Wolf.goToBedroom()
    Wolf.showToast(result.passed ? '🎨 完成！得分 ' + score + (isLate?' (补记·0.2×)':'') : '❌ 未达标，无收益')
    // 写入技能经验
    if (result.passed) {
      Wolf._ensureTreesLoaded(function () {
        Wolf.addSkillExp(Wolf.state.tempLog.practiceType, Math.floor(score / 10), Wolf.state.tempLog.practiceNote)
      })
    }
  }

  Wolf.handleSettleExercise = function () {
    Wolf.state.tempLog.exerciseDuration = (document.getElementById('exercise-duration') && document.getElementById('exercise-duration').value) || ''
    if (!Wolf.state.tempLog.exerciseType) { Wolf.showToast('请选择运动类型'); return }
    var data = Wolf.getDayData()
    var node = Wolf.getNode(data, Wolf.state.currentNodeId)
    if (!node) { Wolf.goToBedroom(); return }
    var isLate = Wolf.isNodeLate(node)
    var score = Wolf.scoreNodeCompletion(node, Wolf.state.tempLog)
    var result = Wolf.calcCompletionResult(node, Wolf.state.tempLog, isLate)
    node.doneCount = node.count; node.done = true
    node.log = { settledAt: Date.now(), completionScore: score, settlementResult: result, isLate: isLate }
    Wolf.applyCompletionResult(data, result)
    Wolf.calcPassionProgress(data)
    Wolf.checkAndAutoCompleteTasks(data)
    Wolf.saveLog({ type: 'exercise', actionType: node.actionType, subtype: Wolf.state.tempLog.exerciseType, result: result })
    Wolf.goToBedroom()
    Wolf.showToast(result.passed ? '🏃 完成！得分 ' + score + (isLate?' (补记·0.2×)':'') : '❌ 未达标，无收益')
  }

  Wolf.handleSettleExp = function () {
    Wolf.state.tempLog.expTitle = (document.getElementById('exp-title') && document.getElementById('exp-title').value) || ''
    Wolf.state.tempLog.expNote = (document.getElementById('exp-note') && document.getElementById('exp-note').value) || ''
    if (!Wolf.state.tempLog.expType) { Wolf.showToast('请选择阅历类型'); return }
    var data = Wolf.getDayData()
    var node = Wolf.getNode(data, Wolf.state.currentNodeId)
    if (!node) { Wolf.goToBedroom(); return }
    var isLate = Wolf.isNodeLate(node)
    var score = Wolf.scoreNodeCompletion(node, Wolf.state.tempLog)
    var result = Wolf.calcCompletionResult(node, Wolf.state.tempLog, isLate)
    node.doneCount = node.count; node.done = true
    node.log = { settledAt: Date.now(), completionScore: score, settlementResult: result, isLate: isLate }
    Wolf.applyCompletionResult(data, result)
    Wolf.calcPassionProgress(data)
    Wolf.checkAndAutoCompleteTasks(data)
    Wolf.saveLog({ type: 'experience', actionType: node.actionType, subtype: Wolf.state.tempLog.expType, result: result })
    Wolf.goToBedroom()
    Wolf.showToast(result.passed ? '📖 完成！得分 ' + score + (isLate?' (补记·0.2×)':'') : '❌ 未达标，无收益')
    // 写入阅历树
    if (result.passed) {
      Wolf._ensureTreesLoaded(function () {
        Wolf.addExperienceEntry(Wolf.state.tempLog.expType, { title: Wolf.state.tempLog.expTitle, note: Wolf.state.tempLog.expNote })
      })
    }
  }

  window.Wolf = Wolf
})()
