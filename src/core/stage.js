import * as THREE from 'three'
import { PALETTE } from '../data/level.js'

/*
  Palco 3D: renderer WebGL, cena, câmera e luzes. Todo o resto do jogo
  adiciona objetos nesta cena.
*/

export const canvas = document.querySelector('canvas.webgl')

// Tenta da configuração mais bonita para a mais compatível (placas de vídeo fracas,
// computadores corporativos, aceleração de hardware limitada)
const RENDERER_OPTIONS = [
  { antialias: true, powerPreference: 'high-performance' },
  { antialias: false },
  { antialias: false, failIfMajorPerformanceCaveat: false, powerPreference: 'low-power' },
]

/** Cria o renderer; se nenhuma configuração funcionar, mostra o aviso de WebGL. */
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

export const renderer = createRenderer()
// Densidade de pixels limitada a 2: telas 3x (celulares top) ficam nítidas sem pesar
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace

// Fundo preto e neblina: o mapa "some" no escuro ao longe, como papel sobre fundo preto
export const scene = new THREE.Scene()
scene.background = new THREE.Color(PALETTE.black)
scene.fog = new THREE.Fog(PALETTE.black, 45, 150)

// Em telas verticais (celular) o FOV abre para não "espremer" o mundo nas laterais
const fovFor = (aspect) => (aspect < 1 ? THREE.MathUtils.lerp(58, 40, aspect) : 40)
export const camera = new THREE.PerspectiveCamera(fovFor(innerWidth / innerHeight), innerWidth / innerHeight, 0.1, 500)

// Luz ambiente (céu branco, chão roxo) + um "sol" direcional para dar volume aos prismas
scene.add(new THREE.HemisphereLight(PALETTE.white, PALETTE.purple, 1.4))
const sun = new THREE.DirectionalLight(PALETTE.white, 1.2)
sun.position.set(20, 40, 10)
scene.add(sun)

// Recortes 2D que giram no eixo Y para sempre encarar a câmera
export const billboards = []

// Ajusta câmera e renderer ao novo tamanho da janela
function applyResize() {
  resizeQueued = false
  camera.aspect = innerWidth / innerHeight
  camera.fov = fovFor(camera.aspect)
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setSize(innerWidth, innerHeight)
}

// No celular, a barra do navegador aparecendo/sumindo dispara vários "resize" seguidos.
// Agrupamos tudo em um único ajuste no próximo frame (requestAnimationFrame).
let resizeQueued = false
addEventListener(
  'resize',
  () => {
    if (resizeQueued) return
    resizeQueued = true
    requestAnimationFrame(applyResize)
  },
  { passive: true },
)
