import * as THREE from 'three'
import { PALETTE } from '../data/level.js'

/* ==========================================================================
   PALCO 3D — renderer WebGL, cena, câmera e luzes

   Tudo o que aparece no mundo 3D é adicionado à `scene` criada aqui. Este
   módulo também cuida do redimensionamento da janela e do fallback quando o
   navegador não consegue criar o WebGL (mostra o aviso #no-webgl).

   Dependências: level.js (PALETTE).
   Usado por: todos os módulos de src/world, src/ui/pins.js (câmera), src/core/
   pointerControls.js (câmera e canvas), src/world/particles.js, main.js (render).

   Onde mexer:
   - Cor do fundo e alcance da neblina → scene.background / scene.fog.
   - Abertura da câmera (FOV) → função fovFor().
   - Intensidade/cor das luzes → HemisphereLight e DirectionalLight.
   - Nitidez x desempenho → setPixelRatio (limite 2).
   Observação: a foto de perfil "no céu" NÃO fica nesta cena. Como a câmera
   olha para baixo e o céu quase não aparece, ela é uma camada HTML fixa por
   cima do canvas (src/ui/profile.js), em modo de mistura que parece fundo.
   ========================================================================== */

/** O <canvas class="webgl"> do index.html: o Three.js desenha tudo nele. */
export const canvas = document.querySelector('canvas.webgl')

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
 * esconde a tela inicial, mostra o aviso de WebGL e relança o erro (o jogo não inicia).
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
  document.querySelector('#start-screen').classList.add('hidden')
  throw lastError
}

/** Renderer WebGL único do jogo. */
export const renderer = createRenderer()
// Densidade de pixels limitada a 2: telas 3x (celulares top) ficam nítidas sem pesar
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace // cores iguais às do CSS/imagens

/** A cena: todos os objetos 3D (chão, recortes, bike, partículas…) são adicionados aqui. */
export const scene = new THREE.Scene()
// Fundo preto e neblina: o mapa "some" no escuro ao longe, como papel sobre fundo preto.
// Fog(cor, perto, longe): começa a esmaecer a 45 m da câmera e fica 100% na cor a 150 m.
scene.background = new THREE.Color(PALETTE.black)
scene.fog = new THREE.Fog(PALETTE.black, 45, 150)

/**
 * Abertura vertical da câmera (FOV, em graus) conforme a proporção da tela.
 * Em telas verticais (celular, aspect < 1) o FOV abre até 58° para não "espremer" o mundo
 * nas laterais; em telas largas fica em 40° (mais cinematográfico).
 * @param {number} aspect largura ÷ altura da janela
 */
const fovFor = (aspect) => (aspect < 1 ? THREE.MathUtils.lerp(58, 40, aspect) : 40)

/** Câmera em perspectiva: FOV calculado acima, proporção da janela, vê de 0,1 m até 500 m. */
export const camera = new THREE.PerspectiveCamera(fovFor(innerWidth / innerHeight), innerWidth / innerHeight, 0.1, 500)

// Luz ambiente (céu branco, chão roxo) + um "sol" direcional para dar volume aos prismas.
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

/**
 * Ajusta câmera e renderer ao novo tamanho da janela: proporção, FOV, densidade de pixels
 * e tamanho do canvas. Chamada no próximo quadro depois de um 'resize'.
 */
function applyResize() {
  resizeQueued = false
  camera.aspect = innerWidth / innerHeight
  camera.fov = fovFor(camera.aspect)
  camera.updateProjectionMatrix() // obrigatório depois de mudar aspect/fov
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setSize(innerWidth, innerHeight)
}

/** true enquanto há um ajuste de tamanho agendado para o próximo quadro. */
let resizeQueued = false
// No celular, a barra do navegador aparecendo/sumindo dispara vários "resize" seguidos.
// Agrupamos tudo em um único ajuste no próximo frame (requestAnimationFrame).
// passive: true avisa o navegador que não vamos chamar preventDefault (rolagem mais fluida).
addEventListener(
  'resize',
  () => {
    if (resizeQueued) return
    resizeQueued = true
    requestAnimationFrame(applyResize)
  },
  { passive: true },
)
