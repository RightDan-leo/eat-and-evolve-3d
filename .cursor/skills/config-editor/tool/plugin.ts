import type { Plugin, ViteDevServer } from 'vite';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, join, extname, relative } from 'path';
import type { ConfigSchema } from './types';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const ASSET_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.fbx': 'application/octet-stream',
};

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const MODEL_EXTS = new Set(['.glb', '.gltf', '.fbx']);
const ASSET_EXTS = new Set([...IMAGE_EXTS, ...MODEL_EXTS]);

const BASE = '/__config';

interface AssetInfo {
  path: string;
  name: string;
  type: 'image' | 'model';
  size: number;
}

function scanAssets(dir: string, rootDir: string): AssetInfo[] {
  const result: AssetInfo[] = [];
  if (!existsSync(dir)) return result;

  function walk(current: string) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        const ext = extname(entry.name).toLowerCase();
        if (ASSET_EXTS.has(ext)) {
          result.push({
            path: relative(rootDir, fullPath).replace(/\\/g, '/'),
            name: entry.name,
            type: IMAGE_EXTS.has(ext) ? 'image' : 'model',
            size: statSync(fullPath).size,
          });
        }
      }
    }
  }

  walk(dir);
  return result;
}

export function configEditor(schemas: ConfigSchema[]): Plugin {
  let configDir: string;
  let clientDir: string;
  let projectRoot: string;
  let previewTsPath: string;
  let viteServer: ViteDevServer;

  return {
    name: 'config-editor',
    apply: 'serve',

    configResolved(config) {
      projectRoot = config.root;
      configDir = resolve(config.root, 'src/config/data');
      clientDir = resolve(config.root, '.cursor/skills/config-editor/tool/client');
      previewTsPath = resolve(config.root, 'tools/config-editor/preview.ts');
    },

    configureServer(server) {
      viteServer = server;
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];
        if (!url.startsWith(BASE)) return next();

        const path = url.slice(BASE.length) || '/';

        // --- API: schemas ---
        if (path === '/api/schemas') {
          json(res, schemas);
          return;
        }

        // --- API: all configs ---
        if (path === '/api/configs') {
          const configs: Record<string, unknown> = {};
          for (const s of schemas) {
            configs[s.file] = JSON.parse(readFileSync(resolve(configDir, s.file), 'utf-8'));
          }
          json(res, configs);
          return;
        }

        // --- API: write config ---
        if (path.startsWith('/api/config/') && req.method === 'PUT') {
          const filename = decodeURIComponent(path.slice('/api/config/'.length));
          if (!schemas.some(s => s.file === filename)) {
            res.statusCode = 404;
            json(res, { error: 'Unknown config file' });
            return;
          }
          let body = '';
          req.on('data', (chunk: Buffer) => (body += chunk.toString()));
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              writeFileSync(
                resolve(configDir, filename),
                JSON.stringify(data, null, 2) + '\n',
              );
              json(res, { ok: true });
            } catch (e: any) {
              res.statusCode = 400;
              json(res, { error: e.message });
            }
          });
          return;
        }

        // --- API: list assets ---
        if (path === '/api/assets') {
          const assets = [
            ...scanAssets(resolve(projectRoot, 'assets'), projectRoot),
            ...scanAssets(resolve(projectRoot, 'public', 'assets'), projectRoot),
          ];
          json(res, assets);
          return;
        }

        // --- Preview module (served through Vite transform for Three.js) ---
        if (path === '/preview.js') {
          if (!existsSync(previewTsPath)) {
            res.statusCode = 404;
            json(res, { error: 'preview.ts not found — copy template from SKILL for 3D preview' });
            return;
          }
          const tsRelative = '/' + relative(projectRoot, previewTsPath).replace(/\\/g, '/');
          viteServer
            .transformRequest(tsRelative)
            .then((result) => {
              if (result) {
                res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
                res.end(result.code);
              } else {
                res.statusCode = 500;
                res.end('Transform failed');
              }
            })
            .catch(() => {
              res.statusCode = 500;
              res.end('Transform error');
            });
          return;
        }

        // --- Check if preview module is available ---
        if (path === '/api/preview-available') {
          json(res, { available: existsSync(previewTsPath) });
          return;
        }

        // --- Serve asset files for preview ---
        if (path.startsWith('/file/')) {
          const relPath = decodeURIComponent(path.slice('/file/'.length));
          const ext = extname(relPath).toLowerCase();
          if (!ASSET_EXTS.has(ext)) {
            res.statusCode = 403;
            json(res, { error: 'Forbidden file type' });
            return;
          }
          const filePath = resolve(projectRoot, relPath);
          try {
            const content = readFileSync(filePath);
            res.setHeader('Content-Type', ASSET_MIME[ext] || 'application/octet-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.end(content);
          } catch {
            res.statusCode = 404;
            json(res, { error: 'File not found' });
          }
          return;
        }

        // --- Static client files ---
        const filePath = path === '/' ? join(clientDir, 'index.html') : join(clientDir, path);
        try {
          const content = readFileSync(filePath, 'utf-8');
          res.setHeader('Content-Type', MIME[extname(filePath)] || 'text/plain');
          res.end(content);
        } catch {
          next();
        }
      });

      server.httpServer?.once('listening', () => {
        const addr = server.httpServer?.address();
        const port = (typeof addr === 'object' && addr) ? addr.port : '5173';
        setTimeout(() => {
          console.log(`  \x1b[36m⚡ Config Editor:\x1b[0m http://localhost:${port}${BASE}/`);
        }, 100);
      });
    },
  };
}

function json(res: any, data: unknown) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
