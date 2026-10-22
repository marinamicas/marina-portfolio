import { isTouchDevice } from '../core/device.js'
import { onInvalidGesture } from '../core/invalidGestures.js'
import { LIVES } from '../data/level.js'
import { controlsVisible } from './controls.js'
import { ui } from './modal.js'
import { toast } from './effects.js'

/* ==========================================================================
   GUIA DE NAVEGAÇÃO (instruções de jogabilidade)

   Papel deste arquivo:
   - Montar as instruções de COMO JOGAR de forma dinâmica, conforme:
       • o aparelho (touch = celular/tablet; desktop = mouse e teclado);
       • o modo de controle (botões na tela visíveis ou ocultos, ui/controls.js).
     buildInstructions() é usada aqui (botão "? Ajuda" e gestos inválidos) e pela
     janela inicial (ui/onboarding.js).
   - Abrir o guia sozinho quando o detector (core/invalidGestures.js) confirma um
     gesto inválido; uma frase em destaque (REASONS) explica o que não funcionou.
   - "Não mostrar esta dica novamente" grava a escolha no localStorage, que vale
     nas próximas visitas (diferente do progresso, que fica no sessionStorage).

   Dependências: device.js, invalidGestures.js, level.js (LIVES), controls.js, modal.js, effects.js.
   Usado por: main.js (importa para instalar os escutadores), onboarding.js (buildInstructions).
   Aparência: bloco "Modal guia de navegação" em src/styles/main.css.

   Onde mexer:
   - Textos das instruções → função buildInstructions() abaixo.
   - Frase de cada gesto inválido → REASONS.
   - Intervalo mínimo entre avisos automáticos → COOLDOWN_MS.
   - STORAGE_KEY: nome da chave no localStorage (mudar = todo mundo volta a ver a dica).
   ========================================================================== */

// Chave no localStorage que guarda "a pessoa pediu para não ver mais a dica automática"
const STORAGE_KEY = 'mmj-portfolio:hide-gesture-guide'

// Intervalo mínimo entre dois avisos AUTOMÁTICOS (30000 ms = 30 s), para nunca virar uma enxurrada de janelas.
const COOLDOWN_MS = 30000
// Quando o último guia automático apareceu (performance.now(), ms)
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
  tap: 'Tocar no cenário não move a bike.',
  click: 'Clicar no cenário não move a bike.',
  'long-press': 'Segurar o dedo parado não faz nada.',
  'multi-finger': 'Gestos com três ou mais dedos não são usados.',
  'right-click': 'O botão direito do mouse não é usado no mundo 3D.',
  'middle-click': 'O botão do meio do mouse não é usado no mundo 3D.',
  'horizontal-scroll': 'Deslizar para os lados não move a câmera.',
  'unsupported-key': 'Essas teclas não fazem nada no jogo.',
}

/**
 * Instruções de jogabilidade para o aparelho e o modo de controle atuais.
 * Cada item é [ícone, ação, explicação].
 * @param {'touch'|'desktop'} [device] padrão: detectado automaticamente
 * @param {boolean} [buttons] botões na tela visíveis? padrão: estado atual
 * @returns {{title: string, items: string[][]}}
 */
export function buildInstructions(device = isTouchDevice() ? 'touch' : 'desktop', buttons = controlsVisible()) {
  const touch = device === 'touch'
  const items = []
  if (buttons) {
    items.push(
      ['🧭', 'Virar: ◀ ▶', 'Use os botões do canto esquerdo para apontar a bike. A seta neon no chão mostra a direção.'],
      ['🚴', 'Pedalar e frear: ▲ ▼', 'Segure ▲ para ir em frente e ▼ para frear ou dar ré. ⚡ é o turbo.'],
    )
    if (touch) items.push(['✌️', 'Dois dedos juntos', 'Dá para virar e acelerar ao mesmo tempo, um dedo em cada lado.'])
  } else {
    items.push([
      '🚲',
      touch ? 'Toque na bike e arraste' : 'Clique na bike e arraste',
      `A bike pedala até onde ${touch ? 'seu dedo' : 'o mouse'} apontar. Mantenha ${touch ? 'o dedo' : 'o mouse'} à frente dela para seguir; solte para parar.`,
    ])
  }
  if (!touch) items.push(['⌨️', 'Teclado (sempre ativo)', 'W A S D ou setas pedalam e viram, Shift é o turbo. As teclas funcionam juntas.'])
  items.push(
    [touch ? '🤏' : '🔍', 'Zoom', touch ? 'Pinça com dois dedos aproxima e afasta. Toque duplo volta ao normal.' : 'Roda do mouse, pinça no trackpad ou + e −. Duplo clique ou 0 volta ao normal.'],
    ['💥', 'Atropele os recortes', 'Cada recorte abre uma parte da história e devolve 1 vida.'],
    ['🌲', 'Cuidado!', `Você tem ${LIVES.start} vidas. Bater em árvores ou encostar nas onças tira 1 vida.`],
    ['🎮', buttons ? 'Prefere arrastar a bike?' : 'Prefere botões?', buttons ? 'Oculte os botões no 🎮 do topo para mover a bike arrastando.' : 'Ligue os botões de direção no 🎮 do topo.'],
  )
  return { title: touch ? 'Como jogar no celular' : 'Como jogar no computador', items }
}

/**
 * HTML da lista de instruções (reaproveitado pela janela inicial).
 * @param {string[][]} items linhas [ícone, ação, explicação]
 * @returns {string}
 */
export const instructionsHTML = (items) =>
  `<ul class="guide">${items
    .map(([icon, action, text]) => `<li><span class="guide-icon" aria-hidden="true">${icon}</span><div><strong>${action}</strong><p>${text}</p></div></li>`)
    .join('')}</ul>`

/**
 * Abre o guia.
 * - kind:   gesto inválido que motivou o aviso (null quando aberto pelo botão Ajuda)
 * - device: 'touch' ou 'desktop' (padrão: detectado automaticamente)
 */
export function showGuide({ kind = null, device = isTouchDevice() ? 'touch' : 'desktop' } = {}) {
  const guide = buildInstructions(device)
  const reason = kind && REASONS[kind] ? `<p class="guide-reason">${REASONS[kind]}</p>` : ''
  // Com a dica automática desligada, o botão vira "reativar"
  const toggle = isGuideDisabled()
    ? '<button class="btn ghost" data-guide="enable">Voltar a mostrar dicas automáticas</button>'
    : '<button class="btn ghost" data-guide="disable">Não mostrar esta dica novamente</button>'

  ui.open(
    `<p class="tag">Guia de navegação</p>
     <h2>${guide.title}</h2>
     ${reason}
     ${instructionsHTML(guide.items)}
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

// Gesto inválido confirmado → mostra o guia (se o visitante não desativou e passou o intervalo mínimo)
onInvalidGesture(({ kind, device }) => {
  if (isGuideDisabled()) return
  const now = performance.now()
  if (now - lastAutoShow < COOLDOWN_MS) return
  lastAutoShow = now
  showGuide({ kind, device })
})

// Botão "? Ajuda" do topo: abre sempre (e devolve o teclado para a bike)
document.querySelector('#btn-help')?.addEventListener('click', (e) => {
  e.currentTarget.blur()
  showGuide()
})
