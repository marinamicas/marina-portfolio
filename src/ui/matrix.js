import { viewport } from '../core/stage.js'
import { REDUCED_MOTION } from '../utils/helpers.js'

/* ==========================================================================
   CHUVA DIGITAL ESTILO "MATRIX" (efeito do rebobinar)

   Enquanto a bike rebobina (src/core/timeMachine.js), um <canvas> transparente
   por cima do jogo desenha colunas de caracteres verdes caindo rápido, como no
   filme. O CSS (body.is-rewinding) ainda deixa a cena verde e escura e mostra o
   letreiro "◀◀ REBOBINANDO" em verde neon.

   Como desenha: a cada quadro pinta um véu preto semitransparente por cima do
   quadro anterior (o rastro some aos poucos) e desenha um caractere novo no
   "topo" de cada coluna, que desce um passo por quadro. O primeiro caractere de
   cada coluna é quase branco (a "cabeça" da gota).

   Só roda durante o rebobinar (startMatrix/stopMatrix), então não gasta bateria
   no resto do tempo.

   Dependências: stage.js (viewport, área do jogo), helpers (REDUCED_MOTION).
   Usado por: timeMachine.js.

   Onde mexer:
   - GLYPHS: caracteres sorteados.
   - FONT_PX: tamanho dos caracteres (maior = menos colunas).
   - SPEED: quantas linhas cada coluna desce por quadro.
   - Cor: '#00ff66' (rastro) e '#d9ffe4' (cabeça) em draw().
   ========================================================================== */

const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン0123456789MMJ<>/'
const FONT_PX = 18
const SPEED = 1.6

const canvas = document.createElement('canvas')
canvas.className = 'matrix-rain'
canvas.setAttribute('aria-hidden', 'true')
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')

/** Linha atual (em caracteres) de cada coluna; negativa = ainda acima da tela. */
let drops = []
let running = false
let raf = 0

/** Ajusta o tamanho do canvas à área do jogo e recria as colunas. */
function resize() {
  canvas.width = Math.max(1, Math.round(viewport.width))
  canvas.height = Math.max(1, Math.round(viewport.height))
  const cols = Math.ceil(canvas.width / FONT_PX)
  drops = Array.from({ length: cols }, () => -Math.random() * (canvas.height / FONT_PX))
}

/** Desenha um quadro da chuva e agenda o próximo enquanto estiver rodando. */
function draw() {
  if (!running) return
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)' // véu que apaga o rastro aos poucos
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.font = `700 ${FONT_PX}px ui-monospace, Consolas, monospace`
  for (let i = 0; i < drops.length; i++) {
    const y = drops[i] * FONT_PX
    const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0]
    ctx.fillStyle = '#d9ffe4' // cabeça da gota
    ctx.fillText(ch, i * FONT_PX, y)
    ctx.fillStyle = '#00ff66' // rastro logo acima
    ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * FONT_PX, y - FONT_PX)
    drops[i] += SPEED
    if (y > canvas.height && Math.random() > 0.96) drops[i] = -Math.random() * 10 // recomeça do topo
  }
  raf = requestAnimationFrame(draw)
}

/** Liga a chuva (chamada ao começar o rebobinar). */
export function startMatrix() {
  if (running || REDUCED_MOTION) return // quem pediu menos animação fica só com o filtro verde
  running = true
  resize()
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  raf = requestAnimationFrame(draw)
}

/** Desliga a chuva (chamada ao terminar o rebobinar). */
export function stopMatrix() {
  running = false
  cancelAnimationFrame(raf)
  setTimeout(() => !running && ctx.clearRect(0, 0, canvas.width, canvas.height), 300) // espera o CSS esmaecer
}

addEventListener('viewport-change', () => running && resize())
