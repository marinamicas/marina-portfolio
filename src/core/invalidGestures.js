/* ==========================================================================
   DETECTOR DE GESTOS INVÁLIDOS

   Papel deste arquivo:
   - Perceber quando a pessoa tenta navegar de um jeito que o site não suporta
     (toques soltos esperando que a bike vá até lá, botão direito, três dedos,
     segurar o dedo parado, deslizar para os lados, teclas sem função).
   - Um gesto isolado "errado" (um clique solto, uma tecla qualquer) não deve
     incomodar ninguém. Por isso cada tipo de gesto tem um limite: só quando ele
     se repete X vezes dentro de uma janela de tempo é que consideramos que a
     pessoa está tentando navegar de um jeito que o site não suporta.
   - Este arquivo NÃO mostra nada na tela: quem quiser reagir (ex.: o modal
     guia em src/ui/guide.js) se inscreve com onInvalidGesture().

   Dependências: nenhuma.
   Quem registra gestos: pointerControls.js (toques, cliques, dedos, segurar),
   input.js (teclas e rolagem horizontal). Quem liga/desliga: main.js
   (setDetectorGuard). Quem reage: guide.js (onInvalidGesture).

   Onde mexer:
   - RULES: quantas repetições (threshold) em quanto tempo (windowMs) disparam
     o aviso de cada gesto. Para desligar um gesto, apague a linha dele.
   ========================================================================== */

/**
 * Regras por tipo de gesto.
 * - threshold: quantas repetições disparam o aviso (1 = dispara na primeira vez)
 * - windowMs:  em quanto tempo essas repetições precisam acontecer (ms; 0 = irrelevante quando threshold é 1)
 * Para o aviso aparecer MENOS, aumente threshold ou diminua windowMs.
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

const history = new Map() // tipo de gesto → lista de horários (ms, performance.now()) das últimas ocorrências
const listeners = [] // funções inscritas com onInvalidGesture(); recebem { kind, device }
let enabled = () => true // função que diz se o detector deve agir agora (definida pelo jogo via setDetectorGuard)

/**
 * Define quando o detector está ativo (ex.: só com o jogo rodando e sem janelas abertas).
 * main.js passa `() => playing && !ui.isBlocked() && !bike.locked`.
 * @param {() => boolean} fn
 */
export function setDetectorGuard(fn) {
  enabled = fn
}

/**
 * Inscreve uma função que recebe { kind, device } quando um gesto inválido é confirmado.
 * `kind` é uma chave de RULES; `device` é 'touch' ou 'desktop'.
 * @param {(info: {kind: string, device: string}) => void} fn
 */
export function onInvalidGesture(fn) {
  listeners.push(fn)
}

/**
 * Esquece as ocorrências de um tipo (ex.: o toque virou um toque duplo válido).
 * Assim o primeiro toque de um toque duplo não conta como "toque solto".
 * @param {string} kind - chave de RULES
 */
export function forgetGesture(kind) {
  history.delete(kind)
}

/**
 * Registra uma ocorrência do gesto `kind`, feita no dispositivo `device`
 * ('touch' ou 'desktop'). Retorna true se o aviso foi disparado.
 * Como funciona:
 * 1. Se o detector está desligado ou o gesto não tem regra, ignora.
 * 2. Mantém só as ocorrências recentes (dentro de windowMs) e acrescenta a atual.
 * 3. Se ainda não chegou em threshold, só guarda e devolve false.
 * 4. Se chegou: zera o histórico desse gesto (para não disparar de novo no
 *    próximo toque) e avisa todos os inscritos.
 * @param {string} kind - chave de RULES
 * @param {'touch'|'desktop'} device
 * @returns {boolean}
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
