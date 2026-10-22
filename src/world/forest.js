import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { scene } from '../core/stage.js'
import { world } from '../core/physics.js'
import { CRITTERS, END_SIGNS, FOREST, ITEMS, ROAD_WIDTH, SIGNS } from '../data/level.js'
import { distToSegment, nearRoad, rand } from '../utils/helpers.js'
import { props } from './environment.js'

/* ==========================================================================
   FLORESTA TRIANGULAR: árvores (com colisão) e flores (enfeite)

   Papel deste arquivo:
   - Plantar FOREST.trees árvores low-poly (tronco de 5 lados + duas copas em
     pirâmide de 4 e 3 lados) e FOREST.flowers flores (caule + 3 pétalas
     triangulares), todas fixas no chão, fora das ruas.
   - Usar InstancedMesh: centenas de árvores viram poucas "malhas" na placa de
     vídeo (uma por tipo de peça), o que mantém o jogo leve no celular.
   - Dar a cada árvore um colisor físico estático (a bike é barrada) e expor
     checkTreeHit(), usado por main.js para tirar vida (LIVES.treeDamage).

   Onde as árvores NÃO nascem (para o jogo continuar jogável):
   - a menos de FOREST.roadClearance metros do centro de qualquer rua;
   - perto do ponto de partida, das placas, das placas de fim de rota, dos
     recortes e das janelas presas no chão deles;
   - em cima do caminho das onças (CRITTERS.jaguars);
   - a menos de 3,2 m de outra árvore.

   Dependências: three, cannon-es, stage.js, physics.js, level.js, helpers.
   Usado por: main.js (buildForest uma vez; checkTreeHit por quadro).

   Onde mexer: FOREST em src/data/level.js (quantidade, cores, alturas, distância da rua).
   ========================================================================== */

/** Árvores plantadas: { x, z, h } (posição no chão e altura em metros). */
export const trees = []

/** Pontos onde não pode ter árvore: { x, z, r } (centro e raio em metros). */
function blockedSpots() {
  const spots = [{ x: 0, z: 0, r: 10 }] // ponto de partida (abertura com o triângulo neon)
  for (const p of props) spots.push({ x: p.home.position.x, z: p.home.position.z, r: 2.5 }) // prismas empurráveis
  for (const s of SIGNS) spots.push({ x: s.x, z: s.z, r: 5 })
  for (const s of END_SIGNS) spots.push({ x: s.x, z: s.z, r: 6 })
  for (const it of ITEMS) {
    const [x, z] = it.position
    spots.push({ x, z, r: 5 }, { x: x + ROAD_WIDTH / 2 + 0.5, z, r: 4 }) // recorte + janela presa no chão
  }
  return spots
}

/** true se (x, z) estiver perto do caminho de alguma onça (deixa a passagem livre). */
const onJaguarPath = (x, z) => CRITTERS.jaguars.some((j) => distToSegment(x, z, j.from, j.to) < 3)

/**
 * Sorteia posições válidas para as árvores (até 40 tentativas por árvore).
 * @returns {{x:number, z:number, h:number}[]}
 */
function pickTreeSpots() {
  const spots = blockedSpots()
  const { area } = FOREST
  const out = []
  for (let tries = 0; out.length < FOREST.trees && tries < FOREST.trees * 40; tries++) {
    const x = rand(area.minX, area.maxX)
    const z = rand(area.minZ, area.maxZ)
    if (nearRoad(x, z, FOREST.roadClearance)) continue
    if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < s.r)) continue
    if (onJaguarPath(x, z)) continue
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 3.2)) continue
    out.push({ x, z, h: rand(FOREST.treeHeight[0], FOREST.treeHeight[1]) })
  }
  return out
}

/**
 * Cria as árvores: 3 InstancedMesh (troncos, copa de baixo, copa de cima) com uma
 * "instância" por árvore. Cada instância recebe posição, giro, escala e cor própria.
 * Também cria o colisor estático de cada tronco no mundo físico.
 */
function buildTrees() {
  const list = pickTreeSpots()
  const n = list.length
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 1, 5)
  trunkGeo.translate(0, 0.5, 0) // base do tronco no chão (y = 0)
  const lowGeo = new THREE.ConeGeometry(1, 1, 4) // copa de baixo: pirâmide de 4 lados
  lowGeo.translate(0, 0.5, 0)
  const topGeo = new THREE.ConeGeometry(1, 1, 3) // copa de cima: pirâmide triangular
  topGeo.translate(0, 0.5, 0)
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: FOREST.trunkColor, flatShading: true }), n)
  const lows = new THREE.InstancedMesh(lowGeo, new THREE.MeshStandardMaterial({ flatShading: true }), n)
  const tops = new THREE.InstancedMesh(topGeo, new THREE.MeshStandardMaterial({ flatShading: true }), n)

  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const pos = new THREE.Vector3()
  const scl = new THREE.Vector3()
  const color = new THREE.Color()
  list.forEach((t, i) => {
    const trunkH = t.h * 0.32
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, Math.PI * 2))
    m.compose(pos.set(t.x, 0, t.z), q, scl.set(1, trunkH, 1))
    trunks.setMatrixAt(i, m)
    // copa de baixo: larga, começa um pouco abaixo do topo do tronco
    const lowH = t.h * 0.55
    m.compose(pos.set(t.x, trunkH * 0.75, t.z), q, scl.set(t.h * 0.3, lowH, t.h * 0.3))
    lows.setMatrixAt(i, m)
    // copa de cima: mais estreita e mais alta (formato de pinheiro triangular)
    const topH = t.h * 0.45
    m.compose(pos.set(t.x, trunkH * 0.75 + lowH * 0.55, t.z), q, scl.set(t.h * 0.2, topH, t.h * 0.2))
    tops.setMatrixAt(i, m)
    const base = FOREST.canopyColors[i % FOREST.canopyColors.length]
    lows.setColorAt(i, color.set(base))
    tops.setColorAt(i, color.set(base).offsetHSL(0, 0, 0.06)) // topo um pouco mais claro (luz de cima)
    // Colisor do tronco: caixa estática de 0,7 × 3 × 0,7 m (a bike não atravessa)
    world.addBody(new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Box(new CANNON.Vec3(0.35, 1.5, 0.35)), position: new CANNON.Vec3(t.x, 1.5, t.z) }))
    trees.push(t)
  })
  for (const mesh of [trunks, lows, tops]) {
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    scene.add(mesh)
  }
}

/**
 * Cria as flores: caules (verdes) e cabeças (3 pétalas triangulares + miolo, cor por flor)
 * em dois InstancedMesh. Nascem perto das ruas (entre 4,2 e 22 m), onde a bike passa.
 */
function buildFlowers() {
  const stemGeo = new THREE.BoxGeometry(0.035, 0.42, 0.035)
  stemGeo.translate(0, 0.21, 0)
  // Cabeça da flor: 3 triângulos girados 120° entre si, levemente inclinados para cima
  const petals = []
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3
    const tip = [Math.sin(a) * 0.2, 0.05, Math.cos(a) * 0.2]
    const l = [Math.sin(a - 0.5) * 0.07, 0, Math.cos(a - 0.5) * 0.07]
    const r = [Math.sin(a + 0.5) * 0.07, 0, Math.cos(a + 0.5) * 0.07]
    petals.push(0, 0, 0, ...l, ...tip, 0, 0, 0, ...tip, ...r)
  }
  const headGeo = new THREE.BufferGeometry()
  headGeo.setAttribute('position', new THREE.Float32BufferAttribute(petals, 3))
  headGeo.computeVertexNormals()
  headGeo.translate(0, 0.43, 0)

  const spots = blockedSpots()
  const list = []
  for (let tries = 0; list.length < FOREST.flowers && tries < FOREST.flowers * 30; tries++) {
    const x = rand(FOREST.area.minX, FOREST.area.maxX)
    const z = rand(FOREST.area.minZ, FOREST.area.maxZ)
    if (nearRoad(x, z, 4.2) || !nearRoad(x, z, 22)) continue
    if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 2)) continue
    list.push({ x, z, s: rand(0.8, 1.6) })
  }
  const stems = new THREE.InstancedMesh(stemGeo, new THREE.MeshStandardMaterial({ color: '#4f9a5a', flatShading: true }), list.length)
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), list.length)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const color = new THREE.Color()
  list.forEach((f, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, Math.PI * 2))
    m.compose(new THREE.Vector3(f.x, 0, f.z), q, new THREE.Vector3(f.s, f.s, f.s))
    stems.setMatrixAt(i, m)
    heads.setMatrixAt(i, m)
    heads.setColorAt(i, color.set(FOREST.flowerColors[i % FOREST.flowerColors.length]))
  })
  stems.instanceMatrix.needsUpdate = true
  heads.instanceMatrix.needsUpdate = true
  heads.instanceColor.needsUpdate = true
  scene.add(stems, heads)
}

/** Planta a floresta inteira (chamado uma vez por main.js, depois do cenário). */
export function buildForest() {
  buildTrees()
  buildFlowers()
}

/**
 * Árvore em que a bike está batendo agora (ou null). Compara a distância no chão
 * com FOREST.hitRadius + o raio da bike (0,6 m).
 * @param {{x:number, z:number}} p posição da bike
 * @returns {{x:number, z:number, h:number}|null}
 */
export function checkTreeHit(p) {
  const r = FOREST.hitRadius + 0.6
  for (const t of trees) {
    const dx = p.x - t.x
    const dz = p.z - t.z
    if (dx * dx + dz * dz < r * r) return t
  }
  return null
}
