import { isTouchDevice } from '../core/device.js'
import { escapeHTML } from '../utils/helpers.js'
import { toast } from './effects.js'
import { ui } from './modal.js'

/* ==========================================================================
   VISUALIZADOR EM TELA CHEIA (links externos e "Saiba mais")

   Papel deste arquivo: garantir que NENHUM link tire o visitante do jogo.
   Todo clique em link externo (outro site), PDF, e-mail ou telefone é
   interceptado e aberto aqui, numa camada que cobre a tela (section.viewer).

   Regras:
   - Sites comuns abrem num <iframe> com "sandbox" (o site não consegue abrir
     pop-ups nem redirecionar a página do jogo).
   - Alguns sites (LinkedIn, GitHub, WhatsApp…) PROÍBEM ser exibidos dentro de
     outra página. Para eles, mostramos um cartão com o endereço e o botão
     "Copiar link", em vez de um quadro em branco.
   - E-mail e telefone mostram um cartão com "Copiar" e "Abrir app"/"Ligar".
   - Vídeos do YouTube/Vimeo são convertidos para a URL "embed".
   - PDFs: no computador abrem no leitor do navegador; no celular (site publicado)
     pelo visualizador do Google Docs.
   - Fechar (botão, Esc ou "voltar" do celular) devolve o jogador exatamente
     para onde estava: o jogo fica pausado enquanto o visualizador está aberto
     (ui.viewerOpen = true faz o loop de main.js não rodar).

   Depende de: device.js (touch x desktop), helpers (escapeHTML), effects.js
   (toast) e modal.js (a flag ui.viewerOpen).
   Quem usa: main.js importa este arquivo só para ele instalar os escutadores
   de clique globais (efeito colateral). screens.js e pins.js não chamam nada
   daqui: os links deles são interceptados automaticamente.
   Aparência: bloco "Visualizador em tela cheia" em src/styles/main.css.

   Onde mexer:
   - NO_IFRAME_HOSTS: sites que aparecem em branco no iframe → adicione o domínio.
   - embeddableUrl: conversões de URL para versão incorporável (vídeos).
   - card(): textos e botões dos cartões (e-mail, telefone, site bloqueado).
   - Para um link específico NÃO passar pelo visualizador: atributo data-viewer-skip no <a>.
   ========================================================================== */

// Sites que bloqueiam exibição em iframe (cabeçalhos X-Frame-Options / CSP frame-ancestors).
// Comparação por domínio: 'linkedin.com' também vale para 'www.linkedin.com' e 'br.linkedin.com'.
const NO_IFRAME_HOSTS = ['linkedin.com', 'github.com', 'wa.me', 'whatsapp.com', 'instagram.com', 'facebook.com', 'x.com', 'twitter.com', 'medium.com', 'dribbble.com', 'tiktok.com']

/**
 * true se `host` é igual a algum domínio da lista ou é subdomínio dele.
 * @param {string} host ex.: 'www.linkedin.com'
 * @param {string[]} list domínios
 * @returns {boolean}
 */
const matchesHost = (host, list) => list.some((h) => host === h || host.endsWith(`.${h}`))

/**
 * Converte endereços de vídeo para a versão "incorporável" (player), que
 * funciona dentro do iframe. Outros endereços voltam como estão.
 * - youtube.com/watch?v=ID  → youtube-nocookie.com/embed/ID
 * - youtu.be/ID             → youtube-nocookie.com/embed/ID
 * - vimeo.com/123           → player.vimeo.com/video/123
 * @param {URL} url
 * @returns {string} endereço final para o iframe
 */
function embeddableUrl(url) {
  const host = url.hostname.replace(/^www\./, '')
  if (host === 'youtube.com' && url.searchParams.get('v')) return `https://www.youtube-nocookie.com/embed/${url.searchParams.get('v')}`
  if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed${url.pathname}`
  if (host === 'vimeo.com' && /^\/\d+/.test(url.pathname)) return `https://player.vimeo.com/video${url.pathname}`
  return url.href
}

/**
 * true se o link deve abrir no visualizador (e não navegar a página).
 * Regra: e-mail e telefone sempre; http/https só se for de OUTRO site
 * (origem diferente) ou um PDF deste site; qualquer outro protocolo, não.
 * @param {URL} url
 * @returns {boolean}
 */
export function isViewerLink(url) {
  if (url.protocol === 'mailto:' || url.protocol === 'tel:') return true
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  return url.origin !== location.origin || url.pathname.toLowerCase().endsWith('.pdf')
}

/* ---------------- Estrutura (criada uma vez) ----------------
   A seção .viewer é criada aqui (não no index.html) e começa escondida.
   Barra superior: título + domínio, botão "Copiar link" e botão fechar.
   Corpo: recebe o iframe ou o cartão conforme o tipo de link. */
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
const titleEl = root.querySelector('.viewer-title strong') // título (texto do link clicado)
const hostEl = root.querySelector('.viewer-title small') // domínio do site aberto
const body = root.querySelector('.viewer-body') // onde entra o iframe ou o cartão
const closeBtn = root.querySelector('.viewer-close') // botão "✕ Voltar ao jogo"

// Endereço completo que está aberto agora (usado por "Copiar link")
let currentUrl = ''
// Elemento que tinha o foco antes de abrir (o foco volta para ele ao fechar: acessibilidade)
let returnFocus = null

/* ---------------- Conteúdo de cada tipo de link ---------------- */

/**
 * Cartão usado quando o conteúdo não pode ser exibido em iframe (e-mail,
 * telefone, sites que bloqueiam). Mostra ícone, título, explicação, o endereço
 * (sem o prefixo mailto:/tel:) e os botões Copiar / extra / Voltar ao jogo.
 * @param {string} icon emoji
 * @param {string} heading título
 * @param {string} text explicação
 * @param {string} [extra=''] HTML de um botão adicional (ex.: "Abrir app de e-mail")
 * @returns {string} HTML
 */
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

/**
 * HTML do iframe com o aviso "Carregando…" por cima e a dica no rodapé.
 * @param {string} src endereço a carregar
 * @param {object} [o]
 * @param {boolean} [o.sandbox=true] false só para PDFs (o leitor do navegador não funciona com sandbox)
 * @returns {string} HTML
 */
function iframeHTML(src, { sandbox = true } = {}) {
  // sandbox sem allow-popups e sem allow-top-navigation: o site não abre abas nem tira o jogador da página
  const sb = sandbox ? 'sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"' : ''
  return `<div class="viewer-loading">Carregando…</div>
    <iframe src="${escapeHTML(src)}" title="${escapeHTML(titleEl.textContent)}" ${sb}
      allow="fullscreen; autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" loading="eager"></iframe>
    <p class="viewer-hint">Não apareceu nada? Alguns sites não permitem ser exibidos dentro de outras páginas.
      <button class="viewer-link" data-viewer="copy">Copiar link</button></p>`
}

/**
 * Decide o que mostrar para a URL e devolve o HTML correspondente.
 * Ordem das regras: e-mail → telefone → site bloqueado → PDF → site comum (iframe).
 * @param {URL} url
 * @returns {string} HTML
 */
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

/**
 * Abre `href` no visualizador em tela cheia.
 *
 * Como funciona:
 * 1. normaliza o endereço (URL absoluta) e guarda em currentUrl;
 * 2. preenche título e domínio na barra;
 * 3. injeta o HTML de render() no corpo;
 * 4. se há iframe, ao terminar de carregar tira o "Carregando…" e devolve o
 *    foco ao botão fechar (o PDF, por ex., rouba o foco e o Esc pararia de funcionar);
 * 5. guarda quem tinha o foco, mostra a seção, marca ui.viewerOpen (pausa o jogo);
 * 6. adiciona uma entrada no histórico do navegador, para o botão "voltar" do
 *    celular fechar o visualizador em vez de sair do site.
 * @param {string} href endereço (absoluto ou relativo)
 * @param {object} [o]
 * @param {string} [o.title=''] texto mostrado no topo (padrão: domínio)
 */
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
    { once: true }, // o evento load só interessa uma vez por abertura
  )

  returnFocus = document.activeElement
  root.classList.remove('hidden')
  ui.viewerOpen = true
  closeBtn.focus({ preventScroll: true })
  // Entrada no histórico: o botão "voltar" do celular fecha o visualizador em vez de sair do site
  if (!history.state?.viewer) history.pushState({ viewer: true }, '')
}

/**
 * Fecha o visualizador e volta ao jogo.
 * Esconde a seção, esvazia o corpo (descarrega o site: vídeos/áudios param),
 * devolve o foco a quem tinha antes e desfaz a entrada do histórico criada em
 * openViewer (a não ser que o fechamento tenha vindo justamente do "voltar").
 * @param {boolean} [fromHistory=false] true = fechado pelo botão "voltar" do aparelho (evento popstate)
 */
export function closeViewer(fromHistory = false) {
  if (!ui.viewerOpen) return
  ui.viewerOpen = false
  root.classList.add('hidden')
  body.innerHTML = '' // descarrega o site (para vídeos/áudios que estivessem tocando)
  returnFocus?.focus?.({ preventScroll: true })
  if (!fromHistory && history.state?.viewer) history.back()
}

/**
 * Copia o endereço atual (sem mailto:/tel:) para a área de transferência e
 * avisa "Copiado!". Se o navegador não permitir, mostra o endereço num aviso
 * longo (6 s) para a pessoa copiar na mão.
 */
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

// Botões do visualizador (delegação na seção): data-viewer="close" fecha,
// data-viewer="copy" copia. Vale para a barra, o cartão e a dica do rodapé.
root.addEventListener('click', (e) => {
  const action = e.target.closest('[data-viewer]')?.dataset.viewer
  if (action === 'close') closeViewer()
  else if (action === 'copy') copyLink()
})

// Esc fecha o visualizador antes de qualquer outra janela (fase de captura).
// `true` no final = captura: este escutador roda antes do de modal.js, e
// stopImmediatePropagation impede que a janela flutuante também feche.
addEventListener(
  'keydown',
  (e) => {
    if (!ui.viewerOpen || e.code !== 'Escape') return
    e.stopImmediatePropagation()
    closeViewer()
  },
  true,
)

// Botão "voltar" do aparelho/navegador: o histórico volta uma entrada (a que
// openViewer criou) e disparamos o fechamento sem chamar history.back() de novo.
addEventListener('popstate', () => {
  if (ui.viewerOpen) closeViewer(true)
})

/**
 * Título mostrado no topo do visualizador: rótulo acessível do link (aria-label)
 * ou o texto dele, sem a setinha ↗.
 * @param {HTMLAnchorElement} a
 * @returns {string}
 */
const linkLabel = (a) => a.getAttribute('aria-label') || a.textContent.replace('↗', '').trim()

/**
 * Encontra o link clicado que deve ir para o visualizador (ou null).
 * Ignora elementos que não são <a href>, links com data-viewer-skip e links
 * internos que não são PDF.
 * @param {MouseEvent} e
 * @returns {{ a: HTMLAnchorElement, url: URL } | null}
 */
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
// Clique com o botão do meio (que abriria nova aba): também vai para o visualizador.
// auxclick é o evento dos botões que não são o esquerdo; button === 1 é o do meio.
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
