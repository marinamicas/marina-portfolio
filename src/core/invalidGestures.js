/*
  Detector de gestos inválidos.

  Um gesto isolado "errado" (um clique solto, uma tecla qualquer) não deve
  incomodar ninguém. Por isso cada tipo de gesto tem um limite: só quando ele
  se repete X vezes dentro de uma janela de tempo é que consideramos que a
  pessoa está tentando navegar de um jeito que o site não suporta.

  Quem quiser reagir (ex.: o modal guia) se inscreve com onInvalidGesture().
*/

/**
 * Regras por tipo de gesto.
 * - threshold: quantas repetições disparam o aviso
 * - windowMs:  em quanto tempo essas repetições precisam acontecer
 */
export const RULES = {
  tap: { threshold: 3, windowMs: 3000 }, // toques rápidos esperando que a bike vá até o ponto
  click: { threshold: 3, windowMs: 3000 }, // cliques soltos no mundo (sem arrastar)
  'long-press': { threshold: 1, windowMs: 0 }, // dedo parado segurando a tela
  'multi-finger': { threshold: 1, windowMs: 0 }, // três ou mais dedos na tela
  'right-click': { threshold: 1, windowMs: 0 }, // botão direito no mundo 3D
  'middle-click': { threshold: 1, windowMs: 0 }, // botão do meio (rodinha clicada)
  'horizontal-scroll': { threshold: 4, windowMs: 1200 }, // deslizar o trackpad para os lados
  'unsupported-key': { threshold: 4, windowMs: 3000 }, // teclas que não fazem nada no jogo
}

const history = new Map() // tipo de gesto → lista de horários (ms) das últimas ocorrências
const listeners = []
let enabled = () => true // função que diz se o detector deve agir agora (definida pelo jogo)

/** Define quando o detector está ativo (ex.: só com o jogo rodando e sem janelas abertas). */
export function setDetectorGuard(fn) {
  enabled = fn
}

/** Inscreve uma função que recebe { kind, device } quando um gesto inválido é confirmado. */
export function onInvalidGesture(fn) {
  listeners.push(fn)
}

/** Esquece as ocorrências de um tipo (ex.: o toque virou um toque duplo válido). */
export function forgetGesture(kind) {
  history.delete(kind)
}

/**
 * Registra uma ocorrência do gesto `kind`, feita no dispositivo `device`
 * ('touch' ou 'desktop'). Retorna true se o aviso foi disparado.
 */
export function registerGesture(kind, device) {
  if (!enabled()) return false
  const rule = RULES[kind]
  if (!rule) return false

  const now = performance.now()
  // Mantém só as ocorrências dentro da janela de tempo da regra
  const times = (history.get(kind) ?? []).filter((t) => now - t <= rule.windowMs)
  times.push(now)
  history.set(kind, times)
  if (times.length < rule.threshold) return false

  history.delete(kind) // recomeça a contagem depois de confirmar
  listeners.forEach((fn) => fn({ kind, device }))
  return true
}
