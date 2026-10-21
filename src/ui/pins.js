import * as THREE from 'three'
import gsap from 'gsap'
import { camera } from '../core/stage.js'
import { markLink } from '../core/state.js'
import { GROUPS, ROAD_WIDTH } from '../data/level.js'
import { clamp, escapeHTML } from '../utils/helpers.js'

/* ==========================================================================
   JANELAS PRESAS NO CHÃO (pins)

   Papel deste arquivo: depois que um recorte é atropelado, deixar uma versão
   pequena da janela dele "presa" no chão, ao lado de onde ele estava, com o
   botão "Saiba mais" clicável a qualquer momento.

   Como é feito: cada pin é HTML de verdade (um <div class="pin"> dentro de uma
   camada fixa .pins que cobre a tela). A cada frame, o ponto 3D do chão onde o
   pin está (anchor) é projetado para coordenadas de tela com a câmera, e o
   elemento é movido para lá com transform: translate(). Longe da câmera o pin
   encolhe e fica transparente; fora da tela ou muito longe, some.

   Depende de: three (projeção), gsap (animações), camera de stage.js,
   markLink de state.js, GROUPS/ROAD_WIDTH de level.js, helpers.
   Quem usa: main.js (showPin ao atropelar e ao recarregar; updatePins a cada
   frame), timeMachine.js (hidePin ao resetar), screens.js (linksHTML).
   Aparência: bloco "Janelas presas no chão" em src/styles/main.css.

   Onde mexer:
   - MAX_DIST / FADE_DIST: até que distância (metros) o pin aparece e onde começa a sumir.
   - createPin → `anchor`: lado da rua em que o pin fica (troque + por - antes de ROAD_WIDTH).
   - updatePins → `clamp(16 / dist, 0.55, 1)`: escala mínima (0,55) e máxima (1) do cartão.
   ========================================================================== */

// Além desta distância (metros entre a câmera e o pin) a janela some (evita poluir o horizonte)
const MAX_DIST = 55
// A partir desta distância o pin começa a ficar transparente (fade até MAX_DIST)
const FADE_DIST = 40

/**
 * Gera o HTML dos botões "saiba mais" de um item: um <a class="btn"> por link,
 * com data-link-id para o inventário marcar "visitado" ao clicar.
 * Também é usado por screens.js nas janelas grandes.
 * @param {object} item item de ITEMS (data/level.js)
 * @returns {string} HTML
 */
export const linksHTML = (item) =>
  item.links
    .map((l) => `<a class="btn" href="${encodeURI(l.url)}" data-link-id="${item.id}">${escapeHTML(l.label)} ↗</a>`)
    .join('')

// Camada fixa que cobre a tela e contém todos os pins (criada uma vez, no carregamento)
const layer = document.createElement('div')
layer.className = 'pins'
document.body.appendChild(layer)

// Clique em qualquer "Saiba mais" de qualquer pin (delegação na camada): marca o link
// como visitado no progresso. O viewer.js intercepta o mesmo clique (fase de captura)
// para abrir o link no visualizador em tela cheia; aqui só registramos a visita.
layer.addEventListener('click', (e) => {
  const link = e.target.closest('[data-link-id]')
  if (!link) return
  markLink(link.dataset.linkId)
  link.blur() // o teclado volta a pilotar a bike
})

/**
 * Pins já criados: id do item → { el, card, anchor, shown }.
 * - el:     o <div class="pin"> posicionado na tela
 * - card:   o <article class="pin-card"> (o cartão em si, que anima e escala)
 * - anchor: ponto 3D no chão que o pin acompanha
 * - shown:  true = o pin deve aparecer; false = escondido (recorte remontado)
 */
const pins = new Map()
// Vetor reaproveitado para projetar o anchor na tela (evita criar um novo a cada frame)
const v = new THREE.Vector3()

/**
 * Cria o HTML de um pin e o registra no mapa `pins` (sem mostrar ainda).
 *
 * O ponto de ancoragem fica na beira direita da rua (x + metade da largura da
 * rua + 0,5 m), para não cobrir a bike quando ela passa pelo lugar do recorte.
 * @param {object} totem totem de world/totems.js
 * @returns {object} o pin criado
 */
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

/**
 * Fixa a janela do recorte no chão (recortes com texto 3D próprio, como a
 * intro, não têm). Cria o pin na primeira vez, reaproveita nas seguintes.
 * Se já está visível, não faz nada. A animação sobe o cartão 30 px aparecendo,
 * com "quique" (back.out), depois de `delay` segundos.
 * @param {object} totem
 * @param {number} [delay=0] atraso em segundos (main.js usa 1 s depois do atropelo)
 */
export function showPin(totem, delay = 0) {
  if (totem.item.reveal) return
  const pin = pins.get(totem.item.id) ?? createPin(totem)
  if (pin.shown) return
  pin.shown = true
  gsap.fromTo(pin.card, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.6, delay, ease: 'back.out(1.6)', overwrite: true })
}

/**
 * Remove a janela quando o recorte é remontado (resetar tudo). Anima o cartão
 * descendo e sumindo em 0,3 s e depois esconde o elemento inteiro.
 * @param {object} totem
 */
export function hidePin(totem) {
  const pin = pins.get(totem.item.id)
  if (!pin?.shown) return
  pin.shown = false
  gsap.to(pin.card, { autoAlpha: 0, y: 30, duration: 0.3, overwrite: true, onComplete: () => (pin.el.style.display = 'none') })
}

/**
 * Reposiciona todos os pins na tela. Chamar DEPOIS do render de cada frame:
 * a câmera já está com as matrizes atualizadas.
 *
 * Para cada pin:
 * 1. pula os que estão escondidos e já invisíveis (economiza trabalho);
 * 2. mede a distância câmera → anchor;
 * 3. projeta o anchor em coordenadas normalizadas (-1..1); considera "na tela"
 *    se está na frente da câmera (z < 1) e dentro de margens generosas
 *    (o cartão é maior que o ponto, por isso 1.3 nas laterais e 2.5 em cima);
 * 4. fora da tela ou além de MAX_DIST → display none;
 * 5. senão: opacidade cai de 1 (em FADE_DIST) até 0 (em MAX_DIST), posição em px
 *    via translate(), escala do cartão = 16 / distância limitada entre 0,55 e 1,
 *    e z-index maior para o pin mais próximo ficar por cima dos outros.
 */
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
    pin.el.style.transform = `translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px)` // NDC → pixels
    pin.card.style.scale = clamp(16 / dist, 0.55, 1)
    pin.el.style.zIndex = String(1000 - Math.round(dist)) // a mais próxima fica por cima
  }
}
