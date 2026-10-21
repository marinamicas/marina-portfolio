import gsap from 'gsap'
import './styles/main.css'

import { DEFAULT_VIEW, ZONES } from './data/level.js'
import { renderer, scene, camera, billboards } from './core/stage.js'
import { world } from './core/physics.js'
import { CameraRig } from './core/CameraRig.js'
import { consumeZoom, input, readInput, SETTINGS as INPUT_SETTINGS } from './core/input.js'
import { setDetectorGuard } from './core/invalidGestures.js'
import { collect, state } from './core/state.js'
import { record, resetHistory } from './core/timeMachine.js'
import { REDUCED_MOTION } from './utils/helpers.js'
import { whenAssetsReady } from './utils/textures.js'
import { animateEnvironment, buildEnvironment, syncProps } from './world/environment.js'
import { bike, clampToBounds, lockBike, syncBike, unlockBike, updateBike } from './world/bike.js'
import { checkHits, shatter, showDestroyed, syncTotems, totems } from './world/totems.js'
import { ui } from './ui/modal.js'
import { paperBurst, toast } from './ui/effects.js'
import { maybeWin, openItem, updateHUD } from './ui/screens.js'
import { showPin, updatePins } from './ui/pins.js'
import './ui/guide.js' // modal guia: escuta os gestos inválidos e o botão ? Ajuda

// true depois que o visitante clica em "Pedalar" (antes disso, zoom e avisos ficam desligados)
let playing = false

// Gestos inválidos só contam com o jogo rodando, sem janela aberta e com a bike livre
setDetectorGuard(() => playing && !ui.isOpen && !bike.locked)

buildEnvironment()

// Recortes já no inventário (sessão anterior desta aba) começam no estado final
for (const t of totems) {
  if (!state.collected.includes(t.item.id)) continue
  showDestroyed(t)
  showPin(t)
}

/* ==========================================================================
   Câmera + zonas do level (bifurcação, encruzilhada, horizonte)
   ========================================================================== */
const rig = new CameraRig(camera, DEFAULT_VIEW)
let currentZone = null

function updateZones() {
  const zone = ZONES.find((z) => z.test(bike.body.position)) ?? null
  if (zone === currentZone) return
  currentZone = zone
  rig.frame(zone ? zone.view : DEFAULT_VIEW)
  if (zone?.message && !bike.locked) toast(zone.message)
}

/* ==========================================================================
   Atropelar um recorte
   ========================================================================== */
function hitTotem(totem) {
  const screen = totem.mesh.position.clone().project(camera)
  shatter(totem)
  rig.shake()
  paperBurst(((screen.x + 1) / 2) * innerWidth, ((1 - screen.y) / 2) * innerHeight)
  const isNew = collect(totem.item.id)
  showPin(totem, 1)
  if (isNew) toast(`✂ Recorte conquistado: ${totem.item.title}`, 2)

  if (totem.item.reveal) {
    // Fase 1: o texto da apresentação aparece em 3D no lugar do recorte
    gsap.delayedCall(2.2, () => {
      toast('Siga em frente até a bifurcação das placas →')
      maybeWin()
    })
  } else {
    gsap.delayedCall(0.7, () => openItem(totem.item))
  }
}

/* ==========================================================================
   Loop: gsap.ticker mantém física, câmera e tweens no mesmo relógio
   ========================================================================== */
gsap.ticker.add((time, deltaMs) => {
  const dt = Math.min(deltaMs / 1000, 1 / 20)

  readInput(ui.isOpen || bike.locked)
  updateBike(input, dt)
  world.step(1 / 60, dt, 3)
  clampToBounds()
  syncProps()
  syncTotems(time)

  if (!bike.locked && !ui.isOpen) {
    const hit = checkHits()
    if (hit) hitTotem(hit)
  }
  updateZones()
  record(dt)
  animateEnvironment(time, dt, bike.body.position)

  // Zoom acumulado pelos gestos desde o último frame (sempre consumido, para não "vazar" depois)
  const zoom = consumeZoom()
  if (playing && !ui.isOpen) {
    if (zoom.reset) rig.resetZoom()
    rig.zoomBy(zoom.delta)
  }

  rig.lag = bike.locked ? 14 : 5 // rebobinar/viagens: câmera cola na bike
  rig.update(dt, bike.body.position)
  for (const o of billboards) o.rotation.y = rig.yaw
  syncBike(dt, rig.yaw, time)

  renderer.render(scene, camera)
  updatePins()
})

/* ==========================================================================
   Início: tela inicial → câmera desce do céu até a bike
   ========================================================================== */
const startScreen = document.querySelector('#start-screen')
const startButton = document.querySelector('#btn-start')

function startIntro() {
  playing = true
  updateHUD()
  lockBike()
  resetHistory()
  rig.target.set(0, 0.6, 0)
  rig.offset.set(-10, 60, 70)
  rig.frame(DEFAULT_VIEW, REDUCED_MOTION ? 0.5 : 3.5, 'power3.inOut').then(() => {
    unlockBike()
    toast(
      state.collected.length
        ? `Bem-vindo de volta! Você já conhece ${state.collected.length} de ${totems.length} recortes.`
        : 'Acelere e atropele o recorte da Marina Micas!',
    )
  })
}

// Enquanto a tela inicial está aberta, a câmera fica no alto mostrando o mapa
lockBike()
rig.offset.set(-10, 60, 70)
updateHUD()

whenAssetsReady().then(() => {
  startButton.disabled = false
  startButton.textContent = 'Pedalar ▶'
  startButton.focus()
})

startButton.addEventListener('click', () => {
  startButton.blur()
  gsap.to(startScreen, {
    autoAlpha: 0,
    duration: 0.5,
    onComplete: () => {
      startScreen.classList.add('hidden')
      startIntro()
    },
  })
})

if (import.meta.env.DEV) window.__game = { scene, world, rig, bike, totems, state, input: INPUT_SETTINGS }
