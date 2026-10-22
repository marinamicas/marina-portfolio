import { ITEMS, LIVES } from '../data/level.js'

/* ==========================================================================
   PROGRESSO DO JOGADOR (inventário e vidas salvos na aba)

   Papel deste arquivo:
   - Guarda o estado do jogo que precisa sobreviver a um F5: quais recortes
     já foram atropelados (`collected`), quais links "saiba mais" já foram
     abertos (`links`), se a janela "Você zerou!" já apareceu (`won`) e
     quantas vidas restam (`lives`).
   - Fica só no sessionStorage: vale enquanto a aba estiver aberta e some ao
     fechá-la. Nada é enviado a servidor.
   - Avisa quem se inscreveu (onStateChange) toda vez que algo muda, para o
     HUD (barra de conhecimento, contador do inventário, corações) se atualizar sozinho.

   Dependências: ITEMS e LIVES de src/data/level.js.
   Quem usa: main.js (collect, loseLife, gainLife), screens.js (progress,
   isComplete, markLink, markWon, onStateChange, resetLives), pins.js (markLink),
   timeMachine.js (resetProgress).

   Onde mexer:
   - STORAGE_KEY: troque a versão (v2 → v3) para "esquecer" o progresso salvo
     de todos os visitantes depois de uma mudança grande no level.
   - Quantidade de vidas e quanto cada coisa tira/devolve: LIVES em level.js.
   - Para trocar sessionStorage por localStorage (progresso que sobrevive a
     fechar o navegador), troque nas funções load() e save().
   ========================================================================== */
// Nome da chave no sessionStorage onde o JSON do estado é gravado.
// v2: o recorte da apresentação mudou de comportamento e as vidas entraram no estado.
const STORAGE_KEY = 'mmj-portfolio:v2'

/**
 * Lê o estado salvo no sessionStorage.
 * Se não houver nada salvo, ou o JSON estiver corrompido, ou o storage estiver
 * bloqueado (modo privado), devolve um objeto vazio e o jogo começa do zero.
 * @returns {object} objeto salvo ou {}
 */
function load() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

// Ids de versões antigas do level (ou duplicados) não podem inflar o contador do inventário.
// VALID_IDS = conjunto com os ids que existem HOJE em ITEMS.
const VALID_IDS = new Set(ITEMS.map((it) => it.id))
/**
 * Limpa uma lista de ids vinda do storage: remove duplicados e ids que não
 * existem mais no level. Se não for uma lista, devolve [].
 * @param {unknown} list
 * @returns {string[]}
 */
const validIds = (list) => (Array.isArray(list) ? [...new Set(list)].filter((id) => VALID_IDS.has(id)) : [])

/**
 * Vidas salvas válidas: número inteiro entre 1 e LIVES.start. Qualquer outra coisa
 * (nada salvo, 0, texto) começa com LIVES.start. Zero não é restaurado: quem recarregou
 * a página na tela de "Fim das vidas" recomeça com as vidas cheias.
 * @param {unknown} n
 * @returns {number}
 */
const validLives = (n) => (Number.isInteger(n) && n > 0 && n <= LIVES.start ? n : LIVES.start)

// Estado carregado uma vez, ao abrir a página
const saved = load()
/**
 * Estado global do progresso (objeto único, compartilhado por todos os módulos).
 * - collected: ids dos recortes já atropelados (na ordem em que foram conquistados)
 * - links:     ids dos recortes cujo "saiba mais" já foi clicado
 * - won:       true depois que a janela "Você zerou!" apareceu uma vez
 * - lives:     vidas restantes (0 a LIVES.start)
 */
export const state = {
  collected: validIds(saved.collected),
  links: validIds(saved.links),
  won: saved.won === true,
  lives: validLives(saved.lives),
}
// Funções avisadas a cada save() (ex.: updateHUD em screens.js)
const listeners = []

/**
 * Grava o estado no sessionStorage e avisa todos os inscritos.
 * Se o storage estiver bloqueado, o jogo segue funcionando só em memória.
 */
function save() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // modo privado / storage bloqueado: o jogo segue funcionando em memória
  }
  listeners.forEach((fn) => fn(state))
}

/** Inscreve uma função para ser chamada com o `state` toda vez que ele mudar. */
export const onStateChange = (fn) => listeners.push(fn)
/** true quando TODOS os recortes de ITEMS estão no inventário (100%). */
export const isComplete = () => ITEMS.every((it) => state.collected.includes(it.id))
/** Fração do progresso entre 0 e 1 (ex.: 3 de 10 recortes = 0.3). */
export const progress = () => state.collected.length / ITEMS.length

/**
 * Adiciona um recorte ao inventário.
 * Retorna true se o recorte foi coletado agora (primeira vez); false se já estava lá.
 * Chamada por hitTotem() em main.js a cada atropelo.
 * @param {string} id - id do item (ex.: 'dev-1')
 * @returns {boolean}
 */
export function collect(id) {
  if (state.collected.includes(id)) return false
  state.collected.push(id)
  save()
  return true
}

/**
 * Marca que o "saiba mais" de um recorte foi aberto (janela grande ou janela do chão).
 * Só grava na primeira vez; o inventário mostra "🔗 saiba mais visitado".
 * @param {string} id - id do item
 */
export function markLink(id) {
  if (state.links.includes(id)) return
  state.links.push(id)
  save()
}

/** Registra que a janela "Você zerou!" já foi mostrada (para não repetir). */
export function markWon() {
  state.won = true
  save()
}

/**
 * Tira vidas (batida em árvore ou onça). Nunca fica abaixo de zero.
 * @param {number} [amount=1]
 * @returns {number} vidas restantes depois do dano
 */
export function loseLife(amount = 1) {
  state.lives = Math.max(0, state.lives - amount)
  save()
  return state.lives
}

/**
 * Devolve vidas (explodir um recorte). Nunca passa de LIVES.start.
 * @param {number} [amount=1]
 * @returns {boolean} true se ganhou de fato (false se já estava com as vidas cheias)
 */
export function gainLife(amount = 1) {
  if (state.lives >= LIVES.start) return false
  state.lives = Math.min(LIVES.start, state.lives + amount)
  save()
  return true
}

/** Enche as vidas de novo (Tentar novamente / Manter o inventário). */
export function resetLives() {
  state.lives = LIVES.start
  save()
}

/** Apaga todo o inventário e enche as vidas (botão Resetar ou "Resetar tudo"). */
export function resetProgress() {
  state.collected = []
  state.links = []
  state.won = false
  state.lives = LIVES.start
  save()
}
