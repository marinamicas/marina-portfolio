import * as THREE from 'three'
import { scene } from '../core/stage.js'
import { PALETTE, SNOW } from '../data/level.js'
import { rand } from '../utils/helpers.js'

/* ==========================================================================
   NEVE DE TRIÂNGULOS

   Os triângulos que antes flutuavam parados no ar viraram flocos de neve:
   pequenos, quase transparentes (SNOW.opacity) e caindo devagar, girando e
   balançando de lado. Para nunca "acabar" a neve, os flocos vivem numa caixa
   (SNOW.box) centrada na câmera: quem sai por um lado volta pelo outro, e quem
   chega ao chão volta para o alto.

   Tudo é um único InstancedMesh (uma malha só na placa de vídeo para todos os
   flocos), então é leve mesmo no celular.

   Dependências: three, stage.js (scene), level.js (SNOW, PALETTE), helpers.
   Usado por: main.js (buildSnow uma vez; updateSnow por quadro com o centro da câmera).

   Onde mexer: SNOW em src/data/level.js (quantidade, transparência, tamanho, velocidade).
   ========================================================================== */

let mesh = null
/** Dados de cada floco: posição, velocidade de queda, balanço e giro. */
const flakes = []
const m = new THREE.Matrix4()
const q = new THREE.Quaternion()
const e = new THREE.Euler()
const p = new THREE.Vector3()
const s = new THREE.Vector3()

/** Cria os flocos espalhados na caixa em volta do ponto inicial (0, 0). */
export function buildSnow() {
  const tri = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1, 0), new THREE.Vector3(-0.87, -0.5, 0), new THREE.Vector3(0.87, -0.5, 0)])
  const material = new THREE.MeshBasicMaterial({ color: PALETTE.white, transparent: true, opacity: SNOW.opacity, depthWrite: false, side: THREE.DoubleSide })
  mesh = new THREE.InstancedMesh(tri, material, SNOW.count)
  mesh.frustumCulled = false // os flocos se movem o tempo todo em volta da câmera
  const { box } = SNOW
  for (let i = 0; i < SNOW.count; i++) {
    flakes.push({
      x: rand(-box.x / 2, box.x / 2),
      y: rand(0, box.y),
      z: rand(-box.z / 2, box.z / 2),
      fall: rand(SNOW.fallSpeed[0], SNOW.fallSpeed[1]),
      size: rand(SNOW.size[0], SNOW.size[1]),
      sway: rand(0.3, 0.9),
      phase: rand(0, 6.28),
      spin: rand(-1.5, 1.5),
    })
  }
  scene.add(mesh)
}

/** Raio (m) em volta da lente da câmera sem flocos: um floco rente à lente viraria um triângulo enorme na tela. */
const CAMERA_CLEAR = 7

/**
 * Faz a neve cair e mantém os flocos na caixa em volta de `center` (o alvo da câmera).
 * Flocos a menos de CAMERA_CLEAR metros da câmera ficam invisíveis (escala 0) até se afastarem.
 * @param {number} time relógio (s)
 * @param {number} dt tempo do quadro (s)
 * @param {{x:number, z:number}} center
 * @param {{x:number, y:number, z:number}} cam posição da câmera
 */
export function updateSnow(time, dt, center, cam) {
  if (!mesh) return
  const { box } = SNOW
  for (let i = 0; i < flakes.length; i++) {
    const f = flakes[i]
    f.y -= f.fall * dt
    f.x += Math.sin(time * f.sway + f.phase) * 0.4 * dt // balanço lateral
    if (f.y < 0) f.y += box.y // chegou ao chão: volta para o alto
    // Mantém o floco dentro da caixa centrada na câmera (sai por um lado, entra pelo outro)
    if (f.x - center.x > box.x / 2) f.x -= box.x
    else if (f.x - center.x < -box.x / 2) f.x += box.x
    if (f.z - center.z > box.z / 2) f.z -= box.z
    else if (f.z - center.z < -box.z / 2) f.z += box.z
    e.set(time * f.spin, time * f.spin * 0.7, f.phase)
    const nearLens = (f.x - cam.x) ** 2 + (f.y - cam.y) ** 2 + (f.z - cam.z) ** 2 < CAMERA_CLEAR * CAMERA_CLEAR
    m.compose(p.set(f.x, f.y, f.z), q.setFromEuler(e), s.setScalar(nearLens ? 0 : f.size))
    mesh.setMatrixAt(i, m)
  }
  mesh.instanceMatrix.needsUpdate = true
}
