import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import os from 'os';

// Prevent Vite preview / dev from crashing due to common lingering browser socket errors.
process.on('uncaughtException', (err) => {
  if (err.code === 'ECONNRESET' || err.code === 'ECONNABORTED') {
    // These are common when browser tabs are closed or refreshed during proxying/HMR.
    // We log them as a single line to keep the console clean but don't exit.
    console.log(`[Vite] Ignored ${err.code} (connection reset by peer/browser).`);
  } else {
    console.error('Fatal Uncaught Exception:', err);
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  if (reason && reason.code === 'ECONNRESET') {
    console.log('[Vite] Ignored unhandled ECONNRESET rejection.');
  } else {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  }
});

function getNetworkIp() {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    if (/virtual|vbox|vmware|hyper-v/i.test(name)) continue;
    for (const info of interfaces[name]) {
      if (info.family === 'IPv4' && !info.internal && info.address !== '192.168.56.1') {
        return info.address;
      }
    }
  }
  return '127.0.0.1';
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProd = mode === 'production';
  const detectedIp = getNetworkIp();

  const host = (env.VITE_HOST === 'auto' || !env.VITE_HOST) ? detectedIp : env.VITE_HOST;
  const rawApiTarget = env.VITE_API_TARGET || 'http://AUTO_IP:5000';
  const apiTarget = rawApiTarget.replace('AUTO_IP', host);

  const allowedHostsRaw = env.VITE_ALLOWED_HOSTS || 'internship.adityauniversity.in';
  const allowedHosts = allowedHostsRaw.toLowerCase() === 'all'
    ? true
    : allowedHostsRaw.split(',').map((h) => h.trim());

  if (Array.isArray(allowedHosts)) {
    if (!allowedHosts.includes(host)) allowedHosts.push(host);
    if (!allowedHosts.includes('localhost')) allowedHosts.push('localhost');
    if (!allowedHosts.includes('127.0.0.1')) allowedHosts.push('127.0.0.1');
  }

  return {
    plugins: [react()],

    // MUI is now excluded — Vite + esbuild tree-shake it via named imports.
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react-router-dom',
        'notistack'
      ]
    },

    esbuild: {
      keepNames: false,
      // Drop console.* and debugger in production builds
      drop: isProd ? ['console', 'debugger'] : ['debugger'],
      jsx: 'automatic'
    },

    server: {
      host,
      port: 5173,
      strictPort: true,
      allowedHosts,
      warmup: {
        clientFiles: [
          './src/main.jsx',
          './src/App.jsx',
          './src/layouts/AdminSidebar.jsx',
          './src/layouts/HODSidebar.jsx',
          './src/pages/Admin/AdminDashboard.jsx',
          './src/pages/Admin/AdminStudents.jsx',
          './src/pages/HOD/HODDashboard.jsx',
          './src/pages/Student/StudentDashboard.jsx',
          './src/components/common/DataTable.jsx',
          './src/pages/Landing/LandingPage.jsx'
        ]
      },
      watch: { usePolling: false, interval: 100 },
      hmr: { timeout: 30000, overlay: true },
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('Proxy error', err.message);
            });
          }
        }
      }
    },

    build: {
      target: 'esnext',
      minify: 'esbuild',
      cssCodeSplit: true,
      chunkSizeWarningLimit: 800,
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            // React core — changes rarely, aggressive long-term caching
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router') ||
              id.includes('node_modules/scheduler/')
            ) {
              return 'react-vendor';
            }
            // MUI icons — very large, separate chunk
            if (id.includes('node_modules/@mui/icons-material')) {
              return 'mui-icons';
            }
            // MUI core
            if (id.includes('node_modules/@mui/material') || id.includes('node_modules/@mui/system') || id.includes('node_modules/@mui/styled-engine')) {
              return 'mui-core';
            }
            // Emotion (MUI styling engine)
            if (id.includes('node_modules/@emotion/')) {
              return 'emotion';
            }
            // xlsx is large (~800KB uncompressed) — separate chunk loaded only when needed
            if (id.includes('node_modules/xlsx')) {
              return 'xlsx';
            }
            // notistack — notification library
            if (id.includes('node_modules/notistack')) {
              return 'notistack';
            }
          }
        }
      }
    },

    preview: {
      host,
      port: 5173,
      strictPort: true,
      allowedHosts,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('Proxy error', err.message);
            });
          }
        }
      }
    }
  };
});
