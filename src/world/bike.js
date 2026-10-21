import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { scene, billboards } from '../core/stage.js'
import { materials, world } from '../core/physics.js'
import { AVATAR_IMAGE, BOUNDS } from '../data/level.js'
import { angleDelta, clamp } from '../utils/helpers.js'
import { applyCutout, makeBikeTexture } from '../utils/textures.js'
import { signs } from './environment.js'

/*
  Bicicleta do jogador: recorte 2D que sempre encara a câmera + caixa física
  invisível. A velocidade é controlada direto pelo código (estilo arcade).
*/

const BIKE_Y = 0.6 // meia altura da caixa de colisão
const SIZE = 2.4

const spriteMaterial = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.4, side: THREE.DoubleSide })

// Estado público da bike (lido por câmera, inventário, rebobinar…)
export const bike = {
  body: new CANNON.Body({
    mass: 5,
    shape: new CANNON.Box(new CANNON.Vec3(0.5, BIKE_Y, 0.5)),
    position: new CANNON.Vec3(0, BIKE_Y, 0),
    fixedRotation: true,
    linearDamping: 0.1,
    allowSleep: false, // a velocidade é aplicada direto; um corpo "dormindo" a ignoraria
    material: materials.bike,
  }),
  group: new THREE.Group(),
  sprite: new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), spriteMaterial),
  heading: 0, // 0 = olhando para -Z
  speed: 0,
  facing: 1,
  locked: false,
  dragging: false, // true enquanto o jogador arrasta a bike com o dedo/mouse
  dragTarget: { x: 0, z: 0 }, // ponto do chão onde o dedo/mouse está (destino exato da bike)
  prevPos: { x: 0, z: 0 }, // posição no frame anterior (detecção de atropelo em arrastes rápidos)
}

// Recorte real em src/assets/cutouts/avatar/bike.webp (virado para a direita, rodas na base)
applyCutout(spriteMaterial, AVATAR_IMAGE, makeBikeTexture, (tex) => {
  bike.sprite.geometry.dispose()
  bike.sprite.geometry = new THREE.PlaneGeometry((SIZE * tex.image.width) / tex.image.height, SIZE)
})

world.addBody(bike.body)
bike.sprite.position.y = 0.4

// Sombra redonda simples embaixo da bike (mais leve que sombras reais)
const blobShadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.9, 24),
  new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.35, depthWrite: false }),
)
blobShadow.rotation.x = -Math.PI / 2
blobShadow.position.y = 0.03 - BIKE_Y
bike.group.add(bike.sprite, blobShadow)
scene.add(bike.group)
billboards.push(bike.sprite)

/** Trava a bike (intro, rebobinar, viagens): sem física nem controle do jogador. */
export function lockBike() {
  bike.dragging = false
  bike.locked = true
  bike.speed = 0
  bike.body.type = CANNON.Body.KINEMATIC
  bike.body.collisionResponse = false
  bike.body.velocity.setZero()
}

/** Devolve o controle da bike ao jogador. */
export function unlockBike() {
  bike.body.type = CANNON.Body.DYNAMIC
  bike.body.collisionResponse = true
  bike.body.wakeUp()
  bike.locked = false
}

/**
 * Começa o arraste direto: a bike vira um corpo cinemático (sem inércia),
 * que vai exatamente para onde o jogador apontar e ainda empurra os prismas.
 */
export function startDrag() {
  const p = bike.body.position
  bike.dragging = true
  bike.speed = 0
  bike.dragTarget.x = p.x
  bike.dragTarget.z = p.z
  bike.body.type = CANNON.Body.KINEMATIC
  bike.body.collisionResponse = true
  bike.body.velocity.setZero()
}

/** Atualiza o destino do arraste (limitado ao mapa). */
export function dragTo(x, z) {
  bike.dragTarget.x = clamp(x, BOUNDS.minX, BOUNDS.maxX)
  bike.dragTarget.z = clamp(z, BOUNDS.minZ, BOUNDS.maxZ)
}

/** Solta a bike: ela para exatamente onde foi deixada (sem deslizar). */
export function endDrag() {
  if (!bike.dragging) return
  bike.dragging = false
  bike.speed = 0
  bike.body.velocity.setZero()
  if (bike.locked) return // travada por intro/rebobinar: quem destravar define o tipo do corpo
  bike.body.type = CANNON.Body.DYNAMIC
  bike.body.wakeUp()
}

/** Teletransporta a bike para (x, z) com a direção `heading`. */
export function placeBike(x, z, heading = bike.heading) {
  bike.body.position.set(x, BIKE_Y, z)
  bike.heading = heading
}

/** Aplica o input do jogador: acelera, vira e sofre a atração das placas magnéticas. */
export function updateBike(input, dt) {
  if (bike.locked) return

  // Arraste direto: velocidade = distância até o dedo ÷ tempo do frame. Assim a física
  // leva a bike até o ponto em um único passo e os prismas no caminho são empurrados.
  if (bike.dragging) {
    const p = bike.body.position
    const dx = bike.dragTarget.x - p.x
    const dz = bike.dragTarget.z - p.z
    const dist = Math.hypot(dx, dz)
    bike.body.velocity.set(dx / dt, 0, dz / dt)
    if (dist > 0.02) bike.heading = Math.atan2(-dx, -dz) // o recorte vira para o lado do movimento
    bike.speed = dist / dt
    return
  }

  // Teclado (W A S D / setas): resposta rápida, sem a "inércia" longa de antes
  const max = input.boost ? 17 : 10
  const target = input.forward * (input.forward < 0 ? max * 0.4 : max)
  bike.speed = THREE.MathUtils.damp(bike.speed, target, input.forward ? 8 : 10, dt)
  const grip = clamp(Math.abs(bike.speed) / 3, 0, 1) // só vira em movimento
  bike.heading += input.turn * 2.6 * grip * Math.sign(bike.speed || 1) * dt

  // Placas magnéticas: se o jogador não está virando, puxam a bike para a rua que indicam
  if (!input.turn && bike.speed > 1) {
    const p = bike.body.position
    let nearest = null
    let best = 7
    for (const s of signs) {
      const d = Math.hypot(p.x - s.x, p.z - s.z)
      if (d < best) {
        best = d
        nearest = s
      }
    }
    if (nearest) {
      const desired = Math.atan2(-(nearest.pull[0] - p.x), -(nearest.pull[1] - p.z))
      const delta = angleDelta(bike.heading, desired)
      // só atrai se o ponto estiver à frente (nunca faz a bike dar meia-volta)
      if (Math.abs(delta) < Math.PI / 2) bike.heading += delta * (1 - best / 7) * 2.5 * dt
    }
  }

  bike.body.velocity.x = -Math.sin(bike.heading) * bike.speed
  bike.body.velocity.z = -Math.cos(bike.heading) * bike.speed
}

/** Impede a bike de sair dos limites do mapa (BOUNDS em level.js). */
export function clampToBounds() {
  const p = bike.body.position
  if (bike.dragging) {
    // Garante que a bike termine o frame exatamente sob o dedo/mouse
    p.x = bike.dragTarget.x
    p.z = bike.dragTarget.z
    p.y = BIKE_Y
  }
  p.x = clamp(p.x, BOUNDS.minX, BOUNDS.maxX)
  p.z = clamp(p.z, BOUNDS.minZ, BOUNDS.maxZ)
}

/** Copia a física para o desenho da bike e vira o recorte para o lado em que ela anda. */
export function syncBike(dt, camYaw, time) {
  bike.group.position.copy(bike.body.position)
  // vira o recorte (efeito papel girando) conforme a direção na tela
  const side = -Math.sin(bike.heading) * Math.cos(camYaw) + Math.cos(bike.heading) * Math.sin(camYaw)
  if (Math.abs(side) > 0.15) bike.facing = Math.sign(side)
  bike.sprite.scale.x = THREE.MathUtils.damp(bike.sprite.scale.x, bike.facing, 12, dt)
  // Arrastando: a bike "levanta" um pouco do chão, como um recorte de papel sendo segurado
  const lift = bike.dragging ? 0.35 : 0
  bike.lift = THREE.MathUtils.damp(bike.lift ?? 0, lift, 14, dt)
  // balanço de pedalada (só no teclado; no arraste a bike acompanha o dedo sem tremer)
  const pedal = bike.dragging ? 0 : Math.abs(Math.sin(time * 18)) * Math.min(Math.abs(bike.speed), 10) * 0.006
  bike.sprite.position.y = 0.4 + bike.lift + pedal
}
