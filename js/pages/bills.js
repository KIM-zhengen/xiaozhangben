/* ============================================
   账单页 · 子项 1.6
   按日期分组的连续账单（类似微信/支付宝账单），
   支持月份切换、详情、编辑、删除、退款/转账标记
   ============================================ */
(function () {
  'use strict';

  const TYPE_LABELS = { expense: '支出', income: '收入', transfer: '转账' };

  let records = [];
  let categories = [];
  let tags = [];
  let methods = [];
  let subMethods = [];
  let banks = [];
  let currentDate = new Date();
  let pickerYear = new Date().getFullYear();
  let detailRecordId = '';
  let filterDraft = null;
  let methodActiveId = '';
  let tagActiveCategoryId = '';
  let transferActiveId = '';
  const PAGE_SIZE = 30;
  let visibleCount = PAGE_SIZE;
  const filters = {
    keyword: '',
    types: [],
    categoryIds: [],
    transferToIds: [],
    methods: [],
    tagIds: [],
    amountFrom: '',
    amountTo: '',
    dateFrom: '',
    dateTo: ''
  };

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function monthKey(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1);
  }

  function fmtMoney(cents) {
    return (cents / 100).toFixed(2);
  }

  function fmtDateCN(ts) {
    const d = new Date(ts);
    const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + week;
  }

  function categoryById(id) {
    return categories.find(function (c) {
      return c.id === id;
    });
  }

  function tagById(id) {
    return tags.find(function (t) {
      return t.id === id;
    });
  }

  function methodNameById(id) {
    const m = methods.find(function (x) {
      return x.id === id;
    });
    return m ? m.name : '';
  }

  function recordUsesBank(r, bankName) {
    if (r.bankName === bankName) {
      return true;
    }
    if (r.fromBankName === bankName || r.toBankName === bankName) {
      return true;
    }
    return false;
  }

  function filteredRecords(base) {
    let list = base.slice();
    const kws = filters.keyword.trim().toLowerCase().split(/\s+/).filter(function (k) {
      return k;
    });
    if (kws.length) {
      list = list.filter(function (r) {
        const tag = tagById(r.tagId);
        const tagName = tag ? tag.name : '';
        const cat = categoryById(r.categoryId);
        const catName = cat ? cat.name : '';
        const hay = ((r.note || '') + ' ' + tagName + ' ' + catName).toLowerCase();
        return kws.some(function (kw) {
          return hay.indexOf(kw) !== -1;
        });
      });
    }
    if (filters.types.length) {
      list = list.filter(function (r) {
        return filters.types.indexOf(r.type) !== -1;
      });
    }
    if (filters.categoryIds.length) {
      list = list.filter(function (r) {
        return filters.categoryIds.indexOf(r.categoryId) !== -1;
      });
    }
    if (filters.transferToIds.length) {
      list = list.filter(function (r) {
        if (r.type !== 'transfer') {
          return false;
        }
        return filters.transferToIds.some(function (key) {
          const parts = key.split('|');
          const m = parts[0];
          const s = parts[1] || '';
          if (m === 'pm_bankcard' && s && s.indexOf('bank_') === 0) {
            const bank = banks.find(function (b) {
              return b.id === s.slice(5);
            });
            return !!bank && r.toBankName === bank.name;
          }
          return r.toMethodId === m && (!s || r.toSubMethodId === s);
        });
      });
    }
    if (filters.methods.length) {
      list = list.filter(function (r) {
        return filters.methods.some(function (key) {
          const parts = key.split('|');
          const m = parts[0];
          const s = parts[1] || '';
          if (m === 'pm_bankcard' && s && s.indexOf('bank_') === 0) {
            const bank = banks.find(function (b) {
              return b.id === s.slice(5);
            });
            return !!bank && recordUsesBank(r, bank.name);
          }
          if (r.type === 'transfer') {
            const fromOk = r.fromMethodId === m && (!s || r.fromSubMethodId === s);
            const toOk = r.toMethodId === m && (!s || r.toSubMethodId === s);
            return fromOk || toOk;
          }
          return r.methodId === m && (!s || r.subMethodId === s);
        });
      });
    }
    if (filters.tagIds.length) {
      list = list.filter(function (r) {
        return filters.tagIds.indexOf(r.tagId) !== -1;
      });
    }
    const fromCents = filters.amountFrom === '' ? null : Math.round(parseFloat(filters.amountFrom) * 100);
    const toCents = filters.amountTo === '' ? null : Math.round(parseFloat(filters.amountTo) * 100);
    if (fromCents !== null || toCents !== null) {
      list = list.filter(function (r) {
        if (fromCents !== null && r.amountCents < fromCents) {
          return false;
        }
        if (toCents !== null && r.amountCents > toCents) {
          return false;
        }
        return true;
      });
    }
    if (filters.dateFrom || filters.dateTo) {
      list = list.filter(function (r) {
        const d = new Date(r.time);
        const key = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
        if (filters.dateFrom && key < filters.dateFrom) {
          return false;
        }
        if (filters.dateTo && key > filters.dateTo) {
          return false;
        }
        return true;
      });
    }
    return list;
  }

  function fmtDateShort(s) {
    if (!s) {
      return '';
    }
    const p = s.split('-');
    return (+p[1]) + '月' + (+p[2]) + '日';
  }

  function clearFilter(key) {
    if (key === 'keyword') filters.keyword = '';
    else if (key === 'types') filters.types = [];
    else if (key === 'categoryIds') filters.categoryIds = [];
    else if (key === 'transferToIds') filters.transferToIds = [];
    else if (key === 'methods') filters.methods = [];
    else if (key === 'tagIds') filters.tagIds = [];
    else if (key === 'amount') {
      filters.amountFrom = '';
      filters.amountTo = '';
    }
    else if (key === 'date') {
      filters.dateFrom = '';
      filters.dateTo = '';
    }
    renderList();
  }

  function renderFilterChips() {
    const chipsEl = document.getElementById('billFilterChips');
    if (!chipsEl) {
      return;
    }
    const chips = [];
    if (filters.keyword) {
      chips.push({ key: 'keyword', label: '关键词：' + filters.keyword });
    }
    if (filters.types.length) {
      chips.push({
        key: 'types',
        label: '类型：' + filters.types.map(function (t) {
          return TYPE_LABELS[t] || t;
        }).join('、')
      });
    }
    if (filters.categoryIds.length) {
      const names = filters.categoryIds.map(function (id) {
        const c = categoryById(id);
        return c ? c.name : '';
      }).filter(Boolean);
      chips.push({ key: 'categoryIds', label: '分类：' + names.join('、') });
    }
    if (filters.transferToIds.length) {
      const labels = filters.transferToIds.map(function (key) {
        const parts = key.split('|');
        const m = methods.find(function (x) {
          return x.id === parts[0];
        });
        const s = subMethods.find(function (x) {
          return x.id === parts[1];
        });
        if (!m) {
          return '';
        }
        if (parts[1] && parts[1].indexOf('bank_') === 0) {
          const bank = banks.find(function (x) {
            return x.id === parts[1].slice(5);
          });
          return bank ? m.name + '·' + bank.name : m.name;
        }
        return s ? m.name + '·' + s.name : m.name;
      }).filter(Boolean);
      chips.push({ key: 'transferToIds', label: '转入方式：' + labels.join('、') });
    }
    if (filters.methods.length) {
      const labels = filters.methods.map(function (key) {
        const parts = key.split('|');
        const m = methods.find(function (x) {
          return x.id === parts[0];
        });
        const s = subMethods.find(function (x) {
          return x.id === parts[1];
        });
        if (!m) {
          return '';
        }
        return s ? m.name + '·' + s.name : m.name;
      }).filter(Boolean);
      chips.push({ key: 'methods', label: '方式：' + labels.join('、') });
    }
    if (filters.tagIds.length) {
      const names = filters.tagIds.map(function (id) {
        const t = tagById(id);
        return t ? t.name : '';
      }).filter(Boolean);
      chips.push({ key: 'tagIds', label: '标签：' + names.join('、') });
    }
    if (filters.amountFrom || filters.amountTo) {
      chips.push({
        key: 'amount',
        label: '金额：' + (filters.amountFrom || '0') + '~' + (filters.amountTo || '不限') + '元'
      });
    }
    if (filters.dateFrom || filters.dateTo) {
      chips.push({
        key: 'date',
        label: '时间：' + (filters.dateFrom ? fmtDateShort(filters.dateFrom) : '最早') +
          ' ~ ' + (filters.dateTo ? fmtDateShort(filters.dateTo) : '最晚')
      });
    }

    if (!chips.length) {
      chipsEl.hidden = true;
      chipsEl.innerHTML = '';
      return;
    }
    chipsEl.hidden = false;
    chipsEl.innerHTML = chips.map(function (c) {
      return '<button class="chip filter-chip" data-key="' + c.key + '" type="button">' +
        escapeHtml(c.label) + ' ✕</button>';
    }).join('') +
      '<button class="chip filter-chip danger-chip" id="filterClearAll" type="button">清除全部</button>';
    chipsEl.querySelectorAll('.filter-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.id === 'filterClearAll') {
          filters.keyword = '';
          filters.types = [];
          filters.categoryIds = [];
          filters.transferToIds = [];
          filters.methods = [];
          filters.tagIds = [];
          filters.amountFrom = '';
          filters.amountTo = '';
          filters.dateFrom = '';
          filters.dateTo = '';
          const kwInput = document.getElementById('billKeyword');
          if (kwInput) {
            kwInput.value = '';
          }
          renderList();
        } else {
          clearFilter(btn.dataset.key);
        }
      });
    });
  }

  function recordMainName(r) {
    if (r.type === 'transfer') {
      return '转账';
    }
    const cat = categoryById(r.categoryId);
    return cat ? cat.name : '其他';
  }

  function recordIcon(r) {
    if (r.type === 'transfer') {
      return '🔄';
    }
    const cat = categoryById(r.categoryId);
    return cat && cat.icon ? cat.icon : '❓';
  }

  function recordSub(r) {
    if (r.type === 'transfer') {
      const from = r.fromMethodName || methodNameById(r.fromMethodId);
      const to = r.toMethodName || methodNameById(r.toMethodId);
      return (from || '转出') + ' → ' + (to || '转入');
    }
    const parts = [];
    if (r.subMethodName) {
      parts.push(r.subMethodName);
    } else if (r.subMethodId) {
      const sm = subMethods.find(function (s) {
        return s.id === r.subMethodId;
      });
      if (sm) {
        parts.push(sm.name);
      }
    }
    const note = (r.note || '').trim();
    if (note) {
      parts.push(note);
    }
    return parts.join(' · ');
  }

  function refundBadge(r) {
    if (!r.refundedCents) {
      return '';
    }
    if (r.refundedCents >= r.amountCents) {
      return '<span class="bill-badge">已全额退款</span>';
    }
    return '<span class="bill-badge">已退 ¥' + fmtMoney(r.refundedCents) + '</span>';
  }

  function detailRow(label, value) {
    return '<div class="bill-detail-row">' +
      '<span class="bill-detail-label">' + escapeHtml(label) + '</span>' +
      '<span>' + escapeHtml(value) + '</span>' +
    '</div>';
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
    }, 2000);
  }

  let billNoticeTimer = null;

  function showBillNotice(text, type) {
    const banner = document.getElementById('billNoticeBanner');
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
    clearTimeout(billNoticeTimer);
    billNoticeTimer = setTimeout(function () {
      banner.hidden = true;
    }, 2500);
  }

  function render(container) {
    Promise.all([
      DB.getAll(DB.stores.records),
      DB.getAll(DB.stores.categories),
      DB.getAll(DB.stores.tags),
      DB.getAll(DB.stores.paymentMethods),
      DB.getAll(DB.stores.subMethods),
      DB.getAll(DB.stores.banks)
    ]).then(function (results) {
      records = results[0];
      categories = results[1];
      tags = results[2];
      methods = results[3];
      subMethods = results[4];
      banks = results[5];
      const bankFilter = window.PendingBankFilter;
      window.PendingBankFilter = null;
      if (bankFilter && bankFilter.bankId) {
        filters.keyword = '';
        filters.types = [];
        filters.categoryIds = [];
        filters.transferToIds = [];
        filters.methods = ['pm_bankcard|bank_' + bankFilter.bankId];
        filters.tagIds = [];
        filters.amountFrom = '';
        filters.amountTo = '';
        filters.dateFrom = '';
        filters.dateTo = '';
      }
      const highlight = window.PendingHighlight;
      window.PendingHighlight = null;
      if (highlight && highlight.time) {
        const d = new Date(highlight.time);
        currentDate = new Date(d.getFullYear(), d.getMonth(), 1);
      }
      buildPage(container);
      const pending = window.PendingNotice;
      window.PendingNotice = null;
      if (pending) {
        showBillNotice(pending.text, pending.type);
      }
      if (highlight && highlight.id) {
        const row = document.querySelector('#billsList .bill-row[data-id="' + highlight.id + '"]');
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          row.classList.add('bill-row-highlight');
          setTimeout(function () {
            row.classList.remove('bill-row-highlight');
          }, 3000);
        }
      }
    }).catch(function (err) {
      container.innerHTML = '<div class="card"><p class="hint">数据加载失败：' +
        escapeHtml(err.message) + '</p></div>';
    });
  }

  function buildPage(container) {
    container.innerHTML =
      '<div class="notice-banner" id="billNoticeBanner" hidden></div>' +

      '<div class="card" id="billsMonthCard">' +
        '<div class="bills-month-nav">' +
          '<button class="bills-month-btn" id="billsPrev" type="button">‹</button>' +
          '<div class="bills-month-center">' +
            '<button class="bills-month-title" id="billsMonthTitle" type="button"></button>' +
            '<button class="bills-today-btn" id="billsToday" type="button">回本月</button>' +
          '</div>' +
          '<button class="bills-month-btn" id="billsNext" type="button">›</button>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="bill-filter-bar">' +
          '<input class="text-input bill-search" id="billKeyword" placeholder="搜索备注 / 标签">' +
          '<button class="chip bill-filter-btn" id="billFilterBtn" type="button">筛选</button>' +
        '</div>' +
        '<div class="bill-filter-chips" id="billFilterChips" hidden></div>' +
      '</div>' +
      '<div class="card bills-summary" id="billsSummary"></div>' +
      '<div id="billsList"></div>' +

      '<div class="modal-mask" id="billDetailMask" hidden>' +
        '<div class="modal-card manage-card">' +
          '<div class="modal-head">' +
            '<h2 class="card-title">账单详情</h2>' +
            '<button class="manage-close" id="billDetailClose" type="button">✕</button>' +
          '</div>' +
          '<div id="billDetailBody"></div>' +
          '<div class="manage-inline manage-confirm" id="billDeleteRow" hidden>' +
            '<p class="manage-confirm-text">确认删除这笔账单？删除后不可恢复。</p>' +
            '<div class="tag-add-actions">' +
              '<button class="chip" id="billDeleteConfirm" type="button">确定删除</button>' +
              '<button class="chip" id="billDeleteCancel" type="button">取消</button>' +
            '</div>' +
          '</div>' +
          '<div class="bill-detail-actions">' +
            '<button class="chip" id="billEditBtn" type="button">编辑</button>' +
            '<button class="chip danger-chip" id="billDeleteBtn" type="button">删除</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="modal-mask" id="monthPickerMask" hidden>' +
        '<div class="modal-card">' +
          '<div class="modal-head">' +
            '<h2 class="card-title">选择月份</h2>' +
            '<button class="manage-close" id="mpClose" type="button">✕</button>' +
          '</div>' +
          '<div class="bills-month-nav">' +
            '<button class="bills-month-btn" id="mpPrevYear" type="button">‹</button>' +
            '<span class="bills-month-title" id="mpYearLabel"></span>' +
            '<button class="bills-month-btn" id="mpNextYear" type="button">›</button>' +
          '</div>' +
          '<div class="mp-grid" id="mpGrid"></div>' +
        '</div>' +
      '</div>' +

      '<div class="modal-mask" id="billFilterMask" hidden>' +
        '<div class="modal-card manage-card">' +
          '<div class="modal-head">' +
            '<h2 class="card-title">筛选</h2>' +
            '<button class="manage-close" id="billFilterClose" type="button">✕</button>' +
          '</div>' +
          '<div class="filter-group">' +
            '<h3 class="filter-group-title">类型</h3>' +
            '<div class="chip-group" id="filterTypes"></div>' +
          '</div>' +
          '<div class="filter-group">' +
            '<h3 class="filter-group-title">分类</h3>' +
            '<h4 class="filter-sub-title">支出</h4>' +
            '<div class="chip-group filter-chips" id="filterExpenseCats"></div>' +
            '<h4 class="filter-sub-title">收入</h4>' +
            '<div class="chip-group filter-chips" id="filterIncomeCats"></div>' +
            '<h4 class="filter-sub-title">转账 · 转入方式</h4>' +
            '<div class="link-panel">' +
              '<div class="link-left" id="transferLeft"></div>' +
              '<div class="link-right">' +
                '<div class="link-right-head">' +
                  '<span class="link-right-title" id="transferRightTitle"></span>' +
                  '<span class="link-tools">' +
                    '<button class="chip link-tool" id="transferSelectAll" type="button">全选</button>' +
                    '<button class="chip link-tool" id="transferClear" type="button">清空</button>' +
                  '</span>' +
                '</div>' +
                '<div class="chip-group filter-chips link-right-chips" id="transferRight"></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="filter-group">' +
            '<h3 class="filter-group-title">支出/收入方式</h3>' +
            '<div class="link-panel">' +
              '<div class="link-left" id="methodLeft"></div>' +
              '<div class="link-right">' +
                '<div class="link-right-head">' +
                  '<span class="link-right-title" id="methodRightTitle"></span>' +
                  '<span class="link-tools">' +
                    '<button class="chip link-tool" id="methodSelectAll" type="button">全选</button>' +
                    '<button class="chip link-tool" id="methodClear" type="button">清空</button>' +
                  '</span>' +
                '</div>' +
                '<div class="chip-group filter-chips link-right-chips" id="methodRight"></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="filter-group">' +
            '<h3 class="filter-group-title">标签</h3>' +
            '<div class="link-panel">' +
              '<div class="link-left" id="tagLeft"></div>' +
              '<div class="link-right">' +
                '<div class="link-right-head">' +
                  '<span class="link-right-title" id="tagRightTitle"></span>' +
                  '<span class="link-tools">' +
                    '<button class="chip link-tool" id="tagSelectAll" type="button">全选</button>' +
                    '<button class="chip link-tool" id="tagClear" type="button">清空</button>' +
                  '</span>' +
                '</div>' +
                '<div class="chip-group filter-chips link-right-chips" id="tagRight"></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="filter-group">' +
            '<h3 class="filter-group-title">金额范围</h3>' +
            '<div class="filter-amounts">' +
              '<input class="text-input" type="number" inputmode="decimal" min="0" step="0.01" id="filterAmountFrom" placeholder="从">' +
              '<span class="filter-date-sep">至</span>' +
              '<input class="text-input" type="number" inputmode="decimal" min="0" step="0.01" id="filterAmountTo" placeholder="到">' +
              '<span class="filter-date-sep">元</span>' +
            '</div>' +
          '</div>' +
          '<div class="filter-group">' +
            '<h3 class="filter-group-title">时间范围</h3>' +
            '<div class="filter-dates">' +
              '<input class="text-input" type="date" id="filterDateFrom">' +
              '<span class="filter-date-sep">至</span>' +
              '<input class="text-input" type="date" id="filterDateTo">' +
            '</div>' +
            '<button class="chip" id="filterDateClear" type="button">不限时间</button>' +
          '</div>' +
          '<div class="tag-add-actions modal-actions">' +
            '<button class="chip" id="filterReset" type="button">重置</button>' +
            '<button class="chip" id="filterApply" type="button">确定</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.getElementById('billsPrev').addEventListener('click', function () {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      renderList();
    });
    document.getElementById('billsNext').addEventListener('click', function () {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      renderList();
    });
    document.getElementById('billsToday').addEventListener('click', function () {
      currentDate = new Date();
      renderList();
    });
    document.getElementById('billsMonthTitle').addEventListener('click', function () {
      pickerYear = currentDate.getFullYear();
      document.getElementById('monthPickerMask').hidden = false;
      renderMonthPicker();
    });
    document.getElementById('mpClose').addEventListener('click', function () {
      document.getElementById('monthPickerMask').hidden = true;
    });
    document.getElementById('mpPrevYear').addEventListener('click', function () {
      pickerYear--;
      renderMonthPicker();
    });
    document.getElementById('mpNextYear').addEventListener('click', function () {
      pickerYear++;
      renderMonthPicker();
    });
    document.getElementById('billKeyword').addEventListener('input', function () {
      filters.keyword = this.value;
      renderList();
    });
    document.getElementById('billFilterBtn').addEventListener('click', openFilterModal);
    document.getElementById('billFilterClose').addEventListener('click', function () {
      document.getElementById('billFilterMask').hidden = true;
    });
    document.getElementById('filterDateClear').addEventListener('click', function () {
      document.getElementById('filterDateFrom').value = '';
      document.getElementById('filterDateTo').value = '';
    });
    document.getElementById('filterReset').addEventListener('click', function () {
      filterDraft = {
        types: [],
        categoryIds: [],
        transferToIds: [],
        methods: [],
        tagIds: [],
        amountFrom: '',
        amountTo: '',
        dateFrom: '',
        dateTo: ''
      };
      filters.keyword = '';
      const kwInput = document.getElementById('billKeyword');
      if (kwInput) {
        kwInput.value = '';
      }
      document.getElementById('billFilterMask').hidden = true;
      renderList();
    });
    document.getElementById('filterApply').addEventListener('click', applyFilterModal);
    document.getElementById('methodSelectAll').addEventListener('click', function () {
      if (!filterDraft) {
        return;
      }
      combosOf(methodActiveId).forEach(function (c) {
        if (filterDraft.methods.indexOf(c.key) === -1) {
          filterDraft.methods.push(c.key);
        }
      });
      renderMethodLink();
    });
    document.getElementById('methodClear').addEventListener('click', function () {
      if (!filterDraft) {
        return;
      }
      const remove = combosOf(methodActiveId).map(function (c) {
        return c.key;
      });
      filterDraft.methods = filterDraft.methods.filter(function (k) {
        return remove.indexOf(k) === -1;
      });
      renderMethodLink();
    });
    document.getElementById('tagSelectAll').addEventListener('click', function () {
      if (!filterDraft) {
        return;
      }
      tags.filter(function (t) {
        return t.categoryId === tagActiveCategoryId;
      }).forEach(function (t) {
        if (filterDraft.tagIds.indexOf(t.id) === -1) {
          filterDraft.tagIds.push(t.id);
        }
      });
      renderTagLink();
    });
    document.getElementById('tagClear').addEventListener('click', function () {
      if (!filterDraft) {
        return;
      }
      const remove = tags.filter(function (t) {
        return t.categoryId === tagActiveCategoryId;
      }).map(function (t) {
        return t.id;
      });
      filterDraft.tagIds = filterDraft.tagIds.filter(function (id) {
        return remove.indexOf(id) === -1;
      });
      renderTagLink();
    });
    document.getElementById('transferSelectAll').addEventListener('click', function () {
      if (!filterDraft) {
        return;
      }
      transferCombosOf(transferActiveId).forEach(function (c) {
        if (filterDraft.transferToIds.indexOf(c.key) === -1) {
          filterDraft.transferToIds.push(c.key);
        }
      });
      renderTransferLink();
    });
    document.getElementById('transferClear').addEventListener('click', function () {
      if (!filterDraft) {
        return;
      }
      const remove = transferCombosOf(transferActiveId).map(function (c) {
        return c.key;
      });
      filterDraft.transferToIds = filterDraft.transferToIds.filter(function (k) {
        return remove.indexOf(k) === -1;
      });
      renderTransferLink();
    });
    document.getElementById('billDetailClose').addEventListener('click', function () {
      document.getElementById('billDetailMask').hidden = true;
      detailRecordId = '';
    });
    document.getElementById('billEditBtn').addEventListener('click', function () {
      const r = records.find(function (x) {
        return x.id === detailRecordId;
      });
      if (!r) {
        return;
      }
      document.getElementById('billDetailMask').hidden = true;
      window.PendingEdit = r;
      location.hash = '#record';
    });
    document.getElementById('billDeleteBtn').addEventListener('click', function () {
      document.getElementById('billDeleteRow').hidden = false;
    });
    document.getElementById('billDeleteConfirm').addEventListener('click', confirmDelete);
    document.getElementById('billDeleteCancel').addEventListener('click', function () {
      document.getElementById('billDeleteRow').hidden = true;
    });

    renderList();
  }

  function openFilterModal() {
    filterDraft = {
      types: filters.types.slice(),
      categoryIds: filters.categoryIds.slice(),
      transferToIds: filters.transferToIds.slice(),
      methods: filters.methods.slice(),
      tagIds: filters.tagIds.slice(),
      amountFrom: filters.amountFrom,
      amountTo: filters.amountTo,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo
    };

    renderChipMulti(
      document.getElementById('filterExpenseCats'),
      categories.filter(function (c) {
        return c.type === 'expense';
      }).sort(function (a, b) {
        return a.name.localeCompare(b.name);
      }),
      filterDraft.categoryIds,
      function (c) {
        return c.id;
      },
      function (c) {
        return c.name;
      }
    );

    renderChipMulti(
      document.getElementById('filterIncomeCats'),
      categories.filter(function (c) {
        return c.type === 'income';
      }).sort(function (a, b) {
        return a.name.localeCompare(b.name);
      }),
      filterDraft.categoryIds,
      function (c) {
        return c.id;
      },
      function (c) {
        return c.name;
      }
    );

    renderMethodLink();
    renderTagLink();
    renderTransferLink();

    document.getElementById('filterAmountFrom').value = filterDraft.amountFrom;
    document.getElementById('filterAmountTo').value = filterDraft.amountTo;
    document.getElementById('filterDateFrom').value = filterDraft.dateFrom;
    document.getElementById('filterDateTo').value = filterDraft.dateTo;

    renderTypeChips();
    document.getElementById('billFilterMask').hidden = false;
  }

  function methodLinkItems() {
    const ids = [];
    methodCombos().forEach(function (c) {
      const mid = c.key.split('|')[0];
      if (ids.indexOf(mid) === -1) {
        ids.push(mid);
      }
    });
    return methods.slice().filter(function (m) {
      return ids.indexOf(m.id) !== -1;
    }).sort(function (a, b) {
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
  }

  function combosOf(methodId) {
    return methodCombos().filter(function (c) {
      return c.key.split('|')[0] === methodId;
    });
  }

  function renderMethodLink() {
    const left = document.getElementById('methodLeft');
    if (!left) {
      return;
    }
    const items = methodLinkItems();
    if (!methodActiveId || !items.some(function (m) {
      return m.id === methodActiveId;
    })) {
      methodActiveId = items.length ? items[0].id : '';
    }
    left.innerHTML = items.map(function (m) {
      return '<button class="link-item' + (m.id === methodActiveId ? ' active' : '') + '" data-id="' +
        escapeHtml(m.id) + '" type="button">' + escapeHtml(m.name) + '</button>';
    }).join('');
    left.querySelectorAll('.link-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        methodActiveId = btn.dataset.id;
        renderMethodLink();
      });
    });
    const active = methods.find(function (m) {
      return m.id === methodActiveId;
    });
    document.getElementById('methodRightTitle').textContent = active ? active.name + ' · 二级' : '';
    renderChipMulti(
      document.getElementById('methodRight'),
      combosOf(methodActiveId),
      filterDraft.methods,
      function (c) {
        return c.key;
      },
      function (c) {
        return c.label;
      }
    );
  }

  function tagLinkCategories() {
    return categories.filter(function (c) {
      return tags.some(function (t) {
        return t.categoryId === c.id;
      });
    }).sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
  }

  function renderTagLink() {
    const left = document.getElementById('tagLeft');
    if (!left) {
      return;
    }
    const items = tagLinkCategories();
    if (!tagActiveCategoryId || !items.some(function (c) {
      return c.id === tagActiveCategoryId;
    })) {
      tagActiveCategoryId = items.length ? items[0].id : '';
    }
    let html = '';
    ['expense', 'income'].forEach(function (type) {
      const list = items.filter(function (c) {
        return c.type === type;
      });
      if (!list.length) {
        return;
      }
      html += '<div class="link-group-title">' + (type === 'expense' ? '支出' : '收入') + '</div>';
      list.forEach(function (c) {
        html += '<button class="link-item' + (c.id === tagActiveCategoryId ? ' active' : '') + '" data-id="' +
          escapeHtml(c.id) + '" type="button">' + escapeHtml(c.name) + '</button>';
      });
    });
    left.innerHTML = html;
    left.querySelectorAll('.link-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        tagActiveCategoryId = btn.dataset.id;
        renderTagLink();
      });
    });
    const active = categories.find(function (c) {
      return c.id === tagActiveCategoryId;
    });
    document.getElementById('tagRightTitle').textContent = active ? active.name + ' · 标签' : '暂无标签';
    const tagItems = tags.filter(function (t) {
      return t.categoryId === tagActiveCategoryId;
    }).sort(function (a, b) {
      return (b.usageCount || 0) - (a.usageCount || 0);
    });
    renderChipMulti(
      document.getElementById('tagRight'),
      tagItems,
      filterDraft.tagIds,
      function (t) {
        return t.id;
      },
      function (t) {
        return t.name;
      }
    );
  }

  function transferLinkItems() {
    const ids = [];
    transferToCombos().forEach(function (c) {
      const mid = c.key.split('|')[0];
      if (ids.indexOf(mid) === -1) {
        ids.push(mid);
      }
    });
    return methods.slice().filter(function (m) {
      return ids.indexOf(m.id) !== -1;
    }).sort(function (a, b) {
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
  }

  function transferCombosOf(methodId) {
    return transferToCombos().filter(function (c) {
      return c.key.split('|')[0] === methodId;
    });
  }

  function renderTransferLink() {
    const left = document.getElementById('transferLeft');
    if (!left) {
      return;
    }
    const items = transferLinkItems();
    if (!transferActiveId || !items.some(function (m) {
      return m.id === transferActiveId;
    })) {
      transferActiveId = items.length ? items[0].id : '';
    }
    left.innerHTML = items.map(function (m) {
      return '<button class="link-item' + (m.id === transferActiveId ? ' active' : '') + '" data-id="' +
        escapeHtml(m.id) + '" type="button">' + escapeHtml(m.name) + '</button>';
    }).join('');
    left.querySelectorAll('.link-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        transferActiveId = btn.dataset.id;
        renderTransferLink();
      });
    });
    const active = methods.find(function (m) {
      return m.id === transferActiveId;
    });
    document.getElementById('transferRightTitle').textContent = active ? active.name + ' · 转入方式' : '';
    renderChipMulti(
      document.getElementById('transferRight'),
      transferCombosOf(transferActiveId),
      filterDraft.transferToIds,
      function (c) {
        return c.key;
      },
      function (c) {
        return c.label;
      }
    );
  }

  function renderTypeChips() {
    const wrap = document.getElementById('filterTypes');
    wrap.innerHTML = '';
    ['expense', 'income', 'transfer'].forEach(function (t) {
      const btn = document.createElement('button');
      btn.className = 'chip' + (filterDraft.types.indexOf(t) !== -1 ? ' selected' : '');
      btn.type = 'button';
      btn.textContent = TYPE_LABELS[t];
      btn.addEventListener('click', function () {
        const idx = filterDraft.types.indexOf(t);
        if (idx === -1) {
          filterDraft.types.push(t);
        } else {
          filterDraft.types.splice(idx, 1);
        }
        renderTypeChips();
      });
      wrap.appendChild(btn);
    });
  }

  function transferToCombos() {
    const combos = [];
    methods.slice().sort(function (a, b) {
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    }).forEach(function (m) {
      if (m.canTransferTo === false) {
        return;
      }
      if (m.bankMode) {
        banks.forEach(function (b) {
          combos.push({ key: m.id + '|bank_' + b.id, label: m.name + '·' + b.name });
        });
        return;
      }
      const subs = subMethods.filter(function (s) {
        return s.methodId === m.id;
      });
      if (!subs.length) {
        combos.push({
          key: m.id + '|',
          label: m.name
        });
      } else {
        subs.forEach(function (s) {
          combos.push({
            key: m.id + '|' + s.id,
            label: m.name + '·' + s.name
          });
        });
      }
    });
    return combos;
  }

  function methodCombos() {
    const combos = [];
    methods.slice().sort(function (a, b) {
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    }).forEach(function (m) {
      if (m.bankMode) {
        banks.forEach(function (b) {
          combos.push({ key: m.id + '|bank_' + b.id, label: m.name + '·' + b.name });
        });
        return;
      }
      const subs = subMethods.filter(function (s) {
        return s.methodId === m.id;
      });
      if (!subs.length) {
        combos.push({
          key: m.id + '|',
          label: m.name
        });
      } else {
        subs.forEach(function (s) {
          combos.push({
            key: m.id + '|' + s.id,
            label: m.name + '·' + s.name
          });
        });
      }
    });
    return combos;
  }

  function renderChipMulti(container, items, selectedKeys, getKey, getLabel) {
    container.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('span');
      empty.className = 'tpl-empty';
      empty.textContent = '暂无选项';
      container.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      const key = getKey(item);
      const btn = document.createElement('button');
      btn.className = 'chip' + (selectedKeys.indexOf(key) !== -1 ? ' selected' : '');
      btn.type = 'button';
      btn.textContent = getLabel(item);
      btn.addEventListener('click', function () {
        const idx = selectedKeys.indexOf(key);
        if (idx === -1) {
          selectedKeys.push(key);
        } else {
          selectedKeys.splice(idx, 1);
        }
        renderChipMulti(container, items, selectedKeys, getKey, getLabel);
      });
      container.appendChild(btn);
    });
  }

  function applyFilterModal() {
    filters.types = filterDraft.types.slice();
    filters.categoryIds = filterDraft.categoryIds.slice();
    filters.transferToIds = filterDraft.transferToIds.slice();
    filters.methods = filterDraft.methods.slice();
    filters.tagIds = filterDraft.tagIds.slice();
    filters.amountFrom = document.getElementById('filterAmountFrom').value;
    filters.amountTo = document.getElementById('filterAmountTo').value;
    filters.dateFrom = document.getElementById('filterDateFrom').value;
    filters.dateTo = document.getElementById('filterDateTo').value;
    document.getElementById('billFilterMask').hidden = true;
    renderList();
  }

  function renderList(more) {
    if (more) {
      visibleCount += PAGE_SIZE;
    } else {
      visibleCount = PAGE_SIZE;
    }
    const title = document.getElementById('billsMonthTitle');
    if (title) {
      title.textContent = currentDate.getFullYear() + '年' + (currentDate.getMonth() + 1) + '月';
    }
    const todayBtn = document.getElementById('billsToday');
    if (todayBtn) {
      todayBtn.style.display = monthKey(currentDate) === monthKey(new Date()) ? 'none' : '';
    }
    const monthCard = document.getElementById('billsMonthCard');
    if (monthCard) {
      monthCard.hidden = !!(filters.dateFrom || filters.dateTo);
    }

    const hasDateRange = !!(filters.dateFrom || filters.dateTo);
    const key = monthKey(currentDate);
    const base = hasDateRange
      ? records
      : records.filter(function (r) {
        return monthKey(new Date(r.time)) === key;
      });
    const monthRecords = filteredRecords(base).sort(function (a, b) {
      if (b.time !== a.time) {
        return b.time - a.time;
      }
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    renderFilterChips();

    let monthExpense = 0;
    let monthIncome = 0;
    monthRecords.forEach(function (r) {
      if (r.type === 'income') {
        monthIncome += r.amountCents;
      } else {
        monthExpense += r.amountCents;
      }
    });
    const summaryEl = document.getElementById('billsSummary');
    if (summaryEl) {
      const net = monthIncome - monthExpense;
      const netText = net >= 0 ? '¥' + fmtMoney(net) : '-¥' + fmtMoney(-net);
      summaryEl.innerHTML =
        '<div class="bills-summary-row">' +
          '<div><span class="bills-summary-label">支出</span>' +
            '<span class="bills-summary-value exp">¥' + fmtMoney(monthExpense) + '</span></div>' +
          '<div><span class="bills-summary-label">收入</span>' +
            '<span class="bills-summary-value inc">¥' + fmtMoney(monthIncome) + '</span></div>' +
          '<div><span class="bills-summary-label">净收支</span>' +
            '<span class="bills-summary-value ' + (net >= 0 ? 'inc' : 'exp') + '">' + netText + '</span></div>' +
        '</div>';
    }

    const listEl = document.getElementById('billsList');
    if (!monthRecords.length) {
      const anyFilter = !!(filters.keyword || filters.types.length || filters.categoryIds.length ||
        filters.transferToIds.length || filters.methods.length || filters.tagIds.length ||
        filters.amountFrom || filters.amountTo ||
        filters.dateFrom || filters.dateTo);
      listEl.innerHTML = '<p class="bill-empty">' +
        (anyFilter ? '没有符合条件的账单（可清除筛选）' : '这个月还没有账单，去记账页记一笔吧') +
        '</p>';
      return;
    }

    const displayRecords = monthRecords.slice(0, visibleCount);
    const groups = {};
    displayRecords.forEach(function (r) {
      const d = new Date(r.time);
      const dk = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      if (!groups[dk]) {
        groups[dk] = [];
      }
      groups[dk].push(r);
    });

    const days = Object.keys(groups).sort().reverse();
    listEl.innerHTML = days.map(function (dk) {
      const dayRecords = groups[dk];
      let expense = 0;
      let income = 0;
      dayRecords.forEach(function (r) {
        if (r.type === 'income') {
          income += r.amountCents;
        } else {
          expense += r.amountCents;
        }
      });
      const ts = new Date(dk + 'T00:00:00').getTime();
      const rows = dayRecords.map(function (r) {
        return '<div class="bill-row" data-id="' + escapeHtml(r.id) + '">' +
          '<span class="bill-icon">' + recordIcon(r) + '</span>' +
          '<div class="bill-main">' +
            '<div class="bill-name">' + escapeHtml(recordMainName(r)) + refundBadge(r) + '</div>' +
            '<div class="bill-sub">' + escapeHtml(recordSub(r)) + '</div>' +
          '</div>' +
          '<span class="bill-amount ' + (r.type === 'income' ? 'inc' : 'exp') + '">' +
            (r.type === 'income' ? '+' : '-') + '¥' + fmtMoney(r.amountCents) +
          '</span>' +
        '</div>';
      }).join('');
      return '<div class="bill-day-group">' +
        '<div class="bill-day-head">' +
          '<span>' + fmtDateCN(ts) + '</span>' +
          '<span class="bill-day-sum">' +
            '<span class="exp">支 ¥' + fmtMoney(expense) + '</span>' +
            '<span class="inc">收 ¥' + fmtMoney(income) + '</span>' +
          '</span>' +
        '</div>' +
        rows +
      '</div>';
    }).join('');
    if (monthRecords.length > visibleCount) {
      listEl.insertAdjacentHTML('beforeend', '<button class="load-more" id="loadMoreBtn" type="button">加载更多</button>');
    }
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', function () {
        renderList(true);
      });
    }

    listEl.querySelectorAll('.bill-row').forEach(function (row) {
      row.addEventListener('click', function () {
        showDetail(row.dataset.id);
      });
    });
  }

  function renderMonthPicker() {
    const yearLabel = document.getElementById('mpYearLabel');
    if (yearLabel) {
      yearLabel.textContent = pickerYear + '年';
    }
    const grid = document.getElementById('mpGrid');
    const curMonth = currentDate.getMonth() + 1;
    grid.innerHTML = '';
    for (let m = 1; m <= 12; m++) {
      const btn = document.createElement('button');
      btn.className = 'mp-month' + (pickerYear === currentDate.getFullYear() && m === curMonth
        ? ' active'
        : '');
      btn.type = 'button';
      btn.textContent = m + '月';
      btn.addEventListener('click', function () {
        currentDate = new Date(pickerYear, m - 1, 1);
        document.getElementById('monthPickerMask').hidden = true;
        renderList();
      });
      grid.appendChild(btn);
    }
  }

  function showDetail(id) {
    const r = records.find(function (x) {
      return x.id === id;
    });
    if (!r) {
      return;
    }
    detailRecordId = id;
    const typeLabel = { expense: '支出', income: '收入', transfer: '转账' }[r.type] || '支出';
    const cat = categoryById(r.categoryId);
    const tag = tagById(r.tagId);
    const method = r.methodName || methodNameById(r.methodId);
    const sub = r.subMethodName || '';
    const from = r.fromMethodName || methodNameById(r.fromMethodId);
    const to = r.toMethodName || methodNameById(r.toMethodId);
    const d = new Date(r.time);
    const dateStr = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';

    let rows = '';
    rows += detailRow('类型', typeLabel);
    rows += detailRow('金额', (r.type === 'income' ? '+' : '-') + '¥' + fmtMoney(r.amountCents));
    if (r.type === 'transfer') {
      rows += detailRow('转出', from + (r.fromBankName ? ' · ' + r.fromBankName : ''));
      rows += detailRow('转入', to + (r.toBankName ? ' · ' + r.toBankName : ''));
    } else {
      rows += detailRow('分类', cat ? cat.name : '其他');
      rows += detailRow(r.type === 'income' ? '收入方式' : '支出方式', sub ? (method + ' · ' + sub) : method);
      if (r.bankName) {
        rows += detailRow('所属银行', r.bankName);
      }
    }
    if (tag) {
      rows += detailRow('标签', tag.name);
    } else if (r.tagId) {
      rows += detailRow('标签', '（标签已删除）');
    }
    rows += detailRow('日期', dateStr);
    if (r.note) {
      rows += detailRow('备注', r.note);
    }
    if (r.refundedCents) {
      rows += detailRow('退款', r.refundedCents >= r.amountCents
        ? '已全额退款'
        : '已退 ¥' + fmtMoney(r.refundedCents));
    }

    document.getElementById('billDetailBody').innerHTML = rows;
    document.getElementById('billDeleteRow').hidden = true;
    document.getElementById('billDetailMask').hidden = false;
  }

  async function confirmDelete() {
    if (!detailRecordId) {
      return;
    }
    try {
      await DB.remove(DB.stores.records, detailRecordId);
      records = records.filter(function (r) {
        return r.id !== detailRecordId;
      });
      document.getElementById('billDetailMask').hidden = true;
      detailRecordId = '';
      renderList();
      showToast('已删除');
    } catch (err) {
      console.error('[小账本] 删除账单失败', err);
      showToast('删除失败，请重试');
    }
  }

  window.RenderBillsPage = render;
})();
