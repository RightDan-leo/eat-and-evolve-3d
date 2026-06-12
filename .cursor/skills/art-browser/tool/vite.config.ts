import { defineConfig } from 'vite';
import { unityAssetBrowserPlugin } from './server/plugin';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/__art-browser/' : '/',
  plugins: [unityAssetBrowserPlugin()],
  server: {
    port: 5200,
    open: true,
  },
  build: {
    outDir: 'client',
    emptyOutDir: true,
  },
}));
