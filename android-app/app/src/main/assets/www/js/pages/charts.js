/* ============================================
   图表页 · 阶段 2.1（修订版）
   日 / 月 / 年维度；趋势图（柱状 + 环比 / 同比折线）
   与占比图（饼图）同卡片切换；状态记忆；年份范围自选
   ============================================ */
(function () {
  'use strict';

  const PIE_COLORS = [
    '#5B9BD5', '#E88BAD', '#5BBFA3', '#F0C75E', '#9B8AE0',
    '#E58A6B', '#7FB5E8', '#B5D99C', '#C9A7EB', '#F2A0BC'
  ];
  const STATE_KEY = 'jizhang_charts_state';

  let records = [];
  let categories = [];
  let methods = [];
  let dim = 'month';
  let viewDate = new Date();
  let yearFrom = new Date().getFullYear() - 2;
  let yearTo = new Date().getFullYear() + 2;
  let chartView = 'trend';
  let source = 'expense';
  let momOn = false;
  let yoyOn = false;
  let pieMode = 'category';
  let pieSource = 'expense';
  let pieDate = new Date();
  let trendChart = null;
  let pieChart = null;
  let cpYear = new Date().getFullYear();
  let cpMonth = new Date().getMonth() + 1;
  let cpFrom = yearFrom;
  let cpTo = yearTo;

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function fmtMoney(cents) {
    return (cents / 100).toFixed(2);
  }

  function pctLabel(x) {
    return (x > 0 ? '+' : '') + x.toFixed(1) + '%';
  }

  function categoryById(id) {
    return categories.find(function (c) {
      return c.id === id;
    });
  }

  function methodNameById(id) {
    const m = methods.find(function (x) {
      return x.id === id;
    });
    return m ? m.name : '';
  }

  function sourceLabel() {
    return source === 'income' ? '收入' : source === 'net' ? '净收支' : '支出';
  }

  function primaryColor() {
    const s = getComputedStyle(document.documentElement);
    return (s.getPropertyValue('--primary') || '#5B9BD5').trim();
  }

  function saveState() {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify({
        dim: dim,
        chartView: chartView,
        source: source,
        momOn: momOn,
        yoyOn: yoyOn,
        pieMode: pieMode,
        pieSource: pieSource,
        py: pieDate.getFullYear(),
        pm: pieDate.getMonth(),
        pd: pieDate.getDate(),
        vy: viewDate.getFullYear(),
        vm: viewDate.getMonth(),
        yearFrom: yearFrom,
        yearTo: yearTo
      }));
    } catch (e) {
      /* 忽略存储错误 */
    }
  }

  function restoreState() {
    try {
      const s = JSON.parse(localStorage.getItem(STATE_KEY));
      if (!s) {
        return;
      }
      if (s.dim === 'day' || s.dim === 'month' || s.dim === 'year') {
        dim = s.dim;
      }
      if (s.chartView === 'trend' || s.chartView === 'pie') {
        chartView = s.chartView;
      }
      if (s.source === 'expense' || s.source === 'income' || s.source === 'net') {
        source = s.source;
      }
      momOn = !!s.momOn;
      yoyOn = !!s.yoyOn;
      if (s.pieMode === 'category' || s.pieMode === 'method') {
        pieMode = s.pieMode;
      }
      if (s.pieSource === 'expense' || s.pieSource === 'income') {
        pieSource = s.pieSource;
      }
      pieDate = new Date(
        typeof s.py === 'number' ? s.py : now.getFullYear(),
        typeof s.pm === 'number' ? s.pm : now.getMonth(),
        typeof s.pd === 'number' ? s.pd : now.getDate()
      );
      const now = new Date();
      const vy = typeof s.vy === 'number' ? s.vy : now.getFullYear();
      const vm = typeof s.vm === 'number' ? s.vm : now.getMonth();
      viewDate = new Date(vy, vm, 1);
      if (typeof s.yearFrom === 'number' && typeof s.yearTo === 'number' &&
        s.yearFrom <= s.yearTo) {
        yearFrom = s.yearFrom;
        yearTo = s.yearTo;
      }
    } catch (e) {
      /* 恢复失败则使用默认 */
    }
  }
  restoreState();

  function inPeriod(r) {
    const d = new Date(r.time);
    if (dim === 'day') {
      return d.getFullYear() === viewDate.getFullYear() &&
        d.getMonth() === viewDate.getMonth();
    }
    if (dim === 'month') {
      return d.getFullYear() === viewDate.getFullYear();
    }
    return d.getFullYear() >= yearFrom && d.getFullYear() <= yearTo;
  }

  function periodInfo() {
    if (dim === 'day') {
      const y = viewDate.getFullYear();
      const m = viewDate.getMonth();
      const days = new Date(y, m + 1, 0).getDate();
      const expense = new Array(days).fill(0);
      const income = new Array(days).fill(0);
      const yoyExpense = new Array(days).fill(0);
      const yoyIncome = new Array(days).fill(0);
      const py = y - 1;
      records.forEach(function (r) {
        const d = new Date(r.time);
        if (d.getFullYear() === y && d.getMonth() === m) {
          const idx = d.getDate() - 1;
          if (r.type === 'income') {
            income[idx] += r.amountCents;
          } else {
            expense[idx] += r.amountCents;
          }
        } else if (d.getFullYear() === py && d.getMonth() === m) {
          const idx = d.getDate() - 1;
          if (r.type === 'income') {
            yoyIncome[idx] += r.amountCents;
          } else {
            yoyExpense[idx] += r.amountCents;
          }
        }
      });
      const labels = [];
      for (let i = 1; i <= days; i++) {
        labels.push(String(i));
      }
      return {
        labels: labels,
        expense: expense,
        income: income,
        yoyExpense: yoyExpense,
        yoyIncome: yoyIncome,
        title: y + '年' + (m + 1) + '月'
      };
    }
    if (dim === 'month') {
      const y = viewDate.getFullYear();
      const expense = new Array(12).fill(0);
      const income = new Array(12).fill(0);
      const yoyExpense = new Array(12).fill(0);
      const yoyIncome = new Array(12).fill(0);
      const py = y - 1;
      records.forEach(function (r) {
        const d = new Date(r.time);
        if (d.getFullYear() === y) {
          const idx = d.getMonth();
          if (r.type === 'income') {
            income[idx] += r.amountCents;
          } else {
            expense[idx] += r.amountCents;
          }
        } else if (d.getFullYear() === py) {
          const idx = d.getMonth();
          if (r.type === 'income') {
            yoyIncome[idx] += r.amountCents;
          } else {
            yoyExpense[idx] += r.amountCents;
          }
        }
      });
      const labels = [];
      for (let i = 1; i <= 12; i++) {
        labels.push(i + '月');
      }
      return {
        labels: labels,
        expense: expense,
        income: income,
        yoyExpense: yoyExpense,
        yoyIncome: yoyIncome,
        title: y + '年'
      };
    }
    const years = [];
    for (let y = yearFrom; y <= yearTo; y++) {
      years.push(y);
    }
    const expense = new Array(years.length).fill(0);
    const income = new Array(years.length).fill(0);
    records.forEach(function (r) {
      const d = new Date(r.time);
      const idx = years.indexOf(d.getFullYear());
      if (idx !== -1) {
        if (r.type === 'income') {
          income[idx] += r.amountCents;
        } else {
          expense[idx] += r.amountCents;
        }
      }
    });
    return {
      labels: years.map(String),
      expense: expense,
      income: income,
      yoyExpense: null,
      yoyIncome: null,
      title: yearFrom + '–' + yearTo + '年'
    };
  }

  function sourceValues(info) {
    if (source === 'income') {
      return info.income.slice();
    }
    if (source === 'net') {
      return info.income.map(function (v, i) {
        return v - info.expense[i];
      });
    }
    return info.expense.slice();
  }

  function growthPcts(values, baseValues) {
    const mom = [];
    const yoy = [];
    for (let i = 0; i < values.length; i++) {
      const prev = i > 0 ? values[i - 1] : null;
      mom.push(prev != null && prev > 0 ? (values[i] - prev) / prev * 100 : null);
      const b = baseValues ? baseValues[i] : null;
      yoy.push(b != null && b > 0 ? (values[i] - b) / b * 100 : null);
    }
    return { mom: mom, yoy: yoy };
  }

  function tooltipFormatter() {
    return function (params) {
      let s = params[0].name;
      params.forEach(function (p) {
        const v = p.value;
        if (v == null) {
          return;
        }
        if (p.seriesType === 'line' && p.yAxisIndex === 1) {
          s += '<br/>' + p.marker + p.seriesName + '：' + pctLabel(v);
        } else {
          s += '<br/>' + p.marker + p.seriesName + '：¥' + fmtMoney(v);
        }
      });
      return s;
    };
  }

  function buildTrendOption(labels, values, mom, yoy) {
    const primary = primaryColor();
    const series = [{
      name: sourceLabel(),
      type: 'bar',
      data: values.map(function (v) {
        return {
          value: v,
          itemStyle: {
            color: primary,
            borderRadius: v >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4]
          }
        };
      }),
      barMaxWidth: 24
    }];
    if (momOn) {
      series.push({
        name: '环比',
        type: 'line',
        yAxisIndex: 1,
        data: mom,
        smooth: true,
        symbolSize: 4,
        connectNulls: false,
        lineStyle: { width: 1.5, color: '#E88BAD' },
        itemStyle: { color: '#E88BAD' }
      });
    }
    if (yoyOn) {
      series.push({
        name: '同比',
        type: 'line',
        yAxisIndex: 1,
        data: yoy,
        smooth: true,
        symbolSize: 4,
        connectNulls: false,
        lineStyle: { width: 1.5, color: '#9B8AE0' },
        itemStyle: { color: '#9B8AE0' }
      });
    }
    return {
      tooltip: { trigger: 'axis', formatter: tooltipFormatter() },
      legend: {
        show: momOn || yoyOn,
        top: 0,
        right: 8,
        itemWidth: 14,
        itemHeight: 8,
        textStyle: { fontSize: 10 }
      },
      grid: {
        left: 8,
        right: 8,
        top: momOn || yoyOn ? 30 : 20,
        bottom: 0,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { fontSize: 9, color: '#999999' },
        axisLine: { lineStyle: { color: '#DDDDDD' } }
      },
      yAxis: [
        {
          type: 'value',
          axisLabel: {
            fontSize: 9,
            color: '#999999',
            formatter: function (v) {
              const yuan = v / 100;
              if (yuan % 1 === 0) {
                return '¥' + yuan;
              }
              const s = yuan.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
              return '¥' + s;
            }
          },
          splitLine: { lineStyle: { color: 'rgba(0,0,0,0.06)' } }
        },
        {
          type: 'value',
          scale: true,
          axisLabel: { fontSize: 9, color: '#999999', formatter: '{value}%' },
          splitLine: { show: false }
        }
      ],
      series: series
    };
  }

  function buildPieOption(data) {
    return {
      tooltip: {
        trigger: 'item',
        formatter: function (p) {
          return p.name + '<br/>¥' + fmtMoney(p.value) + '（' + p.percent + '%）';
        }
      },
      legend: { type: 'scroll', bottom: 0, fontSize: 10 },
      color: PIE_COLORS,
      series: [{
        name: '占比',
        type: 'pie',
        radius: ['32%', '62%'],
        center: ['50%', '43%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 4, borderColor: '#FFFFFF', borderWidth: 1 },
        label: { fontSize: 10 },
        data: data
      }]
    };
  }

  function renderSummary(exp, inc) {
    const net = inc - exp;
    document.getElementById('chartExpense').textContent = '¥' + fmtMoney(exp);
    document.getElementById('chartIncome').textContent = '¥' + fmtMoney(inc);
    const netEl = document.getElementById('chartNet');
    netEl.textContent = (net >= 0 ? '¥' : '-¥') + fmtMoney(Math.abs(net));
    netEl.className = 'bills-summary-value ' + (net >= 0 ? 'inc' : 'exp');
  }

  function activeSummary() {
    if (chartView === 'pie') {
      let exp = 0;
      let inc = 0;
      records.forEach(function (r) {
        if (!pieMatches(r)) {
          return;
        }
        if (r.type === 'income') {
          inc += r.amountCents;
        } else {
          exp += r.amountCents;
        }
      });
      return { expense: exp, income: inc };
    }
    const info = periodInfo();
    return {
      expense: info.expense.reduce(function (a, b) {
        return a + b;
      }, 0),
      income: info.income.reduce(function (a, b) {
        return a + b;
      }, 0)
    };
  }

  function pieMatches(r) {
    const d = new Date(r.time);
    if (dim === 'day') {
      return d.getFullYear() === pieDate.getFullYear() &&
        d.getMonth() === pieDate.getMonth() &&
        d.getDate() === pieDate.getDate();
    }
    if (dim === 'month') {
      return d.getFullYear() === pieDate.getFullYear() &&
        d.getMonth() === pieDate.getMonth();
    }
    return d.getFullYear() === pieDate.getFullYear();
  }

  function pieTitle() {
    if (dim === 'day') {
      return pieDate.getFullYear() + '年' + (pieDate.getMonth() + 1) + '月' + pieDate.getDate() + '日';
    }
    if (dim === 'month') {
      return pieDate.getFullYear() + '年' + (pieDate.getMonth() + 1) + '月';
    }
    return pieDate.getFullYear() + '年';
  }

  function activeTitle() {
    return chartView === 'pie' ? pieTitle() : periodInfo().title;
  }

  function activeIsCurrent() {
    const now = new Date();
    if (chartView === 'pie') {
      if (dim === 'day') {
        return pieDate.getFullYear() === now.getFullYear() &&
          pieDate.getMonth() === now.getMonth() &&
          pieDate.getDate() === now.getDate();
      }
      if (dim === 'month') {
        return pieDate.getFullYear() === now.getFullYear() &&
          pieDate.getMonth() === now.getMonth();
      }
      return pieDate.getFullYear() === now.getFullYear();
    }
    return isCurrentPeriod();
  }

  function renderTrendChart() {
    const box = document.getElementById('chartTrend');
    const info = periodInfo();
    if (!info.expense.some(Boolean) && !info.income.some(Boolean)) {
      if (trendChart) {
        trendChart.dispose();
        trendChart = null;
      }
      box.innerHTML = '<p class="chart-empty">该时期暂无数据</p>';
      return;
    }
    const values = sourceValues(info);
    let yoyBase = null;
    if (dim !== 'year') {
      yoyBase = source === 'income'
        ? info.yoyIncome
        : source === 'net'
          ? info.yoyIncome.map(function (v, i) {
            return v - info.yoyExpense[i];
          })
          : info.yoyExpense;
    }
    const growth = growthPcts(values, yoyBase);
    trendChart.setOption(buildTrendOption(info.labels, values, growth.mom, growth.yoy), true);
  }

  function renderPieChart() {
    const box = document.getElementById('chartPie');
    const map = {};
    records.forEach(function (r) {
      if (!pieMatches(r)) {
        return;
      }
      const isIncome = r.type === 'income';
      if (pieSource === 'income' && !isIncome) {
        return;
      }
      if (pieSource === 'expense' && isIncome) {
        return;
      }
      let name;
      if (pieMode === 'category') {
        if (isIncome) {
          const cat = categoryById(r.categoryId);
          name = cat ? cat.name : '其他';
        } else {
          name = r.type === 'transfer' ? '转账' : (categoryById(r.categoryId) ? categoryById(r.categoryId).name : '其他');
        }
      } else if (isIncome) {
        name = r.methodName || methodNameById(r.methodId) || '其他';
      } else {
        name = r.type === 'transfer'
          ? (r.fromMethodName || methodNameById(r.fromMethodId) || '转账')
          : (r.methodName || methodNameById(r.methodId) || '其他');
      }
      map[name] = (map[name] || 0) + r.amountCents;
    });
    const data = Object.keys(map).map(function (k) {
      return { name: k, value: map[k] };
    }).sort(function (a, b) {
      return b.value - a.value;
    });
    if (!data.length) {
      if (pieChart) {
        pieChart.dispose();
        pieChart = null;
      }
      box.innerHTML = '<p class="chart-empty">该时期暂无数据</p>';
      return;
    }
    pieChart.setOption(buildPieOption(data), true);
  }

  function renderActiveChart() {
    const isTrend = chartView === 'trend';
    const box = isTrend
      ? document.getElementById('chartTrend')
      : document.getElementById('chartPie');
    if (!box) {
      return;
    }
    requestAnimationFrame(function () {
      if (isTrend) {
        if (!trendChart) {
          trendChart = echarts.init(box);
        } else {
          trendChart.resize();
        }
        renderTrendChart();
      } else {
        if (!pieChart) {
          pieChart = echarts.init(box);
        } else {
          pieChart.resize();
        }
        renderPieChart();
      }
    });
  }

  function updateChrome() {
    const title = document.getElementById('chartTitle');
    if (title) {
      title.textContent = activeTitle();
    }
    const today = document.getElementById('chartToday');
    if (today) {
      today.style.display = activeIsCurrent() ? 'none' : '';
    }
    const yoyWrap = document.getElementById('chartYoyWrap');
    if (yoyWrap) {
      yoyWrap.style.display = dim === 'year' ? 'none' : '';
    }
  }

  function isCurrentPeriod() {
    const now = new Date();
    if (dim === 'day') {
      return now.getFullYear() === viewDate.getFullYear() &&
        now.getMonth() === viewDate.getMonth();
    }
    if (dim === 'month') {
      return now.getFullYear() === viewDate.getFullYear();
    }
    const y = now.getFullYear();
    return y >= yearFrom && y <= yearTo;
  }

  function renderAll() {
    updateChrome();
    const sum = activeSummary();
    renderSummary(sum.expense, sum.income);
    renderActiveChart();
    saveState();
  }

  function navActive(dir) {
    if (chartView === 'pie') {
      if (dim === 'day') {
        pieDate = new Date(pieDate.getFullYear(), pieDate.getMonth(), pieDate.getDate() + dir);
      } else if (dim === 'month') {
        pieDate = new Date(pieDate.getFullYear(), pieDate.getMonth() + dir, 1);
      } else {
        pieDate = new Date(pieDate.getFullYear() + dir, 0, 1);
      }
      return;
    }
    if (dim === 'day') {
      viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + dir, 1);
    } else if (dim === 'month') {
      viewDate = new Date(viewDate.getFullYear() + dir, 0, 1);
    } else {
      const len = yearTo - yearFrom + 1;
      yearFrom += dir * len;
      yearTo += dir * len;
    }
  }

  function buildPage(container) {
    container.innerHTML =
      '<div class="card">' +
        '<div class="charts-dim-row">' +
          '<div class="charts-tabs">' +
            '<button class="charts-tab' + (dim === 'day' ? ' active' : '') + '" data-dim="day" type="button">日</button>' +
            '<button class="charts-tab' + (dim === 'month' ? ' active' : '') + '" data-dim="month" type="button">月</button>' +
            '<button class="charts-tab' + (dim === 'year' ? ' active' : '') + '" data-dim="year" type="button">年</button>' +
          '</div>' +
          '<div class="charts-nav">' +
            '<button class="charts-nav-btn" id="chartPrev" type="button">‹</button>' +
            '<button class="charts-title-btn" id="chartTitle" type="button"></button>' +
            '<button class="charts-nav-btn" id="chartNext" type="button">›</button>' +
            '<button class="bills-today-btn" id="chartToday" type="button" style="display:none;">回当前</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="bills-summary-row">' +
          '<div><span class="bills-summary-label">支出</span>' +
            '<span class="bills-summary-value exp" id="chartExpense"></span></div>' +
          '<div><span class="bills-summary-label">收入</span>' +
            '<span class="bills-summary-value inc" id="chartIncome"></span></div>' +
          '<div><span class="bills-summary-label">净收支</span>' +
            '<span class="bills-summary-value" id="chartNet"></span></div>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="charts-card-head">' +
          '<div class="charts-switch">' +
            '<button class="charts-switch-btn' + (chartView === 'trend' ? ' active' : '') + '" data-view="trend" type="button">趋势</button>' +
            '<button class="charts-switch-btn' + (chartView === 'pie' ? ' active' : '') + '" data-view="pie" type="button">占比</button>' +
          '</div>' +
          '<div class="charts-options" id="trendOptions"' + (chartView === 'trend' ? '' : ' hidden') + '>' +
            '<span class="charts-src">' +
              '<button class="charts-src-btn' + (source === 'expense' ? ' active' : '') + '" data-src="expense" type="button">支出</button>' +
              '<button class="charts-src-btn' + (source === 'income' ? ' active' : '') + '" data-src="income" type="button">收入</button>' +
              '<button class="charts-src-btn' + (source === 'net' ? ' active' : '') + '" data-src="net" type="button">净收支</button>' +
            '</span>' +
            '<label class="charts-check"><input type="checkbox" id="chartMom"' + (momOn ? ' checked' : '') + '> 环比</label>' +
            '<label class="charts-check" id="chartYoyWrap"><input type="checkbox" id="chartYoy"' + (yoyOn ? ' checked' : '') + '> 同比</label>' +
          '</div>' +
          '<div class="charts-options" id="pieOptions"' + (chartView === 'pie' ? '' : ' hidden') + '>' +
            '<span class="charts-src">' +
              '<button class="charts-src-btn' + (pieSource === 'expense' ? ' active' : '') + '" data-piesrc="expense" type="button">支出</button>' +
              '<button class="charts-src-btn' + (pieSource === 'income' ? ' active' : '') + '" data-piesrc="income" type="button">收入</button>' +
            '</span>' +
            '<span class="charts-src">' +
              '<button class="charts-src-btn' + (pieMode === 'category' ? ' active' : '') + '" data-pie="category" type="button">用途占比</button>' +
              '<button class="charts-src-btn' + (pieMode === 'method' ? ' active' : '') + '" data-pie="method" type="button">方式占比</button>' +
            '</span>' +
          '</div>' +
        '</div>' +
        '<div class="chart-box" id="chartTrend"' + (chartView === 'trend' ? '' : ' hidden') + '></div>' +
        '<div class="chart-box" id="chartPie"' + (chartView === 'pie' ? '' : ' hidden') + '></div>' +
      '</div>' +

      '<div class="modal-mask" id="chartPickerMask" hidden>' +
        '<div class="modal-card">' +
          '<div class="modal-head">' +
            '<h2 class="card-title" id="chartPickerTitle">选择月份</h2>' +
            '<button class="manage-close" id="chartPickerClose" type="button">✕</button>' +
          '</div>' +
          '<div class="bills-month-nav" id="cpYearNav">' +
            '<button class="bills-month-btn" id="cpPrevYear" type="button">‹</button>' +
            '<span class="bills-month-title" id="cpYearLabel"></span>' +
            '<button class="bills-month-btn" id="cpNextYear" type="button">›</button>' +
          '</div>' +
          '<div class="mp-grid" id="cpGrid"></div>' +
          '<div id="cpRange" hidden>' +
            '<div class="cp-range-row">' +
              '<span class="cp-range-label">开始年份</span>' +
              '<div class="cp-range-ctrl">' +
                '<button class="bills-month-btn" id="cpFromPrev" type="button">‹</button>' +
                '<span class="cp-range-value" id="cpFromLabel"></span>' +
                '<button class="bills-month-btn" id="cpFromNext" type="button">›</button>' +
              '</div>' +
            '</div>' +
            '<div class="cp-range-row">' +
              '<span class="cp-range-label">结束年份</span>' +
              '<div class="cp-range-ctrl">' +
                '<button class="bills-month-btn" id="cpToPrev" type="button">‹</button>' +
                '<span class="cp-range-value" id="cpToLabel"></span>' +
                '<button class="bills-month-btn" id="cpToNext" type="button">›</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="tag-add-actions modal-actions">' +
            '<button class="chip" id="cpOk" type="button">确定</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    updateChrome();

    container.querySelectorAll('.charts-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        dim = btn.dataset.dim;
        container.querySelectorAll('.charts-tab').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        renderAll();
      });
    });

    document.getElementById('chartPrev').addEventListener('click', function () {
      navActive(-1);
      renderAll();
    });
    document.getElementById('chartNext').addEventListener('click', function () {
      navActive(1);
      renderAll();
    });
    document.getElementById('chartToday').addEventListener('click', function () {
      if (chartView === 'pie') {
        pieDate = new Date();
      } else if (dim === 'year') {
        const now = new Date().getFullYear();
        yearFrom = now - 2;
        yearTo = now + 2;
      } else {
        viewDate = new Date();
      }
      renderAll();
    });
    document.getElementById('chartTitle').addEventListener('click', openPicker);

    container.querySelectorAll('.charts-switch-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        chartView = btn.dataset.view;
        container.querySelectorAll('.charts-switch-btn').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        document.getElementById('trendOptions').hidden = chartView !== 'trend';
        document.getElementById('pieOptions').hidden = chartView !== 'pie';
        document.getElementById('chartTrend').hidden = chartView !== 'trend';
        document.getElementById('chartPie').hidden = chartView !== 'pie';
        renderAll();
      });
    });

    container.querySelectorAll('.charts-src-btn[data-src]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        source = btn.dataset.src;
        container.querySelectorAll('.charts-src-btn[data-src]').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        renderAll();
      });
    });

    container.querySelectorAll('.charts-src-btn[data-pie]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        pieMode = btn.dataset.pie;
        container.querySelectorAll('.charts-src-btn[data-pie]').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        renderAll();
      });
    });

    container.querySelectorAll('.charts-src-btn[data-piesrc]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        pieSource = btn.dataset.piesrc;
        container.querySelectorAll('.charts-src-btn[data-piesrc]').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        renderAll();
      });
    });

    document.getElementById('chartMom').addEventListener('change', function () {
      momOn = this.checked;
      renderAll();
    });
    document.getElementById('chartYoy').addEventListener('change', function () {
      yoyOn = this.checked;
      renderAll();
    });

    document.getElementById('chartPickerClose').addEventListener('click', function () {
      document.getElementById('chartPickerMask').hidden = true;
    });
    document.getElementById('cpPrevYear').addEventListener('click', function () {
      cpYear--;
      renderPicker();
    });
    document.getElementById('cpNextYear').addEventListener('click', function () {
      cpYear++;
      renderPicker();
    });
    document.getElementById('cpFromPrev').addEventListener('click', function () {
      cpFrom--;
      if (cpFrom > cpTo) {
        cpTo = cpFrom;
      }
      renderPicker();
    });
    document.getElementById('cpFromNext').addEventListener('click', function () {
      cpFrom++;
      if (cpFrom > cpTo) {
        cpTo = cpFrom;
      }
      renderPicker();
    });
    document.getElementById('cpToPrev').addEventListener('click', function () {
      cpTo--;
      if (cpTo < cpFrom) {
        cpFrom = cpTo;
      }
      renderPicker();
    });
    document.getElementById('cpToNext').addEventListener('click', function () {
      cpTo++;
      if (cpTo < cpFrom) {
        cpFrom = cpTo;
      }
      renderPicker();
    });
    document.getElementById('cpOk').addEventListener('click', function () {
      if (chartView === 'pie') {
        if (dim === 'month') {
          pieDate = new Date(cpYear, cpMonth - 1, 1);
        } else {
          pieDate = new Date(cpYear, 0, 1);
        }
      } else if (dim === 'day') {
        viewDate = new Date(cpYear, cpMonth - 1, 1);
      } else if (dim === 'month') {
        viewDate = new Date(cpYear, 0, 1);
      } else {
        yearFrom = cpFrom;
        yearTo = cpTo;
      }
      document.getElementById('chartPickerMask').hidden = true;
      renderAll();
    });

    renderAll();
  }

  function openDatePicker() {
    const input = document.createElement('input');
    input.type = 'date';
    input.style.position = 'fixed';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    input.style.width = '1px';
    input.style.height = '1px';
    input.style.zIndex = '9999';
    const titleBtn = document.getElementById('chartTitle');
    if (titleBtn) {
      const rect = titleBtn.getBoundingClientRect();
      input.style.left = Math.max(0, rect.left) + 'px';
      input.style.top = Math.max(0, rect.bottom + 4) + 'px';
    }
    input.value = pieDate.getFullYear() + '-' + pad(pieDate.getMonth() + 1) + '-' + pad(pieDate.getDate());
    input.addEventListener('change', function () {
      if (this.value) {
        const p = this.value.split('-');
        pieDate = new Date(+p[0], +p[1] - 1, +p[2]);
        renderAll();
      }
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
    });
    document.body.appendChild(input);
    try {
      input.showPicker();
    } catch (e) {
      input.click();
    }
  }

  function openPicker() {
    if (chartView === 'pie' && dim === 'day') {
      openDatePicker();
      return;
    }
    if (chartView === 'pie') {
      if (dim === 'month') {
        cpYear = pieDate.getFullYear();
        cpMonth = pieDate.getMonth() + 1;
        document.getElementById('chartPickerTitle').textContent = '选择月份';
        document.getElementById('cpYearNav').style.display = '';
        document.getElementById('cpRange').hidden = true;
        document.getElementById('cpGrid').style.display = '';
      } else {
        cpYear = pieDate.getFullYear();
        document.getElementById('chartPickerTitle').textContent = '选择年份';
        document.getElementById('cpYearNav').style.display = '';
        document.getElementById('cpRange').hidden = true;
        document.getElementById('cpGrid').style.display = 'none';
      }
      document.getElementById('chartPickerMask').hidden = false;
      renderPicker();
      return;
    }
    if (dim === 'day') {
      cpYear = viewDate.getFullYear();
      cpMonth = viewDate.getMonth() + 1;
      document.getElementById('chartPickerTitle').textContent = '选择月份';
      document.getElementById('cpYearNav').style.display = '';
      document.getElementById('cpRange').hidden = true;
      document.getElementById('cpGrid').style.display = '';
      document.getElementById('chartPickerMask').hidden = false;
      renderPicker();
    } else if (dim === 'month') {
      cpYear = viewDate.getFullYear();
      document.getElementById('chartPickerTitle').textContent = '选择年份';
      document.getElementById('cpYearNav').style.display = '';
      document.getElementById('cpRange').hidden = true;
      document.getElementById('cpGrid').style.display = 'none';
      document.getElementById('chartPickerMask').hidden = false;
      renderPicker();
    } else {
      cpFrom = yearFrom;
      cpTo = yearTo;
      document.getElementById('chartPickerTitle').textContent = '选择年份范围';
      document.getElementById('cpYearNav').style.display = 'none';
      document.getElementById('cpRange').hidden = false;
      document.getElementById('cpGrid').style.display = 'none';
      document.getElementById('chartPickerMask').hidden = false;
      renderPicker();
    }
  }

  function renderPicker() {
    document.getElementById('cpYearLabel').textContent = cpYear + '年';
    document.getElementById('cpFromLabel').textContent = cpFrom + '年';
    document.getElementById('cpToLabel').textContent = cpTo + '年';
    const grid = document.getElementById('cpGrid');
    const isMonthGrid = (chartView === 'pie' && dim === 'month') ||
      (chartView !== 'pie' && dim === 'day');
    if (!isMonthGrid) {
      return;
    }
    const activeYear = chartView === 'pie' ? pieDate.getFullYear() : viewDate.getFullYear();
    const activeMonth = chartView === 'pie' ? pieDate.getMonth() + 1 : viewDate.getMonth() + 1;
    grid.innerHTML = '';
    for (let m = 1; m <= 12; m++) {
      const btn = document.createElement('button');
      btn.className = 'mp-month' + (cpYear === activeYear && m === activeMonth
        ? ' active'
        : '');
      btn.type = 'button';
      btn.textContent = m + '月';
      btn.addEventListener('click', function () {
        cpMonth = m;
        grid.querySelectorAll('.mp-month').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
      });
      grid.appendChild(btn);
    }
  }

  function render(container) {
    Promise.all([
      DB.getAll(DB.stores.records),
      DB.getAll(DB.stores.categories),
      DB.getAll(DB.stores.paymentMethods)
    ]).then(async function (results) {
      records = results[0];
      categories = results[1];
      methods = results[2];
      await ensureEcharts();
      if (trendChart) {
        trendChart.dispose();
        trendChart = null;
      }
      if (pieChart) {
        pieChart.dispose();
        pieChart = null;
      }
      buildPage(container);
    }).catch(function (err) {
      container.innerHTML = '<div class="card"><p class="hint">数据加载失败：' +
        err.message + '</p></div>';
    });
  }

  function ensureEcharts() {
    return new Promise(function (resolve, reject) {
      if (window.echarts) {
        resolve(window.echarts);
        return;
      }
      const script = document.createElement('script');
      script.src = 'vendor/echarts.min.js?v=51';
      script.onload = function () {
        resolve(window.echarts);
      };
      script.onerror = function () {
        reject(new Error('图表库加载失败'));
      };
      document.head.appendChild(script);
    });
  }

  window.addEventListener('resize', function () {
    if (trendChart) {
      trendChart.resize();
    }
    if (pieChart) {
      pieChart.resize();
    }
  });

  window.RenderChartsPage = render;
})();
