import * as THREE from 'three'
import { scene } from '../core/stage.js'
import { CRITTERS, FOREST, PALETTE } from '../data/level.js'
import { nearRoad, rand } from '../utils/helpers.js'

/* ==========================================================================
   BICHOS TRIANGULARES: borboletas, pássaros, coelhos e onças

   Todos são montados com triângulos, pirâmides e prismas (mesmo estilo low-poly
   do resto do mundo) e animados a cada quadro em updateCritters():
   - borboletas: duas asas triangulares batendo, passeiam em "oito" perto das ruas;
   - pássaros: asas maiores, voam em círculos no alto;
   - coelhos: pulam de um lado para o outro perto das ruas;
   - ONÇAS: andam de um ponto a outro cruzando as ruas (CRITTERS.jaguars em level.js).
     Encostar numa onça tira vida (main.js usa checkJaguarHit()).

   Convenção de direção: todo bicho é montado olhando para −Z (como a bike), então
   rotation.y = atan2(−dx, −dz) faz ele olhar para onde está indo.

   Dependências: three, stage.js (scene), level.js (CRITTERS, FOREST, PALETTE), helpers.
   Usado por: main.js (buildCritters uma vez; updateCritters e checkJaguarHit por quadro).

   Onde mexer:
   - Quantidades e caminhos das onças: CRITTERS em src/data/level.js.
   - Cores e formas: funções make*() abaixo.
   ========================================================================== */

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra })
/** Triângulo plano (asa): ponta em (0,0,0) ligada ao corpo, abre para o lado +X. */
function wingGeometry(len, width) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -width / 2, len, 0, 0, 0, 0, width / 2], 3))
  g.computeVertexNormals()
  return g
}

const butterflies = [] // { group, wings:[l,r], cx, cz, y, r, speed, phase }
const birds = [] // { group, wings:[l,r], cx, cz, y, r, speed, phase }
const rabbits = [] // { group, ax, az, bx, bz, phase, speed }
/** Onças: { group, legs, from, to, speed, t, dir, pause }. Lidas por checkJaguarHit. */
export const jaguars = []

/** Ponto aleatório perto (mas fora) das ruas, onde os bichos ficam visíveis. */
function spotNearRoad(min = 4.5, max = 18) {
  for (let i = 0; i < 200; i++) {
    const x = rand(FOREST.area.minX, FOREST.area.maxX)
    const z = rand(FOREST.area.minZ, FOREST.area.maxZ)
    if (!nearRoad(x, z, min) && nearRoad(x, z, max)) return { x, z }
  }
  return { x: 0, z: -20 }
}

/** Borboleta: corpinho fino + 2 asas triangulares coloridas (DoubleSide = visíveis dos dois lados). */
function makeButterfly(color) {
  const group = new THREE.Group()
  const wingMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
  const geo = wingGeometry(0.32, 0.36)
  const right = new THREE.Mesh(geo, wingMat)
  const left = new THREE.Mesh(geo, wingMat)
  left.scale.x = -1 // espelhada para o outro lado
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.3, 3), mat(PALETTE.ink))
  body.rotation.x = Math.PI / 2
  group.add(right, left, body)
  return { group, wings: [left, right] }
}

/** Pássaro: corpo em pirâmide + asas triangulares grandes. */
function makeBird() {
  const group = new THREE.Group()
  const wingMat = new THREE.MeshBasicMaterial({ color: PALETTE.white, side: THREE.DoubleSide })
  const geo = wingGeometry(0.9, 0.55)
  const right = new THREE.Mesh(geo, wingMat)
  const left = new THREE.Mesh(geo, wingMat)
  left.scale.x = -1
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7, 3), mat(PALETTE.ink))
  body.rotation.x = -Math.PI / 2 // bico para −Z (frente)
  group.add(right, left, body)
  return { group, wings: [left, right] }
}

/** Coelho: corpo em pirâmide triangular, cabeça, duas orelhas compridas e rabinho. */
function makeRabbit() {
  const group = new THREE.Group()
  const fur = mat('#d9d2c5')
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 3), fur)
  body.rotation.x = Math.PI / 2.4
  body.position.y = 0.3
  const head = new THREE.Mesh(new THREE.TetrahedronGeometry(0.18), fur)
  head.position.set(0, 0.5, -0.28)
  group.add(body, head)
  for (const side of [1, -1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.36, 3), fur)
    ear.position.set(0.07 * side, 0.75, -0.24)
    ear.rotation.z = -0.15 * side
    group.add(ear)
  }
  const tail = new THREE.Mesh(new THREE.TetrahedronGeometry(0.08), mat(PALETTE.white))
  tail.position.set(0, 0.32, 0.3)
  group.add(tail)
  return group
}

/**
 * Onça triangular: corpo em prisma deitado, cabeça em pirâmide apontando para a frente,
 * orelhas, 4 patas em pirâmide (animadas), rabo e pintas pretas triangulares nas laterais.
 * Olhos amarelos brilhantes para ser vista de longe.
 */
function makeJaguar() {
  const group = new THREE.Group()
  const coat = mat('#e39b2e')
  const dark = new THREE.MeshBasicMaterial({ color: '#1a1008', side: THREE.DoubleSide })
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 1.6, 3), coat)
  body.rotation.x = Math.PI / 2 // deitado ao longo de Z
  body.position.y = 0.75
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.62, 3), coat)
  head.rotation.x = -Math.PI / 2 // focinho para −Z
  head.position.set(0, 0.95, -1.05)
  group.add(body, head)
  for (const side of [1, -1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 3), coat)
    ear.position.set(0.17 * side, 1.25, -0.88)
    group.add(ear)
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.04), new THREE.MeshBasicMaterial({ color: '#d7ff3a' }))
    eye.position.set(0.13 * side, 1.02, -1.18)
    group.add(eye)
    // Pintas: triângulos pretos colados nas laterais do corpo
    for (let k = 0; k < 4; k++) {
      const spot = new THREE.Mesh(new THREE.CircleGeometry(rand(0.08, 0.13), 3), dark)
      spot.position.set(0.37 * side, 0.7 + rand(-0.12, 0.18), -0.55 + k * 0.36)
      spot.rotation.y = (Math.PI / 2) * side
      spot.rotation.z = rand(0, Math.PI)
      group.add(spot)
    }
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.9, 3), coat)
  tail.position.set(0, 0.95, 1.15)
  tail.rotation.x = -1.1
  group.add(tail)
  const legs = []
  for (const [x, z] of [[0.24, -0.55], [-0.24, -0.55], [0.24, 0.55], [-0.24, 0.55]]) {
    const leg = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.65, 3), coat)
    leg.geometry.translate(0, -0.325, 0) // ponta da pirâmide no "ombro" (y = 0), base no chão: gira a partir do ombro
    leg.position.set(x, 0.65, z)
    group.add(leg)
    legs.push(leg)
  }
  return { group, legs }
}

/** Cria todos os bichos (chamado uma vez por main.js). */
export function buildCritters() {
  for (let i = 0; i < CRITTERS.butterflies; i++) {
    const b = makeButterfly(FOREST.flowerColors[i % FOREST.flowerColors.length])
    const s = spotNearRoad(4, 12)
    Object.assign(b, { cx: s.x, cz: s.z, y: rand(0.8, 2.4), r: rand(1.5, 4), speed: rand(0.5, 1.1), phase: rand(0, 6.28) })
    scene.add(b.group)
    butterflies.push(b)
  }
  for (let i = 0; i < CRITTERS.birds; i++) {
    const b = makeBird()
    const s = spotNearRoad(0, 40)
    Object.assign(b, { cx: s.x, cz: s.z, y: rand(9, 15), r: rand(8, 20), speed: rand(0.25, 0.5) * (i % 2 ? 1 : -1), phase: rand(0, 6.28) })
    scene.add(b.group)
    birds.push(b)
  }
  for (let i = 0; i < CRITTERS.rabbits; i++) {
    const group = makeRabbit()
    const s = spotNearRoad(5, 14)
    const a = rand(0, Math.PI * 2)
    const r = { group, ax: s.x, az: s.z, bx: s.x + Math.cos(a) * 4, bz: s.z + Math.sin(a) * 4, phase: rand(0, 6.28), speed: rand(0.25, 0.45) }
    scene.add(group)
    rabbits.push(r)
  }
  for (const cfg of CRITTERS.jaguars) {
    const j = makeJaguar()
    Object.assign(j, { from: cfg.from, to: cfg.to, speed: cfg.speed, t: Math.random(), dir: 1, pause: 0 })
    scene.add(j.group)
    jaguars.push(j)
  }
}

/**
 * Anima todos os bichos. Chamada uma vez por quadro por main.js.
 * @param {number} time relógio do jogo (s)
 * @param {number} dt tempo do quadro (s, já com a câmera lenta do atropelo)
 */
export function updateCritters(time, dt) {
  for (const b of butterflies) {
    const t = time * b.speed + b.phase
    // trajetória em "oito" (curva de Lissajous) em volta do ponto central
    const x = b.cx + Math.sin(t) * b.r
    const z = b.cz + Math.sin(t * 2) * b.r * 0.5
    const nx = b.cx + Math.sin(t + 0.05) * b.r
    const nz = b.cz + Math.sin((t + 0.05) * 2) * b.r * 0.5
    b.group.position.set(x, b.y + Math.sin(t * 3) * 0.3, z)
    b.group.rotation.y = Math.atan2(-(nx - x), -(nz - z))
    const flap = Math.sin(time * 22 + b.phase) * 0.9 // batida rápida das asas
    b.wings[0].rotation.z = flap
    b.wings[1].rotation.z = -flap
  }
  for (const b of birds) {
    const a = time * b.speed + b.phase
    b.group.position.set(b.cx + Math.cos(a) * b.r, b.y + Math.sin(time * 0.8 + b.phase), b.cz + Math.sin(a) * b.r)
    // olha na direção tangente ao círculo
    b.group.rotation.y = Math.atan2(Math.sin(a) * Math.sign(b.speed), -Math.cos(a) * Math.sign(b.speed))
    const flap = Math.sin(time * 6 + b.phase) * 0.5
    b.wings[0].rotation.z = flap
    b.wings[1].rotation.z = -flap
  }
  for (const r of rabbits) {
    const t = (Math.sin(time * r.speed + r.phase) + 1) / 2 // vai e volta entre A e B
    const x = r.ax + (r.bx - r.ax) * t
    const z = r.az + (r.bz - r.az) * t
    const going = Math.cos(time * r.speed + r.phase) >= 0
    r.group.position.set(x, Math.abs(Math.sin(time * 7 + r.phase)) * 0.35, z) // pulinhos
    r.group.rotation.y = Math.atan2(-(r.bx - r.ax) * (going ? 1 : -1), -(r.bz - r.az) * (going ? 1 : -1))
  }
  for (const j of jaguars) {
    const [ax, az] = j.from
    const [bx, bz] = j.to
    const len = Math.hypot(bx - ax, bz - az) || 1
    if (j.pause > 0) j.pause -= dt // parada rápida nas pontas (e depois de atacar)
    else {
      j.t += (j.dir * j.speed * dt) / len
      if (j.t > 1 || j.t < 0) {
        j.t = Math.min(1, Math.max(0, j.t))
        j.dir *= -1
        j.pause = 0.8
      }
    }
    const x = ax + (bx - ax) * j.t
    const z = az + (bz - az) * j.t
    j.group.position.set(x, 0, z)
    j.group.rotation.y = Math.atan2(-(bx - ax) * j.dir, -(bz - az) * j.dir)
    const walking = j.pause > 0 ? 0 : 1
    // passada: patas em pares alternados balançando para frente e para trás
    j.legs.forEach((leg, i) => (leg.rotation.x = Math.sin(time * 9 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.45 * walking))
  }
}

/**
 * Onça encostando na bike agora (ou null).
 * @param {{x:number, z:number}} p posição da bike
 */
export function checkJaguarHit(p) {
  const r = CRITTERS.jaguarHitRadius
  for (const j of jaguars) {
    const dx = p.x - j.group.position.x
    const dz = p.z - j.group.position.z
    if (dx * dx + dz * dz < r * r) return j
  }
  return null
}

/** Depois de pegar a bike, a onça para um instante (dá tempo de fugir). */
export function stunJaguar(j) {
  j.pause = 1.5
}
