import { ITEMS } from '../data/level.js'

/* ==========================================================================
   PROGRESSO DO JOGADOR (inventário salvo na aba)

   Papel deste arquivo:
   - Guarda o estado do jogo que precisa sobreviver a um F5: quais recortes
     já foram atropelados (`collected`), quais links "saiba mais" já foram
     abertos (`links`) e se a janela "Você zerou!" já apareceu (`won`).
   - Fica só no sessionStorage: vale enquanto a aba estiver aberta e some ao
     fechá-la. Nada é enviado a servidor.
   - Avisa quem se inscreveu (onStateChange) toda vez que algo muda, para o
     HUD (barra de conhecimento, contador do inventário) se atualizar sozinho.

   Dependências: ITEMS de src/data/level.js (para validar os ids).
   Quem usa: main.js (collect), screens.js (progress, isComplete, markLink,
   markWon, onStateChange), pins.js (markLink), timeMachine.js (resetProgress).

   Onde mexer:
   - STORAGE_KEY: troque a versão (v1 → v2) para "esquecer" o progresso salvo
     de todos os visitantes depois de uma mudança grande no level.
   - Para trocar sessionStorage por localStorage (progresso que sobrevive a
     fechar o navegador), troque nas funções load() e save().
   ========================================================================== */
// Nome da chave no sessionStorage onde o JSON do estado é gravado
const STORAGE_KEY = 'mmj-portfolio:v1'

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

// Estado carregado uma vez, ao abrir a página
const saved = load()
/**
 * Estado global do progresso (objeto único, compartilhado por todos os módulos).
 * - collected: ids dos recortes já atropelados (na ordem em que foram conquistados)
 * - links:     ids dos recortes cujo "saiba mais" já foi clicado
 * - won:       true depois que a janela "Você zerou!" apareceu uma vez
 */
export const state = { collected: validIds(saved.collected), links: validIds(saved.links), won: saved.won === true }
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

/** Apaga todo o inventário (usado só em Sair → Tentar novamente → Resetar tudo). */
export function resetProgress() {
  state.collected = []
  state.links = []
  state.won = false
  save()
}
