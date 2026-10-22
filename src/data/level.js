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
   - BIKE        → velocidade, curva e arraste da bike 3D (teclado e botões usam os mesmos valores)
   - LIVES       → sistema de vidas (quantas, o que tira, o que devolve)
   - END_SIGNS   → placas de fim de rota com frases poéticas
   - FOREST      → árvores e flores triangulares
   - CRITTERS    → borboletas, pássaros, coelhos e onças (as onças tiram vida)
   - SNOW        → neve de triângulos flutuantes
   - INTRO       → animação de abertura (triângulo neon + bike saindo da terra)
   - AUDIO       → música de fundo e créditos
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
    'Sou uma profissional extrovertida, criativa e comunicativa, habilidades que têm sido fundamentais em minha trajetória de aproximadamente 6 anos como UX/UI Designer. Com uma formação sólida na área de informática, estou atualmente em busca de novos desafios no universo de dados abrangendo engenharia, ciência e análise com o objetivo de criar experiências ainda mais impactantes e otimizadas nos produtos em que atuo, unindo arte com tecnologia.',
  // Frase do horizonte, no fim das ruas
  end: 'O fim é só um começo de infinitas possibilidades onde o desafio é o combustível necessário. Poetizado por Marina Micas Jardim em 28/07/2026.',
  // Janela "Você zerou!"
  win: 'Gostou de conhecer minhas experiências profissionais? Entre em contato comigo pelos canais abaixo:',
  // Janela "Game Over!" (ao tentar fechar a aba sem 100% do inventário)
  gameOver:
    'Você não percorreu todo o caminho, mas não precisa sair de mãos vazias! Deseja tentar novamente para ver o restante da trajetória ou prefere ir direto aos meus contatos?',
  // Confirmação do botão ↺ Resetar
  resetConfirm:
    'Isso apaga todos os recortes conquistados no inventário e recomeça a partida do zero, com todos os recortes de pé de novo. Essa ação não pode ser desfeita.',
  // Pergunta "Como quer recomeçar?"
  retry:
    'Você pode apagar tudo o que conquistou e recomeçar do zero, ou manter o inventário (e os recortes já destruídos) e apenas voltar ao ponto de partida.',
  // ★ Easter egg da bicicleta: aparece na janela "Sobre a Marina" (clique na foto do canto
  //   superior esquerdo) e, uma vez por visita, como aviso logo depois do primeiro arraste da bike.
  bike: 'A escolha da bicicleta não foi por acaso: amo andar de bike!',
  // Janela "Fim das vidas" (quando as vidas chegam a zero)
  livesOver:
    'Suas vidas acabaram! Árvores e onças não perdoam ciclistas distraídos. Quer tentar de novo, ver o currículo direto ou falar comigo?',
  // Texto curto do cartão do primeiro recorte (desenhado no próprio cartão, abaixo da foto)
  introCard: 'Prazer, eu sou a Marina! Arte, tecnologia e dados pedalando juntos.',
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
    card: 'profile',             // (opcional) em vez de imagem, desenha um cartão com a foto de perfil (só a intro usa)
    opens: 'profile',            // (opcional) ao atropelar abre a janela "Sobre a Marina" em vez da janela padrão
    reveal: true,                // (opcional, legado) mostra o texto em 3D no lugar de abrir janela (nenhum item usa hoje)
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

/*
  Recortes em formato de CARTÃO (imagens das Experiências, 285 px de largura e alturas diferentes).
  Todos ficam com a mesma largura no mundo (CARD_WIDTH metros); a altura acompanha a altura da imagem,
  então nenhum cartão fica esticado nem com o texto miúdo.
  - CARD_WIDTH: largura de todos os cartões em metros. Aumente para cartões maiores (mais legíveis de longe).
  - CARD_IMAGE_WIDTH: largura das imagens dos cartões, em pixels (todas foram exportadas com 285 px).
  Uso: size: cardSize(altura da imagem em pixels). Ex.: imagem de 285×563 → cardSize(563).
  Observação: o jogo já recalcula a largura pela proporção real da imagem ao carregar; cardSize
  define a ALTURA certa para que essa largura final dê CARD_WIDTH.
*/
const CARD_WIDTH = 2.4
const CARD_IMAGE_WIDTH = 285
const cardSize = (imageHeightPx) => [CARD_WIDTH, (CARD_WIDTH * imageHeightPx) / CARD_IMAGE_WIDTH]

/**
 * ★ Lista de recortes (objetos do jogo). Para adicionar um, copie uma linha e mude
 * id, grupo, textos e posição. O inventário, a porcentagem e o "zerou" se ajustam sozinhos.
 * Ruas: x = -46 (Desenvolvimento), -30 (Design), -14 (Diversidade), 30 (Formações); z de -78 a -165.
 */
export const ITEMS = [
  // FASE 1 — apresentação (na rua de entrada, antes da bifurcação).
  // Cartão desenhado pelo jogo com a foto de perfil (mesmo visual dos cartões das Experiências).
  // Ao ser atropelado abre a janela "Sobre a Marina"; depois a janela fica presa no chão como os outros.
  item('intro', 'intro', 'Marina Micas Jardim', 'Sobre', 0, -16, {
    card: 'profile',
    opens: 'profile',
    size: cardSize(600),
    body: TEXTS.intro,
    links: [{ label: 'Ver currículo', url: './docs/curriculo-marina-micas.pdf' }],
  }),

  // FASE 2 — Experiências › Desenvolvimento (ordem cronológica: o mais antigo aparece primeiro na rua)
  item('dev-1', 'desenvolvimento', 'Redes Neurais FFNN', '2022', -46, -100, {
    image: 'experiencias/desenvolvimento/desenvolvimento - Redes Neurais FFNN.png',
    size: cardSize(773),
    body: 'Trabalho de Conclusão de Curso da pós da PUC Minas Virtual para ser especialista em Inteligência Artificial e Aprendizagem de Máquina (2022). Ferramentas e temas: Feed-forward Neural Network, Machine Learning, Python, TensorFlow, Keras, Scikit-learn, Pandas, NumPy, Jupyter Notebook, Colaboratory, HTML, CSS, GitHub Pages e VS Code.',
  }),
  item('dev-2', 'desenvolvimento', 'Triplo brilho', '2023', -46, -128, {
    image: 'experiencias/desenvolvimento/desenvolvimento - Triplo brilho.png',
    size: cardSize(563),
    body: 'Fiz um projeto chamado Triplo Brilho, que explora o terceiro diamante do tão conhecido duplo diamante em nossos processos de design (2023). Ferramentas e temas: Triplo diamante, Figma for VS Code, HTML, CSS, JavaScript, GitHub Pages e web design.',
  }),
  // Experiências › Design
  item('design-1', 'design', 'Equipe UX/UI Design', '2024', -30, -100, {
    image: 'experiencias/design/design - equipe UX UI Design.png',
    size: cardSize(605),
    body: 'Realizei uma pesquisa com 4 categorias de resumos teóricos para ter um fundamento na estruturação de uma equipe de UX/UI design (2024). Temas: estrutura de equipe, Experiência da Marca (BX), Experiência do Cliente (CX), maturidade UX e profissões de UX/UI design.',
  }),
  item('design-2', 'design', 'Minha marca', '2024', -30, -128, {
    image: 'experiencias/design/design - Minha marca.png',
    size: cardSize(479),
    body: 'A ideia da marca veio da tulipa por conta de ser uma flor que é única em cada caule, retratando assim a singularidade do ser humano (2024). Ferramentas e temas: Figma, logo, psicologia da cor, rebranding e tipografia.',
  }),
  // Experiências › Diversidade
  item('div-1', 'diversidade', 'Jogo das Diagonais', '2018', -14, -100, {
    image: 'experiencias/diversidade/diversidade - Jogo das Diagonais.png',
    size: cardSize(731),
    body: 'Proponho um modelo de aprendizado lúdico com games inteligentes usando conteúdos reais em várias áreas, conectando teorias e conceitos (2018). Temas: aprendizagem metacognitiva, artigo científico, cognição, design interativo, game educativo, game inteligente, mapa mental, protótipo analógico e tridimensão da aprendizagem.',
  }),
  item('div-2', 'diversidade', 'Ícones Inteligentes', '2018', -14, -128, {
    image: 'experiencias/diversidade/diversidade - Ícones Inteligentes.png',
    size: cardSize(563),
    body: 'Destaco a importância de criar uma exibição para ícones inteligentes dos nossos arquivos digitais, organizando e centralizando a aprendizagem (2018). Temas: arquivo digital, artigo científico, cognição, ícone inteligente, mapa mental e repositório digital.',
  }),

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

/* ==========================================================================
   BIKE 3D — direção, velocidade e precisão (src/world/bike.js)
   ----------------------------------------------------------------------------
   Teclado e botões na tela escrevem no MESMO objeto `input` (core/input.js), então
   usam exatamente estes números: a precisão dos dois é idêntica por construção.
   Ângulos em radianos (π ≈ 3,14 = meia-volta). Velocidades em metros por segundo.
   ========================================================================== */
export const BIKE = {
  maxSpeed: 10, // m/s pedalando normal (▲ / W / seta para cima)
  boostSpeed: 16, // m/s com turbo (⚡ / Shift)
  reverseFactor: 0.4, // ré = 40% da velocidade máxima (▼ / S / seta para baixo)
  accel: 6, // quão rápido chega na velocidade (maior = arranca mais rápido)
  brake: 9, // quão rápido para ao soltar (maior = freia mais rápido)
  turnRate: 2.4, // rad/s de curva em movimento (◀ ▶ / A D / setas laterais)
  pivotFactor: 0.45, // parada, a bike ainda gira no lugar a 45% da curva (ajuste fino de direção)
  turnSmoothing: 14, // suavidade ao começar/parar de virar (maior = resposta mais seca)
  // Arrastar a bike com o dedo/mouse (só quando os botões na tela estão ocultos):
  // a bike pedala na direção do ponto apontado; a câmera a acompanha.
  drag: {
    speedPerMeter: 2.2, // velocidade = distância até o dedo × este valor…
    maxSpeed: 12, // …limitada a este máximo (m/s)
    deadZone: 0.6, // m: com o dedo a menos disso da bike, ela para
    turnRate: 9, // rad/s: quão rápido a bike vira para o lado do dedo
  },
}

/* ==========================================================================
   VIDAS
   ========================================================================== */
export const LIVES = {
  start: 6, // vidas ao começar (e máximo que dá para ter)
  treeDamage: 1, // vidas perdidas ao bater numa árvore
  jaguarDamage: 1, // vidas perdidas ao encostar numa onça
  cutoutHeal: 1, // vidas recuperadas ao explodir um recorte (nunca passa de `start`)
  invulnerableSeconds: 1.6, // depois de perder vida, a bike pisca e fica imune por este tempo
}

/* ==========================================================================
   FRASE DO HORIZONTE EM NEON (TEXTS.end, flutuando no fim das ruas, sem fundo)
   Desenhada em src/world/environment.js (buildHorizon).
   ========================================================================== */
export const HORIZON_NEON = {
  text: '#f4eeff', // miolo das letras (quase branco, como o tubo de neon aceso)
  glow: '#a66bff', // cor do brilho em volta (roxo neon). Ex.: '#39ff88' verde, '#ff4fd8' rosa
  pulse: true, // true = o brilho "respira" devagar; false = brilho fixo
}

/* ==========================================================================
   PLACAS DE FIM DE ROTA (uma no fim de cada rua)
   - x, z: posição (metros). As ruas terminam em z = -165.
   - route: nome da rota (aparece em destaque na placa)
   - text:  frase poética da placa
   ========================================================================== */
export const END_SIGNS = [
  { route: 'Desenvolvimento', x: -46, z: -160, text: 'Aqui termina o código, mas não a curiosidade: cada linha escrita é ponte para a próxima pergunta.' },
  { route: 'Design', x: -30, z: -160, text: 'Toda forma bonita nasceu de alguém que parou para escutar. Fim da rota, começo do olhar.' },
  { route: 'Diversidade', x: -14, z: -160, text: 'Como a tulipa, única em cada caule: caminhos diferentes florescem melhor juntos.' },
  { route: 'Formações', x: 30, z: -160, text: 'O estudo não tem linha de chegada: cada diploma é só uma página virada no caderno da vida.' },
]

/* ==========================================================================
   FLORESTA TRIANGULAR (src/world/forest.js)
   As árvores TÊM colisão: a bike para nelas e perde vida (LIVES.treeDamage).
   ========================================================================== */
export const FOREST = {
  trees: 230, // quantidade de árvores (menos = mais leve no celular)
  flowers: 420, // quantidade de flores (só enfeite, sem colisão)
  roadClearance: 5.6, // m: distância mínima do centro da rua até uma árvore (a rua tem ROAD_WIDTH = 7 de largura)
  area: { minX: -105, maxX: 95, minZ: -190, maxZ: 26 }, // retângulo onde a floresta é plantada
  treeHeight: [3.2, 7.5], // altura das árvores em metros [mín, máx]
  hitRadius: 0.75, // m: raio do tronco para contar a batida
  canopyColors: ['#2f6b4f', '#3f8a5f', '#235443', '#5b9e6a', '#6b2fd6', '#8f5cf7'], // copas: verdes + toques do roxo da marca
  trunkColor: '#4a3426',
  flowerColors: ['#c9b6ff', '#f5f2ea', '#ff7eb6', '#ffd166', '#8f5cf7'],
}

/* ==========================================================================
   BICHOS TRIANGULARES (src/world/critters.js)
   - butterflies, birds, rabbits: quantidade (só enfeite)
   - jaguars: cada onça anda de um ponto `from` [x, z] a um ponto `to` e volta, a `speed` m/s.
     Encostar numa onça tira LIVES.jaguarDamage. Elas cruzam as ruas depois da bifurcação.
   ========================================================================== */
export const CRITTERS = {
  butterflies: 26,
  birds: 12,
  rabbits: 10,
  jaguarHitRadius: 1.3, // m
  jaguars: [
    { from: [-55, -114], to: [-37, -114], speed: 3.2 }, // cruza a rua Desenvolvimento
    { from: [-39, -142], to: [-21, -142], speed: 3.6 }, // cruza a rua Design
    { from: [-23, -114], to: [-5, -114], speed: 3 }, // cruza a rua Diversidade
    { from: [21, -120], to: [39, -120], speed: 3.4 }, // cruza a rua Formações
  ],
}

/* ==========================================================================
   NEVE (src/world/snow.js): os triângulos que flutuavam viraram flocos caindo.
   Ficam numa "caixa" em volta da câmera, então sempre há neve na tela.
   ========================================================================== */
export const SNOW = {
  count: 280, // quantidade de flocos
  opacity: 0.28, // transparência (baixa para não atrapalhar a visão)
  size: [0.12, 0.32], // tamanho dos flocos em metros [mín, máx]
  fallSpeed: [0.6, 1.6], // m/s de queda [mín, máx]
  box: { x: 70, y: 26, z: 70 }, // tamanho da caixa de neve em volta da câmera (metros)
}

/* ==========================================================================
   ABERTURA (src/world/intro.js): triângulo neon desenhado no chão e a bike
   saindo da terra de dentro dele. Depois aparece a janela de instruções.
   ========================================================================== */
export const INTRO = {
  triangleRadius: 2.8, // m: distância do centro até cada ponta do triângulo
  drawSeconds: 1.5, // tempo para desenhar os 3 lados
  riseSeconds: 1.2, // tempo da bike subindo da terra
  neonColor: '#c9b6ff', // cor do neon (lilás)
  glowColor: '#8f5cf7', // cor do brilho em volta
}

/* ==========================================================================
   ÁUDIO (src/ui/audio.js)
   O arquivo fica em public/ (copiado para a raiz do site publicado).
   Navegadores bloqueiam som automático até o primeiro toque/clique: nesse caso a
   música começa no primeiro gesto do visitante (por exemplo, o botão "Começar").
   ========================================================================== */
export const AUDIO = {
  file: 'som.mp3', // arquivo dentro de public/
  volume: 0.45, // 0 a 1
  credit: 'Daniel Micas Jardim da Silva', // autor da música (aparece no botão de som)
}

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
  Para ZERAR: troque o namespace por um nome novo (ex.: com a data) e ajuste `since`.
  A marca "este aparelho já foi contado" também é por namespace, então todo mundo volta a contar como único.
*/
export const VISITORS = {
  since: '2026-10-22', // contagem zerada em 22/10/2026
  namespace: 'marinamicas-portfolio-2026-10-22',
  keys: { unique: 'visitantes-unicos', views: 'visualizacoes' },
}
