import * as THREE from 'three'
import gsap from 'gsap'
import { camera } from '../core/stage.js'
import { markLink } from '../core/state.js'
import { GROUPS, ROAD_WIDTH } from '../data/level.js'
import { clamp, escapeHTML } from '../utils/helpers.js'

/*
  Depois de atropelado, cada recorte deixa uma janela "presa" no chão, ao lado
  do ponto onde ele estava. É HTML de verdade (links clicáveis) reposicionado
  a cada frame a partir da projeção 3D → tela.
*/
const MAX_DIST = 55 // além disso a janela some (evita poluir o horizonte)
const FADE_DIST = 40

export const linksHTML = (item) =>
  item.links
    .map((l) => `<a class="btn" href="${encodeURI(l.url)}" target="_blank" rel="noopener" data-link-id="${item.id}">${escapeHTML(l.label)} ↗</a>`)
    .join('')

const layer = document.createElement('div')
layer.className = 'pins'
document.body.appendChild(layer)

layer.addEventListener('click', (e) => {
  const link = e.target.closest('[data-link-id]')
  if (!link) return
  markLink(link.dataset.linkId)
  link.blur() // o teclado volta a pilotar a bike
})

const pins = new Map()
const v = new THREE.Vector3()

function createPin(totem) {
  const { item } = totem
  const el = document.createElement('div')
  el.className = 'pin'
  el.innerHTML = `<article class="pin-card">
      <p class="tag">${GROUPS[item.group].label}</p>
      <h3>${escapeHTML(item.title)}</h3>
      <p>${escapeHTML(item.body)}</p>
      <div class="actions">${linksHTML(item)}</div>
    </article>`
  layer.appendChild(el)
  const [x, z] = item.position
  // na beira da rua, para não cobrir a bike quando ela passa pelo local
  const anchor = new THREE.Vector3(x + ROAD_WIDTH / 2 + 0.5, 0, z)
  const pin = { el, card: el.firstElementChild, anchor, shown: false }
  pins.set(item.id, pin)
  return pin
}

/** Fixa a janela do recorte no chão (recortes com texto 3D próprio, como a intro, não têm). */
export function showPin(totem, delay = 0) {
  if (totem.item.reveal) return
  const pin = pins.get(totem.item.id) ?? createPin(totem)
  if (pin.shown) return
  pin.shown = true
  gsap.fromTo(pin.card, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.6, delay, ease: 'back.out(1.6)', overwrite: true })
}

/** Remove a janela quando o recorte é remontado (rebobinar para o início). */
export function hidePin(totem) {
  const pin = pins.get(totem.item.id)
  if (!pin?.shown) return
  pin.shown = false
  gsap.to(pin.card, { autoAlpha: 0, y: 30, duration: 0.3, overwrite: true, onComplete: () => (pin.el.style.display = 'none') })
}

/** Chamar depois do render: a câmera já está com as matrizes do frame. */
export function updatePins() {
  for (const pin of pins.values()) {
    if (!pin.shown && pin.card.style.visibility === 'hidden') continue
    const dist = camera.position.distanceTo(pin.anchor)
    v.copy(pin.anchor).project(camera)
    const onScreen = v.z < 1 && Math.abs(v.x) < 1.3 && v.y > -1.3 && v.y < 2.5
    if (!onScreen || dist > MAX_DIST) {
      pin.el.style.display = 'none'
      continue
    }
    pin.el.style.display = ''
    pin.el.style.opacity = clamp((MAX_DIST - dist) / (MAX_DIST - FADE_DIST), 0, 1)
    pin.el.style.transform = `translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px)`
    pin.card.style.scale = clamp(16 / dist, 0.55, 1)
    pin.el.style.zIndex = String(1000 - Math.round(dist)) // a mais próxima fica por cima
  }
}
