import { PALETTE, PROFILE, TEXTS } from '../data/level.js'
import { clamp, escapeHTML } from '../utils/helpers.js'
import { jaggedPath } from '../utils/textures.js'
import { PHOTO_URL } from '../utils/profileImage.js'
import { viewport } from '../core/stage.js'
import { ui } from './modal.js'
import { contactsHTML } from './screens.js'

/* ==========================================================================
   FOTO DE PERFIL — thumbnail no HUD, foto sutil no "céu" e janela "Sobre"

   O que este módulo faz:
   1. Carrega a foto de src/assets/images/<PROFILE.image>. Se o arquivo não
      existir, desenha um retrato provisório em canvas (com duas bolinhas no
      lugar dos olhos, exatamente em PROFILE.eyes) para a pessoa saber onde a
      foto vai aparecer e calibrar a ancoragem.
   2. Thumbnail: preenche o botão `.hud-avatar` do index.html com a foto.
      Clicar nele abre a janela "Sobre a Marina" (foto maior, apresentação,
      easter egg da bicicleta e contatos).
   3. Céu: preenche a camada `.sky-photo` do index.html com a mesma foto, em
      baixa opacidade, e a posiciona de modo que OS OLHOS FIQUEM SEMPRE NO
      MESMO PONTO DA TELA (PROFILE.anchor), em qualquer tamanho de janela.
      Como a camada é fixa na janela do navegador (e não dentro do mundo 3D),
      pan, zoom e rotação da câmera não a afetam.

   Por que a foto do céu fica "por cima" do canvas e não atrás?
   A câmera do jogo olha para baixo, para o chão; o céu de verdade quase nunca
   aparece na tela. Então a camada fica sobre o canvas, mas em modo de mistura
   'screen' (só clareia o que está escuro): o resultado visual é de uma foto
   AO FUNDO, atrás do chão escuro e atrás dos recortes claros, sem cobrir nada.
   A camada tem pointer-events: none, então os gestos passam direto para o jogo.

   Dependências: level.js (PROFILE, TEXTS, PALETTE), modal.js (ui), screens.js
   (contactsHTML), helpers.js, textures.js (jaggedPath).
   Usado por: src/main.js (initProfile) e pelo botão .hud-avatar.

   Onde mexer:
   - Arquivo, posição dos olhos, âncora na tela, opacidade → PROFILE em level.js.
   - Aparência do thumbnail, da camada do céu e da janela → src/styles/main.css
     (blocos "Foto de perfil").
   - Texto da janela "Sobre" → showProfile() abaixo e TEXTS em level.js.
   ========================================================================== */

// URL da foto real (ou null): descoberta em src/utils/profileImage.js, compartilhada com o recorte da apresentação

/** true quando a foto real existe (usado pela janela "Sobre" para avisar que é um retrato provisório). */
export const hasProfilePhoto = Boolean(PHOTO_URL)

/* ---------------- Retrato provisório (enquanto a foto não existe) ---------------- */

/**
 * Desenha em canvas um retrato de papel: fundo lilás com borda recortada, cabeça e
 * ombros em "branco de papel" e dois olhos escuros posicionados EXATAMENTE em
 * PROFILE.eyes. Assim, com a mira (?olhos) ligada, dá para ver a ancoragem funcionando
 * mesmo antes de colocar a foto real.
 * @returns {string} data URL (PNG) pronta para usar em <img src>
 */
function makePlaceholderPortrait() {
  const w = 512
  const h = 640
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')

  // papel lilás com contorno irregular (mesma linguagem dos recortes do jogo)
  ctx.fillStyle = PALETTE.lilac
  jaggedPath(ctx, 10, 10, w - 20, h - 20, 7)
  ctx.fill()

  // triângulos de colagem ao fundo
  for (let i = 0; i < 10; i++) {
    ctx.globalAlpha = 0.25
    ctx.fillStyle = [PALETTE.purple, PALETTE.white, PALETTE.violet][i % 3]
    const x = 40 + Math.random() * (w - 80)
    const y = 40 + Math.random() * (h - 80)
    const s = 20 + Math.random() * 50
    ctx.beginPath()
    ctx.moveTo(x, y - s)
    ctx.lineTo(x + s, y + s)
    ctx.lineTo(x - s, y + s * 0.6)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // cabeça: círculo centrado um pouco abaixo da linha dos olhos
  const eyeY = PROFILE.eyes.y * h
  const eyeX = PROFILE.eyes.x * w
  const headR = w * 0.19
  ctx.fillStyle = PALETTE.white
  ctx.beginPath()
  ctx.arc(eyeX, eyeY + headR * 0.15, headR, 0, Math.PI * 2)
  ctx.fill()
  // ombros: meia elipse larga abaixo da cabeça
  ctx.beginPath()
  ctx.ellipse(eyeX, eyeY + headR * 2.6, headR * 2.1, headR * 1.1, 0, Math.PI, Math.PI * 2)
  ctx.fill()

  // olhos: dois pontos escuros na linha PROFILE.eyes (é isso que a mira ?olhos deve acertar)
  ctx.fillStyle = PALETTE.ink
  for (const dx of [-headR * 0.38, headR * 0.38]) {
    ctx.beginPath()
    ctx.ellipse(eyeX + dx, eyeY, headR * 0.09, headR * 0.12, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // sorriso simples
  ctx.strokeStyle = PALETTE.ink
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(eyeX, eyeY + headR * 0.3, headR * 0.35, Math.PI * 0.15, Math.PI * 0.85)
  ctx.stroke()

  // legenda para quem está editando: diz qual arquivo colocar
  ctx.fillStyle = PALETTE.ink
  ctx.font = `800 ${w * 0.055}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('SUA FOTO AQUI', w / 2, h * 0.84)
  ctx.font = `600 ${w * 0.04}px system-ui, sans-serif`
  ctx.fillText(`src/assets/images/${PROFILE.image}`, w / 2, h * 0.9)
  return c.toDataURL('image/png')
}

/** URL usada em todos os lugares (thumbnail, céu, janela): a foto real ou o retrato provisório. */
export const profileImageURL = PHOTO_URL ?? makePlaceholderPortrait()

/* ---------------- Elementos do index.html ---------------- */
const avatarButton = document.querySelector('.hud-avatar') // botão com a miniatura (canto superior esquerdo)
const avatarImg = avatarButton?.querySelector('img')
const skyLayer = document.querySelector('.sky-photo') // camada fixa por cima do canvas, abaixo do HUD
const skyImg = skyLayer?.querySelector('img')

/* ---------------- Camada do céu: ancoragem dos olhos ---------------- */

/**
 * Calcula tamanho e posição da foto do céu para que:
 * - o ponto dos olhos (PROFILE.eyes, fração da foto) caia exatamente no ponto
 *   PROFILE.anchor da tela (fração da janela);
 * - a foto cubra a tela da esquerda à direita e do topo até a faixa onde ela já
 *   está totalmente transparente (PROFILE.sky.fadeTo), sem deixar buracos.
 *
 * Como: para cada lado da tela calculamos a menor escala que ainda cobre aquele
 * lado mantendo os olhos na âncora; a escala final é a maior das quatro. Depois,
 * posição = âncora − olhos × tamanho (em pixels).
 *
 * Chamada no carregamento da imagem e em todo `resize` (rotação do celular,
 * barra do navegador aparecendo/sumindo, janela redimensionada).
 */
function layoutSky() {
  if (!skyImg || !skyImg.naturalWidth) return
  // Área do jogo (abaixo do cabeçalho): a camada do céu cobre só ela
  const vw = skyLayer.clientWidth || viewport.width
  const vh = skyLayer.clientHeight || viewport.height
  const iw = skyImg.naturalWidth
  const ih = skyImg.naturalHeight
  // limites evitam divisão por zero se alguém colocar olhos em 0 ou 1
  const ex = clamp(PROFILE.eyes.x, 0.05, 0.95)
  const ey = clamp(PROFILE.eyes.y, 0.05, 0.95)
  const ax = clamp(PROFILE.anchor.x, 0, 1)
  const ay = clamp(PROFILE.anchor.y, 0, 1)
  const bottom = clamp(PROFILE.sky.fadeTo, ay + 0.05, 1) // até onde a foto precisa descer
  const scale = Math.max(
    (ax * vw) / (ex * iw), // cobre o lado esquerdo
    ((1 - ax) * vw) / ((1 - ex) * iw), // cobre o lado direito
    (ay * vh) / (ey * ih), // cobre o topo
    ((bottom - ay) * vh) / ((1 - ey) * ih), // cobre até a faixa transparente
  )
  const w = iw * scale
  const h = ih * scale
  const left = ax * vw - ex * w
  const top = ay * vh - ey * h
  skyImg.style.width = `${w}px`
  skyImg.style.height = `${h}px`
  // translate3d em vez de left/top: o navegador move a camada na GPU, sem recalcular layout
  skyImg.style.transform = `translate3d(${left}px, ${top}px, 0)`
}

/**
 * Mira de calibração: com `?olhos` no endereço, desenha uma cruz no ponto PROFILE.anchor.
 * Ajuste PROFILE.eyes até a cruz ficar sobre os olhos da foto (em qualquer tamanho de tela).
 */
function setupEyesMarker() {
  if (!new URLSearchParams(location.search).has('olhos')) return
  const marker = document.createElement('div')
  marker.className = 'eyes-marker'
  marker.title = 'Ponto dos olhos (PROFILE.anchor). Ajuste PROFILE.eyes em src/data/level.js.'
  document.body.appendChild(marker)
  // A âncora é relativa à área do jogo (abaixo do cabeçalho): reposiciona a cada mudança de tamanho
  const place = () => {
    marker.style.left = `${viewport.left + PROFILE.anchor.x * viewport.width}px`
    marker.style.top = `${viewport.top + PROFILE.anchor.y * viewport.height}px`
  }
  place()
  addEventListener('viewport-change', place)
}

/* ---------------- Janela "Sobre a Marina" ---------------- */

/**
 * Abre a janela com a foto grande, a apresentação, o easter egg da bicicleta e os contatos.
 * Chamada pelo clique no thumbnail (.hud-avatar) e ao atropelar o primeiro recorte (main.js).
 * @param {{onClose?: Function}} [o] onClose = o que fazer quando a janela fechar
 *   (no atropelo: verificar se o jogo foi zerado)
 */
export function showProfile({ onClose = null } = {}) {
  const note = hasProfilePhoto ? '' : '<small class="profile-hint">Retrato provisório: coloque sua foto em src/assets/images/.</small>'
  ui.open(
    `<div class="profile-card">
       <figure class="profile-photo">
         <img src="${profileImageURL}" alt="${escapeHTML(PROFILE.alt)}" style="object-position: ${PROFILE.eyes.x * 100}% ${PROFILE.eyes.y * 100}%" />
       </figure>
       <div>
         <p class="tag">Sobre</p>
         <h2>${escapeHTML(PROFILE.name)}</h2>
         <p>${escapeHTML(TEXTS.intro)}</p>
         <blockquote class="bike-note">${escapeHTML(TEXTS.bike)}</blockquote>
         ${note}
         ${contactsHTML()}
       </div>
     </div>`,
    { className: 'profile-modal', onClose },
  )
}

/* ---------------- Inicialização ---------------- */

/**
 * Liga tudo: preenche thumbnail e céu com a foto, aplica as opções visuais do céu
 * (opacidade, faixa de transparência e modo de mistura, lidas de PROFILE.sky),
 * registra o clique do thumbnail e a mira de calibração. Chamada uma vez por src/main.js.
 */
export function initProfile() {
  if (avatarImg) {
    avatarImg.src = profileImageURL
    avatarImg.alt = PROFILE.alt
    // object-position centraliza a miniatura nos olhos (enquadramento do rosto no quadradinho)
    avatarImg.style.objectPosition = `${PROFILE.eyes.x * 100}% ${PROFILE.eyes.y * 100}%`
  }
  avatarButton?.addEventListener('click', () => {
    avatarButton.blur() // devolve o teclado para a bike
    showProfile()
  })

  if (skyLayer && skyImg) {
    // variáveis CSS lidas por .sky-photo em main.css
    skyLayer.style.setProperty('--sky-opacity', String(PROFILE.sky.opacity))
    skyLayer.style.setProperty('--sky-fade-from', `${PROFILE.sky.fadeFrom * 100}%`)
    skyLayer.style.setProperty('--sky-fade-to', `${PROFILE.sky.fadeTo * 100}%`)
    skyLayer.style.setProperty('--sky-blend', PROFILE.sky.blend)
    skyImg.alt = '' // decorativa: leitores de tela ignoram (a foto "de verdade" é a do thumbnail)
    skyImg.addEventListener('load', layoutSky, { once: true })
    skyImg.src = profileImageURL
    if (skyImg.complete && skyImg.naturalWidth) layoutSky() // imagem já em cache: o 'load' pode não disparar
    // stage.js avisa quando a área do jogo muda (janela redimensionada ou cabeçalho mudou de altura)
    addEventListener('viewport-change', layoutSky)
    skyLayer.classList.remove('hidden')
  }
  setupEyesMarker()
}
