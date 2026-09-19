/* ============================================
   router.js · 底部三页导航（基于 hash）
   ============================================ */
(function () {
  'use strict';

  const PAGES = ['record', 'bills', 'charts', 'mine'];
  const TITLES = { record: '记账', bills: '账单', charts: '图表', mine: '我的' };

  let currentPage = 'record';

  function fromHash() {
    const hash = location.hash || '#record';
    return hash.replace(/^#\/?/, '');
  }

  function navigate(page) {
    if (PAGES.indexOf(page) === -1) {
      page = 'record';
    }
    currentPage = page;

    PAGES.forEach(function (p) {
      const section = document.getElementById('page-' + p);
      const tab = document.querySelector('.tab[data-page="' + p + '"]');
      if (section) {
        section.hidden = (p !== page);
      }
      if (tab) {
        tab.classList.toggle('active', p === page);
      }
    });

    const title = document.getElementById('pageTitle');
    if (title) {
      title.textContent = TITLES[page] || '记账';
    }

    if (location.hash !== '#' + page) {
      history.replaceState(null, '', '#' + page);
    }
  }

  window.addEventListener('hashchange', function () {
    navigate(fromHash());
  });

  window.Router = {
    navigate: navigate,
    get current() {
      return currentPage;
    }
  };
})();
