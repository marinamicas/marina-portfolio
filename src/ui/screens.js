import gsap from 'gsap'
import { GROUPS, ITEMS, LIVES, TEXTS } from '../data/level.js'
import { isComplete, markLink, markWon, onStateChange, progress, resetLives, state } from '../core/state.js'
import { hasReturnPoint, returnToPrevious, rewind, travelTo } from '../core/timeMachine.js'
import { ui } from './modal.js'
import { loadVisitors, visitorsSinceLabel } from '../core/visitors.js'
import { linksHTML } from './pins.js'
import { escapeHTML } from '../utils/helpers.js'

/* ==========================================================================
   TELAS E HUD

   Responsável por tudo o que é "janela" e por manter o HUD atualizado:
   - HUD: barra "Conhecimento sobre Marina: X%", contador "X/Y" do Inventário e
     corações das vidas (renderLives).
   - Janelas (abertas em ui.open, src/ui/modal.js): recorte atropelado, "Você
     zerou!", "Como quer recomeçar?", Game Over, "Fim das vidas!", confirmação do
     Resetar (o botão fica dentro do menu do Rebobinar), Contatos e Inventário.
   - Aviso ao fechar/recarregar a aba sem 100% (beforeunload → Game Over).
   - Contador de visitantes (texto nos elementos [data-visitors]).
   - Cliques nos botões das janelas (data-action) e do HUD (Rebobinar,
     Inventário, Resetar).

   Dependências: level.js (textos, itens, grupos), state.js (progresso),
   timeMachine.js (rebobinar/viagens), modal.js, visitors.js, pins.js (linksHTML).
   Usado por: main.js (updateHUD, openItem, maybeWin, enableExitGuard,
   initVisitorCounter) e profile.js (contactsHTML).

   Onde mexer:
   - Textos dos botões/títulos das janelas → funções show*() abaixo.
   - Textos longos → TEXTS em src/data/level.js.
   - O que cada botão faz → switch (el.dataset.action) no fim do arquivo.
   - Desligar o aviso ao sair → apague enableExitGuard(...) em main.js.
   ========================================================================== */

/** Atalho para document.querySelector (menos digitação). */
const $ = (s) => document.querySelector(s)

/* ---------------- HUD ---------------- */
/** Elementos do HUD: rótulo da porcentagem, preenchimento da barra, contador do Inventário e corações. */
const hud = { label: $('#progress-label'), fill: $('#progress-fill'), count: $('#inventory-count'), lives: $('#lives') }

/** Quantidade de recortes na última atualização do HUD: serve para animar só quando entra um novo. */
let lastCount = state.collected.length
/** Vidas na última atualização: serve para animar o coração que mudou. */
let lastLives = state.lives

/**
 * Desenha os corações: um por vida possível (LIVES.start). Cheios = vidas restantes,
 * vazios = perdidas. O coração que acabou de mudar dá um "pulo".
 */
function renderLives() {
  if (!hud.lives) return
  hud.lives.innerHTML = Array.from({ length: LIVES.start }, (_, i) => `<span class="heart ${i < state.lives ? 'full' : 'empty'}">${i < state.lives ? '♥' : '♡'}</span>`).join('')
  hud.lives.setAttribute('aria-label', `Vidas: ${state.lives} de ${LIVES.start}`)
  if (state.lives !== lastLives) {
    const changed = hud.lives.children[Math.min(state.lives, lastLives)]
    if (changed) gsap.fromTo(changed, { scale: 2 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' })
  }
  lastLives = state.lives
}

/**
 * Atualiza a porcentagem, o contador X/Y, a largura da barra e os corações. Se entrou um
 * recorte novo, o contador dá um "pulo" (escala 1.8 → 1). Chamada automaticamente a cada
 * mudança de estado (onStateChange) e manualmente por main.js na inicialização.
 */
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
  renderLives()
}
onStateChange(updateHUD) // toda vez que o progresso muda (collect, markLink, reset…), o HUD acompanha

/* ---------------- Janelas ---------------- */
/**
 * HTML com os contatos, copiado do header da página (<nav class="hud-links">).
 * Assim os links só precisam ser trocados em um lugar (index.html).
 * Usado nas janelas "Você zerou!", "Contatos" e "Sobre a Marina" (profile.js).
 * @returns {string}
 */
export const contactsHTML = () => `<div class="contact-list">${$('.hud-links').innerHTML}</div>`

/**
 * Janela de um recorte atropelado: categoria, título, texto e links "saiba mais".
 * Ao fechar, verifica se foi o último recorte (maybeWin).
 * @param {object} item item de ITEMS (level.js)
 */
export function openItem(item) {
  ui.open(
    `<p class="tag">${GROUPS[item.group].label}</p>
     <h2>${escapeHTML(item.title)}</h2>
     <p>${escapeHTML(item.body)}</p>
     <div class="actions">${linksHTML(item)}</div>`,
    { onClose: maybeWin },
  )
}

/**
 * Mostra "Você zerou!" uma única vez, quando todos os recortes foram atropelados.
 * `state.won` garante que não reapareça ao recarregar a página.
 */
export function maybeWin() {
  if (state.won || !isComplete()) return
  markWon()
  showWin()
}

/** Janela "Você zerou!": texto de TEXTS.win, contatos e botão "Jogar de novo". */
export function showWin() {
  ui.open(
    `<p class="tag">100% da trajetória</p><h2>Você zerou! 🏁</h2><p>${TEXTS.win}</p>${contactsHTML()}
     <div class="actions spaced"><button class="btn ghost" data-action="retry">Jogar de novo</button></div>`,
  )
}

/**
 * Tentar novamente: pergunta se o inventário deve ser apagado ou mantido.
 * Com o inventário vazio não há o que perguntar: só volta ao início.
 */
export function showRetryChoice() {
  if (!state.collected.length) return restartKeep() // nada a perder: só volta ao início (vidas cheias)
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

/** Game Over: a pessoa tentou fechar/recarregar a aba com recortes faltando e escolheu ficar. */
export function showGameOver() {
  ui.open(
    `<p class="tag">${Math.round(progress() * 100)}% da trajetória</p>
     <h2>Game Over!</h2>
     <p>${TEXTS.gameOver}</p>
     <div class="actions">
       <button class="btn" data-action="close">Continuar jogando</button>
       <button class="btn" data-action="retry">Tentar novamente</button>
       <button class="btn ghost" data-action="contacts">Ir aos contatos</button>
     </div>`,
    { className: 'game-over' },
  )
}

/**
 * Fim das vidas: as vidas chegaram a zero (batidas em árvores/onças). A bike fica parada
 * até a pessoa escolher: tentar de novo (vidas cheias, pergunta se mantém o inventário),
 * ver o currículo direto ou ir aos contatos. Não dá para "continuar" sem vidas.
 */
export function showLivesOver() {
  ui.open(
    `<p class="tag">${Math.round(progress() * 100)}% da trajetória · 0 vidas</p>
     <h2>Fim das vidas!</h2>
     <p>${TEXTS.livesOver}</p>
     <div class="actions">
       <button class="btn" data-action="retry">Tentar novamente</button>
       <a class="btn" href="./curriculo-marina-micas.pdf" target="_blank" rel="noopener" data-viewer-skip>Ver currículo</a>
       <button class="btn ghost" data-action="contacts">Ir aos contatos</button>
     </div>`,
    // Fechou sem escolher (×, Esc, clique fora): recomeça do início mantendo o inventário, com vidas cheias
    { className: 'game-over', onClose: () => state.lives <= 0 && restartKeep() },
  )
}

/** Volta ao início mantendo o inventário, com as vidas cheias. */
function restartKeep() {
  resetLives()
  rewind('start')
}

/** Botão ↺ Resetar tudo (menu do Rebobinar): confirma antes de apagar todo o inventário e recomeçar do zero. */
export function showResetConfirm() {
  const n = state.collected.length
  ui.open(
    `<p class="tag">${n}/${ITEMS.length} recortes no inventário</p>
     <h2>Resetar o jogo?</h2>
     <p>${TEXTS.resetConfirm}</p>
     <div class="actions">
       <button class="btn" data-action="confirm-reset">Sim, resetar tudo</button>
       <button class="btn ghost" data-action="close">Cancelar</button>
     </div>`,
  )
}

/** Janela só com os contatos (aberta pelo Game Over → "Ir aos contatos"). */
export function showContacts() {
  ui.open(`<h2>Contatos</h2><p>Vamos conversar e compartilhar conhecimentos?</p>${contactsHTML()}`)
}

/**
 * Inventário: lista todos os recortes. Conquistados (.got) viram botões que levam a bike
 * até eles (data-travel); os outros (.locked) aparecem como "???" desabilitados.
 * Mostra também se o "saiba mais" de cada um já foi visitado e, se houver um ponto de
 * retorno (viagem anterior), o botão "Voltar ao ponto anterior".
 */
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

/* ---------------- Saída da página (fechar/recarregar a aba) ----------------
  O navegador só permite o aviso NATIVO dele ("Sair do site?"); o texto não pode
  ser personalizado. Se a pessoa escolher FICAR, o timer abaixo roda logo depois
  que o aviso fecha e o jogo mostra o Game Over. Se ela sair, a página descarrega
  e o timer nunca roda. Com o inventário 100% completo, nada é bloqueado.
*/
/** Função que diz se o aviso de saída vale agora (definida por main.js: só depois de "Pedalar"). */
let exitGuardActive = () => false

/**
 * Liga o aviso de saída.
 * @param {() => boolean} isActive diz se ele vale agora (ex.: só depois de começar a jogar)
 */
export function enableExitGuard(isActive) {
  exitGuardActive = isActive
}

/**
 * Até quando (relógio performance.now(), em ms) o aviso de saída fica desligado.
 * Clicar num contato direto (link com data-viewer-skip, ex.: mailto:) faz alguns navegadores
 * dispararem beforeunload mesmo sem sair da página; sem esta pausa apareceria "Sair do site?"
 * e depois o Game Over só por ter clicado no e-mail.
 */
let skipExitGuardUntil = 0
// Fase de captura: anota o clique antes de o navegador seguir o link
document.addEventListener(
  'click',
  (e) => {
    if (e.target.closest?.('a[data-viewer-skip]')) skipExitGuardUntil = performance.now() + 1500 // 1,5 s de pausa
  },
  true,
)

// beforeunload: disparado quando a aba vai fechar/recarregar. preventDefault + returnValue
// fazem o navegador perguntar "Sair do site?". O setTimeout só roda se a pessoa ficar.
addEventListener('beforeunload', (e) => {
  if (!exitGuardActive() || isComplete()) return
  if (performance.now() < skipExitGuardUntil) return // acabou de clicar num contato direto (ex.: e-mail)
  e.preventDefault()
  e.returnValue = '' // navegadores mais antigos exigem returnValue para mostrar o aviso
  setTimeout(() => {
    if (!isComplete()) showGameOver()
  }, 400) // 400 ms: tempo para o aviso nativo fechar antes do Game Over aparecer
})

/* ---------------- Contador de visitantes ----------------
  Aparece embaixo da barra de conhecimento e na tela inicial (elementos com data-visitors).
*/
/** Formata números no padrão brasileiro (1.234). */
const formatNumber = (n) => n.toLocaleString('pt-BR')
/** Escreve o mesmo texto em todos os elementos [data-visitors] da página. */
const renderVisitors = (text) => document.querySelectorAll('[data-visitors]').forEach((el) => (el.textContent = text))

/**
 * Registra a visita e mostra "Visitantes: X únicos · Y visualizações (desde DD/MM/AAAA)".
 * Enquanto carrega mostra "…"; se o serviço falhar, "indisponível no momento".
 */
export function initVisitorCounter() {
  const since = visitorsSinceLabel()
  renderVisitors(`Visitantes: … (desde ${since})`)
  loadVisitors()
    .then(({ unique, views }) => renderVisitors(`Visitantes: ${formatNumber(unique)} únicos · ${formatNumber(views)} visualizações (desde ${since})`))
    .catch(() => renderVisitors(`Visitantes: indisponível no momento (desde ${since})`))
}

/* ---------------- Eventos ---------------- */
// Um único listener para TODOS os botões das janelas (delegação): o conteúdo da janela é
// recriado a cada abertura, então não dá para registrar listener botão a botão.
// - data-link-id → marca "saiba mais" visitado (o visualizador abre o link por conta própria)
// - data-travel  → leva a bike até o recorte
// - data-action  → ações nomeadas (switch abaixo). Para criar um botão novo, adicione um case.
ui.content.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action],[data-travel],[data-link-id]')
  if (!el) return
  if (el.dataset.linkId) return markLink(el.dataset.linkId)
  if (el.dataset.travel) return travelTo(el.dataset.travel)
  switch (el.dataset.action) {
    case 'retry': // "Tentar novamente" / "Jogar de novo"
      showRetryChoice()
      break
    case 'restart-keep': // volta ao início mantendo o inventário (e enche as vidas)
      restartKeep()
      break
    case 'restart-reset': // "Resetar tudo" da pergunta de recomeço
    case 'confirm-reset': // "Sim, resetar tudo" do botão ↺ Resetar
      rewind('start', { fresh: true }) // apaga o inventário e recomeça do zero
      break
    case 'close':
      ui.close()
      break
    case 'contacts':
      showContacts()
      break
    case 'return': // "Voltar ao ponto anterior" do inventário
      returnToPrevious()
      break
  }
})

// Menu do botão Rebobinar (abre/fecha; fecha ao clicar fora)
const rewindBox = $('.rewind')
/** Abre/fecha o menu (sem argumento, inverte o estado atual) e atualiza aria-expanded para leitores de tela. */
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
// Qualquer toque/clique fora do menu Rebobinar fecha o menu
document.addEventListener('pointerdown', (e) => {
  if (!rewindBox.contains(e.target)) toggleRewindMenu(false)
})
$('#btn-inventory').addEventListener('click', showInventory)
// "↺ Resetar tudo" fica dentro do menu do Rebobinar: fecha o menu e pede confirmação
$('#btn-reset').addEventListener('click', () => {
  toggleRewindMenu(false)
  showResetConfirm()
})

// Botões do HUD não devem "roubar" o teclado da bike: depois do clique, tiram o foco de si mesmos
document.querySelectorAll('.hud-actions button').forEach((b) => b.addEventListener('click', () => b.blur()))
renderLives() // corações já aparecem antes do primeiro updateHUD