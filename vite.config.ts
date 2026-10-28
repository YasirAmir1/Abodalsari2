import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api/apisports': {
          target: 'https://v3.football.api-sports.io',
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/api\/apisports/, ''),
          headers: {
            'x-apisports-key': '3245db41976cfeae9ceed6f34f14fbc2'
          }
        },
        '/api/football': {
          target: 'https://api.football-data.org/v4',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/football/, '')
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-xlsx': ['xlsx'],
            'vendor-pdf': ['jspdf'],
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            'vendor-react': ['react', 'react-dom'],
            'vendor-icons': ['lucide-react']
          }
        }
      }
    }
  };
});
