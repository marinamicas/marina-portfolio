import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { scene } from '../core/stage.js'
import { materials, world } from '../core/physics.js'
import { BIKE, BOUNDS, PALETTE } from '../data/level.js'
import { angleDelta, clamp } from '../utils/helpers.js'
import { signs } from './environment.js'

/* ==========================================================================
   BICICLETA 3D DO JOGADOR

   Papel deste arquivo: criar a bike (modelo 3D + corpo físico) e controlar como
   ela se move. O modelo é montado aqui mesmo, peça por peça (rodas, quadro,
   guidão, ciclista), no estilo low-poly triangular do site. Para a DIREÇÃO ficar
   sempre clara: o modelo gira inteiro para onde a bike aponta, tem farol branco
   na frente, lanterna vermelha atrás e uma SETA NEON no chão logo à frente.

   O corpo físico é uma caixa invisível (cannon-es), sempre DINÂMICA enquanto o
   jogador controla: ela empurra os prismas e é barrada por árvores e postes.

   Modos da bike (estado em `bike`):
   - livre (locked = false, dragging = false): teclado e botões na tela (updateBike);
   - arrastada (dragging = true, só com os botões ocultos): pedala na direção do
     ponto apontado pelo dedo/mouse (BIKE.drag em level.js);
   - travada (locked = true): abertura, rebobinar, viagens do inventário. Corpo
     KINEMATIC sem colisão; só placeBike() a move.

   Depende de: three, cannon-es, stage.js (scene), physics.js, level.js (BIKE, BOUNDS,
   PALETTE), helpers e environment.js (placas magnéticas).
   Quem usa: main.js (loop), pointerControls.js, timeMachine.js, totems.js,
   particles.js, forest.js/critters.js (colisões), intro.js (bike saindo da terra).

   Onde mexer:
   - Velocidade, curva, precisão e arraste: BIKE em src/data/level.js.
   - Cores das peças: objeto COLORS abaixo.
   - Tamanho das rodas: WHEEL_R. Posição/forma das peças: buildModel().
   - Seta neon do chão: buildDirectionMarker().
   ========================================================================== */

// Meia altura da caixa de colisão (a caixa tem 1,2 m de altura; o centro fica a 0,6 m do chão)
const BIKE_Y = 0.6
// Raio das rodas em metros
const WHEEL_R = 0.42
// Distância de cada eixo até o centro da bike (metros): rodas em z = +0,62 (traseira) e −0,62 (dianteira)
const AXLE_Z = 0.62

/** Cores das peças (troque à vontade; são códigos #RRGGBB). */
const COLORS = {
  frame: PALETTE.white, // quadro "papel branco"
  tire: PALETTE.purple, // pneus roxos (aparecem bem no chão escuro)
  spoke: PALETTE.lilac, // raios
  seat: PALETTE.ink,
  shirt: PALETTE.lilac, // camiseta da ciclista
  pants: '#2b1a4a',
  skin: '#d9a07a',
  hair: '#1a1420',
  helmet: PALETTE.purple,
}

/** Material low-poly (sombreamento chapado, como papel dobrado). */
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra })

/**
 * Estado público da bike (lido por câmera, inventário, rebobinar, partículas, colisões…).
 * - body:        corpo físico (cannon-es). A posição "oficial" da bike é body.position.
 * - group:       grupo 3D que copia a posição do body a cada frame.
 * - model:       o modelo 3D (gira com a direção da bike).
 * - heading:     direção em radianos; 0 = olhando para −Z (fundo do mapa), cresce no sentido anti-horário.
 * - speed:       velocidade atual em m/s (negativa = ré).
 * - turnAxis:    curva suavizada (−1 direita … 1 esquerda), usada também para inclinar o modelo.
 * - locked:      true = sem física nem controle do jogador (abertura, rebobinar, viagens).
 * - dragging:    true enquanto o jogador arrasta a bike com o dedo/mouse.
 * - dragTarget:  ponto do chão apontado pelo dedo/mouse (destino do arraste).
 * - prevPos:     posição no frame anterior (detecção de atropelo em movimentos rápidos).
 * - rise:        deslocamento vertical extra do desenho (negativo = enterrada; usado na abertura).
 * - invulnerableUntil: até quando (segundos do relógio do jogo) a bike está imune depois de perder vida.
 */
export const bike = {
  body: new CANNON.Body({
    mass: 5, // kg: pesada o bastante para empurrar os prismas (massa 1)
    // Caixa quadrada no chão (1,1 × 1,2 × 1,1 m): como o corpo não gira (fixedRotation), uma caixa
    // comprida ficaria "de lado" quando a bike vira; a quadrada vale para qualquer direção.
    shape: new CANNON.Box(new CANNON.Vec3(0.55, BIKE_Y, 0.55)),
    position: new CANNON.Vec3(0, BIKE_Y, 0),
    fixedRotation: true, // nunca tomba
    linearDamping: 0.1,
    allowSleep: false, // a velocidade é aplicada direto; um corpo "dormindo" a ignoraria
    material: materials.bike,
  }),
  group: new THREE.Group(),
  model: new THREE.Group(),
  heading: 0,
  visualHeading: 0, // direção desenhada (persegue `heading` suavemente)
  speed: 0,
  turnAxis: 0,
  lean: 0,
  locked: false,
  dragging: false,
  dragTarget: { x: 0, z: 0 },
  prevPos: { x: 0, z: 0 },
  rise: 0,
  invulnerableUntil: 0,
}
world.addBody(bike.body)

/* ---------------- Modelo 3D ---------------- */

// Peças animadas (guardadas para o syncBike girar/mover)
const parts = { wheels: [], crank: null, legs: [], pedals: [], arrow: null, beam: null }
// Tubo de 1 m de altura no eixo Y, reaproveitado por todas as barras (é esticado em placeTube)
const tubeGeo = new THREE.CylinderGeometry(1, 1, 1, 6)
const _up = new THREE.Vector3(0, 1, 0)
const _dir = new THREE.Vector3()

/**
 * Posiciona um tubo entre os pontos a e b (coordenadas locais do modelo).
 * O cilindro de 1 m é colocado no meio, girado na direção a→b e esticado no comprimento.
 */
function placeTube(mesh, a, b) {
  _dir.subVectors(b, a)
  const len = _dir.length() || 0.0001
  mesh.position.addVectors(a, b).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(_up, _dir.divideScalar(len))
  mesh.scale.set(mesh.userData.r, len, mesh.userData.r)
}

/** Cria um tubo de raio `r` (metros) entre a e b e o adiciona ao modelo. */
function tube(a, b, r, material) {
  const mesh = new THREE.Mesh(tubeGeo, material)
  mesh.userData.r = r
  placeTube(mesh, a, b)
  bike.model.add(mesh)
  return mesh
}

/** Atalho para Vector3. */
const v = (x, y, z) => new THREE.Vector3(x, y, z)

/**
 * Roda: pneu (toro) + 3 raios formando um "asterisco" triangular. A roda fica num
 * grupo próprio para girar no eixo X (rolando) sem girar o pneu errado.
 * @param {number} z posição do eixo (metros, local)
 */
function buildWheel(z) {
  const g = new THREE.Group()
  g.position.set(0, WHEEL_R, z)
  const tire = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R, 0.07, 6, 18), mat(COLORS.tire))
  tire.rotation.y = Math.PI / 2 // o toro nasce no plano XY; a roda precisa ficar no plano YZ
  g.add(tire)
  const spokeMat = mat(COLORS.spoke)
  for (let k = 0; k < 3; k++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.03, WHEEL_R * 1.9, 0.03), spokeMat)
    spoke.rotation.x = (k * Math.PI) / 3 // 0°, 60°, 120°
    g.add(spoke)
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 6), mat(COLORS.frame))
  hub.rotation.z = Math.PI / 2
  g.add(hub)
  bike.model.add(g)
  parts.wheels.push(g)
}

/**
 * Monta a bike + ciclista, virados para −Z (frente). Medidas em metros a partir do chão.
 * Pontos-chave do quadro: eixo traseiro, movimento central (pedivela), topo do selim,
 * caixa de direção e eixo dianteiro; os tubos ligam esses pontos (quadro em "diamante").
 */
function buildModel() {
  buildWheel(AXLE_Z) // traseira
  buildWheel(-AXLE_Z) // dianteira

  const frameMat = mat(COLORS.frame)
  const rear = v(0, WHEEL_R, AXLE_Z)
  const front = v(0, WHEEL_R, -AXLE_Z)
  const bb = v(0, 0.36, 0.05) // movimento central (onde ficam os pedais)
  const seatTop = v(0, 0.98, 0.24)
  const headTop = v(0, 1.02, -0.47)
  const headBottom = v(0, 0.8, -0.52)
  tube(bb, seatTop, 0.035, frameMat) // tubo do selim
  tube(bb, headBottom, 0.04, frameMat) // tubo inferior
  tube(seatTop, headTop, 0.035, frameMat) // tubo superior
  tube(bb, rear, 0.028, frameMat) // corrente (lado)
  tube(seatTop, rear, 0.025, frameMat) // escora do selim
  tube(headBottom, front, 0.03, frameMat) // garfo
  tube(headBottom, headTop, 0.045, frameMat) // caixa de direção

  // Guidão (barra lateral) e selim
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 0.05), frameMat)
  bar.position.set(0, 1.08, -0.5)
  bike.model.add(bar)
  tube(headTop, v(0, 1.08, -0.5), 0.03, frameMat)
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.32), mat(COLORS.seat))
  seat.position.set(0, 1.02, 0.26)
  bike.model.add(seat)

  // Farol (frente, branco brilhante) e lanterna (trás, vermelha): deixam claro para onde a bike aponta
  const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.08), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 1.4 }))
  headlight.position.set(0, 0.95, -0.6)
  bike.model.add(headlight)
  const taillight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.05), mat('#ff2244', { emissive: '#ff2244', emissiveIntensity: 1.2 }))
  taillight.position.set(0, 0.95, 0.5)
  bike.model.add(taillight)

  // Pedivela: grupo que gira no eixo X; os pedais ficam em lados opostos
  const crank = new THREE.Group()
  crank.position.copy(bb)
  const pedalMat = mat(COLORS.seat)
  for (const side of [1, -1]) {
    const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.08), pedalMat)
    pedal.position.set(0.16 * side, 0.17 * side, 0) // um em cima, outro embaixo
    crank.add(pedal)
    parts.pedals.push(pedal)
  }
  bike.model.add(crank)
  parts.crank = crank

  // Ciclista low-poly (prismas e pirâmides): quadril no selim, tronco inclinado para o guidão
  const hips = v(0, 1.12, 0.22)
  const shoulders = v(0, 1.62, -0.12)
  const shirt = mat(COLORS.shirt)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 1, 4), shirt)
  torso.userData.r = 1
  placeTube(torso, hips, shoulders)
  torso.scale.set(1, hips.distanceTo(shoulders), 1)
  bike.model.add(torso)
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), mat(COLORS.skin))
  head.position.set(0, 1.86, -0.2)
  bike.model.add(head)
  const hair = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 4), mat(COLORS.hair))
  hair.position.set(0, 1.72, -0.05) // cabelo caindo nas costas
  hair.rotation.x = 0.5
  bike.model.add(hair)
  const helmet = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.18, 5), mat(COLORS.helmet))
  helmet.position.set(0, 2.02, -0.2)
  bike.model.add(helmet)
  // Braços até as pontas do guidão
  for (const side of [1, -1]) tube(v(0.16 * side, 1.58, -0.1), v(0.3 * side, 1.08, -0.5), 0.045, shirt)
  // Pernas: do quadril até cada pedal (atualizadas a cada frame em syncBike)
  const pantsMat = mat(COLORS.pants)
  for (const side of [1, -1]) {
    const leg = tube(v(0.1 * side, 1.1, 0.2), v(0.16 * side, 0.36, 0.05), 0.06, pantsMat)
    leg.userData.side = side
    parts.legs.push(leg)
  }
}

/**
 * Seta neon no chão à frente da bike + um feixe de luz suave do farol até ela.
 * Ficam dentro do modelo, então giram junto com a direção.
 */
function buildDirectionMarker() {
  const arrowShape = new THREE.Shape()
  arrowShape.moveTo(0, -0.55) // ponta (para −Z, a frente)
  arrowShape.lineTo(0.42, 0.3)
  arrowShape.lineTo(0, 0.1)
  arrowShape.lineTo(-0.42, 0.3)
  arrowShape.closePath()
  const arrow = new THREE.Mesh(
    new THREE.ShapeGeometry(arrowShape),
    new THREE.MeshBasicMaterial({ color: PALETTE.lilac, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }),
  )
  arrow.rotation.x = -Math.PI / 2 // deitada no chão
  arrow.position.set(0, 0.06, -1.75)
  bike.model.add(arrow)
  parts.arrow = arrow

  // Feixe: triângulo comprido e transparente saindo do farol
  const beamGeo = new THREE.BufferGeometry().setFromPoints([v(0, 0.05, -0.6), v(0.55, 0.05, -1.6), v(-0.55, 0.05, -1.6)])
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }))
  bike.model.add(beam)
  parts.beam = beam
}

buildModel()
buildDirectionMarker()
bike.model.position.y = -BIKE_Y // o grupo fica no centro do corpo físico; o modelo começa no chão
bike.model.rotation.order = 'YXZ' // primeiro gira para a direção (Y), depois inclina na curva (Z local)

// Sombra redonda simples embaixo da bike (mais leve que sombras reais)
const blobShadow = new THREE.Mesh(
  new THREE.CircleGeometry(1, 20),
  new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.4, depthWrite: false }),
)
blobShadow.rotation.x = -Math.PI / 2 // deitada no chão
blobShadow.scale.set(0.7, 1.1, 1) // oval no sentido do comprimento
blobShadow.position.y = 0.03 - BIKE_Y // 3 cm acima do chão
bike.group.add(bike.model, blobShadow)
scene.add(bike.group)

/* ---------------- Modos ---------------- */

/**
 * Trava a bike (abertura, rebobinar, viagens): sem física nem controle do jogador.
 * Cancela qualquer arraste, zera a velocidade e torna o corpo cinemático sem colisão.
 */
export function lockBike() {
  bike.dragging = false
  bike.locked = true
  bike.speed = 0
  bike.body.type = CANNON.Body.KINEMATIC
  bike.body.collisionResponse = false
  bike.body.velocity.setZero()
}

/** Devolve o controle da bike ao jogador: corpo dinâmico de novo, colisões ligadas. */
export function unlockBike() {
  bike.body.type = CANNON.Body.DYNAMIC
  bike.body.collisionResponse = true
  bike.body.wakeUp()
  bike.locked = false
}

/**
 * Começa o arraste (botões da tela ocultos): o destino inicial é a própria posição,
 * então nada se move até o dedo sair de cima da bike. Chamada por pointerControls.js.
 */
export function startDrag() {
  const p = bike.body.position
  bike.dragging = true
  bike.dragTarget.x = p.x
  bike.dragTarget.z = p.z
}

/**
 * Atualiza o ponto apontado (limitado ao mapa, BOUNDS). Chamada a cada frame de arraste.
 * @param {number} x
 * @param {number} z
 */
export function dragTo(x, z) {
  bike.dragTarget.x = clamp(x, BOUNDS.minX, BOUNDS.maxX)
  bike.dragTarget.z = clamp(z, BOUNDS.minZ, BOUNDS.maxZ)
}

/** Solta a bike: ela freia naturalmente até parar (mesma frenagem do teclado). */
export function endDrag() {
  bike.dragging = false
}

/**
 * Teletransporta a bike para (x, z) com a direção `heading`.
 * Usada pelo rebobinar, viagens do inventário e abertura (timeMachine.js, intro.js).
 */
export function placeBike(x, z, heading = bike.heading) {
  bike.body.position.set(x, BIKE_Y, z)
  bike.heading = heading
}

/* ---------------- Movimento ---------------- */

/**
 * Aplica o comando do jogador. Chamada uma vez por frame por main.js, ANTES da física.
 *
 * A) Arraste: calcula para onde está o dedo; vira a bike para lá (até BIKE.drag.turnRate rad/s)
 *    e define a velocidade pela distância (BIKE.drag.speedPerMeter, até BIKE.drag.maxSpeed).
 *    Se o dedo estiver atrás da bike, ela desacelera enquanto vira (não sai de ré sozinha).
 * B) Teclado e botões (mesmo `input`, mesma precisão):
 *    1. velocidade-alvo: BIKE.maxSpeed (BIKE.boostSpeed com turbo); ré a BIKE.reverseFactor disso;
 *    2. `speed` persegue o alvo (BIKE.accel ao acelerar, BIKE.brake ao soltar);
 *    3. curva suavizada (BIKE.turnSmoothing) × BIKE.turnRate; parada, gira no lugar a
 *       BIKE.pivotFactor da curva (ajuste fino); na ré a curva se inverte, como uma bike de verdade;
 *    4. placas magnéticas puxam a bike para a rua quando ela passa perto sem virar.
 * Por fim converte direção + velocidade em velocidade do corpo físico (a física cuida das batidas).
 * @param {{forward: number, turn: number, boost: boolean}} input
 * @param {number} dt tempo do frame em segundos
 */
export function updateBike(input, dt) {
  if (bike.locked || dt <= 0) return
  const p = bike.body.position

  if (bike.dragging) {
    const dx = bike.dragTarget.x - p.x
    const dz = bike.dragTarget.z - p.z
    const dist = Math.hypot(dx, dz)
    let delta = 0
    if (dist > BIKE.drag.deadZone) {
      delta = angleDelta(bike.heading, Math.atan2(-dx, -dz))
      const maxTurn = BIKE.drag.turnRate * dt
      bike.heading += clamp(delta, -maxTurn, maxTurn)
    }
    const want = dist > BIKE.drag.deadZone ? Math.min(dist * BIKE.drag.speedPerMeter, BIKE.drag.maxSpeed) : 0
    const facing = Math.abs(delta) > 1.6 ? 0.25 : 1 // dedo atrás: quase para enquanto vira
    bike.speed = THREE.MathUtils.damp(bike.speed, want * facing, want ? BIKE.accel : BIKE.brake, dt)
    bike.turnAxis = THREE.MathUtils.damp(bike.turnAxis, clamp(delta * 1.5, -1, 1), BIKE.turnSmoothing, dt)
  } else {
    const top = input.boost ? BIKE.boostSpeed : BIKE.maxSpeed
    const target = input.forward * (input.forward < 0 ? top * BIKE.reverseFactor : top)
    bike.speed = THREE.MathUtils.damp(bike.speed, target, input.forward ? BIKE.accel : BIKE.brake, dt)
    bike.turnAxis = THREE.MathUtils.damp(bike.turnAxis, input.turn, BIKE.turnSmoothing, dt)
    const grip = clamp(Math.abs(bike.speed) / 3, 0, 1) // 0 parada → 1 a partir de 3 m/s
    const rate = BIKE.turnRate * (BIKE.pivotFactor + (1 - BIKE.pivotFactor) * grip)
    bike.heading += bike.turnAxis * rate * (bike.speed < -0.2 ? -1 : 1) * dt

    // Placas magnéticas: se o jogador não está virando, puxam a bike para a rua que indicam
    if (!input.turn && bike.speed > 1) {
      let nearest = null
      let best = 7 // alcance da atração em metros
      for (const s of signs) {
        const d = Math.hypot(p.x - s.x, p.z - s.z)
        if (d < best) {
          best = d
          nearest = s
        }
      }
      if (nearest) {
        const delta = angleDelta(bike.heading, Math.atan2(-(nearest.pull[0] - p.x), -(nearest.pull[1] - p.z)))
        // só atrai se o ponto estiver à frente (nunca faz a bike dar meia-volta)
        if (Math.abs(delta) < Math.PI / 2) bike.heading += delta * (1 - best / 7) * 2.5 * dt // 2.5 = força da atração
      }
    }
  }

  bike.body.velocity.x = -Math.sin(bike.heading) * bike.speed
  bike.body.velocity.z = -Math.cos(bike.heading) * bike.speed
}

/**
 * Empurrão para trás depois de uma batida (árvore ou onça): a bike recua e para.
 * @param {number} awayX direção (unitária) para onde empurrar, no chão
 * @param {number} awayZ
 */
export function knockBack(awayX, awayZ) {
  bike.speed = -Math.min(5, Math.abs(bike.speed) * 0.6 + 2.5)
  bike.body.position.x += awayX * 0.5
  bike.body.position.z += awayZ * 0.5
}

/**
 * Impede a bike de sair dos limites do mapa (BOUNDS em level.js) e de "voar" depois de
 * subir num prisma. Chamada por main.js logo DEPOIS do passo da física.
 */
export function clampToBounds() {
  const p = bike.body.position
  p.x = clamp(p.x, BOUNDS.minX, BOUNDS.maxX)
  p.z = clamp(p.z, BOUNDS.minZ, BOUNDS.maxZ)
  if (p.y > BIKE_Y + 1.2) p.y = BIKE_Y + 1.2
}

/**
 * Copia a física para o desenho e anima o modelo. Chamada por main.js uma vez por frame.
 * - direção: o modelo gira suavemente até `heading`;
 * - inclinação: na curva a bike se inclina para dentro (mais rápido = mais inclinada);
 * - rodas e pedivela giram conforme a velocidade; as pernas acompanham os pedais;
 * - seta neon pulsa; a bike pisca enquanto está imune (depois de perder vida);
 * - `rise` desloca o desenho para baixo/cima (bike saindo da terra na abertura).
 * @param {number} dt tempo do frame em segundos
 * @param {number} time relógio do jogo em segundos
 */
export function syncBike(dt, time) {
  bike.group.position.set(bike.body.position.x, bike.body.position.y + bike.rise, bike.body.position.z)
  bike.visualHeading += angleDelta(bike.visualHeading, bike.heading) * (1 - Math.exp(-18 * dt))
  const leanTarget = bike.turnAxis * clamp(Math.abs(bike.speed) / 8, 0, 1) * 0.32
  bike.lean = THREE.MathUtils.damp(bike.lean, leanTarget, 8, dt)
  bike.model.rotation.set(0, bike.visualHeading, bike.lean)

  const spin = (bike.speed / WHEEL_R) * dt // radianos girados pelas rodas neste frame
  for (const w of parts.wheels) w.rotation.x -= spin
  parts.crank.rotation.x -= spin * 0.45
  // Pés acompanham os pedais (posição do pedal convertida para as coordenadas do modelo)
  parts.legs.forEach((leg, i) => {
    const pedal = parts.pedals[i]
    const a = parts.crank.rotation.x
    const py = pedal.position.y
    const foot = v(pedal.position.x, parts.crank.position.y + py * Math.cos(a), parts.crank.position.z + py * Math.sin(a))
    placeTube(leg, v(0.1 * leg.userData.side, 1.1, 0.2), foot)
  })

  parts.arrow.material.opacity = 0.55 + 0.35 * Math.sin(time * 5)
  bike.model.visible = time > bike.invulnerableUntil || Math.floor(time * 14) % 2 === 0
  blobShadow.material.opacity = 0.4 * clamp(1 + bike.rise / 1.8, 0, 1) // sombra aparece conforme a bike sai da terra
}
