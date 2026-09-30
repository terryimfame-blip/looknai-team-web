import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/looknai-team-web/' : '/',
  server: { host: '127.0.0.1' },
}));
