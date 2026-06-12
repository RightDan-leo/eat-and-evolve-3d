import './style.css';
import type { AssetInfo, AssetType, ScanResult, PathFilters, FavoritesData } from './types';
import { TYPE_META, WEB_IMAGE_EXTENSIONS, MODEL_EXTENSIONS_3D, WEB_AUDIO_EXTENSIONS, FILTERABLE_TYPES } from './types';
import { init3DPreview, cleanup3DPreview, playAnimation, loadTGAToCanvas, setExposure, getExposure } from './preview3d';
import type { MaterialInfo } from './preview3d';
import {
  isSelectMode, toggleSelectMode, toggleSelect, isSelected,
  selectAll, clearSelection, getSelectedCount,
  renderExportBar, showExportPanel,
} from './exporter';
import { initDownloader, disposeDownloader, showDownloaderPanel } from './downloader';
import { showContextMenu } from './context-menu';

const API = import.meta.env.BASE_URL.replace(/\/$/, '');

// ─── State ───────────────────────────────────────────

interface AppState {
  assets: AssetInfo[];
  folders: string[];
  projectPath: string;
  scanTime: string;
  typeFilters: Set<AssetType>;
  searchQuery: string;
  selectedFolder: string;
  sortBy: 'name' | 'size' | 'type';
  scanning: boolean;
  pathFilters: PathFilters;
  showPathConfig: boolean;
  favorites: FavoritesData;
  viewMode: 'browse' | 'favorites' | 'download';
  selectedFavFolderId: string | null;
}

function loadPathFilters(): PathFilters {
  try {
    const raw = localStorage.getItem('uab_pathFilters');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

let pathFilterSyncTimer: ReturnType<typeof setTimeout>;
function savePathFilters() {
  localStorage.setItem('uab_pathFilters', JSON.stringify(state.pathFilters));
  clearTimeout(pathFilterSyncTimer);
  pathFilterSyncTimer = setTimeout(() => syncPathFiltersToServer(), 500);
}

function syncPathFiltersToServer() {
  if (!state.projectPath) return;
  fetch(`${API}/api/path-filters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectPath: state.projectPath, pathFilters: state.pathFilters }),
  }).catch(() => {});
}

function loadFavorites(): FavoritesData {
  try {
    const raw = localStorage.getItem('uab_favorites');
    return raw ? JSON.parse(raw) : { folders: [], items: [] };
  } catch {
    return { folders: [], items: [] };
  }
}

let favSyncTimer: ReturnType<typeof setTimeout>;
function saveFavorites() {
  localStorage.setItem('uab_favorites', JSON.stringify(state.favorites));
  clearTimeout(favSyncTimer);
  favSyncTimer = setTimeout(() => syncFavoritesToServer(), 500);
}

function syncFavoritesToServer() {
  if (!state.projectPath) return;
  fetch(`${API}/api/favorites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectPath: state.projectPath, favorites: state.favorites }),
  }).catch(() => {});
}

async function loadFavoritesFromServer(): Promise<FavoritesData | null> {
  if (!state.projectPath) return null;
  try {
    const res = await fetch(`${API}/api/favorites?projectPath=${encodeURIComponent(state.projectPath)}`);
    const data = await res.json();
    if (data?.items) return data as FavoritesData;
  } catch {}
  return null;
}

async function loadPathFiltersFromServer(): Promise<PathFilters | null> {
  if (!state.projectPath) return null;
  try {
    const res = await fetch(`${API}/api/path-filters?projectPath=${encodeURIComponent(state.projectPath)}`);
    const data = await res.json();
    if (data && typeof data === 'object') return data as PathFilters;
  } catch {}
  return null;
}

const state: AppState = {
  assets: [],
  folders: [],
  projectPath: localStorage.getItem('uab_projectPath') || '',
  scanTime: '',
  typeFilters: new Set<AssetType>(['image', 'model']),
  searchQuery: '',
  selectedFolder: '',
  sortBy: 'name',
  scanning: false,
  pathFilters: loadPathFilters(),
  showPathConfig: false,
  favorites: loadFavorites(),
  viewMode: 'browse',
  selectedFavFolderId: null,
};

async function restoreLastProject() {
  try {
    const res = await fetch(`${API}/api/last-project`);
    const data = await res.json();
    if (data.projectPath) {
      state.projectPath = data.projectPath;
      localStorage.setItem('uab_projectPath', data.projectPath);
      updateScanUI();
    }
  } catch {}
}

// ─── Helpers ─────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function assetFileUrl(relativePath: string): string {
  return (
    API + '/api/unity-file/' +
    relativePath
      .split('/')
      .map(encodeURIComponent)
      .join('/')
  );
}

function getFilteredAssets(): AssetInfo[] {
  let list = state.assets.filter((a) => {
    if (state.typeFilters.size > 0 && !state.typeFilters.has(a.type)) return false;
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !a.relativePath.toLowerCase().includes(q))
        return false;
    }
    if (state.selectedFolder && !a.directory.startsWith(state.selectedFolder))
      return false;
    return true;
  });

  list.sort((a, b) => {
    switch (state.sortBy) {
      case 'size':
        return b.size - a.size;
      case 'type':
        return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
      default:
        return a.name.localeCompare(b.name);
    }
  });

  return list;
}

function getTypeCounts(): Partial<Record<AssetType, number>> {
  const counts: Partial<Record<AssetType, number>> = {};
  for (const a of state.assets) {
    counts[a.type] = (counts[a.type] || 0) + 1;
  }
  return counts;
}

// ─── Favorites CRUD ──────────────────────────────────

function isFavorited(assetPath: string): boolean {
  return state.favorites.items.some((i) => i.assetPath === assetPath);
}

function toggleFavorite(assetPath: string) {
  if (isFavorited(assetPath)) {
    state.favorites.items = state.favorites.items.filter(
      (i) => i.assetPath !== assetPath,
    );
  } else {
    state.favorites.items.push({
      assetPath,
      folderId: null,
      addedAt: Date.now(),
    });
  }
  saveFavorites();
  updateGrid();
  if (state.viewMode === 'favorites') updateSidebar();
}

function addFavFolder(name: string, parentId: string | null): string {
  const id =
    'fav_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  state.favorites.folders.push({ id, name, parentId });
  saveFavorites();
  return id;
}

function renameFavFolder(folderId: string, newName: string) {
  const folder = state.favorites.folders.find((f) => f.id === folderId);
  if (folder) {
    folder.name = newName;
    saveFavorites();
  }
}

function deleteFavFolder(folderId: string) {
  const folder = state.favorites.folders.find((f) => f.id === folderId);
  const parentId = folder ? folder.parentId : null;
  state.favorites.items.forEach((item) => {
    if (item.folderId === folderId) item.folderId = parentId;
  });
  state.favorites.folders.forEach((f) => {
    if (f.parentId === folderId) f.parentId = parentId;
  });
  state.favorites.folders = state.favorites.folders.filter(
    (f) => f.id !== folderId,
  );
  saveFavorites();
}

function moveFavItem(assetPath: string, targetFolderId: string | null) {
  const item = state.favorites.items.find((i) => i.assetPath === assetPath);
  if (item) {
    item.folderId = targetFolderId;
    saveFavorites();
  }
}

function getFavoritedAssets(): AssetInfo[] {
  let favItems = state.favorites.items;
  if (state.selectedFavFolderId === '__root__') {
    favItems = favItems.filter((i) => i.folderId === null);
  } else if (state.selectedFavFolderId !== null) {
    favItems = favItems.filter(
      (i) => i.folderId === state.selectedFavFolderId,
    );
  }
  const favPaths = new Set(favItems.map((i) => i.assetPath));
  let list = state.assets.filter((a) => favPaths.has(a.relativePath));
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.relativePath.toLowerCase().includes(q),
    );
  }
  list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

function getFavFolderItemCount(folderId: string | null): number {
  if (folderId === null) {
    return state.favorites.items.filter((i) => i.folderId === null).length;
  }
  return state.favorites.items.filter((i) => i.folderId === folderId).length;
}

// ─── API ─────────────────────────────────────────────

async function doScan() {
  const input = document.getElementById('pathInput') as HTMLInputElement;
  const projectPath = input.value.trim();
  if (!projectPath) {
    input.focus();
    return;
  }

  state.scanning = true;
  state.projectPath = projectPath;
  localStorage.setItem('uab_projectPath', projectPath);
  updateScanUI();

  try {
    const hasFilters = Object.values(state.pathFilters).some(
      (arr) => arr && arr.length > 0,
    );

    const root = projectPath.replace(/\\/g, '/').replace(/\/+$/, '') + '/Assets';
    console.log('[扫描配置] 各类型扫描路径:');
    for (const type of FILTERABLE_TYPES) {
      const paths = state.pathFilters[type];
      const meta = TYPE_META[type];
      if (paths && paths.length > 0) {
        console.log(`  ${meta.icon} ${meta.label}:`);
        paths.forEach((p) => console.log(`    ${root}/${p}`));
      } else {
        console.log(`  ${meta.icon} ${meta.label}: ${root}  (整个工程)`);
      }
    }

    const res = await fetch(`${API}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectPath,
        ...(hasFilters ? { pathFilters: state.pathFilters } : {}),
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '扫描失败');

    const result = data as ScanResult;
    state.assets = result.assets;
    state.folders = result.folders;
    state.scanTime = result.scanTime;
    state.selectedFolder = '';
    state.searchQuery = '';

    await restoreProjectCache();

    const imageAssets = state.assets.filter((a) => a.type === 'image');
    console.log(`[图片资源] 扫描结果：${imageAssets.length} 个`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    alert(`扫描失败：${msg}`);
  } finally {
    state.scanning = false;
    updateScanUI();
    updateSidebar();
    updateGrid();
  }
}

async function tryRestoreScan() {
  try {
    const pp = state.projectPath;
    const qs = pp ? `?projectPath=${encodeURIComponent(pp)}` : '';
    const res = await fetch(`${API}/api/assets${qs}`);
    const data = await res.json();
    if (data.assets?.length > 0) {
      state.assets = data.assets;
      state.folders = data.folders;
      state.projectPath = data.projectPath || state.projectPath;
      state.scanTime = data.scanTime;

      await restoreProjectCache();

      updateScanUI();
      updateSidebar();
      updateGrid();
    }
  } catch {
    // ignored
  }
}

async function restoreProjectCache() {
  const [serverFavs, serverFilters] = await Promise.all([
    loadFavoritesFromServer(),
    loadPathFiltersFromServer(),
  ]);
  if (serverFavs && serverFavs.items.length > 0) {
    state.favorites = serverFavs;
    localStorage.setItem('uab_favorites', JSON.stringify(serverFavs));
  }
  if (serverFilters && Object.keys(serverFilters).length > 0) {
    state.pathFilters = serverFilters;
    localStorage.setItem('uab_pathFilters', JSON.stringify(serverFilters));
  }
}

// ─── Rendering ───────────────────────────────────────

function initLayout() {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <header class="header">
      <div class="header-top">
        <h1 class="logo">Art Browser</h1>
        <div class="header-right">
          <button class="btn btn-secondary btn-sm" id="selectModeBtn">☐ 多选</button>
          <div class="view-toggle">
            <button class="view-tab${state.viewMode === 'browse' ? ' active' : ''}" data-view="browse">浏览</button>
            <button class="view-tab${state.viewMode === 'favorites' ? ' active' : ''}" data-view="favorites">★ 收藏夹</button>
            <button class="view-tab${state.viewMode === 'download' ? ' active' : ''}" data-view="download">⬇ 下载</button>
          </div>
        </div>
      </div>
      <div class="scan-bar">
        <input type="text" id="pathInput"
               placeholder="输入工程路径，例如 D:\\Projects\\MyGame"
               value="${escapeHtml(state.projectPath)}" />
        <button class="btn btn-secondary" id="pathConfigToggle">路径配置 ▸</button>
        <button class="btn" id="scanBtn">扫描工程</button>
      </div>
      <div id="pathConfigPanel" class="path-config-panel" style="display:none;"></div>
      <div id="scanInfo" class="scan-info"></div>
    </header>
    <div class="layout">
      <aside class="sidebar" id="sidebar"></aside>
      <main class="content" id="mainContent">
        <div class="content-header" id="contentHeader"></div>
        <div class="asset-grid-wrapper" id="gridWrapper">
          <div class="asset-grid" id="assetGrid"></div>
        </div>
      </main>
      <div class="download-view" id="downloadView" style="display:none;"></div>
    </div>
    <div id="previewRoot"></div>
  `;

  setupEventListeners();
  updateScanUI();
  updateSidebar();
  updateGrid();
  restoreLastProject().then(() => tryRestoreScan());

  const downloadView = document.getElementById('downloadView')!;
  initDownloader(downloadView, () => {
    if (state.projectPath) doScan();
  });
}

function updateViewVisibility() {
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('mainContent');
  const downloadView = document.getElementById('downloadView');
  if (state.viewMode === 'download') {
    if (sidebar) sidebar.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
    if (downloadView) downloadView.style.display = 'flex';
  } else {
    if (sidebar) sidebar.style.display = '';
    if (mainContent) mainContent.style.display = '';
    if (downloadView) downloadView.style.display = 'none';
  }
}

function updateScanUI() {
  const btn = document.getElementById('scanBtn') as HTMLButtonElement;
  const info = document.getElementById('scanInfo')!;
  const input = document.getElementById('pathInput') as HTMLInputElement;

  if (btn) {
    btn.textContent = state.scanning ? '扫描中...' : '扫描工程';
    btn.disabled = state.scanning;
  }
  if (input && !input.matches(':focus')) {
    input.value = state.projectPath;
  }
  if (info) {
    info.textContent = state.scanTime
      ? `上次扫描：${new Date(state.scanTime).toLocaleString()}  ·  共 ${state.assets.length} 个资源`
      : '';
  }
}

function updateSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  if (state.viewMode === 'favorites') {
    renderFavSidebar(sidebar);
    return;
  }

  const counts = getTypeCounts();
  const typeKeys: AssetType[] = [
    'image', 'model', 'audio', 'animation', 'material', 'shader', 'prefab', 'scene',
  ];

  const typeFiltersHtml = typeKeys
    .map((key) => {
      const meta = TYPE_META[key];
      const count = counts[key] || 0;
      const checked = state.typeFilters.has(key) ? 'checked' : '';
      return `
        <label class="type-filter">
          <input type="checkbox" class="type-checkbox" data-type="${key}" ${checked} />
          <span class="label">${meta.icon} ${meta.label}</span>
          <span class="count">${count}</span>
        </label>`;
    })
    .join('');

  const foldersHtml = state.folders
    .map(
      (f) => `
      <div class="folder-item${state.selectedFolder === f ? ' active' : ''}" data-folder="${escapeHtml(f)}"
           title="${escapeHtml(f)}">
        📁 ${escapeHtml(f.split('/').pop() || f)}
      </div>`,
    )
    .join('');

  sidebar.innerHTML = `
    <div class="filter-section">
      <h3>资源类型</h3>
      ${typeFiltersHtml}
    </div>
    <div class="filter-section">
      <h3>搜索</h3>
      <input type="text" class="search-input" id="searchInput"
             placeholder="搜索文件名..." value="${escapeHtml(state.searchQuery)}" />
    </div>
    <div class="filter-section">
      <h3>文件夹 (${state.folders.length})</h3>
      <div class="folder-list">
        <div class="folder-item${state.selectedFolder === '' ? ' active' : ''}" data-folder="">
          📂 全部
        </div>
        ${foldersHtml}
      </div>
    </div>
  `;
}

function renderFavSidebar(sidebar: HTMLElement) {
  const totalCount = state.favorites.items.length;
  const rootCount = getFavFolderItemCount(null);

  function buildTree(parentId: string | null, depth: number): string {
    return state.favorites.folders
      .filter((f) => f.parentId === parentId)
      .map((f) => {
        const count = getFavFolderItemCount(f.id);
        const isActive = state.selectedFavFolderId === f.id;
        const indent = 8 + depth * 16;
        const children = buildTree(f.id, depth + 1);
        return `
          <div class="fav-tree-item${isActive ? ' active' : ''}"
               data-fav-folder="${f.id}" style="padding-left:${indent}px">
            <span class="fav-folder-icon">📁</span>
            <span class="fav-folder-name">${escapeHtml(f.name)}</span>
            <span class="fav-count">${count}</span>
            <span class="fav-folder-actions">
              <button class="fav-action-btn fav-rename-btn" data-folder-id="${f.id}" title="重命名">✎</button>
              <button class="fav-action-btn fav-delete-btn" data-folder-id="${f.id}" title="删除">✕</button>
            </span>
          </div>${children}`;
      })
      .join('');
  }

  const treeHtml = buildTree(null, 0);

  sidebar.innerHTML = `
    <div class="filter-section">
      <h3>收藏夹</h3>
      <div class="fav-tree">
        <div class="fav-tree-item${state.selectedFavFolderId === null ? ' active' : ''}"
             data-fav-folder="__all__">
          <span class="fav-folder-icon">★</span>
          <span class="fav-folder-name">全部收藏</span>
          <span class="fav-count">${totalCount}</span>
        </div>
        <div class="fav-tree-item${state.selectedFavFolderId === '__root__' ? ' active' : ''}"
             data-fav-folder="__root__">
          <span class="fav-folder-icon">📂</span>
          <span class="fav-folder-name">未分类</span>
          <span class="fav-count">${rootCount}</span>
        </div>
        ${treeHtml}
      </div>
      <button class="btn btn-secondary fav-new-folder-btn" id="newFavFolderBtn"
              style="width:100%;margin-top:8px;font-size:12px;">+ 新建文件夹</button>
    </div>
    <div class="filter-section">
      <h3>搜索</h3>
      <input type="text" class="search-input" id="searchInput"
             placeholder="搜索收藏..." value="${escapeHtml(state.searchQuery)}" />
    </div>
  `;
}

// ─── Virtual Grid ────────────────────────────────────

const CARD_MIN_W = 170;
const CARD_GAP = 12;
const CARD_H = 180;
const ROW_H = CARD_H + CARD_GAP;
const OVERSCAN = 4;
const PAD_X = 20;
const PAD_Y = 16;

let vgCleanup: (() => void) | null = null;

function updateGrid() {
  vgCleanup?.();
  vgCleanup = null;

  const wrapper = document.getElementById('gridWrapper')!;
  const header = document.getElementById('contentHeader')!;
  const filtered =
    state.viewMode === 'favorites' ? getFavoritedAssets() : getFilteredAssets();

  const headerLabel =
    state.viewMode === 'favorites'
      ? `★ ${filtered.length} 个收藏`
      : `${filtered.length} 个资源${state.selectedFolder ? ` · ${state.selectedFolder}` : ''}`;

  const selectInfo = isSelectMode()
    ? `<span class="select-count">已选 ${getSelectedCount()} 项</span>
       <button class="btn btn-secondary btn-sm" id="selectAllBtn">全选</button>`
    : '';

  header.innerHTML = `
    <span>${headerLabel} ${selectInfo}</span>
    <div>
      <select class="sort-select" id="sortSelect">
        <option value="name"${state.sortBy === 'name' ? ' selected' : ''}>按名称</option>
        <option value="size"${state.sortBy === 'size' ? ' selected' : ''}>按大小</option>
        <option value="type"${state.sortBy === 'type' ? ' selected' : ''}>按类型</option>
      </select>
    </div>
  `;

  if (state.viewMode === 'favorites' && state.favorites.items.length === 0) {
    wrapper.innerHTML = `
      <div class="empty-state">
        <div class="icon">★</div>
        <h2>收藏夹为空</h2>
        <p>在浏览模式下点击资源卡片上的 ☆ 按钮添加收藏</p>
      </div>
    `;
    return;
  }

  if (state.assets.length === 0) {
    wrapper.innerHTML = `
      <div class="empty-state">
        <div class="icon">🎮</div>
        <h2>开始使用</h2>
        <p>在顶部输入工程路径，点击「扫描工程」查看所有资源</p>
      </div>
    `;
    return;
  }

  if (filtered.length === 0) {
    wrapper.innerHTML = `
      <div class="empty-state">
        <div class="icon">🔍</div>
        <h2>未找到匹配的资源</h2>
        <p>尝试调整筛选条件或搜索关键字</p>
      </div>
    `;
    return;
  }

  // --- Virtual scrolling layout ---

  function calcLayout() {
    const cw = wrapper.clientWidth - PAD_X * 2;
    const cols = Math.max(1, Math.floor((cw + CARD_GAP) / (CARD_MIN_W + CARD_GAP)));
    const cardW = (cw - (cols - 1) * CARD_GAP) / cols;
    const totalRows = Math.ceil(filtered.length / cols);
    const totalH = totalRows * ROW_H - CARD_GAP + PAD_Y * 2;
    return { cols, cardW, totalRows, totalH };
  }

  let { cols, cardW, totalRows, totalH } = calcLayout();

  wrapper.innerHTML = '';
  wrapper.scrollTop = 0;
  const container = document.createElement('div');
  container.style.cssText = `position:relative;height:${totalH}px;`;
  wrapper.appendChild(container);

  let prevSR = -1;
  let prevER = -1;

  function renderVisible() {
    const st = wrapper.scrollTop;
    const vh = wrapper.clientHeight;

    const sr = Math.max(0, Math.floor((st - PAD_Y) / ROW_H) - OVERSCAN);
    const er = Math.min(totalRows - 1, Math.ceil((st + vh - PAD_Y) / ROW_H) + OVERSCAN);

    if (sr === prevSR && er === prevER) return;
    prevSR = sr;
    prevER = er;

    const si = sr * cols;
    const ei = Math.min(filtered.length - 1, (er + 1) * cols - 1);

    container.innerHTML = '';
    const frag = document.createDocumentFragment();

    for (let i = si; i <= ei; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const card = createAssetCard(filtered[i]);
      card.style.position = 'absolute';
      card.style.top = `${PAD_Y + r * ROW_H}px`;
      card.style.left = `${PAD_X + c * (cardW + CARD_GAP)}px`;
      card.style.width = `${cardW}px`;
      card.style.height = `${CARD_H}px`;
      frag.appendChild(card);
    }

    container.appendChild(frag);
  }

  renderVisible();

  // Scroll — throttle with rAF
  let raf: number | null = null;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      renderVisible();
      raf = null;
    });
  };
  wrapper.addEventListener('scroll', onScroll, { passive: true });

  // Resize — debounced relayout
  let resizeTimer: ReturnType<typeof setTimeout>;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const nl = calcLayout();
      if (nl.cols !== cols || Math.abs(nl.cardW - cardW) > 1) {
        cols = nl.cols;
        cardW = nl.cardW;
        totalRows = nl.totalRows;
        totalH = nl.totalH;
        container.style.height = `${totalH}px`;
        prevSR = prevER = -1;
        renderVisible();
      }
    }, 200);
  };
  window.addEventListener('resize', onResize);

  vgCleanup = () => {
    wrapper.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    if (raf) cancelAnimationFrame(raf);
    clearTimeout(resizeTimer);
  };
}

function createAssetCard(asset: AssetInfo): HTMLElement {
  const card = document.createElement('div');
  const selected = isSelectMode() && isSelected(asset.relativePath);
  card.className = `asset-card${selected ? ' selected' : ''}`;
  card.dataset.path = asset.relativePath;
  card.dataset.type = asset.type;
  card.dataset.ext = asset.extension;

  const meta = TYPE_META[asset.type];
  const isWebImage = asset.type === 'image' && WEB_IMAGE_EXTENSIONS.has(asset.extension);

  const thumbHtml = isWebImage
    ? `<img class="asset-thumb" src="${assetFileUrl(asset.relativePath)}" loading="lazy" alt="${escapeHtml(asset.name)}" />`
    : `<div class="asset-thumb-placeholder">
         <span>${meta.icon}</span>
         <span class="ext-label">${asset.extension}</span>
       </div>`;

  const starred = isFavorited(asset.relativePath);
  const starClass = starred ? 'fav-star active' : 'fav-star';
  const starChar = starred ? '★' : '☆';

  const moveBtn =
    state.viewMode === 'favorites'
      ? `<button class="fav-move-btn" data-path="${escapeHtml(asset.relativePath)}" title="移动到文件夹">📂</button>`
      : '';

  const checkboxHtml = isSelectMode()
    ? `<div class="asset-checkbox${selected ? ' checked' : ''}" data-select-path="${escapeHtml(asset.relativePath)}">
         ${selected ? '☑' : '☐'}
       </div>`
    : '';

  card.innerHTML = `
    ${checkboxHtml}
    <div class="asset-thumb-container">${thumbHtml}</div>
    <div class="asset-info">
      <span class="asset-name" title="${escapeHtml(asset.relativePath)}">${escapeHtml(asset.name)}</span>
      <span class="asset-meta">${formatSize(asset.size)}${asset.width ? ` · ${asset.width}×${asset.height}` : ''}</span>
    </div>
    <span class="asset-badge" style="color:${meta.color}">${meta.label}</span>
    <button class="${starClass}" data-path="${escapeHtml(asset.relativePath)}" title="${starred ? '取消收藏' : '添加收藏'}">${starChar}</button>
    ${moveBtn}
  `;

  return card;
}

// ─── Preview ─────────────────────────────────────────

function openPreview(asset: AssetInfo) {
  const root = document.getElementById('previewRoot')!;
  const meta = TYPE_META[asset.type];
  const fileUrl = assetFileUrl(asset.relativePath);

  root.innerHTML = `
    <div class="preview-overlay" id="previewOverlay">
      <div class="preview-panel">
        <div class="preview-header">
          <div>
            <span class="title">${escapeHtml(asset.name)}</span>
            <span class="path">${escapeHtml(asset.relativePath)}</span>
          </div>
          <button class="preview-close" id="closePreview">✕</button>
        </div>
        <div class="preview-body" id="previewBody">
          <div class="loading-overlay" id="previewLoading">
            <div class="loading-spinner"></div>
            <span>加载中...</span>
          </div>
        </div>
        <div id="materialPanel" class="material-panel" style="display:none;"></div>
        <div class="preview-info-bar">
          <span class="tag" style="color:${meta.color}">${meta.icon} ${meta.label}</span>
          <span>${formatSize(asset.size)}</span>
          <span>${asset.extension}</span>
          ${asset.width ? `<span>${asset.width}×${asset.height}</span>` : ''}
          <div class="exposure-control" id="exposureControl" style="display:none;">
            <label>亮度</label>
            <input type="range" id="exposureSlider" min="0.3" max="4.0" step="0.1" value="1.5" />
            <span id="exposureValue">1.5</span>
          </div>
        </div>
      </div>
    </div>
  `;

  const body = document.getElementById('previewBody')!;
  const loading = document.getElementById('previewLoading')!;

  if (asset.type === 'image' && WEB_IMAGE_EXTENSIONS.has(asset.extension)) {
    const img = document.createElement('img');
    img.src = fileUrl;
    img.alt = asset.name;
    img.onload = () => loading.remove();
    img.onerror = () => {
      loading.innerHTML = `<span>图片加载失败</span>`;
    };
    body.appendChild(img);
  } else if (asset.type === 'image' && asset.extension === '.tga') {
    loadTGAToCanvas(fileUrl, body, {
      onLoaded: () => loading.remove(),
      onError: (err) => {
        loading.innerHTML = `<span>TGA 加载失败：${escapeHtml(err)}</span>`;
      },
    });
  } else if (asset.type === 'audio' && WEB_AUDIO_EXTENSIONS.has(asset.extension)) {
    loading.remove();
    body.innerHTML = `
      <div class="audio-preview">
        <div class="audio-icon">🔊</div>
        <div class="audio-name">${escapeHtml(asset.name)}</div>
        <audio id="audioPlayer" controls autoplay src="${fileUrl}"></audio>
      </div>
    `;
  } else if (asset.type === 'model' && MODEL_EXTENSIONS_3D.has(asset.extension)) {
    const expCtrl = document.getElementById('exposureControl')!;
    expCtrl.style.display = 'flex';
    const expSlider = document.getElementById('exposureSlider') as HTMLInputElement;
    const expLabel = document.getElementById('exposureValue')!;
    expSlider.addEventListener('input', () => {
      const v = parseFloat(expSlider.value);
      setExposure(v);
      expLabel.textContent = v.toFixed(1);
    });

    init3DPreview(body, fileUrl, asset.extension, {
      onLoaded: () => {
        loading.remove();
        expSlider.value = String(getExposure());
        expLabel.textContent = getExposure().toFixed(1);
      },
      onLoadError: (err) => {
        loading.innerHTML = `<span>模型加载失败：${escapeHtml(err)}</span>`;
      },
      onAnimationsFound: (clips) => {
        if (clips.length <= 1) return;
        const listDiv = document.createElement('div');
        listDiv.className = 'anim-list';
        clips.forEach((clip, i) => {
          const btn = document.createElement('button');
          btn.className = `anim-btn${i === 0 ? ' active' : ''}`;
          btn.textContent = clip.name || `动画 ${i + 1}`;
          btn.dataset.index = String(i);
          listDiv.appendChild(btn);
        });
        body.appendChild(listDiv);
      },
      onMaterialsInfo: (info) => renderMaterialPanel(info),
    });
  } else {
    loading.innerHTML = `
      <span style="font-size:48px">${meta.icon}</span>
      <span>该格式暂不支持预览</span>
      <span style="color:var(--text-muted)">${asset.extension}</span>
    `;
  }
}

function renderMaterialPanel(info: MaterialInfo) {
  const panel = document.getElementById('materialPanel');
  if (!panel) return;
  panel.style.display = 'block';

  const mats = info.materials;
  const hasTextures = mats.some((m) => m.mapNames.length > 0);
  const allDefault = mats.every((m) => m.mapNames.length === 0 && m.name === '(unnamed)');
  const hasEmissiveLeaks = mats.some((m) => m.emissive !== '#000000');

  let statusHtml: string;
  if (allDefault) {
    statusHtml = `<span class="mat-status mat-warn">⚠ 使用默认材质</span>`;
  } else if (hasEmissiveLeaks) {
    statusHtml = `<span class="mat-status mat-partial">⚠ 存在自发光 — 灯光效果可能不明显</span>`;
  } else if (!hasTextures) {
    statusHtml = `<span class="mat-status mat-partial">⚠ 材质已加载但无贴图</span>`;
  } else {
    statusHtml = `<span class="mat-status mat-ok">✓ 材质正常 · 灯光已生效</span>`;
  }

  const matListHtml = mats
    .map((m) => {
      const maps = m.mapNames.length > 0
        ? m.mapNames.map((n) => `<span class="mat-map-tag">${n}</span>`).join('')
        : '<span class="mat-map-none">无贴图</span>';
      const emissiveTag = m.emissive !== '#000000'
        ? `<span class="mat-map-tag" style="background:rgba(248,81,73,0.15);color:var(--danger);">emissive:${m.emissive}</span>`
        : '';
      return `
        <div class="mat-item">
          <span class="mat-color" style="background:${m.color};"></span>
          <span class="mat-name">${escapeHtml(m.name)}</span>
          <span class="mat-type">${m.type}</span>
          <div class="mat-maps">${maps}${emissiveTag}</div>
        </div>`;
    })
    .join('');

  panel.innerHTML = `
    <div class="mat-header">
      <span>材质诊断  ·  ${info.meshCount} Mesh · ${mats.length} 材质</span>
      ${statusHtml}
    </div>
    <div class="mat-list">${matListHtml}</div>
  `;
}

function closePreview() {
  cleanup3DPreview();
  const audio = document.getElementById('audioPlayer') as HTMLAudioElement | null;
  if (audio) {
    audio.pause();
    audio.src = '';
  }
  const root = document.getElementById('previewRoot')!;
  root.innerHTML = '';
}

// ─── Events ──────────────────────────────────────────

function setupEventListeners() {
  const app = document.getElementById('app')!;

  app.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    if (target.closest('#scanBtn')) {
      doScan();
      return;
    }

    if (target.closest('#pathConfigToggle')) {
      togglePathConfig();
      return;
    }

    if (target.closest('#selectModeBtn')) {
      const active = toggleSelectMode();
      const btn = document.getElementById('selectModeBtn')!;
      btn.textContent = active ? '✕ 退出多选' : '☐ 多选';
      btn.classList.toggle('active', active);
      updateGrid();
      updateExportBar();
      return;
    }

    if (target.closest('#selectAllBtn')) {
      const filtered = state.viewMode === 'favorites' ? getFavoritedAssets() : getFilteredAssets();
      selectAll(filtered);
      updateGrid();
      updateExportBar();
      return;
    }

    const checkbox = target.closest('.asset-checkbox') as HTMLElement | null;
    if (checkbox) {
      const p = checkbox.dataset.selectPath!;
      toggleSelect(p);
      updateGrid();
      updateExportBar();
      return;
    }

    // View mode toggle
    const viewTab = target.closest('.view-tab') as HTMLElement | null;
    if (viewTab) {
      const mode = viewTab.dataset.view as 'browse' | 'favorites' | 'download';
      if (mode !== state.viewMode) {
        state.viewMode = mode;
        state.searchQuery = '';
        document.querySelectorAll('.view-tab').forEach((t) => t.classList.remove('active'));
        viewTab.classList.add('active');
        updateViewVisibility();
        if (mode !== 'download') {
          updateSidebar();
          updateGrid();
        } else {
          showDownloaderPanel();
        }
      }
      return;
    }

    const removeBtn = target.closest('.path-tag-remove') as HTMLElement | null;
    if (removeBtn) {
      const type = removeBtn.dataset.type as AssetType;
      const index = parseInt(removeBtn.dataset.index || '0', 10);
      removePathFilter(type, index);
      return;
    }

    // Star toggle (must be checked before card click)
    const starBtn = target.closest('.fav-star') as HTMLElement | null;
    if (starBtn) {
      toggleFavorite(starBtn.dataset.path!);
      return;
    }

    // Move to folder button
    const moveBtn = target.closest('.fav-move-btn') as HTMLElement | null;
    if (moveBtn) {
      showMoveDialog(moveBtn.dataset.path!);
      return;
    }

    const card = target.closest('.asset-card') as HTMLElement | null;
    if (card) {
      const assetPath = card.dataset.path!;
      if (isSelectMode()) {
        toggleSelect(assetPath);
        updateGrid();
        updateExportBar();
        return;
      }
      const asset = state.assets.find((a) => a.relativePath === assetPath);
      if (asset) openPreview(asset);
      return;
    }

    // Favorites sidebar interactions
    const favTreeItem = target.closest('.fav-tree-item') as HTMLElement | null;
    const favRenameBtn = target.closest('.fav-rename-btn') as HTMLElement | null;
    const favDeleteBtn = target.closest('.fav-delete-btn') as HTMLElement | null;

    if (favRenameBtn) {
      const fid = favRenameBtn.dataset.folderId!;
      const folder = state.favorites.folders.find((f) => f.id === fid);
      if (folder) showRenameDialog(folder);
      return;
    }

    if (favDeleteBtn) {
      const fid = favDeleteBtn.dataset.folderId!;
      const folder = state.favorites.folders.find((f) => f.id === fid);
      if (folder && confirm(`确定删除文件夹「${folder.name}」？\n其中的收藏将移到上级目录。`)) {
        deleteFavFolder(fid);
        if (state.selectedFavFolderId === fid) state.selectedFavFolderId = null;
        updateSidebar();
        updateGrid();
      }
      return;
    }

    if (target.closest('#newFavFolderBtn')) {
      showCreateFolderDialog();
      return;
    }

    if (favTreeItem) {
      const fid = favTreeItem.dataset.favFolder!;
      state.selectedFavFolderId = fid === '__all__' ? null : fid;
      updateSidebar();
      updateGrid();
      return;
    }

    const folderItem = target.closest('.folder-item') as HTMLElement | null;
    if (folderItem) {
      state.selectedFolder = folderItem.dataset.folder || '';
      updateSidebar();
      updateGrid();
      return;
    }
  });

  let searchDebounce: ReturnType<typeof setTimeout>;
  app.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.id === 'searchInput') {
      state.searchQuery = target.value;
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => updateGrid(), 200);
    }
  });

  app.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;

    if (target.classList.contains('type-checkbox')) {
      const type = target.dataset.type as AssetType;
      if (target.checked) {
        state.typeFilters.add(type);
      } else {
        state.typeFilters.delete(type);
      }
      updateGrid();
      return;
    }

    if (target.id === 'sortSelect') {
      state.sortBy = (target as unknown as HTMLSelectElement).value as AppState['sortBy'];
      updateGrid();
      return;
    }
  });

  app.addEventListener('keydown', (e) => {
    const target = e.target as HTMLInputElement;
    if (e.key === 'Enter' && target.id === 'pathInput') {
      doScan();
      return;
    }
    if (e.key === 'Enter' && target.classList.contains('path-sub-input')) {
      const type = target.dataset.type as AssetType;
      addPathFilter(type, target.value);
      target.value = '';
    }
  });

  // Right-click context menu for browse/favorites cards
  app.addEventListener('contextmenu', (e) => {
    if (state.viewMode === 'download') return;
    const target = e.target as HTMLElement;
    const card = target.closest('.asset-card') as HTMLElement | null;
    if (!card) return;

    e.preventDefault();
    const assetPath = card.dataset.path!;
    const asset = state.assets.find((a) => a.relativePath === assetPath);
    if (!asset) return;

    const starred = isFavorited(assetPath);
    const selected = isSelected(assetPath);

    showContextMenu(e.clientX, e.clientY, [
      { icon: '👁', label: '预览', onClick: () => openPreview(asset) },
      {
        icon: starred ? '★' : '☆',
        label: starred ? '取消收藏' : '添加收藏',
        onClick: () => toggleFavorite(assetPath),
      },
      {
        icon: selected ? '☑' : '☐',
        label: selected ? '取消选中' : '选中导出',
        onClick: () => {
          if (!isSelectMode()) {
            toggleSelectMode();
            const btn = document.getElementById('selectModeBtn')!;
            btn.textContent = '✕ 退出多选';
            btn.classList.add('active');
          }
          toggleSelect(assetPath);
          updateGrid();
          updateExportBar();
        },
      },
    ]);
  });

  // Preview overlay events (delegated on document for the overlay)
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    if (target.id === 'closePreview' || target.id === 'previewOverlay') {
      closePreview();
      return;
    }

    const animBtn = target.closest('.anim-btn') as HTMLElement | null;
    if (animBtn) {
      const index = parseInt(animBtn.dataset.index || '0', 10);
      playAnimation(index);
      document.querySelectorAll('.anim-btn').forEach((b) => b.classList.remove('active'));
      animBtn.classList.add('active');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePreview();
  });
}

// ─── Favorites Dialogs ───────────────────────────────

function showFavDialog(title: string, content: string): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'fav-dialog-overlay';
  overlay.innerHTML = `
    <div class="fav-dialog">
      <div class="fav-dialog-title">${title}</div>
      ${content}
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  return overlay;
}

function showCreateFolderDialog() {
  const parentOptions = [
    '<option value="__root__">根目录</option>',
    ...state.favorites.folders.map(
      (f) => `<option value="${f.id}">${escapeHtml(f.name)}</option>`,
    ),
  ].join('');

  const overlay = showFavDialog(
    '新建收藏文件夹',
    `
    <input type="text" class="fav-dialog-input" id="favNewFolderName" placeholder="文件夹名称" autofocus />
    <div class="fav-dialog-field">
      <label>父目录</label>
      <select class="fav-dialog-select" id="favNewFolderParent">${parentOptions}</select>
    </div>
    <div class="fav-dialog-actions">
      <button class="btn btn-secondary" id="favDialogCancel">取消</button>
      <button class="btn" id="favDialogConfirm">确定</button>
    </div>
  `,
  );

  const nameInput = overlay.querySelector('#favNewFolderName') as HTMLInputElement;
  nameInput.focus();

  overlay.querySelector('#favDialogCancel')!.addEventListener('click', () => overlay.remove());
  overlay.querySelector('#favDialogConfirm')!.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) return;
    const parentSelect = overlay.querySelector('#favNewFolderParent') as HTMLSelectElement;
    const parentId = parentSelect.value === '__root__' ? null : parentSelect.value;
    addFavFolder(name, parentId);
    overlay.remove();
    updateSidebar();
  });

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      (overlay.querySelector('#favDialogConfirm') as HTMLElement).click();
    }
  });
}

function showRenameDialog(folder: { id: string; name: string }) {
  const overlay = showFavDialog(
    '重命名文件夹',
    `
    <input type="text" class="fav-dialog-input" id="favRenameName" value="${escapeHtml(folder.name)}" autofocus />
    <div class="fav-dialog-actions">
      <button class="btn btn-secondary" id="favDialogCancel">取消</button>
      <button class="btn" id="favDialogConfirm">确定</button>
    </div>
  `,
  );

  const nameInput = overlay.querySelector('#favRenameName') as HTMLInputElement;
  nameInput.focus();
  nameInput.select();

  overlay.querySelector('#favDialogCancel')!.addEventListener('click', () => overlay.remove());
  overlay.querySelector('#favDialogConfirm')!.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) return;
    renameFavFolder(folder.id, name);
    overlay.remove();
    updateSidebar();
  });

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      (overlay.querySelector('#favDialogConfirm') as HTMLElement).click();
    }
  });
}

function showMoveDialog(assetPath: string) {
  const currentItem = state.favorites.items.find((i) => i.assetPath === assetPath);
  const currentFolderId = currentItem?.folderId ?? null;

  function folderOptionHtml(
    folderId: string | null,
    label: string,
    depth: number,
  ): string {
    const isActive = currentFolderId === folderId;
    const indent = depth * 16;
    const fid = folderId === null ? '__root__' : folderId;
    return `<div class="fav-move-item${isActive ? ' current' : ''}" data-target-folder="${fid}" style="padding-left:${indent + 12}px">${label}</div>`;
  }

  function buildMoveTree(parentId: string | null, depth: number): string {
    return state.favorites.folders
      .filter((f) => f.parentId === parentId)
      .map(
        (f) =>
          folderOptionHtml(f.id, `📁 ${escapeHtml(f.name)}`, depth) +
          buildMoveTree(f.id, depth + 1),
      )
      .join('');
  }

  const listHtml =
    folderOptionHtml(null, '📂 未分类', 0) + buildMoveTree(null, 0);

  const overlay = showFavDialog(
    '移动到文件夹',
    `
    <div class="fav-move-list">${listHtml}</div>
    <div class="fav-dialog-actions">
      <button class="btn btn-secondary" id="favDialogCancel">取消</button>
    </div>
  `,
  );

  overlay.querySelector('#favDialogCancel')!.addEventListener('click', () => overlay.remove());
  overlay.querySelectorAll('.fav-move-item').forEach((el) => {
    el.addEventListener('click', () => {
      const targetId = (el as HTMLElement).dataset.targetFolder!;
      moveFavItem(assetPath, targetId === '__root__' ? null : targetId);
      overlay.remove();
      updateSidebar();
      updateGrid();
    });
  });
}

// ─── Path Config ─────────────────────────────────────

function togglePathConfig() {
  state.showPathConfig = !state.showPathConfig;
  const panel = document.getElementById('pathConfigPanel')!;
  const toggle = document.getElementById('pathConfigToggle')!;
  panel.style.display = state.showPathConfig ? 'block' : 'none';
  toggle.textContent = state.showPathConfig ? '路径配置 ▾' : '路径配置 ▸';
  if (state.showPathConfig) renderPathConfig();
}

function renderPathConfig() {
  const panel = document.getElementById('pathConfigPanel');
  if (!panel) return;

  const rows = FILTERABLE_TYPES.map((type) => {
    const meta = TYPE_META[type];
    const paths = state.pathFilters[type] || [];
    const tagsHtml = paths
      .map(
        (p, i) =>
          `<span class="path-tag" data-type="${type}" data-index="${i}">${escapeHtml(p)}<button class="path-tag-remove" data-type="${type}" data-index="${i}">×</button></span>`,
      )
      .join('');

    return `
      <div class="path-row">
        <span class="path-type-label" style="color:${meta.color}">${meta.icon} ${meta.label}</span>
        <div class="path-tags-wrap">
          <div class="path-tags">${tagsHtml}</div>
          <div class="path-input-wrap">
            <input type="text" class="path-sub-input" data-type="${type}"
                   placeholder="子路径，如 Art/Textures，回车添加" />
          </div>
        </div>
      </div>`;
  }).join('');

  panel.innerHTML = `
    <div class="path-config-hint">为各类型指定扫描子路径，留空则扫描整个工程</div>
    ${rows}
  `;
}

function addPathFilter(type: AssetType, subPath: string) {
  let trimmed = subPath.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  trimmed = trimmed.replace(/^Assets\//i, '');
  if (!trimmed) return;
  if (!state.pathFilters[type]) state.pathFilters[type] = [];
  if (state.pathFilters[type]!.includes(trimmed)) return;
  state.pathFilters[type]!.push(trimmed);
  savePathFilters();
  renderPathConfig();
}

function removePathFilter(type: AssetType, index: number) {
  const arr = state.pathFilters[type];
  if (!arr) return;
  arr.splice(index, 1);
  if (arr.length === 0) delete state.pathFilters[type];
  savePathFilters();
  renderPathConfig();
}

// ─── Utils ───────────────────────────────────────────

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Export Bar ──────────────────────────────────────

function updateExportBar() {
  const app = document.getElementById('app')!;
  renderExportBar(app, state.assets, () => {
    showExportPanel(state.assets, () => {
      updateGrid();
      updateExportBar();
    });
  });
}

document.addEventListener('export-selection-changed', () => {
  updateGrid();
  updateExportBar();
});

// ─── Init ────────────────────────────────────────────

initLayout();
