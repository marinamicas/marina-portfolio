import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { scene, billboards } from '../core/stage.js'
import { materials, world } from '../core/physics.js'
import { AVATAR_IMAGE, BOUNDS } from '../data/level.js'
import { angleDelta, clamp } from '../utils/helpers.js'
import { applyCutout, makeBikeTexture } from '../utils/textures.js'
import { signs } from './environment.js'

const BIKE_Y = 0.6 // meia altura da caixa de colisão
const SIZE = 2.4

const spriteMaterial = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.4, side: THREE.DoubleSide })

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
}

// Recorte real em src/assets/cutouts/avatar/bike.webp (virado para a direita, rodas na base)
applyCutout(spriteMaterial, AVATAR_IMAGE, makeBikeTexture, (tex) => {
  bike.sprite.geometry.dispose()
  bike.sprite.geometry = new THREE.PlaneGeometry((SIZE * tex.image.width) / tex.image.height, SIZE)
})

world.addBody(bike.body)
bike.sprite.position.y = 0.4

const blobShadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.9, 24),
  new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.35, depthWrite: false }),
)
blobShadow.rotation.x = -Math.PI / 2
blobShadow.position.y = 0.03 - BIKE_Y
bike.group.add(bike.sprite, blobShadow)
scene.add(bike.group)
billboards.push(bike.sprite)

export function lockBike() {
  bike.locked = true
  bike.speed = 0
  bike.body.type = CANNON.Body.KINEMATIC
  bike.body.collisionResponse = false
  bike.body.velocity.setZero()
}

export function unlockBike() {
  bike.body.type = CANNON.Body.DYNAMIC
  bike.body.collisionResponse = true
  bike.body.wakeUp()
  bike.locked = false
}

export function placeBike(x, z, heading = bike.heading) {
  bike.body.position.set(x, BIKE_Y, z)
  bike.heading = heading
}

export function updateBike(input, dt) {
  if (bike.locked) return
  const max = input.boost ? 17 : 10
  const target = input.forward * (input.forward < 0 ? max * 0.4 : max)
  bike.speed = THREE.MathUtils.damp(bike.speed, target, input.forward ? 2.2 : 1.6, dt)
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

export function clampToBounds() {
  const p = bike.body.position
  p.x = clamp(p.x, BOUNDS.minX, BOUNDS.maxX)
  p.z = clamp(p.z, BOUNDS.minZ, BOUNDS.maxZ)
}

export function syncBike(dt, camYaw, time) {
  bike.group.position.copy(bike.body.position)
  // vira o recorte (efeito papel girando) conforme a direção na tela
  const side = -Math.sin(bike.heading) * Math.cos(camYaw) + Math.cos(bike.heading) * Math.sin(camYaw)
  if (Math.abs(side) > 0.15) bike.facing = Math.sign(side)
  bike.sprite.scale.x = THREE.MathUtils.damp(bike.sprite.scale.x, bike.facing, 12, dt)
  // balanço de pedalada
  bike.sprite.position.y = 0.4 + Math.abs(Math.sin(time * 18)) * Math.min(Math.abs(bike.speed), 10) * 0.006
}
