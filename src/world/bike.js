import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { scene, billboards } from '../core/stage.js'
import { materials, world } from '../core/physics.js'
import { AVATAR_IMAGE, BOUNDS } from '../data/level.js'
import { angleDelta, clamp } from '../utils/helpers.js'
import { applyCutout, makeBikeTexture } from '../utils/textures.js'
import { signs } from './environment.js'

/* ==========================================================================
   BICICLETA DO JOGADOR

   Papel deste arquivo: criar a bike (desenho + corpo físico) e controlar como
   ela se move. O desenho é um recorte 2D (plano com a imagem) que sempre
   encara a câmera; o corpo físico é uma caixa invisível no mundo cannon-es,
   usada para empurrar os prismas do cenário e respeitar as placas.
   A velocidade é controlada direto pelo código (estilo arcade): não há motor
   nem atrito "de verdade".

   Modos da bike (estado em `bike`):
   - livre (locked = false, dragging = false): responde ao teclado (updateBike),
     corpo DYNAMIC (colide e é empurrado de volta);
   - arrastada (dragging = true): segue exatamente o ponto do chão sob o
     dedo/mouse, corpo KINEMATIC (empurra os prismas mas nada a empurra);
   - travada (locked = true): intro, rebobinar, viagens do inventário. Corpo
     KINEMATIC sem resposta a colisão; só placeBike() a move.
   Transições: startDrag/endDrag (pointerControls.js) e lockBike/unlockBike
   (main.js, timeMachine.js).

   Depende de: three, cannon-es, stage.js (scene, billboards), physics.js
   (world, materials), level.js (AVATAR_IMAGE, BOUNDS), helpers, textures.js,
   environment.js (signs, para as placas magnéticas).
   Quem usa: main.js (loop), pointerControls.js, timeMachine.js, totems.js.

   Onde mexer:
   - SIZE: altura do recorte da bike em metros.
   - updateBike → `const max = input.boost ? 17 : 10`: velocidade máxima (m/s) com e sem Shift.
   - updateBike → `2.6`: velocidade de curva (rad/s); `best = 7`: alcance das placas (m).
   - syncBike → `0.35`: altura que a bike "levanta" ao ser arrastada.
   - blobShadow: raio (0.9 m) e opacidade (0.35) da sombra.
   ========================================================================== */

// Meia altura da caixa de colisão (a caixa tem 1,2 m de altura; o centro fica a 0,6 m do chão)
const BIKE_Y = 0.6
// Altura do recorte da bike em metros (a largura segue a proporção da imagem)
const SIZE = 2.4

// Material do recorte: transparente (fundo da imagem invisível), alphaTest corta pixels
// com menos de 40% de opacidade (bordas limpas), DoubleSide = visível pelos dois lados
const spriteMaterial = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.4, side: THREE.DoubleSide })

/**
 * Estado público da bike (lido por câmera, inventário, rebobinar, partículas…).
 * - body:       corpo físico (cannon-es). A posição "oficial" da bike é body.position.
 * - group:      grupo 3D com o recorte e a sombra (copia a posição do body a cada frame).
 * - sprite:     o plano com a imagem da bike.
 * - heading:    direção em radianos; 0 = olhando para -Z (frente do mapa), cresce no sentido anti-horário.
 * - speed:      velocidade atual em m/s (negativa = ré no teclado).
 * - facing:     1 = recorte virado para a direita da tela, -1 = para a esquerda.
 * - locked:     true = sem física nem controle do jogador (intro, rebobinar, viagens).
 * - dragging:   true enquanto o jogador arrasta a bike com o dedo/mouse.
 * - dragTarget: ponto do chão onde o dedo/mouse está (destino exato da bike no arraste).
 * - prevPos:    posição no frame anterior (detecção de atropelo em arrastes rápidos).
 */
export const bike = {
  body: new CANNON.Body({
    mass: 5, // kg: pesada o bastante para empurrar os prismas (massa 1) sem ser freada por eles
    shape: new CANNON.Box(new CANNON.Vec3(0.5, BIKE_Y, 0.5)), // meias medidas: caixa de 1 × 1,2 × 1 m
    position: new CANNON.Vec3(0, BIKE_Y, 0),
    fixedRotation: true, // nunca tomba
    linearDamping: 0.1, // leve freio natural (0 = desliza para sempre, 1 = para na hora)
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

// Recorte real em src/assets/cutouts/avatar/bike.webp (virado para a direita, rodas na base).
// Enquanto não existe, usa a bike desenhada em canvas (makeBikeTexture). Quando a imagem
// real chega, o plano é refeito com a largura proporcional à imagem, mantendo a altura SIZE.
applyCutout(spriteMaterial, AVATAR_IMAGE, makeBikeTexture, (tex) => {
  bike.sprite.geometry.dispose()
  bike.sprite.geometry = new THREE.PlaneGeometry((SIZE * tex.image.width) / tex.image.height, SIZE)
})

world.addBody(bike.body)
bike.sprite.position.y = 0.4 // o recorte fica 0,4 m acima do centro do corpo (rodas no chão)

// Sombra redonda simples embaixo da bike (mais leve que sombras reais)
const blobShadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.9, 24), // raio 0,9 m, 24 lados
  new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.35, depthWrite: false }),
)
blobShadow.rotation.x = -Math.PI / 2 // deitada no chão
blobShadow.position.y = 0.03 - BIKE_Y // 3 cm acima do chão (evita "brigar" com a textura do chão)
bike.group.add(bike.sprite, blobShadow)
scene.add(bike.group)
billboards.push(bike.sprite) // o recorte gira para sempre encarar a câmera (main.js)

/**
 * Trava a bike (intro, rebobinar, viagens): sem física nem controle do jogador.
 * Cancela qualquer arraste, zera a velocidade e torna o corpo cinemático sem
 * resposta a colisão (atravessa tudo, não empurra nada).
 */
export function lockBike() {
  bike.dragging = false
  bike.locked = true
  bike.speed = 0
  bike.body.type = CANNON.Body.KINEMATIC
  bike.body.collisionResponse = false
  bike.body.velocity.setZero()
}

/**
 * Devolve o controle da bike ao jogador: corpo dinâmico de novo, colisões
 * ligadas e acordado (wakeUp garante que a física volte a simulá-lo).
 */
export function unlockBike() {
  bike.body.type = CANNON.Body.DYNAMIC
  bike.body.collisionResponse = true
  bike.body.wakeUp()
  bike.locked = false
}

/**
 * Começa o arraste direto: a bike vira um corpo cinemático (sem inércia),
 * que vai exatamente para onde o jogador apontar e ainda empurra os prismas.
 * O destino inicial é a própria posição atual (nada se move até dragTo).
 * Chamada por pointerControls.js quando o dedo/mouse "pega" a bike.
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

/**
 * Atualiza o destino do arraste (limitado ao mapa, BOUNDS).
 * Chamada a cada frame por pointerControls.js com o ponto do chão sob o dedo.
 * @param {number} x
 * @param {number} z
 */
export function dragTo(x, z) {
  bike.dragTarget.x = clamp(x, BOUNDS.minX, BOUNDS.maxX)
  bike.dragTarget.z = clamp(z, BOUNDS.minZ, BOUNDS.maxZ)
}

/**
 * Solta a bike: ela para exatamente onde foi deixada (sem deslizar).
 * Se estiver travada (intro/rebobinar), não muda o tipo do corpo: quem
 * destravar (unlockBike) define.
 */
export function endDrag() {
  if (!bike.dragging) return
  bike.dragging = false
  bike.speed = 0
  bike.body.velocity.setZero()
  if (bike.locked) return // travada por intro/rebobinar: quem destravar define o tipo do corpo
  bike.body.type = CANNON.Body.DYNAMIC
  bike.body.wakeUp()
}

/**
 * Teletransporta a bike para (x, z) com a direção `heading`.
 * Usada pelo rebobinar e pelas viagens do inventário (timeMachine.js).
 * @param {number} x
 * @param {number} z
 * @param {number} [heading=bike.heading] direção em radianos
 */
export function placeBike(x, z, heading = bike.heading) {
  bike.body.position.set(x, BIKE_Y, z)
  bike.heading = heading
}

/**
 * Aplica o input do jogador: acelera, vira e sofre a atração das placas magnéticas.
 * Chamada uma vez por frame por main.js, ANTES do passo da física.
 *
 * Dois caminhos:
 * A) Arraste (dragging): velocidade = distância até o dedo ÷ tempo do frame, para
 *    a física levar a bike até o ponto em um único passo (empurrando os prismas no
 *    caminho). O recorte vira para o lado do movimento. Fim.
 * B) Teclado:
 *    1. velocidade-alvo: 10 m/s (17 com Shift); ré a 40% disso;
 *    2. `speed` persegue o alvo com amortecimento (8 ao acelerar, 10 ao soltar: freia
 *       um pouco mais rápido do que acelera);
 *    3. curva: 2,6 rad/s multiplicado por `grip` (0 parada → 1 a partir de 3 m/s),
 *       invertido na ré;
 *    4. placas magnéticas: sem o jogador virar e acima de 1 m/s, a placa mais
 *       próxima (até 7 m) puxa o heading na direção do ponto `pull` dela, mais
 *       forte quanto mais perto; só se o ponto estiver à frente (nunca meia-volta);
 *    5. converte heading + speed em velocidade x/z do corpo físico.
 * @param {{forward: number, turn: number, boost: boolean}} input estado do teclado (core/input.js)
 * @param {number} dt tempo do frame em segundos
 */
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
  const max = input.boost ? 17 : 10 // m/s: 17 com Shift, 10 normal
  const target = input.forward * (input.forward < 0 ? max * 0.4 : max) // ré a 40% da velocidade
  bike.speed = THREE.MathUtils.damp(bike.speed, target, input.forward ? 8 : 10, dt)
  const grip = clamp(Math.abs(bike.speed) / 3, 0, 1) // só vira em movimento
  bike.heading += input.turn * 2.6 * grip * Math.sign(bike.speed || 1) * dt

  // Placas magnéticas: se o jogador não está virando, puxam a bike para a rua que indicam
  if (!input.turn && bike.speed > 1) {
    const p = bike.body.position
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
      const desired = Math.atan2(-(nearest.pull[0] - p.x), -(nearest.pull[1] - p.z))
      const delta = angleDelta(bike.heading, desired)
      // só atrai se o ponto estiver à frente (nunca faz a bike dar meia-volta)
      if (Math.abs(delta) < Math.PI / 2) bike.heading += delta * (1 - best / 7) * 2.5 * dt // 2.5 = força da atração
    }
  }

  bike.body.velocity.x = -Math.sin(bike.heading) * bike.speed
  bike.body.velocity.z = -Math.cos(bike.heading) * bike.speed
}

/**
 * Impede a bike de sair dos limites do mapa (BOUNDS em level.js).
 * Chamada por main.js logo DEPOIS do passo da física. No arraste, também força
 * a posição final a ser exatamente o destino (a física pode ter parado a bike
 * um pouquinho antes por causa de uma colisão) e a altura padrão.
 */
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

/**
 * Copia a física para o desenho da bike e vira o recorte para o lado em que ela anda.
 * Chamada por main.js depois da câmera, uma vez por frame.
 *
 * - `side`: para que lado da TELA a bike está indo (combina heading com a rotação da
 *   câmera). Acima de 0,15 em módulo, define `facing`; perto de zero (indo "para
 *   dentro" da tela) mantém o lado anterior para não ficar piscando.
 * - scale.x persegue `facing` com amortecimento: o recorte vira como papel girando.
 * - `lift`: arrastada, a bike levanta 0,35 m do chão (como um papel segurado).
 * - `pedal`: balanço vertical de pedalada só no teclado, proporcional à velocidade
 *   (até 10 m/s), 18 oscilações por segundo, amplitude de até 6 cm.
 * @param {number} dt tempo do frame em segundos
 * @param {number} camYaw rotação da câmera no eixo Y (CameraRig.yaw)
 * @param {number} time tempo total em segundos (para a oscilação)
 */
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
