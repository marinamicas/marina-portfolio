import { isTouchDevice } from '../core/device.js'
import { onInvalidGesture } from '../core/invalidGestures.js'
import { ui } from './modal.js'
import { toast } from './effects.js'

/* ==========================================================================
   GUIA DE NAVEGAÇÃO (janela "Como navegar")

   Papel deste arquivo: montar e abrir a janela com as instruções de uso do
   site, em duas versões: touch (celular/tablet) e desktop (mouse, teclado,
   trackpad).

   Ela aparece de dois jeitos:
   1. Automaticamente, quando o detector de gestos inválidos (core/invalidGestures.js)
      confirma que a pessoa está tentando navegar de um jeito que não funciona.
      Nesse caso, uma frase em destaque (REASONS) explica o que deu errado.
   2. Manualmente, pelo botão "? Ajuda" do HUD (sempre funciona).

   O botão "Não mostrar esta dica novamente" grava a escolha no localStorage,
   que continua valendo nas próximas visitas (diferente do progresso, que fica
   no sessionStorage).

   Depende de: device.js (touch x desktop), invalidGestures.js (assinatura do
   evento), modal.js (ui.open) e effects.js (toast).
   Quem usa: main.js importa este arquivo só para ele se registrar (efeito colateral).
   Aparência: bloco "Modal guia de navegação" em src/styles/main.css.

   Onde mexer:
   - GUIDES.touch / GUIDES.desktop: título e linhas [ícone, ação, explicação].
   - REASONS: frase de destaque para cada tipo de gesto inválido.
   - COOLDOWN_MS: intervalo mínimo entre dois guias automáticos.
   - STORAGE_KEY: nome da chave no localStorage (mudar = todo mundo volta a ver a dica).
   ========================================================================== */

// Chave no localStorage que guarda "a pessoa pediu para não ver mais a dica automática"
const STORAGE_KEY = 'mmj-portfolio:hide-gesture-guide'

// Intervalo mínimo entre dois avisos AUTOMÁTICOS, para nunca virar uma enxurrada de modais.
// Só conta quando o guia realmente aparece (com a dica desligada, nada é consumido).
// 30000 ms = 30 s. Aumente para incomodar menos; diminua para ajudar mais rápido.
const COOLDOWN_MS = 30000
// Momento (performance.now, em ms) em que o último guia automático apareceu.
// -Infinity = nunca apareceu, então o primeiro passa direto pelo cooldown.
let lastAutoShow = -Infinity

/**
 * true se o visitante pediu para não ver mais a dica automática.
 * Lê o localStorage dentro de try/catch porque alguns navegadores em modo
 * privado lançam erro ao acessá-lo.
 * @returns {boolean}
 */
export function isGuideDisabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false // localStorage bloqueado (modo privado de alguns navegadores)
  }
}

/**
 * Liga/desliga a dica automática e grava a escolha no localStorage.
 * @param {boolean} disabled true = não mostrar mais; false = voltar a mostrar
 */
function setGuideDisabled(disabled) {
  try {
    if (disabled) localStorage.setItem(STORAGE_KEY, '1')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // sem storage: a escolha vale só até recarregar a página
  }
}

/**
 * Frase de abertura conforme o gesto que disparou o aviso.
 * As chaves são os mesmos nomes de RULES em core/invalidGestures.js.
 * Se um gesto não tiver frase aqui, o guia abre sem a faixa de destaque.
 */
const REASONS = {
  tap: 'Para mover a bike, toque nela e arraste até os recortes.',
  click: 'Para mover a bike, clique nela e arraste até os recortes.',
  'long-press': 'Segurar o dedo parado não faz nada: arraste a bike ou o cenário.',
  'multi-finger': 'Gestos com três ou mais dedos não são usados.',
  'right-click': 'O botão direito do mouse não é usado no mundo 3D.',
  'middle-click': 'O botão do meio do mouse não é usado no mundo 3D.',
  'horizontal-scroll': 'Deslizar para os lados não move a câmera.',
  'unsupported-key': 'Essas teclas não fazem nada no jogo.',
}

/**
 * Conteúdo de cada versão do guia. Cada linha de `items` é
 * [ícone (emoji), ação (negrito), explicação (texto normal)].
 * Para acrescentar uma instrução, copie uma linha e troque os três textos.
 */
const GUIDES = {
  touch: {
    title: 'Como navegar no celular',
    items: [
      ['🚲', 'Toque na bike e arraste', 'Ela vai exatamente para onde seu dedo for. Leve-a até a borda da tela para ir mais longe.'],
      ['☝️', 'Arraste o cenário', 'Toque em qualquer área livre e arraste para olhar outro ponto do mapa.'],
      ['🤏', 'Pinça com dois dedos', 'Afaste os dedos para aproximar a câmera e junte para afastar.'],
      ['👆', 'Toque duplo', 'Volta o zoom ao normal e a câmera para a bike.'],
      ['💥', 'Atropele os recortes', 'Arraste a bike por cima deles para abrir a história de cada um.'],
      ['✂', 'Botões embaixo', 'Inventário leva até os recortes conquistados; Rebobinar volta no caminho.'],
    ],
  },
  desktop: {
    title: 'Como navegar no computador',
    items: [
      ['🚲', 'Clique na bike e arraste', 'Ela vai exatamente para onde o mouse for. Leve-a até a borda da tela para ir mais longe.'],
      ['🖱️', 'Arraste o cenário', 'Clique em qualquer área livre e arraste para olhar outro ponto do mapa.'],
      ['🔍', 'Roda do mouse ou pinça no trackpad', 'Aproxima e afasta a câmera. As teclas + e − também funcionam.'],
      ['↺', 'Duplo clique ou tecla 0', 'Volta o zoom ao normal e a câmera para a bike.'],
      ['⌨️', 'W A S D ou setas', 'Também pedalam a bike (Shift acelera). Esc fecha as janelas.'],
    ],
  },
}

/**
 * Abre o guia.
 *
 * Como funciona: escolhe a versão (touch/desktop), transforma cada linha de
 * `items` em um <li> com ícone + título + texto, monta a faixa de motivo (se
 * `kind` tiver frase em REASONS) e escolhe qual botão secundário mostrar:
 * "Não mostrar esta dica novamente" ou, se já estiver desligada, "Voltar a
 * mostrar dicas automáticas". Por fim abre tudo na janela flutuante com a
 * classe 'guide-card' (CSS compacto no celular).
 *
 * @param {object} [o]
 * @param {string|null} [o.kind=null] gesto inválido que motivou o aviso (null quando aberto pelo botão Ajuda)
 * @param {'touch'|'desktop'} [o.device] versão do guia (padrão: detectado automaticamente)
 */
export function showGuide({ kind = null, device = isTouchDevice() ? 'touch' : 'desktop' } = {}) {
  const guide = GUIDES[device] ?? GUIDES.desktop
  const items = guide.items
    .map(([icon, action, text]) => `<li><span class="guide-icon" aria-hidden="true">${icon}</span><div><strong>${action}</strong><p>${text}</p></div></li>`)
    .join('')
  const reason = kind && REASONS[kind] ? `<p class="guide-reason">${REASONS[kind]}</p>` : ''
  // Com a dica automática desligada, o botão vira "reativar"
  const toggle = isGuideDisabled()
    ? '<button class="btn ghost" data-guide="enable">Voltar a mostrar dicas automáticas</button>'
    : '<button class="btn ghost" data-guide="disable">Não mostrar esta dica novamente</button>'

  ui.open(
    `<p class="tag">Guia de navegação</p>
     <h2>${guide.title}</h2>
     ${reason}
     <ul class="guide">${items}</ul>
     <div class="actions">
       <button class="btn" data-guide="ok">Entendi</button>
       ${toggle}
     </div>`,
    { className: 'guide-card' },
  )
}

// Botões do guia (delegação: o conteúdo da janela é recriado a cada abertura).
// Escutamos o clique no contêiner fixo (ui.content) e descobrimos qual botão foi
// pelo atributo data-guide: 'ok' só fecha; 'disable' grava a preferência e fecha;
// 'enable' apaga a preferência e fecha. Cliques sem data-guide são ignorados
// (são de outras janelas que usam o mesmo contêiner).
ui.content.addEventListener('click', (e) => {
  const action = e.target.closest('[data-guide]')?.dataset.guide
  if (!action) return
  if (action === 'disable') {
    setGuideDisabled(true)
    toast('Combinado! A dica não aparecerá de novo. Use o botão ? Ajuda se precisar.')
  } else if (action === 'enable') {
    setGuideDisabled(false)
    toast('Dicas automáticas reativadas.')
  }
  ui.close()
})

// Gesto inválido confirmado → mostra o guia (se o visitante não desativou).
// Fluxo: invalidGestures.js confirma o gesto → chama esta função com { kind, device }
// → se a dica está desligada, nada; se o último guia foi há menos de COOLDOWN_MS, nada;
// senão anota o horário e abre o guia com a frase do gesto.
onInvalidGesture(({ kind, device }) => {
  if (isGuideDisabled()) return
  const now = performance.now()
  if (now - lastAutoShow < COOLDOWN_MS) return
  lastAutoShow = now
  showGuide({ kind, device })
})

// Botão "? Ajuda" do HUD: abre sempre (ignora cooldown e preferência).
// O `?.` protege caso o botão seja removido do index.html.
document.querySelector('#btn-help')?.addEventListener('click', () => showGuide())
