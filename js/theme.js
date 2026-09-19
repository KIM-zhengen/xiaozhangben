/* ============================================
   theme.js · 主题机制（当前默认淡蓝，阶段 3 完善选择界面）
   ============================================ */
(function () {
  'use strict';

  const THEME_COLORS = {
    blue: '#EAF3FB',
    pink: '#FDEAF1',
    white: '#F5F6F8',
    black: '#17191D',
    mint: '#E8F6F0',
    lavender: '#F1EDFB'
  };

  function applyTheme(name) {
    const theme = THEME_COLORS[name] ? name : 'blue';
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.content = THEME_COLORS[theme];
    }
  }

  async function initTheme() {
    const setting = await DB.get(DB.stores.settings, 'theme');
    applyTheme(setting ? setting.value : 'blue');
  }

  window.Theme = {
    applyTheme: applyTheme,
    initTheme: initTheme
  };
})();
