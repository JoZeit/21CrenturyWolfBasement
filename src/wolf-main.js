/* ============================================================
   wolf-main.js — 初始化入口（PWA + 导出导入 + 启动页）
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  // 注册 Service Worker（PWA 离线支持）
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {})
  }

  var splash = document.getElementById('splash-screen')

  splash.addEventListener('click', function () {
    splash.classList.add('fade-out')
    setTimeout(function () { Wolf.init() }, 600)
  })

  document.addEventListener('keydown', function handler(e) {
    if (!splash.classList.contains('fade-out')) {
      splash.classList.add('fade-out')
      setTimeout(function () { Wolf.init() }, 600)
      document.removeEventListener('keydown', handler)
    }
  })
})

Wolf.init = function () {
  var data = Wolf.getDayData()
  if (!data.nodes || data.nodes.length === 0) {
    var fresh = Wolf.createNewDay()
    Object.assign(data, fresh)
  }

  Wolf._bindStaticNav()
  Wolf._bindMascotActions()
  Wolf._bindMenu()
  Wolf.render()

  console.log('🐺 地下室系统已就绪 | v3 PWA')
}

// ==================== 导出全部数据 ====================
Wolf.exportAll = async function () {
  var pack = {
    version: 3,
    exportedAt: new Date().toISOString(),
    dayData: Wolf.getDayData(),
    trees: await Wolf.loadTrees(),
  }
  var json = JSON.stringify(pack, null, 2)
  var blob = new Blob([json], { type: 'application/json' })
  var url = URL.createObjectURL(blob)
  var a = document.createElement('a')
  a.href = url
  a.download = 'wolf-basement-' + Wolf.todayStr() + '.json'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  Wolf.showToast('📦 数据已导出！(' + Math.round(json.length/1024) + 'KB)')
}

// ==================== 导入数据 ====================
Wolf.importAll = function () {
  Wolf.showModal('📥 导入数据',
    '<p style=\"color:var(--text-dim);margin-bottom:12px;\">选择之前导出的 JSON 文件。<br>将覆盖当前当日数据和三树。</p>\
    <div class=\"form-group\">\
      <input type=\"file\" id=\"import-file\" accept=\".json\" style=\"font-size:13px;\">\
    </div>\
    <div id=\"import-msg\" style=\"font-size:12px;color:var(--text-muted);\"></div>',
    [
      { label: '导入', action: 'do-import', cls: 'btn-primary' },
      { label: '取消', action: 'cancel-modal', cls: 'btn-outline' },
    ]
  )
  Wolf.modalHandlers['do-import'] = function () {
    var fileInput = document.getElementById('import-file')
    var file = fileInput ? fileInput.files[0] : null
    if (!file) { Wolf.showToast('⚠️ 请选择文件'); return }

    var reader = new FileReader()
    reader.onload = async function (e) {
      try {
        var pack = JSON.parse(e.target.result)
        if (!pack.version || !pack.dayData) { throw new Error('无效的导出文件') }

        // 恢复当日数据
        localStorage.setItem('***', JSON.stringify(pack.dayData))
        // 恢复三树
        if (pack.trees) {
          Wolf.state.trees = pack.trees
          await Wolf.saveTrees(pack.trees)
        }

        Wolf.closeModal()
        Wolf.init()
        Wolf.showToast('📥 数据导入成功！')
      } catch (err) {
        document.getElementById('import-msg').textContent = '❌ 导入失败：' + err.message
      }
    }
    reader.readAsText(file)
  }
}

// ==================== 静态导航绑定 ====================
Wolf._bindStaticNav = function () {
  var footer = document.getElementById('game-footer')
  if (!footer) return
  footer.querySelectorAll('[data-action=\"nav-to\"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (Wolf.state.timer.intervalId) {
        if (!confirm('学习计时进行中，确定切换吗？')) return
        Wolf.stopTimer()
      }
      Wolf.navigateTo(btn.dataset.view)
    })
  })
}

Wolf._bindMascotActions = function () {
  var switchBtn = document.getElementById('ma-switch')
  var talkBtn = document.getElementById('ma-talk')
  if (switchBtn) switchBtn.addEventListener('click', function () { Wolf.showToast('🔄 角色切换功能即将开放') })
  if (talkBtn) talkBtn.addEventListener('click', function () {
    var dialogEl = document.getElementById('dialog-text')
    if (dialogEl) dialogEl.textContent = Wolf.randomQuote()
    Wolf.showToast('💬 看板娘有话要说...')
  })
}

// ==================== 菜单按钮 ====================
Wolf._bindMenu = function () {
  var menuBtn = document.getElementById('gh-menu')
  if (!menuBtn) return

  menuBtn.addEventListener('click', function () {
    var menuItems = [
      { icon: '🏠', label: '卧室（节点列表）', view: 'bedroom' },
      { icon: '📊', label: '个人数值', view: 'stats-panel' },
      { icon: '📋', label: '今日总结', view: 'logs' },
      { icon: '🌳', label: '三树系统', view: 'trees' },
      { icon: '📤', label: '导出数据', action: 'export' },
      { icon: '📥', label: '导入数据', action: 'import' },
    ]
    var bodyHTML = '<div style=\"display:flex;flex-direction:column;gap:6px;\">'
    menuItems.forEach(function (item) {
      if (item.view) {
        bodyHTML += '<button class=\"btn btn-outline btn-block\" data-action=\"menu-nav\" data-view=\"' + item.view + '\" style=\"justify-content:flex-start;text-align:left;\"><span style=\"font-size:18px;\">' + item.icon + '</span> ' + item.label + '</button>'
      } else if (item.action === 'export') {
        bodyHTML += '<button class=\"btn btn-outline btn-block\" data-action=\"menu-export\" style=\"justify-content:flex-start;text-align:left;color:var(--fire);\"><span style=\"font-size:18px;\">' + item.icon + '</span> ' + item.label + '</button>'
      } else if (item.action === 'import') {
        bodyHTML += '<button class=\"btn btn-outline btn-block\" data-action=\"menu-import\" style=\"justify-content:flex-start;text-align:left;\"><span style=\"font-size:18px;\">' + item.icon + '</span> ' + item.label + '</button>'
      }
    })
    bodyHTML += '</div>'

    Wolf.showModal('☰ 菜单', bodyHTML, [{ label: '关闭', action: 'cancel-modal', cls: 'btn-outline' }])

    Wolf.modalHandlers['menu-nav'] = function (e) {
      Wolf.closeModal()
      if (e.target.dataset.view) Wolf.navigateTo(e.target.dataset.view)
    }
    Wolf.modalHandlers['menu-export'] = function () {
      Wolf.closeModal()
      Wolf.exportAll()
    }
    Wolf.modalHandlers['menu-import'] = function () {
      Wolf.closeModal()
      Wolf.importAll()
    }
  })
}
