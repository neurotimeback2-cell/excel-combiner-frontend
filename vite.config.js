import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // In local dev the backend runs on :3000 (npm run dev in the backend repo). In production nginx does this.
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
});
