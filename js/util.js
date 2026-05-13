// src/render/web/js/util.js
// 全局工具函数 — 必须在 dashboard.js / detail.js / filters.js / drag.js 之前加载

// XSS 防护：HTML 实体转义。所有来自外部 API 的字符串（Tavily 新闻标题、
// Yahoo 公司名、AI reasoning 等）经 innerHTML 注入前必须 escape。
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 用于 attribute 上下文（title="..." / href="..."）— 只 escape 引号是不够的，
// 用 encodeURIComponent 更安全，但会破坏正常 URL 的可读性，所以分两个函数：

// attribute 文本（title=, alt= 等）只需 escape & < > " '
function escapeAttr(s) {
  return escapeHtml(s);
}

// URL 校验：只允许 http(s) 协议，防止 javascript:、data: 等
function safeUrl(url) {
  if (!url) return '#';
  const s = String(url).trim();
  // 允许相对路径（本站资源）
  if (s.startsWith('/') || s.startsWith('./') || s.startsWith('#')) return s;
  // 显式协议必须是 http/https
  if (/^https?:\/\//i.test(s)) return s;
  return '#';
}

// 安全外链：href + target=_blank + rel="noopener noreferrer"
function safeExternalLink(url, text) {
  return `<a href="${escapeAttr(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
}
