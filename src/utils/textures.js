import * as THREE from 'three'
import { PALETTE } from '../data/level.js'
import { rand } from './helpers.js'

/* ==========================================================================
   Recortes reais (src/assets/cutouts) + placeholders gerados em canvas
   ========================================================================== */
const CUTOUTS = import.meta.glob('../assets/cutouts/**/*.{png,webp,avif,jpg,jpeg}', { eager: true, import: 'default' })

const textureLoader = new THREE.TextureLoader()
let pending = 0
const waiters = []
const settle = () => {
  if (--pending === 0) waiters.splice(0).forEach((resolve) => resolve())
}

/** Resolve quando todos os recortes reais terminarem de carregar (ou imediatamente). */
export const whenAssetsReady = () => (pending ? new Promise((resolve) => waiters.push(resolve)) : Promise.resolve())

export const hasCutout = (path) => Boolean(path && CUTOUTS[`../assets/cutouts/${path}`])

/**
 * Aplica o recorte `path` no material. Enquanto carrega (ou se não existir),
 * usa o placeholder de `makeFallback()`. `onLoad(texture)` permite ajustar a proporção.
 */
export function applyCutout(material, path, makeFallback, onLoad) {
  material.map = makeFallback()
  const url = path && CUTOUTS[`../assets/cutouts/${path}`]
  if (!url) return
  pending++
  textureLoader.load(
    url,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 4
      material.map.dispose()
      material.map = tex
      material.needsUpdate = true
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

export function toTexture(source) {
  const tex = new THREE.CanvasTexture(source)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

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

// Contorno irregular, como recorte feito à tesoura
export function jaggedPath(ctx, x, y, w, h, jitter = 8, step = 40) {
  const pts = []
  for (let i = 0; i <= w; i += step) pts.push([x + i, y + rand(-jitter, jitter)])
  for (let i = 0; i <= h; i += step) pts.push([x + w + rand(-jitter, jitter), y + i])
  for (let i = w; i >= 0; i -= step) pts.push([x + i, y + h + rand(-jitter, jitter)])
  for (let i = h; i >= 0; i -= step) pts.push([x + rand(-jitter, jitter), y + i])
  ctx.beginPath()
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)))
  ctx.closePath()
}

export function makeCutoutTexture({ title, subtitle = '', color = PALETTE.purple, width = 512, height = 680 }) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d')

  // borda branca de papel + miolo colorido
  ctx.fillStyle = PALETTE.white
  jaggedPath(ctx, 14, 14, width - 28, height - 28, 9)
  ctx.fill()
  ctx.fillStyle = color
  jaggedPath(ctx, 36, 36, width - 72, height - 72, 5)
  ctx.fill()

  // triângulos de colagem
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
  ctx.globalAlpha = 1

  // fita adesiva no topo
  ctx.save()
  ctx.translate(width / 2, 30)
  ctx.rotate(rand(-0.12, 0.12))
  ctx.fillStyle = 'rgba(201, 182, 255, 0.75)'
  ctx.fillRect(-60, -16, 120, 32)
  ctx.restore()

  // título com contorno, encolhendo até caber
  const maxW = width - 100
  const upper = title.toUpperCase()
  let size = width * 0.12
  const setFont = () => (ctx.font = `900 ${size}px "Arial Black", Impact, sans-serif`)
  setFont()
  while (size > 14 && upper.split(' ').some((w) => ctx.measureText(w).width > maxW)) {
    size -= 2
    setFont()
  }
  const lines = wrapText(ctx, upper, maxW)
  const lh = size * 1.1
  const y0 = height * (subtitle ? 0.42 : 0.52) - ((lines.length - 1) * lh) / 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = PALETTE.black
  ctx.fillStyle = PALETTE.white
  ctx.lineWidth = size * 0.18
  lines.forEach((l, i) => {
    ctx.strokeText(l, width / 2, y0 + i * lh)
    ctx.fillText(l, width / 2, y0 + i * lh)
  })
  if (subtitle) {
    ctx.font = `700 ${width * 0.055}px system-ui, sans-serif`
    ctx.lineWidth = 6
    ctx.strokeText(subtitle, width / 2, height * 0.78)
    ctx.fillText(subtitle, width / 2, height * 0.78)
  }
  return toTexture(c)
}

export function makePaperTexture(base, repeat = 1) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 2500; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rand(0, 0.06)})`
    ctx.fillRect(rand(0, 256), rand(0, 256), rand(1, 3), rand(1, 3))
  }
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(201,182,255,${rand(0.02, 0.06)})`
    ctx.beginPath()
    ctx.moveTo(rand(0, 256), rand(0, 256))
    ctx.lineTo(rand(0, 256), rand(0, 256))
    ctx.lineTo(rand(0, 256), rand(0, 256))
    ctx.fill()
  }
  const tex = toTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
  return tex
}

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
  lines.forEach((l, i) => ctx.fillText(l, c.width / 2, 40 + i * fontSize * 1.4))
  const material = new THREE.MeshBasicMaterial({ map: toTexture(c), transparent: true, depthWrite: false, side: THREE.DoubleSide })
  return new THREE.Mesh(new THREE.PlaneGeometry(width, (width * c.height) / c.width), material)
}

// Bicicleta preta 2D com ciclista anônimo (virada para a direita)
export function makeBikeTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const ctx = c.getContext('2d')
  const draw = (color, lw) => {
    Object.assign(ctx, { strokeStyle: color, fillStyle: color, lineWidth: lw, lineCap: 'round', lineJoin: 'round' })
    for (const x of [130, 382]) {
      ctx.beginPath()
      ctx.arc(x, 380, 90, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(130, 380); ctx.lineTo(230, 260); ctx.lineTo(350, 260); ctx.lineTo(382, 380)
    ctx.moveTo(230, 260); ctx.lineTo(260, 380); ctx.lineTo(130, 380)
    ctx.moveTo(260, 380); ctx.lineTo(350, 260)
    ctx.moveTo(350, 260); ctx.lineTo(340, 215); ctx.lineTo(375, 210) // guidão
    ctx.moveTo(225, 250); ctx.lineTo(270, 140); ctx.lineTo(345, 215) // tronco + braço
    ctx.moveTo(240, 250); ctx.lineTo(300, 300); ctx.lineTo(270, 380) // perna
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(285, 95, 42, 0, Math.PI * 2) // cabeça
    ctx.fill()
  }
  draw(PALETTE.white, 34) // contorno branco do recorte
  draw(PALETTE.black, 16)
  ctx.fillStyle = PALETTE.white
  ctx.font = '900 54px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('?', 285, 98) // avatar não identificado
  return toTexture(c)
}
