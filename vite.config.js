import { defineConfig } from 'vite';
import driveStreamHandler from './api/drive-stream.js';

export default defineConfig({
  server: {
    host: true,
    port: 5173
  },
  plugins: [
    {
      name: 'drive-stream-middleware',
      configureServer(server) {
        server.middlewares.use('/api/drive-stream', async (req, res, next) => {
          try {
            await driveStreamHandler(req, res);
          } catch (err) {
            console.error('Vite drive-stream error:', err);
            next(err);
          }
        });
      }
    }
  ]
});

