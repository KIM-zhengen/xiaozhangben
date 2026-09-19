/* ============================================
   记账页 · 子项 1.2
   功能：类型切换（支出/收入/转账）、金额、
         分类、支出方式（一级+二级+银行卡银行）、
         备注、时间、保存
   ============================================ */
(function () {
  'use strict';

  const TYPE_LABELS = { expense: '支出', income: '收入', transfer: '转账' };

  const state = {
    type: 'expense',
    amount: '',
    categoryId: '',
    tagId: '',
    methodId: '',
    subMethodId: '',
    bankName: '',
    toMethodId: '',
    toSubMethodId: '',
    toBankName: '',
    note: '',
    time: new Date(),
    templateMode: false,
    templateName: '',
    templateNameEdited: false,
    templateOverwrite: false,
    templatePickerType: 'expense',
    editingId: null,
    noDailyBudget: false,
    noMonthlyBudget: false,
    noYearlyBudget: false
  };

  let categories = [];
  let methods = [];
  let subMethods = [];
  let tags = [];
  let editTagId = '';
  let banks = [];
  let pendingMethodKey = 'methodId';
  let manageEditId = '';
  let manageDeleteId = '';
  let bankDeleteId = '';
  let templates = [];
  let allRecords = [];
  let dailyBudgetCents = null;
  let monthlyBudgetCents = null;
  let yearlyBudgetCents = null;
  let quickActionsEnabled = true;
  let lastSavedId = '';
  let lastSavedTime = 0;
  let pageContainer = null;
  let templateOverwriteId = '';
  let templateEditId = '';
  let templateDeleteId = '';

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

  function toDateInputValue(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  function subsOf(methodId) {
    return subMethods.filter(function (s) {
      return s.methodId === methodId;
    });
  }

  function methodById(id) {
    return methods.find(function (m) {
      return m.id === id;
    });
  }

  function subsForMethod(method) {
    if (!method) {
      return [];
    }
    if (method.bankMode) {
      return sortedBanksForSub().map(function (b) {
        return { id: 'bank_' + b.id, methodId: method.id, name: b.name, bankName: b.name };
      });
    }
    return subMethods.filter(function (s) {
      return s.methodId === method.id;
    });
  }

  function bankUsage(name) {
    let n = 0;
    allRecords.forEach(function (r) {
      if (r.bankName === name || r.fromBankName === name || r.toBankName === name) {
        n++;
      }
    });
    return n;
  }

  function sortedBanksForSub() {
    return banks.slice().sort(function (a, b) {
      const diff = bankUsage(b.name) - bankUsage(a.name);
      if (diff !== 0) {
        return diff;
      }
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
  }

  function catsOfType(type) {
    return categories.filter(function (c) {
      return c.type === type;
    });
  }

  function bankVisible(subId) {
    const sub = subMethods.find(function (s) {
      return s.id === subId;
    });
    return !!sub && sub.name.indexOf('银行卡') !== -1;
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

  function methodsForRole(role) {
    return sortedMethods().filter(function (m) {
      return !m.hidden && m[role] !== false;
    });
  }

  function sortedBanks(sortByUsage) {
    return banks.slice().sort(function (a, b) {
      if (sortByUsage) {
        const usageDiff = bankUsage(b.name) - bankUsage(a.name);
        if (usageDiff !== 0) {
          return usageDiff;
        }
      }
      const diff = (a.sortOrder || 0) - (b.sortOrder || 0);
      if (diff !== 0) {
        return diff;
      }
      return a.name.localeCompare(b.name);
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

  function nextBankSort() {
    let max = 0;
    banks.forEach(function (b) {
      if ((b.sortOrder || 0) > max) {
        max = b.sortOrder || 0;
      }
    });
    return max + 1;
  }

  function sortedTemplates() {
    return templates.slice().sort(function (a, b) {
      const diff = (b.usageCount || 0) - (a.usageCount || 0);
      if (diff !== 0) {
        return diff;
      }
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
  }

  function nextTemplateSort() {
    let max = 0;
    templates.forEach(function (t) {
      if ((t.sortOrder || 0) > max) {
        max = t.sortOrder || 0;
      }
    });
    return max + 1;
  }

  function fmtYuan(cents) {
    return (cents / 100).toFixed(2);
  }

  function effMonthlyBudget() {
    if (monthlyBudgetCents != null) {
      return monthlyBudgetCents;
    }
    return dailyBudgetCents != null ? dailyBudgetCents * 30 : null;
  }

  function effYearlyBudget() {
    if (yearlyBudgetCents != null) {
      return yearlyBudgetCents;
    }
    const m = effMonthlyBudget();
    return m != null ? m * 12 : null;
  }

  function sumExpense(records, matchFn) {
    let total = 0;
    records.forEach(function (r) {
      if (r.type === 'expense' && matchFn(r)) {
        total += r.amountCents;
      }
    });
    return total;
  }

  function todayExpense() {
    const now = new Date();
    return sumExpense(allRecords, function (r) {
      const d = new Date(r.time);
      return d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate() &&
        !r.noDailyBudget;
    });
  }

  function monthExpense() {
    const now = new Date();
    return sumExpense(allRecords, function (r) {
      const d = new Date(r.time);
      return d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        !r.noMonthlyBudget;
    });
  }

  function yearExpense() {
    const now = new Date();
    return sumExpense(allRecords, function (r) {
      const d = new Date(r.time);
      return d.getFullYear() === now.getFullYear() &&
        !r.noYearlyBudget;
    });
  }

  function budgetReminders() {
    const messages = [];
    if (dailyBudgetCents != null) {
      const spent = todayExpense();
      if (spent >= dailyBudgetCents) {
        messages.push('今日已超支 ' + fmtYuan(spent - dailyBudgetCents) + ' 元');
      }
    }
    const mEff = effMonthlyBudget();
    if (mEff != null) {
      const mSpent = monthExpense();
      const mPct = Math.round(mSpent / mEff * 100);
      if (mSpent >= mEff) {
        messages.push('本月已超支 ' + fmtYuan(mSpent - mEff) + ' 元');
      } else if (mPct >= 80) {
        messages.push('本月已用 ' + mPct + '% 预算');
      }
    }
    const yEff = effYearlyBudget();
    if (yEff != null) {
      const ySpent = yearExpense();
      const yPct = Math.round(ySpent / yEff * 100);
      if (ySpent >= yEff) {
        messages.push('今年已超支 ' + fmtYuan(ySpent - yEff) + ' 元');
      } else if (yPct >= 80) {
        messages.push('今年已用 ' + yPct + '% 预算');
      }
    }
    return messages;
  }

  function updateBudgetCard() {
    const card = document.getElementById('budgetCard');
    if (!card) {
      return;
    }
    if (state.templateMode || dailyBudgetCents == null) {
      card.hidden = true;
      card.innerHTML = '';
      return;
    }
    card.hidden = false;
    const spent = todayExpense();
    const over = spent > dailyBudgetCents;
    const remain = dailyBudgetCents - spent;
    const pct = dailyBudgetCents > 0
      ? Math.min(100, Math.round(spent / dailyBudgetCents * 100))
      : 0;
    card.innerHTML =
      '<div class="budget-card-head">' +
        '<span class="budget-card-label">今日预算</span>' +
        '<span class="budget-card-nums">已花 ¥' + fmtYuan(spent) + ' / ¥' + fmtYuan(dailyBudgetCents) + '</span>' +
      '</div>' +
      '<div class="budget-progress">' +
        '<div class="budget-progress-inner" style="width:' + pct + '%;background:' +
          (over ? '#E5484D' : 'var(--primary)') + ';"></div>' +
      '</div>' +
      '<div class="budget-card-foot' + (over ? ' over' : '') + '">' +
        (over ? '已超支 ¥' + fmtYuan(-remain) : '剩余 ¥' + fmtYuan(remain)) +
      '</div>';
  }

  let reminderTimer = null;

  function showBudgetReminderBanner(text) {
    const banner = document.getElementById('budgetReminderBanner');
    if (!banner) {
      return;
    }
    if (!text) {
      banner.hidden = true;
      banner.textContent = '';
      return;
    }
    banner.textContent = '⚠️ ' + text;
    banner.hidden = false;
    clearTimeout(reminderTimer);
    reminderTimer = setTimeout(function () {
      banner.hidden = true;
    }, 8000);
  }

  let saveNoticeTimer = null;

  function showSaveNotice(text, type) {
    const banner = document.getElementById('saveNoticeBanner');
    if (!banner) {
      return;
    }
    if (!text) {
      banner.hidden = true;
      banner.textContent = '';
      return;
    }
    banner.textContent = (type === 'success' ? '✓ ' : '⚠️ ') + text;
    banner.className = 'notice-banner ' + (type === 'success' ? 'success' : 'error');
    banner.hidden = false;
    clearTimeout(saveNoticeTimer);
    saveNoticeTimer = setTimeout(function () {
      banner.hidden = true;
    }, 2500);
  }

  function flashField(el) {
    if (!el) {
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('field-error');
    setTimeout(function () {
      el.classList.remove('field-error');
    }, 2000);
  }

  let saveActionsTimer = null;

  function showSaveActions() {
    const bar = document.getElementById('saveActionsBar');
    if (!bar) {
      return;
    }
    bar.hidden = false;
    clearTimeout(saveActionsTimer);
    saveActionsTimer = setTimeout(function () {
      bar.hidden = true;
    }, 20000);
  }

  function hideSaveActions() {
    const bar = document.getElementById('saveActionsBar');
    if (bar) {
      bar.hidden = true;
    }
    clearTimeout(saveActionsTimer);
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

  async function updateSavedCount() {
    const countEl = document.getElementById('savedCount');
    if (!countEl) {
      return;
    }
    try {
      const records = await DB.getAll(DB.stores.records);
      countEl.textContent = '已保存 ' + records.length + ' 笔记录（本机存储，刷新不丢失）';
    } catch (err) {
      countEl.textContent = '';
    }
  }

  function chipHTML(id, text, selected) {
    return '<button class="chip' + (selected ? ' selected' : '') + '" data-id="' +
      escapeHtml(id) + '">' + escapeHtml(text) + '</button>';
  }

  function bindChipGroup(container, items, selectedId, onClick) {
    container.innerHTML = items.map(function (item) {
      return chipHTML(item.id, item.name, item.id === selectedId);
    }).join('');
    container.hidden = items.length === 0;
    container.querySelectorAll('.chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        onClick(btn.dataset.id);
      });
    });
  }

  function renderSelectorSet(ids, methodKey, subKey, bankKey, role) {
    const methodGroup = document.getElementById(ids.methodGroup);
    const subGroup = document.getElementById(ids.subMethodGroup);
    const bankSlot = document.getElementById(ids.bankSlot);

    const roleMethods = methodsForRole(role);
    if (!roleMethods.some(function (m) {
      return m.id === state[methodKey];
    })) {
      state[methodKey] = roleMethods.length ? roleMethods[0].id : '';
      const subs = subsForMethod(methodById(state[methodKey]));
      state[subKey] = subs.length ? subs[0].id : '';
    } else {
      const currentSubs = subsForMethod(methodById(state[methodKey]));
      if (state[subKey] && !currentSubs.some(function (s) {
        return s.id === state[subKey];
      })) {
        state[subKey] = currentSubs.length ? currentSubs[0].id : '';
      }
    }

    const currentMethod = methodById(state[methodKey]);
    const isBankMode = !!currentMethod && !!currentMethod.bankMode;
    const currentSubs = subsForMethod(currentMethod);

    bindChipGroup(methodGroup, roleMethods, state[methodKey], function (id) {
      state[methodKey] = id;
      const m = methodById(id);
      const subs = subsForMethod(m);
      state[subKey] = subs.length ? subs[0].id : '';
      if (m && m.bankMode) {
        state[bankKey] = subs.length ? subs[0].bankName : '';
      }
      renderMethodArea();
    });

    const addMethodBtn = document.createElement('button');
    addMethodBtn.className = 'chip chip-add';
    addMethodBtn.type = 'button';
    addMethodBtn.textContent = '＋';
    addMethodBtn.addEventListener('click', function (event) {
      event.stopPropagation();
      openAddMethod(methodKey);
    });
    methodGroup.appendChild(addMethodBtn);
    methodGroup.hidden = false;

    if (isBankMode) {
      subGroup.innerHTML = '';
      subGroup.hidden = true;
      const currentBank = banks.find(function (b) {
        return b.id === (state[subKey] || '').slice(5);
      });
      renderBankSelector(bankSlot, currentBank ? currentBank.name : '', function (name) {
        const bank = banks.find(function (b) {
          return b.name === name;
        });
        if (bank) {
          state[subKey] = 'bank_' + bank.id;
          state[bankKey] = bank.name;
        }
        renderMethodArea();
      }, true);
      return;
    }

    bindChipGroup(subGroup, currentSubs, state[subKey], function (id) {
      state[subKey] = id;
      if (!bankVisible(id)) {
        state[bankKey] = '';
      }
      renderMethodArea();
    });

    if (bankVisible(state[subKey])) {
      renderBankSelector(bankSlot, state[bankKey], function (name) {
        state[bankKey] = name;
        renderMethodArea();
      });
    } else {
      state[bankKey] = '';
      bankSlot.innerHTML = '';
    }
  }

  function renderBankSelector(container, currentValue, onChange, sortByUsage) {
    container.innerHTML =
      '<div class="tag-select">' +
        '<button class="tag-select-btn bank-select-btn" type="button">' +
          '<span class="bank-select-text">' + escapeHtml(currentValue || '选择银行') + '</span>' +
          '<span class="tag-arrow">▾</span>' +
        '</button>' +
        '<div class="tag-dropdown bank-dropdown" hidden>' +
          '<div class="bank-manage-top">' +
            '<button class="manage-link" type="button">管理</button>' +
          '</div>' +
          '<div class="tag-add-row bank-edit-row" hidden>' +
            '<input class="text-input bank-edit-input" placeholder="修改银行名称">' +
            '<div class="tag-add-actions">' +
              '<button class="chip bank-edit-confirm" type="button">确定</button>' +
              '<button class="chip bank-edit-cancel" type="button">取消</button>' +
            '</div>' +
          '</div>' +
          '<div class="tag-list bank-list"></div>' +
          '<button class="tag-add-btn bank-add-btn" type="button">＋ 添加银行卡</button>' +
          '<div class="tag-add-row bank-add-row" hidden>' +
            '<input class="text-input bank-new-input" placeholder="银行名称">' +
            '<div class="tag-add-actions">' +
              '<button class="chip bank-add-confirm" type="button">确定</button>' +
              '<button class="chip bank-add-cancel" type="button">取消</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    const root = container.firstElementChild;
    const btn = root.querySelector('.bank-select-btn');
    const dropdown = root.querySelector('.bank-dropdown');
    const list = root.querySelector('.bank-list');
    const addRow = root.querySelector('.bank-add-row');
    const newInput = root.querySelector('.bank-new-input');
    const textEl = root.querySelector('.bank-select-text');
    const editRow = root.querySelector('.bank-edit-row');
    const editInput = root.querySelector('.bank-edit-input');
    let bankEditId = '';

    function close() {
      dropdown.hidden = true;
      addRow.hidden = true;
      editRow.hidden = true;
      bankEditId = '';
      document.removeEventListener('click', onDoc);
    }

    function onDoc(event) {
      if (!root.contains(event.target)) {
        close();
      }
    }

    function renderList() {
      const items = sortedBanks(sortByUsage);
      if (!items.length) {
        list.innerHTML = '<p class="tag-empty">还没有银行，点下方"添加银行卡"</p>';
        return;
      }
      list.innerHTML = items.map(function (b) {
        return '<div class="tag-item' + (b.name === currentValue ? ' selected' : '') + '" data-name="' +
          escapeHtml(b.name) + '">' +
          '<span class="tag-item-name">' + escapeHtml(b.name) + '</span>' +
          (sortByUsage ? '<span class="bank-usage">' + bankUsage(b.name) + ' 次</span>' : '') +
          '<button class="tag-edit bank-edit-btn" data-id="' + escapeHtml(b.id) + '" type="button">✏️</button>' +
        '</div>';
      }).join('');
      list.querySelectorAll('.tag-item').forEach(function (row) {
        row.addEventListener('click', function () {
          onChange(row.dataset.name);
          close();
        });
      });
      list.querySelectorAll('.bank-edit-btn').forEach(function (editBtn) {
        editBtn.addEventListener('click', function (event) {
          event.stopPropagation();
          const bank = banks.find(function (b) {
            return b.id === editBtn.dataset.id;
          });
          if (!bank) {
            return;
          }
          bankEditId = bank.id;
          editRow.hidden = false;
          editInput.value = bank.name;
          editInput.focus();
        });
      });
    }

    function confirmBankEdit() {
      const name = (editInput.value || '').trim();
      if (!name) {
        showToast('银行名称不能为空');
        return;
      }
      const bank = banks.find(function (b) {
        return b.id === bankEditId;
      });
      if (!bank) {
        return;
      }
      if (banks.some(function (b) {
        return b.id !== bankEditId && b.name === name;
      })) {
        showToast('该银行已存在');
        return;
      }
      const oldName = bank.name;
      bank.name = name;
      DB.put(DB.stores.banks, bank).then(function () {
        editRow.hidden = true;
        bankEditId = '';
        if (currentValue === oldName) {
          onChange(name);
        } else {
          renderList();
        }
      }).catch(function (err) {
        console.error('[小账本] 修改银行失败', err);
        showToast('修改失败，请重试');
      });
    }

    btn.addEventListener('click', function (event) {
      event.stopPropagation();
      if (dropdown.hidden) {
        dropdown.hidden = false;
        renderList();
        document.addEventListener('click', onDoc);
      } else {
        close();
      }
    });

    root.querySelector('.bank-add-btn').addEventListener('click', function () {
      addRow.hidden = false;
      newInput.value = '';
      newInput.focus();
    });

    root.querySelector('.bank-manage-top .manage-link').addEventListener('click', function () {
      openBankManage();
    });

    root.querySelector('.bank-edit-confirm').addEventListener('click', confirmBankEdit);

    root.querySelector('.bank-edit-cancel').addEventListener('click', function () {
      editRow.hidden = true;
      bankEditId = '';
    });

    editInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        confirmBankEdit();
      }
    });

    function confirmAdd() {
      const name = (newInput.value || '').trim();
      if (!name) {
        showToast('请输入银行名称');
        return;
      }
      if (banks.some(function (b) {
        return b.name === name;
      })) {
        onChange(name);
        close();
        showToast('该银行已存在，已直接选用');
        return;
      }
      const bank = { id: genId(), name: name, sortOrder: nextBankSort() };
      DB.put(DB.stores.banks, bank).then(function () {
        banks.push(bank);
        onChange(name);
        close();
      }).catch(function (err) {
        console.error('[小账本] 添加银行失败', err);
        showToast('添加失败，请重试');
      });
    }

    root.querySelector('.bank-add-confirm').addEventListener('click', confirmAdd);
    root.querySelector('.bank-add-cancel').addEventListener('click', function () {
      addRow.hidden = true;
    });
    newInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        confirmAdd();
      }
    });
  }

  function openAddMethod(methodKey) {
    pendingMethodKey = methodKey;
    const mask = document.getElementById('addMethodMask');
    if (mask) {
      mask.hidden = false;
      document.getElementById('addMethodInput').value = '';
      ['roleExpense', 'roleIncome', 'roleTransferFrom', 'roleTransferTo'].forEach(function (id) {
        document.getElementById(id).checked = true;
      });
      document.getElementById('addMethodInput').focus();
    }
  }

  function closeAddMethod() {
    const mask = document.getElementById('addMethodMask');
    if (mask) {
      mask.hidden = true;
    }
  }

  async function confirmAddMethod() {
    const input = document.getElementById('addMethodInput');
    const name = (input.value || '').trim();
    if (!name) {
      showToast('请输入支出方式名称');
      return;
    }
    if (methods.some(function (m) {
      return m.name === name;
    })) {
      showToast('该支出方式已存在');
      return;
    }
    const method = {
      id: genId(),
      name: name,
      builtin: false,
      sortOrder: nextMethodSort(),
      canExpense: document.getElementById('roleExpense').checked,
      canIncome: document.getElementById('roleIncome').checked,
      canTransferFrom: document.getElementById('roleTransferFrom').checked,
      canTransferTo: document.getElementById('roleTransferTo').checked
    };
    try {
      await DB.put(DB.stores.paymentMethods, method);
      methods.push(method);
      state[pendingMethodKey] = method.id;
      if (pendingMethodKey === 'methodId') {
        state.subMethodId = '';
      } else {
        state.toSubMethodId = '';
      }
      closeAddMethod();
      renderMethodArea();
      showToast('已添加：' + name);
    } catch (err) {
      console.error('[小账本] 添加支出方式失败', err);
      showToast('添加失败，请重试');
    }
  }

  function renderCategoryArea() {
    const card = document.getElementById('categoryCard');
    const grid = document.getElementById('categoryGrid');
    const title = document.getElementById('categoryTitle');

    if (state.type === 'transfer') {
      card.hidden = true;
      return;
    }
    card.hidden = false;

    const list = catsOfType(state.type);
    if (!list.some(function (c) {
      return c.id === state.categoryId;
    })) {
      state.categoryId = list.length ? list[0].id : '';
    }

    title.textContent = state.type === 'income' ? '收入分类' : '支出分类';
    grid.innerHTML = list.map(function (c) {
      return '<button class="cat-item' + (c.id === state.categoryId ? ' selected' : '') + '" data-id="' +
        escapeHtml(c.id) + '">' +
        '<span class="cat-icon">' + c.icon + '</span>' +
        '<span class="cat-name">' + escapeHtml(c.name) + '</span>' +
      '</button>';
    }).join('');

    grid.querySelectorAll('.cat-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.categoryId !== btn.dataset.id) {
          state.categoryId = btn.dataset.id;
          state.tagId = '';
        }
        grid.querySelectorAll('.cat-item').forEach(function (b) {
          b.classList.toggle('selected', b === btn);
        });
        renderTagArea();
        updateTemplateName();
      });
    });
  }

  function renderMethodArea() {
    const singleCard = document.getElementById('methodCard');
    const transferCard = document.getElementById('transferCard');
    const isTransfer = state.type === 'transfer';
    singleCard.hidden = isTransfer;
    transferCard.hidden = !isTransfer;

    if (!methods.length) {
      return;
    }

    if (isTransfer) {
      renderSelectorSet(
        { methodGroup: 'fromMethodGroup', subMethodGroup: 'fromSubMethodGroup', bankSlot: 'fromBankSlot' },
        'methodId', 'subMethodId', 'bankName', 'canTransferFrom'
      );
      renderSelectorSet(
        { methodGroup: 'toMethodGroup', subMethodGroup: 'toSubMethodGroup', bankSlot: 'toBankSlot' },
        'toMethodId', 'toSubMethodId', 'toBankName', 'canTransferTo'
      );
    } else {
      document.getElementById('methodTitle').textContent =
        state.type === 'income' ? '收入方式' : '支出方式';
      renderSelectorSet(
        { methodGroup: 'methodGroup', subMethodGroup: 'subMethodGroup', bankSlot: 'bankSlot' },
        'methodId', 'subMethodId', 'bankName',
        state.type === 'income' ? 'canIncome' : 'canExpense'
      );
    }
    updateTemplateName();
  }

  function tagsOf(categoryId) {
    return tags.filter(function (t) {
      return t.categoryId === categoryId;
    });
  }

  function sortedTags(categoryId, keyword) {
    const kw = (keyword || '').trim().toLowerCase();
    return tagsOf(categoryId)
      .filter(function (t) {
        return !kw || t.name.toLowerCase().indexOf(kw) !== -1;
      })
      .sort(function (a, b) {
        const diff = (b.usageCount || 0) - (a.usageCount || 0);
        if (diff !== 0) {
          return diff;
        }
        return a.name.localeCompare(b.name);
      });
  }

  function renderTagList() {
    const list = document.getElementById('tagList');
    const keyword = document.getElementById('tagSearch').value;
    const items = sortedTags(state.categoryId, keyword);

    if (!items.length) {
      list.innerHTML = '<p class="tag-empty">' +
        (keyword ? '没有匹配的标签' : '还没有标签，点下方"添加标签"') + '</p>';
      return;
    }

    list.innerHTML = items.map(function (t) {
      return '<div class="tag-item' + (t.id === state.tagId ? ' selected' : '') + '" data-id="' +
        escapeHtml(t.id) + '">' +
        '<span class="tag-item-name">' + escapeHtml(t.name) + '</span>' +
        '<button class="tag-edit" data-id="' + escapeHtml(t.id) + '" type="button">✏️</button>' +
      '</div>';
    }).join('');

    list.querySelectorAll('.tag-item').forEach(function (row) {
      row.addEventListener('click', function () {
        state.tagId = row.dataset.id;
        closeTagDropdown();
        renderTagArea();
      });
    });

    list.querySelectorAll('.tag-edit').forEach(function (editBtn) {
      editBtn.addEventListener('click', function (event) {
        event.stopPropagation();
        openTagEdit(editBtn.dataset.id);
      });
    });
  }

  function openTagEdit(tagId) {
    const tag = tags.find(function (t) {
      return t.id === tagId;
    });
    if (!tag) {
      return;
    }
    editTagId = tagId;
    const row = document.getElementById('tagEditRow');
    const input = document.getElementById('tagEditInput');
    if (!row || !input) {
      return;
    }
    row.hidden = false;
    input.value = tag.name;
    input.focus();
  }

  async function editTag() {
    const input = document.getElementById('tagEditInput');
    const name = (input.value || '').trim();
    if (!name) {
      showToast('标签名称不能为空');
      return;
    }
    const duplicate = tagsOf(state.categoryId).find(function (t) {
      return t.id !== editTagId && t.name === name;
    });
    if (duplicate) {
      showToast('该标签已存在');
      return;
    }
    const tag = tags.find(function (t) {
      return t.id === editTagId;
    });
    if (!tag) {
      closeTagDropdown();
      return;
    }
    tag.name = name;
    try {
      await DB.put(DB.stores.tags, tag);
      document.getElementById('tagEditRow').hidden = true;
      editTagId = '';
      renderTagList();
      renderTagArea();
    } catch (err) {
      console.error('[小账本] 修改标签失败', err);
      showToast('修改失败，请重试');
    }
  }

  function closeTagDropdown() {
    const dropdown = document.getElementById('tagDropdown');
    if (dropdown) {
      dropdown.hidden = true;
    }
    const addRow = document.getElementById('tagAddRow');
    if (addRow) {
      addRow.hidden = true;
    }
    const editRow = document.getElementById('tagEditRow');
    if (editRow) {
      editRow.hidden = true;
    }
    document.removeEventListener('click', onTagDocClick);
  }

  function onTagDocClick(event) {
    const select = document.getElementById('tagSelect');
    if (select && !select.contains(event.target)) {
      closeTagDropdown();
    }
  }

  function openTagDropdown() {
    const dropdown = document.getElementById('tagDropdown');
    if (!dropdown) {
      return;
    }
    dropdown.hidden = false;
    document.getElementById('tagSearch').value = '';
    renderTagList();
    document.addEventListener('click', onTagDocClick);
  }

  function renderTagArea() {
    const card = document.getElementById('tagCard');
    if (!card) {
      return;
    }
    card.hidden = state.type === 'transfer';

    const textEl = document.getElementById('tagSelectText');
    if (!textEl) {
      return;
    }
    const selected = tags.find(function (t) {
      return t.id === state.tagId;
    });
    textEl.textContent = selected ? selected.name : '选择标签';

    const dropdown = document.getElementById('tagDropdown');
    if (dropdown && !dropdown.hidden) {
      renderTagList();
    }
    updateTemplateName();
  }

  async function addTag() {
    const input = document.getElementById('tagNewInput');
    const name = (input.value || '').trim();
    if (!name) {
      showToast('请输入标签名称');
      return;
    }
    const existing = tagsOf(state.categoryId).find(function (t) {
      return t.name === name;
    });
    if (existing) {
      state.tagId = existing.id;
      closeTagDropdown();
      renderTagArea();
      showToast('该标签已存在，已直接选用');
      return;
    }

    const tag = {
      id: genId(),
      categoryId: state.categoryId,
      name: name,
      usageCount: 0
    };

    try {
      await DB.put(DB.stores.tags, tag);
      tags.push(tag);
      state.tagId = tag.id;
      closeTagDropdown();
      renderTagArea();
    } catch (err) {
      console.error('[小账本] 添加标签失败', err);
      showToast('添加失败，请重试');
    }
  }

  function openMethodManage() {
    document.getElementById('methodManageMask').hidden = false;
    renderMethodManageList();
  }

  function closeMethodManage() {
    document.getElementById('methodManageMask').hidden = true;
    manageEditId = '';
    manageDeleteId = '';
  }

  function renderMethodManageList() {
    const list = document.getElementById('methodManageList');
    list.innerHTML = sortedMethods().map(function (m) {
      return '<div class="manage-row" data-id="' + escapeHtml(m.id) + '">' +
        '<span class="row-name">' + escapeHtml(m.name) +
          (m.builtin ? ' <span class="row-badge">内置</span>' : '') +
        '</span>' +
        '<button class="manage-btn" data-act="up" type="button">↑</button>' +
        '<button class="manage-btn" data-act="down" type="button">↓</button>' +
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
      renderMethodArea();
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
    manageEditId = id;
    manageDeleteId = '';
    document.getElementById('methodDeleteRow').hidden = true;
    document.getElementById('methodEditRow').hidden = false;
    document.getElementById('methodEditInput').value = m.name;
    document.getElementById('methodEditInput').focus();
  }

  async function confirmMethodEdit() {
    const name = (document.getElementById('methodEditInput').value || '').trim();
    if (!name) {
      showToast('名称不能为空');
      return;
    }
    const m = methods.find(function (x) {
      return x.id === manageEditId;
    });
    if (!m) {
      return;
    }
    if (methods.some(function (x) {
      return x.id !== manageEditId && x.name === name;
    })) {
      showToast('该名称已存在');
      return;
    }
    m.name = name;
    try {
      await DB.put(DB.stores.paymentMethods, m);
      document.getElementById('methodEditRow').hidden = true;
      manageEditId = '';
      renderMethodManageList();
      renderMethodArea();
    } catch (err) {
      console.error('[小账本] 修改支出方式失败', err);
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
    manageDeleteId = id;
    manageEditId = '';
    document.getElementById('methodEditRow').hidden = true;
    document.getElementById('methodDeleteText').textContent =
      '确认删除「' + m.name + '」？历史账单不受影响。';
    document.getElementById('methodDeleteRow').hidden = false;
  }

  async function confirmMethodDelete() {
    const m = methods.find(function (x) {
      return x.id === manageDeleteId;
    });
    if (!m) {
      return;
    }
    try {
      await DB.remove(DB.stores.paymentMethods, m.id);
      const subs = subMethods.filter(function (s) {
        return s.methodId === m.id;
      });
      await Promise.all(subs.map(function (s) {
        return DB.remove(DB.stores.subMethods, s.id);
      }));
      methods = methods.filter(function (x) {
        return x.id !== m.id;
      });
      subMethods = subMethods.filter(function (s) {
        return s.methodId !== m.id;
      });
      manageDeleteId = '';
      document.getElementById('methodDeleteRow').hidden = true;
      renderMethodManageList();
      renderMethodArea();
      showToast('已删除：' + m.name);
    } catch (err) {
      console.error('[小账本] 删除支出方式失败', err);
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
      renderMethodArea();
    } catch (err) {
      console.error('[小账本] 隐藏/显示失败', err);
      showToast('操作失败，请重试');
    }
  }

  function openBankManage() {
    document.getElementById('bankManageMask').hidden = false;
    renderBankManageList();
  }

  function closeBankManage() {
    document.getElementById('bankManageMask').hidden = true;
    bankDeleteId = '';
  }

  function renderBankManageList() {
    const list = document.getElementById('bankManageList');
    list.innerHTML = sortedBanks().map(function (b) {
      return '<div class="manage-row" data-id="' + escapeHtml(b.id) + '">' +
        '<span class="row-name">' + escapeHtml(b.name) + '</span>' +
        '<button class="manage-btn" data-act="up" type="button">↑</button>' +
        '<button class="manage-btn" data-act="down" type="button">↓</button>' +
        '<button class="manage-btn danger" data-act="del" type="button">删除</button>' +
      '</div>';
    }).join('');

    list.querySelectorAll('.manage-row').forEach(function (row) {
      const id = row.dataset.id;
      row.querySelectorAll('.manage-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const act = btn.dataset.act;
          if (act === 'up') moveBank(id, -1);
          else if (act === 'down') moveBank(id, 1);
          else if (act === 'del') openBankDelete(id);
        });
      });
    });
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

  function openBankDelete(id) {
    const b = banks.find(function (x) {
      return x.id === id;
    });
    if (!b) {
      return;
    }
    bankDeleteId = id;
    document.getElementById('bankDeleteText').textContent =
      '确认删除「' + b.name + '」？历史账单不受影响。';
    document.getElementById('bankDeleteRow').hidden = false;
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
      document.getElementById('bankDeleteRow').hidden = true;
      renderBankManageList();
    } catch (err) {
      console.error('[小账本] 删除银行失败', err);
      showToast('删除失败，请重试');
    }
  }

  function defaultTemplateName() {
    if (state.type === 'transfer') {
      const from = methods.find(function (m) {
        return m.id === state.methodId;
      });
      const to = methods.find(function (m) {
        return m.id === state.toMethodId;
      });
      return (from ? from.name : '转出') + '-' + (to ? to.name : '转入');
    }
    const tag = tags.find(function (t) {
      return t.id === state.tagId;
    });
    const cat = categories.find(function (c) {
      return c.id === state.categoryId;
    });
    const method = methods.find(function (m) {
      return m.id === state.methodId;
    });
    const label = tag ? tag.name : (cat ? cat.name : '');
    return label ? label + '-' + (method ? method.name : '') : '';
  }

  function updateTemplateName() {
    if (!state.templateMode || state.templateNameEdited) {
      return;
    }
    state.templateName = defaultTemplateName();
    const nameInput = document.getElementById('templateNameInput');
    if (nameInput) {
      nameInput.value = state.templateName;
    }
  }

  function applyTemplate(id) {
    const tpl = templates.find(function (t) {
      return t.id === id;
    });
    if (!tpl) {
      return;
    }
    state.type = tpl.type || 'expense';
    state.categoryId = tpl.categoryId || '';
    state.tagId = tpl.tagId || '';
    state.methodId = tpl.methodId || '';
    state.subMethodId = tpl.subMethodId || '';
    state.bankName = tpl.bankName || '';
    state.toMethodId = tpl.toMethodId || '';
    state.toSubMethodId = tpl.toSubMethodId || '';
    state.toBankName = tpl.toBankName || '';
    state.note = tpl.note || '';
    state.amount = '';
    state.time = new Date();
    if (pageContainer) {
      renderPage(pageContainer);
      const amountInput = document.getElementById('amountInput');
      if (amountInput) {
        amountInput.focus();
      }
      const mainCard = document.getElementById('recordMainCard');
      if (mainCard) {
        mainCard.classList.add('flash-highlight');
        setTimeout(function () {
          mainCard.classList.remove('flash-highlight');
        }, 1200);
      }
    }
    tpl.usageCount = (tpl.usageCount || 0) + 1;
    DB.put(DB.stores.templates, tpl).catch(function () {});
    showToast('已应用模板：' + tpl.name);
  }

  function enterTemplateMode(type, preserve) {
    state.templateMode = true;
    if (type) {
      state.type = type;
    }
    if (!preserve) {
      state.categoryId = '';
      state.tagId = '';
      state.methodId = '';
      state.subMethodId = '';
      state.bankName = '';
      state.toMethodId = '';
      state.toSubMethodId = '';
      state.toBankName = '';
      state.note = '';
      state.amount = '';
    }
    state.templateName = '';
    state.templateNameEdited = false;
    state.templateOverwrite = false;
    templateOverwriteId = '';
    if (pageContainer) {
      renderPage(pageContainer);
      const nameInput = document.getElementById('templateNameInput');
      if (nameInput) {
        nameInput.focus();
        nameInput.select();
      }
    }
  }

  function exitTemplateMode() {
    state.templateMode = false;
    state.templateName = '';
    state.templateNameEdited = false;
    state.templateOverwrite = false;
    templateOverwriteId = '';
    if (pageContainer) {
      renderPage(pageContainer);
    }
  }

  function overwriteTemplateName() {
    const t = templates.find(function (x) {
      return x.id === templateOverwriteId;
    });
    return t ? t.name : '';
  }

  function buildTemplateObject(name) {
    const isTransfer = state.type === 'transfer';
    return {
      name: name,
      type: state.type,
      categoryId: isTransfer ? '' : state.categoryId,
      tagId: state.tagId || '',
      methodId: isTransfer ? '' : state.methodId,
      subMethodId: isTransfer ? '' : state.subMethodId,
      bankName: isTransfer ? '' : state.bankName,
      fromMethodId: isTransfer ? state.methodId : '',
      fromSubMethodId: isTransfer ? state.subMethodId : '',
      fromBankName: isTransfer ? state.bankName : '',
      toMethodId: isTransfer ? state.toMethodId : '',
      toSubMethodId: isTransfer ? state.toSubMethodId : '',
      toBankName: isTransfer ? state.toBankName : '',
      note: state.note.trim(),
      sortOrder: nextTemplateSort(),
      createdAt: Date.now()
    };
  }

  async function saveTemplateFromMode() {
    const name = state.templateName.trim();
    if (!name) {
      showToast('请输入模板名称');
      return;
    }
    if (state.type !== 'transfer' && !state.categoryId) {
      showToast('请先选择分类，再保存模板');
      return;
    }

    const existing = templates.find(function (t) {
      return t.name === name;
    });
    if (existing && !templateOverwriteId) {
      templateOverwriteId = existing.id;
      state.templateOverwrite = true;
      if (pageContainer) {
        renderPage(pageContainer);
      }
      return;
    }

    const tpl = buildTemplateObject(name);
    try {
      let saved = false;
      if (templateOverwriteId) {
        const target = templates.find(function (t) {
          return t.id === templateOverwriteId;
        });
        if (target) {
          Object.keys(tpl).forEach(function (key) {
            target[key] = tpl[key];
          });
          target.id = templateOverwriteId;
          await DB.put(DB.stores.templates, target);
          showToast('模板已更新：' + name);
          saved = true;
        }
      }
      if (!saved) {
        tpl.id = genId();
        templates.push(tpl);
        await DB.put(DB.stores.templates, tpl);
        showToast('已保存模板：' + name);
      }
      state.templateMode = false;
      state.templateName = '';
      state.templateNameEdited = false;
      state.templateOverwrite = false;
      templateOverwriteId = '';
      if (pageContainer) {
        renderPage(pageContainer);
      }
    } catch (err) {
      console.error('[小账本] 保存模板失败', err);
      showToast('保存失败，请重试');
    }
  }

  function openTemplatePicker(type) {
    state.templatePickerType = type || 'expense';
    const mask = document.getElementById('templateManageMask');
    if (!mask) {
      return;
    }
    mask.hidden = false;
    const title = document.getElementById('templateManageTitle');
    if (title) {
      title.textContent = '模板 · ' + (TYPE_LABELS[state.templatePickerType] || '支出');
    }
    renderTemplateManageList();
  }

  function closeTemplateManage() {
    document.getElementById('templateManageMask').hidden = true;
    templateEditId = '';
    templateDeleteId = '';
  }

  function renderTemplateManageList() {
    const list = document.getElementById('templateManageList');
    const items = sortedTemplates().filter(function (t) {
      return t.type === state.templatePickerType;
    });
    if (!items.length) {
      list.innerHTML = '<p class="tag-empty">该类型下还没有模板，点下方"＋ 添加模板"</p>';
    } else {
      list.innerHTML = items.map(function (t) {
        return '<div class="manage-row tpl-pick-row" data-id="' + escapeHtml(t.id) + '">' +
          '<span class="row-name tpl-pick-name">' + escapeHtml(t.name) + '</span>' +
          '<span class="tpl-usage">' + (t.usageCount || 0) + ' 次</span>' +
          '<button class="manage-btn" data-act="edit" type="button">✏️</button>' +
          '<button class="manage-btn danger" data-act="del" type="button">删除</button>' +
        '</div>';
      }).join('');
    }

    list.querySelectorAll('.manage-row').forEach(function (row) {
      const id = row.dataset.id;
      row.querySelector('.tpl-pick-name').addEventListener('click', function () {
        closeTemplateManage();
        applyTemplate(id);
      });
      row.querySelectorAll('.manage-btn').forEach(function (btn) {
        btn.addEventListener('click', function (event) {
          event.stopPropagation();
          if (btn.dataset.act === 'edit') {
            openTemplateEdit(id);
          } else if (btn.dataset.act === 'del') {
            openTemplateDelete(id);
          }
        });
      });
    });
  }

  function openTemplateEdit(id) {
    const t = templates.find(function (x) {
      return x.id === id;
    });
    if (!t) {
      return;
    }
    templateEditId = id;
    templateDeleteId = '';
    document.getElementById('templateDeleteRow').hidden = true;
    document.getElementById('templateEditRow').hidden = false;
    document.getElementById('templateEditInput').value = t.name;
    document.getElementById('templateEditInput').focus();
  }

  async function confirmTemplateEdit() {
    const name = (document.getElementById('templateEditInput').value || '').trim();
    if (!name) {
      showToast('模板名称不能为空');
      return;
    }
    const t = templates.find(function (x) {
      return x.id === templateEditId;
    });
    if (!t) {
      return;
    }
    if (templates.some(function (x) {
      return x.id !== templateEditId && x.name === name;
    })) {
      showToast('该模板名称已存在');
      return;
    }
    t.name = name;
    try {
      await DB.put(DB.stores.templates, t);
      document.getElementById('templateEditRow').hidden = true;
      templateEditId = '';
      renderTemplateManageList();
    } catch (err) {
      console.error('[小账本] 修改模板失败', err);
      showToast('修改失败，请重试');
    }
  }

  function openTemplateDelete(id) {
    const t = templates.find(function (x) {
      return x.id === id;
    });
    if (!t) {
      return;
    }
    templateDeleteId = id;
    templateEditId = '';
    document.getElementById('templateEditRow').hidden = true;
    document.getElementById('templateDeleteText').textContent =
      '确认删除模板「' + t.name + '」？';
    document.getElementById('templateDeleteRow').hidden = false;
  }

  async function confirmTemplateDelete() {
    const t = templates.find(function (x) {
      return x.id === templateDeleteId;
    });
    if (!t) {
      return;
    }
    try {
      await DB.remove(DB.stores.templates, t.id);
      templates = templates.filter(function (x) {
        return x.id !== t.id;
      });
      templateDeleteId = '';
      document.getElementById('templateDeleteRow').hidden = true;
      renderTemplateManageList();
      showToast('已删除模板');
    } catch (err) {
      console.error('[小账本] 删除模板失败', err);
      showToast('删除失败，请重试');
    }
  }

  function renderPage(container) {
    pageContainer = container;
    container.innerHTML =
      '<div class="notice-banner" id="saveNoticeBanner" hidden></div>' +

      '<div class="notice-banner success save-actions" id="saveActionsBar" hidden>' +
        '<span class="save-actions-text">✓ 已保存</span>' +
        '<span class="save-actions-btns">' +
          '<button class="chip save-action-btn" id="viewBillsBtn" type="button">查看账单</button>' +
          '<button class="chip save-action-btn" id="saveAsTemplateBtn" type="button">存为模板</button>' +
          '<button class="save-actions-close" id="saveActionsClose" type="button">✕</button>' +
        '</span>' +
      '</div>' +

      '<div class="card" id="templateCard">' +
        '<div class="card-title-row">' +
          '<h2 class="card-title">常用模板</h2>' +
        '</div>' +
        '<div class="tpl-type-btns">' +
          '<button class="tpl-type-btn" data-type="expense" type="button">支出</button>' +
          '<button class="tpl-type-btn" data-type="income" type="button">收入</button>' +
          '<button class="tpl-type-btn" data-type="transfer" type="button">转账</button>' +
        '</div>' +
      '</div>' +

      '<div class="card budget-card" id="budgetCard"></div>' +
      '<div class="budget-reminder" id="budgetReminderBanner" hidden></div>' +

      (state.editingId && !state.templateMode ?
        '<div class="card edit-banner">' +
          '<h2 class="card-title">正在编辑账单</h2>' +
          '<p class="hint">修改后点"更新账单"保存；或点"取消编辑"。</p>' +
          '<button class="chip tpl-cancel-btn" id="cancelEditBtn" type="button">取消编辑</button>' +
        '</div>' : '') +

      (state.templateMode ?
        '<div class="card tpl-edit-banner">' +
          '<h2 class="card-title">正在编辑模板</h2>' +
          '<input class="text-input" id="templateNameInput" placeholder="模板名称，如：早餐" value="' +
            escapeHtml(state.templateName) + '">' +
          '<p class="hint">像记账一样选择内容，不填金额；完成后点"保存模板"。</p>' +
          (state.templateOverwrite ?
            '<div class="manage-inline manage-confirm">' +
              '<p class="manage-confirm-text">已存在同名模板「' +
                escapeHtml(overwriteTemplateName()) + '」，确定覆盖？</p>' +
              '<div class="tag-add-actions">' +
                '<button class="chip" id="templateOverwriteConfirm" type="button">确定覆盖</button>' +
                '<button class="chip" id="templateOverwriteCancel" type="button">取消</button>' +
              '</div>' +
            '</div>' : '') +
        '</div>' : '') +

      '<div class="card" id="recordMainCard">' +
        '<div class="type-switch">' +
          '<button class="type-btn' + (state.type === 'expense' ? ' active' : '') + '" data-type="expense">支出</button>' +
          '<button class="type-btn' + (state.type === 'income' ? ' active' : '') + '" data-type="income">收入</button>' +
          '<button class="type-btn' + (state.type === 'transfer' ? ' active' : '') + '" data-type="transfer">转账</button>' +
        '</div>' +
        '<div class="amount-row" id="amountRow">' +
          '<span class="amount-symbol">¥</span>' +
          '<input class="amount-input" id="amountInput" inputmode="decimal" placeholder="0.00" value="' +
            escapeHtml(state.amount) + '">' +
        '</div>' +
      '</div>' +

      '<div class="card" id="categoryCard">' +
        '<h2 class="card-title" id="categoryTitle">支出分类</h2>' +
        '<div class="cat-grid" id="categoryGrid"></div>' +
      '</div>' +

      '<div class="card" id="tagCard">' +
        '<h2 class="card-title">标签（可选）</h2>' +
        '<div class="tag-select" id="tagSelect">' +
          '<button class="tag-select-btn" id="tagSelectBtn" type="button">' +
            '<span id="tagSelectText">选择标签</span>' +
            '<span class="tag-arrow">▾</span>' +
          '</button>' +
          '<div class="tag-dropdown" id="tagDropdown" hidden>' +
            '<input class="text-input tag-search" id="tagSearch" placeholder="搜索标签">' +
            '<div class="tag-list" id="tagList"></div>' +
            '<button class="tag-add-btn" id="tagAddBtn" type="button">＋ 添加标签</button>' +
            '<div class="tag-add-row" id="tagAddRow" hidden>' +
              '<input class="text-input" id="tagNewInput" placeholder="新标签名称">' +
              '<div class="tag-add-actions">' +
                '<button class="chip" id="tagAddConfirm" type="button">确定</button>' +
                '<button class="chip" id="tagAddCancel" type="button">取消</button>' +
              '</div>' +
            '</div>' +
            '<div class="tag-add-row" id="tagEditRow" hidden>' +
              '<input class="text-input" id="tagEditInput" placeholder="修改标签名称">' +
              '<div class="tag-add-actions">' +
                '<button class="chip" id="tagEditConfirm" type="button">确定</button>' +
                '<button class="chip" id="tagEditCancel" type="button">取消</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="card" id="methodCard">' +
        '<div class="card-title-row">' +
          '<h2 class="card-title" id="methodTitle">支出方式</h2>' +
          '<button class="manage-link" id="manageMethodsBtn" type="button">管理</button>' +
        '</div>' +
        '<div class="chip-group" id="methodGroup"></div>' +
        '<div class="chip-group" id="subMethodGroup"></div>' +
        '<div id="bankSlot"></div>' +
      '</div>' +

      '<div class="card" id="transferCard" hidden>' +
        '<h2 class="card-title">转出方式</h2>' +
        '<div class="chip-group" id="fromMethodGroup"></div>' +
        '<div class="chip-group" id="fromSubMethodGroup"></div>' +
        '<div id="fromBankSlot"></div>' +
        '<h2 class="card-title transfer-title">转入方式</h2>' +
        '<div class="chip-group" id="toMethodGroup"></div>' +
        '<div class="chip-group" id="toSubMethodGroup"></div>' +
        '<div id="toBankSlot"></div>' +
      '</div>' +

      '<div class="card" id="budgetExcCard"' + (state.type === 'expense' ? '' : ' hidden') + '>' +
        '<div class="card-title-row">' +
          '<h2 class="card-title">预算例外</h2>' +
        '</div>' +
        '<div class="budget-exceptions">' +
          '<label class="role-check"><input type="checkbox" id="excDaily"' + (state.noDailyBudget ? ' checked' : '') + '> 不计入日预算</label>' +
          '<label class="role-check"><input type="checkbox" id="excMonthly"' + (state.noMonthlyBudget ? ' checked' : '') + '> 不计入月预算</label>' +
          '<label class="role-check"><input type="checkbox" id="excYearly"' + (state.noYearlyBudget ? ' checked' : '') + '> 不计入年预算</label>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<input class="text-input" id="noteInput" placeholder="备注（可选，之后可按关键词搜索）" value="' +
          escapeHtml(state.note) + '">' +
      '</div>' +

      '<div class="card" id="timeCard">' +
        '<input class="text-input" id="timeInput" type="date" value="' +
          toDateInputValue(state.time) + '">' +
      '</div>' +

      '<div class="modal-mask" id="addMethodMask" hidden>' +
        '<div class="modal-card">' +
          '<h2 class="card-title">添加支付方式</h2>' +
          '<input class="text-input" id="addMethodInput" placeholder="方式名称，如：现金">' +
          '<div class="role-checks">' +
            '<label class="role-check"><input type="checkbox" id="roleExpense" checked> 用作支出方式</label>' +
            '<label class="role-check"><input type="checkbox" id="roleIncome" checked> 用作收入方式</label>' +
            '<label class="role-check"><input type="checkbox" id="roleTransferFrom" checked> 用作转出方式</label>' +
            '<label class="role-check"><input type="checkbox" id="roleTransferTo" checked> 用作转入方式</label>' +
          '</div>' +
          '<div class="tag-add-actions modal-actions">' +
            '<button class="chip" id="addMethodConfirm" type="button">确定</button>' +
            '<button class="chip" id="addMethodCancel" type="button">取消</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="modal-mask" id="methodManageMask" hidden>' +
        '<div class="modal-card manage-card">' +
          '<div class="modal-head">' +
            '<h2 class="card-title">支出方式管理</h2>' +
            '<button class="manage-close" id="methodManageClose" type="button">✕</button>' +
          '</div>' +
          '<div class="manage-inline" id="methodEditRow" hidden>' +
            '<input class="text-input" id="methodEditInput" placeholder="新名称">' +
            '<div class="tag-add-actions">' +
              '<button class="chip" id="methodEditConfirm" type="button">确定</button>' +
              '<button class="chip" id="methodEditCancel" type="button">取消</button>' +
            '</div>' +
          '</div>' +
          '<div class="manage-inline manage-confirm" id="methodDeleteRow" hidden>' +
            '<p class="manage-confirm-text" id="methodDeleteText"></p>' +
            '<div class="tag-add-actions">' +
              '<button class="chip" id="methodDeleteConfirm" type="button">确定删除</button>' +
              '<button class="chip" id="methodDeleteCancel" type="button">取消</button>' +
            '</div>' +
          '</div>' +
          '<div class="manage-list" id="methodManageList"></div>' +
        '</div>' +
      '</div>' +

      '<div class="modal-mask" id="bankManageMask" hidden>' +
        '<div class="modal-card manage-card">' +
          '<div class="modal-head">' +
            '<h2 class="card-title">银行卡管理</h2>' +
            '<button class="manage-close" id="bankManageClose" type="button">✕</button>' +
          '</div>' +
          '<div class="manage-inline manage-confirm" id="bankDeleteRow" hidden>' +
            '<p class="manage-confirm-text" id="bankDeleteText"></p>' +
            '<div class="tag-add-actions">' +
              '<button class="chip" id="bankDeleteConfirm" type="button">确定删除</button>' +
              '<button class="chip" id="bankDeleteCancel" type="button">取消</button>' +
            '</div>' +
          '</div>' +
          '<div class="manage-list" id="bankManageList"></div>' +
        '</div>' +
      '</div>' +

      '<div class="modal-mask" id="templateManageMask" hidden>' +
        '<div class="modal-card manage-card">' +
          '<div class="modal-head">' +
            '<h2 class="card-title" id="templateManageTitle">模板 · 支出</h2>' +
            '<button class="manage-close" id="templateManageClose" type="button">✕</button>' +
          '</div>' +
          '<div class="manage-inline" id="templateEditRow" hidden>' +
            '<input class="text-input" id="templateEditInput" placeholder="新名称">' +
            '<div class="tag-add-actions">' +
              '<button class="chip" id="templateEditConfirm" type="button">确定</button>' +
              '<button class="chip" id="templateEditCancel" type="button">取消</button>' +
            '</div>' +
          '</div>' +
          '<div class="manage-inline manage-confirm" id="templateDeleteRow" hidden>' +
            '<p class="manage-confirm-text" id="templateDeleteText"></p>' +
            '<div class="tag-add-actions">' +
              '<button class="chip" id="templateDeleteConfirm" type="button">确定删除</button>' +
              '<button class="chip" id="templateDeleteCancel" type="button">取消</button>' +
            '</div>' +
          '</div>' +
          '<div class="manage-list" id="templateManageList"></div>' +
          '<button class="tag-add-btn" id="templateAddFromPickerBtn" type="button">＋ 添加模板</button>' +
        '</div>' +
      '</div>' +

      (state.templateMode ?
        '<div class="tpl-actions">' +
          '<button class="save-btn" id="templateSaveBtn" type="button">保存模板</button>' +
          '<button class="chip tpl-cancel-btn" id="templateCancelBtn" type="button">取消</button>' +
        '</div>' :
        '<button class="save-btn" id="saveBtn">' + (state.editingId ? '更新账单' : '保存') + '</button>') +
      '<p class="hint saved-count" id="savedCount"></p>';

    document.getElementById('templateCard').hidden = state.templateMode || !!state.editingId;
    document.getElementById('amountRow').hidden = state.templateMode;
    document.getElementById('timeCard').hidden = state.templateMode;

    container.querySelectorAll('.type-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.type = btn.dataset.type;
        state.time = new Date();
        state.tagId = '';
        state.noDailyBudget = false;
        state.noMonthlyBudget = false;
        state.noYearlyBudget = false;
        renderPage(container);
      });
    });

    const amountInput = document.getElementById('amountInput');
    amountInput.addEventListener('input', function () {
      let v = amountInput.value.replace(/[^\d.]/g, '');
      const dot = v.indexOf('.');
      if (dot !== -1) {
        v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '');
        v = v.slice(0, dot + 3);
      } else if (v.length > 9) {
        v = v.slice(0, 9);
      }
      amountInput.value = v;
      state.amount = v;
    });

    document.getElementById('noteInput').addEventListener('input', function () {
      state.note = this.value;
    });

    document.getElementById('timeInput').addEventListener('change', function () {
      if (this.value) {
        state.time = new Date(this.value + 'T00:00:00');
      }
    });

    document.getElementById('tagSelectBtn').addEventListener('click', function (event) {
      event.stopPropagation();
      const dropdown = document.getElementById('tagDropdown');
      if (dropdown.hidden) {
        openTagDropdown();
      } else {
        closeTagDropdown();
      }
    });

    document.getElementById('tagSearch').addEventListener('input', renderTagList);

    document.getElementById('tagAddBtn').addEventListener('click', function () {
      document.getElementById('tagAddRow').hidden = false;
      document.getElementById('tagNewInput').value = '';
      document.getElementById('tagNewInput').focus();
    });

    document.getElementById('tagAddConfirm').addEventListener('click', addTag);

    document.getElementById('tagAddCancel').addEventListener('click', function () {
      document.getElementById('tagAddRow').hidden = true;
    });

    document.getElementById('tagNewInput').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        addTag();
      }
    });

    document.getElementById('tagEditConfirm').addEventListener('click', editTag);

    document.getElementById('tagEditCancel').addEventListener('click', function () {
      document.getElementById('tagEditRow').hidden = true;
      editTagId = '';
    });

    document.getElementById('tagEditInput').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        editTag();
      }
    });

    document.getElementById('addMethodConfirm').addEventListener('click', confirmAddMethod);

    document.getElementById('addMethodCancel').addEventListener('click', closeAddMethod);

    document.getElementById('addMethodInput').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        confirmAddMethod();
      }
    });

    document.getElementById('manageMethodsBtn').addEventListener('click', openMethodManage);
    document.getElementById('methodManageClose').addEventListener('click', closeMethodManage);
    document.getElementById('methodEditConfirm').addEventListener('click', confirmMethodEdit);
    document.getElementById('methodEditCancel').addEventListener('click', function () {
      document.getElementById('methodEditRow').hidden = true;
      manageEditId = '';
    });
    document.getElementById('methodEditInput').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        confirmMethodEdit();
      }
    });
    document.getElementById('methodDeleteConfirm').addEventListener('click', confirmMethodDelete);
    document.getElementById('methodDeleteCancel').addEventListener('click', function () {
      document.getElementById('methodDeleteRow').hidden = true;
      manageDeleteId = '';
    });
    document.getElementById('bankManageClose').addEventListener('click', closeBankManage);
    document.getElementById('bankDeleteConfirm').addEventListener('click', confirmBankDelete);
    document.getElementById('bankDeleteCancel').addEventListener('click', function () {
      document.getElementById('bankDeleteRow').hidden = true;
      bankDeleteId = '';
    });

    document.querySelectorAll('.tpl-type-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openTemplatePicker(btn.dataset.type);
      });
    });
    const tplNameInput = document.getElementById('templateNameInput');
    if (tplNameInput) {
      tplNameInput.addEventListener('input', function () {
        state.templateName = this.value;
        state.templateNameEdited = true;
      });
      tplNameInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          saveTemplateFromMode();
        }
      });
    }
    const tplSaveBtn = document.getElementById('templateSaveBtn');
    if (tplSaveBtn) {
      tplSaveBtn.addEventListener('click', saveTemplateFromMode);
    }
    const tplCancelBtn = document.getElementById('templateCancelBtn');
    if (tplCancelBtn) {
      tplCancelBtn.addEventListener('click', exitTemplateMode);
    }
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener('click', function () {
        state.editingId = null;
        state.amount = '';
        state.note = '';
        state.time = new Date();
        state.noDailyBudget = false;
        state.noMonthlyBudget = false;
        state.noYearlyBudget = false;
        renderPage(pageContainer);
      });
    }
    const overwriteConfirm = document.getElementById('templateOverwriteConfirm');
    if (overwriteConfirm) {
      overwriteConfirm.addEventListener('click', saveTemplateFromMode);
    }
    const overwriteCancel = document.getElementById('templateOverwriteCancel');
    if (overwriteCancel) {
      overwriteCancel.addEventListener('click', function () {
        state.templateOverwrite = false;
        templateOverwriteId = '';
        renderPage(pageContainer);
      });
    }
    document.getElementById('excDaily').addEventListener('change', function () {
      state.noDailyBudget = this.checked;
    });
    document.getElementById('excMonthly').addEventListener('change', function () {
      state.noMonthlyBudget = this.checked;
    });
    document.getElementById('excYearly').addEventListener('change', function () {
      state.noYearlyBudget = this.checked;
    });
    document.getElementById('viewBillsBtn').addEventListener('click', function () {
      hideSaveActions();
      window.PendingHighlight = { id: lastSavedId, time: lastSavedTime };
      location.hash = '#bills';
    });
    document.getElementById('saveAsTemplateBtn').addEventListener('click', function () {
      hideSaveActions();
      enterTemplateMode(null, true);
    });
    document.getElementById('saveActionsClose').addEventListener('click', hideSaveActions);
    document.getElementById('templateManageClose').addEventListener('click', closeTemplateManage);
    document.getElementById('templateAddFromPickerBtn').addEventListener('click', function () {
      const type = state.templatePickerType;
      closeTemplateManage();
      enterTemplateMode(type);
    });
    document.getElementById('templateEditConfirm').addEventListener('click', confirmTemplateEdit);
    document.getElementById('templateEditCancel').addEventListener('click', function () {
      document.getElementById('templateEditRow').hidden = true;
      templateEditId = '';
    });
    document.getElementById('templateEditInput').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        confirmTemplateEdit();
      }
    });
    document.getElementById('templateDeleteConfirm').addEventListener('click', confirmTemplateDelete);
    document.getElementById('templateDeleteCancel').addEventListener('click', function () {
      document.getElementById('templateDeleteRow').hidden = true;
      templateDeleteId = '';
    });

    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveRecord);
    }

    renderCategoryArea();
    renderMethodArea();
    renderTagArea();
    updateTemplateName();
    updateBudgetCard();
    showBudgetReminderBanner(budgetReminders().join(' · '));
    updateSavedCount();
  }

  async function saveRecord() {
    const num = parseFloat(state.amount);
    if (!state.amount || !(num > 0)) {
      showSaveNotice('请填写金额', 'error');
      flashField(document.getElementById('amountInput'));
      return;
    }
    if (state.type !== 'transfer' && !state.categoryId) {
      showSaveNotice('请选择分类', 'error');
      flashField(document.getElementById('categoryCard'));
      return;
    }
    if (state.type === 'transfer') {
      if (!state.methodId || !state.toMethodId) {
        showSaveNotice('请选择转出和转入方式', 'error');
        flashField(document.getElementById('transferCard'));
        return;
      }
    } else if (!state.methodId) {
      showSaveNotice('请选择支出/收入方式', 'error');
      flashField(document.getElementById('methodCard'));
      return;
    }

    const isTransfer = state.type === 'transfer';
    const method = methods.find(function (m) {
      return m.id === state.methodId;
    });
    const sub = subsForMethod(method).find(function (s) {
      return s.id === state.subMethodId;
    });
    const toMethod = methods.find(function (m) {
      return m.id === state.toMethodId;
    });
    const toSub = subsForMethod(toMethod).find(function (s) {
      return s.id === state.toSubMethodId;
    });
    const record = {
      id: state.editingId || genId(),
      type: state.type,
      amountCents: Math.round(num * 100),
      categoryId: isTransfer ? '' : state.categoryId,
      methodId: isTransfer ? '' : state.methodId,
      subMethodId: isTransfer ? '' : state.subMethodId,
      methodName: isTransfer ? '' : (method ? method.name : ''),
      subMethodName: isTransfer ? '' : (sub ? sub.name : ''),
      bankName: isTransfer ? '' : state.bankName,
      tagId: state.tagId || '',
      fromMethodId: isTransfer ? state.methodId : '',
      fromSubMethodId: isTransfer ? state.subMethodId : '',
      fromMethodName: isTransfer && method ? method.name : '',
      fromSubMethodName: isTransfer && sub ? sub.name : '',
      fromBankName: isTransfer ? state.bankName : '',
      toMethodId: isTransfer ? state.toMethodId : '',
      toSubMethodId: isTransfer ? state.toSubMethodId : '',
      toMethodName: isTransfer && toMethod ? toMethod.name : '',
      toSubMethodName: isTransfer && toSub ? toSub.name : '',
      toBankName: isTransfer ? state.toBankName : '',
      note: state.note.trim(),
      noDailyBudget: state.type === 'expense' && state.noDailyBudget,
      noMonthlyBudget: state.type === 'expense' && state.noMonthlyBudget,
      noYearlyBudget: state.type === 'expense' && state.noYearlyBudget,
      time: state.time.getTime(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const wasEditing = !!state.editingId;
    try {
      await DB.put(DB.stores.records, record);
      if (wasEditing) {
        const idx = allRecords.findIndex(function (x) {
          return x.id === record.id;
        });
        if (idx !== -1) {
          allRecords[idx] = record;
        } else {
          allRecords.push(record);
        }
      } else {
        allRecords.push(record);
      }
      const reminders = budgetReminders();
      const noticeText = reminders.join(' · ') || (wasEditing ? '账单已更新' : '保存成功');
      const noticeType = reminders.length ? 'error' : 'success';
      showToast(noticeText);
      if (wasEditing) {
        window.PendingNotice = { text: noticeText, type: noticeType };
      } else {
        lastSavedId = record.id;
        lastSavedTime = record.time;
        if (quickActionsEnabled) {
          if (reminders.length) {
            showSaveNotice(noticeText, 'error');
          }
          showSaveActions();
        } else {
          showSaveNotice(noticeText, noticeType);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      state.editingId = null;
      state.amount = '';
      state.note = '';
      state.time = new Date();
      state.noDailyBudget = false;
      state.noMonthlyBudget = false;
      state.noYearlyBudget = false;
      if (wasEditing) {
        if (pageContainer) {
          renderPage(pageContainer);
        }
        location.hash = '#bills';
      } else {
        document.getElementById('amountInput').value = '';
        document.getElementById('noteInput').value = '';
        document.getElementById('timeInput').value = toDateInputValue(state.time);
        document.getElementById('excDaily').checked = false;
        document.getElementById('excMonthly').checked = false;
        document.getElementById('excYearly').checked = false;
        if (record.tagId) {
          const tag = tags.find(function (t) {
            return t.id === record.tagId;
          });
          if (tag) {
            tag.usageCount = (tag.usageCount || 0) + 1;
            DB.put(DB.stores.tags, tag).catch(function () {});
          }
        }
        updateBudgetCard();
        updateSavedCount();
      }
    } catch (err) {
      console.error('[小账本] 保存失败', err);
      showToast('保存失败，请重试');
    }
  }

  async function render(container) {
    try {
      const results = await Promise.all([
        DB.getAll(DB.stores.categories),
        DB.getAll(DB.stores.paymentMethods),
        DB.getAll(DB.stores.subMethods),
        DB.getAll(DB.stores.tags),
        DB.getAll(DB.stores.banks),
        DB.getAll(DB.stores.templates),
        DB.getAll(DB.stores.settings),
        DB.getAll(DB.stores.records)
      ]);
      categories = results[0];
      methods = results[1];
      subMethods = results[2];
      tags = results[3];
      banks = results[4];
      templates = results[5];
      allRecords = results[7];
      dailyBudgetCents = null;
      monthlyBudgetCents = null;
      yearlyBudgetCents = null;
      results[6].forEach(function (s) {
        if (s.key === 'dailyBudget') {
          dailyBudgetCents = s.value;
        } else if (s.key === 'monthlyBudget') {
          monthlyBudgetCents = s.value;
        } else if (s.key === 'yearlyBudget') {
          yearlyBudgetCents = s.value;
        } else if (s.key === 'quickActions') {
          quickActionsEnabled = s.value !== false;
        }
      });
    } catch (err) {
      container.innerHTML = '<div class="card"><p class="hint">数据加载失败：' +
        escapeHtml(err.message) + '</p></div>';
      return;
    }

    if (window.PendingEdit) {
      const pe = window.PendingEdit;
      window.PendingEdit = null;
      state.editingId = pe.id;
      state.type = pe.type || 'expense';
      state.amount = (pe.amountCents / 100).toString();
      state.categoryId = pe.categoryId || '';
      state.tagId = pe.tagId || '';
      state.methodId = pe.type === 'transfer' ? (pe.fromMethodId || '') : (pe.methodId || '');
      state.subMethodId = pe.type === 'transfer' ? (pe.fromSubMethodId || '') : (pe.subMethodId || '');
      state.bankName = pe.type === 'transfer' ? (pe.fromBankName || '') : (pe.bankName || '');
      state.toMethodId = pe.type === 'transfer' ? (pe.toMethodId || '') : '';
      state.toSubMethodId = pe.type === 'transfer' ? (pe.toSubMethodId || '') : '';
      state.toBankName = pe.type === 'transfer' ? (pe.toBankName || '') : '';
      state.note = pe.note || '';
      state.noDailyBudget = !!pe.noDailyBudget;
      state.noMonthlyBudget = !!pe.noMonthlyBudget;
      state.noYearlyBudget = !!pe.noYearlyBudget;
      state.time = new Date(pe.time);
    }

    renderPage(container);
  }

  window.RenderRecordPage = render;
})();
