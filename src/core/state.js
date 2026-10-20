import { ITEMS } from '../data/level.js'

/*
  Progresso do jogador. Fica só no sessionStorage: vale enquanto a aba
  estiver aberta e some ao fechá-la. Nada é enviado a servidor.
*/
const STORAGE_KEY = 'mmj-portfolio:v1'

function load() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

// Ids de versões antigas do level (ou duplicados) não podem inflar o contador do inventário
const VALID_IDS = new Set(ITEMS.map((it) => it.id))
const validIds = (list) => (Array.isArray(list) ? [...new Set(list)].filter((id) => VALID_IDS.has(id)) : [])

const saved = load()
export const state = { collected: validIds(saved.collected), links: validIds(saved.links), won: saved.won === true }
const listeners = []

function save() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // modo privado / storage bloqueado: o jogo segue funcionando em memória
  }
  listeners.forEach((fn) => fn(state))
}

export const onStateChange = (fn) => listeners.push(fn)
export const isComplete = () => ITEMS.every((it) => state.collected.includes(it.id))
export const progress = () => state.collected.length / ITEMS.length

/** Retorna true se o recorte foi coletado agora (primeira vez). */
export function collect(id) {
  if (state.collected.includes(id)) return false
  state.collected.push(id)
  save()
  return true
}

export function markLink(id) {
  if (state.links.includes(id)) return
  state.links.push(id)
  save()
}

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
