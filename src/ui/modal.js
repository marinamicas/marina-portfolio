import gsap from 'gsap'

/* ==========================================================================
   JANELA FLUTUANTE (modal)

   Papel deste arquivo: controlar a ÚNICA janela flutuante do site (#modal no
   index.html). Todas as telas (item atropelado, inventário, zerou, game over,
   guia de navegação, confirmação de reset…) reaproveitam esse mesmo elemento:
   cada uma só troca o HTML de dentro com ui.open(html).

   Depende de: gsap (animação de abrir/fechar) e dos elementos #modal,
   .modal-card e #modal-content do index.html.
   Quem usa: screens.js, guide.js, timeMachine.js, main.js, pointerControls.js
   (ui.isBlocked), viewer.js (ui.viewerOpen).
   Aparência: bloco "Janelas flutuantes" em src/styles/main.css.

   Onde mexer:
   - Animação de abrir: o gsap.fromTo dentro de open() (scale, rotation, duration, ease).
   - Animação de fechar: o gsap.to dentro de close().
   - Atalhos para fechar: os três addEventListener no fim do arquivo (×, clique fora, Esc).
   ========================================================================== */

// Elementos fixos do index.html (existem desde o carregamento da página)
const modal = document.querySelector('#modal') // fundo escurecido que cobre a tela inteira
const card = modal.querySelector('.modal-card') // o cartão branco no meio
const content = document.querySelector('#modal-content') // onde o HTML de cada tela é injetado

/**
 * Objeto único que representa a janela flutuante.
 *
 * Estados possíveis:
 * - isOpen = false, viewerOpen = false → jogo livre;
 * - isOpen = true → janela aberta: bike parada, gestos no canvas ignorados;
 * - viewerOpen = true → visualizador em tela cheia (viewer.js) aberto por cima
 *   de tudo: o loop do jogo nem roda (main.js checa ui.viewerOpen).
 * Transições: open() → isOpen true; close() → isOpen false (depois da animação,
 * esconde o elemento e chama onClose). viewer.js liga/desliga viewerOpen.
 */
export const ui = {
  content, // exposto para outros módulos escutarem cliques dentro da janela (delegação)
  isOpen: false, // true enquanto a janela está visível
  onClose: null, // função opcional chamada quando a janela fecha (ex.: maybeWin depois de ler um item)
  viewerOpen: false, // visualizador em tela cheia (links externos) aberto por cima de tudo

  /**
   * true quando alguma camada (janela ou visualizador) cobre o jogo: a bike e
   * os gestos ficam pausados. main.js e pointerControls.js consultam isso a cada frame.
   * @returns {boolean}
   */
  isBlocked() {
    return this.isOpen || this.viewerOpen
  },

  /**
   * Abre a janela com o HTML informado.
   *
   * Como funciona:
   * 1. injeta o HTML em #modal-content;
   * 2. define a classe extra do cartão (ex.: 'game-over', 'guide-card') para o CSS variar a aparência;
   * 3. tira o .hidden do fundo e marca isOpen;
   * 4. anima o cartão: começa a 70% do tamanho, girado -4° e invisível, e chega a 100%,
   *    reto e visível em 0,5 s com "quique" (back.out);
   * 5. coloca o foco no primeiro botão/link do cartão (acessibilidade e teclado).
   * @param {string} html conteúdo da janela
   * @param {object} [opts]
   * @param {(() => void)|null} [opts.onClose=null] chamada ao fechar
   * @param {string} [opts.className=''] classe extra para .modal-card
   */
  open(html, { onClose = null, className = '' } = {}) {
    content.innerHTML = html
    card.className = `modal-card ${className}`.trim()
    modal.classList.remove('hidden')
    this.isOpen = true
    this.onClose = onClose
    gsap.fromTo(card, { scale: 0.7, rotation: -4, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.5, ease: 'back.out(1.7)', overwrite: true })
    card.querySelector('.btn, a, button:not(.modal-close)')?.focus({ preventScroll: true })
  },

  /**
   * Fecha a janela (se estiver aberta).
   *
   * Como funciona: marca isOpen = false na hora (o jogo já volta a responder),
   * guarda e limpa o onClose, anima o cartão encolhendo até 80% e sumindo em
   * 0,25 s e, ao terminar, esconde o fundo (só se ninguém abriu outra janela
   * nesse meio-tempo) e chama o onClose. Por fim tira o foco do botão clicado,
   * para o teclado voltar a comandar a bike.
   */
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
// Botão × no canto do cartão
modal.querySelector('.modal-close').addEventListener('click', () => ui.close())
// Clique no fundo escurecido (fora do cartão): e.target é o próprio #modal só quando
// o clique não foi em nenhum filho, então cliques dentro do cartão não fecham nada
modal.addEventListener('click', (e) => {
  if (e.target === modal) ui.close() // clique fora do cartão
})
// Tecla Esc em qualquer lugar da página. (O visualizador em tela cheia captura o Esc
// antes, em viewer.js, para fechar a si mesmo primeiro.)
addEventListener('keydown', (e) => {
  if (e.code === 'Escape') ui.close()
})
