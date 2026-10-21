import { clamp } from '../utils/helpers.js'
import { registerGesture } from './invalidGestures.js'

/*
  Entrada por teclado, roda do mouse / trackpad e gestos do Safari.
  (Dedo e clique-e-arraste ficam em pointerControls.js, com Pointer Events.)

  Estratégia de performance:
  - Os listeners só ANOTAM valores (números simples); nada de mexer no DOM ou
    na câmera dentro deles. Eventos de roda podem chegar a 120+ por segundo,
    então o trabalho fica para o loop do jogo (gsap.ticker, em
    requestAnimationFrame), uma vez por frame.
  - Os únicos listeners não passivos são os que PRECISAM de preventDefault():
    roda/pinça do trackpad (senão o navegador dá zoom na página inteira) e os
    gestos do Safari.
*/

/** Estado lido pela bike a cada frame (teclado). */
export const input = { forward: 0, turn: 0, boost: false }

/** Sensibilidades. Ajuste aqui para deixar os controles mais rápidos ou mais suaves. */
export const SETTINGS = {
  zoom: {
    wheel: 0.0014, // por pixel de roda do mouse (1 "clique" ≈ 100 px ≈ 15% de zoom)
    trackpadPinch: 0.012, // por pixel da pinça no trackpad (Chrome/Edge/Firefox enviam como Ctrl + roda)
    key: 0.16, // por toque nas teclas + e −
  },
  drag: {
    bikeHitRadius: 44, // px mínimos ao redor da bike que contam como "pegar a bike" (bom para dedos)
    edgeMargin: 0.1, // fração da tela perto das bordas que faz a câmera andar ao arrastar a bike
    edgeSpeed: 28, // metros por segundo da câmera quando a bike é arrastada até a borda
  },
  tap: {
    maxMove: 10, // px: mais que isso já é arraste, não toque
    maxTime: 260, // ms: mais que isso já é "segurar"
    doubleGap: 320, // ms entre dois toques para contar como toque duplo
  },
  longPressMs: 900, // dedo parado no cenário por esse tempo = gesto inválido "segurar"
}

/* ==========================================================================
   Zoom acumulado entre um frame e outro
   Valor em escala logarítmica: positivo afasta a câmera, negativo aproxima.
   Somar logaritmos = multiplicar fatores, então gestos rápidos não "pulam".
   ========================================================================== */
let zoomLog = 0
let resetRequested = false

/** Soma um zoom relativo (usado pela pinça de dedos em pointerControls.js). */
export function addZoom(logDelta) {
  zoomLog += logDelta
}

/** Pede para voltar ao zoom normal e recentralizar na bike (toque duplo, duplo clique, tecla 0). */
export function requestViewReset() {
  resetRequested = true
}

/** Entrega o zoom acumulado desde o último frame e zera o acumulador. */
export function consumeZoom() {
  const result = { delta: zoomLog, reset: resetRequested }
  zoomLog = 0
  resetRequested = false
  return result
}

/* ==========================================================================
   Teclado
   ========================================================================== */
const keys = new Set()

// Teclas que controlam o jogo
const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'])
const ZOOM_IN_KEYS = new Set(['Equal', 'NumpadAdd'])
const ZOOM_OUT_KEYS = new Set(['Minus', 'NumpadSubtract'])
const ZOOM_RESET_KEYS = new Set(['Digit0', 'Numpad0'])
// Teclas comuns de navegação/acessibilidade: nunca contam como "erro"
const NEUTRAL_KEYS = new Set([
  'Escape', 'Tab', 'Enter', 'NumpadEnter', 'Space', 'CapsLock', 'ContextMenu', 'PrintScreen',
  'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight',
])

// Está digitando em um campo? Então nenhuma tecla é do jogo.
const isTyping = (el) => el?.closest?.('input, textarea, select, [contenteditable="true"]')

addEventListener('keydown', (e) => {
  if (isTyping(e.target)) return
  if (e.code.startsWith('Arrow')) e.preventDefault() // setas não rolam a página
  // Atalhos com Ctrl/Alt/Cmd (Ctrl + para zoom do navegador, Ctrl + R…) ficam com o navegador
  if (e.ctrlKey || e.altKey || e.metaKey) return
  keys.add(e.code)

  if (ZOOM_IN_KEYS.has(e.code)) zoomLog -= SETTINGS.zoom.key
  else if (ZOOM_OUT_KEYS.has(e.code)) zoomLog += SETTINGS.zoom.key
  else if (ZOOM_RESET_KEYS.has(e.code)) resetRequested = true
  else if (!GAME_KEYS.has(e.code) && !NEUTRAL_KEYS.has(e.code) && !/^F\d{1,2}$/.test(e.code) && !e.repeat) {
    registerGesture('unsupported-key', 'desktop')
  }
})
addEventListener('keyup', (e) => keys.delete(e.code))

// Trocou de aba/janela com tecla pressionada: solta tudo para a bike não seguir sozinha
addEventListener('blur', () => keys.clear())

/* ==========================================================================
   Roda do mouse e trackpad
   ========================================================================== */
// Converte deltaMode (pixels, linhas ou páginas) para pixels: cada navegador usa um
const toPixels = (e, v) => (e.deltaMode === 1 ? v * 16 : e.deltaMode === 2 ? v * innerHeight : v)

addEventListener(
  'wheel',
  (e) => {
    // Pinça no trackpad chega como Ctrl + roda: bloqueia SEMPRE para não dar zoom na página inteira
    if (e.ctrlKey) e.preventDefault()
    if (e.target.closest?.('.modal')) return // dentro das janelas a roda rola o texto normalmente
    e.preventDefault() // sem "efeito elástico" da página no macOS

    let x = toPixels(e, e.deltaX)
    let y = toPixels(e, e.deltaY)
    // Shift + roda vira rolagem horizontal em alguns navegadores; Shift é o turbo, então trata como vertical
    if (e.shiftKey && !y) [x, y] = [0, x]

    if (e.ctrlKey) {
      zoomLog += clamp(y, -60, 60) * SETTINGS.zoom.trackpadPinch
    } else if (Math.abs(x) > Math.abs(y) * 2 && Math.abs(x) > 2) {
      registerGesture('horizontal-scroll', 'desktop') // deslizar dois dedos para os lados
    } else {
      zoomLog += clamp(y, -120, 120) * SETTINGS.zoom.wheel // limita "cliques" muito grandes de alguns mouses
    }
  },
  { passive: false }, // precisa ser não passivo para o preventDefault() funcionar
)

/* ==========================================================================
   Safari (macOS e iOS): pinça chega como gesturestart/gesturechange.
   No iOS, a pinça de dedos no canvas já é tratada pelos Pointer Events
   (pointerControls.js); aqui só bloqueamos o zoom da página e tratamos a
   pinça do trackpad do Mac.
   ========================================================================== */
let gestureScale = 1
let touchPointers = 0 // dedos na tela agora (para não contar a pinça duas vezes no iOS)
addEventListener('pointerdown', (e) => e.pointerType === 'touch' && touchPointers++, { passive: true, capture: true })
for (const type of ['pointerup', 'pointercancel']) {
  addEventListener(type, (e) => e.pointerType === 'touch' && (touchPointers = Math.max(0, touchPointers - 1)), { passive: true, capture: true })
}

function onSafariGesture(e) {
  e.preventDefault()
  if (e.type === 'gesturechange' && touchPointers < 2 && e.scale > 0) {
    zoomLog += Math.log(gestureScale / e.scale)
  }
  gestureScale = e.type === 'gestureend' ? 1 : e.scale
}
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) addEventListener(type, onSafariGesture, { passive: false })

/**
 * Chamado uma vez por frame pelo loop do jogo. Lê o teclado para `input`.
 * Com `blocked` (janela aberta, rebobinando…) a bike fica parada.
 */
export function readInput(blocked) {
  if (blocked) return Object.assign(input, { forward: 0, turn: 0, boost: false })
  const k = (...codes) => codes.some((c) => keys.has(c))
  input.forward = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown')
  input.turn = k('KeyA', 'ArrowLeft') - k('KeyD', 'ArrowRight')
  input.boost = k('ShiftLeft', 'ShiftRight')
  return input
}
