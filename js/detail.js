// src/render/web/js/detail.js
async function loadDetail(ticker) {
  const data = await fetch(`stock_detail/${encodeURIComponent(ticker)}.json`)
    .then(r => r.json()).catch(() => null);
  if (!data) {
    document.getElementById('detail-panel').innerHTML =
      `<div class="empty">无法加载 ${escapeHtml(ticker)} 的详情</div>`;
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
    ? `<span class="data-warn-tag">${escapeHtml(h.data_warning)}</span>` : '';
  const desc = (h.description || []).map(p => `<p>${escapeHtml(p)}</p>`).join('');
  const meta = [
    h.market,
    h.tier_letter,
    h.status_label,
    h.data_source_text,
  ].filter(Boolean).map(s => escapeHtml(s)).join(' · ');

  return `<div class="detail-header">
    <div class="dh-label">个股详情</div>
    <div class="dh-sublabel">${escapeHtml(h.ticker)} · ${escapeHtml(h.sector || '')}</div>
    <div class="dh-title-row">
      <div>
        <div class="dh-ticker">${escapeHtml(h.ticker)}</div>
        <div class="dh-name">${escapeHtml(h.name || '')}</div>
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
  const meta = panel.title_meta
    ? `<span class="card-title-meta">${escapeHtml(panel.title_meta)}</span>` : '';
  return `<div class="card">
    <div class="card-title-row">
      <div class="card-title">${escapeHtml(panel.title)}</div>
      ${meta}
    </div>
    ${fn(panel)}
  </div>`;
}

function _kvCell(label, value, valueClass = '') {
  return `<div class="kv">
    <div class="kv-l">${escapeHtml(label)}</div>
    <div class="kv-v ${valueClass}">${value === null || value === undefined ? '—' : escapeHtml(value)}</div>
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
      ? `<div class="card-section" style="margin-bottom:8px"><div class="kv-l">AI 角色</div><div class="ai-role-text">${escapeHtml(d.ai_role)}</div></div>`
      : '';
    const metricsBlock = `<div class="card-section"><div class="grid-3">${
      Object.entries(d.metrics).map(([k, v]) => _kvCell(k, v, _valueClass(v))).join('')
    }</div></div>`;
    return aiBlock + metricsBlock;
  }
  return renderMetricsGrid(panel);
}

function renderScoreGrid(panel) {
  const items = Object.entries(panel.data || {}).map(([dim, score]) => {
    const cls = score === null || score === undefined ? 'neg'
              : score >= 70 ? '' : score >= 40 ? 'warn' : 'neg';
    const disp = score === null || score === undefined ? '—' : score.toFixed(0);
    const width = score || 0;
    return `<div class="score-item">
      <div class="sl">${escapeHtml(dim)}</div>
      <div class="sv">${disp}</div>
      <div class="score-bar ${cls}"><div style="width:${width}%"></div></div>
    </div>`;
  }).join('');
  return `<div class="score-list">${items}</div>`;
}

function renderScoreGrid3x3(panel) {
  const cells = (panel.data || []).map(c => {
    const score = c.value;
    const cls = score === null || score === undefined ? 'neg'
              : score >= 70 ? '' : score >= 40 ? 'warn' : 'neg';
    const disp = score === null || score === undefined ? '—' : score.toFixed(0);
    const width = score || 0;

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

    const tip = tipText ? ` title="${escapeAttr(tipText)}"` : '';
    return `<div class="score-cell${extraStyle}"${tip}>
      <div class="sl">${escapeHtml(c.label)}${badge}</div>
      <div class="sv">${disp}</div>
      <div class="score-bar ${cls}"><div style="width:${width}%"></div></div>
    </div>`;
  }).join('');
  return `<div class="score-grid-3x3">${cells}</div>`;
}

function renderExternal(panel) {
  if (!panel.data) {
    return `<div class="card-section">暂无外部分析师覆盖</div>` +
      (panel.disclaimer ? `<div class="external-disclaimer">${escapeHtml(panel.disclaimer)}</div>` : '');
  }
  const d = panel.data;
  const meanDisp = d.target_mean ? `$${d.target_mean.toFixed(2)}` : '—';
  const upsideClass = (d.upside_pct || 0) >= 0 ? 'pos' : 'neg';
  const upsideText = (d.upside_pct !== null && d.upside_pct !== undefined)
    ? `${d.upside_pct >= 0 ? '+' : ''}${d.upside_pct.toFixed(2)}%` : '—';
  const rangeDisp = (d.target_low && d.target_high)
    ? `$${d.target_low.toFixed(2)} / $${d.target_high.toFixed(2)}` : '—';
  const ratingLetter = d.rating_letter || '—';
  const ratingSub = `${escapeHtml(d.rating_change || '维持')} / 前次 ${escapeHtml(d.previous_rating_letter || '—')}`;
  const earnDate = escapeHtml(d.next_earnings || '—');
  const eps = (d.eps_estimate !== null && d.eps_estimate !== undefined)
    ? `EPS ${d.eps_estimate.toFixed(2)}` : 'EPS —';
  const rev = (d.revenue_estimate !== null && d.revenue_estimate !== undefined)
    ? ` · 营收 $${(d.revenue_estimate/1e9).toFixed(2)}B` : '';
  const estLine = `${earnDate} · ${eps}${rev}`;
  const coverageLine = d.n_analysts ? `${d.n_analysts} 位覆盖` : '—';

  const grid = `<div class="external-grid">
    <div class="external-cell"><div class="label">共识目标价</div><div class="value">${meanDisp}</div><div class="sub ${upsideClass}">${upsideText}</div></div>
    <div class="external-cell"><div class="label">目标区间</div><div class="value">${rangeDisp}</div><div class="sub">低 / 高</div></div>
    <div class="external-cell"><div class="label">外部评级</div><div class="value">${escapeHtml(ratingLetter)}</div><div class="sub">${ratingSub}</div></div>
    <div class="external-cell"><div class="label">分析师预估</div><div class="value" style="font-size:13px">${estLine}</div><div class="sub">${escapeHtml(coverageLine)}</div></div>
  </div>`;
  const disc = panel.disclaimer ? `<div class="external-disclaimer">${escapeHtml(panel.disclaimer)}</div>` : '';
  return grid + disc;
}

function renderAiText(panel) {
  return `<div class="ai-text">${escapeHtml(panel.data?.text || '(待 Sonnet 4.6 生成)')}</div>`;
}

function renderNewsList(panel) {
  const items = (panel.data || []).map(n => `
    <div class="news-row">
      <div class="nt">${safeExternalLink(n.url, n.title)}</div>
      <div class="nm"><span>${escapeHtml(n.source)}</span><span>${escapeHtml(n.date)}</span></div>
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
