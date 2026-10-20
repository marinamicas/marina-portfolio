import { defineConfig } from 'vite'

export default defineConfig({
  // Caminhos relativos: funciona em usuario.github.io/qualquer-nome-de-repo/
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0, // recortes sempre como arquivos separados (melhor cache)
    chunkSizeWarningLimit: 1500, // three.js é grande, é esperado
  },
})
