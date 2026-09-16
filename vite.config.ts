import { defineConfig } from 'vite';
export default defineConfig({ server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] }, build: { target: 'es2022', rollupOptions: { input: { main: 'index.html', mc1: 'mc1.html' } } } });
