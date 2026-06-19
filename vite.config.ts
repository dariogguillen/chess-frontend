import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
//
// `server.proxy` is the dev-only same-origin shim. Browser requests from
// `http://localhost:5173` to `/api/*` and `/ws` would normally trigger a
// cross-origin preflight against the Spring Boot backend on
// `http://localhost:8080`, which today's `CorsConfig.java` rejects on
// `X-Player-Id` (sent by move submission). The proxy turns those into
// same-origin requests: Vite intercepts the path-relative URL and forwards
// it to the backend with the `Host` header rewritten (`changeOrigin: true`).
// `ws: true` on `/ws` enables the WebSocket upgrade through the proxy so
// STOMP/SockJS works over the same channel.
//
// Production builds (`npm run build`) emit a static bundle served at the
// site root by Cloudflare Pages. No `base` is set: emitted `<script>` and
// `<link>` URLs in `index.html` resolve to `/assets/...` and React Router
// mounts at `/`. `VITE_BACKEND_URL` set in the Cloudflare dashboard points
// the bundle at the real backend origin; the SPA talks to it directly over
// CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true,
      },
      // The Google OAuth START navigation `/oauth2/authorization/google`
      // (a top-level browser navigation, not a fetch) must reach the
      // backend in dev where `backendUrl` is empty and the URL is
      // path-relative. Mirrors the `/api` entry. Google's own callback to
      // the backend (`/login/oauth2/code/google`) hits the backend origin
      // directly and needs no frontend proxy.
      '/oauth2': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
