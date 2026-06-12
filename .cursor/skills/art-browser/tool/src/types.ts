export interface AssetInfo {
  name: string;
  relativePath: string;
  extension: string;
  type: AssetType;
  size: number;
  directory: string;
  width?: number;
  height?: number;
}

export type AssetType =
  | 'image'
  | 'model'
  | 'audio'
  | 'animation'
  | 'material'
  | 'shader'
  | 'prefab'
  | 'scene'
  | 'other';

export interface ScanResult {
  projectPath: string;
  scanTime: string;
  totalAssets: number;
  assets: AssetInfo[];
  folders: string[];
}

export const TYPE_META: Record<AssetType, { label: string; icon: string; color: string }> = {
  image:     { label: '图片',    icon: '🖼️', color: '#3fb950' },
  model:     { label: '3D 模型', icon: '📦', color: '#58a6ff' },
  audio:     { label: '音频',    icon: '🔊', color: '#d29922' },
  animation: { label: '动画',    icon: '🎬', color: '#f778ba' },
  material:  { label: '材质',    icon: '🎨', color: '#bc8cff' },
  shader:    { label: 'Shader',  icon: '✨', color: '#79c0ff' },
  prefab:    { label: 'Prefab',  icon: '🧩', color: '#ff7b72' },
  scene:     { label: '场景',    icon: '🗺️', color: '#ffa657' },
  other:     { label: '其他',    icon: '📄', color: '#8b949e' },
};

export const WEB_IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg',
]);

export const MODEL_EXTENSIONS_3D = new Set([
  '.fbx', '.obj', '.gltf', '.glb',
]);

export const WEB_AUDIO_EXTENSIONS = new Set([
  '.mp3', '.wav', '.ogg', '.flac', '.aac',
]);

export const FILTERABLE_TYPES: AssetType[] = [
  'image', 'model', 'audio', 'animation', 'material', 'shader', 'prefab', 'scene',
];

export type PathFilters = Partial<Record<AssetType, string[]>>;

// ─── Favorites ───────────────────────────────────────

export interface FavFolder {
  id: string;
  name: string;
  parentId: string | null;
}

export interface FavItem {
  assetPath: string;
  folderId: string | null;
  addedAt: number;
}

export interface FavoritesData {
  folders: FavFolder[];
  items: FavItem[];
}

// ─── Export Types ─────────────────────────────────────

export interface ExportConfig {
  outputDir: string;
  imageFormat: 'png' | 'webp';
  imageQuality: number;
  maxTextureSize: number;
  modelFormat: 'gltf' | 'glb';
  embedTextures: boolean;
  generateManifest: boolean;
  concurrency: number;
}

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  outputDir: '',
  imageFormat: 'png',
  imageQuality: 80,
  maxTextureSize: 2048,
  modelFormat: 'glb',
  embedTextures: true,
  generateManifest: true,
  concurrency: 4,
};

export interface ExportPreset {
  id: string;
  name: string;
  config: ExportConfig;
  createdAt: number;
}

export interface ExportRecord {
  id: string;
  timestamp: number;
  assetCount: number;
  successCount: number;
  failCount: number;
  outputDir: string;
  totalInputSize: number;
  totalOutputSize: number;
}

export interface ExportTask {
  taskId: string;
  assets: string[];
  config: ExportConfig;
}

export interface ExportStatus {
  taskId: string;
  current: number;
  total: number;
  currentFile: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  results: ExportResultItem[];
  error?: string;
}

export interface ExportResultItem {
  inputPath: string;
  outputPath: string;
  success: boolean;
  error?: string;
  inputSize: number;
  outputSize: number;
}

// ─── Search & Download Types ─────────────────────────

export interface SearchOptions {
  sources?: string[];
  type?: string;
  page?: number;
  pageSize?: number;
  /** When true, prefer models with embedded animations */
  animated?: boolean;
}

export interface SearchResultItem {
  id: string;
  name: string;
  source: string;
  thumbnail: string;
  author: string;
  license: string;
  formats: string[];
  downloadUrl?: string;
  /** Whether the model contains animations */
  animated?: boolean;
  /** Number of animation clips (if known) */
  animationCount?: number;
}

export interface SearchResult {
  query: string;
  items: SearchResultItem[];
  total: number;
  page: number;
  hasMore: boolean;
}

export interface AssetDetail {
  id: string;
  source: string;
  name: string;
  description: string;
  author: string;
  license: string;
  thumbnail: string;
  images: string[];
  formats: string[];
  downloadUrl: string;
  fileSize?: number;
}

export interface DownloadRequest {
  url: string;
  source: string;
  assetId: string;
  assetName: string;
  targetDir: string;
}

export type DownloadTaskStatus = 'downloading' | 'extracting' | 'completed' | 'failed' | 'cancelled';

export interface DownloadStatus {
  taskId: string;
  status: DownloadTaskStatus;
  progress: number;
  currentFile: string;
  error?: string;
  files?: string[];
}

export interface DownloadRecord {
  taskId: string;
  assetName: string;
  source: string;
  timestamp: number;
  status: DownloadTaskStatus;
  targetDir: string;
  files: string[];
}

export interface SiteInfo {
  id: string;
  name: string;
  icon: string;
}
