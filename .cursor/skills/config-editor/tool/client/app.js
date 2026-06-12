/* Config Editor — vanilla ES module client */

let schemas = [];
let configs = {};
let original = {};
let activeFile = null;
let activeTab = 'config';
let assets = [];
let activeAssetFilter = 'all';

// Model preview: cache FBX clip names by model path
const clipCache = new Map(); // modelPath → [{ name, duration }] | 'loading' | 'error'
let _modelPathRenderTimer = null;
let previewModule = null;
let previewAvailable = null; // null = unknown, true/false

// ── Asset type detection ──

const MODEL_EXTS = ['.glb', '.gltf', '.fbx', '.obj'];
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'];

function getAssetType(filePath) {
  if (!filePath) return null;
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  if (MODEL_EXTS.includes(ext)) return 'model';
  if (IMAGE_EXTS.includes(ext)) return 'image';
  return null;
}

// ── Utilities ──

function getByPath(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function setByPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => {
    if (o[k] === undefined || o[k] === null) o[k] = {};
    return o[k];
  }, obj);
  target[last] = value;
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function hexToInput(hex) {
  return '#' + String(hex).replace('0x', '');
}

function inputToHex(color) {
  return '0x' + color.replace('#', '');
}

function parseFieldValue(raw, field) {
  if (raw === '' && field.nullable) return null;
  if (field.type === 'int') return parseInt(raw, 10);
  if (field.type === 'float') return parseFloat(raw);
  return raw;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function detectAssetType(filePath) {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (IMAGE_EXTS.map(e => e.slice(1)).includes(ext)) return 'image';
  if (MODEL_EXTS.map(e => e.slice(1)).includes(ext)) return 'model';
  return null;
}

function assetFileUrl(filePath) {
  return `/__config/file/${encodeURIComponent(filePath)}`;
}

// ── Preview module ──

async function getPreviewModule() {
  if (!previewModule) {
    previewModule = await import('/__config/preview.js');
  }
  return previewModule;
}

async function checkPreviewAvailable() {
  if (previewAvailable !== null) return previewAvailable;
  try {
    const res = await fetch('/__config/api/preview-available');
    const data = await res.json();
    previewAvailable = data.available;
  } catch {
    previewAvailable = false;
  }
  return previewAvailable;
}

// ── Init ──

async function init() {
  const [s, c, a] = await Promise.all([
    fetch('/__config/api/schemas').then(r => r.json()),
    fetch('/__config/api/configs').then(r => r.json()),
    fetch('/__config/api/assets').then(r => r.json()).catch(() => []),
  ]);
  schemas = s;
  configs = c;
  original = deepClone(c);
  assets = a;

  checkPreviewAvailable();

  renderSidebar();
  if (schemas.length > 0) selectCategory(schemas[0].file);
  bindGlobalEvents();
}

// ── Sidebar ──

function renderSidebar() {
  const el = document.getElementById('sidebar');

  const configItems = schemas
    .map(
      s =>
        `<button class="sidebar-item" data-file="${s.file}">
          <span class="icon">${s.icon}</span>
          <span>${s.label}</span>
        </button>`,
    )
    .join('');

  const imgCount = assets.filter(a => a.type === 'image').length;
  const mdlCount = assets.filter(a => a.type === 'model').length;

  const assetItems = `
    <button class="sidebar-item active" data-asset-filter="all">
      <span class="icon">📂</span>
      <span>全部</span>
      <span class="badge">${assets.length}</span>
    </button>
    <button class="sidebar-item" data-asset-filter="image">
      <span class="icon">🖼️</span>
      <span>图片</span>
      <span class="badge">${imgCount}</span>
    </button>
    <button class="sidebar-item" data-asset-filter="model">
      <span class="icon">🧊</span>
      <span>模型</span>
      <span class="badge">${mdlCount}</span>
    </button>
  `;

  el.innerHTML = `
    <div class="sidebar-tabs">
      <button class="sidebar-tab active" data-tab="config">📝 配置</button>
      <button class="sidebar-tab" data-tab="assets">📁 资源</button>
    </div>
    <div id="sidebar-config">${configItems}</div>
    <div id="sidebar-assets" style="display:none">${assetItems}</div>
  `;

  el.querySelectorAll('.sidebar-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  document.getElementById('sidebar-config').addEventListener('click', e => {
    const btn = e.target.closest('.sidebar-item');
    if (btn?.dataset.file) selectCategory(btn.dataset.file);
  });

  document.getElementById('sidebar-assets').addEventListener('click', e => {
    const btn = e.target.closest('.sidebar-item');
    if (btn?.dataset.assetFilter) {
      activeAssetFilter = btn.dataset.assetFilter;
      document.querySelectorAll('#sidebar-assets .sidebar-item').forEach(b =>
        b.classList.toggle('active', b.dataset.assetFilter === activeAssetFilter),
      );
      renderAssetPanel();
    }
  });
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.sidebar-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab),
  );
  document.getElementById('sidebar-config').style.display = tab === 'config' ? '' : 'none';
  document.getElementById('sidebar-assets').style.display = tab === 'assets' ? '' : 'none';

  const topbarRight = document.querySelector('.topbar-right');
  if (tab === 'assets') {
    topbarRight.style.visibility = 'hidden';
    renderAssetPanel();
  } else {
    topbarRight.style.visibility = '';
    renderPanel();
  }
}

function selectCategory(file) {
  activeFile = file;
  document.querySelectorAll('#sidebar-config .sidebar-item').forEach(b =>
    b.classList.toggle('active', b.dataset.file === file),
  );
  if (activeTab === 'config') renderPanel();
}

function updateSidebarDots() {
  document.querySelectorAll('#sidebar-config .sidebar-item').forEach(btn => {
    const file = btn.dataset.file;
    const dirty = !deepEqual(configs[file], original[file]);
    let dot = btn.querySelector('.dot');
    if (dirty && !dot) {
      dot = document.createElement('span');
      dot.className = 'dot';
      btn.appendChild(dot);
    } else if (!dirty && dot) {
      dot.remove();
    }
  });
}

// ── Asset Panel ──

function renderAssetPanel() {
  const panel = document.getElementById('panel');
  const filtered = activeAssetFilter === 'all'
    ? assets
    : assets.filter(a => a.type === activeAssetFilter);

  if (filtered.length === 0) {
    const typeLabel = activeAssetFilter === 'image' ? '图片' : activeAssetFilter === 'model' ? '模型' : '';
    panel.innerHTML = `
      <div class="panel-header">
        <h2>📁 资源预览</h2>
        <div class="subtitle">项目资源文件</div>
      </div>
      <div class="panel-empty-hint">暂无${typeLabel}资源文件</div>
    `;
    return;
  }

  const items = filtered.map(asset => {
    const thumb = asset.type === 'image'
      ? `<img src="${assetFileUrl(asset.path)}" alt="${asset.name}" loading="lazy">`
      : `<div class="asset-model-icon">🧊</div>`;
    return `
      <div class="asset-card" data-asset-path="${asset.path}" data-asset-type="${asset.type}">
        <div class="asset-thumb">${thumb}</div>
        <div class="asset-info">
          <div class="asset-name" title="${asset.path}">${asset.name}</div>
          <div class="asset-meta">${formatFileSize(asset.size)}</div>
        </div>
      </div>`;
  }).join('');

  panel.innerHTML = `
    <div class="panel-header">
      <h2>📁 资源预览</h2>
      <div class="subtitle">共 ${filtered.length} 个资源文件</div>
    </div>
    <div class="asset-grid">${items}</div>
  `;

  panel.querySelectorAll('.asset-card').forEach(card => {
    card.addEventListener('click', () => {
      openAssetPreview(card.dataset.assetPath, card.dataset.assetType);
    });
  });
}

// ── Asset Preview Modal (image + model-viewer) ──

function openAssetPreview(assetPath, assetType) {
  const modal = document.getElementById('asset-modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  const info = document.getElementById('modal-info');

  const name = assetPath.split('/').pop();
  title.textContent = name;

  const asset = assets.find(a => a.path === assetPath);
  info.textContent = asset ? `${assetPath} · ${formatFileSize(asset.size)}` : assetPath;

  const fileUrl = assetFileUrl(assetPath);
  const type = assetType || detectAssetType(assetPath);

  if (type === 'image') {
    body.innerHTML = `<img src="${fileUrl}" alt="${name}" class="preview-image">`;
  } else if (type === 'model') {
    if (customElements.get('model-viewer')) {
      body.innerHTML = `
        <model-viewer
          src="${fileUrl}"
          alt="${name}"
          auto-rotate
          camera-controls
          shadow-intensity="1"
          class="preview-model"
        ></model-viewer>`;
    } else {
      body.innerHTML = `
        <div class="preview-fallback">
          <div class="preview-fallback-icon">🧊</div>
          <div class="preview-fallback-text">3D 模型预览需要网络加载 model-viewer 组件</div>
          <div class="preview-fallback-path">${assetPath}</div>
        </div>`;
    }
  } else {
    body.innerHTML = `<div class="preview-fallback"><div class="preview-fallback-text">不支持预览此文件类型</div></div>`;
  }

  modal.classList.remove('hidden');
}

function closeAssetPreview() {
  document.getElementById('asset-modal').classList.add('hidden');
  document.getElementById('modal-body').innerHTML = '';
}

// ── Three.js Model Preview Modal (for model_path fields) ──

function ensurePreviewModal() {
  if (document.getElementById('preview-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'preview-modal';
  modal.className = 'preview-modal hidden';
  modal.innerHTML = `
    <div class="preview-modal-backdrop"></div>
    <div class="preview-modal-content">
      <div class="preview-modal-header">
        <h3>模型预览</h3>
        <button class="preview-modal-close">✕</button>
      </div>
      <div id="preview-canvas-container" class="preview-canvas-container"></div>
      <div class="preview-status" id="preview-status"></div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('.preview-modal-backdrop').addEventListener('click', closeModelPreview);
  modal.querySelector('.preview-modal-close').addEventListener('click', closeModelPreview);
}

async function openModelPreview(fieldPath) {
  const scalePath = fieldPath.replace(/modelPath$/, 'modelScale');
  const rotPath = fieldPath.replace(/modelPath$/, 'modelRotationY');

  const pathValue = getByPath(configs[activeFile], fieldPath);
  const scaleValue = getByPath(configs[activeFile], scalePath) ?? 1;
  const rotValue = getByPath(configs[activeFile], rotPath) ?? 0;

  if (!pathValue) return;

  const type = getAssetType(pathValue);
  if (type === 'image') {
    openImageInPreviewModal(pathValue);
  } else {
    openThreeJsPreview(pathValue, scaleValue, rotValue);
  }
}

function openImageInPreviewModal(imagePath) {
  ensurePreviewModal();
  const modal = document.getElementById('preview-modal');
  const container = document.getElementById('preview-canvas-container');
  const status = document.getElementById('preview-status');
  const title = modal.querySelector('.preview-modal-header h3');

  title.textContent = '图片预览';
  modal.classList.remove('hidden');
  container.innerHTML = '';
  container.classList.add('preview-image-mode');
  status.textContent = '加载中...';

  const img = document.createElement('img');
  img.className = 'preview-image';
  img.src = imagePath;
  img.onload = () => {
    status.textContent = `${imagePath}  |  ${img.naturalWidth} × ${img.naturalHeight}`;
  };
  img.onerror = () => {
    status.textContent = '加载失败: ' + imagePath;
  };
  container.appendChild(img);
}

async function openThreeJsPreview(modelPath, scale, rotation) {
  ensurePreviewModal();
  const modal = document.getElementById('preview-modal');
  const container = document.getElementById('preview-canvas-container');
  const status = document.getElementById('preview-status');
  const title = modal.querySelector('.preview-modal-header h3');

  title.textContent = '模型预览';
  modal.classList.remove('hidden');
  container.innerHTML = '';
  container.classList.remove('preview-image-mode');
  status.textContent = '加载中...';

  try {
    const mod = await getPreviewModule();
    mod.initPreview(container, modelPath, scale, rotation, {
      onLoaded: () => {
        status.textContent = `${modelPath}  |  缩放: ${scale}  |  旋转: ${rotation}°`;
      },
      onLoadError: (err) => {
        status.textContent = '加载失败: ' + err;
      },
    });
  } catch (err) {
    status.textContent = '预览模块加载失败: ' + err.message;
    console.error('Preview module error:', err);
  }
}

function closeModelPreview() {
  const modal = document.getElementById('preview-modal');
  if (!modal || modal.classList.contains('hidden')) return;
  modal.classList.add('hidden');

  const container = document.getElementById('preview-canvas-container');
  if (container?.classList.contains('preview-image-mode')) {
    container.classList.remove('preview-image-mode');
    container.innerHTML = '';
  } else {
    getPreviewModule().then((mod) => mod.cleanup()).catch(() => {});
  }
}

// ── Anim clip helpers ──

function getModelPathForAnimField(fieldPath) {
  const parts = fieldPath.split('.');
  parts[parts.length - 1] = 'modelPath';
  return parts.join('.');
}

async function loadAndCacheClips(modelPath) {
  if (clipCache.has(modelPath)) return;
  clipCache.set(modelPath, 'loading');
  try {
    const mod = await getPreviewModule();
    const clips = await mod.extractClipNames(modelPath);
    clipCache.set(modelPath, clips);
  } catch (e) {
    console.error('[anim_clip] Failed to load clips from', modelPath, e);
    clipCache.set(modelPath, 'error');
  }
  renderPanel();
}

// ── Config Panel ──

function renderPanel() {
  if (activeTab === 'assets') {
    renderAssetPanel();
    return;
  }

  const schema = schemas.find(s => s.file === activeFile);
  const data = configs[activeFile];
  if (!schema || !data) return;

  const focused = document.activeElement;
  const focusPath = focused?.dataset?.path;
  const focusType = focused?.type;
  const selStart = focused?.selectionStart;
  const selEnd = focused?.selectionEnd;

  const panel = document.getElementById('panel');
  panel.innerHTML = `
    <div class="panel-header">
      <h2>${schema.icon} ${schema.label}</h2>
      <div class="subtitle">${schema.file}</div>
    </div>
    <div id="fields">${renderFields(schema.fields, data)}</div>
  `;
  bindFieldEvents();

  if (focusPath) {
    const selector = focusType
      ? `input[type="${focusType}"][data-path="${focusPath}"], select[data-path="${focusPath}"]`
      : `[data-path="${focusPath}"]`;
    const el = panel.querySelector(selector);
    if (el) {
      el.focus();
      if (typeof selStart === 'number' && el.setSelectionRange) {
        try { el.setSelectionRange(selStart, selEnd); } catch (_) {}
      }
    }
  }
}

function renderFields(fields, data) {
  return fields.map(f => {
    if (f.type === 'group') return renderGroup(f, data);
    if (f.type === 'array') return renderArray(f, data);
    return renderField(f, getByPath(data, f.path));
  }).join('');
}

// ── Group ──

function renderGroup(group, data) {
  return `
    <div class="field-group">
      <div class="field-group-header">
        <span class="chevron">▼</span>
        ${group.label}
      </div>
      <div class="field-group-body">
        ${renderFields(group.fields, data)}
      </div>
    </div>`;
}

// ── Individual fields ──

function renderField(field, value) {
  const orig = getByPath(original[activeFile], field.path);
  const changed = !deepEqual(value, orig);
  const cls = changed ? 'field changed' : 'field';

  switch (field.type) {
    case 'int':
    case 'float':
      return renderNumber(field, value, cls);
    case 'color':
      return renderColor(field, value, cls);
    case 'string':
      return renderString(field, value, cls);
    case 'select':
      return renderSelect(field, value, cls);
    case 'model_path':
    case 'asset_path':
      return renderModelPath(field, value, cls);
    case 'anim_clip':
      return renderAnimClip(field, value, cls);
    default:
      return '';
  }
}

function renderNumber(f, value, cls) {
  const step = f.step || (f.type === 'float' ? 0.01 : 1);
  const min = f.min ?? 0;
  const max = f.max ?? 10000;
  const unit = f.unit ? `<span class="field-unit">${f.unit}</span>` : '';
  const display = value ?? '';

  return `
    <div class="${cls}" data-path="${f.path}">
      <label class="field-label">${f.label} ${unit}</label>
      <div class="field-controls">
        <input type="range" min="${min}" max="${max}" step="${step}"
               value="${value ?? min}" data-path="${f.path}">
        <input type="number" min="${min}" max="${max}" step="${step}"
               value="${display}" data-path="${f.path}"
               placeholder="${f.nullable ? '∞' : ''}" style="width:90px">
      </div>
    </div>`;
}

function renderColor(f, value, cls) {
  const hex = hexToInput(value);
  return `
    <div class="${cls}" data-path="${f.path}">
      <label class="field-label">${f.label}</label>
      <div class="field-controls color-wrapper">
        <input type="color" value="${hex}" data-path="${f.path}">
        <span class="color-hex">${value}</span>
      </div>
    </div>`;
}

function renderString(f, value, cls) {
  const previewBtn = f.asset
    ? `<button class="btn-preview" data-preview-type="${f.asset === true ? '' : f.asset}" title="预览资源">👁</button>`
    : '';
  return `
    <div class="${cls}" data-path="${f.path}">
      <label class="field-label">${f.label}</label>
      <div class="field-controls">
        <input type="text" value="${value ?? ''}" data-path="${f.path}" style="width:200px">
        ${previewBtn}
      </div>
    </div>`;
}

function renderSelect(f, value, cls) {
  const opts = (f.options || [])
    .map(o => `<option value="${o.value}" ${o.value === value ? 'selected' : ''}>${o.label}</option>`)
    .join('');
  return `
    <div class="${cls}" data-path="${f.path}">
      <label class="field-label">${f.label}</label>
      <div class="field-controls">
        <select data-path="${f.path}">${opts}</select>
      </div>
    </div>`;
}

// ── Model path field ──

function renderModelPath(f, value, cls) {
  return `
    <div class="${cls}" data-path="${f.path}">
      <label class="field-label">${f.label}</label>
      <div class="field-controls model-path-controls">
        <input type="text" value="${value ?? ''}" data-path="${f.path}"
               placeholder="/models/xxx.glb" style="flex:1; min-width:180px">
        <button class="btn btn-preview" data-preview-path="${f.path}"
                ${!value ? 'disabled' : ''}>预览</button>
      </div>
    </div>`;
}

// ── Anim clip field ──

function renderAnimClip(f, value, cls) {
  const modelPathField = getModelPathForAnimField(f.path);
  const modelPath = getByPath(configs[activeFile], modelPathField) || '';

  let optionsHtml = '<option value="">（无）</option>';

  if (!modelPath) {
    optionsHtml += '<option disabled>— 请先设置模型路径 —</option>';
  } else {
    const cached = clipCache.get(modelPath);
    if (!cached) {
      optionsHtml += '<option disabled>加载中…</option>';
      loadAndCacheClips(modelPath);
    } else if (cached === 'error') {
      optionsHtml += '<option disabled>— 加载失败 —</option>';
    } else if (cached === 'loading') {
      optionsHtml += '<option disabled>加载中…</option>';
    } else if (cached.length > 0) {
      optionsHtml += '<optgroup label="动画片段">';
      for (const clip of cached) {
        const sel = clip.name === value ? 'selected' : '';
        optionsHtml += `<option value="${clip.name}" ${sel}>${clip.name} (${clip.duration}s)</option>`;
      }
      optionsHtml += '</optgroup>';
    } else {
      optionsHtml += '<option disabled>— 模型无动画 —</option>';
    }
  }

  return `
    <div class="${cls}" data-path="${f.path}">
      <label class="field-label">${f.label}</label>
      <div class="field-controls">
        <select data-path="${f.path}" data-anim-clip>${optionsHtml}</select>
      </div>
    </div>`;
}

// ── Array / Table ──

function renderArray(arrayDef, data) {
  const arr = getByPath(data, arrayDef.path);
  const isSimple = arrayDef.columns.length === 1 && arrayDef.columns[0].path === 'value';

  if (isSimple) {
    return renderSimpleArray(arrayDef, arr);
  }

  const headerCells = arrayDef.columns.map(c => `<th>${c.label}${c.unit ? ` (${c.unit})` : ''}</th>`).join('');

  const rows = (arr || []).map((item, i) => {
    const cells = arrayDef.columns.map(col => {
      const val = item[col.path];
      const origArr = getByPath(original[activeFile], arrayDef.path);
      const origVal = origArr?.[i]?.[col.path];
      const changed = !deepEqual(val, origVal);
      const tdCls = changed ? 'changed' : '';

      if (col.type === 'select') {
        const opts = (col.options || [])
          .map(o => `<option value="${o.value}" ${o.value === val ? 'selected' : ''}>${o.label}</option>`)
          .join('');
        return `<td class="${tdCls}"><select data-array="${arrayDef.path}" data-idx="${i}" data-col="${col.path}">${opts}</select></td>`;
      }

      const inputType = (col.type === 'int' || col.type === 'float') ? 'number' : 'text';
      const step = col.step || (col.type === 'float' ? 0.01 : 1);
      const display = val ?? '';
      const ph = col.nullable ? '∞' : '';

      if (col.type === 'string' && col.asset) {
        const previewBtn = `<button class="btn-preview-sm" data-preview-type="${col.asset === true ? '' : col.asset}" title="预览">👁</button>`;
        return `<td class="${tdCls}"><div class="cell-asset"><input type="${inputType}" value="${display}" step="${step}"
                  placeholder="${ph}"
                  data-array="${arrayDef.path}" data-idx="${i}" data-col="${col.path}">${previewBtn}</div></td>`;
      }

      return `<td class="${tdCls}"><input type="${inputType}" value="${display}" step="${step}"
                placeholder="${ph}"
                data-array="${arrayDef.path}" data-idx="${i}" data-col="${col.path}"></td>`;
    }).join('');

    return `<tr>${cells}<td><button class="btn-icon" data-array="${arrayDef.path}" data-remove="${i}" title="删除行">✕</button></td></tr>`;
  }).join('');

  return `
    <div class="array-section">
      <div class="array-label">${arrayDef.label}</div>
      <table class="array-table">
        <thead><tr>${headerCells}<th style="width:36px"></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="array-actions">
        <button class="btn-add" data-array="${arrayDef.path}">+ 添加行</button>
      </div>
    </div>`;
}

function renderSimpleArray(arrayDef, arr) {
  const col = arrayDef.columns[0];
  const items = (arr || []).map((val, i) => {
    const origArr = getByPath(original[activeFile], arrayDef.path);
    const origVal = origArr?.[i];
    const changed = val !== origVal;
    const cls = changed ? 'field changed' : 'field';
    return `
      <div class="${cls}" style="grid-template-columns: 80px 1fr">
        <label class="field-label">[${i}]</label>
        <div class="field-controls">
          <input type="number" value="${val}" data-simple-array="${arrayDef.path}" data-idx="${i}"
                 min="${col.min ?? ''}" max="${col.max ?? ''}" step="${col.step || 1}" style="width:90px">
          <button class="btn-icon" data-array="${arrayDef.path}" data-remove="${i}" title="删除">✕</button>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="array-section">
      <div class="array-label">${arrayDef.label}</div>
      ${items}
      <div style="padding: 4px 16px">
        <button class="btn-add" data-simple-add="${arrayDef.path}">+ 添加</button>
      </div>
    </div>`;
}

// ── Event binding ──

function bindFieldEvents() {
  const panel = document.getElementById('panel');

  // Group collapse
  panel.querySelectorAll('.field-group-header').forEach(h => {
    h.addEventListener('click', () => h.parentElement.classList.toggle('collapsed'));
  });

  // Number: range ↔ input sync
  panel.querySelectorAll('input[type="range"]').forEach(range => {
    const numInput = panel.querySelector(`input[type="number"][data-path="${range.dataset.path}"]`);
    if (!numInput) return;
    range.addEventListener('input', () => {
      numInput.value = range.value;
      applyFieldChange(range.dataset.path, parseFloat(range.value));
    });
  });

  panel.querySelectorAll('.field input[type="number"]').forEach(input => {
    if (!input.dataset.path) return;
    const range = panel.querySelector(`input[type="range"][data-path="${input.dataset.path}"]`);
    input.addEventListener('input', () => {
      if (range) range.value = input.value;
      const schema = findFieldSchema(input.dataset.path);
      applyFieldChange(input.dataset.path, parseFieldValue(input.value, schema || { type: 'float' }));
    });
  });

  // Color
  panel.querySelectorAll('input[type="color"]').forEach(input => {
    input.addEventListener('input', () => {
      const hex = inputToHex(input.value);
      const label = input.parentElement.querySelector('.color-hex');
      if (label) label.textContent = hex;
      applyFieldChange(input.dataset.path, hex);
    });
  });

  // Text (including model_path inputs)
  panel.querySelectorAll('input[type="text"][data-path]').forEach(input => {
    input.addEventListener('input', () => {
      applyFieldChange(input.dataset.path, input.value);
      // Enable/disable preview button next to model_path inputs
      const previewBtn = input.parentElement?.querySelector('[data-preview-path]');
      if (previewBtn) {
        previewBtn.disabled = !input.value;
      }
      // When modelPath changes, invalidate clip cache and debounce re-render
      if (input.dataset.path.endsWith('modelPath')) {
        clipCache.delete(input.value);
        clearTimeout(_modelPathRenderTimer);
        _modelPathRenderTimer = setTimeout(() => renderPanel(), 600);
      }
    });
  });

  // Model preview buttons (Three.js)
  panel.querySelectorAll('[data-preview-path]').forEach(btn => {
    btn.addEventListener('click', () => {
      openModelPreview(btn.dataset.previewPath);
    });
  });

  // Select (non-array, non-anim-clip)
  panel.querySelectorAll('select[data-path]').forEach(sel => {
    sel.addEventListener('change', () => {
      applyFieldChange(sel.dataset.path, sel.value);
    });
  });

  // Asset preview buttons (standalone fields with asset property)
  panel.querySelectorAll('.btn-preview:not([data-preview-path])').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const input = btn.parentElement.querySelector('input[type="text"]');
      const path = input?.value;
      if (path) {
        const type = btn.dataset.previewType || null;
        openAssetPreview(path, type || detectAssetType(path));
      } else {
        showToast('请先输入资源路径', 'error');
      }
    });
  });

  // Asset preview buttons (array cells)
  panel.querySelectorAll('.btn-preview-sm').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const input = btn.parentElement.querySelector('input');
      const path = input?.value;
      if (path) {
        const type = btn.dataset.previewType || null;
        openAssetPreview(path, type || detectAssetType(path));
      } else {
        showToast('请先输入资源路径', 'error');
      }
    });
  });

  // Array cell edits
  panel.querySelectorAll('[data-array][data-idx][data-col]').forEach(input => {
    const event = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(event, () => {
      const arr = getByPath(configs[activeFile], input.dataset.array);
      const idx = parseInt(input.dataset.idx);
      const col = input.dataset.col;
      const schemaDef = findArrayColSchema(input.dataset.array, col);
      arr[idx][col] = parseFieldValue(input.value, schemaDef || { type: 'string' });
      onDataChanged();
    });
  });

  // Simple array edits
  panel.querySelectorAll('[data-simple-array]').forEach(input => {
    input.addEventListener('input', () => {
      const arr = getByPath(configs[activeFile], input.dataset.simpleArray);
      const idx = parseInt(input.dataset.idx);
      arr[idx] = parseInt(input.value, 10);
      onDataChanged();
    });
  });

  // Remove row
  panel.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const arr = getByPath(configs[activeFile], btn.dataset.array);
      arr.splice(parseInt(btn.dataset.remove), 1);
      onDataChanged();
      renderPanel();
    });
  });

  // Add row (object array)
  panel.querySelectorAll('.btn-add[data-array]').forEach(btn => {
    btn.addEventListener('click', () => {
      const arr = getByPath(configs[activeFile], btn.dataset.array);
      const schema = findArraySchema(btn.dataset.array);
      if (!schema) return;
      const row = {};
      for (const col of schema.columns) {
        row[col.path] = col.type === 'string' || col.type === 'select' ? '' : 0;
      }
      arr.push(row);
      onDataChanged();
      renderPanel();
    });
  });

  // Add (simple array)
  panel.querySelectorAll('[data-simple-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const arr = getByPath(configs[activeFile], btn.dataset.simpleAdd);
      arr.push(0);
      onDataChanged();
      renderPanel();
    });
  });
}

function applyFieldChange(path, value) {
  setByPath(configs[activeFile], path, value);
  onDataChanged();

  const fieldEl = document.querySelector(`.field[data-path="${path}"]`);
  if (fieldEl) {
    const orig = getByPath(original[activeFile], path);
    fieldEl.classList.toggle('changed', !deepEqual(value, orig));
  }
}

function findFieldSchema(path) {
  const schema = schemas.find(s => s.file === activeFile);
  if (!schema) return null;
  return searchFields(schema.fields, path);
}

function searchFields(fields, path) {
  for (const f of fields) {
    if (f.type === 'group') {
      const found = searchFields(f.fields, path);
      if (found) return found;
    } else if (f.path === path) {
      return f;
    }
  }
  return null;
}

function findArraySchema(arrayPath) {
  const schema = schemas.find(s => s.file === activeFile);
  if (!schema) return null;
  return searchArrayDef(schema.fields, arrayPath);
}

function searchArrayDef(fields, arrayPath) {
  for (const f of fields) {
    if (f.type === 'array' && f.path === arrayPath) return f;
    if (f.type === 'group') {
      const found = searchArrayDef(f.fields, arrayPath);
      if (found) return found;
    }
  }
  return null;
}

function findArrayColSchema(arrayPath, colPath) {
  const arr = findArraySchema(arrayPath);
  return arr?.columns.find(c => c.path === colPath) || null;
}

// ── Dirty tracking & actions ──

function onDataChanged() {
  updateActionButtons();
  updateSidebarDots();
}

function updateActionButtons() {
  const anyDirty = schemas.some(s => !deepEqual(configs[s.file], original[s.file]));
  document.getElementById('btn-save').disabled = !anyDirty;
  document.getElementById('btn-reset').disabled = !anyDirty;

  const status = document.getElementById('status');
  if (anyDirty) {
    const count = schemas.filter(s => !deepEqual(configs[s.file], original[s.file])).length;
    status.textContent = `${count} 个文件有未保存的修改`;
    status.className = 'status dirty';
  } else {
    status.textContent = '';
    status.className = 'status';
  }
}

function bindGlobalEvents() {
  document.getElementById('btn-save').addEventListener('click', saveAll);
  document.getElementById('btn-reset').addEventListener('click', resetAll);

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveAll();
    }
    if (e.key === 'Escape') {
      closeAssetPreview();
      closeModelPreview();
    }
  });

  // Modal close handlers
  document.querySelector('.modal-close')?.addEventListener('click', closeAssetPreview);
  document.querySelector('.modal-backdrop')?.addEventListener('click', closeAssetPreview);
}

async function saveAll() {
  const dirtyFiles = schemas.filter(s => !deepEqual(configs[s.file], original[s.file]));
  if (dirtyFiles.length === 0) return;

  try {
    await Promise.all(
      dirtyFiles.map(s =>
        fetch(`/__config/api/config/${encodeURIComponent(s.file)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configs[s.file]),
        }).then(r => {
          if (!r.ok) throw new Error(`Failed to save ${s.file}`);
        }),
      ),
    );

    original = deepClone(configs);
    onDataChanged();
    renderPanel();
    showToast(`已保存 ${dirtyFiles.length} 个文件，游戏将自动热更新`, 'success');
  } catch (e) {
    showToast('保存失败: ' + e.message, 'error');
  }
}

function resetAll() {
  configs = deepClone(original);
  onDataChanged();
  renderPanel();
  showToast('已重置所有修改', 'success');
}

// ── Toast ──

let toastTimer = null;

function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast hidden'), 2500);
}

// ── Start ──
init();
