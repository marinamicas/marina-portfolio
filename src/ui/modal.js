import gsap from 'gsap'

const modal = document.querySelector('#modal')
const card = modal.querySelector('.modal-card')
const content = document.querySelector('#modal-content')

/** Janela flutuante única, reaproveitada por todas as telas. */
export const ui = {
  content,
  isOpen: false,
  onClose: null,
  viewerOpen: false, // visualizador em tela cheia (links externos) aberto por cima de tudo

  /** true quando alguma camada (janela ou visualizador) cobre o jogo: a bike e os gestos ficam pausados. */
  isBlocked() {
    return this.isOpen || this.viewerOpen
  },

  open(html, { onClose = null, className = '' } = {}) {
    content.innerHTML = html
    card.className = `modal-card ${className}`.trim()
    modal.classList.remove('hidden')
    this.isOpen = true
    this.onClose = onClose
    gsap.fromTo(card, { scale: 0.7, rotation: -4, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.5, ease: 'back.out(1.7)', overwrite: true })
    card.querySelector('.btn, a, button:not(.modal-close)')?.focus({ preventScroll: true })
  },

  close() {
    if (!this.isOpen) return
    this.isOpen = false
    const cb = this.onClose
    this.onClose = null
    gsap.to(card, {
      scale: 0.8,
      autoAlpha: 0,
      duration: 0.25,
      overwrite: true,
      onComplete: () => {
        if (!this.isOpen) modal.classList.add('hidden')
        cb?.()
      },
    })
    document.activeElement?.blur()
  },
}

// Fecha pelo ×, clicando fora do cartão ou com Esc
modal.querySelector('.modal-close').addEventListener('click', () => ui.close())
modal.addEventListener('click', (e) => {
  if (e.target === modal) ui.close() // clique fora do cartão
})
addEventListener('keydown', (e) => {
  if (e.code === 'Escape') ui.close()
})
