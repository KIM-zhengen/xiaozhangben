/* ============================================
   db.js · 数据层（IndexedDB 封装）
   数据模型见 docs/02-技术方案.md
   ============================================ */
(function () {
  'use strict';

  const DB_NAME = 'jizhang';
  const DB_VERSION = 3;

  const STORE_RECORDS = 'records';
  const STORE_CATEGORIES = 'categories';
  const STORE_METHODS = 'paymentMethods';
  const STORE_SUB_METHODS = 'subMethods';
  const STORE_TEMPLATES = 'templates';
  const STORE_SETTINGS = 'settings';
  const STORE_TAGS = 'tags';
  const STORE_BANKS = 'banks';

  const DEFAULT_CATEGORIES = [
    { id: 'cat_food', name: '餐饮', icon: '🍜', type: 'expense' },
    { id: 'cat_transport', name: '交通', icon: '🚌', type: 'expense' },
    { id: 'cat_shopping', name: '购物', icon: '🛍️', type: 'expense' },
    { id: 'cat_entertainment', name: '娱乐', icon: '🎮', type: 'expense' },
    { id: 'cat_home', name: '居住', icon: '🏠', type: 'expense' },
    { id: 'cat_medical', name: '医疗', icon: '💊', type: 'expense' },
    { id: 'cat_education', name: '教育', icon: '📚', type: 'expense' },
    { id: 'cat_gift', name: '人情', icon: '🎁', type: 'expense' },
    { id: 'cat_other', name: '其他', icon: '📦', type: 'expense' }
  ];

  const INCOME_CATEGORIES = [
    { id: 'cat_salary', name: '工资', icon: '💼', type: 'income' },
    { id: 'cat_redpacket', name: '红包', icon: '🧧', type: 'income' },
    { id: 'cat_refund', name: '退款', icon: '↩️', type: 'income' },
    { id: 'cat_investment', name: '理财收益', icon: '📈', type: 'income' },
    { id: 'cat_income_other', name: '其他收入', icon: '💰', type: 'income' }
  ];

  const DEFAULT_METHODS = [
    { id: 'pm_alipay', name: '支付宝', builtin: true, sortOrder: 1, canExpense: true, canIncome: true, canTransferFrom: true, canTransferTo: true },
    { id: 'pm_wechat', name: '微信', builtin: true, sortOrder: 2, canExpense: true, canIncome: true, canTransferFrom: true, canTransferTo: true },
    { id: 'pm_bankcard', name: '银行卡', builtin: true, sortOrder: 3, canExpense: true, canIncome: true, canTransferFrom: true, canTransferTo: true, bankMode: true }
  ];

  const DEFAULT_SUB_METHODS = [
    { id: 'sm_alipay_balance', methodId: 'pm_alipay', name: '余额', bankName: '', builtin: true },
    { id: 'sm_alipay_bank', methodId: 'pm_alipay', name: '银行卡', bankName: '', builtin: true },
    { id: 'sm_wechat_balance', methodId: 'pm_wechat', name: '余额', bankName: '', builtin: true },
    { id: 'sm_wechat_bank', methodId: 'pm_wechat', name: '银行卡', bankName: '', builtin: true }
  ];

  const DEFAULT_BANKS = [
    { id: 'bank_cmb', name: '招商银行', sortOrder: 1 },
    { id: 'bank_icbc', name: '工商银行', sortOrder: 2 },
    { id: 'bank_ccb', name: '建设银行', sortOrder: 3 },
    { id: 'bank_abc', name: '农业银行', sortOrder: 4 },
    { id: 'bank_boc', name: '中国银行', sortOrder: 5 },
    { id: 'bank_comm', name: '交通银行', sortOrder: 6 }
  ];

  let db = null;

  function openDB() {
    return new Promise(function (resolve, reject) {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function (event) {
        const database = event.target.result;
        if (!database.objectStoreNames.contains(STORE_RECORDS)) {
          database.createObjectStore(STORE_RECORDS, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(STORE_CATEGORIES)) {
          database.createObjectStore(STORE_CATEGORIES, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(STORE_METHODS)) {
          database.createObjectStore(STORE_METHODS, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(STORE_SUB_METHODS)) {
          database.createObjectStore(STORE_SUB_METHODS, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(STORE_TEMPLATES)) {
          database.createObjectStore(STORE_TEMPLATES, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(STORE_SETTINGS)) {
          database.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }
        if (!database.objectStoreNames.contains(STORE_TAGS)) {
          database.createObjectStore(STORE_TAGS, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(STORE_BANKS)) {
          database.createObjectStore(STORE_BANKS, { keyPath: 'id' });
        }
      };

      request.onsuccess = function () {
        db = request.result;
        seedIfNeeded().then(migrateData).then(resolve, reject);
      };

      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  function tx(storeName, mode) {
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function getAll(storeName) {
    return new Promise(function (resolve, reject) {
      const request = tx(storeName, 'readonly').getAll();
      request.onsuccess = function () { resolve(request.result || []); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function get(storeName, key) {
    return new Promise(function (resolve, reject) {
      const request = tx(storeName, 'readonly').get(key);
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function put(storeName, value) {
    return new Promise(function (resolve, reject) {
      const request = tx(storeName, 'readwrite').put(value);
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function putMany(storeName, values) {
    return new Promise(function (resolve, reject) {
      const store = tx(storeName, 'readwrite');
      values.forEach(function (value) {
        store.put(value);
      });
      store.transaction.oncomplete = function () { resolve(); };
      store.transaction.onerror = function () { reject(store.transaction.error); };
    });
  }

  function remove(storeName, key) {
    return new Promise(function (resolve, reject) {
      const request = tx(storeName, 'readwrite').delete(key);
      request.onsuccess = function () { resolve(); };
      request.onerror = function () { reject(request.error); };
    });
  }

  async function seedIfNeeded() {
    const seedVersionSetting = await get(STORE_SETTINGS, 'seedVersion');
    const seedVersion = seedVersionSetting ? seedVersionSetting.value : 0;

    if (seedVersion < 1) {
      await putMany(STORE_CATEGORIES, DEFAULT_CATEGORIES);
      await putMany(STORE_METHODS, DEFAULT_METHODS);
      await putMany(STORE_SUB_METHODS, DEFAULT_SUB_METHODS);
      await putMany(STORE_SETTINGS, [
        { key: 'seeded', value: true },
        { key: 'seedVersion', value: 1 },
        { key: 'theme', value: 'blue' },
        { key: 'dailyBudget', value: null }
      ]);
    }
    if (seedVersion < 2) {
      await putMany(STORE_CATEGORIES, INCOME_CATEGORIES);
      await put(STORE_SETTINGS, { key: 'seedVersion', value: 2 });
    }
    if (seedVersion < 3) {
      await putMany(STORE_BANKS, DEFAULT_BANKS);
      await put(STORE_SETTINGS, { key: 'seedVersion', value: 3 });
    }
  }

  async function migrateData() {
    const methodList = await getAll(STORE_METHODS);
    const sortedMethods = methodList.slice().sort(function (a, b) {
      if (a.builtin !== b.builtin) {
        return a.builtin ? -1 : 1;
      }
      return (a.name || '').localeCompare(b.name || '');
    });
    let builtinSort = 1;
    let customSort = 100;
    const methodNameFixes = {
      pm_alipay: '支付宝',
      pm_wechat: '微信'
    };
    const methodUpdates = sortedMethods.map(function (m) {
      const updated = Object.assign({}, m);
      if (typeof updated.sortOrder !== 'number') {
        updated.sortOrder = updated.builtin ? builtinSort++ : customSort++;
      }
      if (updated.canExpense === undefined) updated.canExpense = true;
      if (updated.canIncome === undefined) updated.canIncome = true;
      if (updated.canTransferFrom === undefined) updated.canTransferFrom = true;
      if (updated.canTransferTo === undefined) updated.canTransferTo = true;
      if (methodNameFixes[updated.id]) {
        updated.name = methodNameFixes[updated.id];
      }
      return updated;
    });
    if (methodUpdates.length) {
      await putMany(STORE_METHODS, methodUpdates);
    }
    const hasBankcard = methodList.some(function (m) {
      return m.id === 'pm_bankcard';
    });
    if (!hasBankcard) {
      await put(STORE_METHODS, {
        id: 'pm_bankcard',
        name: '银行卡',
        builtin: true,
        sortOrder: 3,
        canExpense: true,
        canIncome: true,
        canTransferFrom: true,
        canTransferTo: true,
        bankMode: true
      });
    }

    const bankList = await getAll(STORE_BANKS);
    const sortedBanks = bankList.slice().sort(function (a, b) {
      return (a.name || '').localeCompare(b.name || '');
    });
    let bankSort = 1;
    const bankUpdates = sortedBanks.map(function (b) {
      const updated = Object.assign({}, b);
      if (typeof updated.sortOrder !== 'number') {
        updated.sortOrder = bankSort++;
      }
      return updated;
    });
    if (bankUpdates.length) {
      await putMany(STORE_BANKS, bankUpdates);
    }

    const subMethodList = await getAll(STORE_SUB_METHODS);
    const subRenames = {
      sm_alipay_balance: '余额',
      sm_alipay_bank: '银行卡',
      sm_wechat_balance: '余额',
      sm_wechat_bank: '银行卡'
    };
    const subUpdates = subMethodList.map(function (s) {
      if (subRenames[s.id]) {
        const updated = Object.assign({}, s, {
          name: subRenames[s.id],
          builtin: true
        });
        if (updated.name !== s.name || updated.builtin !== s.builtin) {
          return updated;
        }
      }
      return null;
    }).filter(Boolean);
    if (subUpdates.length) {
      await putMany(STORE_SUB_METHODS, subUpdates);
    }

    const recordList = await getAll(STORE_RECORDS);
    const recordUpdates = recordList.map(function (r) {
      const updated = Object.assign({}, r);
      let changed = false;
      ['methodName', 'fromMethodName', 'toMethodName'].forEach(function (key) {
        if (updated[key] === '支付宝支付') {
          updated[key] = '支付宝';
          changed = true;
        } else if (updated[key] === '微信支付') {
          updated[key] = '微信';
          changed = true;
        }
      });
      return changed ? updated : null;
    }).filter(Boolean);
    if (recordUpdates.length) {
      await putMany(STORE_RECORDS, recordUpdates);
    }
  }

  window.DB = {
    ready: openDB(),
    getAll: getAll,
    get: get,
    put: put,
    putMany: putMany,
    remove: remove,
    stores: {
      records: STORE_RECORDS,
      categories: STORE_CATEGORIES,
      paymentMethods: STORE_METHODS,
      subMethods: STORE_SUB_METHODS,
      templates: STORE_TEMPLATES,
      settings: STORE_SETTINGS,
      tags: STORE_TAGS,
      banks: STORE_BANKS
    }
  };
})();
