import * as THREE from 'three'
import { camera, scene, viewport } from '../core/stage.js'
import { PARTICLES } from '../data/level.js'
import { rand, REDUCED_MOTION } from '../utils/helpers.js'
import { toTexture } from '../utils/textures.js'
import { bike } from './bike.js'

/* ==========================================================================
   PARTÍCULAS DA BICICLETA — rastro de "poeira de papel" brilhante

   O que faz: enquanto a bike se move (arrastada com o dedo/mouse ou pedalando
   no teclado), solta partículas atrás dela. Cada partícula nasce com um
   tamanho sorteado e, ao longo da vida, ENCOLHE e fica TRANSPARENTE até sumir.

   Como funciona (visão geral):
   1. Na inicialização, reservamos memória para PARTICLES.max partículas de uma
      vez (um "pool"). Nunca criamos nem destruímos objetos durante o jogo: isso
      evita travadinhas do coletor de lixo e mantém o efeito leve no celular.
   2. Todas as partículas vivem em UMA única malha THREE.Points (um só draw call).
      Cada partícula é um "ponto" com atributos próprios: posição, tamanho, vida,
      cor e uma semente aleatória (usada para girar o desenho).
   3. A cada quadro, updateParticles() (chamado por src/main.js):
      - mede quanto a bike andou desde o quadro anterior;
      - solta novas partículas ao longo desse trecho (PARTICLES.perMeter por metro);
      - envelhece as vivas: move, freia, reduz a vida; quando a vida chega a 0, o
        ponto fica com tamanho 0 (invisível) e o espaço é reaproveitado.
   4. O desenho do ponto é feito por um shader (programa que roda na placa de vídeo):
      o tamanho na tela = tamanho em metros × vida × fator de perspectiva, e a
      transparência = vida² (some suavemente no fim).

   Dependências: stage.js (cena e câmera), bike.js (posição/direção da bike),
   level.js (PARTICLES), textures.js (toTexture), helpers.js (rand, REDUCED_MOTION).
   Usado por: src/main.js (loop do jogo).

   Onde mexer:
   - Quantidade, tamanho, cores, duração → objeto PARTICLES em src/data/level.js.
   - Formato do desenho da partícula → função makeSparkTexture() abaixo.
   - Curva de encolher/sumir → VERTEX_SHADER (gl_PointSize) e FRAGMENT_SHADER (alpha).
   ========================================================================== */

/** Quantidade de partículas do pool (com "menos animações" no sistema, metade). */
const COUNT = REDUCED_MOTION ? Math.ceil(PARTICLES.max / 2) : PARTICLES.max

/** Partículas por metro, reduzidas para quem pediu menos animação (acessibilidade). */
const PER_METER = REDUCED_MOTION ? PARTICLES.perMeter * 0.4 : PARTICLES.perMeter

/* ---------------- Dados de cada partícula (lado do JavaScript) ----------------
   Os arrays abaixo são "paralelos": o índice i representa a mesma partícula em todos.
   Eles são as cópias na CPU; a cada quadro copiamos os valores para os atributos
   da geometria (GPU) e marcamos needsUpdate = true. */
const positions = new Float32Array(COUNT * 3) // x, y, z por partícula (metros, coordenadas do mundo)
const sizes = new Float32Array(COUNT) // tamanho inicial em metros
const lifes = new Float32Array(COUNT) // vida restante: 1 = acabou de nascer, 0 = morta/invisível
const colors = new Float32Array(COUNT * 3) // r, g, b (0..1)
const seeds = new Float32Array(COUNT) // número aleatório 0..1 por partícula (rotação e variação)
const velocities = new Float32Array(COUNT * 3) // velocidade em m/s (só na CPU, o shader não precisa)
const decay = new Float32Array(COUNT) // quanto a vida cai por segundo (= 1 / duração)

/** Índice da próxima posição do pool a ser usada (anel: ao chegar no fim, volta ao começo). */
let cursor = 0

/** Metros percorridos ainda não "convertidos" em partículas (sobra fracionária entre quadros). */
let emitAcc = 0

/** Posição da bike no quadro anterior, para medir o deslocamento. null = sem referência (primeiro quadro / teleporte). */
let lastPos = null

/** Cores da configuração convertidas uma única vez para THREE.Color (evita converter a cada nascimento). */
const palette = PARTICLES.colors.map((c) => new THREE.Color(c))

/* ---------------- Textura: o desenho de UMA partícula ---------------- */

/**
 * Desenha a "faísca de papel" em um canvas 2D de 64×64 px e devolve como textura.
 * O desenho é um triângulo (a forma da colagem do site) preenchido com um
 * degradê radial: branco no centro, transparente nas bordas, para ter brilho suave.
 * A cor final de cada partícula é aplicada no shader (a textura é só a forma + brilho).
 * @returns {THREE.Texture}
 */
function makeSparkTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  // Degradê do centro (opaco) para a borda (transparente): dá a sensação de luz
  const glow = ctx.createRadialGradient(32, 34, 2, 32, 34, 30)
  glow.addColorStop(0, 'rgba(255,255,255,1)')
  glow.addColorStop(0.45, 'rgba(255,255,255,0.75)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  // Triângulo ocupando quase todo o canvas: ponta em cima, base embaixo
  ctx.beginPath()
  ctx.moveTo(32, 3)
  ctx.lineTo(61, 56)
  ctx.lineTo(3, 56)
  ctx.closePath()
  ctx.fillStyle = glow
  ctx.fill()
  // Miolo mais forte: um triângulo menor e totalmente branco no centro
  ctx.globalAlpha = 0.9
  ctx.beginPath()
  ctx.moveTo(32, 20)
  ctx.lineTo(44, 44)
  ctx.lineTo(20, 44)
  ctx.closePath()
  ctx.fillStyle = '#fff'
  ctx.fill()
  return toTexture(c)
}

/* ---------------- Shaders (programas da placa de vídeo) ----------------
   Vertex shader: roda uma vez por partícula e decide ONDE e com QUAL TAMANHO o ponto aparece.
   - aSize × vida → a partícula encolhe conforme a vida diminui.
   - uScale / distância → perspectiva: mais longe da câmera = menor na tela.
   - Partícula com vida 0 recebe tamanho 0 (não desenha nada, custo quase zero). */
const VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aLife;
  attribute vec3 aColor;
  attribute float aSeed;
  uniform float uScale;
  varying float vLife;
  varying vec3 vColor;
  varying float vSeed;
  void main() {
    vLife = aLife;
    vColor = aColor;
    vSeed = aSeed;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // ease-out: encolhe devagar no começo e rápido no fim (fica mais natural que linear)
    float shrink = aLife * (2.0 - aLife);
    gl_PointSize = aLife <= 0.0 ? 0.0 : aSize * shrink * uScale / max(-mv.z, 0.1);
    gl_Position = projectionMatrix * mv;
  }
`

/* Fragment shader: roda uma vez por pixel do ponto e decide a COR e a TRANSPARÊNCIA.
   - Gira as coordenadas da textura com base na semente e no tempo: cada partícula
     aparece com o triângulo em um ângulo diferente, rodando devagar.
   - alpha = textura × vida² → some suavemente (vida² cai mais rápido perto do fim). */
const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  varying float vLife;
  varying vec3 vColor;
  varying float vSeed;
  void main() {
    // gl_PointCoord vai de (0,0) a (1,1) dentro do ponto; centralizamos em (0,0) para girar
    vec2 p = gl_PointCoord - 0.5;
    float a = vSeed * 6.2831 + uTime * (0.5 + vSeed) * 2.0;
    float s = sin(a);
    float c = cos(a);
    vec2 r = vec2(p.x * c - p.y * s, p.x * s + p.y * c) + 0.5;
    vec4 tex = texture2D(uMap, r);
    float alpha = tex.a * vLife * vLife;
    if (alpha < 0.02) discard; // pixels quase invisíveis nem são desenhados
    gl_FragColor = vec4(vColor * tex.rgb, alpha);
  }
`

/* ---------------- Geometria e material (criados uma única vez) ---------------- */

/** Geometria com um "ponto" por partícula; cada atributo é um array da seção acima. */
const geometry = new THREE.BufferGeometry()
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
geometry.setAttribute('aLife', new THREE.BufferAttribute(lifes, 1))
geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))

/**
 * Material com os shaders acima.
 * - transparent + depthWrite false: partículas não "cortam" umas às outras nem a bike.
 * - blending aditivo (PARTICLES.additive): as cores se somam → brilho de faísca.
 */
const material = new THREE.ShaderMaterial({
  uniforms: {
    uMap: { value: makeSparkTexture() },
    uScale: { value: 300 }, // recalculado a cada quadro (depende da altura da tela e do FOV)
    uTime: { value: 0 },
  },
  vertexShader: VERTEX_SHADER,
  fragmentShader: FRAGMENT_SHADER,
  transparent: true,
  depthWrite: false,
  blending: PARTICLES.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
})

/** A malha única que contém todas as partículas. */
export const particles = new THREE.Points(geometry, material)
particles.frustumCulled = false // as posições mudam o tempo todo; não vale a pena recalcular o volume
particles.renderOrder = 2 // desenhada depois dos outros transparentes (recortes, bike)
particles.visible = PARTICLES.enabled
if (PARTICLES.enabled) scene.add(particles)

/* ---------------- Nascimento de uma partícula ---------------- */

/**
 * Faz nascer uma partícula em (x, y, z), reaproveitando a próxima vaga do pool.
 * Se o pool estiver cheio, a partícula mais antiga é substituída (é a próxima do anel).
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} dirX direção do movimento da bike no chão (vetor unitário)
 * @param {number} dirZ
 */
function spawn(x, y, z, dirX, dirZ) {
  const i = cursor
  cursor = (cursor + 1) % COUNT
  const i3 = i * 3
  positions[i3] = x
  positions[i3 + 1] = y
  positions[i3 + 2] = z
  // velocidade: para trás (sentido oposto ao movimento) + um pouco para os lados + para cima
  velocities[i3] = -dirX * PARTICLES.push + rand(-0.6, 0.6)
  velocities[i3 + 1] = rand(PARTICLES.rise[0], PARTICLES.rise[1])
  velocities[i3 + 2] = -dirZ * PARTICLES.push + rand(-0.6, 0.6)
  sizes[i] = rand(PARTICLES.size[0], PARTICLES.size[1])
  lifes[i] = 1
  decay[i] = 1 / rand(PARTICLES.life[0], PARTICLES.life[1])
  seeds[i] = Math.random()
  const color = palette[Math.floor(Math.random() * palette.length)]
  colors[i3] = color.r
  colors[i3 + 1] = color.g
  colors[i3 + 2] = color.b
}

/**
 * Explosão de partículas num ponto (usada na abertura: "terra" voando quando a bike sai
 * do chão, e nas batidas). Reaproveita o mesmo pool do rastro, com cores e força próprias.
 * @param {number} x posição no chão
 * @param {number} z
 * @param {number} count quantidade de partículas
 * @param {string[]} colorList cores (#RRGGBB) sorteadas por partícula
 * @param {number} [power=1] força da explosão (1 = padrão; 2 = o dobro da velocidade)
 */
export function burstAt(x, z, count, colorList, power = 1) {
  if (!PARTICLES.enabled) return
  const list = colorList.map((c) => new THREE.Color(c))
  for (let n = 0; n < count; n++) {
    const a = Math.random() * Math.PI * 2
    spawn(x + Math.cos(a) * rand(0, 0.8), rand(0.05, 0.3), z + Math.sin(a) * rand(0, 0.8), 0, 0)
    const i = (cursor - 1 + COUNT) % COUNT // índice da partícula que acabou de nascer
    const i3 = i * 3
    const speed = rand(1.5, 4.5) * power
    velocities[i3] = Math.cos(a) * speed
    velocities[i3 + 1] = rand(2, 5.5) * power
    velocities[i3 + 2] = Math.sin(a) * speed
    sizes[i] = rand(0.25, 0.6)
    decay[i] = 1 / rand(0.7, 1.5)
    const color = list[n % list.length]
    colors[i3] = color.r
    colors[i3 + 1] = color.g
    colors[i3 + 2] = color.b
  }
}

/**
 * Esquece a posição anterior da bike. Chame depois de teleportes (rebobinar, viagens
 * do inventário) para o rastro não "riscar" a tela de um ponto ao outro.
 * Também é chamado automaticamente quando a bike está travada (bike.locked).
 */
export function resetParticleTrail() {
  lastPos = null
  emitAcc = 0
}

/* ---------------- Atualização por quadro ---------------- */

/**
 * Chamado uma vez por quadro por src/main.js, depois que a posição da bike já foi
 * atualizada. `dt` é o tempo REAL do quadro em segundos (não o tempo em câmera lenta),
 * `time` é o relógio do jogo em segundos (para girar o desenho das partículas).
 * @param {number} dt
 * @param {number} time
 */
export function updateParticles(dt, time) {
  if (!PARTICLES.enabled || dt <= 0) return
  const p = bike.body.position

  /* 1) Emissão: quanto a bike andou desde o último quadro? */
  if (bike.locked) {
    // intro, rebobinar, viagens: a bike é teletransportada, não "anda"
    lastPos = null
  } else if (!lastPos) {
    lastPos = { x: p.x, z: p.z }
  } else {
    const dx = p.x - lastPos.x
    const dz = p.z - lastPos.z
    const dist = Math.hypot(dx, dz)
    const speed = dist / dt
    if (speed >= PARTICLES.minSpeed) {
      emitAcc += dist * PER_METER
      const dirX = dx / dist // direção do movimento (unitária), para soltar as partículas atrás
      const dirZ = dz / dist
      let n = Math.min(Math.floor(emitAcc), PARTICLES.maxPerFrame)
      emitAcc -= n
      if (emitAcc > PARTICLES.maxPerFrame) emitAcc = 0 // descarta o excesso de um salto muito grande
      while (n-- > 0) {
        // espalha ao longo do trecho percorrido neste quadro (arrastes rápidos deixam rastro contínuo)
        const t = Math.random()
        const back = rand(PARTICLES.behind[0], PARTICLES.behind[1])
        const side = rand(-PARTICLES.spread, PARTICLES.spread)
        const x = lastPos.x + dx * t - dirX * back - dirZ * side
        const z = lastPos.z + dz * t - dirZ * back + dirX * side
        spawn(x, rand(0.05, 0.45), z, dirX, dirZ)
      }
    } else {
      emitAcc = 0 // parada: zera a sobra para não "cuspir" partículas ao voltar a andar
    }
    lastPos.x = p.x
    lastPos.z = p.z
  }

  /* 2) Envelhecimento: move, freia e reduz a vida de todas as partículas vivas */
  const brake = Math.exp(-PARTICLES.drag * dt) // freio exponencial: independe da taxa de quadros
  for (let i = 0; i < COUNT; i++) {
    if (lifes[i] <= 0) continue
    const i3 = i * 3
    positions[i3] += velocities[i3] * dt
    positions[i3 + 1] += velocities[i3 + 1] * dt
    positions[i3 + 2] += velocities[i3 + 2] * dt
    velocities[i3] *= brake
    velocities[i3 + 1] *= brake
    velocities[i3 + 2] *= brake
    lifes[i] = Math.max(0, lifes[i] - decay[i] * dt)
  }
  geometry.attributes.position.needsUpdate = true
  geometry.attributes.aLife.needsUpdate = true
  geometry.attributes.aSize.needsUpdate = true
  geometry.attributes.aColor.needsUpdate = true
  geometry.attributes.aSeed.needsUpdate = true

  /* 3) Uniforms: fator de perspectiva (altura da tela em pixels físicos ÷ abertura da câmera) e relógio */
  const fovRad = (camera.fov * Math.PI) / 180
  material.uniforms.uScale.value = (viewport.height * Math.min(devicePixelRatio, 2)) / (2 * Math.tan(fovRad / 2))
  material.uniforms.uTime.value = time
}
