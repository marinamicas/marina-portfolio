import gsap from 'gsap'
import { GROUPS, ITEMS, TEXTS } from '../data/level.js'
import { isComplete, markLink, markWon, onStateChange, progress, state } from '../core/state.js'
import { hasReturnPoint, returnToPrevious, rewind, travelTo } from '../core/timeMachine.js'
import { ui } from './modal.js'
import { linksHTML } from './pins.js'
import { escapeHTML } from '../utils/helpers.js'

/*
  Telas e HUD: barra de conhecimento, contador do inventário, janelas de
  item, inventário, zerou, game over, contatos e "tentar novamente".
*/

// Atalho para document.querySelector
const $ = (s) => document.querySelector(s)

/* ---------------- HUD ---------------- */
const hud = { label: $('#progress-label'), fill: $('#progress-fill'), count: $('#inventory-count') }

let lastCount = state.collected.length

export function updateHUD() {
  const pct = Math.round(progress() * 100)
  hud.label.textContent = `Conhecimento sobre Marina: ${pct}%`
  hud.count.textContent = `${state.collected.length}/${ITEMS.length}`
  if (state.collected.length > lastCount) {
    // feedback visual de que o recorte entrou no inventário
    gsap.fromTo(hud.count, { scale: 1.8 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' })
  }
  lastCount = state.collected.length
  gsap.to(hud.fill, { width: `${pct}%`, duration: 0.6, ease: 'power2.out' })
}
onStateChange(updateHUD)

/* ---------------- Janelas ---------------- */
// Reaproveita os contatos do topo da página dentro das janelas
const contactsHTML = () => `<div class="contact-list">${$('.hud-links').innerHTML}</div>`

/** Janela de um recorte atropelado: categoria, título, texto e links "saiba mais". */
export function openItem(item) {
  ui.open(
    `<p class="tag">${GROUPS[item.group].label}</p>
     <h2>${escapeHTML(item.title)}</h2>
     <p>${escapeHTML(item.body)}</p>
     <div class="actions">${linksHTML(item)}</div>`,
    { onClose: maybeWin },
  )
}

/** Mostra "zerou" uma única vez, quando todos os recortes foram atropelados. */
export function maybeWin() {
  if (state.won || !isComplete()) return
  markWon()
  showWin()
}

export function showWin() {
  ui.open(
    `<p class="tag">100% da trajetória</p><h2>Você zerou! 🏁</h2><p>${TEXTS.win}</p>${contactsHTML()}
     <div class="actions spaced"><button class="btn ghost" data-action="retry">Jogar de novo</button></div>`,
  )
}

/** Tentar novamente: pergunta se o inventário deve ser apagado ou mantido. */
export function showRetryChoice() {
  if (!state.collected.length) return rewind('start') // nada a perder: só volta ao início
  ui.open(
    `<p class="tag">${state.collected.length}/${ITEMS.length} recortes no inventário</p>
     <h2>Como quer recomeçar?</h2>
     <p>${TEXTS.retry}</p>
     <div class="actions">
       <button class="btn" data-action="restart-keep">Manter o inventário</button>
       <button class="btn ghost" data-action="restart-reset">Resetar tudo</button>
     </div>`,
  )
}

/** Sair com recortes faltando. */
export function showGameOver() {
  ui.open(
    `<p class="tag">${Math.round(progress() * 100)}% da trajetória</p>
     <h2>Game Over!</h2>
     <p>${TEXTS.gameOver}</p>
     <div class="actions">
       <button class="btn" data-action="retry">Tentar novamente</button>
       <button class="btn ghost" data-action="contacts">Ir aos contatos</button>
     </div>`,
    { className: 'game-over' },
  )
}

/** Janela só com os contatos. */
export function showContacts() {
  ui.open(`<h2>Contatos</h2><p>Vamos conversar e compartilhar conhecimentos?</p>${contactsHTML()}`)
}

/** Lista de recortes: conquistados (clicáveis para viajar) e bloqueados. */
export function showInventory() {
  const rows = ITEMS.map((it) => {
    const got = state.collected.includes(it.id)
    const link = state.links.includes(it.id) ? '🔗 "saiba mais" visitado' : it.links.length ? 'link "saiba mais" ainda não visitado' : 'sem links'
    return `<li class="${got ? 'got' : 'locked'}">
      <button class="btn" ${got ? `data-travel="${it.id}"` : 'disabled'}>${got ? `✂ ${escapeHTML(it.title)}` : '??? recorte não encontrado'}</button>
      <small>${GROUPS[it.group].label}${got ? ` · ${link}` : ''}</small>
    </li>`
  }).join('')
  const back = hasReturnPoint() ? '<button class="btn ghost" data-action="return">↩ Voltar ao ponto anterior</button>' : ''
  ui.open(
    `<p class="tag">${state.collected.length}/${ITEMS.length} recortes conquistados</p>
     <h2>Inventário</h2>
     <p>Selecione um recorte conquistado para pedalar até ele.</p>
     <ul class="inventory">${rows}</ul>${back}`,
  )
}

/** Botão Sair: zerou (inventário completo) ou game over (faltam recortes). */
export function requestExit() {
  if (isComplete()) showWin()
  else showGameOver()
}

/* ---------------- Eventos ---------------- */
ui.content.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action],[data-travel],[data-link-id]')
  if (!el) return
  if (el.dataset.linkId) return markLink(el.dataset.linkId)
  if (el.dataset.travel) return travelTo(el.dataset.travel)
  switch (el.dataset.action) {
    case 'retry':
      showRetryChoice()
      break
    case 'restart-keep':
      rewind('start')
      break
    case 'restart-reset':
      rewind('start', { fresh: true })
      break
    case 'contacts':
      showContacts()
      break
    case 'return':
      returnToPrevious()
      break
  }
})

// Menu do botão Rebobinar (abre/fecha; fecha ao clicar fora)
const rewindBox = $('.rewind')
const toggleRewindMenu = (open = !rewindBox.classList.contains('open')) => {
  rewindBox.classList.toggle('open', open)
  $('#btn-rewind').setAttribute('aria-expanded', String(open))
}
$('#btn-rewind').addEventListener('click', () => toggleRewindMenu())
$('#btn-rewind-fork').addEventListener('click', () => {
  toggleRewindMenu(false)
  rewind('fork')
})
$('#btn-rewind-start').addEventListener('click', () => {
  toggleRewindMenu(false)
  rewind('start')
})
document.addEventListener('pointerdown', (e) => {
  if (!rewindBox.contains(e.target)) toggleRewindMenu(false)
})
$('#btn-inventory').addEventListener('click', showInventory)
$('#btn-exit').addEventListener('click', requestExit)

// Botões do HUD não devem "roubar" o teclado da bike
document.querySelectorAll('.hud-actions button').forEach((b) => b.addEventListener('click', () => b.blur()))

// Exit intent (desktop): mouse saindo pelo topo da janela → Game Over / Zerou
let exitWarned = false
document.addEventListener('mouseout', (e) => {
  if (e.relatedTarget || e.clientY > 0 || exitWarned || ui.isOpen) return
  if (!document.querySelector('#start-screen').classList.contains('hidden')) return
  exitWarned = true
  requestExit()
})
