import { canvas } from './stage.js'
import { clamp } from '../utils/helpers.js'

export const input = { forward: 0, turn: 0, boost: false }

const keys = new Set()
addEventListener('keydown', (e) => {
  if (e.code.startsWith('Arrow')) e.preventDefault()
  keys.add(e.code)
})
addEventListener('keyup', (e) => keys.delete(e.code))
addEventListener('blur', () => keys.clear())

// Joystick virtual: arrastar na tela (celular ou mouse)
const joy = { active: false, x0: 0, y0: 0, fwd: 0, turn: 0 }
canvas.addEventListener('pointerdown', (e) => {
  Object.assign(joy, { active: true, x0: e.clientX, y0: e.clientY })
  canvas.setPointerCapture(e.pointerId)
})
canvas.addEventListener('pointermove', (e) => {
  if (!joy.active) return
  joy.turn = clamp(-(e.clientX - joy.x0) / 60, -1, 1)
  joy.fwd = clamp(-(e.clientY - joy.y0) / 60, -1, 1)
})
const endJoy = () => Object.assign(joy, { active: false, fwd: 0, turn: 0 })
canvas.addEventListener('pointerup', endJoy)
canvas.addEventListener('pointercancel', endJoy)

export function readInput(blocked) {
  if (blocked) return Object.assign(input, { forward: 0, turn: 0, boost: false })
  const k = (...codes) => codes.some((c) => keys.has(c))
  input.forward = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown') || joy.fwd
  input.turn = k('KeyA', 'ArrowLeft') - k('KeyD', 'ArrowRight') || joy.turn
  input.boost = k('ShiftLeft', 'ShiftRight')
  return input
}
