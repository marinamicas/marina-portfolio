import * as THREE from 'three'
import { PALETTE } from '../data/level.js'

/* ==========================================================================
   PALCO 3D — renderer WebGL, cena, câmera, luzes e a ÁREA DO CANVAS

   Tudo o que aparece no mundo 3D é adicionado à `scene` criada aqui. Este
   módulo também cuida do redimensionamento e do fallback quando o navegador
   não consegue criar o WebGL (mostra o aviso #no-webgl).

   Área do canvas: o canvas NÃO ocupa a tela inteira. Ele começa logo abaixo do
   cabeçalho (contatos + barra de conhecimento + vidas), que tem fundo sólido e
   nunca é coberto pelo jogo. A altura do cabeçalho é medida aqui (ResizeObserver)
   e gravada na variável CSS --hud-h, que o main.css usa para posicionar o canvas,
   a foto do céu, as janelas presas no chão e a chuva do rebobinar.

   Por isso, para converter entre o mundo 3D e a tela, use SEMPRE as funções
   worldToScreen() e screenToNdc() abaixo (elas descontam o cabeçalho), e não
   innerWidth/innerHeight.

   Dependências: level.js (PALETTE).
   Usado por: todos os módulos de src/world, src/ui/pins.js, src/ui/profile.js,
   src/core/pointerControls.js, src/world/particles.js, main.js (render).

   Onde mexer:
   - Cor do fundo e alcance da neblina → scene.background / scene.fog.
   - Abertura da câmera (FOV) → função fovFor().
   - Intensidade/cor das luzes → HemisphereLight e DirectionalLight.
   - Nitidez x desempenho → setPixelRatio (limite 2).
   ========================================================================== */

/** O <canvas class="webgl"> do index.html: o Three.js desenha tudo nele. */
export const canvas = document.querySelector('canvas.webgl')
/** Cabeçalho fixo (contatos, barra e vidas). O canvas começa logo abaixo dele. */
const header = document.querySelector('.hud-header')

/**
 * Retângulo atual do canvas na tela, em pixels CSS (atualizado a cada resize).
 * - left, top:     canto superior esquerdo (top = altura do cabeçalho)
 * - width, height: tamanho da área do jogo
 */
export const viewport = { left: 0, top: 0, width: innerWidth, height: innerHeight }

/** Mede o canvas de verdade (getBoundingClientRect) e guarda em `viewport`. */
function measureViewport() {
  const r = canvas.getBoundingClientRect()
  viewport.left = r.left
  viewport.top = r.top
  viewport.width = Math.max(1, r.width)
  viewport.height = Math.max(1, r.height)
}

/**
 * Configurações de renderer tentadas em ordem, da mais bonita para a mais compatível
 * (placas de vídeo fracas, computadores corporativos, aceleração de hardware limitada).
 * - antialias: suaviza as bordas (custa desempenho).
 * - powerPreference: pede a GPU mais forte ('high-performance') ou a que gasta menos bateria.
 * - failIfMajorPerformanceCaveat false: aceita até renderização por software.
 */
const RENDERER_OPTIONS = [
  { antialias: true, powerPreference: 'high-performance' },
  { antialias: false },
  { antialias: false, failIfMajorPerformanceCaveat: false, powerPreference: 'low-power' },
]

/**
 * Cria o renderer tentando cada configuração de RENDERER_OPTIONS. Se nenhuma funcionar,
 * esconde a tela de carregamento, mostra o aviso de WebGL e relança o erro (o jogo não inicia).
 * @returns {THREE.WebGLRenderer}
 */
function createRenderer() {
  let lastError
  for (const options of RENDERER_OPTIONS) {
    try {
      return new THREE.WebGLRenderer({ canvas, ...options })
    } catch (error) {
      lastError = error
      console.warn('[portfolio] WebGL indisponível com', options, error)
    }
  }
  document.querySelector('#no-webgl').classList.remove('hidden')
  document.querySelector('#start-screen')?.classList.add('hidden')
  throw lastError
}

/** Renderer WebGL único do jogo. */
export const renderer = createRenderer()
renderer.outputColorSpace = THREE.SRGBColorSpace // cores iguais às do CSS/imagens

/** A cena: todos os objetos 3D (chão, recortes, bike, partículas…) são adicionados aqui. */
export const scene = new THREE.Scene()
// Fundo noturno e neblina: o mapa "some" no escuro ao longe, como papel sobre fundo preto.
// Fog(cor, perto, longe): começa a esmaecer a 45 m da câmera e fica 100% na cor a 150 m.
scene.background = new THREE.Color(PALETTE.black)
scene.fog = new THREE.Fog(PALETTE.black, 45, 150)

/**
 * Abertura vertical da câmera (FOV, em graus) conforme a proporção da tela.
 * Em telas verticais (celular, aspect < 1) o FOV abre até 58° para não "espremer" o mundo
 * nas laterais; em telas largas fica em 40° (mais cinematográfico).
 * @param {number} aspect largura ÷ altura da área do jogo
 */
const fovFor = (aspect) => (aspect < 1 ? THREE.MathUtils.lerp(58, 40, aspect) : 40)

/** Câmera em perspectiva: FOV calculado no resize, vê de 0,1 m até 500 m. */
export const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500)

// Luz ambiente (céu branco, chão roxo) + um "sol" direcional para dar volume aos prismas e árvores.
// HemisphereLight(cor de cima, cor de baixo, intensidade); DirectionalLight(cor, intensidade).
scene.add(new THREE.HemisphereLight(PALETTE.white, PALETTE.purple, 1.4))
const sun = new THREE.DirectionalLight(PALETTE.white, 1.2)
sun.position.set(20, 40, 10) // de onde a luz vem (a direção é posição → origem)
scene.add(sun)

/**
 * Recortes 2D que giram no eixo Y para sempre encarar a câmera ("billboards").
 * Cada módulo adiciona seus objetos aqui; main.js aplica rig.yaw a todos a cada quadro.
 */
export const billboards = []

/* ---------------- Conversões mundo ↔ tela ---------------- */

const _v = new THREE.Vector3() // vetor reaproveitado (evita criar objetos a cada chamada)

/**
 * Converte um ponto do mundo 3D para pixels da JANELA (coordenadas de position: fixed).
 * @param {{x:number,y:number,z:number}} point ponto no mundo
 * @returns {{x:number, y:number, behind:boolean, ndc:THREE.Vector3}} behind = ponto atrás da câmera
 */
export function worldToScreen(point) {
  _v.set(point.x, point.y, point.z).project(camera)
  return {
    x: viewport.left + ((_v.x + 1) / 2) * viewport.width,
    y: viewport.top + ((1 - _v.y) / 2) * viewport.height,
    behind: _v.z > 1,
    ndc: _v,
  }
}

/**
 * Converte pixels da janela (ex.: e.clientX/clientY) para coordenadas normalizadas
 * do canvas (-1 a 1), usadas pelo Raycaster.
 * @param {number} x
 * @param {number} y
 * @param {THREE.Vector2} out vetor onde o resultado é escrito
 * @returns {THREE.Vector2}
 */
export function screenToNdc(x, y, out) {
  return out.set(((x - viewport.left) / viewport.width) * 2 - 1, -((y - viewport.top) / viewport.height) * 2 + 1)
}

/* ---------------- Redimensionamento ---------------- */

/**
 * Ajusta tudo ao tamanho atual: grava a altura do cabeçalho em --hud-h, mede o canvas,
 * atualiza proporção/FOV da câmera, densidade de pixels e tamanho do desenho do renderer.
 * `setSize(..., false)`: o tamanho VISUAL do canvas vem do CSS (top: var(--hud-h)); aqui
 * só mudamos a resolução interna.
 */
function applyResize() {
  resizeQueued = false
  document.documentElement.style.setProperty('--hud-h', `${Math.round(header?.offsetHeight ?? 0)}px`)
  measureViewport()
  camera.aspect = viewport.width / viewport.height
  camera.fov = fovFor(camera.aspect)
  camera.updateProjectionMatrix() // obrigatório depois de mudar aspect/fov
  // Densidade de pixels limitada a 2: telas 3x (celulares top) ficam nítidas sem pesar
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setSize(viewport.width, viewport.height, false)
  dispatchEvent(new CustomEvent('viewport-change')) // avisa profile.js, matrix.js etc.
}

/** true enquanto há um ajuste de tamanho agendado para o próximo quadro. */
let resizeQueued = false
/** Agenda um único applyResize para o próximo quadro (agrupa vários eventos seguidos). */
function queueResize() {
  if (resizeQueued) return
  resizeQueued = true
  requestAnimationFrame(applyResize)
}
// No celular, a barra do navegador aparecendo/sumindo dispara vários "resize" seguidos:
// agrupamos tudo em um único ajuste no próximo frame. passive: não vamos chamar preventDefault.
addEventListener('resize', queueResize, { passive: true })
// O cabeçalho pode mudar de altura sem a janela mudar (texto do contador quebrando linha,
// fonte carregando…): o ResizeObserver percebe e reajusta o canvas.
if (header && 'ResizeObserver' in window) new ResizeObserver(queueResize).observe(header)
// Primeiro ajuste imediato, para a câmera já nascer com a proporção certa
applyResize()
