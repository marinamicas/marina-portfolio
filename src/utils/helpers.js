import * as THREE from 'three'
import { ROADS } from '../data/level.js'

/* Funções utilitárias usadas em vários módulos. */

// Número aleatório entre a e b
export const rand = (a, b) => a + Math.random() * (b - a)
// Limita um valor entre mínimo e máximo
export const clamp = THREE.MathUtils.clamp
// true se o visitante pediu menos animações nas configurações do sistema (acessibilidade)
export const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches

// Distância de um ponto (px, pz) até o segmento de reta A→B no chão
export function distToSegment(px, pz, [ax, az], [bx, bz]) {
  const dx = bx - ax
  const dz = bz - az
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1)
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t))
}

// true se o ponto (x, z) está a menos de `margin` metros de alguma rua
export const nearRoad = (x, z, margin) => ROADS.some(([a, b]) => distToSegment(x, z, a, b) < margin)

// Menor diferença entre dois ângulos, em [-PI, PI]
export function angleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

// Escapa caracteres especiais para inserir texto com segurança dentro de HTML
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const escapeHTML = (s) => s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c])
