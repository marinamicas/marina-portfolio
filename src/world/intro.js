import * as THREE from 'three'
import gsap from 'gsap'
import { scene } from '../core/stage.js'
import { INTRO, PALETTE } from '../data/level.js'
import { REDUCED_MOTION } from '../utils/helpers.js'
import { toTexture } from '../utils/textures.js'
import { bike } from './bike.js'
import { burstAt } from './particles.js'

/* ==========================================================================
   ABERTURA: triângulo neon + bike saindo da terra

   Sequência (playIntro):
   1. A câmera fica perto do ponto de partida, olhando o chão.
   2. Um triângulo neon é DESENHADO no chão, um lado de cada vez (cada lado é
      uma faixa que "cresce" do vértice até o próximo), com um brilho em volta.
   3. O triângulo pisca forte, o chão no meio dele escurece (a terra se abre) e
      voam partículas de terra.
   4. A bike sobe de dentro da terra girando até apontar para a frente.
   5. O triângulo fica no chão como marca do ponto de partida, mais fraco.
   Ao terminar, main.js mostra a janela de instruções (src/ui/onboarding.js).

   Como é feito o neon: cada lado tem duas camadas deitadas no chão:
   - núcleo: faixa fina quase branca;
   - brilho: faixa larga com textura em degradê (transparente nas bordas) somada
     à cena (AdditiveBlending), o que dá a aparência de luz.
   Mais uma luz pontual lilás no centro, que acende junto.

   Dependências: three, gsap, stage.js (scene), level.js (INTRO), helpers,
   textures.js (toTexture), bike.js (bike.rise e heading), particles.js (burstAt).
   Usado por: main.js (playIntro, uma vez ao carregar).

   Onde mexer: INTRO em src/data/level.js (tamanho, tempos, cores).
   ========================================================================== */

/** Textura do brilho: faixa horizontal com degradê vertical (transparente → claro → transparente). */
function makeGlowTexture() {
  const c = document.createElement('canvas')
  c.width = 8
  c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 0, 64)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(0.5, 'rgba(255,255,255,1)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 8, 64)
  return toTexture(c)
}

/**
 * Monta o triângulo (3 lados × 2 camadas), o "buraco" de terra e a luz.
 * Cada lado fica num grupo cujo ponto zero é o vértice inicial; animar scale.x de 0 a 1
 * faz o lado "crescer" até o próximo vértice (efeito de desenho).
 * @returns {{group, edges, hole, light, materials}}
 */
function buildTriangle() {
  const group = new THREE.Group()
  group.position.set(0, 0.07, 0)
  const R = INTRO.triangleRadius
  // Vértices: um aponta para a frente (−Z), os outros dois atrás, à esquerda e à direita
  const pts = [0, 1, 2].map((k) => {
    const a = -Math.PI / 2 + (k * Math.PI * 2) / 3 // −90°, 30°, 150° no plano XZ
    return new THREE.Vector2(Math.cos(a) * R, Math.sin(a) * R)
  })
  const glowTex = makeGlowTexture()
  const coreMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending })
  const glowMat = new THREE.MeshBasicMaterial({ color: INTRO.glowColor, map: glowTex, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })
  const neonMat = new THREE.MeshBasicMaterial({ color: INTRO.neonColor, map: glowTex, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending })
  const edges = []
  for (let k = 0; k < 3; k++) {
    const a = pts[k]
    const b = pts[(k + 1) % 3]
    const len = a.distanceTo(b)
    const edge = new THREE.Group()
    edge.position.set(a.x, 0, a.y)
    edge.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x) // aponta o eixo X local de a para b
    // As geometrias começam em x = 0 e vão até x = len: escalar X a partir do vértice = desenhar
    const core = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.08).translate(len / 2, 0, 0), coreMat)
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.35).translate(len / 2, 0, 0), neonMat)
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.4).translate(len / 2, 0, 0), glowMat)
    for (const m of [glow, neon, core]) {
      m.rotation.x = -Math.PI / 2 // deitado no chão
      edge.add(m)
    }
    edge.scale.x = 0.0001 // começa invisível (lado ainda não desenhado)
    group.add(edge)
    edges.push(edge)
  }
  // "Buraco" de terra no meio: círculo escuro que aparece quando a bike vai sair
  const hole = new THREE.Mesh(
    new THREE.CircleGeometry(1.15, 9),
    new THREE.MeshBasicMaterial({ color: '#120a06', transparent: true, opacity: 0, depthWrite: false }),
  )
  hole.rotation.x = -Math.PI / 2
  hole.position.y = -0.01
  group.add(hole)
  const light = new THREE.PointLight(INTRO.neonColor, 0, 14)
  light.position.set(0, 1.2, 0)
  group.add(light)
  scene.add(group)
  return { group, edges, hole, light, materials: [coreMat, glowMat, neonMat] }
}

/**
 * Toca a abertura completa. A bike deve estar travada (lockBike) no ponto de partida.
 * @param {import('../core/CameraRig.js').CameraRig} rig câmera do jogo
 * @returns {Promise<void>} resolve quando a bike terminou de sair da terra
 */
export function playIntro(rig) {
  const tri = buildTriangle()
  const speed = REDUCED_MOTION ? 0.35 : 1 // quem pediu menos animação vê tudo bem mais rápido
  const drawEach = (INTRO.drawSeconds / 3) * speed
  const rise = INTRO.riseSeconds * speed

  // Câmera de perto, olhando o triângulo; a bike começa enterrada e virada de costas
  rig.offset.set(0, 6.5, 8.5)
  rig.look.set(0, 0.2, -0.5)
  bike.rise = -1.9
  bike.heading = Math.PI
  bike.visualHeading = Math.PI

  return new Promise((resolve) => {
    const tl = gsap.timeline({ onComplete: resolve })
    // 1) desenha os três lados, um depois do outro
    tri.edges.forEach((edge) => tl.to(edge.scale, { x: 1, duration: drawEach, ease: 'power1.inOut' }))
    tl.to(tri.light, { intensity: 6, duration: drawEach * 3, ease: 'none' }, 0)
    // 2) clarão neon + terra se abrindo
    tl.to(tri.light, { intensity: 14, duration: 0.15, yoyo: true, repeat: 1 })
    tl.to(tri.hole.material, { opacity: 0.85, duration: 0.25 }, '<')
    tl.call(() => burstAt(0, 0, 36, ['#5a3d2b', '#7a5236', '#3b2a1e', PALETTE.lilac], 1.1))
    // 3) bike sobe girando (de costas para a frente) com um "quique" no fim
    tl.to(bike, { rise: 0, duration: rise, ease: 'back.out(1.6)' })
    tl.to(bike, { heading: 0, duration: rise, ease: 'power2.out' }, '<')
    tl.call(() => burstAt(0, 0, 18, ['#7a5236', PALETTE.white, PALETTE.violet], 0.7), null, '<0.15')
    // 4) a terra fecha, o neon fica fraco (marca do ponto de partida) e a câmera vai ao enquadramento normal
    tl.to(tri.hole.material, { opacity: 0, duration: 0.6 })
    tl.to(tri.light, { intensity: 1.5, duration: 0.8 }, '<')
    tl.to(tri.materials, { opacity: 0.35, duration: 0.8 }, '<')
    // tl.call (e não rig.frame direto): o enquadramento só pode começar NESTE ponto da sequência
    tl.call(() => rig.frame(rig.defaultView, 1.3 * speed, 'power2.inOut'), null, '<')
    tl.to({}, { duration: 1.3 * speed }) // espera a câmera chegar antes de liberar o jogo
  })
}
