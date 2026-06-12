import type { AssetInfo, ExportConfig, ExportPreset, ExportRecord, ExportStatus } from './types';
import { DEFAULT_EXPORT_CONFIG } from './types';

const API = import.meta.env.BASE_URL.replace(/\/$/, '');

// ─── State ────────────────────────────────────────────

let selectMode = false;
const selectedAssets = new Set<string>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let activeTaskId: string | null = null;

// ─── Selection API ────────────────────────────────────

export function isSelectMode(): boolean {
  return selectMode;
}

export function toggleSelectMode(): boolean {
  selectMode = !selectMode;
  if (!selectMode) selectedAssets.clear();
  return selectMode;
}

export function toggleSelect(assetPath: string) {
  if (selectedAssets.has(assetPath)) selectedAssets.delete(assetPath);
  else selectedAssets.add(assetPath);
}

export function isSelected(assetPath: string): boolean {
  return selectedAssets.has(assetPath);
}

export function selectAll(assets: AssetInfo[]) {
  for (const a of assets) selectedAssets.add(a.relativePath);
}

export function clearSelection() {
  selectedAssets.clear();
}

export function getSelectedCount(): number {
  return selectedAssets.size;
}

export function getSelectedPaths(): string[] {
  return Array.from(selectedAssets);
}

// ─── Presets ──────────────────────────────────────────

const PRESET_KEY = 'uab_exportPresets';
const HISTORY_KEY = 'uab_exportHistory';
const MAX_RECORDS = 20;

export function loadPresets(): ExportPreset[] {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePreset(name: string, config: ExportConfig) {
  const presets = loadPresets();
  presets.unshift({
    id: 'pre_' + Date.now(),
    name,
    config: { ...config },
    createdAt: Date.now(),
  });
  if (presets.length > MAX_RECORDS) presets.length = MAX_RECORDS;
  localStorage.setItem(PRESET_KEY, JSON.stringify(presets));
}

export function deletePreset(id: string) {
  const presets = loadPresets().filter((p) => p.id !== id);
  localStorage.setItem(PRESET_KEY, JSON.stringify(presets));
}

// ─── History ──────────────────────────────────────────

export function getExportHistory(): ExportRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addExportRecord(record: ExportRecord) {
  const history = getExportHistory();
  history.unshift(record);
  if (history.length > MAX_RECORDS) history.length = MAX_RECORDS;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

// ─── Export API ───────────────────────────────────────

export async function startExport(
  config: ExportConfig,
  onProgress: (status: ExportStatus) => void,
  onComplete: (status: ExportStatus) => void,
) {
  const assets = getSelectedPaths();
  if (assets.length === 0) return;

  try {
    const res = await fetch(`${API}/api/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assets, config }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '导出启动失败');

    activeTaskId = data.taskId;
    startPolling(data.taskId, onProgress, onComplete);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    onComplete({
      taskId: '',
      current: 0,
      total: assets.length,
      currentFile: '',
      status: 'failed',
      results: [],
      error: msg,
    });
  }
}

function startPolling(
  taskId: string,
  onProgress: (s: ExportStatus) => void,
  onComplete: (s: ExportStatus) => void,
) {
  stopPolling();
  pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`${API}/api/export-status?taskId=${encodeURIComponent(taskId)}`);
      const status: ExportStatus = await res.json();
      onProgress(status);

      if (status.status !== 'running') {
        stopPolling();
        activeTaskId = null;

        addExportRecord({
          id: 'rec_' + Date.now(),
          timestamp: Date.now(),
          assetCount: status.total,
          successCount: status.results.filter((r) => r.success).length,
          failCount: status.results.filter((r) => !r.success).length,
          outputDir: '',
          totalInputSize: status.results.reduce((s, r) => s + r.inputSize, 0),
          totalOutputSize: status.results.reduce((s, r) => s + r.outputSize, 0),
        });

        onComplete(status);
      }
    } catch {
      // network error, keep polling
    }
  }, 1000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export async function cancelExport() {
  if (!activeTaskId) return;
  try {
    await fetch(`${API}/api/export-cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: activeTaskId }),
    });
  } catch {
    // ignore
  }
}

// ─── UI Components ────────────────────────────────────

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function renderExportBar(container: HTMLElement, allAssets: AssetInfo[], onExportClick: () => void) {
  let bar = document.getElementById('exportBar');
  if (!selectMode || selectedAssets.size === 0) {
    bar?.remove();
    return;
  }

  const totalSize = allAssets
    .filter((a) => selectedAssets.has(a.relativePath))
    .reduce((s, a) => s + a.size, 0);

  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'exportBar';
    bar.className = 'export-bar';
    container.appendChild(bar);
  }

  bar.innerHTML = `
    <div class="export-bar-info">
      <span class="export-bar-count">已选 <strong>${selectedAssets.size}</strong> 个资源</span>
      <span class="export-bar-size">${formatSize(totalSize)}</span>
    </div>
    <div class="export-bar-actions">
      <button class="btn btn-secondary" id="exportClearBtn">取消选择</button>
      <button class="btn" id="exportStartBtn">导出选中资源</button>
    </div>
  `;

  bar.querySelector('#exportClearBtn')!.addEventListener('click', () => {
    clearSelection();
    renderExportBar(container, allAssets, onExportClick);
    document.dispatchEvent(new CustomEvent('export-selection-changed'));
  });

  bar.querySelector('#exportStartBtn')!.addEventListener('click', onExportClick);
}

export function showExportPanel(
  allAssets: AssetInfo[],
  onDone: () => void,
) {
  const existing = document.getElementById('exportPanelOverlay');
  existing?.remove();

  const presets = loadPresets();
  const config: ExportConfig = { ...DEFAULT_EXPORT_CONFIG };
  const lastOutputDir = localStorage.getItem('uab_lastExportDir') || '';
  config.outputDir = lastOutputDir;

  const presetOptions = presets.length
    ? presets.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')
    : '';

  const overlay = document.createElement('div');
  overlay.id = 'exportPanelOverlay';
  overlay.className = 'export-overlay';
  overlay.innerHTML = `
    <div class="export-panel">
      <div class="export-panel-header">
        <h2>导出配置</h2>
        <span class="export-panel-count">${selectedAssets.size} 个资源</span>
        <button class="preview-close" id="exportPanelClose">✕</button>
      </div>
      <div class="export-panel-body">
        ${presets.length ? `
        <div class="export-field">
          <label>预设</label>
          <div class="export-field-row">
            <select id="exportPresetSelect" class="export-select">
              <option value="">-- 自定义 --</option>
              ${presetOptions}
            </select>
            <button class="btn-icon export-preset-del" id="deletePresetBtn" title="删除预设" style="display:none">✕</button>
          </div>
        </div>` : ''}
        <div class="export-field">
          <label>输出目录</label>
          <input type="text" id="exportOutputDir" class="export-input"
                 placeholder="例如 D:\\output\\webgl-assets" value="${escapeHtml(config.outputDir)}" />
        </div>
        <div class="export-field-group">
          <div class="export-field">
            <label>贴图格式</label>
            <select id="exportImgFormat" class="export-select">
              <option value="png"${config.imageFormat === 'png' ? ' selected' : ''}>PNG</option>
              <option value="webp"${config.imageFormat === 'webp' ? ' selected' : ''}>WebP</option>
            </select>
          </div>
          <div class="export-field">
            <label>质量 <span id="exportQualityVal">${config.imageQuality}</span></label>
            <input type="range" id="exportImgQuality" min="10" max="100" step="5" value="${config.imageQuality}" />
          </div>
          <div class="export-field">
            <label>最大尺寸</label>
            <select id="exportMaxSize" class="export-select">
              <option value="0">原始</option>
              <option value="512">512</option>
              <option value="1024">1024</option>
              <option value="2048"${config.maxTextureSize === 2048 ? ' selected' : ''}>2048</option>
              <option value="4096">4096</option>
            </select>
          </div>
        </div>
        <div class="export-field-group">
          <div class="export-field">
            <label>模型格式</label>
            <select id="exportModelFormat" class="export-select">
              <option value="glb"${config.modelFormat === 'glb' ? ' selected' : ''}>GLB</option>
              <option value="gltf"${config.modelFormat === 'gltf' ? ' selected' : ''}>glTF</option>
            </select>
          </div>
          <div class="export-field">
            <label class="export-checkbox-label">
              <input type="checkbox" id="exportEmbedTex" ${config.embedTextures ? 'checked' : ''} />
              嵌入贴图
            </label>
          </div>
          <div class="export-field">
            <label class="export-checkbox-label">
              <input type="checkbox" id="exportManifest" ${config.generateManifest ? 'checked' : ''} />
              生成 manifest
            </label>
          </div>
        </div>
        <div id="exportProgress" class="export-progress" style="display:none;">
          <div class="export-progress-header">
            <span id="exportProgressLabel">准备中...</span>
            <span id="exportProgressPercent">0%</span>
          </div>
          <div class="export-progress-bar-bg">
            <div class="export-progress-bar-fill" id="exportProgressBar" style="width:0%"></div>
          </div>
          <div class="export-progress-file" id="exportProgressFile"></div>
        </div>
        <div id="exportResult" class="export-result" style="display:none;"></div>
      </div>
      <div class="export-panel-footer">
        <button class="btn btn-secondary" id="exportSavePresetBtn">保存为预设</button>
        <div class="export-panel-footer-right">
          <button class="btn btn-secondary" id="exportCancelBtn">取消</button>
          <button class="btn" id="exportGoBtn">开始导出</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Wire events
  const closePanel = () => { overlay.remove(); onDone(); };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closePanel(); });
  overlay.querySelector('#exportPanelClose')!.addEventListener('click', closePanel);
  overlay.querySelector('#exportCancelBtn')!.addEventListener('click', closePanel);

  const qualitySlider = overlay.querySelector('#exportImgQuality') as HTMLInputElement;
  const qualityLabel = overlay.querySelector('#exportQualityVal')!;
  qualitySlider.addEventListener('input', () => { qualityLabel.textContent = qualitySlider.value; });

  // Preset selection
  const presetSelect = overlay.querySelector('#exportPresetSelect') as HTMLSelectElement | null;
  const deletePresetBtn = overlay.querySelector('#deletePresetBtn') as HTMLElement | null;
  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      const pid = presetSelect.value;
      if (deletePresetBtn) deletePresetBtn.style.display = pid ? 'flex' : 'none';
      if (!pid) return;
      const preset = presets.find((p) => p.id === pid);
      if (!preset) return;
      fillForm(overlay, preset.config);
    });
    if (deletePresetBtn) {
      deletePresetBtn.addEventListener('click', () => {
        const pid = presetSelect.value;
        if (!pid) return;
        deletePreset(pid);
        presetSelect.querySelector(`option[value="${pid}"]`)?.remove();
        presetSelect.value = '';
        deletePresetBtn.style.display = 'none';
      });
    }
  }

  // Save preset
  overlay.querySelector('#exportSavePresetBtn')!.addEventListener('click', () => {
    const name = prompt('预设名称：');
    if (!name?.trim()) return;
    savePreset(name.trim(), readFormConfig(overlay));
    alert('预设已保存');
  });

  // Start export
  overlay.querySelector('#exportGoBtn')!.addEventListener('click', () => {
    const cfg = readFormConfig(overlay);
    if (!cfg.outputDir.trim()) {
      alert('请填写输出目录');
      return;
    }
    localStorage.setItem('uab_lastExportDir', cfg.outputDir);

    const progressDiv = overlay.querySelector('#exportProgress') as HTMLElement;
    const resultDiv = overlay.querySelector('#exportResult') as HTMLElement;
    const goBtn = overlay.querySelector('#exportGoBtn') as HTMLButtonElement;
    const cancelBtn = overlay.querySelector('#exportCancelBtn') as HTMLButtonElement;

    progressDiv.style.display = 'block';
    resultDiv.style.display = 'none';
    goBtn.disabled = true;
    goBtn.textContent = '导出中...';
    cancelBtn.textContent = '取消导出';
    cancelBtn.onclick = () => { cancelExport(); };

    startExport(
      cfg,
      (status) => {
        const pct = status.total > 0 ? Math.round((status.current / status.total) * 100) : 0;
        (overlay.querySelector('#exportProgressLabel') as HTMLElement).textContent =
          `${status.current} / ${status.total}`;
        (overlay.querySelector('#exportProgressPercent') as HTMLElement).textContent = `${pct}%`;
        (overlay.querySelector('#exportProgressBar') as HTMLElement).style.width = `${pct}%`;
        (overlay.querySelector('#exportProgressFile') as HTMLElement).textContent =
          status.currentFile || '';
      },
      (status) => {
        progressDiv.style.display = 'none';
        goBtn.disabled = false;
        goBtn.textContent = '开始导出';
        cancelBtn.textContent = '关闭';
        cancelBtn.onclick = () => closePanel();

        const success = status.results.filter((r) => r.success).length;
        const fail = status.results.filter((r) => !r.success).length;
        const totalIn = status.results.reduce((s, r) => s + r.inputSize, 0);
        const totalOut = status.results.reduce((s, r) => s + r.outputSize, 0);

        let statusClass = 'export-result-ok';
        let statusIcon = '✓';
        if (status.status === 'failed') { statusClass = 'export-result-fail'; statusIcon = '✕'; }
        else if (status.status === 'cancelled') { statusClass = 'export-result-warn'; statusIcon = '⚠'; }
        else if (fail > 0) { statusClass = 'export-result-warn'; statusIcon = '⚠'; }

        const failList = status.results
          .filter((r) => !r.success)
          .map((r) => `<div class="export-fail-item">${escapeHtml(r.inputPath)}: ${escapeHtml(r.error || '未知错误')}</div>`)
          .join('');

        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
          <div class="export-result-header ${statusClass}">
            <span>${statusIcon} ${status.status === 'completed' ? '导出完成' : status.status === 'cancelled' ? '已取消' : '导出失败'}</span>
          </div>
          <div class="export-result-stats">
            <span>成功 ${success}</span>
            <span>失败 ${fail}</span>
            <span>输入 ${formatSize(totalIn)}</span>
            <span>输出 ${formatSize(totalOut)}</span>
          </div>
          ${failList ? `<div class="export-fail-list">${failList}</div>` : ''}
          ${status.error ? `<div class="export-error">${escapeHtml(status.error)}</div>` : ''}
        `;
      },
    );
  });
}

function readFormConfig(container: HTMLElement): ExportConfig {
  return {
    outputDir: (container.querySelector('#exportOutputDir') as HTMLInputElement).value.trim(),
    imageFormat: (container.querySelector('#exportImgFormat') as HTMLSelectElement).value as 'png' | 'webp',
    imageQuality: parseInt((container.querySelector('#exportImgQuality') as HTMLInputElement).value, 10),
    maxTextureSize: parseInt((container.querySelector('#exportMaxSize') as HTMLSelectElement).value, 10),
    modelFormat: (container.querySelector('#exportModelFormat') as HTMLSelectElement).value as 'gltf' | 'glb',
    embedTextures: (container.querySelector('#exportEmbedTex') as HTMLInputElement).checked,
    generateManifest: (container.querySelector('#exportManifest') as HTMLInputElement).checked,
    concurrency: DEFAULT_EXPORT_CONFIG.concurrency,
  };
}

function fillForm(container: HTMLElement, config: ExportConfig) {
  (container.querySelector('#exportOutputDir') as HTMLInputElement).value = config.outputDir;
  (container.querySelector('#exportImgFormat') as HTMLSelectElement).value = config.imageFormat;
  (container.querySelector('#exportImgQuality') as HTMLInputElement).value = String(config.imageQuality);
  const qualityLabel = container.querySelector('#exportQualityVal');
  if (qualityLabel) qualityLabel.textContent = String(config.imageQuality);
  (container.querySelector('#exportMaxSize') as HTMLSelectElement).value = String(config.maxTextureSize);
  (container.querySelector('#exportModelFormat') as HTMLSelectElement).value = config.modelFormat;
  (container.querySelector('#exportEmbedTex') as HTMLInputElement).checked = config.embedTextures;
  (container.querySelector('#exportManifest') as HTMLInputElement).checked = config.generateManifest;
}

export function dispose() {
  stopPolling();
}
