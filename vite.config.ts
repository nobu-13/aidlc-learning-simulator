import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// hosting-neutral base: AWS(CloudFront) と GitHub Pages で同一 source を配信する。
// hosting 差異は deployment configuration（環境変数 VITE_BASE）として扱い、別実装を作らない（NFR6）。
// 既定は "/"（CloudFront root 配信）。GitHub Pages 等 subpath 配信時は VITE_BASE="/<repo>/" を渡す。
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    // inline script を避け CSP を厳格化しやすくする（security-design §5）。
    assetsInlineLimit: 0,
    target: "es2022",
    sourcemap: false,
  },
});
