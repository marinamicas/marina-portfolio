/* ==========================================================================
   LEVEL DESIGN — todo o conteúdo editável do portfólio fica neste arquivo.
   Coordenadas: o chão é o plano XZ; a bike nasce em (0, 0) olhando para -Z.
   ========================================================================== */

export const PALETTE = {
  black: '#0d0b10',
  ink: '#1a1420',
  purple: '#6b2fd6',
  violet: '#8f5cf7',
  lilac: '#c9b6ff',
  white: '#f5f2ea',
}

export const TEXTS = {
  intro:
    'Sou uma profissional extrovertida, criativa e comunicativa, habilidades que têm sido fundamentais em minha trajetória de aproximadamente 6 anos como UX/UI Designer. Com uma formação sólida na área de informática, estou atualmente em busca de novos desafios no universo de dados — abrangendo engenharia, ciência e análise — com o objetivo de criar experiências ainda mais impactantes e otimizadas nos produtos em que atuo, unindo arte com tecnologia.',
  end: 'O fim é só um começo de infinitas possibilidades onde o desafio é o combustível necessário. Poetizado por Marina Micas Jardim em 28/07/2026.',
  win: 'Gostou de conhecer a experiência profissional da Marina Micas? Entre em contato pelos canais abaixo para conversarem e compartilharem conhecimentos:',
  gameOver:
    'Você não percorreu todo o caminho, mas não precisa sair de mãos vazias! Deseja tentar novamente para ver o restante da trajetória ou prefere ir direto aos contatos da Marina?',
  retry:
    'Você pode apagar tudo o que conquistou e recomeçar do zero, ou manter o inventário (e os recortes já destruídos) e apenas voltar ao ponto de partida.',
}

export const GROUPS = {
  intro: { label: 'Apresentação', color: PALETTE.purple },
  desenvolvimento: { label: 'Experiências · Desenvolvimento', color: '#2b1a4a' },
  design: { label: 'Experiências · Design', color: PALETTE.purple },
  diversidade: { label: 'Experiências · Diversidade', color: PALETTE.violet },
  formacoes: { label: 'Formações', color: PALETTE.ink },
}

/*
  Cada item é um recorte colecionável (totem).
  - image: caminho dentro de src/assets/cutouts/ (ex.: 'formacoes/edu-1.webp').
           Se o arquivo não existir, um recorte provisório é gerado automaticamente.
  - size:  [largura, altura] em metros. Com imagem real, a largura se ajusta à proporção.
  - links: botões da janela flutuante (documentos, sites, certificados…).
*/
const item = (id, group, title, subtitle, x, z, extra = {}) => ({
  id,
  group,
  title,
  subtitle,
  position: [x, z],
  size: [3, 4],
  image: null,
  body: `Descreva aqui "${title}": contexto, período, desafios e resultados.`,
  links: [{ label: 'Saiba mais', url: 'https://example.com' }],
  ...extra,
})

export const ITEMS = [
  // FASE 1 — apresentação
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

// Ruas: segmentos [x, z] → [x, z]
export const ROAD_WIDTH = 7
export const ROADS = [
  [[0, 8], [0, -34]], // início → bifurcação
  [[0, -34], [-30, -62]], // rua Experiências
  [[-30, -62], [-46, -78]], [[-46, -78], [-46, -165]], // Desenvolvimento
  [[-30, -62], [-30, -165]], // Design
  [[-30, -62], [-14, -78]], [[-14, -78], [-14, -165]], // Diversidade
  [[0, -34], [30, -62]], [[30, -62], [30, -165]], // rua Formações
]

// Placas magnéticas: atraem suavemente a bike para a rua que indicam
export const SIGNS = [
  { label: '← Experiências', x: -3, z: -46, image: 'signs/experiencias.webp', pull: [-14, -47] },
  { label: 'Formações →', x: 3, z: -46, image: 'signs/formacoes.webp', pull: [14, -47] },
  { label: 'Desenvolvimento', x: -51, z: -84, image: 'signs/desenvolvimento.webp', pull: [-46, -86] },
  { label: 'Design', x: -35, z: -84, image: 'signs/design.webp', pull: [-30, -86] },
  { label: 'Diversidade', x: -19, z: -84, image: 'signs/diversidade.webp', pull: [-14, -86] },
]

export const CHECKPOINTS = {
  start: { x: 0, z: 0, heading: 0 },
  fork: { x: 0, z: -30, heading: 0 },
}

export const BOUNDS = { minX: -110, maxX: 110, minZ: -195, maxZ: 30 }

// Enquadramentos de câmera (tweenados pelo GSAP)
export const DEFAULT_VIEW = { offset: { x: 8, y: 12, z: 15 }, look: { x: 0, y: 1, z: -3 } }
export const ZONES = [
  {
    id: 'fork',
    test: (p) => Math.hypot(p.x, p.z + 40) < 14,
    view: { offset: { x: 0, y: 22, z: 20 }, look: { x: 0, y: 0, z: -8 } },
    message: 'Bifurcação: Experiências à esquerda, Formações à direita.',
  },
  {
    id: 'crossroad',
    test: (p) => Math.hypot(p.x + 30, p.z + 72) < 15,
    view: { offset: { x: 0, y: 24, z: 22 }, look: { x: 0, y: 0, z: -10 } },
    message: 'Encruzilhada: Desenvolvimento, Design ou Diversidade?',
  },
  {
    id: 'horizon',
    test: (p) => p.z < -150,
    view: { offset: { x: 0, y: 6, z: 20 }, look: { x: 0, y: 7, z: -40 } },
  },
]

export const AVATAR_IMAGE = 'avatar/bike.webp'
