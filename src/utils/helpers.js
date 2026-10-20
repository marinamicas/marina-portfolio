import * as THREE from 'three'
import { ROADS } from '../data/level.js'

export const rand = (a, b) => a + Math.random() * (b - a)
export const clamp = THREE.MathUtils.clamp
export const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches

export function distToSegment(px, pz, [ax, az], [bx, bz]) {
  const dx = bx - ax
  const dz = bz - az
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1)
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t))
}

export const nearRoad = (x, z, margin) => ROADS.some(([a, b]) => distToSegment(x, z, a, b) < margin)

// Menor diferença entre dois ângulos, em [-PI, PI]
export function angleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const escapeHTML = (s) => s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c])
