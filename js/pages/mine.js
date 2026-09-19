/* ============================================
   我的页 · 阶段 2.2
   预算设置（每日 / 月度 / 年度）与其余设置占位
   ============================================ */
(function () {
  'use strict';

  const THEMES = [
    { key: 'blue', name: '淡蓝', color: '#5B9BD5' },
    { key: 'pink', name: '淡粉', color: '#E88BAD' },
    { key: 'white', name: '白色', color: '#9CA3AF' },
    { key: 'black', name: '黑色', color: '#1F2937' },
    { key: 'mint', name: '薄荷绿', color: '#5BBFA3' },
    { key: 'lavender', name: '浅紫', color: '#9B8AE0' }
  ];

  const CAT_ICONS = [
    '🍜', '☕', '🍔', '🍎', '🚌', '🚕', '✈️', '⛽',
    '🛍️', '👕', '💄', '🛒', '🎮', '🎬', '🎤', '📚',
    '🏠', '💡', '📱', '💻', '🏥', '💊', '🎓', '🎁',
    '💼', '🧧', '💰', '📈', '🐱', '🏋️', '🧾', '其他'
  ];

  const APP_VERSION = '正式版 v1.0.0';

  let dailyBudgetCents = null;
  let monthlyBudgetCents = null;
  let yearlyBudgetCents = null;
  let allRecords = [];
  let categories = [];
  let tags = [];
  let methods = [];
  let subMethods = [];
  let banks = [];
  let editingBudget = 'daily';
  let themeKey = 'blue';
  let quickActionsOn = true;
  let catAddType = 'expense';
  let catAddIcon = '🍜';
  let catEditId = '';
  let catDeleteId = '';
  let tagEditId = '';
  let tagDeleteId = '';
  let methodEditId = '';
  let methodDeleteId = '';
  let subManageMethodId = '';
  let subEditId = '';
  let subDeleteId = '';
  let bankEditId = '';
  let bankDeleteId = '';
  let exportCsvContent = '';
  let exportFileName = '';

  function fmtMoney(cents) {
    return (cents / 100).toFixed(2);
  }

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function dateKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function settingValue(settings, key) {
    const s = settings.find(function (x) {
      return x.key === key;
    });
    return s ? s.value : null;
  }

  function effMonthly() {
    if (monthlyBudgetCents != null) {
      return monthlyBudgetCents;
    }
    return dailyBudgetCents != null ? dailyBudgetCents * 30 : null;
  }

  function effYearly() {
    if (yearlyBudgetCents != null) {
      return yearlyBudgetCents;
    }
    const m = effMonthly();
    return m != null ? m * 12 : null;
  }

  function sumExpense(matchFn) {
    let total = 0;
    allRecords.forEach(function (r) {
      if (r.type === 'expense' && matchFn(r)) {
        total += r.amountCents;
      }
    });
    return total;
  }

  function todaySpent() {
    const now = new Date();
    return sumExpense(function (r) {
      const d = new Date(r.time);
      return d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate() &&
        !r.noDailyBudget;
    });
  }

  function monthSpent() {
    const now = new Date();
    return sumExpense(function (r) {
      const d = new Date(r.time);
      return d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        !r.noMonthlyBudget;
    });
  }

  function yearSpent() {
    const now = new Date();
    return sumExpense(function (r) {
      const d = new Date(r.time);
      return d.getFullYear() === now.getFullYear() &&
        !r.noYearlyBudget;
    });
  }

  function budgetRow(key, name, explicit, eff, spent) {
    if (eff == null) {
      return '<div class="budget-row" data-key="' + key + '">' +
        '<div class="budget-row-head"><span class="budget-row-name">' + name + '</span>' +
        '<span class="budget-row-value dim">未设置</span></div>' +
        '<div class="budget-row-sub dim">点击设置' +
          (key === 'daily' ? '' : '（未设置时按日预算自动计算）') +
        '</div>' +
      '</div>';
    }
    const derived = explicit == null && key !== 'daily';
    const over = spent > eff;
    const pct = eff > 0 ? Math.min(100, Math.round(spent / eff * 100)) : 0;
    const remain = eff - spent;
    const subText = '已用 ¥' + fmtMoney(spent) +
      (over ? ' · 超支 ¥' + fmtMoney(-remain) : ' · 剩余 ¥' + fmtMoney(remain));
    return '<div class="budget-row" data-key="' + key + '">' +
      '<div class="budget-row-head"><span class="budget-row-name">' + name + '</span>' +
      '<span class="budget-row-value">¥' + fmtMoney(eff) + (derived ? ' <span class="budget-default">默认</span>' : '') + '</span></div>' +
      '<div class="budget-row-sub' + (over ? ' over' : '') + '">' + subText + '</div>' +
      '<div class="budget-progress"><div class="budget-progress-inner" style="width:' + pct +
        '%;background:' + (over ? '#E5484D' : 'var(--primary)') + ';"></div></div>' +
    '</div>';
  }

  function renderBudgetList() {
    const list = document.getElementById('budgetList');
    list.innerHTML =
      budgetRow('daily', '每日预算', dailyBudgetCents, dailyBudgetCents, todaySpent()) +
      budgetRow('monthly', '月度预算', monthlyBudgetCents, effMonthly(), monthSpent()) +
      budgetRow('yearly', '年度预算', yearlyBudgetCents, effYearly(), yearSpent());
    list.querySelectorAll('.budget-row').forEach(function (row) {
      row.addEventListener('click', function () {
        openBudgetModal(row.dataset.key);
      });
    });
  }

  function openBudgetModal(key) {
    editingBudget = key;
    const titles = { daily: '每日预算', monthly: '月度预算', yearly: '年度预算' };
    document.getElementById('budgetModalTitle').textContent = '设置' + titles[key];
    const current = key === 'daily'
      ? dailyBudgetCents
      : key === 'monthly'
        ? monthlyBudgetCents
        : yearlyBudgetCents;
    document.getElementById('budgetInput').value = current != null ? (current / 100).toString() : '';
    let hint = '仅统计支出（不含转账）。';
    if (key === 'monthly') {
      hint += '未单独设置时按"每日 × 30"自动计算。';
    }
    if (key === 'yearly') {
      hint += '未单独设置时按"月度 × 12"自动计算。';
    }
    document.getElementById('budgetHint').textContent = hint;
    document.getElementById('budgetModalMask').hidden = false;
  }

  async function saveBudget() {
    const input = document.getElementById('budgetInput');
    const val = parseFloat(input.value);
    if (!(val > 0)) {
      showToast('请输入大于 0 的金额');
      return;
    }
    const cents = Math.round(val * 100);
    const key = editingBudget + 'Budget';
    try {
      await DB.put(DB.stores.settings, { key: key, value: cents });
      if (editingBudget === 'daily') {
        dailyBudgetCents = cents;
      } else if (editingBudget === 'monthly') {
        monthlyBudgetCents = cents;
      } else {
        yearlyBudgetCents = cents;
      }
      document.getElementById('budgetModalMask').hidden = true;
      renderBudgetList();
      showToast('预算已保存');
    } catch (err) {
      console.error('[小账本] 保存预算失败', err);
      showToast('保存失败，请重试');
    }
  }

  function renderThemeGrid() {
    const grid = document.getElementById('themeGrid');
    if (!grid) {
      return;
    }
    grid.innerHTML = THEMES.map(function (t) {
      return '<button class="theme-item' + (themeKey === t.key ? ' active' : '') + '" data-key="' +
        t.key + '" type="button">' +
        '<span class="theme-dot" style="background:' + t.color + ';"></span>' +
        '<span class="theme-name">' + t.name + '</span>' +
      '</button>';
    }).join('');
    grid.querySelectorAll('.theme-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setTheme(btn.dataset.key);
      });
    });
  }

  async function setTheme(key) {
    themeKey = key;
    Theme.applyTheme(key);
    try {
      await DB.put(DB.stores.settings, { key: 'theme', value: key });
    } catch (err) {
      console.error('[小账本] 保存主题失败', err);
    }
    renderThemeGrid();
    showToast('已切换主题');
  }

  function openCatManage() {
    document.getElementById('catManageMask').hidden = false;
    renderCatManageList();
  }

  function closeCatManage() {
    document.getElementById('catManageMask').hidden = true;
    catEditId = '';
    catDeleteId = '';
  }

  function renderCatManageList() {
    const list = document.getElementById('catManageList');
    const exp = categories.filter(function (c) {
      return c.type === 'expense';
    }).sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
    const inc = categories.filter(function (c) {
      return c.type === 'income';
    }).sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
    list.innerHTML = '<div class="manage-group-title">支出分类</div>' +
      catRows(exp) +
      '<div class="manage-group-title">收入分类</div>' +
      catRows(inc);
    list.querySelectorAll('.manage-row').forEach(function (row) {
      const id = row.dataset.id;
      row.querySelectorAll('.manage-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.dataset.act === 'edit') {
            openCatEdit(id);
          } else if (btn.dataset.act === 'del') {
            openCatDelete(id);
          }
        });
      });
    });
  }

  function catRows(items) {
    return items.map(function (c) {
      return '<div class="manage-row" data-id="' + escapeHtml(c.id) + '">' +
        '<span class="cat-row-icon">' + c.icon + '</span>' +
        '<span class="row-name">' + escapeHtml(c.name) +
          (c.builtin ? ' <span class="row-badge">内置</span>' : '') +
        '</span>' +
        '<button class="manage-btn" data-act="edit" type="button">✏️</button>' +
        (c.builtin
          ? ''
          : '<button class="manage-btn danger" data-act="del" type="button">删除</button>') +
      '</div>';
    }).join('');
  }

  function openCatAdd() {
    catAddType = 'expense';
    catAddIcon = '🍜';
    document.getElementById('catAddMask').hidden = false;
    document.getElementById('catAddName').value = '';
    renderCatAddForm();
    document.getElementById('catAddName').focus();
  }

  function renderCatAddForm() {
    document.querySelectorAll('#catAddTypeBtns .type-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.type === catAddType);
    });
    renderIconGrid();
  }

  function renderIconGrid() {
    const grid = document.getElementById('catIconGrid');
    grid.innerHTML = CAT_ICONS.map(function (icon) {
      return '<button class="cat-icon-item' + (catAddIcon === icon ? ' active' : '') +
        '" data-icon="' + icon + '" type="button">' + icon + '</button>';
    }).join('');
    grid.querySelectorAll('.cat-icon-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        catAddIcon = btn.dataset.icon;
        grid.querySelectorAll('.cat-icon-item').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
      });
    });
  }

  async function confirmAddCat() {
    const name = (document.getElementById('catAddName').value || '').trim();
    if (!name) {
      showToast('请输入分类名称');
      return;
    }
    if (categories.some(function (c) {
      return c.type === catAddType && c.name === name;
    })) {
      showToast('该分类已存在');
      return;
    }
    const cat = {
      id: genId(),
      name: name,
      icon: catAddIcon,
      type: catAddType,
      builtin: false
    };
    try {
      await DB.put(DB.stores.categories, cat);
      categories.push(cat);
      document.getElementById('catAddMask').hidden = true;
      renderCatManageList();
      showToast('已添加分类');
    } catch (err) {
      console.error('[小账本] 添加分类失败', err);
      showToast('添加失败，请重试');
    }
  }

  function openCatEdit(id) {
    const c = categories.find(function (x) {
      return x.id === id;
    });
    if (!c) {
      return;
    }
    catEditId = id;
    catDeleteId = '';
    document.getElementById('catDeleteRow').hidden = true;
    document.getElementById('catEditRow').hidden = false;
    document.getElementById('catEditInput').value = c.name;
    document.getElementById('catEditInput').focus();
  }

  async function confirmCatEdit() {
    const name = (document.getElementById('catEditInput').value || '').trim();
    if (!name) {
      showToast('分类名称不能为空');
      return;
    }
    const c = categories.find(function (x) {
      return x.id === catEditId;
    });
    if (!c) {
      return;
    }
    if (categories.some(function (x) {
      return x.id !== catEditId && x.type === c.type && x.name === name;
    })) {
      showToast('该分类已存在');
      return;
    }
    c.name = name;
    try {
      await DB.put(DB.stores.categories, c);
      document.getElementById('catEditRow').hidden = true;
      catEditId = '';
      renderCatManageList();
      showToast('分类已更新');
    } catch (err) {
      console.error('[小账本] 修改分类失败', err);
      showToast('修改失败，请重试');
    }
  }

  function openCatDelete(id) {
    const c = categories.find(function (x) {
      return x.id === id;
    });
    if (!c) {
      return;
    }
    catDeleteId = id;
    catEditId = '';
    document.getElementById('catEditRow').hidden = true;
    document.getElementById('catDeleteText').textContent =
      '确认删除分类「' + c.name + '」？历史账单将显示为"其他"。';
    document.getElementById('catDeleteRow').hidden = false;
  }

  async function confirmCatDelete() {
    const c = categories.find(function (x) {
      return x.id === catDeleteId;
    });
    if (!c) {
      return;
    }
    try {
      const tagIds = tags.filter(function (t) {
        return t.categoryId === c.id;
      }).map(function (t) {
        return t.id;
      });
      await Promise.all(tagIds.map(function (id) {
        return DB.remove(DB.stores.tags, id);
      }));
      await DB.remove(DB.stores.categories, c.id);
      categories = categories.filter(function (x) {
        return x.id !== c.id;
      });
      tags = tags.filter(function (t) {
        return t.categoryId !== c.id;
      });
      catDeleteId = '';
      document.getElementById('catDeleteRow').hidden = true;
      renderCatManageList();
      showToast('分类已删除');
    } catch (err) {
      console.error('[小账本] 删除分类失败', err);
      showToast('删除失败，请重试');
    }
  }

  function openTagManage() {
    document.getElementById('tagManageMask').hidden = false;
    renderTagManageList();
  }

  function closeTagManage() {
    document.getElementById('tagManageMask').hidden = true;
    tagEditId = '';
    tagDeleteId = '';
  }

  function tagUsage(id) {
    let n = 0;
    allRecords.forEach(function (r) {
      if (r.tagId === id) {
        n++;
      }
    });
    return n;
  }

  function renderTagManageList() {
    const list = document.getElementById('tagManageList');
    const groups = {};
    tags.forEach(function (t) {
      const cat = categories.find(function (c) {
        return c.id === t.categoryId;
      });
      const key = cat ? cat.name : '未分类';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(t);
    });
    let html = '';
    Object.keys(groups).sort().forEach(function (key) {
      html += '<div class="manage-group-title">' + escapeHtml(key) + '</div>';
      groups[key].sort(function (a, b) {
        return (b.usageCount || 0) - (a.usageCount || 0);
      }).forEach(function (t) {
        html += '<div class="manage-row" data-id="' + escapeHtml(t.id) + '">' +
          '<span class="row-name">' + escapeHtml(t.name) + '</span>' +
          '<span class="tag-usage">' + tagUsage(t.id) + ' 次</span>' +
          '<button class="manage-btn" data-act="edit" type="button">✏️</button>' +
          '<button class="manage-btn danger" data-act="del" type="button">删除</button>' +
        '</div>';
      });
    });
    if (!html) {
      html = '<p class="tag-empty">还没有标签，记账时在分类下拉里添加</p>';
    }
    list.innerHTML = html;
    list.querySelectorAll('.manage-row').forEach(function (row) {
      const id = row.dataset.id;
      row.querySelectorAll('.manage-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.dataset.act === 'edit') {
            openTagEdit(id);
          } else if (btn.dataset.act === 'del') {
            openTagDelete(id);
          }
        });
      });
    });
  }

  function openTagEdit(id) {
    const t = tags.find(function (x) {
      return x.id === id;
    });
    if (!t) {
      return;
    }
    tagEditId = id;
    tagDeleteId = '';
    document.getElementById('tagDeleteRow').hidden = true;
    document.getElementById('tagEditRow').hidden = false;
    document.getElementById('tagEditInput').value = t.name;
    document.getElementById('tagEditInput').focus();
  }

  async function confirmTagEdit() {
    const name = (document.getElementById('tagEditInput').value || '').trim();
    if (!name) {
      showToast('标签名称不能为空');
      return;
    }
    const t = tags.find(function (x) {
      return x.id === tagEditId;
    });
    if (!t) {
      return;
    }
    if (tags.some(function (x) {
      return x.id !== tagEditId && x.categoryId === t.categoryId && x.name === name;
    })) {
      showToast('该分类下已存在同名标签');
      return;
    }
    t.name = name;
    try {
      await DB.put(DB.stores.tags, t);
      document.getElementById('tagEditRow').hidden = true;
      tagEditId = '';
      renderTagManageList();
      showToast('标签已更新');
    } catch (err) {
      console.error('[小账本] 修改标签失败', err);
      showToast('修改失败，请重试');
    }
  }

  function openTagDelete(id) {
    const t = tags.find(function (x) {
      return x.id === id;
    });
    if (!t) {
      return;
    }
    tagDeleteId = id;
    tagEditId = '';
    document.getElementById('tagEditRow').hidden = true;
    document.getElementById('tagDeleteText').textContent =
      '确认删除标签「' + t.name + '」？历史账单将显示为"（标签已删除）"。';
    document.getElementById('tagDeleteRow').hidden = false;
  }

  async function confirmTagDelete() {
    const t = tags.find(function (x) {
      return x.id === tagDeleteId;
    });
    if (!t) {
      return;
    }
    try {
      await DB.remove(DB.stores.tags, t.id);
      tags = tags.filter(function (x) {
        return x.id !== t.id;
      });
      tagDeleteId = '';
      document.getElementById('tagDeleteRow').hidden = true;
      renderTagManageList();
      showToast('标签已删除');
    } catch (err) {
      console.error('[小账本] 删除标签失败', err);
      showToast('删除失败，请重试');
    }
  }

  function sortedMethods() {
    return methods.slice().sort(function (a, b) {
      const diff = (a.sortOrder || 0) - (b.sortOrder || 0);
      if (diff !== 0) {
        return diff;
      }
      return a.name.localeCompare(b.name);
    });
  }

  function subsOf(methodId) {
    return subMethods.filter(function (s) {
      return s.methodId === methodId;
    });
  }

  function nextMethodSort() {
    let max = 0;
    methods.forEach(function (m) {
      if ((m.sortOrder || 0) > max) {
        max = m.sortOrder || 0;
      }
    });
    return max + 1;
  }

  function openMethodManage() {
    document.getElementById('mineMethodManageMask').hidden = false;
    renderMethodManageList();
  }

  function closeMethodManage() {
    document.getElementById('mineMethodManageMask').hidden = true;
    methodEditId = '';
    methodDeleteId = '';
  }

  function renderMethodManageList() {
    const list = document.getElementById('mineMethodManageList');
    list.innerHTML = sortedMethods().map(function (m) {
      return '<div class="manage-row" data-id="' + escapeHtml(m.id) + '">' +
        '<span class="row-name">' + escapeHtml(m.name) +
          (m.builtin ? ' <span class="row-badge">内置</span>' : '') +
        '</span>' +
        '<button class="manage-btn" data-act="up" type="button">↑</button>' +
        '<button class="manage-btn" data-act="down" type="button">↓</button>' +
        '<button class="manage-btn" data-act="sub" type="button">二级</button>' +
        '<button class="manage-btn" data-act="edit" type="button">✏️</button>' +
        (m.builtin
          ? '<button class="manage-btn" data-act="hide" type="button">' + (m.hidden ? '显示' : '隐藏') + '</button>'
          : '<button class="manage-btn danger" data-act="del" type="button">删除</button>') +
      '</div>';
    }).join('');
    list.querySelectorAll('.manage-row').forEach(function (row) {
      const id = row.dataset.id;
      row.querySelectorAll('.manage-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const act = btn.dataset.act;
          if (act === 'up') moveMethod(id, -1);
          else if (act === 'down') moveMethod(id, 1);
          else if (act === 'sub') openSubManage(id);
          else if (act === 'edit') openMethodEdit(id);
          else if (act === 'del') openMethodDelete(id);
          else if (act === 'hide') toggleMethodHidden(id);
        });
      });
    });
  }

  async function moveMethod(id, dir) {
    const items = sortedMethods();
    const index = items.findIndex(function (m) {
      return m.id === id;
    });
    const target = index + dir;
    if (index === -1 || target < 0 || target >= items.length) {
      return;
    }
    const a = items[index];
    const b = items[target];
    const tmp = a.sortOrder;
    a.sortOrder = b.sortOrder;
    b.sortOrder = tmp;
    try {
      await Promise.all([
        DB.put(DB.stores.paymentMethods, a),
        DB.put(DB.stores.paymentMethods, b)
      ]);
      renderMethodManageList();
    } catch (err) {
      console.error('[小账本] 排序失败', err);
      showToast('排序失败，请重试');
    }
  }

  function openMethodEdit(id) {
    const m = methods.find(function (x) {
      return x.id === id;
    });
    if (!m) {
      return;
    }
    methodEditId = id;
    methodDeleteId = '';
    document.getElementById('mineMethodDeleteRow').hidden = true;
    document.getElementById('mineMethodEditRow').hidden = false;
    document.getElementById('mineMethodEditInput').value = m.name;
    document.getElementById('mineMethodEditRoleExpense').checked = m.canExpense !== false;
    document.getElementById('mineMethodEditRoleIncome').checked = m.canIncome !== false;
    document.getElementById('mineMethodEditRoleTransferFrom').checked = m.canTransferFrom !== false;
    document.getElementById('mineMethodEditRoleTransferTo').checked = m.canTransferTo !== false;
    document.getElementById('mineMethodEditInput').focus();
  }

  async function confirmMethodEdit() {
    const name = (document.getElementById('mineMethodEditInput').value || '').trim();
    if (!name) {
      showToast('名称不能为空');
      return;
    }
    const m = methods.find(function (x) {
      return x.id === methodEditId;
    });
    if (!m) {
      return;
    }
    if (methods.some(function (x) {
      return x.id !== methodEditId && x.name === name;
    })) {
      showToast('该名称已存在');
      return;
    }
    m.name = name;
    m.canExpense = document.getElementById('mineMethodEditRoleExpense').checked;
    m.canIncome = document.getElementById('mineMethodEditRoleIncome').checked;
    m.canTransferFrom = document.getElementById('mineMethodEditRoleTransferFrom').checked;
    m.canTransferTo = document.getElementById('mineMethodEditRoleTransferTo').checked;
    try {
      await DB.put(DB.stores.paymentMethods, m);
      document.getElementById('mineMethodEditRow').hidden = true;
      methodEditId = '';
      renderMethodManageList();
      showToast('方式已更新');
    } catch (err) {
    console.error('[小账本] 修改收支方式失败', err);
      showToast('修改失败，请重试');
    }
  }

  function openMethodDelete(id) {
    const m = methods.find(function (x) {
      return x.id === id;
    });
    if (!m) {
      return;
    }
    methodDeleteId = id;
    methodEditId = '';
    document.getElementById('mineMethodEditRow').hidden = true;
    document.getElementById('mineMethodDeleteText').textContent =
      '确认删除「' + m.name + '」？历史账单不受影响。';
    document.getElementById('mineMethodDeleteRow').hidden = false;
  }

  async function confirmMethodDelete() {
    const m = methods.find(function (x) {
      return x.id === methodDeleteId;
    });
    if (!m) {
      return;
    }
    try {
      await DB.remove(DB.stores.paymentMethods, m.id);
      const subs = subsOf(m.id);
      await Promise.all(subs.map(function (s) {
        return DB.remove(DB.stores.subMethods, s.id);
      }));
      methods = methods.filter(function (x) {
        return x.id !== m.id;
      });
      subMethods = subMethods.filter(function (s) {
        return s.methodId !== m.id;
      });
      methodDeleteId = '';
      document.getElementById('mineMethodDeleteRow').hidden = true;
      renderMethodManageList();
      showToast('已删除');
    } catch (err) {
    console.error('[小账本] 删除收支方式失败', err);
      showToast('删除失败，请重试');
    }
  }

  async function toggleMethodHidden(id) {
    const m = methods.find(function (x) {
      return x.id === id;
    });
    if (!m) {
      return;
    }
    m.hidden = !m.hidden;
    try {
      await DB.put(DB.stores.paymentMethods, m);
      renderMethodManageList();
    } catch (err) {
      console.error('[小账本] 隐藏/显示失败', err);
      showToast('操作失败，请重试');
    }
  }

  function openAddMethod() {
    ['mineRoleExpense', 'mineRoleIncome', 'mineRoleTransferFrom', 'mineRoleTransferTo'].forEach(function (id) {
      document.getElementById(id).checked = true;
    });
    document.getElementById('mineAddMethodMask').hidden = false;
    document.getElementById('mineAddMethodInput').value = '';
    document.getElementById('mineAddMethodInput').focus();
  }

  async function confirmAddMethod() {
    const name = (document.getElementById('mineAddMethodInput').value || '').trim();
    if (!name) {
      showToast('请输入收支方式名称');
      return;
    }
    if (methods.some(function (m) {
      return m.name === name;
    })) {
      showToast('该收支方式已存在');
      return;
    }
    const method = {
      id: genId(),
      name: name,
      builtin: false,
      sortOrder: nextMethodSort(),
      canExpense: document.getElementById('mineRoleExpense').checked,
      canIncome: document.getElementById('mineRoleIncome').checked,
      canTransferFrom: document.getElementById('mineRoleTransferFrom').checked,
      canTransferTo: document.getElementById('mineRoleTransferTo').checked
    };
    try {
      await DB.put(DB.stores.paymentMethods, method);
      methods.push(method);
      document.getElementById('mineAddMethodMask').hidden = true;
      renderMethodManageList();
      showToast('已添加：' + name);
    } catch (err) {
    console.error('[小账本] 添加收支方式失败', err);
      showToast('添加失败，请重试');
    }
  }

  function openSubManage(methodId) {
    subManageMethodId = methodId;
    const m = methods.find(function (x) {
      return x.id === methodId;
    });
    document.getElementById('subManageTitle').textContent =
      '二级方式' + (m ? ' · ' + m.name : '');
    document.getElementById('subManageMask').hidden = false;
    renderSubManageList();
  }

  function closeSubManage() {
    document.getElementById('subManageMask').hidden = true;
    subEditId = '';
    subDeleteId = '';
  }

  function renderSubManageList() {
    const list = document.getElementById('subManageList');
    const subs = subsOf(subManageMethodId);
    if (!subs.length) {
      list.innerHTML = '<p class="tag-empty">还没有二级方式，点下方"＋ 添加二级"</p>';
      return;
    }
    list.innerHTML = subs.map(function (s) {
      return '<div class="manage-row" data-id="' + escapeHtml(s.id) + '">' +
        '<span class="row-name">' + escapeHtml(s.name) +
          (s.builtin ? ' <span class="row-badge">内置</span>' : '') +
        '</span>' +
        '<button class="manage-btn" data-act="edit" type="button">✏️</button>' +
        (s.builtin ? '' : '<button class="manage-btn danger" data-act="del" type="button">删除</button>') +
      '</div>';
    }).join('');
    list.querySelectorAll('.manage-row').forEach(function (row) {
      const id = row.dataset.id;
      row.querySelectorAll('.manage-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.dataset.act === 'edit') {
            openSubEdit(id);
          } else if (btn.dataset.act === 'del') {
            openSubDelete(id);
          }
        });
      });
    });
  }

  function openSubAdd() {
    document.getElementById('subAddRow').hidden = false;
    document.getElementById('subAddInput').value = '';
    document.getElementById('subAddInput').focus();
  }

  async function confirmSubAdd() {
    const name = (document.getElementById('subAddInput').value || '').trim();
    if (!name) {
      showToast('请输入二级方式名称');
      return;
    }
    if (subsOf(subManageMethodId).some(function (s) {
      return s.name === name;
    })) {
      showToast('该二级方式已存在');
      return;
    }
    const sub = {
      id: genId(),
      methodId: subManageMethodId,
      name: name,
      bankName: ''
    };
    try {
      await DB.put(DB.stores.subMethods, sub);
      subMethods.push(sub);
      document.getElementById('subAddRow').hidden = true;
      renderSubManageList();
      showToast('已添加二级方式');
    } catch (err) {
      console.error('[小账本] 添加二级方式失败', err);
      showToast('添加失败，请重试');
    }
  }

  function openSubEdit(id) {
    const s = subMethods.find(function (x) {
      return x.id === id;
    });
    if (!s) {
      return;
    }
    subEditId = id;
    subDeleteId = '';
    document.getElementById('subDeleteRow').hidden = true;
    document.getElementById('subEditRow').hidden = false;
    document.getElementById('subEditInput').value = s.name;
    document.getElementById('subEditInput').focus();
  }

  async function confirmSubEdit() {
    const name = (document.getElementById('subEditInput').value || '').trim();
    if (!name) {
      showToast('名称不能为空');
      return;
    }
    const s = subMethods.find(function (x) {
      return x.id === subEditId;
    });
    if (!s) {
      return;
    }
    if (subsOf(s.methodId).some(function (x) {
      return x.id !== subEditId && x.name === name;
    })) {
      showToast('该二级方式已存在');
      return;
    }
    s.name = name;
    try {
      await DB.put(DB.stores.subMethods, s);
      document.getElementById('subEditRow').hidden = true;
      subEditId = '';
      renderSubManageList();
      showToast('已更新');
    } catch (err) {
      console.error('[小账本] 修改二级方式失败', err);
      showToast('修改失败，请重试');
    }
  }

  function openSubDelete(id) {
    const s = subMethods.find(function (x) {
      return x.id === id;
    });
    if (!s) {
      return;
    }
    if (s.builtin) {
      showToast('内置二级方式不可删除');
      return;
    }
    subDeleteId = id;
    subEditId = '';
    document.getElementById('subEditRow').hidden = true;
    document.getElementById('subDeleteText').textContent =
      '确认删除二级方式「' + s.name + '」？';
    document.getElementById('subDeleteRow').hidden = false;
  }

  async function confirmSubDelete() {
    const s = subMethods.find(function (x) {
      return x.id === subDeleteId;
    });
    if (!s) {
      return;
    }
    if (s.builtin) {
      showToast('内置二级方式不可删除');
      return;
    }
    try {
      await DB.remove(DB.stores.subMethods, s.id);
      subMethods = subMethods.filter(function (x) {
        return x.id !== s.id;
      });
      subDeleteId = '';
      document.getElementById('subDeleteRow').hidden = true;
      renderSubManageList();
      showToast('已删除');
    } catch (err) {
      console.error('[小账本] 删除二级方式失败', err);
      showToast('删除失败，请重试');
    }
  }

  function sortedBanks() {
    return banks.slice().sort(function (a, b) {
      const diff = (a.sortOrder || 0) - (b.sortOrder || 0);
      if (diff !== 0) {
        return diff;
      }
      return a.name.localeCompare(b.name);
    });
  }

  function nextBankSort() {
    let max = 0;
    banks.forEach(function (b) {
      if ((b.sortOrder || 0) > max) {
        max = b.sortOrder || 0;
      }
    });
    return max + 1;
  }

  function openBankManage() {
    document.getElementById('mineBankManageMask').hidden = false;
    renderBankManageList();
  }

  function closeBankManage() {
    document.getElementById('mineBankManageMask').hidden = true;
    bankEditId = '';
    bankDeleteId = '';
  }

  function renderBankManageList() {
    const list = document.getElementById('mineBankManageList');
    list.innerHTML = sortedBanks().map(function (b) {
      const totals = bankTotals(b.name);
      return '<div class="manage-row" data-id="' + escapeHtml(b.id) + '">' +
        '<div class="bank-row-main">' +
          '<span class="row-name bank-view-name" data-id="' + escapeHtml(b.id) + '">' +
            escapeHtml(b.name) + '</span>' +
          '<span class="bank-totals">支 ¥' + fmtMoney(totals.exp) + ' · 收 ¥' + fmtMoney(totals.inc) + '</span>' +
        '</div>' +
        '<button class="manage-btn" data-act="up" type="button">↑</button>' +
        '<button class="manage-btn" data-act="down" type="button">↓</button>' +
        '<button class="manage-btn" data-act="edit" type="button">✏️</button>' +
        '<button class="manage-btn danger" data-act="del" type="button">删除</button>' +
      '</div>';
    }).join('');
    list.querySelectorAll('.bank-view-name').forEach(function (name) {
      name.addEventListener('click', function () {
        viewBank(name.dataset.id);
      });
    });
    list.querySelectorAll('.manage-row').forEach(function (row) {
      const id = row.dataset.id;
      row.querySelectorAll('.manage-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const act = btn.dataset.act;
          if (act === 'up') moveBank(id, -1);
          else if (act === 'down') moveBank(id, 1);
          else if (act === 'edit') openBankEdit(id);
          else if (act === 'del') openBankDelete(id);
        });
      });
    });
  }

  function bankTotals(bankName) {
    let exp = 0;
    let inc = 0;
    allRecords.forEach(function (r) {
      if (r.bankName !== bankName && r.fromBankName !== bankName && r.toBankName !== bankName) {
        return;
      }
      if (r.type === 'income') {
        inc += r.amountCents;
      } else {
        exp += r.amountCents;
      }
    });
    return { exp: exp, inc: inc };
  }

  function viewBank(id) {
    window.PendingBankFilter = { bankId: id };
    location.hash = '#bills';
  }

  async function moveBank(id, dir) {
    const items = sortedBanks();
    const index = items.findIndex(function (b) {
      return b.id === id;
    });
    const target = index + dir;
    if (index === -1 || target < 0 || target >= items.length) {
      return;
    }
    const a = items[index];
    const b = items[target];
    const tmp = a.sortOrder;
    a.sortOrder = b.sortOrder;
    b.sortOrder = tmp;
    try {
      await Promise.all([
        DB.put(DB.stores.banks, a),
        DB.put(DB.stores.banks, b)
      ]);
      renderBankManageList();
    } catch (err) {
      console.error('[小账本] 银行排序失败', err);
      showToast('排序失败，请重试');
    }
  }

  function openBankEdit(id) {
    const b = banks.find(function (x) {
      return x.id === id;
    });
    if (!b) {
      return;
    }
    bankEditId = id;
    bankDeleteId = '';
    document.getElementById('mineBankDeleteRow').hidden = true;
    document.getElementById('mineBankEditRow').hidden = false;
    document.getElementById('mineBankEditInput').value = b.name;
    document.getElementById('mineBankEditInput').focus();
  }

  async function confirmBankEdit() {
    const name = (document.getElementById('mineBankEditInput').value || '').trim();
    if (!name) {
      showToast('银行名称不能为空');
      return;
    }
    const b = banks.find(function (x) {
      return x.id === bankEditId;
    });
    if (!b) {
      return;
    }
    if (banks.some(function (x) {
      return x.id !== bankEditId && x.name === name;
    })) {
      showToast('该银行已存在');
      return;
    }
    b.name = name;
    try {
      await DB.put(DB.stores.banks, b);
      document.getElementById('mineBankEditRow').hidden = true;
      bankEditId = '';
      renderBankManageList();
      showToast('银行已更新');
    } catch (err) {
      console.error('[小账本] 修改银行失败', err);
      showToast('修改失败，请重试');
    }
  }

  function openBankDelete(id) {
    const b = banks.find(function (x) {
      return x.id === id;
    });
    if (!b) {
      return;
    }
    bankDeleteId = id;
    bankEditId = '';
    document.getElementById('mineBankEditRow').hidden = true;
    document.getElementById('mineBankDeleteText').textContent =
      '确认删除银行「' + b.name + '」？历史账单不受影响。';
    document.getElementById('mineBankDeleteRow').hidden = false;
  }

  async function confirmBankDelete() {
    const b = banks.find(function (x) {
      return x.id === bankDeleteId;
    });
    if (!b) {
      return;
    }
    try {
      await DB.remove(DB.stores.banks, b.id);
      banks = banks.filter(function (x) {
        return x.id !== b.id;
      });
      bankDeleteId = '';
      document.getElementById('mineBankDeleteRow').hidden = true;
      renderBankManageList();
      showToast('银行已删除');
    } catch (err) {
      console.error('[小账本] 删除银行失败', err);
      showToast('删除失败，请重试');
    }
  }

  function openBankAdd() {
    document.getElementById('mineBankAddRow').hidden = false;
    document.getElementById('mineBankAddInput').value = '';
    document.getElementById('mineBankAddInput').focus();
  }

  async function confirmBankAdd() {
    const name = (document.getElementById('mineBankAddInput').value || '').trim();
    if (!name) {
      showToast('请输入银行名称');
      return;
    }
    if (banks.some(function (b) {
      return b.name === name;
    })) {
      showToast('该银行已存在');
      return;
    }
    const bank = { id: genId(), name: name, sortOrder: nextBankSort() };
    try {
      await DB.put(DB.stores.banks, bank);
      banks.push(bank);
      document.getElementById('mineBankAddRow').hidden = true;
      renderBankManageList();
      showToast('银行已添加');
    } catch (err) {
      console.error('[小账本] 添加银行失败', err);
      showToast('添加失败，请重试');
    }
  }

  async function clearBudget() {
    const key = editingBudget + 'Budget';
    try {
      await DB.put(DB.stores.settings, { key: key, value: null });
      if (editingBudget === 'daily') {
        dailyBudgetCents = null;
      } else if (editingBudget === 'monthly') {
        monthlyBudgetCents = null;
      } else {
        yearlyBudgetCents = null;
      }
      document.getElementById('budgetModalMask').hidden = true;
      renderBudgetList();
      showToast('预算已清除');
    } catch (err) {
      console.error('[小账本] 清除预算失败', err);
      showToast('清除失败，请重试');
    }
  }

  function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () {
      toast.classList.remove('show');
    }, 2200);
  }

  function amountText(r) {
    const v = fmtMoney(r.amountCents);
    if (r.type === 'expense') {
      return '-' + v;
    }
    if (r.type === 'income') {
      return '+' + v;
    }
    return v;
  }

  function typeText(r) {
    return r.type === 'income' ? '收入' : r.type === 'transfer' ? '转账' : '支出';
  }

  function catText(r) {
    if (r.type === 'transfer') {
      return '转账';
    }
    const cat = categories.find(function (c) {
      return c.id === r.categoryId;
    });
    return cat ? cat.name : '其他';
  }

  function tagText(r) {
    if (!r.tagId) {
      return '';
    }
    const tag = tags.find(function (t) {
      return t.id === r.tagId;
    });
    return tag ? tag.name : '（标签已删除）';
  }

  function sideLabel(r, isFrom) {
    const methodName = isFrom ? r.fromMethodName : r.toMethodName;
    const subName = isFrom ? r.fromSubMethodName : r.toSubMethodName;
    const bankName = isFrom ? r.fromBankName : r.toBankName;
    const methodId = isFrom ? r.fromMethodId : r.toMethodId;
    if (bankName) {
      return bankName;
    }
    const method = methodName || methodNameById(methodId) || '';
    return subName ? method + '·' + subName : method;
  }

  function methodText(r) {
    if (r.type === 'transfer') {
      return sideLabel(r, true) + '-' + sideLabel(r, false);
    }
    const methodName = r.methodName || methodNameById(r.methodId) || '';
    if (r.bankName) {
      return methodName + '·' + r.bankName;
    }
    const subName = r.subMethodName || '';
    return subName ? methodName + '·' + subName : methodName;
  }

  function excText(r) {
    const parts = [];
    if (r.noDailyBudget) {
      parts.push('日');
    }
    if (r.noMonthlyBudget) {
      parts.push('月');
    }
    if (r.noYearlyBudget) {
      parts.push('年');
    }
    return parts.join('、');
  }

  function csvCell(text) {
    const s = String(text == null ? '' : text);
    if (/[",\r\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function buildCSV(from, to) {
    const rows = allRecords.slice().filter(function (r) {
      if (!from && !to) {
        return true;
      }
      const key = dateKey(r.time);
      if (from && key < from) {
        return false;
      }
      if (to && key > to) {
        return false;
      }
      return true;
    }).sort(function (a, b) {
      if (b.time !== a.time) {
        return b.time - a.time;
      }
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    const header = ['类型', '金额', '分类', '标签', '方式', '备注', '日期', '预算例外'];
    const lines = [header.map(csvCell).join(',')];
    rows.forEach(function (r) {
      lines.push([
        typeText(r),
        amountText(r),
        catText(r),
        tagText(r),
        methodText(r),
        r.note || '',
        dateKey(r.time),
        excText(r)
      ].map(csvCell).join(','));
    });
    return { content: lines.join('\r\n'), count: rows.length };
  }

  function downloadCSV(filename, content) {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch (e) {
      /* 忽略 */
    }
    document.body.removeChild(ta);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        /* 成功 */
      }).catch(function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function openExportModal() {
    document.getElementById('exportAll').checked = true;
    document.getElementById('exportCustom').checked = false;
    document.getElementById('exportRangeRow').hidden = true;
    document.getElementById('exportDateFrom').value = '';
    document.getElementById('exportDateTo').value = '';
    document.getElementById('exportMask').hidden = false;
  }

  function confirmExport() {
    let from = '';
    let to = '';
    if (document.getElementById('exportCustom').checked) {
      from = document.getElementById('exportDateFrom').value;
      to = document.getElementById('exportDateTo').value;
      if (from && to && from > to) {
        showToast('开始日期不能晚于结束日期');
        return;
      }
    }
    const result = buildCSV(from, to);
    const now = new Date();
    exportFileName = '小账本账单-' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + '.csv';
    exportCsvContent = result.content;
    document.getElementById('exportMask').hidden = true;
    if (window.AndroidBridge) {
      window.AndroidBridge.saveCsv(exportFileName, exportCsvContent);
      document.getElementById('exportResultText').textContent =
        '已生成 CSV（共 ' + result.count + ' 笔），正在保存到手机"下载 / 小账本"文件夹。若提示导出失败，请用"复制内容"。';
    } else {
      downloadCSV(exportFileName, exportCsvContent);
      document.getElementById('exportResultText').textContent =
        '已生成 CSV（共 ' + result.count + ' 笔）。若浏览器没有自动下载，请点"复制内容"，粘贴到 Excel 即可。';
    }
    document.getElementById('exportResultMask').hidden = false;
  }

  function buildPage(container) {
    container.innerHTML =
      '<div class="card">' +
        '<h2 class="card-title">主题颜色</h2>' +
        '<div class="theme-grid" id="themeGrid"></div>' +
      '</div>' +

      '<div class="card">' +
        '<h2 class="card-title">预算</h2>' +
        '<div id="budgetList"></div>' +
      '</div>' +

      '<div class="card">' +
        '<h2 class="card-title">设置</h2>' +
        '<ul class="settings-list">' +
          '<li class="settings-row" id="catManageRow">分类管理</li>' +
          '<li class="settings-row" id="tagManageRow">标签管理</li>' +
          '<li class="settings-row" id="methodManageRow">收支方式管理</li>' +
          '<li class="settings-row" id="bankManageRow">银行管理</li>' +
          '<li class="settings-row" id="exportRow">数据导出</li>' +
          '<li class="settings-row settings-row-switch">' +
            '<span>记账后快捷操作</span>' +
            '<span class="charts-switch" id="quickActionsSwitch">' +
              '<button class="charts-switch-btn' + (quickActionsOn ? ' active' : '') + '" data-qa="on" type="button">开</button>' +
              '<button class="charts-switch-btn' + (!quickActionsOn ? ' active' : '') + '" data-qa="off" type="button">关</button>' +
            '</span>' +
          '</li>' +
          '<li class="settings-row" id="aboutRow">关于</li>' +
        '</ul>' +
      '</div>' +

      '<div class="modal-mask" id="budgetModalMask" hidden>' +
        '<div class="modal-card">' +
          '<div class="modal-head">' +
            '<h2 class="card-title" id="budgetModalTitle">设置每日预算</h2>' +
            '<button class="manage-close" id="budgetModalClose" type="button">✕</button>' +
          '</div>' +
          '<input class="text-input" type="number" inputmode="decimal" min="0" step="0.01" id="budgetInput" placeholder="金额（元）">' +
          '<p class="hint" id="budgetHint"></p>' +
          '<div class="tag-add-actions modal-actions">' +
            '<button class="chip" id="budgetClear" type="button">清除预算</button>' +
            '<button class="chip" id="budgetSave" type="button">保存</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="modal-mask" id="catManageMask" hidden>' +
        '<div class="modal-card manage-card">' +
          '<div class="modal-head">' +
            '<h2 class="card-title">分类管理</h2>' +
            '<button class="manage-close" id="catManageClose" type="button">✕</button>' +
          '</div>' +
          '<div class="manage-inline" id="catEditRow" hidden>' +
            '<input class="text-input" id="catEditInput" placeholder="新名称">' +
            '<div class="tag-add-actions">' +
              '<button class="chip" id="catEditConfirm" type="button">确定</button>' +
              '<button class="chip" id="catEditCancel" type="button">取消</button>' +
            '</div>' +
          '</div>' +
          '<div class="manage-inline manage-confirm" id="catDeleteRow" hidden>' +
            '<p class="manage-confirm-text" id="catDeleteText"></p>' +
            '<div class="tag-add-actions">' +
              '<button class="chip" id="catDeleteConfirm" type="button">确定删除</button>' +
              '<button class="chip" id="catDeleteCancel" type="button">取消</button>' +
            '</div>' +
          '</div>' +
          '<div class="manage-list" id="catManageList"></div>' +
          '<button class="tag-add-btn" id="catAddBtn" type="button">＋ 添加分类</button>' +
        '</div>' +
      '</div>' +

      '<div class="modal-mask" id="catAddMask" hidden>' +
        '<div class="modal-card manage-card">' +
          '<div class="modal-head">' +
            '<h2 class="card-title">添加分类</h2>' +
            '<button class="manage-close" id="catAddClose" type="button">✕</button>' +
          '</div>' +
          '<div class="type-switch" id="catAddTypeBtns" style="margin-bottom:10px;">' +
            '<button class="type-btn active" data-type="expense" type="button">支出</button>' +
            '<button class="type-btn" data-type="income" type="button">收入</button>' +
          '</div>' +
          '<input class="text-input" id="catAddName" placeholder="分类名称">' +
          '<h3 class="filter-sub-title">选择图标</h3>' +
          '<div class="cat-icon-grid" id="catIconGrid"></div>' +
          '<div class="tag-add-actions modal-actions">' +
            '<button class="chip" id="catAddConfirm" type="button">确定</button>' +
            '<button class="chip" id="catAddCancel" type="button">取消</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="modal-mask" id="tagManageMask" hidden>' +
        '<div class="modal-card manage-card">' +
          '<div class="modal-head">' +
            '<h2 class="card-title">标签管理</h2>' +
            '<button class="manage-close" id="tagManageClose" type="button">✕</button>' +
          '</div>' +
          '<div class="manage-inline" id="tagEditRow" hidden>' +
            '<input class="text-input" id="tagEditInput" placeholder="新名称">' +
            '<div class="tag-add-actions">' +
              '<button class="chip" id="tagEditConfirm" type="button">确定</button>' +
              '<button class="chip" id="tagEditCancel" type="button">取消</button>' +
            '</div>' +
          '</div>' +
          '<div class="manage-inline manage-confirm" id="tagDeleteRow" hidden>' +
            '<p class="manage-confirm-text" id="tagDeleteText"></p>' +
            '<div class="tag-add-actions">' +
              '<button class="chip" id="tagDeleteConfirm" type="button">确定删除</button>' +
              '<button class="chip" id="tagDeleteCancel" type="button">取消</button>' +
            '</div>' +
          '</div>' +
          '<div class="manage-list" id="tagManageList"></div>' +
        '</div>' +
      '</div>' +

      '<div class="modal-mask" id="mineMethodManageMask" hidden>' +
        '<div class="modal-card manage-card">' +
          '<div class="modal-head">' +
            '<h2 class="card-title">收支方式管理</h2>' +
            '<button class="manage-close" id="mineMethodManageClose" type="button">✕</button>' +
          '</div>' +
          '<div class="manage-inline" id="mineMethodEditRow" hidden>' +
            '<input class="text-input" id="mineMethodEditInput" placeholder="新名称">' +
            '<div class="role-checks">' +
              '<label class="role-check"><input type="checkbox" id="mineMethodEditRoleExpense"> 用作支出方式</label>' +
              '<label class="role-check"><input type="checkbox" id="mineMethodEditRoleIncome"> 用作收入方式</label>' +
              '<label class="role-check"><input type="checkbox" id="mineMethodEditRoleTransferFrom"> 用作转出方式</label>' +
              '<label class="role-check"><input type="checkbox" id="mineMethodEditRoleTransferTo"> 用作转入方式</label>' +
            '</div>' +
            '<div class="tag-add-actions">' +
              '<button class="chip" id="mineMethodEditConfirm" type="button">确定</button>' +
              '<button class="chip" id="mineMethodEditCancel" type="button">取消</button>' +
            '</div>' +
          '</div>' +
          '<div class="manage-inline manage-confirm" id="mineMethodDeleteRow" hidden>' +
            '<p class="manage-confirm-text" id="mineMethodDeleteText"></p>' +
            '<div class="tag-add-actions">' +
              '<button class="chip" id="mineMethodDeleteConfirm" type="button">确定删除</button>' +
              '<button class="chip" id="mineMethodDeleteCancel" type="button">取消</button>' +
            '</div>' +
          '</div>' +
          '<div class="manage-list" id="mineMethodManageList"></div>' +
          '<button class="tag-add-btn" id="mineAddMethodBtn" type="button">＋ 添加收支方式</button>' +
        '</div>' +
      '</div>' +

      '<div class="modal-mask" id="mineAddMethodMask" hidden>' +
        '<div class="modal-card">' +
          '<div class="modal-head">' +
            '<h2 class="card-title">添加收支方式</h2>' +
            '<button class="manage-close" id="mineAddMethodClose" type="button">✕</button>' +
          '</div>' +
          '<input class="text-input" id="mineAddMethodInput" placeholder="方式名称，如：现金">' +
          '<div class="role-checks">' +
            '<label class="role-check"><input type="checkbox" id="mineRoleExpense" checked> 用作支出方式</label>' +
            '<label class="role-check"><input type="checkbox" id="mineRoleIncome" checked> 用作收入方式</label>' +
            '<label class="role-check"><input type="checkbox" id="mineRoleTransferFrom" checked> 用作转出方式</label>' +
            '<label class="role-check"><input type="checkbox" id="mineRoleTransferTo" checked> 用作转入方式</label>' +
          '</div>' +
          '<div class="tag-add-actions modal-actions">' +
            '<button class="chip" id="mineAddMethodConfirm" type="button">确定</button>' +
            '<button class="chip" id="mineAddMethodCancel" type="button">取消</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="modal-mask" id="subManageMask" hidden>' +
        '<div class="modal-card manage-card">' +
          '<div class="modal-head">' +
            '<h2 class="card-title" id="subManageTitle">二级方式</h2>' +
            '<button class="manage-close" id="subManageClose" type="button">✕</button>' +
          '</div>' +
          '<div class="manage-inline" id="subAddRow" hidden>' +
            '<input class="text-input" id="subAddInput" placeholder="二级方式名称，如：余额、银行卡">' +
            '<div class="tag-add-actions">' +
              '<button class="chip" id="subAddConfirm" type="button">确定</button>' +
              '<button class="chip" id="subAddCancel" type="button">取消</button>' +
            '</div>' +
          '</div>' +
          '<div class="manage-inline" id="subEditRow" hidden>' +
            '<input class="text-input" id="subEditInput" placeholder="新名称">' +
            '<div class="tag-add-actions">' +
              '<button class="chip" id="subEditConfirm" type="button">确定</button>' +
              '<button class="chip" id="subEditCancel" type="button">取消</button>' +
            '</div>' +
          '</div>' +
          '<div class="manage-inline manage-confirm" id="subDeleteRow" hidden>' +
            '<p class="manage-confirm-text" id="subDeleteText"></p>' +
            '<div class="tag-add-actions">' +
              '<button class="chip" id="subDeleteConfirm" type="button">确定删除</button>' +
              '<button class="chip" id="subDeleteCancel" type="button">取消</button>' +
            '</div>' +
          '</div>' +
          '<div class="manage-list" id="subManageList"></div>' +
          '<button class="tag-add-btn" id="subAddBtn" type="button">＋ 添加二级</button>' +
        '</div>' +
      '</div>' +

      '<div class="modal-mask" id="mineBankManageMask" hidden>' +
        '<div class="modal-card manage-card">' +
          '<div class="modal-head">' +
            '<h2 class="card-title">银行管理</h2>' +
            '<button class="manage-close" id="mineBankManageClose" type="button">✕</button>' +
          '</div>' +
          '<div class="manage-inline" id="mineBankAddRow" hidden>' +
            '<input class="text-input" id="mineBankAddInput" placeholder="银行名称">' +
            '<div class="tag-add-actions">' +
              '<button class="chip" id="mineBankAddConfirm" type="button">确定</button>' +
              '<button class="chip" id="mineBankAddCancel" type="button">取消</button>' +
            '</div>' +
          '</div>' +
          '<div class="manage-inline" id="mineBankEditRow" hidden>' +
            '<input class="text-input" id="mineBankEditInput" placeholder="新名称">' +
            '<div class="tag-add-actions">' +
              '<button class="chip" id="mineBankEditConfirm" type="button">确定</button>' +
              '<button class="chip" id="mineBankEditCancel" type="button">取消</button>' +
            '</div>' +
          '</div>' +
          '<div class="manage-inline manage-confirm" id="mineBankDeleteRow" hidden>' +
            '<p class="manage-confirm-text" id="mineBankDeleteText"></p>' +
            '<div class="tag-add-actions">' +
              '<button class="chip" id="mineBankDeleteConfirm" type="button">确定删除</button>' +
              '<button class="chip" id="mineBankDeleteCancel" type="button">取消</button>' +
            '</div>' +
          '</div>' +
          '<div class="manage-list" id="mineBankManageList"></div>' +
          '<button class="tag-add-btn" id="mineBankAddBtn" type="button">＋ 添加银行</button>' +
        '</div>' +
      '</div>' +

      '<div class="modal-mask" id="exportMask" hidden>' +
        '<div class="modal-card">' +
          '<div class="modal-head">' +
            '<h2 class="card-title">数据导出</h2>' +
            '<button class="manage-close" id="exportClose" type="button">✕</button>' +
          '</div>' +
          '<div class="role-checks">' +
            '<label class="role-check"><input type="radio" name="exportRange" id="exportAll" checked> 全部账单</label>' +
            '<label class="role-check"><input type="radio" name="exportRange" id="exportCustom"> 自定义时间范围</label>' +
          '</div>' +
          '<div id="exportRangeRow" hidden>' +
            '<div class="export-dates">' +
              '<input class="text-input" type="date" id="exportDateFrom">' +
              '<span class="export-date-sep">至</span>' +
              '<input class="text-input" type="date" id="exportDateTo">' +
            '</div>' +
          '</div>' +
          '<div class="tag-add-actions modal-actions">' +
            '<button class="chip" id="exportConfirm" type="button">导出</button>' +
            '<button class="chip" id="exportCancel" type="button">取消</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="modal-mask" id="exportResultMask" hidden>' +
        '<div class="modal-card">' +
          '<div class="modal-head">' +
            '<h2 class="card-title">导出完成</h2>' +
            '<button class="manage-close" id="exportResultClose" type="button">✕</button>' +
          '</div>' +
          '<p class="hint" id="exportResultText"></p>' +
          '<div class="tag-add-actions modal-actions">' +
            '<button class="chip" id="exportCopyBtn" type="button">复制内容</button>' +
            '<button class="chip" id="exportDoneBtn" type="button">完成</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="modal-mask" id="aboutMask" hidden>' +
        '<div class="modal-card">' +
          '<div class="modal-head">' +
            '<h2 class="card-title">关于</h2>' +
            '<button class="manage-close" id="aboutClose" type="button">✕</button>' +
          '</div>' +
          '<div class="about-body">' +
            '<p class="about-name">小账本</p>' +
            '<p class="about-version">版本：' + APP_VERSION + '</p>' +
            '<p class="hint">个人记账应用。</p>' +
            '<p class="hint">隐私说明：所有数据仅保存在本机，不会上传到任何服务器；请定期用"数据导出"备份。</p>' +
          '</div>' +
          '<div class="tag-add-actions modal-actions">' +
            '<button class="chip" id="aboutDone" type="button">确定</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    renderBudgetList();
    renderThemeGrid();

    document.getElementById('budgetModalClose').addEventListener('click', function () {
      document.getElementById('budgetModalMask').hidden = true;
    });
    document.getElementById('budgetSave').addEventListener('click', saveBudget);
    document.getElementById('budgetClear').addEventListener('click', clearBudget);
    document.getElementById('budgetInput').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        saveBudget();
      }
    });

    document.getElementById('catManageRow').addEventListener('click', openCatManage);
    document.getElementById('catManageClose').addEventListener('click', closeCatManage);
    document.getElementById('catEditConfirm').addEventListener('click', confirmCatEdit);
    document.getElementById('catEditCancel').addEventListener('click', function () {
      document.getElementById('catEditRow').hidden = true;
      catEditId = '';
    });
    document.getElementById('catEditInput').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        confirmCatEdit();
      }
    });
    document.getElementById('catDeleteConfirm').addEventListener('click', confirmCatDelete);
    document.getElementById('catDeleteCancel').addEventListener('click', function () {
      document.getElementById('catDeleteRow').hidden = true;
      catDeleteId = '';
    });
    document.getElementById('catAddBtn').addEventListener('click', openCatAdd);
    document.getElementById('catAddClose').addEventListener('click', function () {
      document.getElementById('catAddMask').hidden = true;
    });
    document.getElementById('catAddConfirm').addEventListener('click', confirmAddCat);
    document.getElementById('catAddCancel').addEventListener('click', function () {
      document.getElementById('catAddMask').hidden = true;
    });
    document.getElementById('catAddName').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        confirmAddCat();
      }
    });
    document.querySelectorAll('#catAddTypeBtns .type-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        catAddType = btn.dataset.type;
        catAddIcon = catAddType === 'income' ? '💼' : '🍜';
        renderCatAddForm();
      });
    });

    document.getElementById('tagManageRow').addEventListener('click', openTagManage);
    document.getElementById('tagManageClose').addEventListener('click', closeTagManage);
    document.getElementById('tagEditConfirm').addEventListener('click', confirmTagEdit);
    document.getElementById('tagEditCancel').addEventListener('click', function () {
      document.getElementById('tagEditRow').hidden = true;
      tagEditId = '';
    });
    document.getElementById('tagEditInput').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        confirmTagEdit();
      }
    });
    document.getElementById('tagDeleteConfirm').addEventListener('click', confirmTagDelete);
    document.getElementById('tagDeleteCancel').addEventListener('click', function () {
      document.getElementById('tagDeleteRow').hidden = true;
      tagDeleteId = '';
    });

    document.getElementById('methodManageRow').addEventListener('click', openMethodManage);
    document.getElementById('mineMethodManageClose').addEventListener('click', closeMethodManage);
    document.getElementById('mineMethodEditConfirm').addEventListener('click', confirmMethodEdit);
    document.getElementById('mineMethodEditCancel').addEventListener('click', function () {
      document.getElementById('mineMethodEditRow').hidden = true;
      methodEditId = '';
    });
    document.getElementById('mineMethodEditInput').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        confirmMethodEdit();
      }
    });
    document.getElementById('mineMethodDeleteConfirm').addEventListener('click', confirmMethodDelete);
    document.getElementById('mineMethodDeleteCancel').addEventListener('click', function () {
      document.getElementById('mineMethodDeleteRow').hidden = true;
      methodDeleteId = '';
    });
    document.getElementById('mineAddMethodBtn').addEventListener('click', openAddMethod);
    document.getElementById('mineAddMethodClose').addEventListener('click', function () {
      document.getElementById('mineAddMethodMask').hidden = true;
    });
    document.getElementById('mineAddMethodConfirm').addEventListener('click', confirmAddMethod);
    document.getElementById('mineAddMethodCancel').addEventListener('click', function () {
      document.getElementById('mineAddMethodMask').hidden = true;
    });
    document.getElementById('mineAddMethodInput').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        confirmAddMethod();
      }
    });
    document.getElementById('subManageClose').addEventListener('click', closeSubManage);
    document.getElementById('subAddBtn').addEventListener('click', openSubAdd);
    document.getElementById('subAddConfirm').addEventListener('click', confirmSubAdd);
    document.getElementById('subAddCancel').addEventListener('click', function () {
      document.getElementById('subAddRow').hidden = true;
    });
    document.getElementById('subAddInput').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        confirmSubAdd();
      }
    });
    document.getElementById('subEditConfirm').addEventListener('click', confirmSubEdit);
    document.getElementById('subEditCancel').addEventListener('click', function () {
      document.getElementById('subEditRow').hidden = true;
      subEditId = '';
    });
    document.getElementById('subEditInput').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        confirmSubEdit();
      }
    });
    document.getElementById('subDeleteConfirm').addEventListener('click', confirmSubDelete);
    document.getElementById('subDeleteCancel').addEventListener('click', function () {
      document.getElementById('subDeleteRow').hidden = true;
      subDeleteId = '';
    });

    document.getElementById('bankManageRow').addEventListener('click', openBankManage);
    document.getElementById('mineBankManageClose').addEventListener('click', closeBankManage);
    document.getElementById('mineBankAddBtn').addEventListener('click', openBankAdd);
    document.getElementById('mineBankAddConfirm').addEventListener('click', confirmBankAdd);
    document.getElementById('mineBankAddCancel').addEventListener('click', function () {
      document.getElementById('mineBankAddRow').hidden = true;
    });
    document.getElementById('mineBankAddInput').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        confirmBankAdd();
      }
    });
    document.getElementById('mineBankEditConfirm').addEventListener('click', confirmBankEdit);
    document.getElementById('mineBankEditCancel').addEventListener('click', function () {
      document.getElementById('mineBankEditRow').hidden = true;
      bankEditId = '';
    });
    document.getElementById('mineBankEditInput').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        confirmBankEdit();
      }
    });
    document.getElementById('mineBankDeleteConfirm').addEventListener('click', confirmBankDelete);
    document.getElementById('mineBankDeleteCancel').addEventListener('click', function () {
      document.getElementById('mineBankDeleteRow').hidden = true;
      bankDeleteId = '';
    });

    document.getElementById('exportRow').addEventListener('click', openExportModal);
    document.getElementById('exportClose').addEventListener('click', function () {
      document.getElementById('exportMask').hidden = true;
    });
    document.getElementById('exportCancel').addEventListener('click', function () {
      document.getElementById('exportMask').hidden = true;
    });
    document.getElementById('exportConfirm').addEventListener('click', confirmExport);
    document.getElementById('exportAll').addEventListener('change', function () {
      document.getElementById('exportRangeRow').hidden = true;
    });
    document.getElementById('exportCustom').addEventListener('change', function () {
      document.getElementById('exportRangeRow').hidden = false;
    });
    document.getElementById('exportResultClose').addEventListener('click', function () {
      document.getElementById('exportResultMask').hidden = true;
    });
    document.getElementById('exportDoneBtn').addEventListener('click', function () {
      document.getElementById('exportResultMask').hidden = true;
    });
    document.getElementById('exportCopyBtn').addEventListener('click', function () {
      copyText(exportCsvContent);
      this.textContent = '已复制';
      const self = this;
      setTimeout(function () {
        self.textContent = '复制内容';
      }, 2000);
    });

    document.getElementById('aboutRow').addEventListener('click', function () {
      document.getElementById('aboutMask').hidden = false;
    });
    document.getElementById('aboutClose').addEventListener('click', function () {
      document.getElementById('aboutMask').hidden = true;
    });
    document.getElementById('aboutDone').addEventListener('click', function () {
      document.getElementById('aboutMask').hidden = true;
    });
    document.querySelectorAll('#quickActionsSwitch .charts-switch-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        quickActionsOn = btn.dataset.qa === 'on';
        document.querySelectorAll('#quickActionsSwitch .charts-switch-btn').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        DB.put(DB.stores.settings, { key: 'quickActions', value: quickActionsOn }).catch(function (err) {
          console.error('[小账本] 保存快捷操作设置失败', err);
        });
      });
    });
  }

  async function render(container) {
    try {
      const results = await Promise.all([
        DB.getAll(DB.stores.settings),
        DB.getAll(DB.stores.records),
        DB.getAll(DB.stores.categories),
        DB.getAll(DB.stores.tags),
        DB.getAll(DB.stores.paymentMethods),
        DB.getAll(DB.stores.subMethods),
        DB.getAll(DB.stores.banks)
      ]);
      allRecords = results[1];
      categories = results[2];
      tags = results[3];
      methods = results[4];
      subMethods = results[5];
      banks = results[6];
      themeKey = settingValue(results[0], 'theme') || 'blue';
      const qa = settingValue(results[0], 'quickActions');
      quickActionsOn = qa === null || qa === undefined ? true : !!qa;
      dailyBudgetCents = settingValue(results[0], 'dailyBudget');
      monthlyBudgetCents = settingValue(results[0], 'monthlyBudget');
      yearlyBudgetCents = settingValue(results[0], 'yearlyBudget');
    } catch (err) {
      container.innerHTML = '<div class="card"><p class="hint">数据加载失败：' +
        err.message + '</p></div>';
      return;
    }
    buildPage(container);
  }

  window.RenderMinePage = render;
})();
