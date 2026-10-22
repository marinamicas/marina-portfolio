# Marina Micas Jardim — Portfólio gamificado

Portfólio 3D em **Three.js + cannon-es (física) + GSAP (câmera e tempo)**, empacotado com **Vite** e publicado como site estático no **GitHub Pages**: <https://marinamicas.github.io/marina-portfolio/>

O visitante pedala uma bicicleta de papel por um mundo de colagem digital, atropela os recortes da trajetória da Marina (que se desfazem em pedaços de papel) e acompanha o próprio progresso até "zerar".

> 📘 **Vai editar o site?** Este README tem o [guia completo de manutenção](#4-guia-completo-de-manutenção-como-atualizar-sem-ia) e o [Manual de atualização](docs/MANUAL-DE-ATUALIZACAO.md) tem receitas passo a passo para quem está começando a programar.

## Sumário

1. [História e contexto do projeto](#1-história-e-contexto-do-projeto)
2. [Como jogar](#2-como-jogar)
3. [Rodando localmente](#3-rodando-localmente)
4. [Guia completo de manutenção (como atualizar sem IA)](#4-guia-completo-de-manutenção-como-atualizar-sem-ia)
   - 4.1 [Como alterar o favicon](#41-como-alterar-o-favicon)
   - 4.2 [Como atualizar/adicionar objetos do jogo (recortes, placas, zonas)](#42-como-atualizaradicionar-objetos-do-jogo)
   - 4.3 [Como alterar imagens e ativos (foto de perfil, prévia, ícones, recortes, currículo)](#43-como-alterar-imagens-e-ativos)
   - 4.4 [Como ajustar parâmetros do jogo (velocidade, vidas, floresta, zoom, cores, som, céu)](#44-como-ajustar-parâmetros-do-jogo)
   - 4.5 [Como manter o SEO (título, descrição, prévia de compartilhamento)](#45-como-manter-o-seo)
   - 4.6 [Textos e o easter egg da bicicleta](#46-textos-e-o-easter-egg-da-bicicleta)
5. [Publicando no GitHub Pages](#5-publicando-no-github-pages)
6. [Arquitetura do código](#6-arquitetura-do-código)
7. [Regras de jogo implementadas](#7-regras-de-jogo-implementadas)

---

## 1. História e contexto do projeto

Este portfólio foi idealizado, dirigido e construído por **Marina Micas Jardim**, UX/UI Designer com formação em informática e em transição para o universo de dados.

O desenvolvimento foi **acelerado para apenas 2 dias** (20 e 21 de outubro de 2026) com o apoio do **Claude Code**, o assistente de programação da Anthropic. Isso foi viabilizado pelo **crédito promocional de US$ 70** conquistado por Marina no **hackathon do Claude Impact Lab Rio de Janeiro 2026**.

**Autoria criativa.** A inteligência artificial foi a ferramenta, não a autora. Todo o direcionamento do projeto foi da desenvolvedora:

- **Conceito e narrativa:** a metáfora da bicicleta pedalando por uma colagem de papel, as ruas de Experiências e Formações, o inventário, o rebobinar, o Game Over ao tentar sair, o contador de visitantes e o easter egg da bike ("é o meu veículo predileto e amo andar de bike!").
- **Arquitetura:** a separação em módulos (`data/` para conteúdo, `core/` para motor, `world/` para o 3D, `ui/` para janelas), a escolha de Three.js + cannon-es + GSAP + Vite e a publicação estática no GitHub Pages.
- **Engenharia de prompts:** cada funcionalidade foi especificada, iterada e revisada por Marina, do comportamento dos gestos no celular até as regras de SEO.
- **Ajustes finos diretos no código:** textos, coordenadas, cores, sensibilidades e correções feitas à mão, sem intermediários.

Por isso o código inteiro é comentado em português, de forma didática: a ideia é que o projeto continue evoluindo **com ou sem IA**.

---

## 2. Como jogar

Ao abrir o site, um **triângulo neon** é desenhado no chão e a **bike 3D sai da terra** de dentro dele. Depois aparece a janela **"Como jogar"**, com as instruções do aparelho (celular ou computador) e um botão grande **"Ver o currículo agora"** para quem prefere ver as experiências sem jogar.

| Ação | Computador | Celular/tablet |
|---|---|---|
| Virar | ◀ ▶ na tela, ou A D / setas laterais | ◀ ▶ na tela |
| Pedalar / frear e ré / turbo | ▲ / ▼ / ⚡ na tela, ou W / S / Shift | ▲ / ▼ / ⚡ na tela |
| Arrastar a bike (botões ocultos no 🎮) | clicar na bike e arrastar | tocar na bike e arrastar |
| Zoom | roda do mouse, pinça no trackpad ou + / − | pinça com dois dedos |
| Zoom normal | duplo clique ou 0 | toque duplo |
| Sobre a Marina | clicar na miniatura da foto ou atropelar o primeiro recorte | tocar na miniatura ou atropelar o primeiro recorte |
| Guia de navegação | botão **? Ajuda** | botão **? Ajuda** |
| Som | botão 🔊 (créditos: Daniel Micas Jardim da Silva) | botão 🔊 |
| Fechar janela | Esc | botão × |

- A **câmera segue a bike o tempo todo**. A seta neon no chão, o farol e a lanterna mostram para onde ela aponta.
- O **teclado está sempre ativo** (acessibilidade); teclas e botões são o mesmo comando, com a mesma precisão, e funcionam juntos.
- Com os **botões na tela visíveis**, tocar/arrastar a bike não a move. Ocultando os botões (🎮), arrastar a bike faz ela pedalar até o ponto apontado.
- **6 vidas**: árvores e onças tiram 1; cada recorte explodido devolve 1.

Gestos não suportados abrem um **guia de navegação** adaptado ao aparelho. A bike solta um **rastro de partículas** enquanto se move.

---

## 3. Rodando localmente

Requer Node.js 20+ (recomendado: 24 LTS).

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # gera a pasta dist/
npm run preview   # serve o dist/ localmente
```

Em modo dev, `window.__game` expõe `scene`, `camera`, `world`, `rig`, `bike`, `totems`, `state`, `sim`, `particles`, `input` e `showProfile()` no console (F12), para depuração. Exemplo: `__game.bike.body.position` mostra onde a bike está.

Abra `http://localhost:5173/?olhos` para ver a **mira de calibração** da foto de perfil (veja [4.3](#43-como-alterar-imagens-e-ativos)).

---

## 4. Guia completo de manutenção (como atualizar sem IA)

> **Regra de ouro:** altere uma coisa de cada vez, salve (Ctrl + S), olhe o resultado no navegador (`npm run dev` atualiza sozinho) e só então passe para a próxima.

### 4.1 Como alterar o favicon

O favicon é o ícone que aparece na aba do navegador, nos favoritos e na tela inicial do celular. O projeto usa **dois arquivos**, ambos na pasta `public/` (arquivos dessa pasta são copiados para o site sem mudar de nome):

| Arquivo | Para quê | Formato |
|---|---|---|
| `public/favicon.svg` | Aba do navegador e favoritos (navegadores modernos) | SVG (vetor, qualquer tamanho) |
| `public/apple-touch-icon.png` | Ícone ao "Adicionar à tela de início" no iPhone/iPad e em alguns Android | PNG 180×180 px, sem transparência |

**Passo a passo:**

1. **Crie o ícone.** Use um editor como Figma, Illustrator ou Inkscape e exporte:
   - a versão **SVG** (quadrada, sem texto pequeno, poucas cores);
   - a versão **PNG de 180×180 px** com fundo sólido (o iOS não usa transparência).
   Se só tiver um PNG, converta para SVG em <https://www.pngtosvg.com> ou gere os dois tamanhos em <https://realfavicongenerator.net>.
2. **Substitua os arquivos** mantendo exatamente os mesmos nomes:
   - sobrescreva `public/favicon.svg`;
   - sobrescreva `public/apple-touch-icon.png`.
3. **Confira a referência no `index.html`** (não precisa mudar se manteve os nomes). Procure pelo bloco `Favicon e cor do tema`:
   ```html
   <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
   <link rel="apple-touch-icon" sizes="180x180" href="./apple-touch-icon.png" />
   <meta name="theme-color" content="#0d0b10" />
   ```
   - Se quiser usar **outro nome ou formato** (ex.: `icone.png`), troque o `href` e o `type` (`image/png`).
   - Para adicionar um **PNG de 32×32** como reserva para navegadores antigos, acrescente uma linha: `<link rel="icon" type="image/png" sizes="32x32" href="./favicon-32.png" />`.
   - `theme-color` é a cor da barra do navegador no celular; combine com o fundo do ícone.
4. **Teste:** rode `npm run dev` e abra a página. Se o ícone antigo continuar aparecendo, é cache do navegador: aperte Ctrl + F5 ou abra em uma aba anônima.
5. **Publique** (`git add . && git commit -m "Novo favicon" && git push`).

### 4.2 Como atualizar/adicionar objetos do jogo

Todos os objetos do jogo são **dados** (sem lógica) no arquivo [`src/data/level.js`](src/data/level.js). Os módulos 3D leem essas listas e montam o mundo sozinhos.

> 📘 **Inserindo recortes de Experiências e Formações?** Siga o passo a passo completo da
> [seção 5.0 do Manual](docs/MANUAL-DE-ATUALIZACAO.md#50--passo-a-passo-completo-inserir-recortes-de-experiências-e-formações):
> imagem no padrão de cartão (285 px de largura), posição livre na rua, `cardSize(altura)` e conferência.

Outros objetos editáveis no mesmo arquivo: `END_SIGNS` (placas de fim de rota), `CRITTERS.jaguars`
(caminho das onças), `FOREST` (árvores e flores), `SIGNS` (placas magnéticas) e `ZONES` (câmera).

#### Recortes colecionáveis (`ITEMS`)

Cada recorte é criado por uma chamada `item(...)`. A função monta um objeto com esta estrutura (é o "JSON" que o jogo usa):

```js
{
  id: 'dev-1',                 // texto único, sem espaços nem acentos (inventário e progresso salvo)
  group: 'desenvolvimento',    // categoria: uma das chaves de GROUPS
  title: 'Projeto Dev 1',      // título (janela, inventário, recorte provisório)
  subtitle: 'Desenvolvimento', // só no recorte provisório (quando a imagem ainda não existe)
  position: [-46, -100],       // [x, z] no chão, em metros
  size: [3, 4],                // [largura, altura] em metros (com imagem real a largura segue a proporção)
  image: 'experiencias/desenvolvimento/dev-1.webp', // dentro de src/assets/cutouts/
  body: 'Texto da janela…',    // aparece na janela e, resumido, na janela presa no chão
  links: [{ label: 'Saiba mais', url: 'https://…' }], // botões; [] para nenhum
  reveal: true,                // (opcional) mostra o texto em 3D em vez de abrir janela (só a apresentação usa)
}
```

**Para adicionar um recorte:**

1. Abra `src/data/level.js` e encontre `export const ITEMS`.
2. Copie uma linha `item(...)` parecida e cole logo abaixo dela.
3. Troque o **id** por um que ainda não existe e ajuste título, subtítulo e grupo.
4. Escolha a posição `x, z` na rua certa:

   | Rua | `x` | `z` (de… até) |
   |---|---|---|
   | Desenvolvimento | `-46` | `-78` até `-165` |
   | Design | `-30` | `-62` até `-165` |
   | Diversidade | `-14` | `-78` até `-165` |
   | Formações | `30` | `-62` até `-165` |

   Deixe pelo menos **20 m** entre recortes da mesma rua. Para descobrir uma coordenada exata, pedale até o lugar e digite `__game.bike.body.position` no console (F12).
5. No objeto de opções, defina `image`, `body` e `links`. Exemplo completo:
   ```js
   item('edu-4', 'formacoes', 'Pós em Ciência de Dados', 'Dados', 30, -155, {
     image: 'formacoes/edu-4.webp',
     body: 'Especialização concluída em 2025, com foco em engenharia de dados e machine learning.',
     links: [{ label: 'Certificado', url: 'https://link-do-certificado' }],
   }),
   ```
6. Coloque a imagem em `src/assets/cutouts/formacoes/edu-4.webp` (enquanto não existir, o jogo gera um recorte provisório com o título).
7. Salve. O inventário, a porcentagem e o "Você zerou!" se ajustam sozinhos ao novo total.

**Interações disponíveis por recorte:** `links` (abrem no visualizador em tela cheia e contam como "saiba mais visitado" no inventário) e `reveal` (texto em 3D). Para uma interação nova, o ponto de entrada é a função `hitTotem()` em `src/main.js`.

**Para remover:** apague a linha `item(...)` inteira (com a vírgula). Ids antigos salvos no navegador são ignorados automaticamente.

**Para criar uma categoria nova:** acrescente uma linha em `GROUPS` (`voluntariado: { label: 'Voluntariado', color: PALETTE.violet }`) e use a chave nos itens.

#### Placas magnéticas (`SIGNS`)

```js
{ label: 'Design', x: -35, z: -84, image: 'signs/design.webp', pull: [-30, -86] }
```
`label` é o texto do recorte provisório, `x/z` a posição do poste, `image` o recorte em `src/assets/cutouts/` e `pull` o ponto para onde a placa "puxa" a bike quando ela passa perto sem virar.

#### Ruas (`ROADS`), limites (`BOUNDS`), pontos do rebobinar (`CHECKPOINTS`) e zonas de câmera (`ZONES`)

- `ROADS`: cada rua é um segmento `[[x1, z1], [x2, z2]]`; `ROAD_WIDTH` é a largura.
- `BOUNDS`: até onde a bike e a câmera podem ir.
- `CHECKPOINTS`: para onde o botão Rebobinar leva (`start` e `fork`).
- `ZONES`: áreas onde a câmera muda de enquadramento e mostra um aviso. Cada zona tem `test` (função que recebe a posição da bike e devolve true/false), `view` (offset e look da câmera) e `message` (opcional).

> Se mover uma rua, mova também os recortes e placas dela.

### 4.3 Como alterar imagens e ativos

| Ativo | Onde colocar | Observações |
|---|---|---|
| **Foto de perfil** (miniatura, céu e janela "Sobre") | `src/assets/images/profile.jpeg` | Nome configurado em `PROFILE.image` (`level.js`). Aceita jpg, jpeg, png, webp ou avif. Até 1600 px no maior lado. |
| **Imagem de prévia ao compartilhar** (WhatsApp/LinkedIn) | `public/og-image.jpg` | 1200×630 px, JPEG com **até ~300 KB** (o WhatsApp ignora imagens pesadas). Na tag `og:image` o endereço é `https://…/marina-portfolio/og-image.jpg`, **sem** `/public/`. |
| **Favicon** | `public/favicon.svg` + `public/apple-touch-icon.png` | Veja [4.1](#41-como-alterar-o-favicon). |
| **Ícones do topo** (LinkedIn, GitHub, e-mail, WhatsApp, CV) | `src/assets/ui/icons/*.svg` | Substitua mantendo o nome. Para um ícone novo, copie um `<a>` em `index.html` (`<nav class="hud-links">`). |
| **Bicicleta** | não usa imagem | É um modelo 3D montado em `src/world/bike.js` (cores no objeto `COLORS`). |
| **Primeiro recorte** ("Marina Micas Jardim") | não usa imagem própria | O jogo desenha um cartão com a foto de perfil, no mesmo visual dos cartões das Experiências. |
| **Música** | `public/som.mp3` | Troque mantendo o nome (ou ajuste `AUDIO.file`). |
| **Placas** | `src/assets/cutouts/signs/*.webp` | `experiencias`, `formacoes`, `desenvolvimento`, `design`, `diversidade`. |
| **Experiências / Formações** | `src/assets/cutouts/experiencias/{desenvolvimento,design,diversidade}/*.webp`, `src/assets/cutouts/formacoes/*.webp` | O nome deve ser idêntico ao campo `image` do item. |
| **Currículo em PDF** | `public/docs/curriculo-marina-micas.pdf` | Nome exato; o botão "CV" do topo aponta para ele. **Tem que ser dentro de `public/`**: a pasta `docs/` da raiz funciona no `npm run dev`, mas não vai para o site publicado. |

> **Regra da pasta `public/`:** o Vite copia o *conteúdo* de `public/` para a raiz do site publicado. Então `public/docs/x.pdf` vira `https://…/marina-portfolio/docs/x.pdf` e, no HTML, o link é `./docs/x.pdf`. Nunca escreva `/public/` em um endereço. Arquivos fora de `public/` (e que não são importados pelo código) não entram no site.

**Dicas para os recortes:** PNG/WebP com fundo transparente, no máximo 2048 px no maior lado. O contorno transparente é o que vira os pedaços de papel na explosão. Enquanto um arquivo não existir, o jogo gera um recorte provisório automaticamente.

#### Foto de perfil: calibrando a posição dos olhos

A foto aparece em três lugares: miniatura no canto superior esquerdo, fundo sutil do "céu" e janela "Sobre a Marina". No céu, a foto é ampliada para cobrir a tela de modo que **os olhos fiquem sempre no mesmo ponto da tela**, em qualquer tamanho de janela, pan ou zoom. Para isso o jogo precisa saber onde os olhos estão na foto:

1. Coloque a foto em `src/assets/images/profile.jpeg` (ou outro nome, ajustando `PROFILE.image`).
2. Abra `http://localhost:5173/?olhos`: uma **mira vermelha** marca o ponto onde os olhos devem estar.
3. Em `src/data/level.js`, ajuste `PROFILE.eyes` (fração da foto: `x` 0 = esquerda, 1 = direita; `y` 0 = topo, 1 = base) até a mira ficar sobre os olhos. Salve e a página atualiza.
4. Se quiser os olhos em outro ponto **da tela**, ajuste `PROFILE.anchor` (fração da janela). O padrão `{ x: 0.5, y: 0.3 }` deixa os olhos a 30% da altura, abaixo do HUD do topo.
5. Teste redimensionando a janela e no modo celular do F12 (Ctrl + Shift + M): a mira deve continuar sobre os olhos.

### 4.4 Como ajustar parâmetros do jogo

| Quero mudar… | Arquivo | O que alterar |
|---|---|---|
| **Velocidade, curva e precisão da bike** (teclado e botões) | `src/data/level.js`, `BIKE` | `maxSpeed: 10`, `boostSpeed: 16` (m/s), `turnRate: 2.4` (rad/s), `pivotFactor`, `accel`, `brake`, `turnSmoothing`; arraste em `BIKE.drag`. |
| **Vidas** | `src/data/level.js`, `LIVES` | `start: 6`, `treeDamage`, `jaguarDamage`, `cutoutHeal`, `invulnerableSeconds`. |
| **Floresta, bichos e neve** | `src/data/level.js`, `FOREST`, `CRITTERS`, `SNOW` | Quantidades, cores, caminhos das onças, transparência da neve. |
| **Abertura** (triângulo neon) | `src/data/level.js`, `INTRO` | Tamanho, tempos e cores. |
| **Música** | `src/data/level.js`, `AUDIO` | Arquivo (`public/som.mp3`), volume e crédito. |
| **Placas de fim de rota** | `src/data/level.js`, `END_SIGNS` | Rota, posição e frase poética. |
| Velocidade mínima para atropelar | `src/world/totems.js` | `const HIT_SPEED = 2` (m/s). |
| **Intensidade do zoom** (roda do mouse, pinça, teclas) | `src/core/input.js`, objeto `SETTINGS.zoom` | `wheel: 0.0014` (por pixel da roda), `trackpadPinch: 0.012`, `key: 0.16` (por toque em + / −). Maior = zoom mais rápido. |
| Limites e suavidade do zoom | `src/core/CameraRig.js`, `constructor` | `zoomLimits = { min: 0.45, max: 1.9 }` (0.45 = bem perto; 1.9 = quase o dobro da distância); `zoomSmoothing = 14` (maior = segue o gesto mais rápido). |
| **Câmera** (quão colada na bike) | `src/main.js`, `rig.lag` | `8` jogando, `14` no rebobinar (maior = cola mais). Não existe mais pan: a câmera segue a bike sempre. |
| Área para "pegar" a bike com o dedo | `src/core/input.js`, `SETTINGS.drag` | `bikeHitRadius: 48` (px). Só vale com os botões na tela ocultos. |
| Botões na tela (tamanho, começar ocultos) | `main.css` `--pad-size`; `src/ui/controls.js` `DEFAULT_VISIBLE` | 64 px (58 no celular); `true` = começam visíveis. |
| Toque duplo, toque longo | `src/core/input.js`, `SETTINGS.tap` e `longPressMs` | `doubleGap: 320` ms entre toques; `longPressMs: 900`. |
| **Cores do cenário** (mundo 3D) | `src/data/level.js`, `PALETTE` | Códigos `#RRGGBB`. Cor do chão: `'#17111f'` em `buildGround` (`environment.js`); das ruas: `'#2a1f3d'`. |
| Cores das janelas, botões e HUD | `src/styles/main.css`, bloco `:root` | Mesmas variáveis (`--purple`, `--lilac`…). Mantenha igual à `PALETTE`. |
| Enquadramento padrão da câmera | `src/data/level.js`, `DEFAULT_VIEW` | `offset` (posição da câmera em relação à bike) e `look` (para onde olha). |
| Neblina / alcance de visão | `src/core/stage.js` | `scene.fog = new THREE.Fog(PALETTE.black, 45, 150)` (começa a 45 m, total a 150 m). |
| **Partículas da bike** | `src/data/level.js`, `PARTICLES` | `enabled`, `max` (quantidade), `perMeter` (densidade), `minSpeed`, `life` (duração em s), `size` (metros), `colors`, `additive` (brilho somado ou papel opaco). Forma da partícula: `makeSparkTexture()` em `src/world/particles.js`. |
| **Foto no céu** (opacidade, faixa, modo) | `src/data/level.js`, `PROFILE.sky` | `opacity: 0.22` (0 a 1), `fadeFrom`/`fadeTo` (de onde até onde a foto some, fração da altura), `blend: 'screen'` ou `'normal'`. |
| Efeito do atropelo (câmera lenta, tremida) | `src/main.js`, `cinematicHit()` | `timeScale: 0.12` (12% da velocidade), `'+=0.35'` (quanto tempo fica lento), `rig.shake(0.5, 0.45)`. |
| Quando o guia de gestos aparece | `src/core/invalidGestures.js`, `RULES` | `threshold` (repetições) e `windowMs`. |
| Easter egg da bike (quando o aviso aparece) | `src/main.js`, `maybeTellBikeStory()` | `movingFor < 4`: segundos pedalando até o aviso. |
| Rebobinar (velocidade e visual Matrix) | `src/core/timeMachine.js` e `src/ui/matrix.js` | `total / 45` (m/s); `GLYPHS`, `FONT_PX`, `SPEED` da chuva. |

### 4.5 Como manter o SEO

Tudo fica no `<head>` do [`index.html`](index.html), em blocos comentados:

- **Título e descrição** (`<title>`, `meta description`, `keywords`, `author`): o que o Google mostra. Título até ~60 caracteres úteis; descrição entre 120 e 160.
- **Open Graph** (`og:*`) e **Twitter Cards** (`twitter:*`): montam o cartão de prévia no WhatsApp, LinkedIn, Facebook, Telegram e X. A imagem é `public/og-image.jpg` (1200×630) e **precisa de endereço completo** (`https://…`).
- **JSON-LD** (`<script type="application/ld+json">`): dados estruturados `Person` (quem é a Marina) e `CreativeWork` (o que é o portfólio). Troque os endereços de `sameAs` pelos perfis reais e atualize `dateModified` quando fizer mudanças grandes.
- **Favicon e `theme-color`**: veja [4.1](#41-como-alterar-o-favicon).
- `public/robots.txt` e `public/sitemap.xml`: permitem a indexação e apontam o endereço da página.

**Se o endereço do site mudar** (outro nome de repositório ou domínio próprio), procure por `https://marinamicas.github.io/marina-portfolio/` em `index.html`, `public/robots.txt` e `public/sitemap.xml` e troque em todos.

**Para testar:** cole o endereço publicado em <https://www.opengraph.xyz> (prévia OG), <https://validator.schema.org> (JSON-LD) e <https://search.google.com/test/rich-results>. WhatsApp e LinkedIn guardam a prévia em cache: depois de trocar a imagem, use o [Post Inspector do LinkedIn](https://www.linkedin.com/post-inspector/) para atualizar.

### 4.6 Textos e o easter egg da bicicleta

Os textos longos ficam em `TEXTS` (`src/data/level.js`): apresentação (`intro`), frase do horizonte (`end`), "Você zerou!" (`win`), Game Over, confirmação do reset, pergunta de recomeço e o **easter egg da bike** (`bike`):

> "A escolha da bicicleta não foi por acaso: amo andar de bike!"

Ele aparece em dois lugares: na janela **"Sobre a Marina"** (clique na miniatura da foto) e, uma vez por visita, como aviso 1,5 s depois do primeiro arraste da bike (lógica em `maybeTellBikeStory()`, `src/main.js`). Os textos dos botões e títulos das janelas ficam em `src/ui/screens.js` e `src/ui/profile.js`; os do guia de navegação em `src/ui/guide.js`.

---

## 5. Publicando no GitHub Pages

O deploy é automático via GitHub Actions ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)): a cada `push` na branch `main`, o site é construído e publicado.

```bash
git status                                  # vê o que mudou
git add .                                   # prepara tudo
git commit -m "Atualiza textos das formações"
git push                                    # envia e publica
```

Acompanhe na aba **Actions** do repositório. Na primeira vez: **Settings → Pages → Build and deployment → Source: GitHub Actions**. O `vite.config.js` usa `base: './'`, então funciona com qualquer nome de repositório.

**Antes de publicar pela primeira vez:**

1. Em `index.html`, troque os links do header: `SEU-PERFIL` (LinkedIn), `seu-email@exemplo.com` e `55DDDNUMERO` (WhatsApp). Troque também em `sameAs` do JSON-LD e no bloco `<noscript>`.
2. Coloque o currículo em `public/docs/curriculo-marina-micas.pdf`.
3. Confira a foto de perfil em `src/assets/images/profile.jpeg` e a calibração dos olhos ([4.3](#43-como-alterar-imagens-e-ativos)).
4. Se trocar `public/og-image.jpg`, mantenha 1200×630 e até ~300 KB.
5. Troque os `https://example.com` dos links em `src/data/level.js`.

---

## 6. Arquitetura do código

Todos os arquivos têm comentários didáticos em português: cabeçalho com o papel do módulo e "Onde mexer", e explicação em cada função, variável e evento.

```
marina-portfolio/
├── index.html               # estrutura da página + SEO (meta, OG, Twitter, JSON-LD, favicon)
├── public/                  # copiados sem alteração para o site
│   ├── favicon.svg          # ícone da aba
│   ├── apple-touch-icon.png # ícone 180×180 (iPhone/iPad)
│   ├── og-image.jpg         # prévia 1200×630 ao compartilhar (troque pela sua)
│   ├── robots.txt, sitemap.xml
│   ├── som.mp3              # música de fundo (Daniel Micas Jardim da Silva)
│   └── docs/                # currículo em PDF
├── docs/MANUAL-DE-ATUALIZACAO.md  # manual passo a passo para iniciantes (★ seção 5.0: inserir recortes)
└── src/
    ├── main.js              # "maestro": inicialização, abertura, loop, atropelos, batidas e vidas
    ├── data/level.js        # ★ CONTEÚDO E AJUSTES: textos, ITEMS, ruas, placas, BIKE, LIVES, FOREST, CRITTERS, SNOW, INTRO, AUDIO…
    ├── styles/main.css      # cabeçalho sólido, botões, controles na tela, janelas, rebobinar Matrix
    ├── assets/
    │   ├── images/          # ★ foto de perfil (profile.jpeg)
    │   ├── cutouts/         # ★ recortes (experiências, formações, placas)
    │   └── ui/icons/        # ícones do topo
    ├── core/
    │   ├── stage.js         # renderer, cena, câmera, luzes e área do canvas (abaixo do cabeçalho)
    │   ├── physics.js       # mundo cannon-es + materiais de contato
    │   ├── CameraRig.js     # câmera que segue a bike sempre: zoom, enquadramentos, tremida
    │   ├── input.js         # teclado + botões na tela (mesmo comando), zoom, sensibilidades
    │   ├── pointerControls.js # arrastar a bike (botões ocultos), pinça, toque duplo
    │   ├── device.js        # detecta touch x mouse
    │   ├── invalidGestures.js # detector de gestos não suportados
    │   ├── state.js         # inventário e vidas no sessionStorage
    │   ├── timeMachine.js   # gravação da trajetória, rebobinar rápido, viagens do inventário
    │   └── visitors.js      # contador de visitantes (API Abacus)
    ├── world/
    │   ├── environment.js   # chão, ruas, prismas físicos, placas, placas de fim de rota, horizonte
    │   ├── bike.js          # bike 3D low-poly + corpo físico + arraste + seta de direção
    │   ├── intro.js         # abertura: triângulo neon e bike saindo da terra
    │   ├── forest.js        # árvores (com colisão) e flores triangulares
    │   ├── critters.js      # borboletas, pássaros, coelhos e onças
    │   ├── snow.js          # neve de triângulos
    │   ├── totems.js        # recortes colecionáveis + explosão em papel
    │   └── particles.js     # rastro de partículas da bike e explosões (THREE.Points + shader)
    ├── ui/
    │   ├── onboarding.js    # janela inicial "Como jogar" + botão do currículo
    │   ├── controls.js      # botões de direção ◀ ▶ ▲ ▼ ⚡ e botão 🎮
    │   ├── audio.js         # música e botão de som com créditos
    │   ├── matrix.js        # chuva de caracteres do rebobinar
    │   ├── profile.js       # foto de perfil: miniatura, céu ancorado nos olhos, janela "Sobre"
    │   ├── modal.js         # janela flutuante
    │   ├── screens.js       # barra, vidas, item, inventário, zerou, game over, fim das vidas, resetar
    │   ├── guide.js         # instruções dinâmicas (aparelho + modo de controle) e guia de gestos
    │   ├── pins.js          # janelas "saiba mais" presas no chão
    │   ├── viewer.js        # visualizador em tela cheia para links externos
    │   └── effects.js       # toast, papeizinhos e clarão de dano
    └── utils/               # texturas em canvas, carregamento de recortes, foto de perfil, helpers
```

**Como a foto do céu funciona:** a câmera do jogo olha para o chão, então o céu de verdade quase nunca aparece. A foto é uma camada HTML fixa por cima do canvas, em modo de mistura `screen` (só clareia o que está escuro), o que dá o efeito de fundo sem cobrir nada. Como a camada é fixa na área do jogo, zoom e movimento da câmera não a afetam; `src/ui/profile.js` recalcula tamanho e posição a cada redimensionamento mantendo os olhos no ponto `PROFILE.anchor`.

**Como as partículas funcionam:** `src/world/particles.js` reserva um pool de `PARTICLES.max` partículas em uma única malha `THREE.Points`. A cada quadro mede quanto a bike andou, solta novas partículas ao longo do trecho (`perMeter`) e envelhece as vivas; um shader encolhe o tamanho e reduz a transparência conforme a vida (1 → 0).

---

## 7. Regras de jogo implementadas

- **Progresso:** cada recorte atropelado conta uma vez e fica em `sessionStorage`, válido enquanto a aba estiver aberta.
- **Estado final mantido:** recortes conquistados continuam destruídos, com a janela "saiba mais" presa no chão, ao rebobinar e ao recarregar a página.
- **Rebobinar:** para a bifurcação das placas ou para o início, em alta velocidade e com visual "Matrix" (cena verde e chuva de caracteres). Os objetos soltos voltam ao lugar; o inventário é mantido.
- **Reset completo:** menu **⟲ Rebobinar → ↺ Resetar tudo** (com confirmação) ou **Tentar novamente → Resetar tudo**.
- **Vidas:** 6 no início; árvore ou onça tira 1, recorte explodido devolve 1 (máximo 6). Com zero aparece **"Fim das vidas!"** (tentar de novo, ver currículo ou ir aos contatos).
- **Primeiro recorte:** cartão com a foto; ao ser atropelado abre a janela "Sobre a Marina" e depois fica preso no chão como os outros.
- **Fim de rota:** cada rua termina numa placa com uma frase poética.
- **Cabeçalho:** fundo sólido; o canvas do jogo começa abaixo dele, então os contatos ficam sempre visíveis.
- **Placas magnéticas:** ao passar perto de uma placa sem virar, a bike é puxada suavemente para a rua que ela indica.
- **Inventário:** mostra os recortes conquistados e se o link "saiba mais" foi aberto. Clicar num recorte leva a bike até ele.
- **Game Over:** só ao tentar **fechar ou recarregar a aba** sem 100% do inventário (aviso nativo do navegador; se a pessoa ficar, aparece o Game Over).
- **Contatos do topo** (LinkedIn, GitHub, e-mail, WhatsApp, currículo, também nas janelas "Zerou", "Contatos" e "Sobre"): abrem **direto** no destino, em nova aba (o e-mail abre o app de e-mail). Isso vem do atributo `data-viewer-skip` em cada `<a>` do `index.html`.
- **Links "Saiba mais" dos recortes:** abrem num visualizador em tela cheia dentro do jogo. Sites que proíbem iframe mostram um cartão com "Copiar link". PDFs no celular mostram um cartão com "Abrir PDF" e "Baixar", porque celulares não exibem PDF dentro da página.
- **Contador de visitantes:** via API gratuita [Abacus](https://abacus.jasoncameron.dev); configuração em `VISITORS` (`level.js`).
- **Sobre a Marina:** a miniatura da foto abre a janela com foto, apresentação, easter egg da bike e contatos.
- **Zerou:** aparece quando o último recorte é atropelado.
