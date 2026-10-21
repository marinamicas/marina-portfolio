import { isTouchDevice } from '../core/device.js'
import { onInvalidGesture } from '../core/invalidGestures.js'
import { ui } from './modal.js'
import { toast } from './effects.js'

/*
  Modal guia de navegação.

  Aparece sozinho quando o detector confirma um gesto inválido, com instruções
  para touch (celular/tablet) ou para mouse/teclado/trackpad (PC). O botão
  "Não mostrar esta dica novamente" grava a preferência no localStorage, que
  continua valendo nas próximas visitas. O botão "? Ajuda" do HUD abre o guia
  manualmente a qualquer momento, mesmo com a dica automática desativada.
*/

const STORAGE_KEY = 'mmj-portfolio:hide-gesture-guide'

// Intervalo mínimo entre dois avisos AUTOMÁTICOS, para nunca virar uma enxurrada de modais.
// Só conta quando o guia realmente aparece (com a dica desligada, nada é consumido).
const COOLDOWN_MS = 30000
let lastAutoShow = -Infinity

/** true se o visitante pediu para não ver mais a dica automática. */
export function isGuideDisabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false // localStorage bloqueado (modo privado de alguns navegadores)
  }
}

/** Liga/desliga a dica automática e grava a escolha. */
function setGuideDisabled(disabled) {
  try {
    if (disabled) localStorage.setItem(STORAGE_KEY, '1')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // sem storage: a escolha vale só até recarregar a página
  }
}

// Frase de abertura conforme o gesto que disparou o aviso
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

// Conteúdo de cada versão do guia: [ícone, ação, explicação]
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
 * - kind:   gesto inválido que motivou o aviso (null quando aberto pelo botão Ajuda)
 * - device: 'touch' ou 'desktop' (padrão: detectado automaticamente)
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

// Botões do guia (delegação: o conteúdo da janela é recriado a cada abertura)
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

// Gesto inválido confirmado → mostra o guia (se o visitante não desativou)
onInvalidGesture(({ kind, device }) => {
  if (isGuideDisabled()) return
  const now = performance.now()
  if (now - lastAutoShow < COOLDOWN_MS) return
  lastAutoShow = now
  showGuide({ kind, device })
})

// Botão "? Ajuda" do HUD: abre sempre
document.querySelector('#btn-help')?.addEventListener('click', () => showGuide())
