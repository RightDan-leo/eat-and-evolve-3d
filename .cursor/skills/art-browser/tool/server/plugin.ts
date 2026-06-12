import type { Plugin, ViteDevServer } from 'vite';
import fs from 'fs';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import { startExport, getTaskStatus, cancelTask } from './converter';
import {
  searchAssets, getAssetDetail, startDownload as startDl,
  getDownloadStatus, cancelDownload, listDownloadHistory,
  getAvailableSites,
} from './downloader';
import type { ExportConfig, SearchOptions, DownloadRequest } from '../src/types';

interface ServerAssetInfo {
  name: string;
  relativePath: string;
  extension: string;
  type: string;
  size: number;
  directory: string;
  width?: number;
  height?: number;
}

interface ServerState {
  projectPath: string;
  assetsDir: string;
  assets: ServerAssetInfo[];
  folders: string[];
  scanTime: string;
}

const SKIP_DIRS = new Set([
  'Library', 'Temp', 'Logs', 'obj', '.git', '.vs',
  'Packages', 'ProjectSettings', 'UserSettings',
  'node_modules', '.gradle', 'Build', 'Builds',
]);

const EXT_TYPE_MAP: Record<string, string> = {};

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.tga', '.psd', '.tif', '.tiff', '.exr', '.hdr'];
const MODEL_EXTS = ['.fbx', '.obj', '.blend', '.dae', '.3ds', '.gltf', '.glb', '.stl', '.max', '.ma', '.mb'];
const AUDIO_EXTS = ['.mp3', '.wav', '.ogg', '.aif', '.aiff', '.flac'];
const ANIM_EXTS = ['.anim', '.controller', '.overrideController'];
const MATERIAL_EXTS = ['.mat'];
const SHADER_EXTS = ['.shader', '.cginc', '.hlsl', '.glsl', '.compute'];
const PREFAB_EXTS = ['.prefab'];
const SCENE_EXTS = ['.unity'];

IMAGE_EXTS.forEach(e => EXT_TYPE_MAP[e] = 'image');
MODEL_EXTS.forEach(e => EXT_TYPE_MAP[e] = 'model');
AUDIO_EXTS.forEach(e => EXT_TYPE_MAP[e] = 'audio');
ANIM_EXTS.forEach(e => EXT_TYPE_MAP[e] = 'animation');
MATERIAL_EXTS.forEach(e => EXT_TYPE_MAP[e] = 'material');
SHADER_EXTS.forEach(e => EXT_TYPE_MAP[e] = 'shader');
PREFAB_EXTS.forEach(e => EXT_TYPE_MAP[e] = 'prefab');
SCENE_EXTS.forEach(e => EXT_TYPE_MAP[e] = 'scene');

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.tga': 'application/octet-stream',
  '.psd': 'application/octet-stream',
  '.exr': 'application/octet-stream',
  '.hdr': 'application/octet-stream',
  '.fbx': 'application/octet-stream',
  '.obj': 'text/plain',
  '.mtl': 'text/plain',
  '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary',
  '.bin': 'application/octet-stream',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
};

let sharpInstance: typeof import('sharp') | null = null;
async function getSharp() {
  if (!sharpInstance) {
    try { sharpInstance = (await import('sharp')).default as any; } catch {}
  }
  return sharpInstance;
}

const SHARP_IMAGE_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff', '.tif', '.svg',
]);

async function readImageDimensions(
  fullPath: string,
  ext: string,
): Promise<{ w: number; h: number } | null> {
  try {
    if (ext === '.tga') {
      const fd = await fs.promises.open(fullPath, 'r');
      const buf = Buffer.alloc(18);
      await fd.read(buf, 0, 18, 0);
      await fd.close();
      return { w: buf.readUInt16LE(12), h: buf.readUInt16LE(14) };
    }
    if (SHARP_IMAGE_EXTS.has(ext)) {
      const sharp = await getSharp();
      if (!sharp) return null;
      const meta = await (sharp as any)(fullPath).metadata();
      if (meta.width && meta.height) return { w: meta.width, h: meta.height };
    }
  } catch {}
  return null;
}

async function scanDirectory(
  dirPath: string,
  assetsRoot: string,
  assets: ServerAssetInfo[],
  folderSet: Set<string>,
): Promise<void> {
  let entries;
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      await scanDirectory(fullPath, assetsRoot, assets, folderSet);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.meta') continue;

      const type = EXT_TYPE_MAP[ext];
      if (!type) continue;

      let stat;
      try {
        stat = await fs.promises.stat(fullPath);
      } catch {
        continue;
      }

      const relativePath = path.relative(assetsRoot, fullPath).replace(/\\/g, '/');
      const directory = path.dirname(relativePath).replace(/\\/g, '/');

      if (directory !== '.') folderSet.add(directory);

      const asset: ServerAssetInfo = {
        name: entry.name,
        relativePath,
        extension: ext,
        type,
        size: stat.size,
        directory: directory === '.' ? '' : directory,
      };

      if (type === 'image') {
        const dim = await readImageDimensions(fullPath, ext);
        if (dim) { asset.width = dim.w; asset.height = dim.h; }
      }

      assets.push(asset);
    }
  }
}

function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString()));
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ─── Project-local File Cache ─────────────────────────

const CACHE_DIR = '.uab-cache';

function getCacheDir(projectPath: string): string {
  return path.join(projectPath, CACHE_DIR);
}

async function writeCache(projectPath: string, filename: string, data: unknown) {
  const dir = getCacheDir(projectPath);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(
    path.join(dir, filename),
    JSON.stringify(data, null, 2),
    'utf-8',
  );
}

async function readCache<T>(projectPath: string, filename: string): Promise<T | null> {
  try {
    const raw = await fs.promises.readFile(
      path.join(getCacheDir(projectPath), filename),
      'utf-8',
    );
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

interface ScanCache {
  projectPath: string;
  assetsDir: string;
  scanTime: string;
  assets: ServerAssetInfo[];
  folders: string[];
}

const LOCAL_CONFIG_PATH = path.join(process.cwd(), '.uab-local.json');

interface LocalConfig {
  lastProjectPath: string;
}

async function saveLocalConfig(config: LocalConfig) {
  await fs.promises.writeFile(LOCAL_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

async function loadLocalConfig(): Promise<LocalConfig | null> {
  try {
    const raw = await fs.promises.readFile(LOCAL_CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as LocalConfig;
  } catch {
    return null;
  }
}

// Shared state ref used by both standalone and integrated plugins
interface StateRef {
  current: ServerState | null;
}

async function handleApiRoute(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  stateRef: StateRef,
): Promise<boolean> {
  const { pathname } = url;
  const method = req.method;

  // --- POST /api/scan ---
  if (pathname === '/api/scan' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const projectPath = body.projectPath as string;

      if (!projectPath) {
        sendJSON(res, 400, { error: '请提供工程路径' });
        return true;
      }

      const normalizedPath = path.resolve(projectPath);

      if (!fs.existsSync(normalizedPath)) {
        sendJSON(res, 400, {
          error: `路径不存在: ${normalizedPath}`,
        });
        return true;
      }

      const unityAssetsDir = path.join(normalizedPath, 'Assets');
      const assetsDir = fs.existsSync(unityAssetsDir) ? unityAssetsDir : normalizedPath;

      const allAssets: ServerAssetInfo[] = [];
      const folderSet = new Set<string>();

      await scanDirectory(assetsDir, assetsDir, allAssets, folderSet);

      const pathFilters = body.pathFilters as
        | Record<string, string[]>
        | undefined;

      let assets = allAssets;
      if (pathFilters) {
        assets = allAssets.filter((a) => {
          const subPaths = pathFilters[a.type];
          if (!subPaths || subPaths.length === 0) return true;
          return subPaths.some(
            (p) =>
              a.directory === p ||
              a.directory.startsWith(p + '/') ||
              a.relativePath === p,
          );
        });
      }

      const filteredFolders = new Set<string>();
      for (const a of assets) {
        if (a.directory) filteredFolders.add(a.directory);
      }

      stateRef.current = {
        projectPath: normalizedPath,
        assetsDir,
        assets,
        folders: Array.from(filteredFolders).sort(),
        scanTime: new Date().toISOString(),
      };

      writeCache(normalizedPath, 'scan-result.json', {
        projectPath: normalizedPath,
        assetsDir,
        scanTime: stateRef.current.scanTime,
        assets,
        folders: stateRef.current.folders,
      } satisfies ScanCache).catch(() => {});

      saveLocalConfig({ lastProjectPath: normalizedPath }).catch(() => {});

      sendJSON(res, 200, {
        projectPath: stateRef.current.projectPath,
        scanTime: stateRef.current.scanTime,
        totalAssets: assets.length,
        assets,
        folders: stateRef.current.folders,
      });
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      sendJSON(res, 500, { error: msg });
      return true;
    }
  }

  // --- GET /api/last-project ---
  if (pathname === '/api/last-project' && method === 'GET') {
    const config = await loadLocalConfig();
    sendJSON(res, 200, { projectPath: config?.lastProjectPath ?? '' });
    return true;
  }

  // --- GET /api/assets ---
  if (pathname === '/api/assets' && method === 'GET') {
    if (!stateRef.current) {
      const hint = url.searchParams.get('projectPath');
      if (hint) {
        const normalizedHint = path.resolve(hint);
        const cached = await readCache<ScanCache>(normalizedHint, 'scan-result.json');
        if (cached?.assets?.length) {
          stateRef.current = {
            projectPath: cached.projectPath,
            assetsDir: cached.assetsDir,
            assets: cached.assets,
            folders: cached.folders,
            scanTime: cached.scanTime,
          };
        }
      }
    }
    if (!stateRef.current) {
      sendJSON(res, 200, { assets: [], folders: [], projectPath: '', scanTime: '', totalAssets: 0 });
      return true;
    }
    sendJSON(res, 200, {
      projectPath: stateRef.current.projectPath,
      scanTime: stateRef.current.scanTime,
      totalAssets: stateRef.current.assets.length,
      assets: stateRef.current.assets,
      folders: stateRef.current.folders,
    });
    return true;
  }

  // --- GET /api/favorites ---
  if (pathname === '/api/favorites' && method === 'GET') {
    const pp = url.searchParams.get('projectPath');
    if (!pp) { sendJSON(res, 400, { error: '缺少 projectPath' }); return true; }
    const data = await readCache(path.resolve(pp), 'favorites.json');
    sendJSON(res, 200, data ?? { folders: [], items: [] });
    return true;
  }

  // --- POST /api/favorites ---
  if (pathname === '/api/favorites' && method === 'POST') {
    const body = await parseBody(req);
    const pp = body.projectPath as string;
    const favorites = body.favorites;
    if (!pp || !favorites) { sendJSON(res, 400, { error: '缺少参数' }); return true; }
    await writeCache(path.resolve(pp), 'favorites.json', favorites);
    sendJSON(res, 200, { ok: true });
    return true;
  }

  // --- GET /api/path-filters ---
  if (pathname === '/api/path-filters' && method === 'GET') {
    const pp = url.searchParams.get('projectPath');
    if (!pp) { sendJSON(res, 400, { error: '缺少 projectPath' }); return true; }
    const data = await readCache(path.resolve(pp), 'path-filters.json');
    sendJSON(res, 200, data ?? {});
    return true;
  }

  // --- POST /api/path-filters ---
  if (pathname === '/api/path-filters' && method === 'POST') {
    const body = await parseBody(req);
    const pp = body.projectPath as string;
    const pathFilters = body.pathFilters;
    if (!pp) { sendJSON(res, 400, { error: '缺少参数' }); return true; }
    await writeCache(path.resolve(pp), 'path-filters.json', pathFilters ?? {});
    sendJSON(res, 200, { ok: true });
    return true;
  }

  // --- GET /api/sites ---
  if (pathname === '/api/sites' && method === 'GET') {
    sendJSON(res, 200, { sites: getAvailableSites() });
    return true;
  }

  // --- POST /api/search ---
  if (pathname === '/api/search' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const query = body.query as string;
      if (!query) { sendJSON(res, 400, { error: '缺少搜索关键词' }); return true; }
      const options = (body.options || {}) as SearchOptions;
      const result = await searchAssets(query, options);
      sendJSON(res, 200, result);
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      sendJSON(res, 500, { error: msg });
      return true;
    }
  }

  // --- GET /api/search-detail ---
  if (pathname === '/api/search-detail' && method === 'GET') {
    try {
      const source = url.searchParams.get('source');
      const assetId = url.searchParams.get('id');
      if (!source || !assetId) {
        sendJSON(res, 400, { error: '缺少 source 或 id' });
        return true;
      }
      const detail = await getAssetDetail(source, assetId);
      sendJSON(res, 200, detail);
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      sendJSON(res, 500, { error: msg });
      return true;
    }
  }

  // --- POST /api/download-start ---
  if (pathname === '/api/download-start' && method === 'POST') {
    try {
      const body = await parseBody(req) as unknown as DownloadRequest;
      if (!body.targetDir) {
        sendJSON(res, 400, { error: '缺少目标路径 targetDir' });
        return true;
      }
      const taskId = await startDl(body);
      sendJSON(res, 200, { taskId });
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      sendJSON(res, 500, { error: msg });
      return true;
    }
  }

  // --- GET /api/download-status ---
  if (pathname === '/api/download-status' && method === 'GET') {
    const taskId = url.searchParams.get('taskId');
    if (!taskId) { sendJSON(res, 400, { error: '缺少 taskId' }); return true; }
    const s = getDownloadStatus(taskId);
    if (!s) { sendJSON(res, 404, { error: '任务不存在' }); return true; }
    sendJSON(res, 200, s);
    return true;
  }

  // --- POST /api/download-cancel ---
  if (pathname === '/api/download-cancel' && method === 'POST') {
    const body = await parseBody(req);
    const taskId = body.taskId as string;
    if (!taskId) { sendJSON(res, 400, { error: '缺少 taskId' }); return true; }
    const ok = cancelDownload(taskId);
    sendJSON(res, 200, { ok });
    return true;
  }

  // --- GET /api/download-history ---
  if (pathname === '/api/download-history' && method === 'GET') {
    sendJSON(res, 200, { history: listDownloadHistory() });
    return true;
  }

  // --- POST /api/export ---
  if (pathname === '/api/export' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const assetPaths = body.assets as string[];
      const config = body.config as ExportConfig;

      if (!assetPaths?.length) { sendJSON(res, 400, { error: '请选择要导出的资源' }); return true; }
      if (!config?.outputDir) { sendJSON(res, 400, { error: '请指定导出目标路径' }); return true; }
      if (!stateRef.current) { sendJSON(res, 400, { error: '请先扫描工程' }); return true; }

      const taskId = `export_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const assets = assetPaths.map((rp) => ({
        relativePath: rp,
        type: stateRef.current!.assets.find((a) => a.relativePath === rp)?.type || 'other',
        absolutePath: path.join(stateRef.current!.assetsDir, rp),
      }));

      await startExport({ taskId, assets, outputDir: path.resolve(config.outputDir), config });
      sendJSON(res, 200, { taskId });
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      sendJSON(res, 500, { error: msg });
      return true;
    }
  }

  // --- GET /api/export-status ---
  if (pathname === '/api/export-status' && method === 'GET') {
    const taskId = url.searchParams.get('taskId');
    if (!taskId) { sendJSON(res, 400, { error: '缺少 taskId' }); return true; }
    const status = getTaskStatus(taskId);
    if (!status) { sendJSON(res, 404, { error: '任务不存在' }); return true; }
    sendJSON(res, 200, status);
    return true;
  }

  // --- POST /api/export-cancel ---
  if (pathname === '/api/export-cancel' && method === 'POST') {
    const body = await parseBody(req);
    const taskId = body.taskId as string;
    if (!taskId) { sendJSON(res, 400, { error: '缺少 taskId' }); return true; }
    const ok = cancelTask(taskId);
    sendJSON(res, 200, { ok });
    return true;
  }

  // --- GET /api/unity-file/<relativePath> ---
  const FILE_PREFIX = '/api/unity-file/';
  if (pathname.startsWith(FILE_PREFIX) && method === 'GET') {
    if (!stateRef.current) {
      res.writeHead(404);
      res.end('No project scanned');
      return true;
    }

    const relativePath = decodeURIComponent(pathname.slice(FILE_PREFIX.length));
    const absolutePath = path.join(stateRef.current.assetsDir, relativePath);
    const resolved = path.resolve(absolutePath);

    if (!resolved.startsWith(path.resolve(stateRef.current.assetsDir))) {
      res.writeHead(403);
      res.end('Access denied');
      return true;
    }

    if (!fs.existsSync(resolved)) {
      res.writeHead(404);
      res.end('File not found');
      return true;
    }

    const ext = path.extname(resolved).toLowerCase();
    const mime = MIME_MAP[ext] || 'application/octet-stream';
    const stat = fs.statSync(resolved);

    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    });

    fs.createReadStream(resolved).pipe(res);
    return true;
  }

  return false;
}

// ─── Standalone plugin (port 5200) ────────────────────

export function unityAssetBrowserPlugin(): Plugin {
  const stateRef: StateRef = { current: null };

  return {
    name: 'art-browser',

    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();
        const url = new URL(req.url, 'http://localhost');
        const handled = await handleApiRoute(req, res, url, stateRef);
        if (!handled) next();
      });
    },
  };
}

// ─── Integrated plugin (/__art-browser/) ──────────────

const CLIENT_MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

export function artBrowser(): Plugin {
  const BASE = '/__art-browser';
  const stateRef: StateRef = { current: null };
  let clientDir: string;

  return {
    name: 'art-browser-integrated',
    apply: 'serve',

    configResolved(config) {
      clientDir = path.resolve(config.root, '.cursor/skills/art-browser/tool/client');
    },

    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || '';
        if (!rawUrl.startsWith(BASE)) return next();

        const innerPath = rawUrl.slice(BASE.length) || '/';

        // API routes
        if (innerPath.startsWith('/api/')) {
          const url = new URL(innerPath, 'http://localhost');
          const handled = await handleApiRoute(req, res, url, stateRef);
          if (!handled) next();
          return;
        }

        // Static files from pre-built client/
        let filePath: string;
        if (innerPath === '/' || innerPath === '/index.html') {
          filePath = path.join(clientDir, 'index.html');
        } else {
          filePath = path.join(clientDir, innerPath);
        }

        const resolved = path.resolve(filePath);
        if (!resolved.startsWith(path.resolve(clientDir))) {
          res.writeHead(403);
          res.end('Access denied');
          return;
        }

        if (!fs.existsSync(resolved)) {
          // SPA fallback
          filePath = path.join(clientDir, 'index.html');
        }

        try {
          const ext = path.extname(filePath).toLowerCase();
          const mime = CLIENT_MIME[ext] || 'application/octet-stream';
          const content = fs.readFileSync(filePath);
          res.writeHead(200, {
            'Content-Type': mime,
            'Content-Length': content.length,
            'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=604800, immutable',
          });
          res.end(content);
        } catch {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      const addr = server.config.server.port || 5173;
      console.log(`  Art Browser: http://localhost:${addr}${BASE}/`);
    },
  };
}
