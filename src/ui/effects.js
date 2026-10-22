import gsap from 'gsap'
import { PALETTE } from '../data/level.js'
import { rand, REDUCED_MOTION } from '../utils/helpers.js'

/* ==========================================================================
   EFEITOS VISUAIS EM HTML (por cima do mundo 3D)

   Papel deste arquivo: dois efeitos feitos com elementos HTML animados pelo
   GSAP, sem mexer na cena 3D:
   - toast(): o aviso roxo que aparece embaixo da tela e some sozinho;
   - paperBurst(): a chuva de triângulos de papel quando um recorte é atropelado.

   Depende de: gsap, PALETTE (cores) de data/level.js, rand/REDUCED_MOTION de helpers.js.
   Quem usa: main.js (avisos e explosão), timeMachine.js, screens.js, guide.js,
   viewer.js (avisos).
   Aparência: #toast e .paper-bit em src/styles/main.css.

   Onde mexer:
   - toast(message, seconds): o 2º parâmetro é o tempo em segundos que o aviso
     fica na tela (padrão 3,5 s).
   - paperBurst: `count` (quantidade de triângulos), `duration` e o quanto eles
     se espalham (frações de innerWidth/innerHeight).
   ========================================================================== */

/**
 * Linha do tempo (GSAP) do aviso que está na tela agora. Guardada para que um
 * aviso novo cancele o anterior (senão dois avisos brigariam pelo mesmo elemento).
 * null = nenhum aviso em andamento.
 */
let toastTl = null

/**
 * Mostra um aviso roxo embaixo da tela por `seconds` segundos.
 *
 * Como funciona: escreve o texto no elemento #toast, mata a animação anterior
 * (se houver), faz o aviso subir 20 px aparecendo (0,4 s), espera `seconds`
 * e depois o esconde (0,4 s). autoAlpha anima opacidade + visibility juntos,
 * então o aviso escondido não bloqueia cliques.
 * @param {string} message texto do aviso
 * @param {number} [seconds=3.5] tempo visível, em segundos
 * @param {{hurt?: boolean}} [o] hurt = aviso vermelho (perdeu vida)
 */
export function toast(message, seconds = 3.5, { hurt = false } = {}) {
  const el = document.querySelector('#toast')
  el.textContent = message
  el.classList.toggle('hurt', hurt)
  toastTl?.kill()
  toastTl = gsap
    .timeline()
    .fromTo(el, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.4 })
    .to(el, { autoAlpha: 0, duration: 0.4 }, `+=${seconds}`)
}

/**
 * Chuva de triângulos de papel saindo do ponto (cx, cy) da tela, em pixels.
 * É uma camada DOM por cima do 3D: cada triângulo é um <i class="paper-bit">
 * criado na hora e removido quando a animação termina.
 *
 * Como funciona:
 * - cria `count` elementos (40; só 10 se a pessoa pediu menos animação no sistema);
 * - cada um recebe uma das 4 cores da paleta, em sequência;
 * - o GSAP anima do ponto de origem até um destino aleatório: até ±60% da largura
 *   da tela para os lados e de -70% (para cima) a +40% (para baixo) da altura,
 *   girando até ±720° (2 voltas), sumindo em 1 a 1,8 s com desaceleração forte
 *   (power3.out = sai rápido e freia).
 * Chamada por main.js no atropelo, com a posição do recorte projetada na tela.
 * @param {number} cx x na tela (px)
 * @param {number} cy y na tela (px)
 */
export function paperBurst(cx, cy) {
  const colors = [PALETTE.white, PALETTE.purple, PALETTE.lilac, PALETTE.black]
  const count = REDUCED_MOTION ? 10 : 40
  for (let i = 0; i < count; i++) {
    const el = document.createElement('i')
    el.className = 'paper-bit' // o CSS dá o formato triangular (clip-path) e o tamanho (18 px)
    el.style.background = colors[i % colors.length]
    document.body.appendChild(el)
    gsap.fromTo(
      el,
      { x: cx, y: cy, scale: rand(0.5, 1.6), rotation: 0 }, // tamanho inicial entre 50% e 160%
      {
        x: cx + rand(-0.6, 0.6) * innerWidth,
        y: cy + rand(-0.7, 0.4) * innerHeight,
        rotation: rand(-720, 720),
        autoAlpha: 0,
        duration: rand(1, 1.8),
        ease: 'power3.out',
        onComplete: () => el.remove(), // limpa o DOM: nada fica acumulado depois do efeito
      },
    )
  }
}

/** Camada com o brilho vermelho nas bordas (criada uma vez; o CSS .hurt-flash define a aparência). */
const flash = document.createElement('div')
flash.className = 'hurt-flash'
flash.setAttribute('aria-hidden', 'true')
document.body.appendChild(flash)

/**
 * Clarão vermelho nas bordas da área do jogo ao perder vida (aparece rápido e some em 0,6 s).
 * Chamada por main.js quando a bike bate numa árvore ou encosta numa onça.
 */
export function hurtFlash() {
  gsap.fromTo(flash, { opacity: 1 }, { opacity: 0, duration: REDUCED_MOTION ? 0.2 : 0.6, ease: 'power2.out', overwrite: true })
}
