/* ==========================================================================
   DETECÇÃO DO TIPO DE DISPOSITIVO (touch x mouse/teclado)

   Papel deste arquivo:
   - Responder "o visitante está usando dedo (celular/tablet) ou mouse (PC)?".
   - O guia de navegação (src/ui/guide.js) usa isso para mostrar as instruções
     certas, e o detector de gestos inválidos (invalidGestures.js) recebe o
     tipo de aparelho em cada ocorrência.

   Notebooks com tela touch existem, então a melhor pista é o próprio evento:
   o `pointerType` diz se o gesto veio de um dedo, de uma caneta ou do mouse.
   Quando não há evento, usamos as media queries de ponteiro do navegador.

   Dependências: nenhuma (só APIs do navegador: matchMedia, Pointer Events).
   Quem usa: src/ui/guide.js, src/ui/viewer.js, src/core/pointerControls.js.

   Onde mexer:
   - isTouchDevice(): regra de desempate quando ainda não houve nenhum toque/clique.
   - deviceFromEvent(): quais tipos de evento contam como 'desktop'.
   ========================================================================== */

// Media queries avaliadas uma vez e reaproveitadas (são baratas, mas não precisam ser recriadas)
// (pointer: coarse) = o ponteiro principal é impreciso (dedo); (any-pointer: fine) = existe algum ponteiro preciso (mouse/trackpad)
const coarsePointer = matchMedia('(pointer: coarse)')
const anyFinePointer = matchMedia('(any-pointer: fine)')

// Último tipo de ponteiro realmente usado pelo visitante (atualizado a cada toque/clique).
// Valores possíveis: 'mouse', 'touch', 'pen' ou null (ainda não houve nenhum pointerdown).
let lastPointerType = null
// Escuta TODO pointerdown da página (capture: true = pega antes de qualquer outro listener,
// mesmo que alguém pare a propagação; passive: true = nunca chama preventDefault, o navegador
// pode otimizar). Só anota o tipo do ponteiro; não faz mais nada.
addEventListener('pointerdown', (e) => (lastPointerType = e.pointerType), { passive: true, capture: true })

/**
 * true quando o aparelho é principalmente touch (celular/tablet).
 * Como decide:
 * 1. Se o visitante já tocou/clicou em algo, vale o tipo desse último gesto
 *    (qualquer coisa diferente de 'mouse' conta como touch: dedo ou caneta).
 * 2. Senão, usa as media queries: tela com ponteiro impreciso, ou tela touch
 *    sem nenhum mouse "fino" conectado = celular/tablet.
 * @returns {boolean}
 */
export function isTouchDevice() {
  if (lastPointerType) return lastPointerType !== 'mouse'
  // Tela touch sem mouse "fino" conectado = celular/tablet
  return coarsePointer.matches || (navigator.maxTouchPoints > 0 && !anyFinePointer.matches)
}

/**
 * Retorna 'touch' ou 'desktop' para um evento. Eventos de teclado e roda do
 * mouse são sempre 'desktop'; eventos de ponteiro usam o `pointerType`.
 * Sem evento (ou evento sem pista), cai em isTouchDevice().
 * @param {Event} [e] - evento de ponteiro, teclado, roda ou contextmenu
 * @returns {'touch'|'desktop'}
 */
export function deviceFromEvent(e) {
  if (e?.pointerType) return e.pointerType === 'mouse' ? 'desktop' : 'touch'
  if (e && (e.type?.startsWith('key') || e.type === 'wheel' || e.type === 'contextmenu')) return 'desktop'
  return isTouchDevice() ? 'touch' : 'desktop'
}
