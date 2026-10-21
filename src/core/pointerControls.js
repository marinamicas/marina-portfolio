import * as THREE from 'three'
import { camera, canvas } from './stage.js'
import { addZoom, requestViewReset, SETTINGS } from './input.js'
import { deviceFromEvent } from './device.js'
import { forgetGesture, registerGesture } from './invalidGestures.js'
import { bike, dragTo, endDrag, startDrag } from '../world/bike.js'

/* ==========================================================================
   CONTROLES POR PONTEIRO (mouse, dedo e caneta) — Pointer Events

   Papel deste arquivo:
   - Tratar tudo o que acontece com clique-e-arraste do mouse, toque do dedo
     ou caneta sobre o canvas 3D, com um único código (Pointer Events).
   - Converter coordenadas de tela em pontos do chão (raycast contra o plano
     y = 0) para que a bike e o cenário sigam EXATAMENTE o dedo/mouse.

   O que cada gesto faz no canvas:
   - pegar a BICICLETA e arrastar → a bike vai exatamente para o ponto do chão sob o dedo/mouse
   - pegar o CENÁRIO e arrastar   → pan: o ponto agarrado do chão acompanha o dedo/mouse
   - dois dedos                   → pinça (zoom) + pan pelo ponto médio dos dedos
   - toque duplo / duplo clique   → zoom normal e câmera de volta na bike
   - três dedos, segurar parado, toques soltos repetidos, botão direito → gestos inválidos (guia)

   Performance: os listeners só anotam coordenadas. Raycast, câmera e bike são
   atualizados uma vez por frame em updatePointerControls() (loop do jogo).

   Máquina de estados (`mode`):
   - 'idle'   → nenhum dedo/botão no canvas. Sai daqui no pointerdown.
   - 'bike'   → arrastando a bike (1 ponteiro, que começou sobre a bike).
   - 'pan'    → arrastando o cenário (1 ponteiro, que começou fora da bike).
   - 'pinch'  → dois dedos: zoom + pan pelo ponto médio.
   - 'locked' → "espera soltar todos os dedos": nada acontece até pointers.size
                voltar a 0 (depois de uma pinça que perdeu um dedo, três dedos,
                raio que não tocou o chão, ou cancelamento externo).
   Transições principais: idle → bike/pan (1º ponteiro); bike/pan → pinch (2º
   dedo); qualquer → locked (3º dedo ou cancelamento); * → idle quando o
   último ponteiro é solto.

   Dependências: three (raycast), stage.js (camera, canvas), input.js
   (SETTINGS, addZoom, requestViewReset), device.js, invalidGestures.js,
   world/bike.js (startDrag, dragTo, endDrag).
   Quem usa: main.js (initPointerControls, updatePointerControls, cancelPointerDrag).

   Onde mexer:
   - Sensibilidades (raio para pegar a bike, borda da tela, toque duplo,
     segurar): SETTINGS em input.js.
   - pointerOnBike(): como é calculada a área clicável da bike.
   - edgePush(): como a borda da tela faz a câmera andar.
   - handleTap(): regra do toque duplo (40 px de tolerância entre os dois toques).
   ========================================================================== */

/* ---------------- Estado ---------------- */
// Ponteiros ativos agora. Cada valor: { x, y (posição atual em px), x0, y0 (onde começou),
// t0 (quando começou, ms), moved (já andou mais que SETTINGS.tap.maxMove?), onBike (começou sobre a bike?) }
const pointers = new Map() // pointerId → { x, y, x0, y0, t0, moved, onBike }
let mode = 'idle' // 'idle' | 'bike' | 'pan' | 'pinch' | 'locked' (espera soltar todos os dedos)
let primaryId = null // ponteiro que comanda o arraste atual (id do pointer em modo bike/pan)
let rig = null // CameraRig (definido em initPointerControls)
let isEnabled = () => false // o jogo diz quando os controles valem (jogando, sem janela aberta…)
let longPressTimer = 0 // id do setTimeout que detecta "segurar o dedo parado" (0 = nenhum)
let lastTap = null // último toque simples { t, x, y } (para detectar toque duplo)
let pinchDist = 0 // distância entre os dois dedos (px) no frame anterior da pinça
const hover = { x: 0, y: 0, dirty: false } // posição do mouse sem botão (para o cursor "mãozinha"); dirty = há posição nova para testar

// Objetos reaproveitados a cada frame (evita criar lixo para o coletor de memória)
const raycaster = new THREE.Raycaster() // lança um raio da câmera pelo ponto da tela
const ndc = new THREE.Vector2() // coordenadas normalizadas (−1..1) da tela para o raycaster
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0) // chão: y = 0
const hit = new THREE.Vector3() // resultado padrão de groundAt(): ponto do chão sob o ponteiro
const anchor = new THREE.Vector3() // ponto do chão agarrado (pan) ou deslocamento dedo→bike (arraste)
const projA = new THREE.Vector3() // pé da bike projetado na tela (pointerOnBike)
const projB = new THREE.Vector3() // topo da bike projetado na tela (pointerOnBike)
const camForward = new THREE.Vector3() // direção "frente" da câmera no chão (borda da tela)
const camRight = new THREE.Vector3() // direção "direita" da câmera no chão (borda da tela)

/**
 * Liga os controles à câmera e define quando eles estão ativos.
 * Chamada uma vez por main.js.
 * @param {CameraRig} cameraRig
 * @param {() => boolean} enabledFn - ex.: () => playing && !ui.isBlocked()
 */
export function initPointerControls(cameraRig, enabledFn) {
  rig = cameraRig
  isEnabled = enabledFn
}

/* ---------------- Utilidades de tela ↔ mundo ---------------- */

/**
 * Ponto do chão sob a coordenada de tela (x, y). Retorna null se o raio não tocar o chão (olhando o céu).
 * Converte px → NDC (−1..1), lança um raio da câmera e cruza com o plano y = 0.
 * @param {number} x - px, a partir da esquerda
 * @param {number} y - px, a partir do topo
 * @param {THREE.Vector3} out - vetor onde o resultado é gravado (padrão: `hit`)
 * @returns {THREE.Vector3|null}
 */
function groundAt(x, y, out = hit) {
  camera.updateMatrixWorld() // garante a câmera mais recente (ela pode ter andado neste frame)
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1)
  raycaster.setFromCamera(ndc, camera)
  return raycaster.ray.intersectPlane(groundPlane, out)
}

/**
 * O ponteiro em (x, y) está sobre a bike? Usa a área da bike na tela, com um mínimo confortável para dedos.
 * Projeta o pé (y = 0) e o topo (y = 2.6 m) da bike na tela; o raio clicável é o maior
 * entre SETTINGS.drag.bikeHitRadius e 65% da altura da bike na tela, centrado no meio dela.
 * @param {number} x - px
 * @param {number} y - px
 * @returns {boolean}
 */
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

/**
 * Ponto médio dos dois primeiros dedos (pinça).
 * @returns {{x:number, y:number, dist:number}} centro (px) e distância entre os dedos (px, nunca 0)
 */
function midpoint() {
  const [a, b] = pointers.values()
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) || 1 }
}

/** Cancela o timer de "segurar o dedo parado" (o dedo se mexeu, soltou ou virou pinça). */
function cancelLongPress() {
  clearTimeout(longPressTimer)
  longPressTimer = 0
}

/* ---------------- Início / fim de cada modo ---------------- */

/**
 * Entra no modo 'bike' (arrastar a bike).
 * Se o raio não toca o chão, trava ('locked'). Senão: avisa a bike (startDrag),
 * segura a câmera (rig.grab) e guarda a diferença dedo→bike em `anchor`.
 * @param {number} id - pointerId
 * @param {number} x - px
 * @param {number} y - px
 */
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

/**
 * Entra no modo 'pan' (arrastar o cenário).
 * Guarda em `anchor` o ponto do chão agarrado; a cada frame a câmera anda
 * para que esse ponto volte a ficar sob o dedo.
 * @param {number} id - pointerId
 * @param {number} x - px
 * @param {number} y - px
 */
function beginPan(id, x, y) {
  if (!groundAt(x, y, anchor)) return beginLocked()
  mode = 'pan'
  primaryId = id
  rig.grab()
}

/**
 * Entra no modo 'pinch' (dois dedos): solta a bike se estava arrastando,
 * anota a distância inicial entre os dedos e agarra o ponto do chão no meio deles.
 */
function beginPinch() {
  if (mode === 'bike') endDrag()
  const m = midpoint()
  pinchDist = m.dist
  mode = groundAt(m.x, m.y, anchor) ? 'pinch' : 'locked'
  rig.grab()
}

/** Entra no modo 'locked': ignora tudo até todos os ponteiros serem soltos. */
function beginLocked() {
  mode = 'locked'
  primaryId = null
}

/**
 * Encerra qualquer arraste em andamento (soltou, janela abriu, bike travou, atropelou…).
 * Solta a bike, libera a câmera (guardando o pan atual) e volta para 'idle'
 * (ou 'locked' se ainda há dedos na tela). Também cancela o timer de segurar.
 * Exportada porque main.js chama no atropelo.
 */
export function cancelPointerDrag() {
  if (mode === 'bike') endDrag()
  if (rig?.hold) rig.release(bike.body.position)
  mode = pointers.size ? 'locked' : 'idle'
  primaryId = null
  cancelLongPress()
}

/* ---------------- Toques curtos ---------------- */

/**
 * Toque/clique curto sem arrastar: toque duplo reseta a vista; toques soltos no cenário repetidos = inválido.
 * Toque duplo = segundo toque em menos de SETTINGS.tap.doubleGap ms e a menos de 40 px do primeiro.
 * Nesse caso, o primeiro toque é "perdoado" (forgetGesture) porque fazia parte de um gesto válido.
 * @param {{x:number, y:number, onBike:boolean}} p - ponteiro que foi solto
 * @param {PointerEvent} e
 */
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

// pointerdown: um dedo encostou ou um botão do mouse foi pressionado no canvas.
// Decide o modo conforme a quantidade de ponteiros: 1º → bike ou pan; 2º → pinça; 3º+ → inválido.
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

// pointermove: só atualiza a posição do ponteiro (o trabalho pesado é por frame).
// Marca `moved` quando o deslocamento passa de SETTINGS.tap.maxMove (deixa de ser toque).
// passive: true porque nunca chama preventDefault (a rolagem já é bloqueada por touch-action: none no CSS).
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

/**
 * Um ponteiro foi solto, cancelado ou perdeu a captura.
 * 1. Remove da lista e cancela o timer de segurar.
 * 2. Se foi um toque curto sem mover (só em pointerup, no modo bike/pan e sendo o
 *    ponteiro principal), trata como toque (handleTap).
 * 3. Pinça que perdeu um dedo → libera a câmera e trava até soltar tudo.
 *    Arraste principal solto → cancelPointerDrag().
 * 4. Sem ponteiros → 'idle'.
 * @param {PointerEvent} e
 */
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
// Os três eventos de "fim" usam a mesma função: soltou (pointerup), o sistema cancelou
// (pointercancel: ex. gesto do sistema no celular) ou a captura foi perdida (lostpointercapture)
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
// (passive: false é obrigatório para o preventDefault() valer em touchmove)
canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false })
// Sem "arrastar imagem" fantasma nem seleção de texto ao arrastar com o mouse
canvas.addEventListener('dragstart', (e) => e.preventDefault())
// Mouse saiu do canvas: para de testar o cursor
canvas.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && (hover.dirty = false), { passive: true })

// Trocou de aba/janela no meio de um arraste: solta tudo
// (os eventos pointerup nunca chegariam; sem isso a bike ficaria "presa" ao dedo)
addEventListener('blur', () => {
  pointers.clear()
  cancelPointerDrag()
  mode = 'idle'
})

/* ---------------- Atualização por frame ---------------- */

/**
 * Direções "frente" e "direita" da câmera projetadas no chão (para a câmera andar pela borda da tela).
 * Grava em camForward e camRight (vetores de módulo 1, sem componente y).
 */
function cameraGroundAxes() {
  camera.getWorldDirection(camForward)
  camForward.y = 0
  camForward.normalize()
  camRight.set(-camForward.z, 0, camForward.x) // 90° à direita da frente
}

/**
 * Quanto o ponteiro está "dentro" da faixa da borda: -1..1 por eixo (0 = longe das bordas).
 * A faixa tem SETTINGS.drag.edgeMargin da largura/altura da tela. ex = −1 na borda esquerda,
 * +1 na direita; ey = +1 no topo (frente), −1 embaixo (trás).
 * @param {number} x - px
 * @param {number} y - px
 * @returns {{ex:number, ey:number}}
 */
function edgePush(x, y) {
  const mx = innerWidth * SETTINGS.drag.edgeMargin
  const my = innerHeight * SETTINGS.drag.edgeMargin
  const ex = x < mx ? -(1 - x / mx) : x > innerWidth - mx ? 1 - (innerWidth - x) / mx : 0
  const ey = y < my ? 1 - y / my : y > innerHeight - my ? -(1 - (innerHeight - y) / my) : 0
  return { ex, ey }
}

let cursor = '' // valor atual de canvas.style.cursor ('' | 'grab' | 'grabbing'), para não reescrever o DOM à toa
/**
 * Troca o cursor do mouse sobre o canvas só quando o valor muda.
 * @param {''|'grab'|'grabbing'} value
 */
function setCursor(value) {
  if (value === cursor) return // só escreve no DOM quando muda
  cursor = value
  canvas.style.cursor = value
}

/**
 * Chamado uma vez por frame, ANTES da física. Aplica o arraste da bike, o pan
 * e a pinça usando a câmera do frame anterior. Como a câmera só translada
 * durante o arraste, o ponto agarrado fica exatamente sob o dedo.
 *
 * Por modo:
 * - desligado ou bike travada → cancela qualquer arraste e limpa o cursor.
 * - 'bike'  → se o ponteiro está na faixa da borda, a câmera anda (edgeSpeed);
 *             depois a bike vai para o ponto do chão sob o dedo + anchor.
 * - 'pan'   → a câmera anda para o ponto agarrado (anchor) voltar sob o dedo.
 * - 'pinch' → zoom pela variação da distância entre os dedos + pan pelo ponto médio.
 * - por fim, o cursor: 'grabbing' durante arrastes, 'grab' com o mouse parado sobre a bike.
 * @param {number} dt - tempo do frame em segundos
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
