import { canvas } from './stage.js'
import { clamp } from '../utils/helpers.js'
import { deviceFromEvent } from './device.js'
import { forgetGesture, registerGesture } from './invalidGestures.js'

/*
  Entrada do jogador: teclado, joystick virtual (arrastar), pinça com dois
  dedos, roda do mouse / trackpad e gestos do Safari.

  Estratégia de performance:
  - Os listeners só ANOTAM valores (números simples); nada de mexer no DOM ou
    na câmera dentro deles. Eventos de ponteiro e roda podem chegar a 120–240
    vezes por segundo, então o trabalho pesado fica para o loop do jogo
    (gsap.ticker, que roda em requestAnimationFrame), uma vez por frame.
  - Listeners são { passive: true } sempre que possível. Os únicos não passivos
    são os que PRECISAM de preventDefault(): roda/pinça do trackpad (senão o
    navegador dá zoom na página inteira) e os gestos do Safari.
*/

/** Estado lido pela bike a cada frame. */
export const input = { forward: 0, turn: 0, boost: false }

/** Sensibilidades. Ajuste aqui para deixar os controles mais rápidos ou mais suaves. */
export const SETTINGS = {
  joystick: {
    deadZone: 8, // px em que o dedo pode tremer sem mover a bike
    range: 64, // px de arraste para chegar à força máxima
  },
  zoom: {
    wheel: 0.0014, // por pixel de roda do mouse (1 "clique" ≈ 100 px ≈ 15% de zoom)
    trackpadPinch: 0.012, // por pixel da pinça no trackpad (Chrome/Edge/Firefox enviam como Ctrl + roda)
    key: 0.16, // por toque nas teclas + e −
  },
  tap: {
    maxMove: 10, // px: mais que isso já é arraste, não toque
    maxTime: 260, // ms: mais que isso já é "segurar"
    doubleGap: 320, // ms entre dois toques para contar como toque duplo
  },
  longPressMs: 900, // dedo parado por esse tempo = gesto inválido "segurar"
}

/* ==========================================================================
   Zoom acumulado entre um frame e outro
   Valor em escala logarítmica: positivo afasta a câmera, negativo aproxima.
   Somar logaritmos = multiplicar fatores, então gestos rápidos não "pulam".
   ========================================================================== */
let zoomLog = 0
let zoomResetRequested = false

/** Entrega o zoom acumulado desde o último frame e zera o acumulador. */
export function consumeZoom() {
  const result = { delta: zoomLog, reset: zoomResetRequested }
  zoomLog = 0
  zoomResetRequested = false
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
  else if (ZOOM_RESET_KEYS.has(e.code)) zoomResetRequested = true
  else if (!GAME_KEYS.has(e.code) && !NEUTRAL_KEYS.has(e.code) && !/^F\d{1,2}$/.test(e.code) && !e.repeat) {
    registerGesture('unsupported-key', 'desktop')
  }
})
addEventListener('keyup', (e) => keys.delete(e.code))

/* ==========================================================================
   Ponteiros (dedo, caneta e mouse) no canvas
   - 1 ponteiro  → joystick virtual (arrastar)
   - 2 ponteiros → pinça (zoom)
   - 3 ou mais   → gesto inválido
   ========================================================================== */
const pointers = new Map() // pointerId → { x, y, x0, y0, t0, moved }
const joy = { active: false, id: null, x0: 0, y0: 0, x: 0, y: 0, fwd: 0, turn: 0 }
let pinchDist = 0 // distância entre os dois dedos no frame anterior (0 = sem pinça)
let gestureLocked = false // depois de pinça/3 dedos, espera soltar tudo antes de voltar ao joystick
let longPressTimer = 0
let lastTap = null // último toque simples, para detectar toque duplo

/** Converte o deslocamento de um eixo em força de -1 a 1, com zona morta. */
function axis(delta) {
  const { deadZone, range } = SETTINGS.joystick
  const mag = clamp((Math.abs(delta) - deadZone) / (range - deadZone), 0, 1)
  return Math.sign(delta) * mag
}

function startJoystick(id, x, y) {
  Object.assign(joy, { active: true, id, x0: x, y0: y, x, y, fwd: 0, turn: 0 })
}

function moveJoystick(x, y) {
  const { range } = SETTINGS.joystick
  let dx = x - joy.x0
  let dy = y - joy.y0
  const dist = Math.hypot(dx, dy)
  // Joystick "flutuante": se o dedo passar do limite, a base vem junto.
  // Assim, inverter a direção responde na hora, sem precisar voltar todo o caminho.
  if (dist > range) {
    const pull = 1 - range / dist
    joy.x0 += dx * pull
    joy.y0 += dy * pull
    dx = x - joy.x0
    dy = y - joy.y0
  }
  joy.x = x
  joy.y = y
  joy.fwd = -axis(dy) // arrastar para cima = pedalar
  joy.turn = -axis(dx) // arrastar para a esquerda = virar à esquerda
}

function stopJoystick() {
  Object.assign(joy, { active: false, id: null, fwd: 0, turn: 0 })
}

// Distância entre os dois primeiros ponteiros ativos (pinça)
function currentPinchDistance() {
  const [a, b] = pointers.values()
  return Math.hypot(a.x - b.x, a.y - b.y) || 1
}

function cancelLongPress() {
  clearTimeout(longPressTimer)
  longPressTimer = 0
}

/** Toque/clique curto sem arrastar: toque duplo reseta o zoom; toques soltos repetidos = inválido. */
function handleTap(p, e) {
  const device = deviceFromEvent(e)
  const kind = device === 'touch' ? 'tap' : 'click'
  const now = performance.now()
  if (lastTap && now - lastTap.t < SETTINGS.tap.doubleGap && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 40) {
    zoomResetRequested = true // toque duplo / duplo clique = zoom normal
    lastTap = null
    forgetGesture(kind) // o primeiro toque fazia parte de um gesto válido
    return
  }
  lastTap = { t: now, x: p.x, y: p.y }
  registerGesture(kind, device)
}

canvas.addEventListener('pointerdown', (e) => {
  // Mouse: só o botão esquerdo dirige. O do meio é avisado; o direito é tratado no contextmenu.
  if (e.pointerType === 'mouse' && e.button !== 0) {
    if (e.button === 1) {
      e.preventDefault() // evita o "auto-scroll" do botão do meio no Windows
      registerGesture('middle-click', 'desktop')
    }
    return
  }
  canvas.setPointerCapture(e.pointerId) // continua recebendo o arraste mesmo fora do canvas
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false })

  if (pointers.size === 1 && !gestureLocked) {
    startJoystick(e.pointerId, e.clientX, e.clientY)
    if (e.pointerType !== 'mouse') {
      const id = e.pointerId
      longPressTimer = setTimeout(() => {
        const p = pointers.get(id)
        if (p && !p.moved && pointers.size === 1) registerGesture('long-press', 'touch')
      }, SETTINGS.longPressMs)
    }
  } else if (pointers.size === 2) {
    // Segundo dedo: vira pinça. O joystick para para a bike não "fugir" durante o zoom.
    stopJoystick()
    cancelLongPress()
    pinchDist = currentPinchDistance()
    gestureLocked = true
  } else if (pointers.size >= 3) {
    pinchDist = 0
    gestureLocked = true
    registerGesture('multi-finger', deviceFromEvent(e))
  }
})

canvas.addEventListener(
  'pointermove',
  (e) => {
    const p = pointers.get(e.pointerId)
    if (!p) return
    p.x = e.clientX
    p.y = e.clientY
    if (!p.moved && Math.hypot(p.x - p.x0, p.y - p.y0) > SETTINGS.tap.maxMove) {
      p.moved = true
      cancelLongPress()
    }
    if (pinchDist && pointers.size === 2) {
      const d = currentPinchDistance()
      zoomLog += Math.log(pinchDist / d) // dedos se afastando → aproxima a câmera
      pinchDist = d
    } else if (joy.active && joy.id === e.pointerId) {
      moveJoystick(p.x, p.y)
    }
  },
  { passive: true },
)

function endPointer(e) {
  const p = pointers.get(e.pointerId)
  if (!p) return
  pointers.delete(e.pointerId)
  cancelLongPress()
  const quick = performance.now() - p.t0 < SETTINGS.tap.maxTime
  if (e.type === 'pointerup' && !gestureLocked && !p.moved && quick) handleTap(p, e)
  if (joy.id === e.pointerId) stopJoystick()
  if (pointers.size < 2) pinchDist = 0
  if (pointers.size === 0) gestureLocked = false
}
canvas.addEventListener('pointerup', endPointer, { passive: true })
canvas.addEventListener('pointercancel', endPointer, { passive: true })

// Botão direito no mundo: sem menu do navegador. No Android, "segurar" também dispara contextmenu.
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  const device = deviceFromEvent(e)
  registerGesture(device === 'touch' ? 'long-press' : 'right-click', device)
})

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
   No iOS, a pinça de dedos no canvas já é tratada pelos pointer events acima;
   aqui só bloqueamos o zoom da página e tratamos a pinça do trackpad do Mac.
   ========================================================================== */
let gestureScale = 1
function onSafariGesture(e) {
  e.preventDefault()
  if (e.type === 'gesturechange' && pointers.size < 2 && e.scale > 0) {
    zoomLog += Math.log(gestureScale / e.scale)
  }
  gestureScale = e.type === 'gestureend' ? 1 : e.scale
}
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) addEventListener(type, onSafariGesture, { passive: false })

// Trocou de aba/janela com tecla ou dedo pressionado: solta tudo para a bike não seguir sozinha
addEventListener('blur', () => {
  keys.clear()
  pointers.clear()
  stopJoystick()
  cancelLongPress()
  pinchDist = 0
  gestureLocked = false
})

/* ==========================================================================
   Indicador visual do joystick (base + bolinha), atualizado uma vez por frame
   ========================================================================== */
const joyBase = document.createElement('div')
joyBase.className = 'joystick'
joyBase.innerHTML = '<span class="joystick-knob"></span>'
document.body.appendChild(joyBase)
const joyKnob = joyBase.firstElementChild
let joyVisible = false

function syncJoystickVisual(blocked) {
  const show = joy.active && !blocked
  if (show !== joyVisible) {
    joyBase.classList.toggle('visible', show) // só escreve no DOM quando muda
    joyVisible = show
  }
  if (!show) return
  const { range } = SETTINGS.joystick
  const kx = clamp(joy.x - joy.x0, -range, range)
  const ky = clamp(joy.y - joy.y0, -range, range)
  joyBase.style.transform = `translate3d(${joy.x0}px, ${joy.y0}px, 0)`
  joyKnob.style.transform = `translate3d(${kx}px, ${ky}px, 0)`
}

/**
 * Chamado uma vez por frame pelo loop do jogo. Junta teclado e joystick em
 * `input`. Com `blocked` (janela aberta, rebobinando…) a bike fica parada.
 */
export function readInput(blocked) {
  syncJoystickVisual(blocked)
  if (blocked) return Object.assign(input, { forward: 0, turn: 0, boost: false })
  const k = (...codes) => codes.some((c) => keys.has(c))
  // O teclado tem prioridade; sem tecla pressionada, vale o joystick
  input.forward = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown') || joy.fwd
  input.turn = k('KeyA', 'ArrowLeft') - k('KeyD', 'ArrowRight') || joy.turn
  input.boost = k('ShiftLeft', 'ShiftRight')
  return input
}
