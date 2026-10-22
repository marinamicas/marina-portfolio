import gsap from 'gsap'
import './styles/main.css'

import { DEFAULT_VIEW, LIVES, TEXTS, ZONES } from './data/level.js'
import { renderer, scene, camera, billboards, worldToScreen } from './core/stage.js'
import { world } from './core/physics.js'
import { CameraRig } from './core/CameraRig.js'
import { consumeZoom, input, readInput, SETTINGS as INPUT_SETTINGS } from './core/input.js'
import { cancelPointerDrag, initPointerControls, updatePointerControls } from './core/pointerControls.js'
import { setDetectorGuard } from './core/invalidGestures.js'
import { collect, gainLife, loseLife, state } from './core/state.js'
import { record, resetHistory } from './core/timeMachine.js'
import { REDUCED_MOTION } from './utils/helpers.js'
import { whenAssetsReady } from './utils/textures.js'
import { animateEnvironment, buildEnvironment, syncProps } from './world/environment.js'
import { buildForest, checkTreeHit, trees } from './world/forest.js'
import { buildCritters, checkJaguarHit, jaguars, stunJaguar, updateCritters } from './world/critters.js'
import { buildSnow, updateSnow } from './world/snow.js'
import { bike, clampToBounds, knockBack, lockBike, syncBike, unlockBike, updateBike } from './world/bike.js'
import { checkHits, shatter, showDestroyed, syncTotems, totems } from './world/totems.js'
import { burstAt, particles, resetParticleTrail, updateParticles } from './world/particles.js'
import { playIntro } from './world/intro.js'
import { ui } from './ui/modal.js'
import { hurtFlash, paperBurst, toast } from './ui/effects.js'
import { enableExitGuard, initVisitorCounter, maybeWin, openItem, showLivesOver, updateHUD } from './ui/screens.js'
import { initProfile, showProfile } from './ui/profile.js'
import { syncControls } from './ui/controls.js'
import { showOnboarding } from './ui/onboarding.js'
import { initAudio } from './ui/audio.js'
import './ui/viewer.js' // visualizador em tela cheia: intercepta os links externos dos recortes
import { showPin, updatePins } from './ui/pins.js'
import './ui/guide.js' // guia de navegação: escuta os gestos inválidos e o botão ? Ajuda

/* ==========================================================================
   main.js — o "maestro" do jogo

   Este arquivo junta todos os módulos e faz quatro coisas:
   1. INICIALIZAÇÃO (uma vez ao abrir a página): monta cenário, floresta, bichos
      e neve; restaura os recortes já conquistados; cria a câmera; liga controles,
      foto de perfil, música e contador de visitantes.
   2. ABERTURA: quando as imagens terminam de carregar, toca o triângulo neon com
      a bike saindo da terra (world/intro.js) e mostra a janela de instruções
      (ui/onboarding.js). Ao clicar em "Começar", o jogo libera a bike.
   3. LOOP DO JOGO (~60 vezes por segundo, via gsap.ticker): lê teclado e botões,
      move a bike, avança a física, detecta atropelos e batidas (árvores e onças),
      atualiza câmera, bichos, neve, partículas e janelas, e desenha o quadro.
   4. REGRAS DE VIDA: batida em árvore/onça tira vida; explodir um recorte devolve;
      com zero vidas aparece a janela "Fim das vidas".

   Dependências: praticamente todos os módulos de src/ (veja os imports acima).

   Onde mexer:
   - Efeito do atropelo (câmera lenta, tremida) → cinematicHit().
   - O que acontece ao atropelar um recorte → hitTotem().
   - O que acontece ao bater numa árvore/onça → hurt().
   - Ordem das atualizações por quadro → gsap.ticker.add(...) abaixo.
   - Abertura e início do jogo → bloco "Início" no fim do arquivo.
   - Quantidade de vidas e dano → LIVES em src/data/level.js.
   ========================================================================== */

/** true depois que o visitante clica em "Começar" (antes disso, gestos, zoom, batidas e avisos ficam desligados). */
let playing = false

// Gestos inválidos só contam com o jogo rodando, sem janela aberta e com a bike livre
setDetectorGuard(() => playing && !ui.isBlocked() && !bike.locked)

// Monta o mundo: chão, ruas, prismas, placas e horizonte; depois floresta, bichos e neve
buildEnvironment()
buildForest()
buildCritters()
buildSnow()

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
/** Câmera que segue a bike o tempo todo (src/core/CameraRig.js). */
const rig = new CameraRig(camera, DEFAULT_VIEW)

/** Zona de ZONES (level.js) em que a bike está agora, ou null fora de todas. */
let currentZone = null

// Arrastar a bike (com os botões ocultos) e a pinça só valem com o jogo rodando e sem janela aberta
initPointerControls(() => playing && !ui.isBlocked())

// Aviso ao fechar/recarregar a aba sem 100% do inventário (só depois de começar a jogar)
enableExitGuard(() => playing)
initVisitorCounter() // contador de visitantes (cabeçalho)
initProfile() // foto de perfil: miniatura, foto sutil no céu e janela "Sobre"
initAudio() // música de fundo (começa sozinha ou no primeiro toque) + créditos no botão de som

/**
 * Verifica em qual zona do mapa a bike está e, se mudou, troca o enquadramento da
 * câmera (animado) e mostra o aviso da zona. Chamada uma vez por quadro.
 */
function updateZones() {
  const zone = ZONES.find((z) => z.test(bike.body.position)) ?? null
  if (zone === currentZone) return
  currentZone = zone
  rig.frame(zone ? zone.view : DEFAULT_VIEW)
  if (zone?.message && !bike.locked && playing) toast(zone.message)
}

/* ==========================================================================
   Atropelar um recorte
   ========================================================================== */
/** Escala do tempo da simulação: 1 = normal. Cai por um instante no atropelo (câmera lenta). */
const sim = { timeScale: 1 }

/**
 * Efeito cinematográfico do atropelo (evento programado de zoom): tremida,
 * aproximação rápida da câmera ("punch") e câmera lenta (timeScale cai para 0.12
 * e volta a 1 em ~1,3 s). Quem pediu menos animação recebe só a tremida.
 */
function cinematicHit() {
  rig.shake(0.5, 0.45) // força 0.5, duração 0.45 s
  if (REDUCED_MOTION) return
  rig.cinematicPunch()
  gsap.timeline({ overwrite: true })
    .to(sim, { timeScale: 0.12, duration: 0.08, ease: 'power2.out' }) // desacelera em 0,08 s até 12%
    .to(sim, { timeScale: 1, duration: 0.9, ease: 'power2.in' }, '+=0.35') // fica lento 0,35 s e volta em 0,9 s
}

/**
 * Tudo o que acontece quando a bike passa por cima de um recorte vivo:
 * solta a bike, explode o recorte em papel, efeito de câmera, papeizinhos na tela,
 * registra no inventário, devolve 1 vida, fixa a janela no chão e abre a janela:
 * - recorte com `opens: 'profile'` (o primeiro, "Sobre") → janela "Sobre a Marina";
 * - os outros → janela do item (título, texto e links).
 * @param {object} totem recorte retornado por checkHits()
 */
function hitTotem(totem) {
  const screen = worldToScreen(totem.mesh.position) // posição do recorte na tela (px)
  cancelPointerDrag() // solta a bike: o atropelo assume o controle por um instante
  shatter(totem)
  cinematicHit()
  paperBurst(screen.x, screen.y)
  const isNew = collect(totem.item.id)
  const healed = gainLife(LIVES.cutoutHeal)
  showPin(totem, 1.2) // a janela presa no chão aparece depois que a janela grande fecha
  if (isNew) toast(`✂ Recorte conquistado: ${totem.item.title}${healed ? ' · +1 ♥' : ''}`, 2.5)

  if (totem.item.opens === 'profile') {
    gsap.delayedCall(0.7, () => showProfile({ onClose: maybeWin }))
  } else {
    gsap.delayedCall(0.7, () => openItem(totem.item))
  }
}

/* ==========================================================================
   Vidas: batidas em árvores e onças
   ========================================================================== */
/**
 * A bike se machucou: tira vida, empurra a bike para trás, treme a tela, clarão vermelho,
 * "folhas"/poeira voando e alguns segundos de imunidade (a bike pisca).
 * Com zero vidas, trava o controle e abre a janela "Fim das vidas".
 * @param {number} damage vidas a tirar
 * @param {{x:number, z:number}} from de onde veio a batida (para empurrar a bike para longe)
 * @param {string} message aviso mostrado
 * @param {string[]} colors cores das partículas da batida
 */
function hurt(damage, from, message, colors) {
  const p = bike.body.position
  const dx = p.x - from.x
  const dz = p.z - from.z
  const d = Math.hypot(dx, dz) || 1
  knockBack(dx / d, dz / d)
  cancelPointerDrag()
  const left = loseLife(damage)
  bike.invulnerableUntil = clock + LIVES.invulnerableSeconds
  rig.shake(0.6, 0.4)
  hurtFlash()
  burstAt(p.x, p.z, 16, colors, 0.8)
  if (left <= 0) {
    bike.speed = 0
    toast('Sem vidas!', 2, { hurt: true })
    gsap.delayedCall(0.6, showLivesOver)
  } else {
    toast(`${message} −${damage} ♥ (restam ${left})`, 2.2, { hurt: true })
  }
}

/** Confere batidas em árvores e onças (só com o jogo rodando, bike livre e fora da imunidade). */
function checkHazards() {
  if (!playing || bike.locked || ui.isBlocked() || clock < bike.invulnerableUntil || state.lives <= 0) return
  const p = bike.body.position
  const tree = checkTreeHit(p)
  if (tree) return hurt(LIVES.treeDamage, tree, '🌲 Bateu numa árvore!', ['#3f8a5f', '#5b9e6a', '#4a3426'])
  const jaguar = checkJaguarHit(p)
  if (jaguar) {
    stunJaguar(jaguar)
    hurt(LIVES.jaguarDamage, jaguar.group.position, '🐆 A onça te pegou!', ['#e39b2e', '#1a1008', '#ffd166'])
  }
}

/* ==========================================================================
   Easter egg da bicicleta
   Uma vez por visita, 4 s depois de começar a pedalar, aparece o aviso com TEXTS.bike.
   A mesma frase fica sempre na janela "Sobre" (miniatura da foto e primeiro recorte).
   ========================================================================== */
let bikeStoryTold = false // true depois que o aviso apareceu nesta visita
let movingFor = 0 // segundos pedalando desde o início

/** Mostra o easter egg depois de alguns segundos pedalando (só uma vez, sem janela aberta). */
function maybeTellBikeStory(dt) {
  if (bikeStoryTold || !playing || ui.isBlocked()) return
  if (Math.abs(bike.speed) > 1.5) movingFor += dt
  if (movingFor < 4) return
  bikeStoryTold = true
  toast(`🚲 ${TEXTS.bike}`, 5)
}

/* ==========================================================================
   Loop: gsap.ticker mantém física, câmera e tweens no mesmo relógio
   ----------------------------------------------------------------------------
   Ordem de cada quadro (cada passo usa o resultado do anterior):
   1. ponteiro (arraste/pinça) e teclado + botões → comando da bike
   2. física (cannon-es) → move a bike e os prismas; limites do mapa
   3. atropelos de recortes e batidas em árvores/onças
   4. zonas, gravação para o rebobinar, animações do cenário, bichos e neve
   5. zoom e câmera (segue a bike)
   6. desenho da bike, partículas, render do quadro e janelas presas no chão
   ========================================================================== */
/** Relógio do jogo em segundos (o mesmo `time` do ticker; usado pela imunidade). */
let clock = 0

gsap.ticker.add((time, deltaMs) => {
  clock = time
  // Visualizador de link aberto: o jogo congela exatamente onde estava (e economiza bateria)
  if (ui.viewerOpen) return
  const dt = Math.min(deltaMs / 1000, 1 / 20) // tempo real do quadro em s (limitado a 50 ms)
  const simDt = dt * sim.timeScale // tempo da simulação (fica lento no atropelo)

  updatePointerControls()
  readInput(!playing || ui.isBlocked() || bike.locked || state.lives <= 0)
  syncControls(input) // acende o botão da tela correspondente à tecla apertada
  updateBike(input, bike.dragging ? dt : simDt)
  world.step(1 / 60, simDt, 3) // passo fixo de 1/60 s, até 3 subpassos por quadro
  clampToBounds()
  syncProps()
  syncTotems(time)

  if (playing && !bike.locked && !ui.isBlocked()) {
    const hit = checkHits()
    if (hit) hitTotem(hit)
  } else {
    // teletransportes (rebobinar, viagens, abertura) não contam como "passar por cima" de recortes
    bike.prevPos.x = bike.body.position.x
    bike.prevPos.z = bike.body.position.z
  }
  checkHazards()
  // Janela "Fim das vidas" fechada por outro caminho (ex.: foi aos contatos) com 0 vidas: volta a aparecer
  if (playing && state.lives <= 0 && !ui.isBlocked() && !bike.locked) showLivesOver()

  updateZones()
  record(dt)
  animateEnvironment(time, simDt, bike.body.position)
  updateCritters(time, simDt)
  updateSnow(time, dt, rig.target, camera.position)
  maybeTellBikeStory(dt)

  // Zoom acumulado pelos gestos desde o último frame (sempre consumido, para não "vazar" depois)
  const zoom = consumeZoom()
  if (playing && !ui.isBlocked()) {
    if (zoom.reset) rig.resetZoom()
    rig.zoomBy(zoom.delta)
  }

  rig.lag = bike.locked ? 14 : 8 // rebobinar/viagens: câmera cola na bike (14); jogando, segue firme (8)
  rig.update(dt, bike.body.position)
  for (const o of billboards) o.rotation.y = rig.yaw // recortes e placas sempre de frente para a câmera
  syncBike(dt, time)
  updateParticles(dt, time) // rastro atrás da bike (tempo real, não o lento)

  renderer.render(scene, camera)
  updatePins() // depois do render: usa as matrizes da câmera deste quadro
})

/* ==========================================================================
   Início: carregamento → abertura (triângulo neon + bike saindo da terra)
   → janela de instruções → jogo
   ========================================================================== */
const loadingScreen = document.querySelector('#start-screen')

/** Libera a bike e começa a partida (chamada quando a janela de instruções fecha). */
function startGame() {
  playing = true
  resetHistory()
  resetParticleTrail()
  unlockBike()
  updateHUD()
  toast(
    state.collected.length
      ? `Bem-vindo de volta! Você já conhece ${state.collected.length} de ${totems.length} recortes.`
      : 'Siga a seta neon até o primeiro recorte, logo à frente!',
  )
}

// Enquanto carrega, a bike fica travada e enterrada no ponto de partida (a abertura a tira da terra)
lockBike()
bike.rise = -1.9
rig.snapTo(bike.body.position)
updateHUD()

// Quando todas as imagens dos recortes carregarem: some a tela de carregamento e começa a abertura
whenAssetsReady().then(() => {
  gsap.to(loadingScreen, {
    autoAlpha: 0,
    duration: 0.4,
    onComplete: () => {
      loadingScreen.classList.add('hidden')
      playIntro(rig).then(() => showOnboarding(startGame))
    },
  })
})

// Em desenvolvimento (npm run dev), `__game` no console (F12) dá acesso a tudo para depurar.
// Ex.: __game.bike.body.position, __game.state, __game.showProfile()
if (import.meta.env.DEV) {
  window.__game = { scene, camera, world, rig, bike, totems, trees, jaguars, state, sim, particles, input, settings: INPUT_SETTINGS, showProfile, clock: () => clock }
}
