import * as THREE from 'three'
import { PALETTE } from '../data/level.js'
import { rand } from './helpers.js'

/* ==========================================================================
   TEXTURAS: recortes reais (src/assets/cutouts) + desenhos provisórios em canvas

   Papel deste arquivo:
   1. Descobrir quais imagens de recorte existem na pasta src/assets/cutouts
      e carregá-las como texturas do Three.js (applyCutout).
   2. Enquanto a imagem não existe (ou ainda está carregando), desenhar um
      "recorte provisório" em um <canvas> 2D e usá-lo como textura.
   3. Desenhar outras texturas em canvas: papel do chão/ruas (makePaperTexture),
      planos com texto 3D (makeTextPlane) e a bicicleta provisória (makeBikeTexture).

   Depende de: three, PALETTE (cores) de data/level.js, rand de helpers.js.
   Quem usa: world/bike.js, world/environment.js, world/totems.js e main.js
   (whenAssetsReady, para liberar o botão "Pedalar").

   Onde mexer:
   - CUTOUTS: extensões de imagem aceitas (png, webp, avif, jpg, jpeg).
   - makeCutoutTexture: aparência do recorte provisório (cores, fita, fonte).
   - makePaperTexture: granulado e triângulos do papel do chão.
   - makeTextPlane: fonte e margens dos textos 3D (apresentação e horizonte).
   - makeBikeTexture: desenho da bike provisória (coordenadas em um canvas 512×512).
   ========================================================================== */

/**
 * Mapa "caminho → URL" de TODAS as imagens dentro de src/assets/cutouts.
 * O Vite monta essa lista na hora do build (import.meta.glob): basta colocar
 * um arquivo na pasta para ele aparecer aqui. As chaves têm o formato
 * '../assets/cutouts/formacoes/edu-1.webp'.
 */
const CUTOUTS = import.meta.glob('../assets/cutouts/**/*.{png,webp,avif,jpg,jpeg}', { eager: true, import: 'default' })

// Carregador de imagens do Three.js (reaproveitado para todos os recortes)
const textureLoader = new THREE.TextureLoader()
// Quantas imagens ainda estão sendo baixadas (0 = tudo pronto)
let pending = 0
// Funções esperando o carregamento terminar (promessas criadas por whenAssetsReady)
const waiters = []

/**
 * Chamada quando uma imagem termina (com sucesso ou erro). Diminui `pending`
 * e, quando chega a zero, avisa todo mundo que estava esperando.
 */
const settle = () => {
  if (--pending === 0) waiters.splice(0).forEach((resolve) => resolve())
}

/**
 * Promessa que resolve quando todos os recortes reais terminarem de carregar.
 * Se nada está carregando, resolve na hora. main.js usa para só liberar o
 * botão "Pedalar" quando as imagens estão prontas.
 * @returns {Promise<void>}
 */
export const whenAssetsReady = () => (pending ? new Promise((resolve) => waiters.push(resolve)) : Promise.resolve())

/**
 * true se existe um arquivo de imagem para o caminho `path` (ex.: 'intro/marina.webp').
 * @param {string|null} path caminho relativo a src/assets/cutouts/
 * @returns {boolean}
 */
export const hasCutout = (path) => Boolean(path && CUTOUTS[`../assets/cutouts/${path}`])

/**
 * Aplica o recorte `path` no material de um plano 3D.
 *
 * Como funciona:
 * 1. Primeiro coloca o desenho provisório (`makeFallback()`) para o objeto já
 *    aparecer na tela.
 * 2. Se a imagem real existir na pasta, baixa com o TextureLoader.
 * 3. Quando chega, troca o mapa do material, descarta o provisório e chama
 *    `onLoad(texture)` (quem chamou pode ajustar a proporção do plano).
 * 4. Se der erro (arquivo corrompido, por ex.), mantém o provisório e avisa no console.
 *
 * @param {THREE.Material} material material que vai receber a textura (map)
 * @param {string|null} path caminho dentro de src/assets/cutouts/ ou null
 * @param {() => THREE.Texture} makeFallback função que desenha o provisório
 * @param {(tex: THREE.Texture) => void} [onLoad] chamada após a imagem real carregar
 */
export function applyCutout(material, path, makeFallback, onLoad) {
  material.map = makeFallback()
  const url = path && CUTOUTS[`../assets/cutouts/${path}`]
  if (!url) return
  pending++
  textureLoader.load(
    url,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace // cores iguais às do arquivo (sem ficar "lavado")
      tex.anisotropy = 4 // nitidez quando o recorte é visto de lado/longe (1 a 16; maior = mais nítido e mais pesado)
      material.map.dispose() // libera a memória do provisório
      material.map = tex
      material.needsUpdate = true // avisa o Three.js que o material mudou
      onLoad?.(tex)
      settle()
    },
    undefined,
    () => {
      console.warn(`[portfolio] não foi possível carregar o recorte ${path}`)
      settle()
    },
  )
}

/**
 * Converte um <canvas> desenhado em textura do Three.js, já com o espaço de
 * cor correto (sRGB) e anisotropia para ficar nítido em ângulo.
 * @param {HTMLCanvasElement} source
 * @returns {THREE.CanvasTexture}
 */
export function toTexture(source) {
  const tex = new THREE.CanvasTexture(source)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/**
 * Quebra um texto em linhas que caibam na largura máxima (em pixels do canvas),
 * medindo palavra por palavra com a fonte atual do contexto (ctx.font).
 * @param {CanvasRenderingContext2D} ctx contexto com a fonte já definida
 * @param {string} text texto completo
 * @param {number} maxWidth largura máxima de cada linha, em px
 * @returns {string[]} linhas
 */
export function wrapText(ctx, text, maxWidth) {
  const lines = []
  let line = ''
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

/**
 * Desenha (sem preencher) um retângulo de contorno irregular, como um recorte
 * feito à tesoura. Percorre os quatro lados em pontos a cada `step` px,
 * deslocando cada ponto por um valor aleatório de até `jitter` px.
 * Quem chama decide depois: ctx.fill() ou ctx.stroke().
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x canto superior esquerdo
 * @param {number} y
 * @param {number} w largura
 * @param {number} h altura
 * @param {number} [jitter=8] irregularidade em px (maior = mais "rasgado")
 * @param {number} [step=40] distância entre os dentes em px (menor = mais dentes)
 */
export function jaggedPath(ctx, x, y, w, h, jitter = 8, step = 40) {
  const pts = []
  for (let i = 0; i <= w; i += step) pts.push([x + i, y + rand(-jitter, jitter)]) // lado de cima (esq → dir)
  for (let i = 0; i <= h; i += step) pts.push([x + w + rand(-jitter, jitter), y + i]) // lado direito (cima → baixo)
  for (let i = w; i >= 0; i -= step) pts.push([x + i, y + h + rand(-jitter, jitter)]) // lado de baixo (dir → esq)
  for (let i = h; i >= 0; i -= step) pts.push([x + rand(-jitter, jitter), y + i]) // lado esquerdo (baixo → cima)
  ctx.beginPath()
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)))
  ctx.closePath()
}

/**
 * Recorte provisório (enquanto a imagem real não existe): papel colorido com o
 * título em letras grandes, triângulos de colagem e uma "fita adesiva" no topo.
 *
 * Etapas do desenho (canvas de `width` × `height` px):
 * 1. Borda branca de papel com contorno rasgado.
 * 2. Miolo na cor do grupo (`color`), um pouco menor, também rasgado.
 * 3. 16 triângulos semitransparentes espalhados (colagem).
 * 4. Fita adesiva lilás levemente torta no topo.
 * 5. Título em caixa alta, com contorno preto; a fonte encolhe até cada
 *    palavra caber na largura (nunca corta palavra).
 * 6. Subtítulo menor, a 78% da altura.
 *
 * @param {object} o
 * @param {string} o.title título do recorte
 * @param {string} [o.subtitle=''] subtítulo (opcional)
 * @param {string} [o.color=PALETTE.purple] cor do miolo
 * @param {number} [o.width=512] largura do canvas em px
 * @param {number} [o.height=680] altura do canvas em px
 * @returns {THREE.CanvasTexture}
 */
export function makeCutoutTexture({ title, subtitle = '', color = PALETTE.purple, width = 512, height = 680 }) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d')

  // borda branca de papel + miolo colorido
  ctx.fillStyle = PALETTE.white
  jaggedPath(ctx, 14, 14, width - 28, height - 28, 9) // 14 px de margem; 9 px de irregularidade
  ctx.fill()
  ctx.fillStyle = color
  jaggedPath(ctx, 36, 36, width - 72, height - 72, 5) // miolo 22 px para dentro da borda
  ctx.fill()

  // triângulos de colagem (alpha aleatório entre 20% e 80%, tamanhos de 10 a 50 px)
  for (let i = 0; i < 16; i++) {
    ctx.globalAlpha = rand(0.2, 0.8)
    ctx.fillStyle = [PALETTE.black, PALETTE.white, PALETTE.lilac][i % 3]
    const x = rand(60, width - 60)
    const y = rand(60, height - 60)
    const s = rand(10, 50)
    ctx.beginPath()
    ctx.moveTo(x, y - s)
    ctx.lineTo(x + s, y + s)
    ctx.lineTo(x - s, y + s * rand(0.2, 1))
    ctx.fill()
  }
  ctx.globalAlpha = 1 // volta ao opaco para o resto do desenho

  // fita adesiva no topo: retângulo 120×32 px, centrado, girado até ±0,12 rad (≈7°)
  ctx.save()
  ctx.translate(width / 2, 30)
  ctx.rotate(rand(-0.12, 0.12))
  ctx.fillStyle = 'rgba(201, 182, 255, 0.75)'
  ctx.fillRect(-60, -16, 120, 32)
  ctx.restore()

  // título com contorno, encolhendo até caber
  const maxW = width - 100 // largura útil para o texto (50 px de margem de cada lado)
  const upper = title.toUpperCase()
  let size = width * 0.12 // tamanho inicial da fonte: 12% da largura do canvas
  const setFont = () => (ctx.font = `900 ${size}px "Arial Black", Impact, sans-serif`)
  setFont()
  // diminui 2 px por vez enquanto alguma palavra sozinha não couber (mínimo 14 px)
  while (size > 14 && upper.split(' ').some((w) => ctx.measureText(w).width > maxW)) {
    size -= 2
    setFont()
  }
  const lines = wrapText(ctx, upper, maxW)
  const lh = size * 1.1 // altura de linha = 110% do tamanho da fonte
  // centro vertical do bloco de texto: 42% da altura se há subtítulo, 52% se não
  const y0 = height * (subtitle ? 0.42 : 0.52) - ((lines.length - 1) * lh) / 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = PALETTE.black
  ctx.fillStyle = PALETTE.white
  ctx.lineWidth = size * 0.18 // espessura do contorno proporcional à fonte
  lines.forEach((l, i) => {
    ctx.strokeText(l, width / 2, y0 + i * lh) // contorno preto por baixo
    ctx.fillText(l, width / 2, y0 + i * lh) // letra branca por cima
  })
  if (subtitle) {
    ctx.font = `700 ${width * 0.055}px system-ui, sans-serif` // 5,5% da largura
    ctx.lineWidth = 6
    ctx.strokeText(subtitle, width / 2, height * 0.78)
    ctx.fillText(subtitle, width / 2, height * 0.78)
  }
  return toTexture(c)
}

/**
 * Textura de papel com granulado e triângulos sutis (chão e ruas).
 *
 * Desenho em um canvas 256×256 px:
 * 1. Fundo na cor `base`.
 * 2. 2500 pontinhos brancos quase transparentes (granulado do papel).
 * 3. 6 triângulos lilás bem suaves (colagem de fundo).
 * A textura repete lado a lado (RepeatWrapping) `repeat` vezes sobre o plano:
 * valor maior = grão mais fino; menor = grão mais grosso.
 * @param {string} base cor de fundo (hex ou rgba)
 * @param {number} [repeat=1] quantas vezes a textura se repete em cada eixo
 * @returns {THREE.CanvasTexture}
 */
export function makePaperTexture(base, repeat = 1) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 2500; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rand(0, 0.06)})` // até 6% de branco: granulado discreto
    ctx.fillRect(rand(0, 256), rand(0, 256), rand(1, 3), rand(1, 3)) // pontos de 1 a 3 px
  }
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(201,182,255,${rand(0.02, 0.06)})` // lilás a 2–6% de opacidade
    ctx.beginPath()
    ctx.moveTo(rand(0, 256), rand(0, 256))
    ctx.lineTo(rand(0, 256), rand(0, 256))
    ctx.lineTo(rand(0, 256), rand(0, 256))
    ctx.fill()
  }
  const tex = toTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping // repete em X e em Y
  tex.repeat.set(repeat, repeat)
  return tex
}

/**
 * Plano 3D com texto (usado na apresentação da Marina e na frase do horizonte).
 *
 * Como funciona:
 * 1. Mede o texto com a fonte e quebra em linhas que caibam em `canvasWidth - 100` px.
 * 2. Redimensiona o canvas para a quantidade de linhas (altura = linhas × fonte × 1,4 + 80 px
 *    de margem). Atenção: mudar o tamanho do canvas zera o contexto, por isso a
 *    fonte é definida de novo depois.
 * 3. Se `bg` foi informado, pinta um fundo com contorno rasgado.
 * 4. Escreve as linhas centralizadas, de cima para baixo.
 * 5. Devolve um Mesh (plano) com `width` metros de largura e altura proporcional.
 *
 * @param {string} text texto
 * @param {object} [o]
 * @param {number} [o.width=8] largura do plano em metros
 * @param {number} [o.fontSize=34] tamanho da fonte em px do canvas
 * @param {number} [o.canvasWidth=1024] largura do canvas em px (resolução do texto)
 * @param {string} [o.color=PALETTE.white] cor da letra
 * @param {string|null} [o.bg=null] cor do fundo (null = sem fundo, só letras)
 * @returns {THREE.Mesh}
 */
export function makeTextPlane(text, { width = 8, fontSize = 34, canvasWidth = 1024, color = PALETTE.white, bg = null } = {}) {
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')
  const font = `600 ${fontSize}px system-ui, "Segoe UI", sans-serif`
  ctx.font = font
  const lines = wrapText(ctx, text, canvasWidth - 100)
  c.width = canvasWidth
  c.height = lines.length * fontSize * 1.4 + 80 // redimensionar zera o contexto
  if (bg) {
    ctx.fillStyle = bg
    jaggedPath(ctx, 10, 10, c.width - 20, c.height - 20, 6, 60)
    ctx.fill()
  }
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  lines.forEach((l, i) => ctx.fillText(l, c.width / 2, 40 + i * fontSize * 1.4)) // 40 px de margem superior
  // transparent: o fundo do canvas fica invisível; depthWrite false: não "corta" objetos atrás
  const material = new THREE.MeshBasicMaterial({ map: toTexture(c), transparent: true, depthWrite: false, side: THREE.DoubleSide })
  return new THREE.Mesh(new THREE.PlaneGeometry(width, (width * c.height) / c.width), material)
}

/**
 * Bicicleta preta 2D com ciclista anônimo (virada para a direita), usada
 * enquanto não existe o arquivo src/assets/cutouts/avatar/bike.webp.
 *
 * Desenho em um canvas 512×512 px (origem no canto superior esquerdo):
 * - duas rodas: círculos de raio 90 px centrados em (130, 380) e (382, 380);
 * - quadro: linhas entre os pontos (130,380) → (230,260) → (350,260) → (382,380),
 *   mais o selim/pedal em (260,380);
 * - guidão: (350,260) → (340,215) → (375,210);
 * - ciclista: tronco (225,250) → (270,140), braço até (345,215), perna até (270,380)
 *   e cabeça = círculo de raio 42 px em (285, 95).
 * O desenho é feito duas vezes: primeiro em branco e grosso (contorno de papel),
 * depois em preto e mais fino por cima. Um "?" na cabeça indica avatar não identificado.
 * Para ajustar a bike provisória, mude as coordenadas dentro de `draw`.
 * @returns {THREE.CanvasTexture}
 */
export function makeBikeTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const ctx = c.getContext('2d')
  /** Desenha a bike inteira na cor `color` com linhas de espessura `lw` px. */
  const draw = (color, lw) => {
    Object.assign(ctx, { strokeStyle: color, fillStyle: color, lineWidth: lw, lineCap: 'round', lineJoin: 'round' })
    for (const x of [130, 382]) {
      ctx.beginPath()
      ctx.arc(x, 380, 90, 0, Math.PI * 2) // roda
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(130, 380); ctx.lineTo(230, 260); ctx.lineTo(350, 260); ctx.lineTo(382, 380) // quadro (parte de cima)
    ctx.moveTo(230, 260); ctx.lineTo(260, 380); ctx.lineTo(130, 380) // quadro (parte de baixo)
    ctx.moveTo(260, 380); ctx.lineTo(350, 260) // tubo do pedal ao guidão
    ctx.moveTo(350, 260); ctx.lineTo(340, 215); ctx.lineTo(375, 210) // guidão
    ctx.moveTo(225, 250); ctx.lineTo(270, 140); ctx.lineTo(345, 215) // tronco + braço
    ctx.moveTo(240, 250); ctx.lineTo(300, 300); ctx.lineTo(270, 380) // perna
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(285, 95, 42, 0, Math.PI * 2) // cabeça
    ctx.fill()
  }
  draw(PALETTE.white, 34) // contorno branco do recorte
  draw(PALETTE.black, 16) // traço preto por cima
  ctx.fillStyle = PALETTE.white
  ctx.font = '900 54px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('?', 285, 98) // avatar não identificado
  return toTexture(c)
}
