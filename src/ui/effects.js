import gsap from 'gsap'
import { PALETTE } from '../data/level.js'
import { rand, REDUCED_MOTION } from '../utils/helpers.js'

/* Efeitos visuais em HTML por cima do 3D: avisos rápidos e papeizinhos voando. */

// Linha do tempo do aviso atual: um aviso novo cancela o anterior
let toastTl = null
/** Mostra um aviso roxo embaixo da tela por `seconds` segundos. */
export function toast(message, seconds = 3.5) {
  const el = document.querySelector('#toast')
  el.textContent = message
  toastTl?.kill()
  toastTl = gsap
    .timeline()
    .fromTo(el, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.4 })
    .to(el, { autoAlpha: 0, duration: 0.4 }, `+=${seconds}`)
}

// Partículas triangulares voando pela tela (camada DOM, por cima do 3D)
export function paperBurst(cx, cy) {
  const colors = [PALETTE.white, PALETTE.purple, PALETTE.lilac, PALETTE.black]
  const count = REDUCED_MOTION ? 10 : 40
  for (let i = 0; i < count; i++) {
    const el = document.createElement('i')
    el.className = 'paper-bit'
    el.style.background = colors[i % colors.length]
    document.body.appendChild(el)
    gsap.fromTo(
      el,
      { x: cx, y: cy, scale: rand(0.5, 1.6), rotation: 0 },
      {
        x: cx + rand(-0.6, 0.6) * innerWidth,
        y: cy + rand(-0.7, 0.4) * innerHeight,
        rotation: rand(-720, 720),
        autoAlpha: 0,
        duration: rand(1, 1.8),
        ease: 'power3.out',
        onComplete: () => el.remove(),
      },
    )
  }
}
