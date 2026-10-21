/*
  Detecção do tipo de dispositivo (touch x mouse/teclado).

  Notebooks com tela touch existem, então a melhor pista é o próprio evento:
  o `pointerType` diz se o gesto veio de um dedo, de uma caneta ou do mouse.
  Quando não há evento, usamos as media queries de ponteiro do navegador.
*/

// Media queries avaliadas uma vez e reaproveitadas (são baratas, mas não precisam ser recriadas)
const coarsePointer = matchMedia('(pointer: coarse)')
const anyFinePointer = matchMedia('(any-pointer: fine)')

// Último tipo de ponteiro realmente usado pelo visitante (atualizado a cada toque/clique)
let lastPointerType = null
addEventListener('pointerdown', (e) => (lastPointerType = e.pointerType), { passive: true, capture: true })

/** true quando o aparelho é principalmente touch (celular/tablet). */
export function isTouchDevice() {
  if (lastPointerType) return lastPointerType !== 'mouse'
  // Tela touch sem mouse "fino" conectado = celular/tablet
  return coarsePointer.matches || (navigator.maxTouchPoints > 0 && !anyFinePointer.matches)
}

/**
 * Retorna 'touch' ou 'desktop' para um evento. Eventos de teclado e roda do
 * mouse são sempre 'desktop'; eventos de ponteiro usam o `pointerType`.
 */
export function deviceFromEvent(e) {
  if (e?.pointerType) return e.pointerType === 'mouse' ? 'desktop' : 'touch'
  if (e && (e.type?.startsWith('key') || e.type === 'wheel' || e.type === 'contextmenu')) return 'desktop'
  return isTouchDevice() ? 'touch' : 'desktop'
}
