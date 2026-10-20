import * as THREE from 'three'
import { PALETTE } from '../data/level.js'

export const canvas = document.querySelector('canvas.webgl')

function createRenderer() {
  try {
    return new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  } catch (error) {
    document.querySelector('#no-webgl').classList.remove('hidden')
    document.querySelector('#start-screen').classList.add('hidden')
    throw error
  }
}

export const renderer = createRenderer()
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace

export const scene = new THREE.Scene()
scene.background = new THREE.Color(PALETTE.black)
scene.fog = new THREE.Fog(PALETTE.black, 45, 150)

// Em telas verticais (celular) o FOV abre para não "espremer" o mundo nas laterais
const fovFor = (aspect) => (aspect < 1 ? THREE.MathUtils.lerp(58, 40, aspect) : 40)
export const camera = new THREE.PerspectiveCamera(fovFor(innerWidth / innerHeight), innerWidth / innerHeight, 0.1, 500)

scene.add(new THREE.HemisphereLight(PALETTE.white, PALETTE.purple, 1.4))
const sun = new THREE.DirectionalLight(PALETTE.white, 1.2)
sun.position.set(20, 40, 10)
scene.add(sun)

// Recortes 2D que giram no eixo Y para sempre encarar a câmera
export const billboards = []

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.fov = fovFor(camera.aspect)
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
})
