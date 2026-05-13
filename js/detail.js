// src/render/web/js/detail.js
async function loadDetail(ticker) {
  const data = await fetch(`stock_detail/${ticker}.json`).then(r => r.json()).catch(() => null);
  if (!data) {
    document.getElementById('detail-panel').innerHTML =
      `<div class="empty">无法加载 ${ticker} 的详情</div>`;
    return;
  }
  const html = renderHeader(data.header || data) +
               data.panels.map(renderPanel).join('');
  document.getElementById('detail-panel').innerHTML = html;
}

function renderHeader(h) {
  const chg = h.change_1d || 0;
  const chgCls = chg >= 0 ? 'pos' : 'neg';
  const chgSign = chg >= 0 ? '+' : '';
  const warn = h.data_warning
    ? `<span class="data-warn-tag">${h.data_warning}</span>` : '';
  const desc = (h.description || []).map(p => `<p>${p}</p>`).join('');
  const meta = [
    h.market,
    h.tier_letter,
    h.status_label,
    h.data_source_text,
  ].filter(Boolean).join(' · ');

  return `<div class="detail-header">
    <div class="dh-label">个股详情</div>
    <div class="dh-sublabel">${h.ticker} · ${h.sector || ''}</div>
    <div class="dh-title-row">
      <div>
        <div class="dh-ticker">${h.ticker}</div>
        <div class="dh-name">${h.name || ''}</div>
      </div>
      <div class="dh-chg ${chgCls}">${chgSign}${chg.toFixed(2)}%</div>
    </div>
    <div class="dh-meta">${meta}</div>
    ${warn}
    <div class="dh-desc">${desc}</div>
  </div>`;
}

function renderPanel(panel) {
  const renderers = {
    metrics_grid:    renderMetricsGrid,
    mixed:           renderMixed,
    score_grid:      renderScoreGrid,
    score_grid_3x3:  renderScoreGrid3x3,
    external:        renderExternal,
    ai_text:         renderAiText,
    news_list:       renderNewsList,
    chart:           renderChart,
  };
  const fn = renderers[panel.type] || (() => '');
  const meta = panel.title_meta ? `<span class="card-title-meta">${panel.title_meta}</span>` : '';
  return `<div class="card">
    <div class="card-title-row">
      <div class="card-title">${panel.title}</div>
      ${meta}
    </div>
    ${fn(panel)}
  </div>`;
}

function _kvCell(label, value, valueClass = '') {
  return `<div class="kv">
    <div class="kv-l">${label}</div>
    <div class="kv-v ${valueClass}">${value === null || value === undefined ? '—' : value}</div>
  </div>`;
}

function _valueClass(value) {
  if (typeof value !== 'string') return '';
  if (value.startsWith('+')) return 'pos';
  if (value.startsWith('-') && value !== '—') return 'neg';
  return '';
}

function renderMetricsGrid(panel) {
  const items = Object.entries(panel.data || {}).map(([k, v]) =>
    _kvCell(k, v, _valueClass(v))
  ).join('');
  return `<div class="card-section"><div class="grid-3">${items}</div></div>`;
}

function renderMixed(panel) {
  const d = panel.data || {};
  if (d.metrics) {
    const aiBlock = d.ai_role
      ? `<div class="card-section" style="margin-bottom:8px"><div class="kv-l">AI 角色</div><div class="ai-role-text">${d.ai_role}</div></div>`
      : '';
    const metricsBlock = `<div class="card-section"><div class="grid-3">${
      Object.entries(d.metrics).map(([k, v]) => _kvCell(k, v, _valueClass(v))).join('')
    }</div></div>`;
    return aiBlock + metricsBlock;
  }
  // 兼容旧 mixed 数据
  return renderMetricsGrid(panel);
}

function renderScoreGrid(panel) {
  // 旧 score_grid 兼容
  const items = Object.entries(panel.data || {}).map(([dim, score]) => {
    const cls = score === null || score === undefined ? 'neg'
              : score >= 70 ? '' : score >= 40 ? 'warn' : 'neg';
    const disp = score === null || score === undefined ? '—' : score.toFixed(0);
    const width = score || 0;
    return `<div class="score-item">
      <div class="sl">${dim}</div>
      <div class="sv">${disp}</div>
      <div class="score-bar ${cls}"><div style="width:${width}%"></div></div>
    </div>`;
  }).join('');
  return `<div class="score-list">${items}</div>`;
}

function renderScoreGrid3x3(panel) {
  const escAttr = s => (s || '').replace(/"/g, '&quot;');
  const cells = (panel.data || []).map(c => {
    const score = c.value;
    const cls = score === null || score === undefined ? 'neg'
              : score >= 70 ? '' : score >= 40 ? 'warn' : 'neg';
    const disp = score === null || score === undefined ? '—' : score.toFixed(0);
    const width = score || 0;

    // tooltip 选择：AI cell 显示 reasoning，量化 cell 显示公式，Composite 显示加权公式
    let tipText = '';
    let badge = '';
    let extraStyle = '';
    if (c.is_ai && c.reasoning) {
      tipText = c.reasoning;
      badge = '<span class="ai-mark">AI</span>';
      extraStyle = ' ai-cell';
    } else if (c.is_quant && c.formula) {
      tipText = c.formula;
      badge = '<span class="formula-mark">公式</span>';
      extraStyle = ' formula-cell';
    } else if (c.is_composite && c.formula) {
      tipText = c.formula;
      badge = '<span class="formula-mark">加权</span>';
      extraStyle = ' composite-cell';
    } else if (c.is_composite) {
      extraStyle = ' composite-cell';
    }

    const tip = tipText ? ` title="${escAttr(tipText)}"` : '';
    return `<div class="score-cell${extraStyle}"${tip}>
      <div class="sl">${c.label}${badge}</div>
      <div class="sv">${disp}</div>
      <div class="score-bar ${cls}"><div style="width:${width}%"></div></div>
    </div>`;
  }).join('');
  return `<div class="score-grid-3x3">${cells}</div>`;
}

function renderExternal(panel) {
  if (!panel.data) {
    return `<div class="card-section">暂无外部分析师覆盖</div>` +
      (panel.disclaimer ? `<div class="external-disclaimer">${panel.disclaimer}</div>` : '');
  }
  const d = panel.data;
  const meanDisp = d.target_mean ? `$${d.target_mean.toFixed(2)}` : '—';
  const upsideClass = (d.upside_pct || 0) >= 0 ? 'pos' : 'neg';
  const upsideText = (d.upside_pct !== null && d.upside_pct !== undefined)
    ? `${d.upside_pct >= 0 ? '+' : ''}${d.upside_pct.toFixed(2)}%` : '—';
  const rangeDisp = (d.target_low && d.target_high)
    ? `$${d.target_low.toFixed(2)} / $${d.target_high.toFixed(2)}` : '—';
  const ratingLetter = d.rating_letter || '—';
  const ratingSub = `${d.rating_change || '维持'} / 前次 ${d.previous_rating_letter || '—'}`;
  const earnDate = d.next_earnings || '—';
  const eps = (d.eps_estimate !== null && d.eps_estimate !== undefined)
    ? `EPS ${d.eps_estimate.toFixed(2)}` : 'EPS —';
  const rev = (d.revenue_estimate !== null && d.revenue_estimate !== undefined)
    ? ` · 营收 $${(d.revenue_estimate/1e9).toFixed(2)}B` : '';
  const estLine = `${earnDate} · ${eps}${rev}`;
  const coverageLine = d.n_analysts ? `${d.n_analysts} 位覆盖` : '—';

  const grid = `<div class="external-grid">
    <div class="external-cell"><div class="label">共识目标价</div><div class="value">${meanDisp}</div><div class="sub ${upsideClass}">${upsideText}</div></div>
    <div class="external-cell"><div class="label">目标区间</div><div class="value">${rangeDisp}</div><div class="sub">低 / 高</div></div>
    <div class="external-cell"><div class="label">外部评级</div><div class="value">${ratingLetter}</div><div class="sub">${ratingSub}</div></div>
    <div class="external-cell"><div class="label">分析师预估</div><div class="value" style="font-size:13px">${estLine}</div><div class="sub">${coverageLine}</div></div>
  </div>`;
  const disc = panel.disclaimer ? `<div class="external-disclaimer">${panel.disclaimer}</div>` : '';
  return grid + disc;
}

function renderAiText(panel) {
  return `<div class="ai-text">${panel.data?.text || '(待 Sonnet 4.6 生成)'}</div>`;
}

function renderNewsList(panel) {
  const items = (panel.data || []).map(n => `
    <div class="news-row">
      <div class="nt"><a href="${n.url}" target="_blank">${n.title}</a></div>
      <div class="nm"><span>${n.source}</span><span>${n.date}</span></div>
    </div>`).join('');
  return `<div class="card-section">${items || '近 7 天无新闻'}</div>`;
}

function renderChart(panel) {
  const data = panel.data || [];
  if (data.length === 0) return '<div class="card-section" style="color:#666;font-size:11px">暂无历史评分（每周一次刷新，需累积数据）</div>';
  const max = Math.max(...data.map(d => d.value || 0));
  const bars = data.map((d, i) => {
    const h = max > 0 ? (d.value / max) * 100 : 0;
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
      <div style="width:6px;height:${h}%;background:#5fb878;border-radius:2px"></div>
      <span style="color:#666;font-size:9px">W${i+1}</span>
    </div>`;
  }).join('');
  return `<div class="card-section" style="height:120px;display:flex;align-items:end;justify-content:space-around">${bars}</div>`;
}
