import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import gsap from 'gsap'
import { scene, billboards } from '../core/stage.js'
import { world } from '../core/physics.js'
import { GROUPS, ITEMS, TEXTS } from '../data/level.js'
import { clamp, distToSegment, rand } from '../utils/helpers.js'
import { applyCutout, makeCutoutTexture, makeProfileCardTexture, makeTextPlane } from '../utils/textures.js'
import { PHOTO_URL } from '../utils/profileImage.js'
import { bike } from './bike.js'

/* ==========================================================================
   RECORTES COLECIONÁVEIS (totens) + explosão em pedaços de papel

   Papel deste arquivo: transformar cada item de ITEMS (data/level.js) em um
   "totem" no mapa (plano com a imagem do recorte, sempre virado para a câmera),
   detectar quando a bike passa por cima (checkHits) e fazer a destruição:
   o recorte vira 60 triângulos de papel com física, que caem e somem.

   Estados de um totem (`alive`):
   - alive = true:  de pé no mapa, pode ser atropelado;
   - alive = false: destruído (invisível); se tem `caption`, o texto 3D está visível.
   Transições: shatter() ou showDestroyed() → false; reassemble() → true.

   Depende de: three, cannon-es, gsap, stage.js, physics.js, level.js (GROUPS, ITEMS),
   helpers, textures.js e bike.js (posição e velocidade da bike).
   Quem usa: main.js (checkHits, shatter, showDestroyed, syncTotems, totems),
   timeMachine.js (reassemble, clearFragments, findTotem), pins.js (totem.item).

   Onde mexer:
   - HIT_SPEED: velocidade mínima (m/s) para atropelar no teclado.
   - shatter → cols/rows: em quantas colunas/linhas o recorte é cortado (5 × 6 = 60 pedaços).
   - shatter → `delay: 3, duration: 1.2`: quanto tempo os pedaços ficam no chão antes de sumir.
   - spawnFragment → velocidades rand(3, 7) / rand(3, 8): força da explosão.
   - checkHits → `t.w * 0.5 + 0.8`: raio de acerto (metade da largura + 0,8 m de folga).
   ========================================================================== */

// Velocidade mínima (m/s) para atropelar no teclado. No arraste, basta encostar.
const HIT_SPEED = 2 // precisa acelerar para atropelar

/**
 * Cria o totem de um item: plano com a imagem (ou recorte provisório) na
 * posição do mapa, flutuando um pouco acima do chão.
 *
 * - O plano tem `size` metros ([largura, altura] do item); quando a imagem real
 *   carrega, a largura é refeita na proporção da imagem (altura mantida).
 * - baseY = metade da altura + 0,25 m: a base do recorte fica 25 cm acima do chão.
 * - Itens com `reveal: true` (a apresentação da Marina) ganham um `caption`: um
 *   plano de texto 3D com o `body`, escondido até o atropelo, desenhado antes da
 *   bike (renderOrder -1) para nunca cobri-la.
 * @param {object} item item de ITEMS
 * @param {number} index posição na lista (usada como fase da flutuação, para não flutuarem em sincronia)
 * @returns {object} totem { item, mesh, material, w, h, baseY, phase, alive, caption }
 */
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

  if (item.card === 'profile') {
    // Cartão desenhado pelo jogo com a foto de perfil (primeiro recorte, "Sobre"), no mesmo
    // visual dos cartões das Experiências. Usa exatamente o tamanho `size` do item.
    material.map = makeProfileCardTexture({
      title: item.title,
      text: TEXTS.introCard,
      tags: [item.subtitle, 'UX/UI Design', 'Dados', 'Arte + Tecnologia'],
      photoUrl: PHOTO_URL,
    })
  } else {
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
  }

  if (item.reveal) {
    // texto revelado "abaixo" do recorte quando ele é destruído
    const caption = makeTextPlane(item.body, { width: 7, bg: 'rgba(13,11,16,0.88)' })
    caption.position.set(x, 2.4, z - 2.5) // 2,4 m de altura, 2,5 m atrás do recorte
    caption.material.opacity = 0
    caption.visible = false
    caption.renderOrder = -1 // desenha antes da bike: ela nunca some atrás do texto
    scene.add(caption)
    billboards.push(caption)
    totem.caption = caption
  }
  return totem
}

/** Todos os totens do mapa, na mesma ordem de ITEMS (criados ao carregar o módulo). */
export const totems = ITEMS.map(createTotem)
/**
 * Encontra um totem pelo id do item (ex.: 'dev-1').
 * @param {string} id
 * @returns {object|undefined}
 */
export const findTotem = (id) => totems.find((t) => t.item.id === id)

/* ---------------- Fragmentos de papel ----------------
   Cada pedaço da explosão é { mesh, body }: um triângulo 3D com o trecho da
   imagem original + um corpo físico fino. Todos os pedaços de uma mesma explosão
   compartilham um material clonado, para sumirem juntos (fade) e serem removidos
   de uma vez em removeFragments(material). */
const fragments = []

/**
 * Cria um pedaço de papel (triângulo) da explosão.
 *
 * Como funciona:
 * 1. calcula o centro (centroide) do triângulo em coordenadas locais do recorte;
 * 2. monta a geometria com os vértices relativos ao centro e as UVs correspondentes
 *    ao trecho da imagem (o pedaço "carrega" a parte certa do desenho);
 * 3. posiciona o mesh no mundo, no lugar exato onde esse trecho estava;
 * 4. cria um corpo físico fino (caixa de size*0.6 × size*0.6 × 0,04 m, 50 g) com
 *    damping para não deslizar/girar para sempre;
 * 5. velocidade inicial: para longe da bike (3–7 m/s) + para cima (3–8 m/s) + metade
 *    da velocidade da bike (limitada a ±12 m/s); giro aleatório até ±10 rad/s.
 * @param {THREE.Vector2[]} tri os 3 vértices do triângulo (coordenadas locais do recorte)
 * @param {object} totem totem de origem
 * @param {THREE.Material} material material compartilhado da explosão
 * @param {number} size tamanho aproximado do pedaço em metros (para o colisor)
 */
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

/**
 * Remove da cena e da física todos os pedaços que usam `material` (uma explosão
 * inteira) e libera a memória da geometria e do material.
 * Percorre a lista de trás para frente porque remove itens durante o loop.
 * @param {THREE.Material} material material compartilhado da explosão
 */
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

/**
 * Desintegra o recorte em triângulos de papel com física.
 *
 * Como funciona:
 * 1. marca o totem como destruído e esconde o plano original;
 * 2. monta uma grade de (cols + 1) × (rows + 1) pontos sobre o recorte; os pontos
 *    internos são deslocados aleatoriamente em até ±30% de uma célula (as bordas
 *    ficam retas para o contorno do recorte não mudar);
 * 3. cada célula da grade vira 2 triângulos (5 × 6 × 2 = 60 pedaços);
 * 4. o material é clonado (um por explosão) com alphaTest baixo, para o fade funcionar;
 * 5. após 3 s os pedaços somem em 1,2 s e são removidos;
 * 6. se o totem tem `caption` (texto 3D da apresentação), ele aparece subindo de
 *    0,5 m até 2,4 m com "quique", depois de 0,3 s.
 * @param {object} totem
 */
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
  const at = (i, j) => grid[j * (cols + 1) + i] // ponto da grade na coluna i, linha j
  const material = totem.material.clone() // um material por explosão → fade independente
  material.alphaTest = 0.01
  const size = Math.min(w / cols, h / rows)
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      spawnFragment([at(i, j), at(i + 1, j), at(i + 1, j + 1)], totem, material, size) // triângulo de cima/direita da célula
      spawnFragment([at(i, j), at(i + 1, j + 1), at(i, j + 1)], totem, material, size) // triângulo de baixo/esquerda
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

/**
 * Deixa o recorte já no estado final (destruído), sem animação nem pedaços.
 * Usado ao recarregar a página para os recortes já no inventário.
 * @param {object} totem
 */
export function showDestroyed(totem) {
  totem.alive = false
  totem.mesh.visible = false
  if (totem.caption) {
    totem.caption.visible = true
    totem.caption.material.opacity = 1
  }
}

/**
 * Remonta o recorte (usado só quando o inventário é resetado).
 * Anima o plano crescendo de 1% até 100% com "quique" e girando meia volta até
 * ficar reto (0,8 s). O texto 3D, se houver, some em 0,4 s.
 * @param {object} totem
 * @param {number} [delay=0] atraso em segundos
 */
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

/**
 * Faz todos os pedaços de papel ainda na cena sumirem em 0,4 s e os remove.
 * Chamada pelo rebobinar (timeMachine.js) para limpar o mapa.
 * Agrupa por material (uma explosão = um material) para remover de uma vez.
 */
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
 * Também atualiza bike.prevPos para o próximo frame. Chamada por main.js a cada
 * frame enquanto a bike está livre; só o primeiro totem encontrado é devolvido.
 * @returns {object|null}
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

/**
 * Atualização visual por frame: copia a física para os pedaços de papel e faz
 * os recortes de pé flutuarem (±0,12 m, ~1,5 oscilações por segundo, cada um
 * com uma fase diferente).
 * @param {number} time tempo total em segundos
 */
export function syncTotems(time) {
  for (const f of fragments) {
    f.mesh.position.copy(f.body.position)
    f.mesh.quaternion.copy(f.body.quaternion)
  }
  for (const t of totems) t.mesh.position.y = t.baseY + Math.sin(time * 1.5 + t.phase) * 0.12
}
