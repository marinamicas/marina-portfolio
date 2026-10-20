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

/*
  A trajetória da bike é gravada a cada 0,1 s. Rebobinar = o GSAP percorre
  essa gravação de trás para frente; a câmera segue a bike, então também volta.
*/
const history = { samples: [], acc: 0, step: 0.1, max: 6000 }
let returnPoint = null

export const hasReturnPoint = () => Boolean(returnPoint)

export function resetHistory() {
  const p = bike.body.position
  history.samples = [{ x: p.x, z: p.z, h: bike.heading }]
}

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

/** Move a bike em linha reta até um ponto (viagens do inventário). */
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
  const from = to === 'fork' ? s.findLastIndex((p) => Math.hypot(p.x - cp.x, p.z - cp.z) < 5) : 0

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
  const duration = REDUCED_MOTION ? 0.8 : clamp(total / 18, 1.5, 6)

  lockBike()
  document.body.classList.add('is-rewinding')
  if (to === 'start') resetWorld(duration, fresh)
  const cursor = { d: total }
  let seg = dist.length - 2
  return gsap.to(cursor, {
    d: 0,
    duration,
    ease: 'power1.inOut',
    onUpdate: () => {
      while (seg > 0 && dist[seg] > cursor.d) seg--
      const span = dist[seg + 1] - dist[seg] || 1
      const t = clamp((cursor.d - dist[seg]) / span, 0, 1)
      const a = s[from + seg]
      const b = s[from + seg + 1]
      placeBike(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, a.h + (b.h - a.h) * t)
    },
    onComplete: () => {
      if (to === 'start') placeBike(cp.x, cp.z, cp.heading)
      else bike.heading = cp.heading
      s.length = from + 1
      if (to === 'start') resetHistory()
      returnPoint = null
      document.body.classList.remove('is-rewinding')
      unlockBike()
      toast(doneMessage)
    },
  })
}

/** Inventário → leva a bike até o recorte escolhido. */
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

export function returnToPrevious() {
  if (!returnPoint || bike.locked) return
  ui.close()
  const rp = returnPoint
  returnPoint = null
  moveBikeTo(rp, 1.8)
}
