import { ui } from './modal.js'
import { buildInstructions, instructionsHTML } from './guide.js'
import iconCurriculo from '../assets/ui/icons/curriculo.png'

/* ==========================================================================
   JANELA INICIAL DE INSTRUÇÕES (onboarding)

   Aparece logo depois da abertura (triângulo neon + bike saindo da terra).
   Mostra SÓ as instruções de jogabilidade, montadas na hora para o aparelho
   (celular ou computador) e o modo de controle atual (botões na tela ou
   arrastar a bike) — a mesma função do botão "? Ajuda" (guide.js).

   Em destaque, o botão do CURRÍCULO: quem quer ver as experiências sem jogar
   abre o PDF direto (nova aba; o jogo continua aqui). Embaixo, "Começar".
   Fechar a janela de qualquer jeito (×, Esc, clique fora) também começa o jogo.

   Dependências: modal.js, guide.js.
   Usado por: main.js (showOnboarding depois da abertura).

   Onde mexer:
   - Textos das instruções → buildInstructions() em guide.js.
   - Texto/endereço do botão do currículo → CV_URL e o HTML abaixo.
   ========================================================================== */

/** Endereço do currículo (o arquivo publicado fica dentro da pasta docs). */
const CV_URL = './docs/curriculo-marina-micas.pdf'

/**
 * Abre a janela inicial.
 * @param {() => void} onStart chamada uma única vez quando o visitante começa (botão ou fechar)
 */
export function showOnboarding(onStart) {
  const guide = buildInstructions()
  let started = false
  const start = () => {
    if (started) return
    started = true
    onStart()
  }
  ui.open(
    `<p class="tag">Como jogar</p>
     <h2>\${guide.title}</h2>
     <a class="btn cv-cta" style=" width: fit-content; box-shadow: none;" href="\${CV_URL}" target="_blank" rel="noopener" data-viewer-skip>
       <span aria-hidden="true"><img src="\${iconCurriculo}" alt="Currículo"></span>
       <span>Ver o currículo agora<small>Para conhecer as experiências sem jogar</small></span>
     </a>
     \${instructionsHTML(guide.items)}
     <div class="actions">
       <button class="btn start-btn" data-onboarding="start">Começar a pedalar ▶</button>
     </div>`,
    { className: 'guide-card onboarding', onClose: start },
  )
  ui.content.querySelector('[data-onboarding="start"]')?.addEventListener('click', () => ui.close(), { once: true })
}