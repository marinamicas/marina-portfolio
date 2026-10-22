import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { scene, billboards } from '../core/stage.js'
import { world } from '../core/physics.js'
import { END_SIGNS, HORIZON_NEON, PALETTE, ROADS, ROAD_WIDTH, SIGNS, TEXTS } from '../data/level.js'
import { rand, nearRoad } from '../utils/helpers.js'
import { applyCutout, makeCutoutTexture, makeEndSignTexture, makePaperTexture, makeTextPlane } from '../utils/textures.js'

/* ==========================================================================
   CENÁRIO

   Papel deste arquivo: montar tudo o que é "mundo" além da bike e dos recortes:
   - chão de papel e ruas (buildGround);
   - triângulos de colagem caídos no chão (buildDecor);
   - prismas triangulares com física que a bike empurra (buildProps);
   - placas magnéticas com poste e ímã (buildSigns);
   - placas de fim de rota com frases poéticas (buildEndSigns);
   - linha do horizonte, nuvem de triângulos e a frase final (buildHorizon).
   (Floresta, bichos e neve ficam em forest.js, critters.js e snow.js.)
   E animar isso a cada frame (syncProps, animateEnvironment).

   Depende de: three, cannon-es, stage.js (scene, billboards), physics.js (world),
   level.js (PALETTE, ROADS, ROAD_WIDTH, SIGNS, TEXTS), helpers, textures.js.
   Quem usa: main.js (buildEnvironment uma vez; syncProps e animateEnvironment por
   frame), bike.js (signs, placas magnéticas), timeMachine.js (props, para
   devolvê-los ao lugar ao rebobinar).

   Onde mexer:
   - Cores do chão/ruas: makePaperTexture('#17111f', 40) e ('#2a1f3d', 2) em buildGround.
   - Quantidade de triângulos no chão: `i < 90` em buildDecor.
   - Placas de fim de rota: textos e posições em END_SIGNS (level.js); desenho em makeEndSignTexture (textures.js).
   - Quantidade de prismas: `placed < 40` em buildProps.
   - Tamanho das placas: PlaneGeometry(3.6, 1.7) e altura `plate.position.y = 3.1`.
   - Posição do horizonte: `line.position` (z = -205) e `horizon.position` (y = 13, z = -225).
   ========================================================================== */

// Listas públicas preenchidas pelas funções build* (vazias até buildEnvironment rodar)
export const props = [] // prismas triangulares empurráveis (com física): { mesh, body, home }
export const endSigns = [] // placas de fim de rota: { ...dados de END_SIGNS, group, plate }
export const signs = [] // placas magnéticas: { ...dados de SIGNS, group, plate, magnet }
export const horizon = new THREE.Group() // nuvem + frase final (segue a bike no eixo X)

/**
 * Chão de papel + ruas (um plano por segmento) com faixa central em pedaços de fita.
 *
 * - Chão: plano de 700 × 700 m, deitado (rotation.x = -90°), com textura de papel
 *   escura repetida 40 vezes (grão fino).
 * - Cada rua de ROADS vira um plano de ROAD_WIDTH de largura e comprimento do
 *   segmento + ROAD_WIDTH (sobra nas pontas para as curvas emendarem sem buraco),
 *   girado na direção do segmento. Cada rua fica 2 mm mais alta que a anterior
 *   (0.02 + i * 0.002) para duas ruas sobrepostas não "piscarem" (z-fighting).
 * - Faixa central: retângulos de 0,25 × 2,4 m a cada 6 m, com giro aleatório de
 *   até ±0,08 rad, lilás a 50% (parecem pedaços de fita).
 */
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
    const angle = Math.atan2(-dx, -dz) // direção do segmento no chão
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, len + ROAD_WIDTH), roadMat)
    road.rotation.x = -Math.PI / 2
    road.rotation.z = angle
    road.position.set((a[0] + b[0]) / 2, 0.02 + i * 0.002, (a[1] + b[1]) / 2) // y diferente evita z-fighting
    scene.add(road)

    // faixa central em "pedaços de fita"
    for (let d = 3; d < len - 2; d += 6) {
      const t = d / len // fração do caminho ao longo do segmento (0 = em a, 1 = em b)
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 2.4), stripeMat)
      stripe.rotation.x = -Math.PI / 2
      stripe.rotation.z = angle + rand(-0.08, 0.08)
      stripe.position.set(a[0] + dx * t, 0.05 + i * 0.002, a[1] + dz * t)
      scene.add(stripe)
    }
  })
}

/**
 * Triângulos "colados" no chão, como recortes caídos (sem física).
 * (Os triângulos que flutuavam no ar viraram a neve de src/world/snow.js.)
 *
 * - Geometria: um único triângulo (3 vértices) compartilhado por todos.
 * - 4 materiais alternados: papel branco, roxo, lilás e violeta.
 * - 90 tentativas: deitados (rotation.x = -90°) a 3 cm do chão, a pelo menos
 *   4,5 m das ruas, escala 0,5 a 3.
 */
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
  ]
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

/**
 * Prismas triangulares com física: a bike pode empurrá-los.
 *
 * Tenta posicionar 40 prismas (até 3000 tentativas) em pontos aleatórios que:
 * - estejam a menos de 10 m de alguma rua (perto da ação) MAS a mais de 4,5 m
 *   dela (fora da pista);
 * - não fiquem a menos de 4 m de uma placa (para não escondê-la).
 * Cada prisma: cilindro de 3 lados (= prisma triangular) com raio 0,5–1,1 m e
 * altura 0,8–2 m, cor alternando branco/roxo/preto, com sombreamento chapado
 * (flatShading). O colisor é uma caixa inscrita no prisma (mais barato e estável
 * que a forma exata). Massa 1 kg; damping freia o deslize (0.3) e o giro (0.4);
 * sleepSpeedLimit 0.3 = abaixo dessa velocidade o corpo "dorme" e para de gastar CPU.
 * `home` guarda a posição/rotação original para o rebobinar devolver ao lugar.
 */
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
    body.quaternion.setFromEuler(0, rand(0, Math.PI * 2), 0) // giro aleatório no eixo vertical
    body.sleepSpeedLimit = 0.3
    world.addBody(body)
    scene.add(mesh)
    props.push({ mesh, body, home: { position: body.position.clone(), quaternion: body.quaternion.clone() } })
    placed++
  }
}

/**
 * Placas com poste, ímã e recorte; cada uma tem um corpo físico estático (o poste).
 *
 * Para cada placa de SIGNS:
 * - group na posição (x, 0, z); o grupo inteiro gira para encarar a câmera (billboards);
 * - poste: caixa preta de 0,15 × 2,4 × 0,15 m, centro a 1,2 m (base no chão);
 * - ímã: meio-toro roxo brilhante (emissive) no topo do poste (y = 2,25), virado
 *   de cabeça para baixo (rotation.z = π) para parecer um ímã em U;
 * - recorte: plano de 3,6 × 1,7 m a 3,1 m de altura com a imagem da placa
 *   (ou o recorte provisório com o texto `label`);
 * - colisor: caixa estática de 0,4 × 3 × 0,4 m no lugar do poste (a bike não atravessa).
 * O objeto salvo em `signs` junta os dados de SIGNS (x, z, pull…) com os meshes,
 * para bike.js (atração) e animateEnvironment (balanço e pulso).
 */
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

/** Plano da frase do horizonte (guardado para o brilho neon pulsar em animateEnvironment). */
let horizonText = null

/**
 * Linha do horizonte e a frase final (TEXTS.end) flutuando no fim das ruas.
 *
 * - Linha: plano branco de 500 × 0,25 m deitado em z = -205, sem neblina
 *   (fog: false, para não sumir no escuro).
 * - Frase: letras em NEON, sem fundo e sem enfeites em volta: plano de texto de
 *   48 m de largura desenhado com brilho (makeTextPlane com `glow`) e somado à
 *   cena (AdditiveBlending), o que faz a luz parecer acesa sobre o céu escuro.
 *   Cores em HORIZON_NEON (src/data/level.js).
 * O grupo `horizon` fica em (0, 13, -225) e acompanha a bike no eixo X em
 * animateEnvironment (como algo no infinito), então a frase fica legível no
 * fim de qualquer rua; ela também flutua devagar para cima e para baixo.
 */
function buildHorizon() {
  const line = new THREE.Mesh(new THREE.PlaneGeometry(500, 0.25), new THREE.MeshBasicMaterial({ color: PALETTE.white, fog: false }))
  line.rotation.x = -Math.PI / 2
  line.position.set(0, 0.05, -205)
  scene.add(line)

  horizonText = makeTextPlane(TEXTS.end, { width: 48, fontSize: 46, canvasWidth: 1600, color: HORIZON_NEON.text, glow: HORIZON_NEON.glow })
  horizonText.material.fog = false // sem neblina: o neon brilha mesmo de longe
  horizonText.material.blending = THREE.AdditiveBlending // luz somada = aparência de letreiro aceso
  horizon.add(horizonText)
  horizon.position.set(0, 13, -225)
  scene.add(horizon)
}

/**
 * Placas de FIM DE ROTA: uma no fim de cada rua (END_SIGNS em level.js), com o nome da
 * rota e uma frase poética. Poste preto, duas lanternas lilás e a placa de papel
 * (textura desenhada em makeEndSignTexture). Ficam no meio da rua: o poste tem colisor,
 * então a bike "chega" ao fim e para ali.
 */
function buildEndSigns() {
  const postMat = new THREE.MeshStandardMaterial({ color: PALETTE.black })
  const glowMat = new THREE.MeshStandardMaterial({ color: PALETTE.lilac, emissive: PALETTE.lilac, emissiveIntensity: 0.9 })
  for (const sign of END_SIGNS) {
    const group = new THREE.Group()
    group.position.set(sign.x, 0, sign.z)
    for (const side of [1, -1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.6, 0.16), postMat)
      post.position.set(1.7 * side, 1.3, 0)
      const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), glowMat)
      lamp.position.set(1.7 * side, 2.75, 0)
      group.add(post, lamp)
    }
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 2.75),
      new THREE.MeshBasicMaterial({ map: makeEndSignTexture(sign.route, sign.text), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }),
    )
    plate.position.y = 3.6
    group.add(plate)
    scene.add(group)
    billboards.push(group)
    world.addBody(new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Box(new CANNON.Vec3(2, 1.3, 0.25)), position: new CANNON.Vec3(sign.x, 1.3, sign.z) }))
    endSigns.push({ ...sign, group, plate })
  }
}

/**
 * Monta todo o cenário (chamado uma vez ao iniciar, por main.js).
 * A ordem importa só para buildProps, que consulta SIGNS para não cobrir as placas.
 * Árvores, flores, bichos e neve ficam em forest.js, critters.js e snow.js.
 */
export function buildEnvironment() {
  buildGround()
  buildDecor()
  buildProps()
  buildSigns()
  buildEndSigns()
  buildHorizon()
}

/**
 * Copia posição/rotação da física para os prismas visíveis (a cada frame).
 * A física (cannon-es) manda; o desenho (three) só acompanha.
 */
export function syncProps() {
  for (const p of props) {
    p.mesh.position.copy(p.body.position)
    p.mesh.quaternion.copy(p.body.quaternion)
  }
}

/**
 * Animações leves do cenário a cada frame: horizonte, enfeites e placas.
 * - horizonte: desliza em X atrás da bike (amortecimento 1.5 = bem lento) e
 *   sobe/desce 0,6 m a cada ~16 s;
 * - enfeites: flutuam ±0,3 m em torno de baseY e giram com a velocidade `spin`;
 * - placas: a até 9 m da bike, a placa balança (±0,06 rad, 6 vezes por segundo) e
 *   o ímã pulsa (até +40% de tamanho), mais forte quanto mais perto.
 * @param {number} time tempo total em segundos
 * @param {number} dt tempo do frame em segundos (já com câmera lenta aplicada)
 * @param {{x: number, z: number}} bikePos posição da bike
 */
export function animateEnvironment(time, dt, bikePos) {
  horizon.position.x = THREE.MathUtils.damp(horizon.position.x, bikePos.x, 1.5, dt)
  horizon.position.y = 13 + Math.sin(time * 0.4) * 0.6
  // neon "respirando": a frase do horizonte oscila de leve no brilho (85% a 100%)
  if (horizonText) horizonText.material.opacity = HORIZON_NEON.pulse ? 0.925 + Math.sin(time * 1.7) * 0.075 : 1
  // placas de fim de rota: balançam de leve (como papel ao vento)
  for (const s of endSigns) s.plate.rotation.z = Math.sin(time * 1.3 + s.x) * 0.025
  // placas balançam e o ímã pulsa quando a bike se aproxima
  for (const s of signs) {
    const near = Math.max(0, 1 - Math.hypot(bikePos.x - s.x, bikePos.z - s.z) / 9) // 1 = em cima da placa, 0 = a 9 m ou mais
    s.plate.rotation.z = Math.sin(time * 6) * 0.06 * near
    s.magnet.scale.setScalar(1 + near * 0.4 * (0.5 + 0.5 * Math.sin(time * 10)))
  }
}
