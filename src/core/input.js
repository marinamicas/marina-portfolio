import { clamp } from '../utils/helpers.js'
import { registerGesture } from './invalidGestures.js'

/* ==========================================================================
   ENTRADA: TECLADO, RODA DO MOUSE / TRACKPAD E GESTOS DO SAFARI

   Papel deste arquivo:
   - Ler o teclado (W A S D / setas / Shift) para o objeto `input`, que a bike
     consome a cada frame.
   - Transformar roda do mouse, pinça do trackpad e teclas + / − / 0 em um
     "zoom acumulado" que o loop do jogo entrega à câmera uma vez por frame.
   - Guardar todas as sensibilidades em SETTINGS, num só lugar.
   (Dedo e clique-e-arraste ficam em pointerControls.js, com Pointer Events.)

   Estratégia de performance:
   - Os listeners só ANOTAM valores (números simples); nada de mexer no DOM ou
     na câmera dentro deles. Eventos de roda podem chegar a 120+ por segundo,
     então o trabalho fica para o loop do jogo (gsap.ticker, em
     requestAnimationFrame), uma vez por frame.
   - Os únicos listeners não passivos são os que PRECISAM de preventDefault():
     roda/pinça do trackpad (senão o navegador dá zoom na página inteira) e os
     gestos do Safari.

   Dependências: clamp (utils/helpers.js), registerGesture (invalidGestures.js).
   Quem usa: main.js (readInput, consumeZoom, SETTINGS), pointerControls.js
   (addZoom, requestViewReset, SETTINGS), world/bike.js (lê `input`).

   Onde mexer:
   - SETTINGS.zoom.*: velocidade do zoom por roda, pinça do trackpad e teclas.
   - SETTINGS.drag.*: raio para "pegar" a bike, faixa e velocidade da borda da tela.
   - SETTINGS.tap.*: o que conta como toque, segurar e toque duplo.
   - SETTINGS.longPressMs: tempo parado que vira o gesto inválido "segurar".
   - GAME_KEYS / NEUTRAL_KEYS: quais teclas o jogo usa e quais nunca viram aviso.
   ========================================================================== */

/**
 * Estado lido pela bike a cada frame (teclado).
 * - forward: 1 (frente), −1 (ré) ou 0
 * - turn:    1 (esquerda), −1 (direita) ou 0
 * - boost:   true com Shift pressionado (turbo)
 * É sobrescrito por readInput() uma vez por frame.
 */
export const input = { forward: 0, turn: 0, boost: false }

/** Sensibilidades. Ajuste aqui para deixar os controles mais rápidos ou mais suaves. */
export const SETTINGS = {
  zoom: {
    wheel: 0.0014, // por pixel de roda do mouse (1 "clique" ≈ 100 px ≈ 15% de zoom). Maior = zoom mais rápido
    trackpadPinch: 0.012, // por pixel da pinça no trackpad (Chrome/Edge/Firefox enviam como Ctrl + roda). Menor = mais suave
    key: 0.16, // por toque nas teclas + e − (escala logarítmica: 0.16 ≈ 17% por toque)
  },
  drag: {
    bikeHitRadius: 44, // px mínimos ao redor da bike que contam como "pegar a bike" (bom para dedos). Maior = mais fácil pegar
    edgeMargin: 0.1, // fração da tela perto das bordas que faz a câmera andar ao arrastar a bike (0.1 = 10% de cada lado)
    edgeSpeed: 28, // metros por segundo da câmera quando a bike é arrastada até a borda
  },
  tap: {
    maxMove: 10, // px: mais que isso já é arraste, não toque
    maxTime: 260, // ms: mais que isso já é "segurar"
    doubleGap: 320, // ms entre dois toques para contar como toque duplo. Maior = toque duplo mais fácil de acertar
  },
  longPressMs: 900, // dedo parado no cenário por esse tempo = gesto inválido "segurar"
}

/* ==========================================================================
   Zoom acumulado entre um frame e outro
   Valor em escala logarítmica: positivo afasta a câmera, negativo aproxima.
   Somar logaritmos = multiplicar fatores, então gestos rápidos não "pulam".
   ========================================================================== */
let zoomLog = 0 // soma dos zooms pedidos desde o último frame (zerado por consumeZoom)
let resetRequested = false // true quando alguém pediu "zoom normal + câmera na bike" (toque duplo, tecla 0)

/**
 * Soma um zoom relativo (usado pela pinça de dedos em pointerControls.js).
 * @param {number} logDelta - positivo afasta, negativo aproxima
 */
export function addZoom(logDelta) {
  zoomLog += logDelta
}

/** Pede para voltar ao zoom normal e recentralizar na bike (toque duplo, duplo clique, tecla 0). */
export function requestViewReset() {
  resetRequested = true
}

/**
 * Entrega o zoom acumulado desde o último frame e zera o acumulador.
 * Chamada UMA vez por frame pelo loop (main.js), que repassa `delta` para
 * rig.zoomBy() e, se `reset` for true, chama rig.resetZoom() + rig.recenter().
 * @returns {{delta: number, reset: boolean}}
 */
export function consumeZoom() {
  const result = { delta: zoomLog, reset: resetRequested }
  zoomLog = 0
  resetRequested = false
  return result
}

/* ==========================================================================
   Teclado
   ========================================================================== */
const keys = new Set() // códigos (e.code) das teclas pressionadas NESTE momento

// Teclas que controlam o jogo (pedalar, virar e turbo)
const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'])
const ZOOM_IN_KEYS = new Set(['Equal', 'NumpadAdd']) // tecla "=" (onde fica o +) e + do teclado numérico
const ZOOM_OUT_KEYS = new Set(['Minus', 'NumpadSubtract'])
const ZOOM_RESET_KEYS = new Set(['Digit0', 'Numpad0'])
// Teclas comuns de navegação/acessibilidade: nunca contam como "erro"
const NEUTRAL_KEYS = new Set([
  'Escape', 'Tab', 'Enter', 'NumpadEnter', 'Space', 'CapsLock', 'ContextMenu', 'PrintScreen',
  'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight',
])

/**
 * Está digitando em um campo? Então nenhuma tecla é do jogo.
 * @param {Element} el - elemento com foco (e.target)
 * @returns {Element|null|undefined} o campo encontrado (truthy) ou nada
 */
const isTyping = (el) => el?.closest?.('input, textarea, select, [contenteditable="true"]')

// keydown: anota a tecla pressionada e trata os atalhos de zoom.
// Fluxo: ignora se está digitando num campo → bloqueia a rolagem das setas →
// deixa atalhos com Ctrl/Alt/Cmd para o navegador → guarda em `keys` →
// zoom (+ − 0) ou, se a tecla não serve para nada, registra gesto inválido.
addEventListener('keydown', (e) => {
  if (isTyping(e.target)) return
  if (e.code.startsWith('Arrow')) e.preventDefault() // setas não rolam a página
  // Atalhos com Ctrl/Alt/Cmd (Ctrl + para zoom do navegador, Ctrl + R…) ficam com o navegador
  if (e.ctrlKey || e.altKey || e.metaKey) return
  keys.add(e.code)

  if (ZOOM_IN_KEYS.has(e.code)) zoomLog -= SETTINGS.zoom.key
  else if (ZOOM_OUT_KEYS.has(e.code)) zoomLog += SETTINGS.zoom.key
  else if (ZOOM_RESET_KEYS.has(e.code)) resetRequested = true
  // Tecla sem função (não é do jogo, não é neutra, não é F1–F12) e não é repetição automática: conta como gesto inválido
  else if (!GAME_KEYS.has(e.code) && !NEUTRAL_KEYS.has(e.code) && !/^F\d{1,2}$/.test(e.code) && !e.repeat) {
    registerGesture('unsupported-key', 'desktop')
  }
})
// keyup: a tecla foi solta, sai do conjunto
addEventListener('keyup', (e) => keys.delete(e.code))

// Trocou de aba/janela com tecla pressionada: solta tudo para a bike não seguir sozinha
// (o keyup nunca chega quando a janela perde o foco)
addEventListener('blur', () => keys.clear())

/* ==========================================================================
   Roda do mouse e trackpad
   ========================================================================== */
/**
 * Converte deltaMode (pixels, linhas ou páginas) para pixels: cada navegador usa um.
 * deltaMode 0 = pixels, 1 = linhas (≈16 px cada), 2 = páginas (altura da janela).
 * @param {WheelEvent} e
 * @param {number} v - e.deltaX ou e.deltaY
 * @returns {number} valor em pixels
 */
const toPixels = (e, v) => (e.deltaMode === 1 ? v * 16 : e.deltaMode === 2 ? v * innerHeight : v)

// wheel: roda do mouse e gestos do trackpad (rolagem com dois dedos e pinça).
// Não é passivo porque precisa de preventDefault() para o navegador não dar zoom
// na página nem fazer o "efeito elástico". Dentro das janelas (.modal) a roda
// continua rolando o texto normalmente.
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
      // Pinça do trackpad: limita a ±60 px por evento para um gesto brusco não pular demais
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
let gestureScale = 1 // escala do gesto no evento anterior (1 = sem zoom); o delta é a razão entre o anterior e o atual
let touchPointers = 0 // dedos na tela agora (para não contar a pinça duas vezes no iOS)
// Conta dedos encostando (capture + passive: só observa, antes de qualquer outro listener)
addEventListener('pointerdown', (e) => e.pointerType === 'touch' && touchPointers++, { passive: true, capture: true })
// Conta dedos saindo (pointerup e pointercancel), nunca deixando o contador negativo
for (const type of ['pointerup', 'pointercancel']) {
  addEventListener(type, (e) => e.pointerType === 'touch' && (touchPointers = Math.max(0, touchPointers - 1)), { passive: true, capture: true })
}

/**
 * Trata gesturestart/gesturechange/gestureend do Safari.
 * Sempre bloqueia o zoom da página. Só vira zoom do jogo em gesturechange quando
 * há menos de dois dedos na tela (ou seja, é o trackpad do Mac, não dedos no iOS,
 * que já são tratados em pointerControls.js). O delta é log(anterior / atual):
 * dedos se afastando (scale cresce) → valor negativo → aproxima a câmera.
 * @param {GestureEvent} e
 */
function onSafariGesture(e) {
  e.preventDefault()
  if (e.type === 'gesturechange' && touchPointers < 2 && e.scale > 0) {
    zoomLog += Math.log(gestureScale / e.scale)
  }
  gestureScale = e.type === 'gestureend' ? 1 : e.scale
}
// Não passivo: precisa do preventDefault() para o Safari não dar zoom na página
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) addEventListener(type, onSafariGesture, { passive: false })

/**
 * Chamado uma vez por frame pelo loop do jogo. Lê o teclado para `input`.
 * Com `blocked` (janela aberta, rebobinando…) a bike fica parada.
 * A função auxiliar k(...) devolve true se qualquer uma das teclas está pressionada;
 * true − false vira 1/−1/0 nas subtrações.
 * @param {boolean} blocked - true para zerar o input (bike parada)
 * @returns {typeof input}
 */
export function readInput(blocked) {
  if (blocked) return Object.assign(input, { forward: 0, turn: 0, boost: false })
  const k = (...codes) => codes.some((c) => keys.has(c))
  input.forward = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown')
  input.turn = k('KeyA', 'ArrowLeft') - k('KeyD', 'ArrowRight')
  input.boost = k('ShiftLeft', 'ShiftRight')
  return input
}
