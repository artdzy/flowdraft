import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const config = {
    supabaseUrl: env.SUPABASE_URL ?? '',
    supabaseAnonKey: env.SUPABASE_ANON_KEY ?? '',
  };

  return {
    plugins: [
      react(),
      {
        // In production server.js serves /config.js from runtime env; mirror it in dev.
        name: 'flowdraft-dev-config',
        configureServer(server) {
          server.middlewares.use('/config.js', (_req, res) => {
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Cache-Control', 'no-store');
            res.end(`window.__FLOWDRAFT__=${JSON.stringify(config)};`);
          });
        },
      },
    ],
    build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  };
});
