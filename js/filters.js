// src/render/web/js/filters.js
let _allStocks = [];
let _activeFilters = {};

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

function renderFilters() {
  // V1 主要支持 状态/板块/Tier，其余维度作为占位（暂无数据源）
  const selects = [
    {key: 'rating',     label: '全部评级', opts: ['A','B','C','D','F']},
    {key: 'sector',     label: '全部行业', opts: _uniqueValues('sector')},
    {key: 'status',     label: '全部状态', opts: ['buy_zone','hold','watch','reduce','exit']},
    {key: 'buy_zone',   label: '全部买入区', opts: ['在买入区','非买入区']},
    {key: 'market_cap', label: '全部市值', opts: ['大盘','中盘','小盘']},
    {key: 'valuation',  label: '全部估值', opts: ['低估','合理','高估']},
    {key: 'growth',     label: '全部增长', opts: ['高','中','低']},
    {key: 'profit',     label: '全部盈利', opts: ['高','中','低']},
    {key: 'momentum',   label: '全部动量', opts: ['强','中','弱']},
    {key: 'quality',    label: '全部质量', opts: ['高','中','低']},
  ];

  const selectHtml = selects.map(s => `
    <select class="filter-select" data-key="${s.key}">
      <option value="">${s.label}</option>
      ${s.opts.map(o => `<option value="${o}">${o}</option>`).join('')}
    </select>`).join('');

  document.getElementById('filter-row').innerHTML = `
    <input class="filter-search" id="filter-search" placeholder="🔍 代码 / 股票名字 / AI 角色…">
    ${selectHtml}
    <div class="filter-reset" onclick="resetFilters()">重置</div>`;

  document.getElementById('filter-search').addEventListener('input', applyFilters);
  document.querySelectorAll('#filter-row select').forEach(sel => {
    sel.addEventListener('change', e => {
      _activeFilters[sel.dataset.key] = sel.value;
      applyFilters();
    });
  });
}

function applyFilters() {
  const q = (document.getElementById('filter-search').value || '').toLowerCase();
  const filtered = _allStocks.filter(s => {
    if (q && !(s.ticker.toLowerCase().includes(q) ||
               s.name.toLowerCase().includes(q) ||
               (s.ai_role || '').toLowerCase().includes(q))) return false;
    if (_activeFilters.sector && s.sector !== _activeFilters.sector) return false;
    if (_activeFilters.status && s.status !== _activeFilters.status) return false;
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

function renderTable(stocks) {
  const head = `<div class="table-head">
    <div>代码</div><div>名称</div><div>AI 角色</div><div>板块</div>
    <div>Tier</div><div>价格</div><div>涨跌</div><div>Composite</div>
  </div>`;
  const rows = stocks.map(s => `
    <div class="table-row" data-ticker="${s.ticker}">
      <div style="color:#5fb878;font-weight:700">${s.ticker}</div>
      <div>${s.name}</div>
      <div style="color:#888">${(s.ai_role || '').slice(0, 30)}</div>
      <div style="color:#888">${s.sector}</div>
      <div style="color:#5fb878">T${s.tier}</div>
      <div>$${s.price?.toFixed(2) || '-'}</div>
      <div style="color:${s.change_1d >= 0 ? '#5fb878' : '#e54696'}">${s.change_1d >= 0 ? '+' : ''}${s.change_1d || 0}%</div>
      <div style="color:#5fb878;font-weight:700">${s.composite?.toFixed(0) || '-'}</div>
    </div>`).join('');
  document.getElementById('screener-table').innerHTML = head + rows;
  document.querySelectorAll('#screener-table .table-row').forEach(el => {
    el.addEventListener('click', () => loadDetail(el.dataset.ticker));
  });
}
