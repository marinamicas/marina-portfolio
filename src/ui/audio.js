import { AUDIO } from '../data/level.js'
import { toast } from './effects.js'

// Importando as imagens para que o Vite as processe corretamente no build
import iconSomLigado from '../assets/ui/icons/som_ligado.png'
import iconSomDesligado from '../assets/ui/icons/som_desligado.png'

/* ==========================================================================
   MÚSICA DE FUNDO + CRÉDITOS

   Papel deste arquivo:
   - Tocar a música de public/<AUDIO.file> em loop, automaticamente.
   - Navegadores BLOQUEIAM som automático até o visitante interagir com a página.
     Por isso: tentamos tocar ao carregar; se o navegador recusar, a música começa
     no primeiro toque, clique ou tecla (por exemplo, o botão "Começar a pedalar").
   - Botão 🔊/🔇 no topo (#btn-sound) liga/desliga e mostra o crédito do autor:
     AUDIO.credit ("Daniel Micas Jardim da Silva"). A escolha fica salva no localStorage.
   - Pausa sozinha quando a aba fica escondida e volta quando ela reaparece.

   Por que o arquivo é .mp3: o arquivo original "som.mpeg" é um MP3. O GitHub Pages
   entrega arquivos .mpeg como vídeo (video/mpeg), e o Firefox se recusa a tocar.
   Com a extensão .mp3 ele chega como áudio (audio/mpeg) em todos os navegadores.

   Dependências: level.js (AUDIO), effects.js (toast).
   Usado por: main.js (initAudio uma vez).

   Onde mexer: AUDIO em src/data/level.js (arquivo, volume, crédito).
   ========================================================================== */

/** Chave no localStorage: 'off' quando o visitante desligou o som. */
const STORAGE_KEY = 'mmj-portfolio:som'

// import.meta.env.BASE_URL = base do Vite ('./'): o arquivo de public/ fica na raiz do site publicado
const audio = new Audio(`${import.meta.env.BASE_URL}${AUDIO.file}`)
audio.loop = true
audio.volume = AUDIO.volume
audio.preload = 'auto'

const button = document.querySelector('#btn-sound')
const icon = button?.querySelector('.sound-icon')
const label = button?.querySelector('.sound-text strong')
const credit = button?.querySelector('.sound-text small')

/** O visitante quer som? (true até ele desligar; a escolha é lembrada) */
let wanted = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
})()

/** Atualiza ícone, texto e estado acessível do botão conforme o som está tocando ou não. */
function render() {
  const playing = !audio.paused
  
  // Atualiza o caminho da imagem usando as variáveis importadas no topo
  if (icon) {
    icon.src = playing ? iconSomLigado : iconSomDesligado;
    icon.alt = playing ? 'Som ligado' : 'Som desligado';
  }

  // Atualiza o texto do botão
  if (label) label.textContent = playing ? 'Som ligado' : wanted ? 'Toque para ouvir' : 'Som desligado'
  
  // Atributos de acessibilidade
  button?.setAttribute('aria-pressed', String(playing))
  button?.setAttribute('aria-label', `${playing ? 'Desligar' : 'Ligar'} música de ${AUDIO.credit}`)
}

/** Tenta tocar; se o navegador bloquear, espera o primeiro gesto do visitante. */
function tryPlay() {
  if (!wanted) return render()
  audio.play().then(render, () => {
    render()
    // Primeiro toque/clique/tecla em qualquer lugar: agora o navegador deixa tocar
    const unlock = (e) => {
      // Gesto no próprio botão de som: quem decide é o clique dele (senão tocaria e pausaria em seguida)
      if (button?.contains(e.target)) return
      removeEventListener('pointerdown', unlock, true)
      removeEventListener('keydown', unlock, true)
      if (wanted && audio.paused) audio.play().then(render, render)
    }
    addEventListener('pointerdown', unlock, true)
    addEventListener('keydown', unlock, true)
  })
}

/** Grava a preferência do visitante (ligado/desligado). */
function savePref() {
  try {
    localStorage.setItem(STORAGE_KEY, wanted ? 'on' : 'off')
  } catch {
    // storage bloqueado: vale só nesta visita
  }
}

/** Liga a música e o botão. Chamada uma vez por main.js. */
export function initAudio() {
  if (credit) credit.textContent = `♪ ${AUDIO.credit}`
  button?.addEventListener('click', () => {
    button.blur() // o teclado volta a pilotar a bike
    if (audio.paused) {
      wanted = true
      audio.play().then(() => {
        render()
        toast(`🎵 Música de ${AUDIO.credit}`, 3)
      }, render)
    } else {
      wanted = false
      audio.pause()
      render()
    }
    savePref()
  })
  // Aba escondida: pausa (economiza bateria); voltou: retoma se o visitante quer som
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.pause()
    else if (wanted) audio.play().then(render, render)
    render()
  })
  audio.addEventListener('play', render)
  audio.addEventListener('pause', render)
  tryPlay()
}