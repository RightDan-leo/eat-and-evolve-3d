import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { createAdapters, getSiteInfoList } from './sites/index';
import type { SiteAdapter } from './sites/index';
import { runFbx2Gltf } from './converter';
import type {
  SearchResult,
  SearchOptions,
  AssetDetail,
  DownloadRequest,
  DownloadStatus,
  DownloadRecord,
  DownloadTaskStatus,
  SiteInfo,
} from '../src/types';

const adapters: Map<string, SiteAdapter> = createAdapters();
const activeTasks = new Map<string, DownloadStatus>();
const cancelledTasks = new Set<string>();
const downloadHistory: DownloadRecord[] = [];

const MAX_HISTORY = 50;

export function getAvailableSites(): SiteInfo[] {
  return getSiteInfoList(adapters);
}

export async function searchAssets(
  query: string,
  options?: SearchOptions,
): Promise<SearchResult> {
  const sources = options?.sources ?? Array.from(adapters.keys());
  const animated = options?.animated ?? false;
  const selectedAdapters = sources
    .map((id) => adapters.get(id))
    .filter(Boolean) as SiteAdapter[];

  if (selectedAdapters.length === 0) {
    return { query, items: [], total: 0, page: 1, hasMore: false };
  }

  const results = await Promise.allSettled(
    selectedAdapters.map((a) => {
      const searchQuery = animated && a.id !== 'sketchfab'
        ? `${query} animated`
        : query;
      return a.search(searchQuery, options).catch((err) => {
        console.warn(`[下载] ${a.name} 搜索失败:`, err.message);
        return { query, items: [], total: 0, page: 1, hasMore: false } as SearchResult;
      });
    }),
  );

  let allItems = results.flatMap((r) => {
    if (r.status === 'fulfilled') return r.value.items;
    return [];
  });

  if (animated) {
    const withAnim = allItems.filter((it) => it.animated);
    const withoutAnim = allItems.filter((it) => !it.animated);
    allItems = [...withAnim, ...withoutAnim];
  }

  const hasMore = results.some(
    (r) => r.status === 'fulfilled' && r.value.hasMore,
  );

  return {
    query,
    items: allItems,
    total: allItems.length,
    page: options?.page ?? 1,
    hasMore,
  };
}

export async function getAssetDetail(
  source: string,
  assetId: string,
): Promise<AssetDetail> {
  const adapter = adapters.get(source);
  if (!adapter) throw new Error(`未知来源: ${source}`);
  return adapter.getDetail(assetId);
}

export async function startDownload(req: DownloadRequest): Promise<string> {
  const taskId = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const status: DownloadStatus = {
    taskId,
    status: 'downloading',
    progress: 0,
    currentFile: '',
  };
  activeTasks.set(taskId, status);

  doDownload(taskId, req).catch((err) => {
    const s = activeTasks.get(taskId);
    if (s) {
      s.status = 'failed';
      s.error = err.message;
    }
  });

  return taskId;
}

async function doDownload(taskId: string, req: DownloadRequest) {
  const status = activeTasks.get(taskId)!;

  let downloadUrl = req.url;
  if (!downloadUrl) {
    const adapter = adapters.get(req.source);
    if (!adapter) throw new Error(`未知来源: ${req.source}`);
    downloadUrl = await adapter.getDownloadUrl(req.assetId);
    if (!downloadUrl) throw new Error('无法获取下载链接');
  }

  if (isGDriveFolder(downloadUrl)) {
    throw new Error(
      'Google Drive 文件夹链接无法自动下载，请手动访问该链接下载资源。',
    );
  }

  if (cancelledTasks.has(taskId)) {
    status.status = 'cancelled';
    return;
  }

  downloadUrl = resolveDownloadUrl(downloadUrl);

  const targetDir = path.resolve(req.targetDir);
  await fs.promises.mkdir(targetDir, { recursive: true });

  const safeName = sanitizeFilename(req.assetName || req.assetId);
  const urlPath = new URL(downloadUrl).pathname;
  let ext = path.extname(urlPath) || '.zip';
  if (downloadUrl.includes('drive.google.com')) ext = '.zip';
  const filename = `${safeName}${ext}`;
  const filePath = path.join(targetDir, filename);

  status.currentFile = filename;
  console.log(`[下载] 开始下载: ${downloadUrl} -> ${filePath}`);

  const res = await fetch(downloadUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    redirect: 'follow',
  });

  if (!res.ok) throw new Error(`下载失败: HTTP ${res.status}`);
  if (!res.body) throw new Error('响应无 body');

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html') && !downloadUrl.includes('.html')) {
    throw new Error('服务器返回了网页而非文件，该资源可能需要手动下载');
  }

  const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
  let downloaded = 0;

  const body = Readable.fromWeb(res.body as any);
  const ws = fs.createWriteStream(filePath);

  body.on('data', (chunk: Buffer) => {
    if (cancelledTasks.has(taskId)) {
      body.destroy();
      ws.destroy();
      return;
    }
    downloaded += chunk.length;
    if (contentLength > 0) {
      status.progress = Math.round((downloaded / contentLength) * 100);
    }
  });

  await pipeline(body, ws);

  if (cancelledTasks.has(taskId)) {
    status.status = 'cancelled';
    try { await fs.promises.unlink(filePath); } catch {}
    return;
  }

  const outputFiles: string[] = [filePath];

  if (ext.toLowerCase() === '.zip') {
    status.status = 'extracting';
    status.currentFile = 'extracting...';
    console.log(`[下载] 解压: ${filePath}`);

    try {
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip(filePath);
      const extractDir = path.join(targetDir, safeName);
      await fs.promises.mkdir(extractDir, { recursive: true });

      const entries = zip.getEntries();
      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const entryPath = path.join(extractDir, entry.entryName);
        const entryDir = path.dirname(entryPath);

        if (!path.resolve(entryPath).startsWith(path.resolve(extractDir))) {
          console.warn(`[下载] 跳过不安全路径: ${entry.entryName}`);
          continue;
        }

        await fs.promises.mkdir(entryDir, { recursive: true });
        await fs.promises.writeFile(entryPath, entry.getData());
        outputFiles.push(entryPath);
      }

      try { await fs.promises.unlink(filePath); } catch {}
      outputFiles[0] = extractDir;
      console.log(`[下载] 解压完成: ${entries.length} 个文件`);
    } catch (err: any) {
      console.warn(`[下载] 解压失败: ${err.message}`);
    }
  }

  // Auto-convert FBX → GLB for WebGL usage
  const convertedFiles = await convertFbxToGlb(outputFiles, status);
  outputFiles.push(...convertedFiles);

  status.status = 'completed';
  status.progress = 100;
  status.files = outputFiles;

  const record: DownloadRecord = {
    taskId,
    assetName: req.assetName || req.assetId,
    source: req.source,
    timestamp: Date.now(),
    status: 'completed',
    targetDir: req.targetDir,
    files: outputFiles,
  };
  downloadHistory.unshift(record);
  if (downloadHistory.length > MAX_HISTORY) downloadHistory.pop();

  console.log(`[下载] 完成: ${req.assetName}`);
}

export function getDownloadStatus(taskId: string): DownloadStatus | null {
  return activeTasks.get(taskId) ?? null;
}

export function cancelDownload(taskId: string): boolean {
  if (!activeTasks.has(taskId)) return false;
  cancelledTasks.add(taskId);
  const s = activeTasks.get(taskId)!;
  s.status = 'cancelled';
  return true;
}

export function listDownloadHistory(): DownloadRecord[] {
  return downloadHistory;
}

async function convertFbxToGlb(
  files: string[],
  status: DownloadStatus,
): Promise<string[]> {
  const fbxFiles: string[] = [];

  for (const f of files) {
    try {
      const stat = await fs.promises.stat(f);
      if (stat.isDirectory()) {
        await collectFbxFiles(f, fbxFiles);
      } else if (f.toLowerCase().endsWith('.fbx')) {
        fbxFiles.push(f);
      }
    } catch {}
  }

  if (fbxFiles.length === 0) return [];

  console.log(`[下载] 发现 ${fbxFiles.length} 个 FBX 文件，开始转换为 GLB...`);
  status.currentFile = `转换 FBX → GLB (0/${fbxFiles.length})`;

  const converted: string[] = [];
  for (let i = 0; i < fbxFiles.length; i++) {
    const fbx = fbxFiles[i];
    const baseName = path.basename(fbx, path.extname(fbx));
    const outBase = path.join(path.dirname(fbx), baseName);
    const glbPath = outBase + '.glb';

    status.currentFile = `转换 FBX → GLB (${i + 1}/${fbxFiles.length}) ${baseName}`;

    try {
      await runFbx2Gltf(fbx, outBase);
      if (fs.existsSync(glbPath)) {
        converted.push(glbPath);
        console.log(`[下载] 转换成功: ${baseName}.fbx → ${baseName}.glb`);
      }
    } catch (err: any) {
      console.warn(`[下载] 转换失败: ${baseName}.fbx - ${err.message}`);
    }
  }

  if (converted.length > 0) {
    console.log(`[下载] FBX → GLB 转换完成: ${converted.length}/${fbxFiles.length} 成功`);
  }

  return converted;
}

async function collectFbxFiles(dir: string, result: string[]): Promise<void> {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await collectFbxFiles(fullPath, result);
      } else if (entry.name.toLowerCase().endsWith('.fbx')) {
        result.push(fullPath);
      }
    }
  } catch {}
}

function isGDriveFolder(url: string): boolean {
  return url.includes('drive.google.com/drive/folders');
}

function resolveDownloadUrl(url: string): string {
  // Google Drive folder → downloadable ZIP
  // Format: https://drive.google.com/drive/folders/{folderId}?usp=sharing
  const folderMatch = url.match(/drive\.google\.com\/drive\/folders\/([^/?]+)/);
  if (folderMatch) {
    const folderId = folderMatch[1];
    return `https://drive.google.com/drive/folders/${folderId}?export=download`;
  }

  // Google Drive single file → direct download
  // Format: https://drive.google.com/file/d/{fileId}/view
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/);
  if (fileMatch) {
    const fileId = fileMatch[1];
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  return url;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 200) || 'download';
}
