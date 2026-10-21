/* ==========================================================================
   LEVEL DESIGN — todo o conteúdo editável do portfólio fica neste arquivo.

   É o arquivo que você vai abrir com mais frequência. Aqui ficam:
   - PALETTE     → cores do mundo 3D (as cores das janelas/HUD ficam em styles/main.css)
   - TEXTS       → todos os textos longos (apresentação, zerou, game over, easter egg da bike…)
   - GROUPS      → categorias dos recortes (rótulo e cor do recorte provisório)
   - ITEMS       → ★ os recortes colecionáveis (os "objetos do jogo"): posição, imagem, texto, links
   - ROADS/SIGNS → ruas e placas magnéticas
   - CHECKPOINTS → pontos de chegada do botão Rebobinar
   - BOUNDS      → limites do mapa
   - DEFAULT_VIEW/ZONES → enquadramentos de câmera
   - AVATAR_IMAGE → imagem da bike
   - PROFILE     → foto de perfil (thumbnail no HUD + foto sutil no céu)
   - PARTICLES   → rastro de partículas que a bike solta ao se mover
   - VISITORS    → contador de visitantes

   Sistema de coordenadas: o chão é o plano XZ (x = esquerda/direita, z = frente/trás).
   A bike nasce em (0, 0) olhando para -Z, ou seja, "para o fundo" do mapa.
   Valores de z mais negativos ficam mais longe do início.

   Este arquivo NÃO tem lógica: só dados. Quem usa esses dados são os módulos de
   src/world (cenário, bike, recortes), src/ui (janelas) e src/main.js (orquestra).
   ========================================================================== */

/**
 * Cores do mundo 3D. São códigos hexadecimais (#RRGGBB).
 * Ao mudar aqui, mude também o bloco :root em src/styles/main.css para
 * janelas, botões e HUD ficarem na mesma paleta.
 */
export const PALETTE = {
  black: '#0d0b10', // fundo e neblina (o mapa "some" nessa cor ao longe)
  ink: '#1a1420', // preto levemente roxo (textos sobre papel, placas)
  purple: '#6b2fd6', // cor de destaque principal
  violet: '#8f5cf7', // roxo mais claro (variação para triângulos/recortes)
  lilac: '#c9b6ff', // lilás claro (faixas da rua, partículas, detalhes)
  white: '#f5f2ea', // "branco de papel" (não é branco puro, para parecer papel)
}

/**
 * Textos longos usados nas janelas e no mundo 3D.
 * Troque só o que está entre aspas. Se o texto tiver apóstrofo ('), escreva \' ou use crases (`).
 */
export const TEXTS = {
  // Apresentação: aparece em 3D quando o recorte da Marina é atropelado (e na janela "Sobre")
  intro:
    'Sou uma profissional extrovertida, criativa e comunicativa, habilidades que têm sido fundamentais em minha trajetória de aproximadamente 6 anos como UX/UI Designer. Com uma formação sólida na área de informática, estou atualmente em busca de novos desafios no universo de dados — abrangendo engenharia, ciência e análise — com o objetivo de criar experiências ainda mais impactantes e otimizadas nos produtos em que atuo, unindo arte com tecnologia.',
  // Frase do horizonte, no fim das ruas
  end: 'O fim é só um começo de infinitas possibilidades onde o desafio é o combustível necessário. Poetizado por Marina Micas Jardim em 28/07/2026.',
  // Janela "Você zerou!"
  win: 'Gostou de conhecer a experiência profissional da Marina Micas? Entre em contato pelos canais abaixo para conversarem e compartilharem conhecimentos:',
  // Janela "Game Over!" (ao tentar fechar a aba sem 100% do inventário)
  gameOver:
    'Você não percorreu todo o caminho, mas não precisa sair de mãos vazias! Deseja tentar novamente para ver o restante da trajetória ou prefere ir direto aos contatos da Marina?',
  // Confirmação do botão ↺ Resetar
  resetConfirm:
    'Isso apaga todos os recortes conquistados no inventário e recomeça a partida do zero, com todos os recortes de pé de novo. Essa ação não pode ser desfeita.',
  // Pergunta "Como quer recomeçar?"
  retry:
    'Você pode apagar tudo o que conquistou e recomeçar do zero, ou manter o inventário (e os recortes já destruídos) e apenas voltar ao ponto de partida.',
  // ★ Easter egg da bicicleta: aparece na janela "Sobre a Marina" (clique na foto do canto
  //   superior esquerdo) e, uma vez por visita, como aviso logo depois do primeiro arraste da bike.
  bike: 'A escolha da bicicleta não foi por acaso: é o meu veículo predileto e amo andar de bike!',
}

/**
 * Categorias dos recortes. A chave (ex.: 'design') é usada no campo `group` de cada item.
 * - label: texto mostrado na janela, no inventário e na janela presa no chão
 * - color: cor do miolo do recorte provisório (enquanto a imagem real não existe)
 * Para criar uma categoria nova, acrescente uma linha aqui e use a chave nos itens.
 */
export const GROUPS = {
  intro: { label: 'Apresentação', color: PALETTE.purple },
  desenvolvimento: { label: 'Experiências · Desenvolvimento', color: '#2b1a4a' },
  design: { label: 'Experiências · Design', color: PALETTE.purple },
  diversidade: { label: 'Experiências · Diversidade', color: PALETTE.violet },
  formacoes: { label: 'Formações', color: PALETTE.ink },
}

/*
  Cada item é um recorte colecionável (totem). A função `item()` abaixo monta o
  objeto completo a partir dos valores obrigatórios + um objeto de opções extras.

  Estrutura final de um item (o que os outros módulos recebem):
  {
    id: 'dev-1',                 // único, sem espaços/acentos; usado pelo inventário e pelo sessionStorage
    group: 'desenvolvimento',    // uma das chaves de GROUPS
    title: 'Projeto Dev 1',      // título na janela, inventário e recorte provisório
    subtitle: 'Desenvolvimento', // só no recorte provisório
    position: [x, z],            // posição no chão (metros)
    size: [largura, altura],     // metros; com imagem real a largura segue a proporção da imagem
    image: 'pasta/arquivo.webp', // dentro de src/assets/cutouts/; null ou inexistente = recorte provisório
    body: 'texto…',              // texto da janela e da janela presa no chão
    links: [{ label, url }],     // botões "saiba mais"; [] para nenhum
    reveal: true,                // (opcional) mostra o texto em 3D no lugar de abrir janela (só a intro usa)
  }
*/
const item = (id, group, title, subtitle, x, z, extra = {}) => ({
  id,
  group,
  title,
  subtitle,
  position: [x, z],
  size: [3, 4], // padrão: 3 m de largura por 4 m de altura
  image: null,
  body: `Descreva aqui "${title}": contexto, período, desafios e resultados.`,
  links: [{ label: 'Saiba mais', url: 'https://example.com' }],
  ...extra, // qualquer chave passada em `extra` sobrescreve os padrões acima
})

/**
 * ★ Lista de recortes (objetos do jogo). Para adicionar um, copie uma linha e mude
 * id, grupo, textos e posição. O inventário, a porcentagem e o "zerou" se ajustam sozinhos.
 * Ruas: x = -46 (Desenvolvimento), -30 (Design), -14 (Diversidade), 30 (Formações); z de -78 a -165.
 */
export const ITEMS = [
  // FASE 1 — apresentação (na rua de entrada, antes da bifurcação)
  item('intro', 'intro', 'Marina Micas', 'acelere e atropele!', 0, -16, {
    image: 'intro/marina.webp',
    size: [3.2, 4.2],
    body: TEXTS.intro,
    links: [],
    reveal: true, // revela o texto em 3D em vez de abrir janela
  }),

  // FASE 2 — Experiências › Desenvolvimento
  item('dev-1', 'desenvolvimento', 'Projeto Dev 1', 'Desenvolvimento', -46, -100, { image: 'experiencias/desenvolvimento/dev-1.webp' }),
  item('dev-2', 'desenvolvimento', 'Projeto Dev 2', 'Desenvolvimento', -46, -128, { image: 'experiencias/desenvolvimento/dev-2.webp' }),
  // Experiências › Design
  item('design-1', 'design', 'Projeto Design 1', 'UX/UI', -30, -100, { image: 'experiencias/design/design-1.webp' }),
  item('design-2', 'design', 'Projeto Design 2', 'UX/UI', -30, -128, { image: 'experiencias/design/design-2.webp' }),
  // Experiências › Diversidade
  item('div-1', 'diversidade', 'Diversidade 1', 'Diversidade', -14, -100, { image: 'experiencias/diversidade/div-1.webp' }),
  item('div-2', 'diversidade', 'Diversidade 2', 'Diversidade', -14, -128, { image: 'experiencias/diversidade/div-2.webp' }),

  // FASE 2 — Formações (rua única)
  item('edu-1', 'formacoes', 'Formação 1', 'Informática', 30, -84, { image: 'formacoes/edu-1.webp' }),
  item('edu-2', 'formacoes', 'Formação 2', 'Dados', 30, -108, { image: 'formacoes/edu-2.webp' }),
  item('edu-3', 'formacoes', 'Formação 3', 'Design', 30, -132, { image: 'formacoes/edu-3.webp' }),
]

/** Largura das ruas, em metros. Afeta o desenho da rua e o lado onde a janela presa no chão fica. */
export const ROAD_WIDTH = 7

/**
 * Ruas: cada linha é um segmento reto [[x1, z1], [x2, z2]].
 * O cenário desenha um plano por segmento; as funções nearRoad() (helpers.js)
 * usam esta lista para não colocar enfeites/prismas em cima da rua.
 * Se mover uma rua, mova também os ITEMS e SIGNS dela.
 */
export const ROADS = [
  [[0, 8], [0, -34]], // início → bifurcação
  [[0, -34], [-30, -62]], // rua Experiências
  [[-30, -62], [-46, -78]], [[-46, -78], [-46, -165]], // Desenvolvimento
  [[-30, -62], [-30, -165]], // Design
  [[-30, -62], [-14, -78]], [[-14, -78], [-14, -165]], // Diversidade
  [[0, -34], [30, -62]], [[30, -62], [30, -165]], // rua Formações
]

/**
 * Placas magnéticas: ao passar perto sem virar, a bike é puxada suavemente para `pull`.
 * - label: texto do recorte provisório (se a imagem não existir)
 * - x, z:  posição do poste
 * - image: recorte dentro de src/assets/cutouts/
 * - pull:  [x, z] do ponto para onde a placa "puxa" a bike (normalmente o começo da rua)
 */
export const SIGNS = [
  { label: '← Experiências', x: -3, z: -46, image: 'signs/experiencias.webp', pull: [-14, -47] },
  { label: 'Formações →', x: 3, z: -46, image: 'signs/formacoes.webp', pull: [14, -47] },
  { label: 'Desenvolvimento', x: -51, z: -84, image: 'signs/desenvolvimento.webp', pull: [-46, -86] },
  { label: 'Design', x: -35, z: -84, image: 'signs/design.webp', pull: [-30, -86] },
  { label: 'Diversidade', x: -19, z: -84, image: 'signs/diversidade.webp', pull: [-14, -86] },
]

/**
 * Pontos de chegada do botão Rebobinar. `heading` é a direção da bike em radianos
 * (0 = olhando para -Z, ou seja, para o fundo do mapa).
 */
export const CHECKPOINTS = {
  start: { x: 0, z: 0, heading: 0 }, // início do portfólio
  fork: { x: 0, z: -30, heading: 0 }, // logo antes da bifurcação das placas
}

/** Limites do mapa em metros: a bike e a câmera (pan) não passam daqui. */
export const BOUNDS = { minX: -110, maxX: 110, minZ: -195, maxZ: 30 }

/**
 * Enquadramento padrão da câmera, em relação à bike:
 * - offset: onde a câmera fica (x = lado, y = altura, z = atrás). Aumente y/z para ver de mais longe.
 * - look:   para onde ela olha (deslocamento a partir da bike)
 * O zoom do jogador multiplica o `offset` (ver CameraRig.js).
 */
export const DEFAULT_VIEW = { offset: { x: 8, y: 12, z: 15 }, look: { x: 0, y: 1, z: -3 } }

/**
 * Zonas do mapa: quando a bike entra na área de `test`, a câmera muda para `view`
 * (animada pelo GSAP) e, se houver `message`, um aviso aparece. Saindo da zona, volta a DEFAULT_VIEW.
 * `test` recebe a posição da bike (p.x, p.z) e devolve true/false.
 */
export const ZONES = [
  {
    id: 'fork',
    test: (p) => Math.hypot(p.x, p.z + 40) < 14, // círculo de 14 m ao redor de (0, -40)
    view: { offset: { x: 0, y: 22, z: 20 }, look: { x: 0, y: 0, z: -8 } },
    message: 'Bifurcação: Experiências à esquerda, Formações à direita.',
  },
  {
    id: 'crossroad',
    test: (p) => Math.hypot(p.x + 30, p.z + 72) < 15, // círculo de 15 m ao redor de (-30, -72)
    view: { offset: { x: 0, y: 24, z: 22 }, look: { x: 0, y: 0, z: -10 } },
    message: 'Encruzilhada: Desenvolvimento, Design ou Diversidade?',
  },
  {
    id: 'horizon',
    test: (p) => p.z < -150, // fim das ruas: câmera baixa olhando para o horizonte
    view: { offset: { x: 0, y: 6, z: 20 }, look: { x: 0, y: 7, z: -40 } },
  },
]

/** Recorte da bicicleta + avatar, dentro de src/assets/cutouts/ (virado para a direita, rodas na base). */
export const AVATAR_IMAGE = 'avatar/bike.webp'

/* ==========================================================================
   Foto de perfil: thumbnail no HUD + foto sutil no "céu"
   ----------------------------------------------------------------------------
   Coloque a foto em src/assets/images/ com o nome indicado em `image`.
   Enquanto o arquivo não existir, o jogo gera um retrato provisório que mostra
   onde os olhos são esperados (ajuda a calibrar `eyes`).

   Como funciona a ancoragem dos olhos (src/ui/profile.js):
   - `eyes`   = onde os olhos estão NA FOTO, em fração (0 = esquerda/topo, 1 = direita/base).
   - `anchor` = onde os olhos devem ficar NA TELA, também em fração da janela.
   A foto é ampliada o mínimo necessário para cobrir a tela inteira mantendo os
   olhos exatamente no ponto `anchor`. Como a camada é fixa na janela (não no
   mundo 3D), pan, zoom e redimensionamento nunca tiram os olhos da tela.
   Dica: abra o site com ?olhos no fim do endereço (ex.: http://localhost:5173/?olhos)
   para ver uma mira no ponto dos olhos e ajustar `eyes` até ela ficar sobre eles.
   ========================================================================== */
export const PROFILE = {
  image: 'profile.jpeg', // arquivo dentro de src/assets/images/ (jpg, jpeg, png, webp ou avif)
  name: 'Marina Micas Jardim',
  alt: 'Foto de Marina Micas Jardim', // texto alternativo (acessibilidade e SEO)
  eyes: { x: 0.46, y: 0.4 }, // posição dos olhos NA FOTO (fração da largura e da altura)
  anchor: { x: 0.5, y: 0.3 }, // posição dos olhos NA TELA (0.3 = a 30% da altura, abaixo do HUD do topo)
  sky: {
    opacity: 0.18, // 0 = invisível, 1 = foto normal. Valores de 0.15 a 0.3 ficam sutis.
    fadeFrom: 0.45, // a partir desta fração da altura da tela a foto começa a sumir…
    fadeTo: 0.85, // …e aqui já está totalmente transparente (deixa o chão limpo)
    blend: 'screen', // modo de mistura CSS: 'screen' só clareia áreas escuras (efeito de fundo); 'normal' = sobreposição comum
  },
}

/* ==========================================================================
   Partículas da bicicleta (rastro de "poeira de papel" brilhante)
   ----------------------------------------------------------------------------
   Enquanto a bike se move (arrastada ou pelo teclado) ela solta partículas
   atrás de si. Cada partícula nasce com um tamanho e vai encolhendo e ficando
   transparente até sumir. Tudo é desenhado em uma única malha THREE.Points,
   então o custo é baixo mesmo no celular. Lógica em src/world/particles.js.
   ========================================================================== */
export const PARTICLES = {
  enabled: true, // false desliga o efeito por completo
  max: 220, // quantidade máxima de partículas vivas ao mesmo tempo (memória reservada de uma vez)
  perMeter: 8, // partículas soltas por metro percorrido (mais = rastro mais denso)
  minSpeed: 1.5, // m/s: abaixo disso a bike não solta partículas (parada ou quase)
  maxPerFrame: 14, // teto por quadro: um arraste muito rápido não cria centenas de uma vez
  life: [0.5, 1.2], // segundos de vida de cada partícula [mínimo, máximo]
  size: [0.22, 0.55], // tamanho inicial em metros [mínimo, máximo]; encolhe até zero
  spread: 0.45, // dispersão lateral ao nascer, em metros
  behind: [0.2, 0.9], // distância atrás da bike onde nascem, em metros [mínimo, máximo]
  rise: [0.3, 1.1], // velocidade para cima em m/s [mínimo, máximo] (poeira subindo)
  push: 1.2, // velocidade para trás, em m/s (segue o sentido contrário do movimento)
  drag: 2.2, // freio do movimento: maior = a partícula para mais rápido
  colors: [PALETTE.lilac, PALETTE.white, PALETTE.violet, PALETTE.purple], // sorteadas por partícula
  additive: true, // true = brilho somado (sparkle luminoso); false = papel opaco comum
}

/*
  Contador de visitantes (serviço gratuito Abacus: https://abacus.jasoncameron.dev).
  - since:     data de início exibida ("desde DD/MM/AAAA"), no formato AAAA-MM-DD
  - namespace: nome único deste site no serviço (troque se quiser zerar a contagem)
  - keys:      nomes dos dois contadores dentro do namespace
*/
export const VISITORS = {
  since: '2026-10-21', // data do deploy do contador
  namespace: 'marinamicas-portfolio',
  keys: { unique: 'visitantes-unicos', views: 'visualizacoes' },
}
