import gsap from 'gsap'
import './styles/main.css'

import { BOUNDS, DEFAULT_VIEW, TEXTS, ZONES } from './data/level.js'
import { renderer, scene, camera, billboards } from './core/stage.js'
import { world } from './core/physics.js'
import { CameraRig } from './core/CameraRig.js'
import { consumeZoom, input, readInput, SETTINGS as INPUT_SETTINGS } from './core/input.js'
import { cancelPointerDrag, initPointerControls, updatePointerControls } from './core/pointerControls.js'
import { setDetectorGuard } from './core/invalidGestures.js'
import { collect, state } from './core/state.js'
import { record, resetHistory } from './core/timeMachine.js'
import { REDUCED_MOTION } from './utils/helpers.js'
import { whenAssetsReady } from './utils/textures.js'
import { animateEnvironment, buildEnvironment, syncProps } from './world/environment.js'
import { bike, clampToBounds, lockBike, syncBike, unlockBike, updateBike } from './world/bike.js'
import { checkHits, shatter, showDestroyed, syncTotems, totems } from './world/totems.js'
import { particles, resetParticleTrail, updateParticles } from './world/particles.js'
import { ui } from './ui/modal.js'
import { paperBurst, toast } from './ui/effects.js'
import { enableExitGuard, initVisitorCounter, maybeWin, openItem, updateHUD } from './ui/screens.js'
import { initProfile, showProfile } from './ui/profile.js'
import './ui/viewer.js' // visualizador em tela cheia: intercepta todos os links externos
import { showPin, updatePins } from './ui/pins.js'
import './ui/guide.js' // modal guia: escuta os gestos inválidos e o botão ? Ajuda

/* ==========================================================================
   main.js — o "maestro" do jogo

   Este arquivo junta todos os módulos e faz três coisas:
   1. INICIALIZAÇÃO (roda uma vez ao abrir a página): monta o cenário, restaura
      os recortes já conquistados, cria a câmera, liga os controles, a foto de
      perfil e o contador de visitantes.
   2. LOOP DO JOGO (roda ~60 vezes por segundo, via gsap.ticker): lê os
      controles, move a bike, avança a física, detecta atropelos, atualiza
      câmera, partículas e janelas, e desenha o quadro.
   3. TELA INICIAL: o botão "Pedalar" inicia a cena de abertura (câmera desce
      do céu até a bike) e libera o controle.

   Dependências: praticamente todos os módulos de src/ (veja os imports acima).

   Onde mexer:
   - Efeito do atropelo (câmera lenta, tremida) → cinematicHit().
   - O que acontece ao atropelar um recorte → hitTotem().
   - Ordem das atualizações por quadro → gsap.ticker.add(...) abaixo.
   - Cena de abertura (posição inicial da câmera e duração) → startIntro().
   - Aviso do easter egg da bike (quando aparece) → bloco "Easter egg" no loop.
   ========================================================================== */

/** true depois que o visitante clica em "Pedalar" (antes disso, zoom, gestos e avisos ficam desligados). */
let playing = false

// Gestos inválidos só contam com o jogo rodando, sem janela aberta e com a bike livre
setDetectorGuard(() => playing && !ui.isBlocked() && !bike.locked)

// Monta chão, ruas, enfeites, prismas, placas e horizonte (src/world/environment.js)
buildEnvironment()

// Recortes já no inventário (sessão anterior desta aba) começam no estado final:
// destruídos e com a janela presa no chão, sem animação
for (const t of totems) {
  if (!state.collected.includes(t.item.id)) continue
  showDestroyed(t)
  showPin(t)
}

/* ==========================================================================
   Câmera + zonas do level (bifurcação, encruzilhada, horizonte)
   ========================================================================== */
/** Câmera que segue a bike com atraso suave; suporta zoom, pan, tremida e enquadramentos (src/core/CameraRig.js). */
const rig = new CameraRig(camera, DEFAULT_VIEW)
rig.panBounds = BOUNDS // o pan não leva a câmera para fora do mapa

/** Zona de ZONES (level.js) em que a bike está agora, ou null fora de todas. Usado para só trocar o enquadramento ao ENTRAR/SAIR. */
let currentZone = null

// Arrastar a bike / arrastar o cenário só valem com o jogo rodando e sem janela aberta
initPointerControls(rig, () => playing && !ui.isBlocked())

// Aviso ao fechar/recarregar a aba sem 100% do inventário (só depois de começar a jogar)
enableExitGuard(() => playing)
// Contador de visitantes (tela inicial e HUD)
initVisitorCounter()
// Foto de perfil: miniatura no HUD, foto sutil no céu e janela "Sobre" (src/ui/profile.js)
initProfile()

/**
 * Verifica em qual zona do mapa a bike está e, se mudou, troca o enquadramento da
 * câmera (animado) e mostra o aviso da zona. Chamada uma vez por quadro.
 */
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
/** Escala do tempo da simulação: 1 = normal. Cai por um instante no atropelo (câmera lenta). O GSAP anima este número. */
const sim = { timeScale: 1 }

/**
 * Efeito cinematográfico do atropelo: tremida, câmera recentrada na bike, aproximação
 * rápida ("punch") e câmera lenta (timeScale cai para 0.12 e volta a 1 em ~1,3 s).
 * É o ÚNICO momento com acelerações "lentas"; o resto do controle é direto.
 * Quem pediu menos animação no sistema (prefers-reduced-motion) recebe só a tremida.
 */
function cinematicHit() {
  rig.shake(0.5, 0.45) // força 0.5, duração 0.45 s
  rig.recenter() // enquadra a bike, onde a explosão acontece
  if (REDUCED_MOTION) return // quem pediu menos animação no sistema não recebe câmera lenta
  rig.cinematicPunch()
  gsap.timeline({ overwrite: true })
    .to(sim, { timeScale: 0.12, duration: 0.08, ease: 'power2.out' }) // desacelera em 0,08 s até 12%
    .to(sim, { timeScale: 1, duration: 0.9, ease: 'power2.in' }, '+=0.35') // fica lento 0,35 s e volta em 0,9 s
}

/**
 * Tudo o que acontece quando a bike passa por cima de um recorte vivo:
 * solta a bike, explode o recorte em papel (3D), efeito de câmera, papeizinhos na
 * tela (HTML), registra no inventário, fixa a janela no chão e abre a janela do item
 * (ou, para a apresentação, revela o texto em 3D e orienta a seguir).
 * @param {object} totem recorte retornado por checkHits()
 */
function hitTotem(totem) {
  const screen = totem.mesh.position.clone().project(camera) // posição do recorte na tela (-1..1)
  cancelPointerDrag() // solta a bike: o atropelo assume o controle por um instante
  shatter(totem)
  cinematicHit()
  // converte a posição projetada (-1..1) para pixels da janela
  paperBurst(((screen.x + 1) / 2) * innerWidth, ((1 - screen.y) / 2) * innerHeight)
  const isNew = collect(totem.item.id)
  showPin(totem, 1) // a janela presa no chão aparece 1 s depois
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
   Easter egg da bicicleta
   Uma vez por visita, 1,5 s depois do primeiro arraste da bike, aparece o aviso
   com TEXTS.bike. Se o arraste terminar antes (ex.: atropelou algo), o aviso é
   adiado para o próximo arraste, para não atropelar os avisos do atropelo.
   A mesma frase fica sempre disponível na janela "Sobre" (miniatura da foto).
   ========================================================================== */
let bikeStoryTold = false // true depois que o aviso apareceu nesta visita
let bikeStoryTimer = null // timer do GSAP em andamento (null = nenhum)

/** Agenda o aviso do easter egg se ainda não foi mostrado e a bike começou a ser arrastada. */
function maybeTellBikeStory() {
  if (bikeStoryTold || bikeStoryTimer || !bike.dragging) return
  bikeStoryTimer = gsap.delayedCall(1.5, () => {
    bikeStoryTimer = null
    if (!bike.dragging || ui.isBlocked()) return // arraste já acabou: tenta de novo no próximo
    bikeStoryTold = true
    toast(`🚲 ${TEXTS.bike}`, 5)
  })
}

/* ==========================================================================
   Loop: gsap.ticker mantém física, câmera e tweens no mesmo relógio
   ----------------------------------------------------------------------------
   Ordem de cada quadro (importante: cada passo usa o resultado do anterior):
   1. ponteiro (arraste/pan/pinça)  → define o destino da bike
   2. teclado                       → acelera/vira
   3. física (cannon-es)            → move a bike e os prismas
   4. limites do mapa + sincroniza desenhos com a física
   5. atropelos                     → hitTotem()
   6. zonas, gravação para o rebobinar, animações do cenário
   7. zoom e câmera
   8. render do quadro + janelas presas no chão + partículas
   `time` = segundos desde o início; `deltaMs` = milissegundos desde o quadro anterior.
   ========================================================================== */
gsap.ticker.add((time, deltaMs) => {
  // Visualizador de link aberto: o jogo congela exatamente onde estava (e economiza bateria)
  if (ui.viewerOpen) return
  const dt = Math.min(deltaMs / 1000, 1 / 20) // tempo real do quadro em s (limitado a 50 ms: aba em segundo plano não "pula")
  const simDt = dt * sim.timeScale // tempo da simulação (fica lento no atropelo)

  // Ponteiro primeiro: o arraste define para onde a bike vai neste frame
  updatePointerControls(dt)
  readInput(ui.isBlocked() || bike.locked)
  updateBike(input, bike.dragging ? dt : simDt) // o arraste segue o dedo em tempo real
  world.step(1 / 60, simDt, 3) // passo fixo de 1/60 s, até 3 subpassos por quadro
  clampToBounds()
  syncProps()
  syncTotems(time)

  if (!bike.locked && !ui.isBlocked()) {
    const hit = checkHits()
    if (hit) hitTotem(hit)
  } else {
    // teletransportes (rebobinar, viagens) não contam como "passar por cima" de recortes
    bike.prevPos.x = bike.body.position.x
    bike.prevPos.z = bike.body.position.z
  }
  updateZones()
  record(dt)
  animateEnvironment(time, simDt, bike.body.position)
  maybeTellBikeStory()

  // Zoom acumulado pelos gestos desde o último frame (sempre consumido, para não "vazar" depois)
  const zoom = consumeZoom()
  if (playing && !ui.isBlocked()) {
    if (zoom.reset) {
      rig.resetZoom()
      rig.recenter()
    }
    rig.zoomBy(zoom.delta)
  }
  // Pedalando no teclado ou com a bike travada (intro, rebobinar, viagens): câmera volta para a bike
  if (bike.locked || input.forward || input.turn) rig.recenter()

  rig.lag = bike.locked ? 14 : 5 // rebobinar/viagens: câmera cola na bike (14); jogando, segue suave (5)
  rig.update(dt, bike.body.position)
  for (const o of billboards) o.rotation.y = rig.yaw // recortes 2D sempre de frente para a câmera
  syncBike(dt, rig.yaw, time)
  // Rastro de partículas atrás da bike (usa a posição final deste quadro e o tempo real, não o lento)
  updateParticles(dt, time)

  renderer.render(scene, camera)
  updatePins() // depois do render: usa as matrizes da câmera deste quadro
})

/* ==========================================================================
   Início: tela inicial → câmera desce do céu até a bike
   ========================================================================== */
const startScreen = document.querySelector('#start-screen')
const startButton = document.querySelector('#btn-start')

/**
 * Cena de abertura: trava a bike, zera a gravação do rebobinar, coloca a câmera no alto
 * (offset -10, 60, 70) e a leva em 3,5 s até o enquadramento padrão. No fim, libera a bike
 * e mostra a dica inicial (ou a mensagem de boas-vindas de volta, se já havia progresso).
 */
function startIntro() {
  playing = true
  updateHUD()
  lockBike()
  resetHistory()
  resetParticleTrail()
  rig.target.set(0, 0.6, 0)
  rig.offset.set(-10, 60, 70)
  rig.frame(DEFAULT_VIEW, REDUCED_MOTION ? 0.5 : 3.5, 'power3.inOut').then(() => {
    unlockBike()
    toast(
      state.collected.length
        ? `Bem-vindo de volta! Você já conhece ${state.collected.length} de ${totems.length} recortes.`
        : 'Arraste a bike até o recorte da Marina Micas!',
    )
  })
}

// Enquanto a tela inicial está aberta, a câmera fica no alto mostrando o mapa
lockBike()
rig.offset.set(-10, 60, 70)
updateHUD()

// O botão "Pedalar" só habilita quando todos os recortes reais terminaram de carregar
whenAssetsReady().then(() => {
  startButton.disabled = false
  startButton.textContent = 'Pedalar ▶'
  startButton.focus()
})

// Clique em "Pedalar": some com a tela inicial (0,5 s) e começa a cena de abertura
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

// Em desenvolvimento (npm run dev), `__game` no console (F12) dá acesso a tudo para depurar.
// Ex.: __game.bike.body.position, __game.state, __game.showProfile()
if (import.meta.env.DEV) {
  window.__game = { scene, camera, world, rig, bike, totems, state, sim, particles, input: INPUT_SETTINGS, showProfile }
}
