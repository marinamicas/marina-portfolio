import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { scene, billboards } from '../core/stage.js'
import { world } from '../core/physics.js'
import { PALETTE, ROADS, ROAD_WIDTH, SIGNS, TEXTS } from '../data/level.js'
import { rand, nearRoad } from '../utils/helpers.js'
import { applyCutout, makeCutoutTexture, makePaperTexture, makeTextPlane } from '../utils/textures.js'

/*
  Cenário: chão de papel, ruas, triângulos de colagem, prismas empurráveis,
  placas magnéticas e o horizonte com a frase final.
*/

export const decor = [] // triângulos flutuantes (só visuais)
export const props = [] // prismas triangulares empurráveis (com física)
export const signs = [] // placas magnéticas
export const horizon = new THREE.Group() // nuvem + frase final

// Chão de papel + ruas (um plano por segmento) com faixa central em pedaços de fita
function buildGround() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshStandardMaterial({ map: makePaperTexture('#17111f', 40) }))
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  const roadMat = new THREE.MeshStandardMaterial({ map: makePaperTexture('#2a1f3d', 2) })
  const stripeMat = new THREE.MeshBasicMaterial({ color: PALETTE.lilac, transparent: true, opacity: 0.5 })
  ROADS.forEach(([a, b], i) => {
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const len = Math.hypot(dx, dz)
    const angle = Math.atan2(-dx, -dz)
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, len + ROAD_WIDTH), roadMat)
    road.rotation.x = -Math.PI / 2
    road.rotation.z = angle
    road.position.set((a[0] + b[0]) / 2, 0.02 + i * 0.002, (a[1] + b[1]) / 2) // y diferente evita z-fighting
    scene.add(road)

    // faixa central em "pedaços de fita"
    for (let d = 3; d < len - 2; d += 6) {
      const t = d / len
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 2.4), stripeMat)
      stripe.rotation.x = -Math.PI / 2
      stripe.rotation.z = angle + rand(-0.08, 0.08)
      stripe.position.set(a[0] + dx * t, 0.05 + i * 0.002, a[1] + dz * t)
      scene.add(stripe)
    }
  })
}

// Triângulos flutuantes decorativos (sem física), longe das ruas para não atrapalhar
function buildDecor() {
  const triGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(-0.87, -0.5, 0),
    new THREE.Vector3(0.87, -0.5, 0),
  ])
  const paper = makePaperTexture(PALETTE.white, 1)
  const mats = [
    new THREE.MeshBasicMaterial({ color: PALETTE.white, map: paper, side: THREE.DoubleSide }),
    new THREE.MeshBasicMaterial({ color: PALETTE.purple, side: THREE.DoubleSide }),
    new THREE.MeshBasicMaterial({ color: PALETTE.lilac, side: THREE.DoubleSide }),
    new THREE.MeshBasicMaterial({ color: PALETTE.violet, side: THREE.DoubleSide }),
    new THREE.MeshBasicMaterial({ color: PALETTE.white, wireframe: true }),
  ]
  for (let i = 0; i < 200; i++) {
    const x = rand(-120, 100)
    const z = rand(-195, 30) // não invade a área do horizonte
    const y = rand(0.5, 18)
    if (y < 5 && nearRoad(x, z, 6)) continue
    const mesh = new THREE.Mesh(triGeo, mats[i % mats.length])
    mesh.position.set(x, y, z)
    mesh.scale.setScalar(rand(0.3, 2.4))
    mesh.rotation.set(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28))
    scene.add(mesh)
    decor.push({ mesh, baseY: y, phase: rand(0, 6.28), spin: rand(-0.4, 0.4) })
  }

  // triângulos "colados" no chão, como recortes caídos
  for (let i = 0; i < 90; i++) {
    const x = rand(-110, 100)
    const z = rand(-200, 30)
    if (nearRoad(x, z, 4.5)) continue
    const mesh = new THREE.Mesh(triGeo, mats[i % 4])
    mesh.rotation.set(-Math.PI / 2, 0, rand(0, 6.28))
    mesh.position.set(x, 0.03, z)
    mesh.scale.setScalar(rand(0.5, 3))
    scene.add(mesh)
  }
}

// Prismas triangulares com física: a bike pode empurrá-los
function buildProps() {
  const mats = [PALETTE.white, PALETTE.purple, PALETTE.black].map((color) => new THREE.MeshStandardMaterial({ color, flatShading: true }))
  let placed = 0
  let tries = 0
  while (placed < 40 && tries++ < 3000) {
    const x = rand(-60, 45)
    const z = rand(-160, 5)
    if (!nearRoad(x, z, 10) || nearRoad(x, z, 4.5)) continue
    if (SIGNS.some((s) => Math.hypot(s.x - x, s.z - z) < 4)) continue // não esconder as placas
    const r = rand(0.5, 1.1)
    const h = rand(0.8, 2)
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 3), mats[placed % 3])
    // colisor aproximado (caixa inscrita no prisma): robusto e barato
    const body = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Box(new CANNON.Vec3(r * 0.6, h / 2, r * 0.6)),
      position: new CANNON.Vec3(x, h / 2, z),
      linearDamping: 0.3,
      angularDamping: 0.4,
    })
    body.quaternion.setFromEuler(0, rand(0, Math.PI * 2), 0)
    body.sleepSpeedLimit = 0.3
    world.addBody(body)
    scene.add(mesh)
    props.push({ mesh, body, home: { position: body.position.clone(), quaternion: body.quaternion.clone() } })
    placed++
  }
}

// Placas com poste, ímã e recorte; cada uma tem um corpo físico estático (o poste)
function buildSigns() {
  const postMat = new THREE.MeshStandardMaterial({ color: PALETTE.black })
  const magnetMat = new THREE.MeshStandardMaterial({ color: PALETTE.purple, emissive: PALETTE.purple, emissiveIntensity: 0.6 })
  for (const sign of SIGNS) {
    const group = new THREE.Group()
    group.position.set(sign.x, 0, sign.z)
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.4, 0.15), postMat)
    post.position.y = 1.2
    const magnet = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.09, 6, 12, Math.PI), magnetMat) // ímã no topo do poste
    magnet.position.y = 2.25
    magnet.rotation.z = Math.PI
    const material = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.4, side: THREE.DoubleSide })
    applyCutout(material, sign.image, () => makeCutoutTexture({ title: sign.label, width: 640, height: 300 }))
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.7), material)
    plate.position.y = 3.1
    group.add(post, magnet, plate)
    scene.add(group)
    billboards.push(group)
    world.addBody(
      new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Box(new CANNON.Vec3(0.2, 1.5, 0.2)), position: new CANNON.Vec3(sign.x, 1.5, sign.z) }),
    )
    signs.push({ ...sign, group, plate, magnet })
  }
}

// Linha do horizonte, nuvem de triângulos e a frase final no fim das ruas
function buildHorizon() {
  const line = new THREE.Mesh(new THREE.PlaneGeometry(500, 0.25), new THREE.MeshBasicMaterial({ color: PALETTE.white, fog: false }))
  line.rotation.x = -Math.PI / 2
  line.position.set(0, 0.05, -205)
  scene.add(line)

  // Nuvem de triângulos que encontra a linha do horizonte. O grupo acompanha a bike
  // no eixo X (como algo no infinito), então a frase fica legível no fim de qualquer rua.
  const cloudMats = [PALETTE.white, PALETTE.lilac, PALETTE.violet].map((color) => new THREE.MeshBasicMaterial({ color, fog: false }))
  for (let i = 0; i < 26; i++) {
    const tri = new THREE.Mesh(new THREE.CircleGeometry(rand(4, 10), 3), cloudMats[i % 3])
    const angle = rand(0, Math.PI * 2)
    tri.position.set(Math.cos(angle) * rand(22, 34), Math.sin(angle) * rand(8, 13), -2 - i * 0.05) // z distinto evita z-fighting
    tri.rotation.z = rand(0, Math.PI * 2)
    horizon.add(tri)
  }
  const text = makeTextPlane(TEXTS.end, { width: 48, fontSize: 46, canvasWidth: 1600, color: PALETTE.ink, bg: PALETTE.white })
  text.material.fog = false
  horizon.add(text)
  horizon.position.set(0, 13, -225)
  scene.add(horizon)
}

/** Monta todo o cenário (chamado uma vez ao iniciar). */
export function buildEnvironment() {
  buildGround()
  buildDecor()
  buildProps()
  buildSigns()
  buildHorizon()
}

/** Copia posição/rotação da física para os prismas visíveis (a cada frame). */
export function syncProps() {
  for (const p of props) {
    p.mesh.position.copy(p.body.position)
    p.mesh.quaternion.copy(p.body.quaternion)
  }
}

/** Animações leves do cenário a cada frame: horizonte, enfeites e placas. */
export function animateEnvironment(time, dt, bikePos) {
  horizon.position.x = THREE.MathUtils.damp(horizon.position.x, bikePos.x, 1.5, dt)
  horizon.position.y = 13 + Math.sin(time * 0.4) * 0.6
  for (const d of decor) {
    d.mesh.position.y = d.baseY + Math.sin(time + d.phase) * 0.3
    d.mesh.rotation.y += d.spin * dt
  }
  // placas balançam e o ímã pulsa quando a bike se aproxima
  for (const s of signs) {
    const near = Math.max(0, 1 - Math.hypot(bikePos.x - s.x, bikePos.z - s.z) / 9)
    s.plate.rotation.z = Math.sin(time * 6) * 0.06 * near
    s.magnet.scale.setScalar(1 + near * 0.4 * (0.5 + 0.5 * Math.sin(time * 10)))
  }
}
