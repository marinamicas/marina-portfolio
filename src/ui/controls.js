import { releaseVirtualKeys, setVirtualKey } from '../core/input.js'
import { toast } from './effects.js'

/* ==========================================================================
   BOTÕES DE DIREÇÃO NA TELA (◀ ▶ ▲ ▼ ⚡)

   Papel deste arquivo:
   - Ligar os botões .touch-controls do index.html aos comandos virtuais de
     core/input.js (setVirtualKey). Segurar um botão = segurar a tecla equivalente.
   - Cada botão acompanha o SEU dedo (Pointer Events + setPointerCapture): dá para
     virar e acelerar ao mesmo tempo, com dois dedos, sem um botão "roubar" o outro.
   - Mostrar/ocultar os botões (botão 🎮 "Botões" no topo). A escolha fica salva
     no localStorage e vale nas próximas visitas.
   - Regra de interação pedida no projeto:
       botões VISÍVEIS → tocar/arrastar a bike NÃO a move (use os botões ou o teclado);
       botões OCULTOS  → clique/toque e arraste na bike volta a funcionar.
     pointerControls.js consulta controlsVisible() para decidir.
   - Destacar o botão que corresponde à tecla pressionada no teclado (syncControls),
     mostrando que teclado e botões são o mesmo comando.

   Dependências: core/input.js, ui/effects.js (toast).
   Usado por: main.js (syncControls por quadro), pointerControls.js (controlsVisible),
   guide.js e onboarding.js (texto das instruções conforme o modo).

   Onde mexer:
   - Quais botões existem e onde ficam → index.html (.touch-controls) e main.css (--pad-size).
   - Começar com os botões ocultos → troque DEFAULT_VISIBLE para false.
   - Mapa botão → comando → atributo data-key no HTML (forward, back, left, right, boost).
   ========================================================================== */

/** Chave no localStorage onde a preferência "botões visíveis?" é guardada ('1' ou '0'). */
const STORAGE_KEY = 'mmj-portfolio:botoes-na-tela'
/** Estado inicial quando o visitante nunca escolheu: botões visíveis. */
const DEFAULT_VISIBLE = true

const root = document.querySelector('.touch-controls')
const toggle = document.querySelector('#btn-controls')
/** Todos os botões com data-key (um por comando). */
const buttons = [...document.querySelectorAll('.touch-controls [data-key]')]

/** Lê a preferência salva (ou o padrão se não houver / storage bloqueado). */
function loadPref() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === null ? DEFAULT_VISIBLE : v === '1'
  } catch {
    return DEFAULT_VISIBLE
  }
}

/** true = botões na tela visíveis (e arrastar a bike desligado). */
let visible = loadPref()
/** Funções avisadas quando o modo muda (ex.: pointerControls cancela um arraste em andamento). */
const listeners = []

/** Botões visíveis agora? */
export const controlsVisible = () => visible

/** Inscreve uma função chamada com `visible` sempre que o modo muda. */
export const onControlsChange = (fn) => listeners.push(fn)

/**
 * Aplica o modo na página: classe no <body> (o CSS esconde/mostra), estado do botão 🎮
 * (aria-pressed e texto da dica), solta comandos presos e avisa os inscritos.
 * @param {boolean} show
 * @param {{save?: boolean, announce?: boolean}} [o] save = gravar a escolha; announce = mostrar aviso
 */
export function setControlsVisible(show, { save = true, announce = false } = {}) {
  visible = show
  document.body.classList.toggle('controls-off', !show)
  if (toggle) {
    toggle.setAttribute('aria-pressed', String(show))
    toggle.title = show ? 'Ocultar botões e arrastar a bike com o dedo/mouse' : 'Mostrar botões de direção na tela'
  }
  releaseVirtualKeys()
  buttons.forEach((b) => b.classList.remove('is-down'))
  if (save) {
    try {
      localStorage.setItem(STORAGE_KEY, show ? '1' : '0')
    } catch {
      // storage bloqueado: a escolha vale só nesta visita
    }
  }
  if (announce) {
    toast(show ? '🎮 Botões na tela ligados. Arrastar a bike fica desligado.' : '✋ Botões ocultos: toque/clique na bike e arraste para pedalar.')
  }
  listeners.forEach((fn) => fn(show))
}

/* ---------------- Cada botão: um dedo próprio ---------------- */
for (const btn of buttons) {
  const key = btn.dataset.key
  /** id do ponteiro (dedo/mouse) que está segurando este botão, ou null. */
  let owner = null
  // pointerdown: começa a segurar. setPointerCapture garante que o soltar chegue a ESTE botão
  // mesmo se o dedo escorregar para fora dele. preventDefault evita seleção/zoom/menu.
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    if (owner !== null) return
    owner = e.pointerId
    btn.setPointerCapture(e.pointerId)
    btn.classList.add('is-down')
    setVirtualKey(key, true)
  })
  /** Solta o botão (só se for o mesmo dedo que o segurou). */
  const release = (e) => {
    if (e.pointerId !== owner) return
    owner = null
    btn.classList.remove('is-down')
    setVirtualKey(key, false)
  }
  btn.addEventListener('pointerup', release)
  btn.addEventListener('pointercancel', release)
  btn.addEventListener('lostpointercapture', release)
  // Sem menu de "segurar" do celular nem clique fantasma depois do toque
  btn.addEventListener('contextmenu', (e) => e.preventDefault())
  btn.addEventListener('click', (e) => e.preventDefault())
}
// Toques nas laterais vazias da barra de controles não devem virar gestos no canvas
root?.addEventListener('pointerdown', (e) => e.stopPropagation())

// Botão 🎮 "Botões": alterna o modo e explica a mudança
toggle?.addEventListener('click', () => {
  toggle.blur() // o teclado volta a pilotar a bike
  setControlsVisible(!visible, { announce: true })
})

/**
 * Chamada uma vez por quadro por main.js com o `input` já lido: acende o botão
 * correspondente quando o comando vem do TECLADO (ex.: W acende ▲), deixando claro
 * que teclado e botões são o mesmo comando. Botões segurados pelo dedo já estão acesos.
 * @param {{forward:number, turn:number, boost:boolean}} input
 */
export function syncControls(input) {
  if (!visible) return
  for (const b of buttons) {
    const k = b.dataset.key
    const on =
      (k === 'forward' && input.forward > 0) ||
      (k === 'back' && input.forward < 0) ||
      (k === 'left' && input.turn > 0) ||
      (k === 'right' && input.turn < 0) ||
      (k === 'boost' && input.boost)
    if (b.classList.contains('is-down') !== on) b.classList.toggle('is-down', on)
  }
}

// Aplica a preferência salva ao carregar (sem gravar de novo nem mostrar aviso)
setControlsVisible(visible, { save: false })
