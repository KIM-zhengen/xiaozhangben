/* ============================================
   app.js · 应用入口
   ============================================ */
(function () {
  'use strict';

  const RENDERERS = {
    record: window.RenderRecordPage,
    bills: window.RenderBillsPage,
    charts: window.RenderChartsPage,
    mine: window.RenderMinePage
  };

  async function renderCurrent() {
    const renderer = RENDERERS[Router.current];
    const section = document.getElementById('page-' + Router.current);
    if (renderer && section) {
      await renderer(section);
    }
  }

  async function init() {
    try {
      await DB.ready;
      console.log('[小账本] 数据层就绪');
    } catch (err) {
      console.error('[小账本] 数据层初始化失败', err);
    }

    await Theme.initTheme();

    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        Router.navigate(tab.dataset.page);
        renderCurrent();
      });
    });

    const initial = (location.hash || '#record').replace(/^#\/?/, '');
    Router.navigate(initial);
    await renderCurrent();

    window.addEventListener('hashchange', renderCurrent);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function (err) {
        console.warn('[小账本] Service Worker 注册失败', err);
      });
    });
  }
})();
