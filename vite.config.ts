import { defineConfig } from 'vite';
import { execSync } from 'child_process';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { configEditor } from './.cursor/skills/config-editor/tool/plugin';
import { artBrowser } from './.cursor/skills/art-browser/tool/server/plugin';
import { schemas } from './tools/config-editor/schemas';

const DEV_PORT = 5173;
const PREVIEW_PORT = 4173;

function killOnPort(port: number): void {
  try {
    if (process.platform === 'win32') {
      const raw = execSync(
        `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction Stop).OwningProcess`,
        { encoding: 'utf-8', shell: 'powershell.exe', timeout: 5000 },
      ).trim();
      for (const line of raw.split(/\r?\n/)) {
        const pid = parseInt(line.trim(), 10);
        if (pid && pid !== process.pid) {
          execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore', timeout: 5000 });
          console.log(`[vite] killed process on port ${port} (PID ${pid})`);
        }
      }
    } else {
      const raw = execSync(`lsof -ti:${port}`, { encoding: 'utf-8', timeout: 5000 }).trim();
      for (const pid of raw.split('\n').map(Number).filter(Boolean)) {
        if (pid !== process.pid) {
          process.kill(pid);
          console.log(`[vite] killed process on port ${port} (PID ${pid})`);
        }
      }
    }
  } catch {
    /* port not in use */
  }
}

export default defineConfig(async ({ command, mode }) => {
  if (command === 'serve') {
    killOnPort(DEV_PORT);
    await new Promise((r) => setTimeout(r, 300));
  }

  // mode === 'single'：买量 Playable 单文件产物（零外部请求，内联所有资源）
  const single = mode === 'single';

  return {
    plugins: [
      configEditor(schemas),
      artBrowser(),
      ...(single ? [viteSingleFile()] : []),
    ],
    build: single
      ? { assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 8000 }
      : {},
    server: { port: DEV_PORT, strictPort: true },
    preview: { port: PREVIEW_PORT, strictPort: true },
  };
});
