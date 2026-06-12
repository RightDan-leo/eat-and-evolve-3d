import type {
  SearchResult, SearchResultItem, SearchOptions,
  AssetDetail, DownloadRequest, DownloadStatus,
  DownloadRecord, SiteInfo,
} from './types';
import { showContextMenu } from './context-menu';

const API = import.meta.env.BASE_URL.replace(/\/$/, '');

// ─── State ───────────────────────────────────────────

interface DownloaderState {
  query: string;
  results: SearchResultItem[];
  loading: boolean;
  error: string;
  page: number;
  hasMore: boolean;
  sites: SiteInfo[];
  selectedSources: Set<string>;
  activeTasks: Map<string, DownloadStatus>;
  history: DownloadRecord[];
  targetDir: string;
  animatedOnly: boolean;
}

const state: DownloaderState = {
  query: '',
  results: [],
  loading: false,
  error: '',
  page: 1,
  hasMore: false,
  sites: [],
  selectedSources: new Set(),
  activeTasks: new Map(),
  history: [],
  targetDir: localStorage.getItem('uab_downloadDir') || '',
  animatedOnly: localStorage.getItem('uab_animatedOnly') === 'true',
};

let pollTimers = new Map<string, number>();
let container: HTMLElement | null = null;
let onRefreshCallback: (() => void) | null = null;

// ─── API Calls ───────────────────────────────────────

async function fetchSites(): Promise<SiteInfo[]> {
  const res = await fetch(`${API}/api/sites`);
  const data = await res.json();
  return data.sites || [];
}

async function apiSearch(query: string, options?: SearchOptions): Promise<SearchResult> {
  const res = await fetch(`${API}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, options }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `搜索失败: ${res.status}`);
  }
  return res.json();
}

async function apiGetDetail(source: string, id: string): Promise<AssetDetail> {
  const res = await fetch(`${API}/api/search-detail?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('获取详情失败');
  return res.json();
}

async function apiStartDownload(req: DownloadRequest): Promise<string> {
  const res = await fetch(`${API}/api/download-start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || '下载失败');
  }
  const data = await res.json();
  return data.taskId;
}

async function apiDownloadStatus(taskId: string): Promise<DownloadStatus> {
  const res = await fetch(`${API}/api/download-status?taskId=${encodeURIComponent(taskId)}`);
  return res.json();
}

async function apiCancelDownload(taskId: string): Promise<void> {
  await fetch(`${API}/api/download-cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId }),
  });
}

// ─── Core Actions ────────────────────────────────────

async function doSearch(newQuery?: string) {
  if (newQuery !== undefined) {
    state.query = newQuery;
    state.results = [];
    state.page = 1;
  }

  if (!state.query.trim()) return;

  state.loading = true;
  state.error = '';
  render();

  try {
    const options: SearchOptions = {
      sources: state.selectedSources.size > 0
        ? Array.from(state.selectedSources)
        : undefined,
      page: state.page,
      animated: state.animatedOnly || undefined,
    };
    const result = await apiSearch(state.query, options);
    if (state.page === 1) {
      state.results = result.items;
    } else {
      state.results = [...state.results, ...result.items];
    }
    state.hasMore = result.hasMore;
  } catch (e: any) {
    state.error = e.message;
  } finally {
    state.loading = false;
    render();
  }
}

async function loadMore() {
  if (state.loading || !state.hasMore) return;
  state.page++;
  await doSearch();
}

async function downloadItem(item: SearchResultItem) {
  if (!state.targetDir.trim()) {
    state.error = '请先设置下载目标目录';
    render();
    return;
  }

  if (item.source === 'sketchfab' && (!item.downloadUrl || item.downloadUrl.startsWith('https://sketchfab.com/'))) {
    const pageUrl = getSourcePageUrl('sketchfab', item.id);
    window.open(pageUrl, '_blank');
    state.error = 'Sketchfab 模型需要在网页端手动下载（需登录免费账号）。已在新标签页中打开。设置 SKETCHFAB_API_TOKEN 环境变量可启用自动下载。';
    render();
    return;
  }

  try {
    const req: DownloadRequest = {
      url: item.downloadUrl || '',
      source: item.source,
      assetId: item.id,
      assetName: item.name,
      targetDir: state.targetDir,
    };
    const taskId = await apiStartDownload(req);
    startPolling(taskId);
  } catch (e: any) {
    state.error = e.message;
    render();
  }
}

function startPolling(taskId: string) {
  const poll = async () => {
    try {
      const status = await apiDownloadStatus(taskId);
      state.activeTasks.set(taskId, status);
      render();
      if (status.status === 'downloading' || status.status === 'extracting') {
        pollTimers.set(taskId, window.setTimeout(poll, 1000));
      } else {
        pollTimers.delete(taskId);
        if (status.status === 'completed' && onRefreshCallback) {
          onRefreshCallback();
        }
      }
    } catch {
      pollTimers.delete(taskId);
    }
  };
  poll();
}

async function cancelTask(taskId: string) {
  await apiCancelDownload(taskId);
  state.activeTasks.delete(taskId);
  const timer = pollTimers.get(taskId);
  if (timer) { clearTimeout(timer); pollTimers.delete(taskId); }
  render();
}

// ─── Rendering ───────────────────────────────────────

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getSourcePageUrl(source: string, id: string): string {
  switch (source) {
    case 'polypizza': return `https://poly.pizza/m/${encodeURIComponent(id)}`;
    case 'kenney': return `https://kenney.nl/assets/${encodeURIComponent(id)}`;
    case 'kaylousberg': return `https://www.kaylousberg.com/game-assets/${encodeURIComponent(id)}`;
    case 'quaternius': return `https://quaternius.com/packs/${encodeURIComponent(id)}.html`;
    case 'sketchfab': return `https://sketchfab.com/3d-models/${encodeURIComponent(id)}`;
    default: return '';
  }
}

function render() {
  if (!container) return;

  const sourceTags = state.sites.map((s) => {
    const active = state.selectedSources.size === 0 || state.selectedSources.has(s.id);
    return `<button class="dl-source-tag${active ? ' active' : ''}" data-source="${s.id}">
      ${s.icon} ${escapeHtml(s.name)}
    </button>`;
  }).join('');

  const activeTasksHtml = renderActiveTasks();
  const resultsHtml = renderResults();

  container.innerHTML = `
    <div class="dl-panel">
      <div class="dl-search-section">
        <div class="dl-search-bar">
          <input type="text" class="dl-search-input" id="dlSearchInput"
                 placeholder="搜索免费 3D 模型、贴图、音效..."
                 value="${escapeHtml(state.query)}" />
          <button class="btn" id="dlSearchBtn">${state.loading ? '搜索中...' : '搜索'}</button>
        </div>
        <div class="dl-sources">
          ${sourceTags}
          <button class="dl-source-tag dl-anim-toggle${state.animatedOnly ? ' active' : ''}" id="dlAnimToggle">
            🎬 仅动画模型
          </button>
        </div>
        <div class="dl-target-dir">
          <label>下载目录</label>
          <input type="text" class="dl-dir-input" id="dlDirInput"
                 placeholder="输入下载目标路径"
                 value="${escapeHtml(state.targetDir)}" />
        </div>
      </div>
      ${activeTasksHtml}
      ${state.error ? `<div class="dl-error">${escapeHtml(state.error)}</div>` : ''}
      ${resultsHtml}
    </div>
  `;

  setupEvents();
}

function renderActiveTasks(): string {
  if (state.activeTasks.size === 0) return '';

  const tasks = Array.from(state.activeTasks.values())
    .filter((t) => t.status === 'downloading' || t.status === 'extracting')
    .map((t) => `
      <div class="dl-task-item">
        <div class="dl-task-info">
          <span class="dl-task-file">${escapeHtml(t.currentFile || t.taskId)}</span>
          <span class="dl-task-status">${t.status === 'extracting' ? '解压中...' : `${t.progress}%`}</span>
        </div>
        <div class="dl-task-bar">
          <div class="dl-task-bar-fill" style="width:${t.progress}%"></div>
        </div>
        <button class="dl-task-cancel" data-task-id="${t.taskId}">取消</button>
      </div>
    `).join('');

  if (!tasks) return '';

  return `<div class="dl-active-tasks">
    <h4>下载中</h4>
    ${tasks}
  </div>`;
}

function renderResults(): string {
  if (state.results.length === 0 && !state.loading) {
    if (!state.query) {
      return `
        <div class="dl-empty">
          <div class="dl-empty-icon">🌐</div>
          <h3>搜索免费资源</h3>
          <p>输入关键词从 Sketchfab、Poly Pizza、Kenney、Kay Lousberg、Quaternius 搜索免费模型和资源</p>
        </div>
      `;
    }
    if (state.error) return '';
    return `
      <div class="dl-empty">
        <div class="dl-empty-icon">🔍</div>
        <h3>未找到结果</h3>
        <p>尝试其他关键词或调整来源过滤</p>
      </div>
    `;
  }

  const cards = state.results.map((item) => renderResultCard(item)).join('');
  const loadMoreBtn = state.hasMore
    ? `<button class="btn btn-secondary dl-load-more" id="dlLoadMore">加载更多</button>`
    : '';

  return `
    <div class="dl-results">
      <div class="dl-results-header">
        <span>${state.results.length} 个结果</span>
      </div>
      <div class="dl-results-grid">${cards}</div>
      ${loadMoreBtn}
    </div>
    ${state.loading ? '<div class="dl-loading"><div class="loading-spinner"></div><span>搜索中...</span></div>' : ''}
  `;
}

function renderResultCard(item: SearchResultItem): string {
  const downloading = Array.from(state.activeTasks.values()).some(
    (t) => t.currentFile?.includes(item.name.replace(/[^a-zA-Z0-9]/g, '_'))
      && (t.status === 'downloading' || t.status === 'extracting'),
  );

  const animBadge = item.animated
    ? `<span class="dl-card-anim-badge" title="${item.animationCount ?? ''} 个动画">🎬${item.animationCount ? ` ${item.animationCount}` : ''}</span>`
    : '';

  const thumbHtml = item.thumbnail
    ? `<img class="dl-card-thumb" src="${escapeHtml(item.thumbnail)}" alt="${escapeHtml(item.name)}" loading="lazy"
           onerror="this.parentElement.innerHTML='<div class=dl-card-placeholder>📦</div>'" />${animBadge}`
    : `<div class="dl-card-placeholder">📦</div>${animBadge}`;

  const sourceLabel = state.sites.find((s) => s.id === item.source);
  const pageUrl = getSourcePageUrl(item.source, item.id);
  const btnLabel = downloading ? '下载中...' : '⬇ 下载';
  const itemData = JSON.stringify({
    id: item.id,
    name: item.name,
    source: item.source,
    downloadUrl: item.downloadUrl || '',
  }).replace(/'/g, '&#39;');

  const nameHtml = pageUrl
    ? `<a class="dl-card-name" href="${escapeHtml(pageUrl)}" target="_blank" rel="noopener" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</a>`
    : `<span class="dl-card-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>`;

  return `
    <div class="dl-card" data-dl-id="${escapeHtml(item.id)}" data-dl-source="${escapeHtml(item.source)}">
      <div class="dl-card-thumb-wrap">${thumbHtml}</div>
      <div class="dl-card-body">
        ${nameHtml}
        <span class="dl-card-meta">
          ${sourceLabel ? `${sourceLabel.icon} ${escapeHtml(sourceLabel.name)}` : escapeHtml(item.source)}
          · ${escapeHtml(item.author)}
        </span>
        <span class="dl-card-license">${escapeHtml(item.license)}</span>
      </div>
      <button class="dl-card-btn${downloading ? ' downloading' : ''}" data-dl-item='${itemData}'>
        ${btnLabel}
      </button>
    </div>
  `;
}

function setupEvents() {
  if (!container) return;

  const searchInput = container.querySelector('#dlSearchInput') as HTMLInputElement;
  const searchBtn = container.querySelector('#dlSearchBtn');
  const dirInput = container.querySelector('#dlDirInput') as HTMLInputElement;
  const loadMoreBtn = container.querySelector('#dlLoadMore');

  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch(searchInput.value.trim());
  });

  searchBtn?.addEventListener('click', () => {
    doSearch(searchInput?.value.trim());
  });

  dirInput?.addEventListener('change', () => {
    state.targetDir = dirInput.value.trim();
    localStorage.setItem('uab_downloadDir', state.targetDir);
  });

  loadMoreBtn?.addEventListener('click', () => loadMore());

  container.querySelectorAll('.dl-source-tag:not(.dl-anim-toggle)').forEach((el) => {
    el.addEventListener('click', () => {
      const source = (el as HTMLElement).dataset.source!;
      if (state.selectedSources.has(source)) {
        state.selectedSources.delete(source);
      } else {
        state.selectedSources.add(source);
      }
      render();
    });
  });

  const animToggle = container.querySelector('#dlAnimToggle');
  animToggle?.addEventListener('click', () => {
    state.animatedOnly = !state.animatedOnly;
    localStorage.setItem('uab_animatedOnly', String(state.animatedOnly));
    render();
  });

  container.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement;
    const card = target.closest('.dl-card') as HTMLElement | null;
    if (!card) return;

    e.preventDefault();
    const id = card.dataset.dlId!;
    const source = card.dataset.dlSource!;
    const item = state.results.find((r) => r.id === id && r.source === source);
    if (!item) return;

    const pageUrl = getSourcePageUrl(source, id);
    const items = [
      { icon: '⬇', label: '下载', onClick: () => downloadItem(item) },
      ...(pageUrl
        ? [{ icon: '🔗', label: '在源网站打开', onClick: () => window.open(pageUrl, '_blank') }]
        : []),
    ];
    showContextMenu(e.clientX, e.clientY, items);
  });

  container.querySelectorAll('.dl-card-btn').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const btn = el as HTMLButtonElement;
      if (btn.classList.contains('downloading')) return;
      const data = btn.dataset.dlItem;
      if (!data) return;
      try {
        const item = JSON.parse(data);
        btn.textContent = '获取中...';
        btn.classList.add('downloading');
        downloadItem(item as SearchResultItem);
      } catch (err) {
        console.error('[下载] 解析失败:', err);
      }
    });
  });

  container.querySelectorAll('.dl-task-cancel').forEach((el) => {
    el.addEventListener('click', () => {
      const taskId = (el as HTMLElement).dataset.taskId!;
      cancelTask(taskId);
    });
  });
}

// ─── Public API ──────────────────────────────────────

export async function initDownloader(el: HTMLElement, onRefresh?: () => void) {
  container = el;
  onRefreshCallback = onRefresh || null;

  try {
    state.sites = await fetchSites();
  } catch {
    state.sites = [];
  }

  render();
}

export function disposeDownloader() {
  for (const timer of pollTimers.values()) {
    clearTimeout(timer);
  }
  pollTimers.clear();
  container = null;
  onRefreshCallback = null;
}

export function showDownloaderPanel() {
  render();
}
