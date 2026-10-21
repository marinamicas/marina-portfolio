import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import gsap from 'gsap'
import { scene, billboards } from '../core/stage.js'
import { world } from '../core/physics.js'
import { GROUPS, ITEMS } from '../data/level.js'
import { clamp, distToSegment, rand } from '../utils/helpers.js'
import { applyCutout, makeCutoutTexture, makeTextPlane } from '../utils/textures.js'
import { bike } from './bike.js'

const HIT_SPEED = 2 // precisa acelerar para atropelar

function createTotem(item, index) {
  const [w, h] = item.size
  const material = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.4, side: THREE.DoubleSide })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material)
  const [x, z] = item.position
  const baseY = h / 2 + 0.25
  mesh.position.set(x, baseY, z)
  scene.add(mesh)
  billboards.push(mesh)

  const totem = { item, mesh, material, w, h, baseY, phase: index, alive: true, caption: null }

  applyCutout(
    material,
    item.image,
    () => makeCutoutTexture({ title: item.title, subtitle: item.subtitle, color: GROUPS[item.group].color }),
    (tex) => {
      // mantém a altura e ajusta a largura à proporção do recorte real
      totem.w = (h * tex.image.width) / tex.image.height
      mesh.geometry.dispose()
      mesh.geometry = new THREE.PlaneGeometry(totem.w, h)
    },
  )

  if (item.reveal) {
    // texto revelado "abaixo" do recorte quando ele é destruído
    const caption = makeTextPlane(item.body, { width: 7, bg: 'rgba(13,11,16,0.88)' })
    caption.position.set(x, 2.4, z - 2.5)
    caption.material.opacity = 0
    caption.visible = false
    caption.renderOrder = -1 // desenha antes da bike: ela nunca some atrás do texto
    scene.add(caption)
    billboards.push(caption)
    totem.caption = caption
  }
  return totem
}

export const totems = ITEMS.map(createTotem)
export const findTotem = (id) => totems.find((t) => t.item.id === id)

/* ---------------- Fragmentos de papel ---------------- */
const fragments = []

function spawnFragment(tri, totem, material, size) {
  const { w, h } = totem
  const centroid = new THREE.Vector2().add(tri[0]).add(tri[1]).add(tri[2]).divideScalar(3)
  const pos = []
  const uv = []
  for (const p of tri) {
    pos.push(p.x - centroid.x, p.y - centroid.y, 0)
    uv.push((p.x + w / 2) / w, (p.y + h / 2) / h) // o pedaço mantém o trecho da imagem original
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  const mesh = new THREE.Mesh(geo, material)
  const worldPos = totem.mesh.localToWorld(new THREE.Vector3(centroid.x, centroid.y, 0))
  mesh.position.copy(worldPos)
  mesh.quaternion.copy(totem.mesh.quaternion)
  scene.add(mesh)

  const body = new CANNON.Body({
    mass: 0.05,
    shape: new CANNON.Box(new CANNON.Vec3(size * 0.3, size * 0.3, 0.02)),
    linearDamping: 0.4,
    angularDamping: 0.3,
  })
  body.position.set(worldPos.x, worldPos.y, worldPos.z)
  body.quaternion.set(mesh.quaternion.x, mesh.quaternion.y, mesh.quaternion.z, mesh.quaternion.w)
  const away = new THREE.Vector3(worldPos.x - bike.body.position.x, 0, worldPos.z - bike.body.position.z).normalize()
  // herda metade da velocidade da bike, limitada (um arraste rápido não arremessa os pedaços longe demais)
  const bvx = clamp(bike.body.velocity.x, -12, 12)
  const bvz = clamp(bike.body.velocity.z, -12, 12)
  body.velocity.set(away.x * rand(3, 7) + bvx * 0.5, rand(3, 8), away.z * rand(3, 7) + bvz * 0.5)
  body.angularVelocity.set(rand(-10, 10), rand(-10, 10), rand(-10, 10))
  world.addBody(body)
  fragments.push({ mesh, body })
}

function removeFragments(material) {
  for (let i = fragments.length - 1; i >= 0; i--) {
    const f = fragments[i]
    if (f.mesh.material !== material) continue
    scene.remove(f.mesh)
    f.mesh.geometry.dispose()
    world.removeBody(f.body)
    fragments.splice(i, 1)
  }
  material.dispose()
}

/** Desintegra o recorte em triângulos de papel com física. */
export function shatter(totem) {
  totem.alive = false
  totem.mesh.visible = false
  totem.mesh.updateMatrixWorld()
  const { w, h } = totem
  const cols = 5
  const rows = 6
  const grid = []
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const edge = i === 0 || j === 0 || i === cols || j === rows
      grid.push(
        new THREE.Vector2(
          -w / 2 + (i * w) / cols + (edge ? 0 : rand(-0.3, 0.3) * (w / cols)),
          -h / 2 + (j * h) / rows + (edge ? 0 : rand(-0.3, 0.3) * (h / rows)),
        ),
      )
    }
  }
  const at = (i, j) => grid[j * (cols + 1) + i]
  const material = totem.material.clone() // um material por explosão → fade independente
  material.alphaTest = 0.01
  const size = Math.min(w / cols, h / rows)
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      spawnFragment([at(i, j), at(i + 1, j), at(i + 1, j + 1)], totem, material, size)
      spawnFragment([at(i, j), at(i + 1, j + 1), at(i, j + 1)], totem, material, size)
    }
  }
  gsap.to(material, { opacity: 0, delay: 3, duration: 1.2, onComplete: () => removeFragments(material) })

  if (totem.caption) {
    const { caption } = totem
    caption.visible = true
    gsap.fromTo(caption.material, { opacity: 0 }, { opacity: 1, duration: 1, delay: 0.3 })
    gsap.fromTo(caption.position, { y: 0.5 }, { y: 2.4, duration: 1.2, delay: 0.3, ease: 'back.out(1.4)' })
  }
}

/** Deixa o recorte já no estado final (destruído), sem animação. Usado ao recarregar a página. */
export function showDestroyed(totem) {
  totem.alive = false
  totem.mesh.visible = false
  if (totem.caption) {
    totem.caption.visible = true
    totem.caption.material.opacity = 1
  }
}

/** Remonta o recorte (usado só quando o inventário é resetado). */
export function reassemble(totem, delay = 0) {
  if (totem.alive) return
  totem.alive = true
  totem.mesh.visible = true
  gsap.fromTo(totem.mesh.scale, { x: 0.01, y: 0.01 }, { x: 1, y: 1, duration: 0.8, delay, ease: 'back.out(2)' })
  gsap.fromTo(totem.mesh.rotation, { z: Math.PI }, { z: 0, duration: 0.8, delay, ease: 'power3.out' })
  if (totem.caption) {
    const { caption } = totem
    gsap.to(caption.material, { opacity: 0, duration: 0.4, overwrite: true, onComplete: () => (caption.visible = false) })
  }
}

export function clearFragments() {
  new Set(fragments.map((f) => f.mesh.material)).forEach((mat) =>
    gsap.to(mat, { opacity: 0, duration: 0.4, overwrite: true, onComplete: () => removeFragments(mat) }),
  )
}

/**
 * Retorna o totem atropelado neste frame (ou null).
 * - No teclado é preciso estar em movimento (HIT_SPEED).
 * - No arraste basta encostar. Como um arraste rápido pode "pular" vários metros em
 *   um frame, testamos o segmento entre a posição anterior e a atual, não só o ponto.
 */
export function checkHits() {
  const p = bike.body.position
  const from = { ...bike.prevPos }
  bike.prevPos.x = p.x
  bike.prevPos.z = p.z
  if (!bike.dragging && Math.abs(bike.speed) < HIT_SPEED) return null
  for (const t of totems) {
    if (!t.alive) continue
    const d = distToSegment(t.mesh.position.x, t.mesh.position.z, [from.x, from.z], [p.x, p.z])
    if (d < t.w * 0.5 + 0.8) return t
  }
  return null
}

export function syncTotems(time) {
  for (const f of fragments) {
    f.mesh.position.copy(f.body.position)
    f.mesh.quaternion.copy(f.body.quaternion)
  }
  for (const t of totems) t.mesh.position.y = t.baseY + Math.sin(time * 1.5 + t.phase) * 0.12
}
