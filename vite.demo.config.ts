import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

// Single-file demo build (MemoryRouter) for hosting as one HTML page.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  define: { 'import.meta.env.VITE_DEMO': '"1"' },
  build: { outDir: 'dist-demo', chunkSizeWarningLimit: 4000 },
});
