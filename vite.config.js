import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // サブパスでデプロイする場合（例: GitHub Pages の /wordig/）は base を指定する
  // base: '/wordig/',
  server: {
    open: true,  // npm run dev でブラウザを自動で開く
    port: 5173,
  },
});
