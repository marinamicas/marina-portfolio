import { PROFILE } from '../data/level.js'

/* ==========================================================================
   ONDE ESTÁ A FOTO DE PERFIL

   Módulo pequeno e sem dependências de interface: só descobre a URL final da
   foto em src/assets/images/<PROFILE.image>. Fica separado de ui/profile.js para
   que o recorte da apresentação (world/totems.js) também possa usar a foto sem
   criar importações circulares entre os módulos.

   Usado por: ui/profile.js (miniatura, céu, janela "Sobre") e world/totems.js
   (cartão do primeiro recorte).
   ========================================================================== */

/**
 * Todas as imagens da pasta src/assets/images/, descobertas pelo Vite na hora do build.
 * Chave: caminho relativo (ex.: '../assets/images/profile.jpeg'); valor: URL final do arquivo.
 */
const IMAGES = import.meta.glob('../assets/images/*.{png,webp,avif,jpg,jpeg}', { eager: true, import: 'default' })

/** URL da foto de perfil real, ou null se o arquivo ainda não foi colocado na pasta. */
export const PHOTO_URL = IMAGES[`../assets/images/${PROFILE.image}`] ?? null
