import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 跟 web.nginx.conf.template 用同一個 API_UPSTREAM 慣例:本機開發預設打 localhost,
// 在 docker compose 裡(vite 跟 api 是不同 container)才需要指到 service name。
const apiUpstream = process.env.API_UPSTREAM ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: apiUpstream, changeOrigin: true },
      '/photos': { target: apiUpstream, changeOrigin: true },
    },
  },
});
