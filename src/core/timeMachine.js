import * as CANNON from 'cannon-es'
import gsap from 'gsap'
import { CHECKPOINTS } from '../data/level.js'
import { resetProgress } from './state.js'
import { clamp, REDUCED_MOTION } from '../utils/helpers.js'
import { bike, lockBike, placeBike, unlockBike } from '../world/bike.js'
import { props } from '../world/environment.js'
import { clearFragments, findTotem, reassemble, totems } from '../world/totems.js'
import { ui } from '../ui/modal.js'
import { hidePin } from '../ui/pins.js'
import { toast } from '../ui/effects.js'
import { startMatrix, stopMatrix } from '../ui/matrix.js'
import { burstAt } from '../world/particles.js'

/* ==========================================================================
   MÁQUINA DO TEMPO: gravação da trajetória, rebobinar e viagens do inventário

   Papel deste arquivo:
   - Gravar por onde a bike passou (record), para poder "rebobinar" o caminho
     de trás para frente (rewind) até o início ou até a bifurcação das placas.
   - Mover a bike em linha reta até um recorte escolhido no inventário
     (travelTo) e voltar ao ponto anterior (returnToPrevious).
   - Ao voltar para o início, recolocar os objetos soltos do cenário no lugar
     (resetWorld) e, só no "Resetar tudo", remontar os recortes destruídos.

   A trajetória da bike é gravada a cada 0,1 s. Rebobinar = o GSAP percorre
   essa gravação de trás para frente; a câmera segue a bike, então também volta.

   Dependências: cannon-es, gsap, CHECKPOINTS (level.js), state.js,
   bike.js, environment.js (props), totems.js, modal.js, pins.js, effects.js.
   Quem usa: main.js (record, resetHistory), screens.js (rewind, travelTo,
   returnToPrevious, hasReturnPoint).

   Onde mexer:
   - history.step: de quanto em quanto tempo gravar (s). Menor = caminho mais fiel, mais memória.
   - history.max: quantidade máxima de pontos gravados (os mais antigos são descartados).
   - Em rewind(): `total / 45` = velocidade do rebobinar (metros por segundo); clamp(…, 0.9, 2.6) = duração mínima/máxima.
   - Visual "Matrix" do rebobinar: src/ui/matrix.js (chuva de caracteres) e body.is-rewinding no main.css.
   - doneMessage (em rewind): textos dos avisos ao terminar.
   - Pontos de chegada (início/bifurcação): CHECKPOINTS em level.js.
   ========================================================================== */
/**
 * Gravação da trajetória.
 * - samples: lista de pontos { x, z, h } (posição no chão e direção/heading em radianos)
 * - acc:     tempo acumulado desde a última gravação (s)
 * - step:    intervalo entre gravações (s)
 * - max:     limite de pontos (6000 × 0,1 s = 10 min de pedalada contínua)
 */
const history = { samples: [], acc: 0, step: 0.1, max: 6000 }
// Ponto de onde a bike saiu numa viagem do inventário ({ x, z, heading }) ou null.
// Permite o botão "↩ Voltar ao ponto anterior".
let returnPoint = null

/** true se existe um ponto para voltar (depois de uma viagem pelo inventário). */
export const hasReturnPoint = () => Boolean(returnPoint)

/**
 * Zera a gravação, deixando só a posição atual da bike como primeiro ponto.
 * Chamada ao iniciar o jogo (main.js) e ao terminar um rebobinar para o início.
 */
export function resetHistory() {
  const p = bike.body.position
  history.samples = [{ x: p.x, z: p.z, h: bike.heading }]
}

/**
 * Grava a posição da bike a cada `history.step` segundos.
 * Chamada a cada frame pelo loop (main.js) com o tempo do frame.
 * Regras: não grava com a bike travada (intro, rebobinar, viagens); não grava
 * se ela andou menos de 5 cm desde o último ponto (parada); descarta o ponto
 * mais antigo quando passa de `history.max`.
 * @param {number} dt - tempo do frame em segundos
 */
export function record(dt) {
  if (bike.locked) return
  history.acc += dt
  if (history.acc < history.step) return
  history.acc = 0
  const p = bike.body.position
  const last = history.samples.at(-1)
  if (last && Math.hypot(last.x - p.x, last.z - p.z) < 0.05) return // parada: não grava
  history.samples.push({ x: p.x, z: p.z, h: bike.heading })
  if (history.samples.length > history.max) history.samples.shift()
}

/**
 * Move a bike em linha reta até um ponto (viagens do inventário).
 * Trava a bike, anima um objeto "proxy" com GSAP e, a cada atualização, teleporta
 * a bike para a posição interpolada. Ao chegar, grava o destino na trajetória
 * (para o rebobinar saber do salto) e destrava a bike.
 * @param {{x:number, z:number, heading?:number}} destino
 * @param {number} duration - segundos (0,3 s se o sistema pediu menos animação)
 * @returns {gsap.core.Tween} (dá para usar .then() ao terminar)
 */
export function moveBikeTo({ x, z, heading = 0 }, duration = 1.6) {
  lockBike()
  const p = bike.body.position
  const proxy = { x: p.x, z: p.z, h: bike.heading }
  return gsap.to(proxy, {
    x,
    z,
    h: heading,
    duration: REDUCED_MOTION ? 0.3 : duration,
    ease: 'power2.inOut',
    onUpdate: () => placeBike(proxy.x, proxy.z, proxy.h),
    onComplete: () => {
      history.samples.push({ x, z, h: heading })
      unlockBike()
    },
  })
}

/**
  Os objetos soltos do cenário voltam ao lugar. Os recortes já conquistados
  continuam destruídos (com a janela presa no chão), a não ser que `fresh`
  seja true: aí o inventário foi resetado e todos os recortes são remontados.

  Como funciona para cada prisma (props): vira KINEMATIC (a física para de
  empurrá-lo), as velocidades são zeradas e um tween leva posição e rotação
  da situação atual (`fromPos`/`fromQuat`) até a original (`home`). No fim,
  volta a ser DYNAMIC e acorda para reagir a colisões.
  @param {number} duration - segundos da animação de retorno
  @param {boolean} fresh - true = também remonta os recortes e esconde as janelas do chão
*/
function resetWorld(duration, fresh = false) {
  clearFragments()
  for (const { body, home } of props) {
    body.type = CANNON.Body.KINEMATIC
    body.velocity.setZero()
    body.angularVelocity.setZero()
    const fromPos = body.position.clone()
    const fromQuat = body.quaternion.clone()
    const k = { t: 0 }
    gsap.to(k, {
      t: 1,
      duration,
      ease: 'power2.inOut',
      onUpdate: () => {
        fromPos.lerp(home.position, k.t, body.position)
        fromQuat.slerp(home.quaternion, k.t, body.quaternion)
      },
      onComplete: () => {
        body.type = CANNON.Body.DYNAMIC
        body.wakeUp()
      },
    })
  }
  if (!fresh) return
  totems.forEach((t) => {
    hidePin(t)
    reassemble(t, duration * 0.6)
  })
}

/**
  Rebobina até 'start' (início do portfólio) ou 'fork' (bifurcação das placas).
  Com { fresh: true } (só a partir de Sair → Tentar novamente) o inventário é apagado.

  Passo a passo:
  1. Ignora se a bike está travada (já está rebobinando/viajando). Fecha janelas.
  2. Se `fresh`, apaga o inventário (resetProgress) e escolhe a mensagem final.
  3. Procura em `history.samples` o ponto de partida do rebobinar (`from`):
     índice 0 para o início, ou o último ponto gravado a menos de 5 m da
     bifurcação para 'fork'.
  4. Sem trajetória suficiente (from < 0 ou menos de 2 pontos): vai em linha
     reta com moveBikeTo (e, para o início, recoloca o cenário).
  5. Com trajetória: calcula a distância acumulada entre os pontos (`dist`),
     define a duração pela distância total e anima um "cursor" de distância
     de `total` até 0. A cada atualização, acha o segmento onde o cursor está
     e interpola a posição da bike nele (velocidade constante no espaço, mesmo
     com saltos de viagens do inventário).
  6. Ao terminar: posiciona a bike exatamente no checkpoint, corta a gravação
     no ponto de chegada, limpa o returnPoint, tira o filtro visual, destrava
     a bike e mostra a mensagem.
  @param {'start'|'fork'} to - destino
  @param {{fresh?: boolean}} opções - fresh = resetar tudo
  @returns {gsap.core.Tween|Promise|null} animação (ou null se a bike estava travada)
*/
export function rewind(to = 'start', { fresh = false } = {}) {
  if (bike.locked) return null
  ui.close()
  if (fresh) resetProgress()
  const doneMessage = fresh
    ? 'Tudo resetado! Atropele o recorte da Marina para começar de novo.'
    : to === 'start'
      ? 'De volta ao início. Seu inventário foi mantido!'
      : 'De volta à bifurcação das placas.'
  const s = history.samples
  const cp = CHECKPOINTS[to]
  const last = s.length - 1
  const from = to === 'fork' ? s.findLastIndex((p) => Math.hypot(p.x - cp.x, p.z - cp.z) < 5) : 0 // 5 = raio (m) para considerar "passou pela bifurcação"

  // Sem trajetória gravada até lá (ainda não chegou na bifurcação, por ex.): vai direto
  if (from < 0 || last - from < 2) {
    if (to === 'fork' && from < 0) toast('Pedalando até a bifurcação das placas…')
    if (to === 'start') {
      resetWorld(1.2, fresh)
      return moveBikeTo(cp, 1.2).then(() => toast(doneMessage))
    }
    return moveBikeTo(cp, 1.2)
  }

  // Distância acumulada: o rebobinar anda em velocidade constante no espaço,
  // mesmo quando há saltos na gravação (viagens pelo inventário).
  const dist = [0]
  for (let i = from + 1; i <= last; i++) dist.push(dist.at(-1) + Math.hypot(s[i].x - s[i - 1].x, s[i].z - s[i - 1].z))
  const total = dist.at(-1)
  // Alta velocidade: 45 m/s, entre 0,9 s e 2,6 s no total (antes era 18 m/s, até 6 s)
  const duration = REDUCED_MOTION ? 0.8 : clamp(total / 45, 0.9, 2.6)

  lockBike()
  // Liga o visual "Matrix": cena verde, letreiro "◀◀ REBOBINANDO" (main.css) e chuva de caracteres (matrix.js)
  document.body.classList.add('is-rewinding')
  startMatrix()
  if (to === 'start') resetWorld(duration, fresh)
  const cursor = { d: total } // distância "restante" ao longo da trajetória; vai de total até 0
  let seg = dist.length - 2 // índice do segmento atual (começa no último)
  let frame = 0
  return gsap.to(cursor, {
    d: 0,
    duration,
    ease: 'power2.inOut', // acelera como uma fita rebobinando e freia perto do destino
    onUpdate: () => {
      while (seg > 0 && dist[seg] > cursor.d) seg-- // recua de segmento conforme o cursor volta
      const span = dist[seg + 1] - dist[seg] || 1
      const t = clamp((cursor.d - dist[seg]) / span, 0, 1) // fração dentro do segmento (0 = ponto a, 1 = ponto b)
      const a = s[from + seg]
      const b = s[from + seg + 1]
      placeBike(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, a.h + (b.h - a.h) * t)
      // Rastro verde de "dados" nos passos refeitos (a cada 2 quadros, para ficar leve)
      if (frame++ % 2 === 0) burstAt(bike.body.position.x, bike.body.position.z, 3, ['#00ff66', '#7dff9b', '#d9ffe4'], 0.35)
    },
    onComplete: () => {
      stopMatrix()
      if (to === 'start') placeBike(cp.x, cp.z, cp.heading)
      else bike.heading = cp.heading
      s.length = from + 1 // descarta o trecho rebobinado da gravação
      if (to === 'start') resetHistory()
      returnPoint = null
      document.body.classList.remove('is-rewinding')
      unlockBike()
      toast(doneMessage)
    },
  })
}

/**
 * Inventário → leva a bike até o recorte escolhido.
 * Guarda a posição atual em `returnPoint` e anda em linha reta até 6 m à frente
 * do recorte (z + 6, olhando para −Z), para não atropelar o lugar vazio.
 * @param {string} id - id do item (ex.: 'edu-1')
 */
export function travelTo(id) {
  const t = findTotem(id)
  if (!t || bike.locked) return
  ui.close()
  const p = bike.body.position
  returnPoint = { x: p.x, z: p.z, heading: bike.heading }
  moveBikeTo({ x: t.mesh.position.x, z: t.mesh.position.z + 6, heading: 0 }, 1.8).then(() =>
    toast('Abra o inventário para voltar ao ponto anterior.'),
  )
}

/**
 * Volta ao ponto de onde a bike saiu na última viagem do inventário.
 * Limpa o returnPoint antes de andar (só dá para voltar uma vez).
 */
export function returnToPrevious() {
  if (!returnPoint || bike.locked) return
  ui.close()
  const rp = returnPoint
  returnPoint = null
  moveBikeTo(rp, 1.8)
}
