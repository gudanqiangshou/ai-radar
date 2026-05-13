// src/render/web/js/dashboard.js
async function initDashboard() {
  const data = await fetch('snapshot.json').then(r => r.json());
  window.__snapshot = data;
  renderTopbar(data.topbar);
  renderMovers(data.movers);
  renderCore30(data.core30);
  renderHeatmap(data.sectors);
  renderNewsFeed(data.top_news);
  renderScreener(data.screener);
  document.getElementById('screener-title').textContent = `${data.screener.length} 股票筛选表`;

  // 默认选中 Core 30 第一只
  if (data.core30.length > 0) loadDetail(data.core30[0].ticker);
}

function renderTopbar(t) {
  // 主统计值显示（NULL → "—" 而不是 0.00%）
  const fmtPct = v => (v === null || v === undefined)
    ? { text: '—', cls: 'white' }
    : { text: `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, cls: v >= 0 ? 'pos' : 'neg' };
  const cmp = (ref, label) => (ref === null || ref === undefined)
    ? `<div class="stat-sub">${label} —</div>`
    : `<div class="stat-sub">vs ${label} ${ref >= 0 ? '+' : ''}${ref.toFixed(2)}%</div>`;

  const todayFmt = fmtPct(t.ew_today);
  const ytdFmt = fmtPct(t.ew_ytd);
  document.getElementById('topbar').innerHTML = `
    <div><div class="brand">BeWin Quant<br>AI Stock Radar</div>
      <div class="brand-sub">${escapeHtml(window.__snapshot.date)}</div></div>
    <div class="stat"><div class="stat-val white">${escapeHtml(t.ai_universe)}</div><div class="stat-label">AI Universe</div></div>
    <div class="stat"><div class="stat-val white">${escapeHtml(t.core_30)}</div><div class="stat-label">Core 30</div></div>
    <div class="stat"><div class="stat-val warn">${escapeHtml(t.high_52w)}</div><div class="stat-label">52W High</div></div>
    <div class="stat">
      <div class="stat-val ${todayFmt.cls}">${todayFmt.text}</div>
      <div class="stat-label">今日等权</div>${cmp(t.spx_today, 'SPX')}
    </div>
    <div class="stat">
      <div class="stat-val ${ytdFmt.cls}">${ytdFmt.text}</div>
      <div class="stat-label">等权 YTD</div>${cmp(t.qqq_ytd, 'QQQ')}
    </div>
    <div class="stat"><div class="stat-val"><span class="pos">${escapeHtml(t.up_count ?? '—')}</span> / <span class="neg">${escapeHtml(t.down_count ?? '—')}</span></div><div class="stat-label">上涨 / 下跌</div></div>
    <div class="stat"><div class="stat-val warn">${escapeHtml(t.risk_regime)}</div><div class="stat-label">Risk Regime</div></div>`;
}

function renderMovers(movers) {
  const html = movers.map(m => `
    <div class="mover ${m.type === 'big_up' ? 'up' : 'down'}" data-ticker="${escapeAttr(m.ticker)}">
      <div class="l"><span class="t">${escapeHtml(m.ticker)}</span><span class="desc">${m.type === 'big_up' ? '大涨' : '大跌'}</span></div>
      <span class="chg">${m.change_1d >= 0 ? '+' : ''}${escapeHtml(m.change_1d)}%</span>
    </div>`).join('');
  document.getElementById('movers').innerHTML = html || '<div style="color:#666;padding:20px">无异动股票</div>';
  document.querySelectorAll('#movers .mover').forEach(el => {
    el.addEventListener('click', () => loadDetail(el.dataset.ticker));
  });
}

function renderCore30(stocks) {
  // 应用 localStorage 顺序
  const order = JSON.parse(localStorage.getItem('core30_order_v1') || '[]');
  if (order.length) {
    stocks.sort((a, b) => {
      const ia = order.indexOf(a.ticker), ib = order.indexOf(b.ticker);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }
  const statusLabel = {
    buy_zone: '买入区', hold: '持有', watch: '观察',
    reduce: '减持', exit: '退出',
  };
  const fmtPct = v => (v === null || v === undefined) ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
  const html = stocks.map(s => {
    const chg = s.change_1d || 0;
    const chgCls = chg >= 0 ? 'pos' : 'neg';
    const chgText = `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`;
    const statusText = statusLabel[s.status] || '观察';
    const tierLetter = s.tier_letter || '—';
    const price = s.price !== null && s.price !== undefined
      ? `$${s.price.toFixed(s.price >= 1000 ? 2 : 3)}` : '—';
    return `<div class="stock-card" draggable="true" data-ticker="${escapeAttr(s.ticker)}" data-status="${escapeAttr(s.status || 'watch')}">
      <div class="card-row top">
        <span class="tk">${escapeHtml(s.ticker)}</span>
        <span class="price">${escapeHtml(price)}</span>
      </div>
      <div class="name">${escapeHtml(s.name)}</div>
      <div class="card-row mid">
        <span class="chg ${chgCls}">${chgText}</span>
        <span class="status-tag">${statusText}</span>
      </div>
      <div class="card-row bot">
        <span class="periods">1M ${fmtPct(s.change_1m)} · YTD ${fmtPct(s.change_ytd)}</span>
        <span class="tier-status">${escapeHtml(tierLetter)} · ${statusText}</span>
      </div>
    </div>`;
  }).join('');
  document.getElementById('core30').innerHTML = html;
  document.querySelectorAll('#core30 .stock-card').forEach(el => {
    el.addEventListener('click', () => loadDetail(el.dataset.ticker));
  });
  initCore30Drag();  // 来自 drag.js
}

function renderHeatmap(sectors) {
  const fmtPct = v => (v === null || v === undefined) ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
  const html = sectors.map(s => {
    if (s.placeholder) {
      return `<div class="sector neutral" data-sector="${escapeAttr(s.sector_id)}">
        <div class="sn">${escapeHtml(s.name_zh || s.name)}</div>
        <div class="sc placeholder">占位</div>
        <div class="meta">待 V2 填充</div>
      </div>`;
    }
    const todayCls = (s.change_today || 0) >= 0 ? 'green' : 'red';
    const todayColor = (s.change_today || 0) >= 0 ? '#5fb878' : '#e54696';
    return `<div class="sector ${todayCls}" data-sector="${escapeAttr(s.sector_id)}">
      <div class="sn">${escapeHtml(s.name)}</div>
      <div class="sc" style="color:${todayColor}">${s.change_today >= 0 ? '+' : ''}${(s.change_today || 0).toFixed(2)}%</div>
      <div class="meta">${escapeHtml(s.quotes_count || 0)}/${escapeHtml(s.stock_count)} 报价 · Core ${escapeHtml(s.core_count || 0)}</div>
      <div class="meta">5D ${fmtPct(s.change_5d)} · 1M ${fmtPct(s.change_1m)}</div>
      <div class="meta">3M ${fmtPct(s.change_3m)} · YTD ${fmtPct(s.change_ytd)} · RS #${escapeHtml(s.rs_rank || '-')}</div>
    </div>`;
  }).join('');
  document.getElementById('heatmap').innerHTML = html;
}

function renderNewsFeed(items) {
  // 用 data-ticker + 事件委托代替 inline onclick（避免 ticker 含特殊字符注入）
  document.getElementById('news-feed').innerHTML = items.map(n => `
    <div class="news-item">
      <span class="news-tk news-ticker-click" data-ticker="${escapeAttr(n.ticker)}" style="cursor:pointer">${escapeHtml(n.ticker)}</span>
      <span class="news-title">${safeExternalLink(n.url, n.title)}</span>
      <span class="news-src">${escapeHtml(n.source)} · ${escapeHtml(n.date)}</span>
    </div>`).join('');
  document.querySelectorAll('#news-feed .news-ticker-click').forEach(el => {
    el.addEventListener('click', () => loadDetail(el.dataset.ticker));
  });
}
