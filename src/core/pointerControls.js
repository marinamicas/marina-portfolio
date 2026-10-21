import * as THREE from 'three'
import { camera, canvas } from './stage.js'
import { addZoom, requestViewReset, SETTINGS } from './input.js'
import { deviceFromEvent } from './device.js'
import { forgetGesture, registerGesture } from './invalidGestures.js'
import { bike, dragTo, endDrag, startDrag } from '../world/bike.js'

/*
  Controles por ponteiro, unificados com Pointer Events: o mesmo código atende
  clique-e-arraste do mouse, toque do dedo e caneta.

  O que cada gesto faz no canvas:
  - pegar a BICICLETA e arrastar → a bike vai exatamente para o ponto do chão sob o dedo/mouse
  - pegar o CENÁRIO e arrastar   → pan: o ponto agarrado do chão acompanha o dedo/mouse
  - dois dedos                   → pinça (zoom) + pan pelo ponto médio dos dedos
  - toque duplo / duplo clique   → zoom normal e câmera de volta na bike
  - três dedos, segurar parado, toques soltos repetidos, botão direito → gestos inválidos (guia)

  Performance: os listeners só anotam coordenadas. Raycast, câmera e bike são
  atualizados uma vez por frame em updatePointerControls() (loop do jogo).
*/

/* ---------------- Estado ---------------- */
const pointers = new Map() // pointerId → { x, y, x0, y0, t0, moved, onBike }
let mode = 'idle' // 'idle' | 'bike' | 'pan' | 'pinch' | 'locked' (espera soltar todos os dedos)
let primaryId = null // ponteiro que comanda o arraste atual
let rig = null // CameraRig (definido em initPointerControls)
let isEnabled = () => false // o jogo diz quando os controles valem (jogando, sem janela aberta…)
let longPressTimer = 0
let lastTap = null // último toque simples (para detectar toque duplo)
let pinchDist = 0
const hover = { x: 0, y: 0, dirty: false } // posição do mouse sem botão (para o cursor "mãozinha")

// Objetos reaproveitados a cada frame (evita criar lixo para o coletor de memória)
const raycaster = new THREE.Raycaster()
const ndc = new THREE.Vector2()
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0) // chão: y = 0
const hit = new THREE.Vector3()
const anchor = new THREE.Vector3() // ponto do chão agarrado (pan) ou deslocamento dedo→bike (arraste)
const projA = new THREE.Vector3()
const projB = new THREE.Vector3()
const camForward = new THREE.Vector3()
const camRight = new THREE.Vector3()

/** Liga os controles à câmera e define quando eles estão ativos. */
export function initPointerControls(cameraRig, enabledFn) {
  rig = cameraRig
  isEnabled = enabledFn
}

/* ---------------- Utilidades de tela ↔ mundo ---------------- */

/** Ponto do chão sob a coordenada de tela (x, y). Retorna null se o raio não tocar o chão (olhando o céu). */
function groundAt(x, y, out = hit) {
  camera.updateMatrixWorld() // garante a câmera mais recente (ela pode ter andado neste frame)
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1)
  raycaster.setFromCamera(ndc, camera)
  return raycaster.ray.intersectPlane(groundPlane, out)
}

/** O ponteiro em (x, y) está sobre a bike? Usa a área da bike na tela, com um mínimo confortável para dedos. */
function pointerOnBike(x, y) {
  const p = bike.body.position
  projA.set(p.x, 0, p.z).project(camera) // pé da bike
  projB.set(p.x, 2.6, p.z).project(camera) // topo do recorte
  if (projA.z > 1) return false // atrás da câmera
  const ax = ((projA.x + 1) / 2) * innerWidth
  const ay = ((1 - projA.y) / 2) * innerHeight
  const by = ((1 - projB.y) / 2) * innerHeight
  const radius = Math.max(SETTINGS.drag.bikeHitRadius, Math.abs(ay - by) * 0.65)
  return Math.hypot(x - ax, y - (ay + by) / 2) < radius
}

// Ponto médio dos dois primeiros dedos (pinça)
function midpoint() {
  const [a, b] = pointers.values()
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) || 1 }
}

function cancelLongPress() {
  clearTimeout(longPressTimer)
  longPressTimer = 0
}

/* ---------------- Início / fim de cada modo ---------------- */

function beginBikeDrag(id, x, y) {
  if (!groundAt(x, y)) return beginLocked()
  mode = 'bike'
  primaryId = id
  startDrag()
  rig.grab()
  // guarda a diferença dedo→bike para a bike não "pular" para baixo do dedo
  const p = bike.body.position
  anchor.set(p.x - hit.x, 0, p.z - hit.z)
}

function beginPan(id, x, y) {
  if (!groundAt(x, y, anchor)) return beginLocked()
  mode = 'pan'
  primaryId = id
  rig.grab()
}

function beginPinch() {
  if (mode === 'bike') endDrag()
  const m = midpoint()
  pinchDist = m.dist
  mode = groundAt(m.x, m.y, anchor) ? 'pinch' : 'locked'
  rig.grab()
}

function beginLocked() {
  mode = 'locked'
  primaryId = null
}

/** Encerra qualquer arraste em andamento (soltou, janela abriu, bike travou, atropelou…). */
export function cancelPointerDrag() {
  if (mode === 'bike') endDrag()
  if (rig?.hold) rig.release(bike.body.position)
  mode = pointers.size ? 'locked' : 'idle'
  primaryId = null
  cancelLongPress()
}

/* ---------------- Toques curtos ---------------- */

/** Toque/clique curto sem arrastar: toque duplo reseta a vista; toques soltos no cenário repetidos = inválido. */
function handleTap(p, e) {
  const device = deviceFromEvent(e)
  const kind = device === 'touch' ? 'tap' : 'click'
  const now = performance.now()
  if (lastTap && now - lastTap.t < SETTINGS.tap.doubleGap && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 40) {
    requestViewReset() // toque duplo / duplo clique = zoom normal + câmera na bike
    lastTap = null
    forgetGesture(kind) // o primeiro toque fazia parte de um gesto válido
    return
  }
  lastTap = { t: now, x: p.x, y: p.y }
  if (!p.onBike) registerGesture(kind, device) // tocar na bike sem arrastar é inofensivo
}

/* ---------------- Eventos (só anotam; o trabalho é feito por frame) ---------------- */

canvas.addEventListener('pointerdown', (e) => {
  if (!isEnabled()) return
  // Mouse: só o botão esquerdo arrasta. O do meio é avisado; o direito é tratado no contextmenu.
  if (e.pointerType === 'mouse' && e.button !== 0) {
    if (e.button === 1) {
      e.preventDefault() // evita o "auto-scroll" do botão do meio no Windows
      registerGesture('middle-click', 'desktop')
    }
    return
  }
  canvas.setPointerCapture(e.pointerId) // continua recebendo o arraste mesmo fora do canvas
  const p = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false, onBike: false }
  pointers.set(e.pointerId, p)

  if (pointers.size === 1 && mode === 'idle') {
    p.onBike = pointerOnBike(p.x, p.y)
    if (p.onBike) beginBikeDrag(e.pointerId, p.x, p.y)
    else {
      beginPan(e.pointerId, p.x, p.y)
      // Dedo parado no cenário por muito tempo = "segurar" (gesto inválido)
      if (e.pointerType !== 'mouse') {
        const id = e.pointerId
        longPressTimer = setTimeout(() => {
          const cur = pointers.get(id)
          if (cur && !cur.moved && pointers.size === 1) registerGesture('long-press', 'touch')
        }, SETTINGS.longPressMs)
      }
    }
  } else if (pointers.size === 2) {
    cancelLongPress()
    beginPinch() // segundo dedo: vira pinça (e solta a bike, se estava arrastando)
  } else if (pointers.size >= 3) {
    cancelPointerDrag()
    beginLocked()
    registerGesture('multi-finger', deviceFromEvent(e))
  }
})

canvas.addEventListener(
  'pointermove',
  (e) => {
    const p = pointers.get(e.pointerId)
    if (!p) {
      // mouse passando por cima sem botão: só para o cursor de "pegar a bike"
      if (e.pointerType === 'mouse') Object.assign(hover, { x: e.clientX, y: e.clientY, dirty: true })
      return
    }
    p.x = e.clientX
    p.y = e.clientY
    if (!p.moved && Math.hypot(p.x - p.x0, p.y - p.y0) > SETTINGS.tap.maxMove) {
      p.moved = true
      cancelLongPress()
    }
  },
  { passive: true },
)

function endPointer(e) {
  const p = pointers.get(e.pointerId)
  if (!p) return
  pointers.delete(e.pointerId)
  cancelLongPress()
  const wasPrimary = e.pointerId === primaryId
  const quick = performance.now() - p.t0 < SETTINGS.tap.maxTime
  if (e.type === 'pointerup' && !p.moved && quick && (mode === 'pan' || mode === 'bike') && wasPrimary) handleTap(p, e)

  if (mode === 'pinch' && pointers.size < 2) {
    rig.release(bike.body.position)
    mode = 'locked' // o dedo que sobrou não vira pan de repente: espera soltar tudo
  } else if (wasPrimary && (mode === 'bike' || mode === 'pan')) {
    cancelPointerDrag()
  }
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

/** Direções "frente" e "direita" da câmera projetadas no chão (para a câmera andar pela borda da tela). */
function cameraGroundAxes() {
  camera.getWorldDirection(camForward)
  camForward.y = 0
  camForward.normalize()
  camRight.set(-camForward.z, 0, camForward.x) // 90° à direita da frente
}

/** Quanto o ponteiro está "dentro" da faixa da borda: -1..1 por eixo (0 = longe das bordas). */
function edgePush(x, y) {
  const mx = innerWidth * SETTINGS.drag.edgeMargin
  const my = innerHeight * SETTINGS.drag.edgeMargin
  const ex = x < mx ? -(1 - x / mx) : x > innerWidth - mx ? 1 - (innerWidth - x) / mx : 0
  const ey = y < my ? 1 - y / my : y > innerHeight - my ? -(1 - (innerHeight - y) / my) : 0
  return { ex, ey }
}

let cursor = ''
function setCursor(value) {
  if (value === cursor) return // só escreve no DOM quando muda
  cursor = value
  canvas.style.cursor = value
}

/**
 * Chamado uma vez por frame, ANTES da física. Aplica o arraste da bike, o pan
 * e a pinça usando a câmera do frame anterior. Como a câmera só translada
 * durante o arraste, o ponto agarrado fica exatamente sob o dedo.
 */
export function updatePointerControls(dt) {
  if (!isEnabled() || bike.locked) {
    if (mode !== 'idle' && mode !== 'locked') cancelPointerDrag()
    setCursor('')
    return
  }

  if (mode === 'bike') {
    const p = pointers.get(primaryId)
    if (!p || !bike.dragging) return cancelPointerDrag()
    // Bike arrastada até a borda: a câmera anda junto para dar para ir longe no mapa
    const { ex, ey } = edgePush(p.x, p.y)
    if (ex || ey) {
      cameraGroundAxes()
      const step = SETTINGS.drag.edgeSpeed * dt
      rig.panBy((camRight.x * ex + camForward.x * ey) * step, (camRight.z * ex + camForward.z * ey) * step)
      rig.update(0, bike.body.position) // aplica já a nova posição, para o raio abaixo usar a câmera atualizada
    }
    if (groundAt(p.x, p.y)) dragTo(hit.x + anchor.x, hit.z + anchor.z)
  } else if (mode === 'pan') {
    const p = pointers.get(primaryId)
    // o ponto do chão agarrado (anchor) volta para baixo do dedo
    if (p && groundAt(p.x, p.y)) rig.panBy(anchor.x - hit.x, anchor.z - hit.z)
  } else if (mode === 'pinch' && pointers.size >= 2) {
    const m = midpoint()
    addZoom(Math.log(pinchDist / m.dist)) // dedos se afastando → aproxima
    pinchDist = m.dist
    if (groundAt(m.x, m.y)) rig.panBy(anchor.x - hit.x, anchor.z - hit.z) // zoom "puxa" para o ponto entre os dedos
  }

  // Cursor do mouse: mãozinha sobre a bike, "agarrando" durante arrastes
  if (mode === 'bike' || mode === 'pan' || mode === 'pinch') setCursor('grabbing')
  else if (mode === 'idle' && hover.dirty) {
    // a bike anda sob o mouse parado, então o teste é refeito a cada frame enquanto o mouse estiver no canvas
    setCursor(pointerOnBike(hover.x, hover.y) ? 'grab' : '')
  }
}
