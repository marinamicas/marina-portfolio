import { isTouchDevice } from '../core/device.js'
import { escapeHTML } from '../utils/helpers.js'
import { toast } from './effects.js'
import { ui } from './modal.js'

/*
  Visualizador em tela cheia para links externos e "Saiba mais".

  Regras:
  - Nenhum link abre nova aba nem tira o jogador da página: todo clique em link
    externo (http/https de outro site), PDF, e-mail ou telefone é interceptado
    e aberto aqui, por cima do jogo.
  - Sites comuns abrem num <iframe> com "sandbox" (o site não consegue abrir
    pop-ups nem redirecionar a página do jogo).
  - Alguns sites (LinkedIn, GitHub, WhatsApp…) PROÍBEM ser exibidos dentro de
    outra página. Para eles, mostramos um cartão com o endereço e o botão
    "Copiar link", em vez de um quadro em branco.
  - Fechar (botão, Esc ou "voltar" do celular) devolve o jogador exatamente
    para onde estava: o jogo fica pausado enquanto o visualizador está aberto.
*/

// Sites que bloqueiam exibição em iframe (cabeçalhos X-Frame-Options / CSP frame-ancestors)
const NO_IFRAME_HOSTS = ['linkedin.com', 'github.com', 'wa.me', 'whatsapp.com', 'instagram.com', 'facebook.com', 'x.com', 'twitter.com', 'medium.com', 'dribbble.com', 'tiktok.com']

const matchesHost = (host, list) => list.some((h) => host === h || host.endsWith(`.${h}`))

/** Endereços que viram versão "incorporável" (vídeos) para funcionarem dentro do iframe. */
function embeddableUrl(url) {
  const host = url.hostname.replace(/^www\./, '')
  if (host === 'youtube.com' && url.searchParams.get('v')) return `https://www.youtube-nocookie.com/embed/${url.searchParams.get('v')}`
  if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed${url.pathname}`
  if (host === 'vimeo.com' && /^\/\d+/.test(url.pathname)) return `https://player.vimeo.com/video${url.pathname}`
  return url.href
}

/** true se o link deve abrir no visualizador (e não navegar a página). */
export function isViewerLink(url) {
  if (url.protocol === 'mailto:' || url.protocol === 'tel:') return true
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  return url.origin !== location.origin || url.pathname.toLowerCase().endsWith('.pdf')
}

/* ---------------- Estrutura (criada uma vez) ---------------- */
const root = document.createElement('section')
root.className = 'viewer hidden'
root.setAttribute('role', 'dialog')
root.setAttribute('aria-modal', 'true')
root.setAttribute('aria-label', 'Visualizador de conteúdo')
root.innerHTML = `
  <header class="viewer-bar">
    <div class="viewer-title"><strong></strong><small></small></div>
    <button class="viewer-btn" data-viewer="copy" data-viewer-skip>Copiar link</button>
    <button class="viewer-btn viewer-close" data-viewer="close" aria-label="Fechar e voltar ao jogo">✕ Voltar ao jogo</button>
  </header>
  <div class="viewer-body"></div>`
document.body.appendChild(root)
const titleEl = root.querySelector('.viewer-title strong')
const hostEl = root.querySelector('.viewer-title small')
const body = root.querySelector('.viewer-body')
const closeBtn = root.querySelector('.viewer-close')

let currentUrl = ''
let returnFocus = null

/* ---------------- Conteúdo de cada tipo de link ---------------- */

// Cartão usado quando o conteúdo não pode ser exibido em iframe (e-mail, telefone, sites que bloqueiam)
function card(icon, heading, text, extra = '') {
  return `<div class="viewer-card">
    <span class="viewer-card-icon" aria-hidden="true">${icon}</span>
    <h2>${heading}</h2>
    <p>${text}</p>
    <p class="viewer-url">${escapeHTML(currentUrl.replace(/^mailto:|^tel:/, ''))}</p>
    <div class="actions">
      <button class="btn" data-viewer="copy">Copiar</button>
      ${extra}
      <button class="btn ghost" data-viewer="close">Voltar ao jogo</button>
    </div>
  </div>`
}

function iframeHTML(src, { sandbox = true } = {}) {
  // sandbox sem allow-popups e sem allow-top-navigation: o site não abre abas nem tira o jogador da página
  const sb = sandbox ? 'sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"' : ''
  return `<div class="viewer-loading">Carregando…</div>
    <iframe src="${escapeHTML(src)}" title="${escapeHTML(titleEl.textContent)}" ${sb}
      allow="fullscreen; autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" loading="eager"></iframe>
    <p class="viewer-hint">Não apareceu nada? Alguns sites não permitem ser exibidos dentro de outras páginas.
      <button class="viewer-link" data-viewer="copy">Copiar link</button></p>`
}

function render(url) {
  const host = url.hostname.replace(/^www\./, '')
  if (url.protocol === 'mailto:') {
    // o link mailto: abre o app de e-mail do aparelho sem sair da página
    return card('✉', 'E-mail', 'Copie o endereço ou abra no seu aplicativo de e-mail.', `<a class="btn" href="${escapeHTML(url.href)}" data-viewer-skip>Abrir app de e-mail</a>`)
  }
  if (url.protocol === 'tel:') return card('☎', 'Telefone', 'Copie o número para ligar ou salvar nos contatos.', `<a class="btn" href="${escapeHTML(url.href)}" data-viewer-skip>Ligar</a>`)
  if (matchesHost(host, NO_IFRAME_HOSTS)) {
    return card('🔒', host, 'Este site não permite ser exibido dentro de outras páginas. Copie o link para visitá-lo depois, sem perder seu progresso no jogo.')
  }
  if (url.pathname.toLowerCase().endsWith('.pdf')) {
    // Celulares não mostram PDF dentro de iframe: usa o visualizador do Google (só funciona com o site publicado)
    const isPublic = !/^(localhost|127\.|192\.168\.)/.test(location.hostname)
    if (isTouchDevice() && isPublic) return iframeHTML(`https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url.href)}`)
    return iframeHTML(url.href, { sandbox: false }) // o leitor de PDF do navegador não funciona com sandbox
  }
  return iframeHTML(embeddableUrl(url))
}

/* ---------------- Abrir / fechar ---------------- */

/** Abre `href` no visualizador em tela cheia. `title` = texto mostrado no topo. */
export function openViewer(href, { title = '' } = {}) {
  const url = new URL(href, location.href)
  currentUrl = url.href
  titleEl.textContent = title || url.hostname.replace(/^www\./, '') || 'Conteúdo'
  hostEl.textContent = url.protocol.startsWith('http') ? url.hostname.replace(/^www\./, '') : ''
  body.innerHTML = render(url)
  body.querySelector('iframe')?.addEventListener(
    'load',
    () => {
      body.querySelector('.viewer-loading')?.remove()
      // Alguns conteúdos (ex.: leitor de PDF) "roubam" o foco ao carregar; teclas dentro do iframe
      // não chegam ao jogo. Devolvemos o foco ao botão de fechar para o Esc continuar funcionando.
      if (ui.viewerOpen) closeBtn.focus({ preventScroll: true })
    },
    { once: true },
  )

  returnFocus = document.activeElement
  root.classList.remove('hidden')
  ui.viewerOpen = true
  closeBtn.focus({ preventScroll: true })
  // Entrada no histórico: o botão "voltar" do celular fecha o visualizador em vez de sair do site
  if (!history.state?.viewer) history.pushState({ viewer: true }, '')
}

/** Fecha o visualizador e volta ao jogo. `fromHistory` = fechado pelo botão "voltar" do aparelho. */
export function closeViewer(fromHistory = false) {
  if (!ui.viewerOpen) return
  ui.viewerOpen = false
  root.classList.add('hidden')
  body.innerHTML = '' // descarrega o site (para vídeos/áudios que estivessem tocando)
  returnFocus?.focus?.({ preventScroll: true })
  if (!fromHistory && history.state?.viewer) history.back()
}

async function copyLink() {
  const text = currentUrl.replace(/^mailto:|^tel:/, '')
  try {
    await navigator.clipboard.writeText(text)
    toast('Copiado!')
  } catch {
    // navegadores sem permissão de área de transferência: mostra para copiar manualmente
    toast(text, 6)
  }
}

/* ---------------- Eventos ---------------- */

// Botões do visualizador
root.addEventListener('click', (e) => {
  const action = e.target.closest('[data-viewer]')?.dataset.viewer
  if (action === 'close') closeViewer()
  else if (action === 'copy') copyLink()
})

// Esc fecha o visualizador antes de qualquer outra janela (fase de captura)
addEventListener(
  'keydown',
  (e) => {
    if (!ui.viewerOpen || e.code !== 'Escape') return
    e.stopImmediatePropagation()
    closeViewer()
  },
  true,
)

// Botão "voltar" do aparelho/navegador
addEventListener('popstate', () => {
  if (ui.viewerOpen) closeViewer(true)
})

// Título mostrado no topo do visualizador: rótulo acessível do link ou o texto dele (sem a setinha ↗)
const linkLabel = (a) => a.getAttribute('aria-label') || a.textContent.replace('↗', '').trim()

/** Encontra o link clicado que deve ir para o visualizador (ou null). */
function viewerLinkFrom(e) {
  const a = e.target.closest?.('a[href]')
  if (!a || a.hasAttribute('data-viewer-skip')) return null
  const url = new URL(a.getAttribute('href'), location.href)
  return isViewerLink(url) ? { a, url } : null
}

// Intercepta TODOS os links externos da página (topo, janelas, janelas presas no chão).
// Fase de captura: roda antes do clique virar navegação; os outros listeners (ex.: marcar
// "saiba mais visitado" no inventário) continuam recebendo o clique normalmente.
document.addEventListener(
  'click',
  (e) => {
    const found = viewerLinkFrom(e)
    if (!found) return
    e.preventDefault() // nada de nova aba nem de sair da página (vale também para Ctrl/Cmd + clique)
    openViewer(found.url.href, { title: linkLabel(found.a) })
  },
  true,
)
// Clique com o botão do meio (que abriria nova aba): também vai para o visualizador
document.addEventListener(
  'auxclick',
  (e) => {
    if (e.button !== 1) return
    const found = viewerLinkFrom(e)
    if (!found) return
    e.preventDefault()
    openViewer(found.url.href, { title: linkLabel(found.a) })
  },
  true,
)
