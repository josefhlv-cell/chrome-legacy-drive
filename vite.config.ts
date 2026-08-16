import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  build: {
    cssMinify: true,
    minify: 'esbuild',
    target: 'es2020',
    modulePreload: { polyfill: false },
    rollupOptions: {
      // onnxruntime-web (a jeho podcesty jako /webgpu) jsou volitelné,
      // dynamicky importované závislosti uvnitř @imgly/background-removal.
      // Nejsou nainstalované (a nepotřebujeme je), takže je necháme jako
      // "external" -- Vite je přeskočí při buildu místo toho, aby kvůli
      // chybějícímu modulu spadl celý build.
      external: (id) => id.startsWith('onnxruntime-web'),
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-tooltip', '@radix-ui/react-popover'],
        },
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
