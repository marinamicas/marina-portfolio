import { defineConfig } from 'vite'

/* ==========================================================================
   CONFIGURAÇÃO DO VITE (ferramenta que roda o site em desenvolvimento e gera
   a versão final na pasta dist/)

   Comandos (package.json):
   - npm run dev      → servidor local com recarga automática (http://localhost:5173)
   - npm run build    → gera dist/ (é o que o GitHub Actions publica)
   - npm run preview  → serve o dist/ localmente para testar a versão final

   Onde mexer:
   - base: prefixo dos caminhos no HTML final. './' = relativo, funciona em
     qualquer endereço (usuario.github.io/repo/ ou domínio próprio).
   - assetsInlineLimit: 0 mantém TODAS as imagens como arquivos separados
     (em vez de embutir as pequenas no JS) → melhor cache no navegador.
   - chunkSizeWarningLimit: tamanho (kB) a partir do qual o build avisa que um
     arquivo JS está grande; three.js sozinho passa de 500 kB, então subimos para 1500.
   ========================================================================== */
export default defineConfig({
  // Caminhos relativos: funciona em usuario.github.io/qualquer-nome-de-repo/
  base: './',
  build: {
    outDir: 'dist', // pasta de saída do build
    assetsInlineLimit: 0, // recortes sempre como arquivos separados (melhor cache)
    chunkSizeWarningLimit: 1500, // three.js é grande, é esperado
  },
})
