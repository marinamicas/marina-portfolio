import * as THREE from 'three'
import { camera, canvas, screenToNdc, worldToScreen } from './stage.js'
import { addZoom, requestViewReset, SETTINGS } from './input.js'
import { deviceFromEvent } from './device.js'
import { forgetGesture, registerGesture } from './invalidGestures.js'
import { bike, dragTo, endDrag, startDrag } from '../world/bike.js'
import { controlsVisible, onControlsChange } from '../ui/controls.js'
import { toast } from '../ui/effects.js'

/* ==========================================================================
   CONTROLES POR PONTEIRO (mouse, dedo e caneta) — Pointer Events

   Papel deste arquivo: tratar o que acontece com clique/toque sobre o canvas 3D,
   com um único código (Pointer Events) para mouse, dedo e caneta.

   Regras (pedido do projeto):
   - A câmera SEGUE A BIKE O TEMPO TODO: não existe mais "arrastar o cenário".
   - Botões de direção VISÍVEIS (src/ui/controls.js): tocar/arrastar a bike não
     faz nada; a bike anda pelos botões ou pelo teclado.
   - Botões OCULTOS: clique/toque na bike e arraste → a bike pedala na direção
     do ponto apontado (velocidade proporcional à distância, ver BIKE.drag em
     level.js). Como a câmera acompanha a bike, manter o dedo à frente dela faz
     a bike continuar pedalando para lá; soltar = ela para.
   - Dois dedos → pinça (zoom). Toque duplo / duplo clique → zoom normal.
   - Três dedos, segurar parado, toques soltos repetidos, botão direito → gestos
     inválidos (abrem o guia de navegação).

   Máquina de estados (`mode`):
   - 'idle'   → nenhum dedo/botão no canvas.
   - 'free'   → um ponteiro que NÃO está arrastando a bike (só serve para detectar
                toque, toque duplo e "segurar").
   - 'bike'   → arrastando a bike (botões ocultos e o toque começou sobre ela).
   - 'pinch'  → dois dedos: zoom.
   - 'locked' → espera soltar todos os dedos (depois de pinça, três dedos ou cancelamento).

   Performance: os listeners só anotam coordenadas; raycast e bike são
   atualizados uma vez por frame em updatePointerControls() (loop do jogo).

   Dependências: three (raycast), stage.js (camera, canvas, conversões de tela),
   input.js (SETTINGS, addZoom, requestViewReset), device.js, invalidGestures.js,
   world/bike.js (startDrag, dragTo, endDrag), ui/controls.js (modo dos botões).
   Quem usa: main.js (initPointerControls, updatePointerControls, cancelPointerDrag).

   Onde mexer:
   - Raio para "pegar" a bike: SETTINGS.drag.bikeHitRadius (input.js).
   - Velocidade/curva do arraste: BIKE.drag (level.js).
   - Toque duplo e "segurar": SETTINGS.tap e SETTINGS.longPressMs (input.js).
   ========================================================================== */

/* ---------------- Estado ---------------- */
// Ponteiros ativos agora: pointerId → { x, y (posição atual em px), x0, y0 (onde começou),
// t0 (quando começou, ms), moved (andou mais que SETTINGS.tap.maxMove?), onBike (começou sobre a bike?) }
const pointers = new Map()
let mode = 'idle' // 'idle' | 'free' | 'bike' | 'pinch' | 'locked'
let primaryId = null // ponteiro que comanda o arraste da bike
let isEnabled = () => false // o jogo diz quando os controles valem (jogando, sem janela aberta…)
let longPressTimer = 0 // id do setTimeout que detecta "segurar o dedo parado" (0 = nenhum)
let lastTap = null // último toque simples { t, x, y } (para detectar toque duplo)
let pinchDist = 0 // distância entre os dois dedos (px) no frame anterior da pinça
let lastHintAt = -Infinity // quando a dica "use os botões" apareceu pela última vez (ms)
const hover = { x: 0, y: 0, dirty: false } // posição do mouse sem botão (para o cursor "mãozinha")

// Objetos reaproveitados a cada frame (evita criar lixo para o coletor de memória)
const raycaster = new THREE.Raycaster() // lança um raio da câmera pelo ponto da tela
const ndc = new THREE.Vector2() // coordenadas normalizadas (−1..1) do canvas
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0) // chão: y = 0
const hit = new THREE.Vector3() // ponto do chão sob o ponteiro (resultado de groundAt)

/**
 * Liga os controles e define quando eles estão ativos. Chamada uma vez por main.js.
 * @param {() => boolean} enabledFn - ex.: () => playing && !ui.isBlocked()
 */
export function initPointerControls(enabledFn) {
  isEnabled = enabledFn
}

/* ---------------- Utilidades de tela ↔ mundo ---------------- */

/**
 * Ponto do chão sob a coordenada de tela (x, y) da janela.
 * @returns {THREE.Vector3|null} null se o raio não tocar o chão (olhando o céu)
 */
function groundAt(x, y) {
  camera.updateMatrixWorld()
  raycaster.setFromCamera(screenToNdc(x, y, ndc), camera)
  return raycaster.ray.intersectPlane(groundPlane, hit)
}

/**
 * O ponteiro em (x, y) está sobre a bike? Usa a área da bike na tela (do chão até
 * 1,9 m de altura), com um mínimo confortável para dedos (SETTINGS.drag.bikeHitRadius).
 */
function pointerOnBike(x, y) {
  const p = bike.body.position
  const foot = worldToScreen({ x: p.x, y: 0, z: p.z })
  if (foot.behind) return false
  const ax = foot.x
  const ay = foot.y
  const by = worldToScreen({ x: p.x, y: 1.9, z: p.z }).y
  const radius = Math.max(SETTINGS.drag.bikeHitRadius, Math.abs(ay - by) * 0.7)
  return Math.hypot(x - ax, y - (ay + by) / 2) < radius
}

/** Distância entre os dois primeiros dedos (pinça). */
function fingerDistance() {
  const [a, b] = pointers.values()
  return Math.hypot(a.x - b.x, a.y - b.y) || 1
}

/** Cancela o temporizador de "segurar o dedo parado". */
function cancelLongPress() {
  clearTimeout(longPressTimer)
  longPressTimer = 0
}

/* ---------------- Início / fim de cada modo ---------------- */

/** Começa a arrastar a bike com o ponteiro `id` (só chamado com os botões ocultos). */
function beginBikeDrag(id) {
  mode = 'bike'
  primaryId = id
  startDrag()
}

/** Segundo dedo encostou: vira pinça (e solta a bike, se estava arrastando). */
function beginPinch() {
  if (mode === 'bike') endDrag()
  pinchDist = fingerDistance()
  mode = 'pinch'
  primaryId = null
}

/**
 * Encerra qualquer arraste em andamento (soltou, janela abriu, bike travou, atropelou,
 * botões foram ligados…). Se ainda há dedos na tela, espera todos saírem ('locked').
 */
export function cancelPointerDrag() {
  if (mode === 'bike') endDrag()
  mode = pointers.size ? 'locked' : 'idle'
  primaryId = null
  cancelLongPress()
}
// Ligou os botões no meio de um arraste: solta a bike na hora
onControlsChange(() => cancelPointerDrag())

/* ---------------- Toques curtos ---------------- */

/**
 * Toque/clique curto sem arrastar: toque duplo volta ao zoom normal; toques soltos
 * no cenário repetidos contam como gesto inválido (o guia explica como jogar).
 */
function handleTap(p, e) {
  const device = deviceFromEvent(e)
  const kind = device === 'touch' ? 'tap' : 'click'
  const now = performance.now()
  if (lastTap && now - lastTap.t < SETTINGS.tap.doubleGap && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 40) {
    requestViewReset() // toque duplo / duplo clique = zoom normal
    lastTap = null
    forgetGesture(kind) // o primeiro toque fazia parte de um gesto válido
    return
  }
  lastTap = { t: now, x: p.x, y: p.y }
  if (!p.onBike) registerGesture(kind, device) // tocar na bike é inofensivo
}

/** Dica (no máximo a cada 8 s) quando alguém tenta arrastar a bike com os botões ligados. */
function hintUseButtons() {
  const now = performance.now()
  if (now - lastHintAt < 8000) return
  lastHintAt = now
  toast('Com os botões na tela ligados, pedale por eles (ou pelo teclado). Para arrastar a bike, oculte-os no botão 🎮.', 4)
}

/* ---------------- Eventos (só anotam; o trabalho é feito por frame) ---------------- */

// pointerdown: um dedo/botão encostou no canvas
canvas.addEventListener('pointerdown', (e) => {
  if (!isEnabled()) return
  // Mouse: só o botão esquerdo conta. O do meio é avisado; o direito é tratado no contextmenu.
  if (e.pointerType === 'mouse' && e.button !== 0) {
    if (e.button === 1) {
      e.preventDefault() // evita o "auto-scroll" do botão do meio no Windows
      registerGesture('middle-click', 'desktop')
    }
    return
  }
  canvas.setPointerCapture(e.pointerId) // continua recebendo o movimento mesmo fora do canvas
  const p = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false, onBike: false }
  pointers.set(e.pointerId, p)

  if (pointers.size === 1 && mode === 'idle') {
    p.onBike = pointerOnBike(p.x, p.y)
    if (p.onBike && !controlsVisible()) beginBikeDrag(e.pointerId)
    else {
      mode = 'free'
      primaryId = e.pointerId
      // Dedo parado no cenário por muito tempo = "segurar" (gesto inválido)
      if (e.pointerType !== 'mouse' && !p.onBike) {
        const id = e.pointerId
        longPressTimer = setTimeout(() => {
          const cur = pointers.get(id)
          if (cur && !cur.moved && pointers.size === 1) registerGesture('long-press', 'touch')
        }, SETTINGS.longPressMs)
      }
    }
  } else if (pointers.size === 2) {
    cancelLongPress()
    beginPinch()
  } else if (pointers.size >= 3) {
    cancelPointerDrag()
    mode = 'locked'
    registerGesture('multi-finger', deviceFromEvent(e))
  }
})

// pointermove: só anota a posição (e o mouse sem botão, para o cursor)
canvas.addEventListener(
  'pointermove',
  (e) => {
    const p = pointers.get(e.pointerId)
    if (!p) {
      if (e.pointerType === 'mouse') Object.assign(hover, { x: e.clientX, y: e.clientY, dirty: true })
      return
    }
    p.x = e.clientX
    p.y = e.clientY
    if (!p.moved && Math.hypot(p.x - p.x0, p.y - p.y0) > SETTINGS.tap.maxMove) {
      p.moved = true
      cancelLongPress()
      // Tentou arrastar a bike com os botões ligados: explica a regra
      if (p.onBike && controlsVisible() && mode === 'free') hintUseButtons()
    }
  },
  { passive: true },
)

/**
 * Um ponteiro saiu (pointerup, pointercancel ou perdeu a captura): detecta toque curto,
 * encerra arraste/pinça e volta a 'idle' quando não sobra nenhum dedo.
 */
function endPointer(e) {
  const p = pointers.get(e.pointerId)
  if (!p) return
  pointers.delete(e.pointerId)
  cancelLongPress()
  const wasPrimary = e.pointerId === primaryId
  const quick = performance.now() - p.t0 < SETTINGS.tap.maxTime
  if (e.type === 'pointerup' && !p.moved && quick && (mode === 'free' || mode === 'bike') && wasPrimary) handleTap(p, e)

  if (mode === 'pinch' && pointers.size < 2) mode = 'locked' // o dedo que sobrou espera
  else if (wasPrimary && (mode === 'bike' || mode === 'free')) cancelPointerDrag()
  if (pointers.size === 0) mode = 'idle'
}
canvas.addEventListener('pointerup', endPointer, { passive: true })
canvas.addEventListener('pointercancel', endPointer, { passive: true })
canvas.addEventListener('lostpointercapture', endPointer, { passive: true })

// Botão direito no mundo: sem menu do navegador. No Android, "segurar" também dispara contextmenu.
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  const device = deviceFromEvent(e)
  registerGesture(device === 'touch' ? 'long-press' : 'right-click', device)
})

// Navegadores antigos/iOS: garante que arrastar no canvas nunca role a página nem puxe o "pull-to-refresh"
canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false })
// Sem "arrastar imagem" fantasma nem seleção de texto ao arrastar com o mouse
canvas.addEventListener('dragstart', (e) => e.preventDefault())
// Mouse saiu do canvas: para de testar o cursor
canvas.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && (hover.dirty = false), { passive: true })

// Trocou de aba/janela no meio de um arraste: solta tudo
addEventListener('blur', () => {
  pointers.clear()
  cancelPointerDrag()
  mode = 'idle'
})

/* ---------------- Atualização por frame ---------------- */

let cursor = '' // cursor atual do canvas (só escreve no DOM quando muda)
function setCursor(value) {
  if (value === cursor) return
  cursor = value
  canvas.style.cursor = value
}

/**
 * Chamado uma vez por frame, ANTES da física:
 * - arraste da bike: o ponto do chão sob o dedo vira o destino (dragTo);
 * - pinça: a variação da distância entre os dedos vira zoom;
 * - cursor do mouse: "mãozinha" sobre a bike quando dá para arrastá-la.
 */
export function updatePointerControls() {
  if (!isEnabled() || bike.locked) {
    if (mode === 'bike' || mode === 'pinch') cancelPointerDrag()
    setCursor('')
    return
  }

  if (mode === 'bike') {
    const p = pointers.get(primaryId)
    if (!p || !bike.dragging) return cancelPointerDrag()
    if (groundAt(p.x, p.y)) dragTo(hit.x, hit.z)
  } else if (mode === 'pinch' && pointers.size >= 2) {
    const d = fingerDistance()
    addZoom(Math.log(pinchDist / d)) // dedos se afastando → aproxima
    pinchDist = d
  }

  if (mode === 'bike' || mode === 'pinch') setCursor('grabbing')
  else if (mode === 'idle' && hover.dirty) setCursor(!controlsVisible() && pointerOnBike(hover.x, hover.y) ? 'grab' : '')
}
