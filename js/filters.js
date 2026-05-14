// src/render/web/js/filters.js
let _allStocks = [];
let _activeFilters = {};
let _sortField = null;     // 当前排序字段 (market_cap / change_1d / change_1m ...)
let _sortDir = 'desc';     // 'asc' / 'desc'

function renderScreener(stocks) {
  _allStocks = stocks;
  _activeFilters = {};
  renderFilters();
  renderTable(stocks);
}

function _uniqueValues(field) {
  const set = new Set();
  for (const s of _allStocks) {
    const v = s[field];
    if (v !== null && v !== undefined && v !== '') set.add(v);
  }
  return [...set].sort();
}

// 中文显示标签 ↔ 内部 raw 值映射（applyFilters 用 raw 值比较）
const STATUS_ZH = {
  buy_zone: '买入区', hold: '持有', watch: '观察', reduce: '减持', exit: '退出',
};

function renderFilters() {
  // 行业 dropdown：用 sector_zh_map（首次渲染时 snapshot 注入）把英文 id 转中文
  const sectorIds = _uniqueValues('sector');
  const sectorOpts = sectorIds.map(id => ({
    value: id, label: (window._sectorZh || {})[id] || id,
  }));
  // status dropdown：用中文标签作 option text，raw 值 buy_zone 等做 value
  const statusOpts = Object.entries(STATUS_ZH).map(([v, l]) => ({value: v, label: l}));

  const selects = [
    {key: 'rating',     label: '全部评级',  opts: ['A','B','C','D','F'].map(o => ({value:o, label:o}))},
    {key: 'sector',     label: '全部行业',  opts: sectorOpts},
    {key: 'status',     label: '全部状态',  opts: statusOpts},
    {key: 'buy_zone',   label: '全部买入区', opts: [{value:'in',label:'在买入区'}, {value:'out',label:'非买入区'}]},
    {key: 'market_cap', label: '全部市值',  opts: [{value:'large',label:'大盘 ≥200B'}, {value:'mid',label:'中盘 20-200B'}, {value:'small',label:'小盘 <20B'}]},
    {key: 'valuation',  label: '全部估值',  opts: [{value:'undervalued',label:'低估 ≥70'}, {value:'fair',label:'合理 40-70'}, {value:'overvalued',label:'高估 <40'}]},
    {key: 'growth',     label: '全部增长',  opts: [{value:'high',label:'高 ≥70'}, {value:'mid',label:'中 40-70'}, {value:'low',label:'低 <40'}]},
    {key: 'profit',     label: '全部盈利',  opts: [{value:'high',label:'高 ≥70'}, {value:'mid',label:'中 40-70'}, {value:'low',label:'低 <40'}]},
    {key: 'momentum',   label: '全部动量',  opts: [{value:'strong',label:'强 ≥70'}, {value:'mid',label:'中 40-70'}, {value:'weak',label:'弱 <40'}]},
    {key: 'quality',    label: '全部质量',  opts: [{value:'high',label:'高 ≥70'}, {value:'mid',label:'中 40-70'}, {value:'low',label:'低 <40'}]},
  ];

  const selectHtml = selects.map(s => `
    <select class="filter-select" data-key="${escapeAttr(s.key)}">
      <option value="">${escapeHtml(s.label)}</option>
      ${s.opts.map(o => `<option value="${escapeAttr(o.value)}">${escapeHtml(o.label)}</option>`).join('')}
    </select>`).join('');

  document.getElementById('filter-row').innerHTML = `
    <input class="filter-search" id="filter-search" placeholder="🔍 代码 / 股票名字 / AI 角色…">
    ${selectHtml}
    <div class="filter-reset" id="filter-reset-btn">重置</div>`;

  document.getElementById('filter-search').addEventListener('input', applyFilters);
  document.getElementById('filter-reset-btn').addEventListener('click', resetFilters);
  document.querySelectorAll('#filter-row select').forEach(sel => {
    sel.addEventListener('change', () => {
      _activeFilters[sel.dataset.key] = sel.value;
      applyFilters();
    });
  });
}

// 三档分数过滤辅助：score >=70 高/强/低估，40-70 中/合理，<40 低/弱/高估
const _scoreBand = (v, hi, lo) => {
  if (v === null || v === undefined) return null;
  if (v >= 70) return hi;
  if (v >= 40) return 'mid';
  return lo;
};

function applyFilters() {
  const q = (document.getElementById('filter-search').value || '').toLowerCase();
  const af = _activeFilters;
  const filtered = _allStocks.filter(s => {
    if (q && !(s.ticker.toLowerCase().includes(q) ||
               s.name.toLowerCase().includes(q) ||
               (s.ai_role || '').toLowerCase().includes(q))) return false;
    if (af.sector && s.sector !== af.sector) return false;
    if (af.status && s.status !== af.status) return false;
    if (af.rating && s.rating !== af.rating) return false;
    if (af.buy_zone) {
      const inZone = s.status === 'buy_zone';
      if (af.buy_zone === 'in' && !inZone) return false;
      if (af.buy_zone === 'out' && inZone) return false;
    }
    if (af.market_cap && s.market_cap_bucket !== af.market_cap) return false;
    // valuation 的 "低估" 对应 score >=70（分数越高越便宜）
    if (af.valuation && _scoreBand(s.valuation_score, 'undervalued', 'overvalued') !== af.valuation) return false;
    if (af.growth    && _scoreBand(s.growth_score, 'high', 'low') !== af.growth) return false;
    if (af.profit    && _scoreBand(s.profitability_score, 'high', 'low') !== af.profit) return false;
    if (af.momentum  && _scoreBand(s.momentum_score, 'strong', 'weak') !== af.momentum) return false;
    if (af.quality   && _scoreBand(s.quality_score, 'high', 'low') !== af.quality) return false;
    return true;
  });
  renderTable(filtered);
}

function resetFilters() {
  document.getElementById('filter-search').value = '';
  _activeFilters = {};
  document.querySelectorAll('#filter-row select').forEach(sel => sel.value = '');
  renderTable(_allStocks);
}

// 通用渲染辅助
const _fmtMarketCap = (v) => {
  if (v === null || v === undefined) return '—';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toFixed(0)}`;
};
const _fmtPctCell = (v) => {
  if (v === null || v === undefined) return { text: '—', color: '#888' };
  return {
    text: `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`,
    color: v >= 0 ? '#5fb878' : '#e54696',
  };
};

// 排序辅助：null/undefined 永远沉到尾部，无论升降序
function _sortStocks(stocks) {
  if (!_sortField) return stocks;
  const dir = _sortDir === 'asc' ? 1 : -1;
  return [...stocks].sort((a, b) => {
    const va = a[_sortField], vb = b[_sortField];
    const aNull = va === null || va === undefined;
    const bNull = vb === null || vb === undefined;
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;
    return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
  });
}

function _sortIndicator(field) {
  if (_sortField !== field) return '';
  return _sortDir === 'asc' ? ' ↑' : ' ↓';
}

function _attachSortHandlers() {
  document.querySelectorAll('.table-head .sortable').forEach(el => {
    el.addEventListener('click', () => {
      const field = el.dataset.sort;
      if (_sortField === field) {
        // toggle asc / desc / off
        if (_sortDir === 'desc') { _sortDir = 'asc'; }
        else { _sortField = null; }
      } else {
        _sortField = field;
        _sortDir = 'desc';   // 数值列默认从高到低
      }
      applyFilters();   // re-filter + re-sort + re-render
    });
  });
}

function renderTable(stocks) {
  // 12 列 head + row 严格对齐（src/render/web/css/theme.css .table-head/.table-row）
  // 代码 名称 AI角色 板块 Tier 市值 涨跌(1D) 1M 3M 1Y YTD Composite
  // 6 个数值列可排序：市值 / 涨跌 / 1M / 3M / 1Y / YTD（数值列 click 表头切换 asc/desc/off）
  stocks = _sortStocks(stocks);
  const head = `<div class="table-head">
    <div>代码</div><div>名称</div><div>AI 角色</div><div>板块</div>
    <div>Tier</div>
    <div class="sortable" data-sort="market_cap">市值${_sortIndicator('market_cap')}</div>
    <div class="sortable" data-sort="change_1d">涨跌${_sortIndicator('change_1d')}</div>
    <div class="sortable" data-sort="change_1m">1M${_sortIndicator('change_1m')}</div>
    <div class="sortable" data-sort="change_3m">3M${_sortIndicator('change_3m')}</div>
    <div class="sortable" data-sort="change_1y">1Y${_sortIndicator('change_1y')}</div>
    <div class="sortable" data-sort="change_ytd">YTD${_sortIndicator('change_ytd')}</div>
    <div>Composite</div>
  </div>`;
  const rows = stocks.map(s => {
    const c1d = _fmtPctCell(s.change_1d);
    const c1m = _fmtPctCell(s.change_1m);
    const c3m = _fmtPctCell(s.change_3m);
    const c1y = _fmtPctCell(s.change_1y);
    const cytd = _fmtPctCell(s.change_ytd);
    const mc = _fmtMarketCap(s.market_cap);
    const composite = (s.composite === null || s.composite === undefined)
      ? '—' : s.composite.toFixed(0);
    return `<div class="table-row" data-ticker="${escapeAttr(s.ticker)}">
      <div style="color:#5fb878;font-weight:700">${escapeHtml(s.ticker)}</div>
      <div>${escapeHtml(s.name)}</div>
      <div style="color:#888">${escapeHtml((s.ai_role || '').slice(0, 30))}</div>
      <div style="color:#888">${escapeHtml((window._sectorZh || {})[s.sector] || s.sector)}</div>
      <div style="color:#5fb878">T${escapeHtml(s.tier)}</div>
      <div>${mc}</div>
      <div style="color:${c1d.color}">${c1d.text}</div>
      <div style="color:${c1m.color}">${c1m.text}</div>
      <div style="color:${c3m.color}">${c3m.text}</div>
      <div style="color:${c1y.color}">${c1y.text}</div>
      <div style="color:${cytd.color}">${cytd.text}</div>
      <div style="color:#5fb878;font-weight:700">${composite}</div>
    </div>`;
  }).join('');
  document.getElementById('screener-table').innerHTML = head + rows;
  document.querySelectorAll('#screener-table .table-row').forEach(el => {
    el.addEventListener('click', () => loadDetail(el.dataset.ticker));
  });
  _attachSortHandlers();
}
