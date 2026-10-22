# Manual de atualização e modificação do portfólio

Este manual é para quem está começando a programar. Cada tarefa tem um passo a passo
com o arquivo exato que você vai abrir, o trecho que deve procurar e como conferir se deu certo.

> **Regra de ouro:** altere uma coisa de cada vez, salve, olhe o resultado no navegador
> e só então passe para a próxima. Se algo quebrar, você sabe exatamente o que foi.

---

## Sumário

1. [Ferramentas necessárias](#1-ferramentas-necessárias)
2. [Abrindo e rodando o projeto](#2-abrindo-e-rodando-o-projeto)
3. [Entendendo as pastas](#3-entendendo-as-pastas)
4. [Como o jogo funciona (regras)](#4-como-o-jogo-funciona-regras)
5. [Receitas de alteração](#5-receitas-de-alteração)
   - ★ [5.0 Passo a passo completo: inserir recortes de Experiências e Formações](#50--passo-a-passo-completo-inserir-recortes-de-experiências-e-formações)
   - 5.1 Mudar os textos gerais
   - 5.2 Editar um recorte existente (título, texto, links)
   - 5.3 Adicionar um novo recorte
   - 5.4 Remover um recorte
   - 5.5 Colocar as imagens reais dos recortes
   - 5.6 Trocar os contatos do topo e o currículo
   - 5.7 Mudar as cores
   - 5.8 Ajustar a janela presa no chão
   - 5.9 Inventário e progresso salvo
   - 5.10 Botão Resetar, Game Over e "Tentar novamente"
   - 5.11 Rebobinar
   - 5.12 Ruas, placas, câmera e limites do mapa
   - 5.13 Velocidade da bike e força para atropelar
   - 5.14 Gestos, zoom e sensibilidade dos controles
   - 5.15 Guia de navegação e gestos inválidos
   - 5.16 Links externos no visualizador em tela cheia
   - 5.17 Contador de visitantes
   - 5.18 Foto de perfil: miniatura, céu e janela "Sobre"
   - 5.19 Partículas da bike
   - 5.20 SEO, favicon e prévia ao compartilhar
   - 5.21 Easter egg da bicicleta
   - 5.22 Vidas (árvores, onças e recortes)
   - 5.23 Floresta, bichos e neve
   - 5.24 Botões de direção na tela, teclado e arrastar a bike
   - 5.25 Abertura (triângulo neon) e janela inicial de instruções
   - 5.26 Música de fundo e créditos
   - 5.27 Placas de fim de rota
   - 5.28 Bike 3D (cores e formato)
6. [Testando antes de publicar](#6-testando-antes-de-publicar)
7. [Publicando no GitHub Pages](#7-publicando-no-github-pages)
8. [Problemas comuns e soluções](#8-problemas-comuns-e-soluções)
9. [Glossário](#9-glossário)

---

## 1. Ferramentas necessárias

Instale uma vez só:

| Ferramenta | Para quê | Onde baixar |
|---|---|---|
| **Node.js 20 ou mais novo** (recomendado 24 LTS) | Roda o projeto no seu computador | https://nodejs.org |
| **Visual Studio Code** | Editor para abrir e alterar os arquivos | https://code.visualstudio.com |
| **Git** | Salva o histórico das alterações e envia para o GitHub | https://git-scm.com |

Para conferir se o Node foi instalado, abra um terminal e digite:

```bash
node -v
npm -v
```

Se aparecerem números de versão (ex.: `v24.1.0`), está tudo certo.

---

## 2. Abrindo e rodando o projeto

1. Abra o **VS Code**.
2. Vá em **Arquivo → Abrir Pasta…** e escolha a pasta `marina-portfolio`.
3. Abra o terminal dentro do VS Code: menu **Terminal → Novo Terminal**.
4. **Só na primeira vez** (ou quando o `package.json` mudar), instale as dependências:
   ```bash
   npm install
   ```
5. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
6. O terminal vai mostrar um endereço como `http://localhost:5173`. Segure **Ctrl** e clique nele
   (ou copie e cole no navegador).
7. Pronto! Agora, **toda vez que você salvar um arquivo (Ctrl + S), a página atualiza sozinha**.
8. Para parar o servidor, clique no terminal e aperte **Ctrl + C**.

### Abrindo o console do navegador

O console mostra erros e permite testar coisas. No Chrome/Edge aperte **F12** e clique na aba **Console**.

Enquanto o projeto roda com `npm run dev`, existe um atalho de depuração no console:

```js
__game.state       // mostra o progresso (recortes coletados, links visitados)
__game.totems      // lista dos recortes no mapa
__game.bike.body.position  // posição atual da bike (x, y, z)
```

> **Dica para descobrir coordenadas:** pedale até o lugar onde quer colocar algo, digite
> `__game.bike.body.position` no console e anote os valores de `x` e `z`.

---

## 3. Entendendo as pastas

```
marina-portfolio/
├── index.html              ← estrutura da página + SEO (título, descrição, prévia, favicon)
├── public/                 ← arquivos copiados sem alteração
│   ├── favicon.svg         ← ícone da aba
│   ├── apple-touch-icon.png ← ícone 180×180 para iPhone/iPad
│   ├── og-image.jpg        ← imagem de prévia ao compartilhar o link (1200×630)
│   ├── robots.txt, sitemap.xml ← ajudam o Google a indexar
│   ├── som.mp3             ← música de fundo (de Daniel Micas Jardim da Silva)
│   └── docs/               ← currículo em PDF
├── docs/                   ← este manual
└── src/
    ├── main.js             ← "maestro": junta tudo, roda o loop do jogo, atropelos, batidas e vidas
    ├── data/level.js       ← ★ CONTEÚDO E AJUSTES: textos, recortes, ruas, placas, bike, vidas, floresta, bichos, som…
    ├── styles/main.css     ← aparência do cabeçalho, botões, janelas, controles na tela, rebobinar
    ├── assets/
    │   ├── images/         ← ★ FOTO DE PERFIL (profile.jpeg)
    │   ├── cutouts/        ← ★ IMAGENS dos recortes (experiências, formações, placas)
    │   └── ui/icons/       ← ícones do topo (LinkedIn, GitHub, e-mail…)
    ├── core/
    │   ├── state.js        ← inventário e vidas salvos na aba do navegador
    │   ├── timeMachine.js  ← rebobinar (estilo Matrix), viagens pelo inventário, reset do mundo
    │   ├── CameraRig.js    ← câmera que segue a bike o tempo todo
    │   ├── input.js        ← teclado + botões na tela (mesmo comando), zoom e sensibilidades
    │   ├── pointerControls.js ← arrastar a bike (botões ocultos), pinça e toque duplo
    │   ├── device.js       ← descobre se o visitante usa dedo (celular) ou mouse (PC)
    │   ├── invalidGestures.js ← percebe gestos que o site não suporta
    │   ├── physics.js      ← física (gravidade, colisões)
    │   ├── visitors.js     ← contador de visitantes
    │   └── stage.js        ← cena 3D, luzes, câmera e a área do canvas (abaixo do cabeçalho)
    ├── world/
    │   ├── totems.js       ← os recortes colecionáveis e a explosão em papel
    │   ├── bike.js         ← a bike 3D (modelo, velocidade, curvas, arraste, placas magnéticas)
    │   ├── intro.js        ← abertura: triângulo neon e bike saindo da terra
    │   ├── forest.js       ← árvores (com colisão) e flores triangulares
    │   ├── critters.js     ← borboletas, pássaros, coelhos e onças (as onças tiram vida)
    │   ├── snow.js         ← neve de triângulos
    │   ├── particles.js    ← rastro de partículas da bike e explosões de terra
    │   └── environment.js  ← chão, ruas, prismas, placas, placas de fim de rota, horizonte
    ├── ui/
    │   ├── onboarding.js   ← janela inicial com as instruções e o botão do currículo
    │   ├── controls.js     ← botões de direção na tela (◀ ▶ ▲ ▼ ⚡) e o botão 🎮
    │   ├── audio.js        ← música de fundo e botão de som com os créditos
    │   ├── matrix.js       ← chuva de caracteres verdes do rebobinar
    │   ├── profile.js      ← foto de perfil: miniatura, foto no céu e janela "Sobre a Marina"
    │   ├── screens.js      ← cabeçalho (barra e vidas) e janelas: item, inventário, zerou, game over, fim das vidas, resetar
    │   ├── viewer.js       ← visualizador em tela cheia para os links "Saiba mais"
    │   ├── pins.js         ← janelas presas no chão depois que o recorte é destruído
    │   ├── guide.js        ← instruções de jogo (celular x PC, botões x arrastar) e guia de gestos
    │   ├── modal.js        ← a janela flutuante (abrir/fechar)
    │   └── effects.js      ← avisos (toast), papeizinhos e clarão vermelho de dano
    └── utils/              ← funções auxiliares, texturas e localização da foto de perfil
```

**Na maioria das vezes você só vai mexer em 4 lugares:**

1. `src/data/level.js` → conteúdo e ajustes do jogo (textos, recortes, links, bike, vidas, floresta, som).
2. `src/assets/cutouts/` e `src/assets/images/` → imagens.
3. `index.html` → contatos do topo e textos de SEO.
4. `public/` → favicon, prévia de compartilhamento e currículo.

> Todos os arquivos de código têm comentários em português explicando cada função,
> variável e evento. Antes de mudar algo, leia o cabeçalho do arquivo: ele tem uma lista
> "Onde mexer" com os ajustes mais comuns.

---

## 4. Como o jogo funciona (regras)

Entender as regras ajuda a saber onde mexer:

0. **Abertura**: ao carregar a página, um triângulo neon é desenhado no chão e a bike sai da terra de dentro
   dele. Em seguida aparece a **janela de instruções**, adaptada ao aparelho (celular ou computador) e ao modo
   de controle, com um botão grande **"Ver o currículo agora"** para quem não quer jogar.
1. **Atropelar um recorte**: a bike precisa estar em movimento. O recorte explode em pedaços de papel,
   entra no **inventário**, **devolve 1 vida** e abre uma janela com o texto e o botão **"Saiba mais"**.
   O primeiro recorte ("Marina Micas Jardim") abre a janela **"Sobre a Marina"**.
2. **Janela presa no chão**: depois da explosão, uma versão pequena da janela fica fixa no chão, ao lado
   de onde o recorte estava. O link "Saiba mais" dela pode ser clicado a qualquer momento.
3. **Estado final mantido**: o que já foi capturado **continua destruído** (com a janela no chão) mesmo
   quando você:
   - rebobina para a bifurcação;
   - rebobina para o início;
   - escolhe "Manter o inventário" ao tentar novamente;
   - recarrega a página (F5) na mesma aba.
4. **Reset completo pelo menu ⟲ Rebobinar → ↺ Resetar tudo** (pede confirmação) ou por Tentar novamente →
   **Resetar tudo**. Só aí o inventário é apagado e os recortes voltam a ficar de pé.
4b. **Vidas**: começa com 6 (♥ no cabeçalho). Bater numa árvore ou encostar numa onça tira 1; explodir um
   recorte devolve 1 (até o máximo de 6). Com zero vidas aparece **"Fim das vidas!"** com "Tentar novamente",
   "Ver currículo" e "Ir aos contatos". Tentar novamente enche as vidas.
5. **Game Over só ao tentar sair da página**: se a pessoa tenta fechar ou recarregar a aba sem 100% do
   inventário, o navegador mostra o aviso nativo dele ("Sair do site?"). Se ela escolher **ficar**, aparece o
   **Game Over** com "Continuar jogando", "Tentar novamente" e "Ir aos contatos".
   - Com o inventário **completo**, nenhum aviso aparece.
   - O texto do aviso nativo não pode ser mudado (regra dos navegadores).
   - No celular, principalmente no iPhone, os navegadores muitas vezes não mostram esse aviso.
6. **Tentar novamente / Jogar de novo** faz uma segunda pergunta:
   - **Manter o inventário** → a bike volta ao ponto de partida e tudo o que foi conquistado continua;
   - **Resetar tudo** → apaga o inventário e remonta todos os recortes.
   - Se o inventário estiver vazio, não pergunta nada: só volta ao início.
7. **Onde o progresso fica salvo**: no `sessionStorage` do navegador. Vale enquanto a aba estiver aberta;
   fechar a aba apaga tudo. Nada é enviado para servidor.
8. **Controles e zoom**:

   | Ação | Computador | Celular/tablet |
   |---|---|---|
   | Virar | ◀ ▶ na tela, ou A D / setas laterais | ◀ ▶ na tela |
   | Pedalar / frear e ré / turbo | ▲ / ▼ / ⚡ na tela, ou W / S / Shift | ▲ / ▼ / ⚡ na tela |
   | Arrastar a bike (só com os botões **ocultos** no 🎮) | clicar na bike e arrastar | tocar na bike e arrastar |
   | Zoom | roda do mouse, pinça no trackpad, teclas + e − | pinça com dois dedos |
   | Zoom normal | duplo clique ou tecla 0 | toque duplo |
   | Ajuda | botão **? Ajuda** | botão **? Ajuda** |

   - A **câmera segue a bike o tempo todo** (não existe mais "arrastar o cenário").
   - O **teclado está sempre ativo** (acessibilidade) e as teclas funcionam juntas (ex.: W + A).
   - Com os **botões na tela visíveis**, tocar/arrastar a bike não a move. Ocultando os botões (🎮),
     arrastar volta a funcionar: a bike pedala até o ponto apontado.

9. **Guia de navegação**: se a pessoa tenta um gesto que o site não suporta (clicar/tocar no mapa várias
   vezes, botão direito, três dedos, segurar o dedo parado, deslizar para os lados, apertar teclas sem
   função), aparece um guia com as instruções do aparelho dela. O botão **"Não mostrar esta dica
   novamente"** grava a escolha no `localStorage`, que continua valendo mesmo depois de fechar o navegador.

---

## 5. Receitas de alteração

### 5.0 ★ Passo a passo completo: inserir recortes de Experiências e Formações

Esta é a tarefa mais frequente do portfólio. Você só precisa de **dois arquivos**:

| O quê | Onde |
|---|---|
| A **imagem** do recorte (o cartão) | uma pasta dentro de `src/assets/cutouts/` |
| O **cadastro** do recorte (título, texto, posição, links) | `src/data/level.js`, na lista `ITEMS` |

Inventário, porcentagem de "Conhecimento sobre Marina", vidas, janela presa no chão, explosão em
papel e "Você zerou!" se ajustam **sozinhos**. Você não precisa mexer em nenhum outro arquivo.

---

#### Passo 1 — Preparar a imagem do cartão

Os cartões atuais foram exportados do Figma com **285 px de largura** e altura variável
(de 479 a 773 px). Siga o mesmo padrão para o novo cartão combinar com os outros:

1. No Figma (ou outro editor), monte o cartão com: título, imagem, etiquetas (ano e ferramentas),
   texto curto e o botão "Atropele para saber mais". Use os cartões existentes como modelo:
   abra um deles em `src/assets/cutouts/experiencias/design/` para conferir.
2. Exporte em **PNG**, **285 px de largura**, com **fundo transparente** fora do cartão
   (os cantos arredondados precisam ficar transparentes). É o contorno transparente que vira os
   pedaços de papel na explosão.
3. **Anote a altura em pixels** da imagem exportada. Você vai usar esse número no passo 5.
   - No Windows: clique com o botão direito no arquivo → **Propriedades → Detalhes → Altura**.
   - No VS Code: abra a imagem; o tamanho aparece no canto inferior direito.
4. Tamanho do arquivo: tente ficar abaixo de **150 KB** (os atuais têm de 38 a 86 KB).

#### Passo 2 — Salvar a imagem na pasta certa

| Tipo de recorte | Pasta |
|---|---|
| Experiência de Desenvolvimento | `src/assets/cutouts/experiencias/desenvolvimento/` |
| Experiência de Design | `src/assets/cutouts/experiencias/design/` |
| Experiência de Diversidade | `src/assets/cutouts/experiencias/diversidade/` |
| Formação | `src/assets/cutouts/formacoes/` |

Sobre o **nome do arquivo**:

- Pode ter espaços e acentos (os atuais têm, ex.: `design - Minha marca.png`), mas o nome no
  código precisa ser **idêntico letra por letra**, inclusive maiúsculas, acentos e a extensão `.png`.
- Para evitar erro de digitação, prefira nomes simples, sem acento: `design-novo-projeto.png`.
- Dica: no Explorador de Arquivos, clique no arquivo, aperte **F2** e **Ctrl + C** para copiar o nome exato.

#### Passo 3 — Abrir o cadastro

1. No VS Code, abra `src/data/level.js`.
2. Aperte **Ctrl + F** e procure por `export const ITEMS`.
3. A lista está organizada por blocos com comentários. Procure o bloco da sua rua:
   - `// FASE 2 — Experiências › Desenvolvimento`
   - `// Experiências › Design`
   - `// Experiências › Diversidade`
   - `// FASE 2 — Formações (rua única)`

#### Passo 4 — Escolher a posição na rua

Cada rua é uma linha reta. O `x` diz **qual rua**; o `z` diz **em que altura da rua**
(quanto mais negativo, mais longe do início).

| Rua | `x` (sempre este) | `z` permitido | Recortes que já existem (`z`) |
|---|---|---|---|
| Desenvolvimento | `-46` | de `-84` até `-152` | `-100`, `-128` |
| Design | `-30` | de `-84` até `-152` | `-100`, `-128` |
| Diversidade | `-14` | de `-84` até `-152` | `-100`, `-128` |
| Formações | `30` | de `-70` até `-152` | `-84`, `-108`, `-132` |

Regras para o `z`:

1. Deixe **pelo menos 14 de distância** de qualquer outro recorte da mesma rua (os cartões têm
   2,4 m de largura e a janela presa no chão precisa de espaço).
2. **Não passe de `-152`**: em `-160` fica a placa de fim de rota.
3. **Evite o caminho das onças** (fique a 5 ou mais de distância destes `z`):
   Desenvolvimento `-114`, Design `-142`, Diversidade `-114`, Formações `-120`.
   (Os caminhos estão em `CRITTERS.jaguars`, no mesmo arquivo.)
4. As árvores se afastam dos recortes **sozinhas**: não precisa se preocupar com elas.
5. Ordem cronológica: o mais antigo fica mais perto do início (z menos negativo).

Exemplos de vagas livres hoje: Desenvolvimento/Design/Diversidade em `z = -86` e `z = -150`
(Design: evite `-142`, use `-150` só se o recorte de `-128` continuar lá); Formações em `z = -150`.

> **Quer conferir um lugar no mapa?** Rode `npm run dev`, abra o console (F12) e teleporte a bike:
> `__game.bike.body.position.set(-46, 0.6, -86)`. A câmera vai até lá.

#### Passo 5 — Copiar o modelo e preencher

Copie o modelo abaixo e cole **dentro do bloco da rua**, logo depois do último `item(...)` dele:

```js
  item('dev-3', 'desenvolvimento', 'Título do projeto', '2025', -46, -150, {
    image: 'experiencias/desenvolvimento/dev-novo-projeto.png',
    size: cardSize(600),
    body: 'Texto que aparece na janela ao atropelar. Conte o contexto, o que você fez e o resultado (2025). Ferramentas e temas: Python, Figma.',
    links: [{ label: 'Saiba mais', url: 'https://link-do-projeto.com' }],
  }),
```

O que é cada parte (a ordem dentro de `item( ... )` **não pode mudar**):

| Parte | Exemplo | O que é | Regras |
|---|---|---|---|
| 1º id | `'dev-3'` | Nome interno único | Sem espaços e sem acentos. **Nunca repita** um id existente e **nunca mude** o id de um recorte já publicado (o inventário dos visitantes usa o id). Padrão: `dev-N`, `design-N`, `div-N`, `edu-N`. |
| 2º grupo | `'desenvolvimento'` | Categoria | Um destes: `desenvolvimento`, `design`, `diversidade`, `formacoes`. Define a etiqueta roxa na janela ("Experiências · Desenvolvimento"). |
| 3º título | `'Título do projeto'` | Título | Aparece na janela grande, na janela do chão e no inventário. |
| 4º subtítulo | `'2025'` | Texto curto | Só aparece se a imagem não carregar (recorte provisório). Use o ano. |
| 5º `x` | `-46` | Rua | Copie da tabela do passo 4. |
| 6º `z` | `-150` | Posição na rua | Escolha seguindo as regras do passo 4. |
| `image:` | `'experiencias/desenvolvimento/dev-novo-projeto.png'` | Caminho da imagem | Começa **depois** de `src/assets/cutouts/`. Nome idêntico ao arquivo. |
| `size:` | `cardSize(600)` | Tamanho no mundo | Coloque entre parênteses a **altura em pixels** anotada no passo 1. Todos os cartões ficam com a mesma largura (2,4 m) e a altura proporcional. |
| `body:` | `'Texto…'` | Texto da janela | Aparece completo na janela grande e resumido (3 linhas) na janela presa no chão. |
| `links:` | `[{ label: 'Saiba mais', url: 'https://…' }]` | Botões | Veja o passo 6. |

**Pontuação que mais quebra o código** (confira duas vezes):

- Cada `item(...)` termina com `}),` — **chave, parêntese e vírgula**.
- Cada opção (`image`, `size`, `body`, `links`) termina com **vírgula**.
- Textos ficam entre **aspas simples** `'...'`. Se o texto tiver apóstrofo (`d'água`), escreva
  `d\'água` ou troque as aspas externas por crases: `` `d'água` ``.

#### Passo 6 — Links do recorte ("Saiba mais")

`links` é uma lista entre colchetes `[ ]`. Cada link é `{ label: 'Texto do botão', url: 'endereço' }`,
separados por vírgula:

```js
    links: [
      { label: 'Saiba mais', url: 'https://www.behance.net/meu-projeto' },
      { label: 'Ver código', url: 'https://github.com/marinamicas/projeto' },
      { label: 'Vídeo', url: 'https://www.youtube.com/watch?v=XXXXXXXX' },
      { label: 'Certificado (PDF)', url: './docs/certificado-x.pdf' },
    ],
```

- **Sites comuns e vídeos** (YouTube/Vimeo) abrem num visualizador em tela cheia dentro do jogo.
- **PDF próprio** (certificado, artigo): coloque o arquivo em `public/docs/` e use `./docs/nome.pdf`
  (sem `public/` no endereço!). No celular, o PDF abre no leitor do aparelho.
- **LinkedIn, GitHub, Instagram…** não deixam ser exibidos dentro de outro site: aparece um cartão com
  "Copiar link".
- Sem links: `links: []`.

#### Passo 7 — Salvar e conferir

1. Salve (**Ctrl + S**). Com `npm run dev` rodando, a página recarrega sozinha.
2. Confira a lista:
   - [ ] O contador do inventário aumentou (ex.: `0/10` → `0/11`).
   - [ ] O cartão aparece na rua, com a imagem real (se aparecer um papel colorido com o título,
         o caminho em `image:` não bate com o arquivo; volte ao passo 2).
   - [ ] O cartão não está esticado (se estiver, o número em `cardSize(...)` não é a altura da imagem).
   - [ ] Atropelar o cartão abre a janela com o seu texto e devolve 1 vida.
   - [ ] Depois de fechar, a janela fica presa no chão, à direita da rua.
   - [ ] O console (F12) não mostra erro em vermelho.
3. Atalhos de teste no console (F12):
   ```js
   __game.totems.map((t) => t.item.id)                 // lista os ids: o novo precisa aparecer
   __game.bike.body.position.set(-46, 0.6, -150 + 8)   // leva a bike para 8 m antes do cartão (troque x e z)
   ```
   Depois aperte **W** (ou ▲) para atropelar.

#### Exemplo completo: nova Formação

As três formações atuais (`edu-1`, `edu-2`, `edu-3`) ainda são **provisórias** ("Formação 1/2/3").
Para trocar uma delas pelo seu cartão real, **mantenha o id** e substitua o resto. Antes:

```js
  item('edu-1', 'formacoes', 'Formação 1', 'Informática', 30, -84, { image: 'formacoes/edu-1.webp' }),
```

Depois (imagem `src/assets/cutouts/formacoes/formacao - Tecnico em Informatica.png`, 285 × 520 px):

```js
  item('edu-1', 'formacoes', 'Técnico em Informática', '2014', 30, -84, {
    image: 'formacoes/formacao - Tecnico em Informatica.png',
    size: cardSize(520),
    body: 'Curso técnico onde comecei na programação e no design de interfaces (2014). Temas: lógica, redes, banco de dados e web.',
    links: [{ label: 'Certificado', url: './docs/certificado-tecnico.pdf' }],
  }),
```

Para **acrescentar** uma quarta formação, use um id novo (`edu-4`) e um `z` livre (ex.: `-150`).

#### Exemplo completo: nova Experiência de Diversidade

Imagem `src/assets/cutouts/experiencias/diversidade/div-mentoria.png`, 285 × 640 px:

```js
  // Experiências › Diversidade
  item('div-1', 'diversidade', 'Jogo das Diagonais', '2018', -14, -100, { /* …já existe… */ }),
  item('div-2', 'diversidade', 'Ícones Inteligentes', '2018', -14, -128, { /* …já existe… */ }),
  item('div-3', 'diversidade', 'Mentoria de Mulheres na Tecnologia', '2025', -14, -150, {
    image: 'experiencias/diversidade/div-mentoria.png',
    size: cardSize(640),
    body: 'Mentorei mulheres em transição de carreira para tecnologia (2025). Temas: carreira, UX, dados e diversidade.',
    links: [{ label: 'Saiba mais', url: 'https://link-da-iniciativa.org' }],
  }),
```

#### A rua ficou cheia? Aumentando o comprimento

Se não couber mais nenhum recorte entre `-84` e `-152`:

1. Em `ROADS`, troque o `-165` do fim da rua por um número mais negativo, ex.: `-205`.
   Ex.: `[[-46, -78], [-46, -165]]` → `[[-46, -78], [-46, -205]]`.
2. Em `END_SIGNS`, mova a placa de fim dessa rua para 5 a menos que o novo fim (ex.: `z: -200`).
3. Em `BOUNDS`, confira se `minZ` (hoje `-195`) é mais negativo que o novo fim; se não, ajuste (ex.: `-215`).
4. A frase do horizonte e a zona da câmera "horizon" (`p.z < -150` em `ZONES`) também podem ser
   ajustadas para o novo fim (ex.: `p.z < -190`).
5. Mova a linha do horizonte em `src/world/environment.js` (`line.position.set(0, 0.05, -205)` e
   `horizon.position.set(0, 13, -225)`) para depois do novo fim.

#### Problemas comuns ao inserir recortes

| Sintoma | Causa | Solução |
|---|---|---|
| Tela preta, nada carrega | Vírgula, aspas ou `})` faltando | Veja o erro no console (F12): ele indica a linha. Compare com o modelo do passo 5. |
| Aparece um papel colorido com o título no lugar da imagem | Caminho de `image:` diferente do arquivo | Confira pasta, maiúsculas, acentos, espaços e a extensão `.png`. |
| Cartão esticado ou achatado | `cardSize(...)` com altura errada | Use a altura em pixels real da imagem. |
| Inventário mostra um recorte a mais "fantasma" | id repetido | Cada `item(...)` precisa de um id diferente. |
| Recorte sumiu do inventário de quem já jogou | id de um recorte antigo foi alterado | Volte o id original. |
| O recorte fica dentro de uma árvore ou no caminho da onça | `z` perto do caminho das onças | Afaste 5 ou mais dos `z` da regra 3 do passo 4. As árvores se reorganizam sozinhas ao recarregar. |

---

### 5.1 Mudar os textos gerais

**Arquivo:** `src/data/level.js` → procure por `export const TEXTS`.

```js
export const TEXTS = {
  intro: 'texto que aparece em 3D quando o recorte da Marina é atropelado',
  end: 'frase do horizonte, no fim das ruas',
  win: 'texto da janela "Você zerou!"',
  gameOver: 'texto da janela "Game Over!"',
  retry: 'texto da pergunta "Como quer recomeçar?"',
}
```

**Passo a passo:**

1. Troque apenas o que está **entre as aspas simples** `'...'`.
2. Se o seu texto tiver um apóstrofo (ex.: `d'água`), escreva `d\'água` (com barra antes) ou troque as
   aspas externas por crases: `` `d'água` ``.
3. Salve (Ctrl + S) e confira no navegador.

Os textos dos **botões** e dos **títulos** das janelas ficam em `src/ui/screens.js`
(ex.: procure por `Tentar novamente`, `Manter o inventário`, `Resetar tudo`, `Game Over!`).

---

### 5.2 Editar um recorte existente (título, texto, links)

**Arquivo:** `src/data/level.js` → procure por `export const ITEMS`.

Cada recorte é uma linha `item(...)`. A ordem dos valores é sempre:

```js
item('id', 'grupo', 'Título', 'Subtítulo', x, z, { opções extras })
```

| Valor | O que é |
|---|---|
| `'id'` | Nome único, sem espaços nem acentos (ex.: `'dev-1'`). **Nunca repita.** |
| `'grupo'` | Um dos grupos de `GROUPS`: `intro`, `desenvolvimento`, `design`, `diversidade`, `formacoes` |
| `'Título'` | Aparece no recorte provisório, na janela e no inventário |
| `'Subtítulo'` | Aparece só no recorte provisório |
| `x, z` | Posição no mapa (veja a tabela das ruas na receita 5.3) |
| `{ ... }` | Opções extras: `image`, `body`, `links`, `size` |

**Exemplo — trocar texto e links do "Projeto Dev 1":**

Antes:
```js
item('dev-1', 'desenvolvimento', 'Projeto Dev 1', 'Desenvolvimento', -46, -100, { image: 'experiencias/desenvolvimento/dev-1.webp' }),
```

Depois:
```js
item('dev-1', 'desenvolvimento', 'App de Agendamentos', 'React + Node', -46, -100, {
  image: 'experiencias/desenvolvimento/dev-1.webp',
  body: 'Liderei o redesign do app de agendamentos em 2023, reduzindo em 30% o abandono do fluxo.',
  links: [
    { label: 'Saiba mais', url: 'https://www.behance.net/seu-projeto' },
    { label: 'Ver código', url: 'https://github.com/seu-usuario/projeto' },
  ],
}),
```

**Cuidados:**

- Cada link é `{ label: 'Texto do botão', url: 'https://...' }`, separados por vírgula.
- Para um recorte **sem links**, use `links: []`.
- Não esqueça a **vírgula no final** de cada `item(...)`, e as vírgulas entre as opções.
- O texto `body` aparece completo na janela grande e resumido (3 linhas) na janela presa no chão.

---

### 5.3 Adicionar um novo recorte

**Arquivo:** `src/data/level.js` → lista `ITEMS`.

1. Escolha a rua onde ele vai ficar:

   | Rua | `x` | `z` (de… até) |
   |---|---|---|
   | Desenvolvimento | `-46` | `-78` até `-165` |
   | Design | `-30` | `-62` até `-165` |
   | Diversidade | `-14` | `-78` até `-165` |
   | Formações | `30` | `-62` até `-165` |

   O `z` fica **mais negativo** quanto mais longe do início. Deixe pelo menos **20 de distância**
   entre recortes da mesma rua (os atuais estão em -100 e -128, por exemplo).

2. Copie uma linha parecida e cole logo abaixo dela. Exemplo para uma nova formação:
   ```js
   item('edu-4', 'formacoes', 'Pós em Ciência de Dados', 'Dados', 30, -155, {
     image: 'formacoes/edu-4.webp',
     body: 'Especialização concluída em 2025, com foco em engenharia de dados e machine learning.',
     links: [{ label: 'Certificado', url: 'https://link-do-certificado' }],
   }),
   ```
3. Troque o `id` por um nome **que ainda não existe** (`'edu-4'`).
4. Salve e confira:
   - o contador do inventário passa a mostrar `/11` em vez de `/10`;
   - o novo recorte aparece na rua (com um desenho provisório, se a imagem ainda não existir);
   - ao atropelar, ele entra no inventário e deixa a janela presa no chão.

> Não precisa mexer em mais nada: inventário, porcentagem de conhecimento e "Você zerou!"
> se ajustam sozinhos à quantidade de itens.

#### Criando um grupo novo (opcional)

Se quiser uma categoria nova (ex.: "Voluntariado"):

1. Em `GROUPS`, adicione uma linha:
   ```js
   voluntariado: { label: 'Voluntariado', color: PALETTE.violet },
   ```
2. Use `'voluntariado'` como grupo nos novos `item(...)`.
3. (Opcional) Crie a pasta `src/assets/cutouts/voluntariado/` para as imagens.

---

### 5.4 Remover um recorte

1. Em `src/data/level.js`, apague a linha `item(...)` inteira (incluindo a vírgula final).
2. Salve. O total do inventário diminui automaticamente.
3. Se esse recorte já estava no inventário salvo da aba, ele é ignorado sozinho
   (o jogo descarta ids que não existem mais).
4. Se quiser, apague a imagem correspondente em `src/assets/cutouts/`.

---

### 5.5 Colocar as imagens reais dos recortes

1. Prepare a imagem em **PNG ou WebP com fundo transparente**, de no máximo **2048 px** no maior lado.
   O contorno transparente é o que vira os pedaços de papel na explosão.
2. Salve o arquivo na pasta indicada no campo `image` do item. Exemplo: se o item tem
   `image: 'formacoes/edu-1.webp'`, o arquivo deve ser `src/assets/cutouts/formacoes/edu-1.webp`.
3. O nome precisa ser **idêntico**, inclusive maiúsculas/minúsculas e a extensão.
4. Salve e recarregue a página. Enquanto o arquivo não existir, o jogo mostra um recorte provisório.

| Arte | Caminho |
|---|---|
| Bicicleta | não usa imagem: é um modelo 3D (receita 5.28) |
| Primeiro recorte ("Marina Micas Jardim") | não usa imagem: o jogo desenha o cartão com a foto de perfil (`src/assets/images/profile.jpeg`) |
| Placas | `cutouts/signs/experiencias.webp`, `formacoes.webp`, `desenvolvimento.webp`, `design.webp`, `diversidade.webp` |
| Experiências | `cutouts/experiencias/{desenvolvimento,design,diversidade}/*.webp` |
| Formações | `cutouts/formacoes/*.webp` |

**Tamanho do recorte no mapa:** a altura vem de `size: [largura, altura]` (em metros). Exemplo:
`size: [3, 5]` deixa o recorte mais alto. Com imagem real, a largura se ajusta à proporção.

---

### 5.6 Trocar os contatos do topo e o currículo

**Arquivo:** `index.html` → procure por `<nav class="hud-links"`.

1. Troque cada endereço no `href="..."`:
   - `https://www.linkedin.com/in/SEU-PERFIL` → seu LinkedIn;
   - `https://github.com/SEU-USUARIO` → seu GitHub;
   - `mailto:seu-email@exemplo.com` → mantenha o `mailto:` e troque só o e-mail;
   - `https://wa.me/55DDDNUMERO` → `55` + DDD + número, só números (ex.: `https://wa.me/5511999998888`).
2. **Currículo:** coloque o PDF em `public/docs/curriculo-marina-micas.pdf` (nome exato).
3. Os mesmos contatos aparecem automaticamente nas janelas "Você zerou!" e "Contatos"
   (elas copiam o topo da página), então você só precisa alterar em um lugar.

Para trocar um ícone, substitua o arquivo SVG em `src/assets/ui/icons/` mantendo o mesmo nome.

---

### 5.7 Mudar as cores

As cores estão em **dois lugares** e devem ser trocadas nos dois para ficarem iguais:

1. **Mundo 3D:** `src/data/level.js` → `export const PALETTE`.
2. **Janelas, botões e HUD:** `src/styles/main.css` → bloco `:root` no topo do arquivo.

```css
:root {
  --black: #0d0b10;
  --purple: #6b2fd6;   /* cor de destaque */
  --lilac: #c9b6ff;
  --white: #f5f2ea;
}
```

As cores são códigos hexadecimais (`#RRGGBB`). Use um seletor como https://htmlcolorcodes.com para escolher.

---

### 5.8 Ajustar a janela presa no chão

**Arquivo de comportamento:** `src/ui/pins.js`  
**Arquivo de aparência:** `src/styles/main.css` → bloco `Janelas presas no chão`.

| Quero… | Onde mudar |
|---|---|
| Que ela apareça de mais longe / mais perto | `const MAX_DIST = 55` em `pins.js` (em metros). `FADE_DIST` é onde começa a ficar transparente. |
| Mudar o lado da rua onde ela fica | Em `createPin`, a linha `new THREE.Vector3(x + ROAD_WIDTH / 2 + 0.5, 0, z)`. Troque o `+` antes de `ROAD_WIDTH` por `-` para o lado esquerdo. |
| Que ela fique maior quando a bike está perto | `pin.card.style.scale = clamp(16 / dist, 0.55, 1)`: `0.55` é o tamanho mínimo, `1` o máximo. |
| Largura da janela | `.pin-card { width: 250px; ... }` no CSS |
| Quantidade de linhas do texto | `-webkit-line-clamp: 3; line-clamp: 3;` no CSS |
| Cor do botão "Saiba mais" | `.pin-card .btn { background: var(--purple); ... }` no CSS |
| Tempo até ela aparecer depois do atropelo | Em `src/main.js`, função `hitTotem`: `showPin(totem, 1.2)`. O `1.2` é o atraso em segundos. |

O primeiro recorte ("Marina Micas Jardim", apresentação) também deixa uma janela no chão, no mesmo
visual dos outros, com o texto de apresentação e o botão "Ver currículo".

---

### 5.9 Inventário e progresso salvo

**Arquivo:** `src/core/state.js`.

- `state.collected` → lista dos ids dos recortes atropelados.
- `state.links` → lista dos ids cujo "Saiba mais" já foi clicado.
- `state.won` → se a janela "Você zerou!" já apareceu.
- `state.lives` → vidas restantes (0 a 6).

Funções principais:

| Função | O que faz |
|---|---|
| `collect(id)` | Adiciona o recorte ao inventário (só conta uma vez). |
| `markLink(id)` | Marca que o "Saiba mais" foi aberto (janela grande ou janela do chão). |
| `loseLife(n)` / `gainLife(n)` / `resetLives()` | Tira, devolve ou enche as vidas. |
| `resetProgress()` | Apaga tudo e enche as vidas. Chamada pelo menu Rebobinar → ↺ Resetar tudo (depois da confirmação) ou por "Resetar tudo". |

O contador do botão **Inventário** e a barra **"Conhecimento sobre Marina"** são atualizados sozinhos
toda vez que o estado muda (função `updateHUD` em `src/ui/screens.js`).

**Testar do zero:** durante o desenvolvimento, para começar sem progresso, use uma destas opções:

- menu **⟲ Rebobinar → ↺ Resetar tudo → Sim, resetar tudo**; ou
- feche a aba e abra de novo; ou
- no console (F12): `sessionStorage.clear()` e depois F5.

**Apagar o progresso de todos os visitantes após uma mudança grande:** troque a versão da chave em
`state.js`:

```js
const STORAGE_KEY = 'mmj-portfolio:v2'  // mude para 'mmj-portfolio:v3'
```

---

### 5.10 Resetar, Game Over, Fim das vidas e "Tentar novamente"

**Arquivo:** `src/ui/screens.js`. O botão **↺ Resetar tudo** fica **dentro do menu ⟲ Rebobinar**
(`index.html`, bloco `.rewind-menu`).

O caminho completo é:

```
Menu "⟲ Rebobinar" → "↺ Resetar tudo"
   └── showResetConfirm()  → "Resetar o jogo?" [Sim, resetar tudo] [Cancelar]
         └── Sim → rewind('start', { fresh: true })  (apaga o inventário, enche as vidas e remonta os recortes)

Vidas chegaram a zero (árvore/onça)
   └── showLivesOver() → "Fim das vidas!" [Tentar novamente] [Ver currículo] [Ir aos contatos]
         └── fechar sem escolher → volta ao início mantendo o inventário, vidas cheias

Fechar/recarregar a aba (evento "beforeunload")
   ├── inventário completo → sai sem aviso
   └── faltam recortes     → aviso nativo do navegador
         ├── "Sair"  → a página fecha
         └── "Ficar" → showGameOver() → [Continuar jogando] [Tentar novamente] [Ir aos contatos]

[Tentar novamente] ou [Jogar de novo]
   └── showRetryChoice()
         ├── inventário vazio → volta direto ao início
         └── senão pergunta:
               [Manter o inventário] → restartKeep()                      (mantém tudo, enche as vidas)
               [Resetar tudo]        → rewind('start', { fresh: true })  (apaga tudo)
```

**Como os botões funcionam:** cada botão tem um atributo `data-action="nome"`. No fim do arquivo há um
`switch` que decide o que fazer com cada nome:

```js
switch (el.dataset.action) {
  case 'retry':          showRetryChoice(); break
  case 'restart-keep':   restartKeep(); break
  case 'restart-reset':
  case 'confirm-reset':  rewind('start', { fresh: true }); break
  case 'close':          ui.close(); break
  ...
}
```

**Para criar um botão novo em uma janela:**

1. No HTML da janela, adicione: `<button class="btn" data-action="meu-botao">Meu botão</button>`.
2. No `switch`, adicione:
   ```js
   case 'meu-botao':
     // o que deve acontecer
     break
   ```

**Textos:** confirmação em `TEXTS.resetConfirm`, Game Over em `TEXTS.gameOver` e Fim das vidas em
`TEXTS.livesOver` (`src/data/level.js`).

**Desligar o aviso ao fechar a aba:** em `src/main.js`, apague a linha `enableExitGuard(() => playing)`.

---

### 5.11 Rebobinar

**Arquivo:** `src/core/timeMachine.js`.

- A trajetória da bike é gravada a cada 0,1 s. Rebobinar percorre essa gravação de trás para frente.
- **Para a bifurcação** e **para o início**: a bike volta, os objetos soltos do cenário voltam ao lugar,
  mas **os recortes já conquistados continuam destruídos** e as janelas continuam no chão.
- Só com `{ fresh: true }` (Resetar tudo) a função `resetWorld` remonta os recortes.
- Os pontos de chegada ficam em `src/data/level.js` → `CHECKPOINTS`:
  ```js
  start: { x: 0, z: 0, heading: 0 },    // início
  fork:  { x: 0, z: -30, heading: 0 },  // antes da bifurcação
  ```
- As mensagens que aparecem ao terminar ficam na variável `doneMessage` da função `rewind`.
- **Visual "Matrix"**: enquanto rebobina, a cena fica verde, cai uma chuva de caracteres verdes
  (`src/ui/matrix.js`), a bike solta um rastro verde de "dados" e o letreiro "◀◀ REBOBINANDO" pisca.
  - Velocidade: em `rewind()`, `clamp(total / 45, 0.9, 2.6)` → 45 m/s, entre 0,9 s e 2,6 s.
    Aumente o 45 para rebobinar ainda mais rápido.
  - Caracteres, tamanho e velocidade da chuva: `GLYPHS`, `FONT_PX` e `SPEED` em `matrix.js`.
  - Cor da cena: regra `body.is-rewinding .webgl` no `main.css` (`hue-rotate(70deg)` = verde).

---

### 5.12 Ruas, placas, câmera e limites do mapa

Tudo em `src/data/level.js`:

| Constante | O que controla |
|---|---|
| `ROADS` | Cada rua é um segmento `[[x1, z1], [x2, z2]]`. |
| `ROAD_WIDTH` | Largura das ruas (em metros). |
| `SIGNS` | Placas: texto, posição, imagem e `pull` (ponto para onde a placa "puxa" a bike). |
| `CHECKPOINTS` | Pontos de chegada do rebobinar. |
| `BOUNDS` | Limites do mapa (a bike não passa daqui). |
| `DEFAULT_VIEW` | Posição padrão da câmera em relação à bike. |
| `ZONES` | Áreas onde a câmera muda de enquadramento e mostra um aviso (bifurcação, encruzilhada, horizonte). |

> Se mover uma rua, lembre de mover também os recortes (`x`, `z`) e as placas dessa rua.

---

### 5.13 Velocidade da bike e força para atropelar

- **Velocidade, curva e precisão:** `src/data/level.js` → `export const BIKE`. Teclado e botões na tela
  usam **exatamente** estes números:
  ```js
  maxSpeed: 10,       // m/s normal (▲ / W)
  boostSpeed: 16,     // m/s com turbo (⚡ / Shift)
  reverseFactor: 0.4, // ré = 40% da velocidade
  accel: 6,           // arrancada (maior = mais rápida)
  brake: 9,           // frenagem ao soltar (maior = para mais rápido)
  turnRate: 2.4,      // curva em rad/s (maior = vira mais rápido)
  pivotFactor: 0.45,  // parada, gira no lugar a 45% da curva (ajuste fino)
  turnSmoothing: 14,  // suavidade da curva (maior = resposta mais seca)
  drag: { speedPerMeter: 2.2, maxSpeed: 12, deadZone: 0.6, turnRate: 9 }, // arrastar com o dedo/mouse
  ```
- **Velocidade mínima para atropelar:** `src/world/totems.js`:
  ```js
  const HIT_SPEED = 2
  ```
  Aumente para exigir mais embalo; diminua para atropelar mesmo devagar.

---

### 5.14 Gestos, zoom e sensibilidade dos controles

**Arquivo das sensibilidades:** `src/core/input.js` → objeto `SETTINGS` no topo do arquivo.

```js
export const SETTINGS = {
  zoom: { wheel: 0.0014, trackpadPinch: 0.012, key: 0.16 },
  drag: { bikeHitRadius: 48 },
  tap: { maxMove: 10, maxTime: 260, doubleGap: 320 },
  longPressMs: 900,
}
```

| Quero… | O que mudar |
|---|---|
| Facilitar "pegar" a bike com o dedo (botões ocultos) | Aumente `drag.bikeHitRadius` (em pixels, ex.: `60`). |
| Zoom da roda do mouse mais rápido | Aumente `zoom.wheel` (ex.: `0.002`). |
| Zoom da pinça do trackpad mais suave | Diminua `zoom.trackpadPinch` (ex.: `0.008`). |
| Cada toque em + / − dar mais zoom | Aumente `zoom.key`. |
| Toque duplo mais fácil de acertar | Aumente `tap.doubleGap` (em milissegundos). |

**A câmera segue a bike o tempo todo.** Quão "colada" ela fica: `rig.lag` em `src/main.js`
(`8` jogando, `14` no rebobinar; maior = cola mais). O ângulo de visão fica em `DEFAULT_VIEW` (`level.js`).

**Limites e suavidade do zoom:** `src/core/CameraRig.js`, no `constructor`:

```js
this.zoomLimits = { min: 0.45, max: 1.9 }  // min = mais perto da bike; max = mais longe
this.zoomSmoothing = 14                    // maior = segue o gesto mais rápido; menor = mais "macio"
```

**Efeito cinematográfico do atropelo:** `src/main.js` → função `cinematicHit()`.
`timeScale: 0.12` é o quanto o tempo desacelera (0.12 = 12% da velocidade normal) e `'+=0.35'` quanto tempo
ele fica lento. A aproximação da câmera fica em `cinematicPunch()`, no `src/core/CameraRig.js`
(`strength = 0.72` = a câmera chega a 72% da distância normal).

**Como funciona por dentro (para curiosos):** os eventos de toque, mouse e roda só *anotam* o movimento.
Uma vez por quadro (60 vezes por segundo), o loop do jogo em `src/main.js` pega o total com
`consumeZoom()` e entrega à câmera. Por isso o zoom fica liso mesmo com muitos eventos por segundo.

---

### 5.15 Guia de navegação e gestos inválidos

**Textos do guia:** `src/ui/guide.js`.

- `GUIDES.touch` → instruções para celular/tablet.
- `GUIDES.desktop` → instruções para mouse, teclado e trackpad.
- Cada linha é `['ícone', 'Ação', 'Explicação']`. Para acrescentar uma, copie uma linha e mude os textos.
- `REASONS` → a frase em destaque que explica qual gesto não funcionou.
- `COOLDOWN_MS = 30000` → tempo mínimo (em ms) entre dois guias automáticos.

**Quando o guia aparece:** `src/core/invalidGestures.js` → objeto `RULES`.

```js
tap:   { threshold: 3, windowMs: 3000 },  // 3 toques soltos em até 3 segundos
click: { threshold: 3, windowMs: 3000 },  // 3 cliques soltos em até 3 segundos
'unsupported-key': { threshold: 4, windowMs: 3000 },
```

- `threshold` = quantas vezes o gesto precisa se repetir.
- `windowMs` = em quanto tempo (milissegundos).
- Para o guia aparecer **menos**, aumente `threshold`. Para desligar um tipo de gesto, apague a linha dele.

**"Não mostrar esta dica novamente":** grava `mmj-portfolio:hide-gesture-guide` no `localStorage`.
Para ver o guia automático de novo durante os testes, use uma das opções:

- botão **? Ajuda** → **Voltar a mostrar dicas automáticas**; ou
- no console (F12): `localStorage.removeItem('mmj-portfolio:hide-gesture-guide')`.

**Testar a versão de celular no computador:** no Chrome, aperte F12 → clique no ícone de celular/tablet
(**Toggle device toolbar**, ou Ctrl + Shift + M) → recarregue a página. Segure **Shift** e arraste para
simular a pinça com dois dedos.

---

### 5.16 Links externos no visualizador em tela cheia

**Arquivo:** `src/ui/viewer.js`.

Links para outro site, PDF, e-mail ou telefone (por exemplo, os "Saiba mais" dos recortes) são interceptados e
abertos por cima do jogo, em tela cheia. O jogo fica pausado e, ao fechar (botão **✕ Voltar ao jogo**, tecla **Esc**
ou botão **voltar** do celular), tudo continua exatamente de onde parou.

**Exceção: os contatos do topo** (LinkedIn, GitHub, e-mail, WhatsApp e currículo) têm `data-viewer-skip` e abrem
**direto** no destino, em nova aba; o e-mail abre o app de e-mail. Como as janelas "Zerou", "Contatos" e "Sobre"
copiam o topo da página, elas seguem a mesma regra. Para um contato voltar ao visualizador, apague
`data-viewer-skip` e `target="_blank"` dele no `index.html`.

| Tipo de link | O que aparece |
|---|---|
| Site comum (ex.: portfólio no Behance, artigo) | O site dentro de um quadro (iframe) |
| YouTube / Vimeo | O player de vídeo (o endereço é convertido para a versão "embed") |
| PDF | No computador, o PDF no leitor do navegador. No celular, um cartão com "Abrir PDF" (leitor do aparelho, nova aba) e "Baixar": celulares não mostram PDF dentro da página e o visualizador do Google recusa arquivos grandes |
| E-mail / telefone | Cartão com o endereço, "Copiar" e "Abrir app de e-mail" / "Ligar" |
| LinkedIn, GitHub, WhatsApp, Instagram… | Cartão com o link e "Copiar" (esses sites proíbem ser exibidos dentro de outras páginas) |

**Um site novo aparece em branco?** Ele provavelmente proíbe exibição em iframe. Adicione o domínio na lista
`NO_IFRAME_HOSTS` no topo de `viewer.js` (ex.: `'behance.net'`). A partir daí, ele mostra o cartão com
"Copiar link" em vez do quadro vazio.

**Quero que um link específico funcione normalmente (sem visualizador):** adicione o atributo
`data-viewer-skip` no `<a>`.

---

### 5.17 Contador de visitantes

**Arquivos:** `src/core/visitors.js` (comunicação com a API) e `VISITORS` em `src/data/level.js` (configuração).

Aparece embaixo da barra de conhecimento e na tela inicial:
`Visitantes: X únicos · Y visualizações (desde DD/MM/AAAA)`.

- **Únicos:** soma 1 só na primeira visita de cada aparelho/navegador (marca salva no `localStorage`).
  Limpar os dados do navegador ou usar outro navegador conta como um visitante novo.
- **Visualizações:** soma 1 toda vez que o site é aberto ou recarregado, mesmo no mesmo aparelho.
- **Em desenvolvimento** (`npm run dev`) os números só são lidos, nunca somados.
- O serviço usado é o **Abacus** (https://abacus.jasoncameron.dev): gratuito, sem cadastro.

**Mudar a data de início:** em `level.js`, troque `since: '2026-10-22'` (formato AAAA-MM-DD).

**Zerar a contagem** (feito em 22/10/2026): troque o `namespace` por um nome novo, de preferência com a
data (ex.: `'marinamicas-portfolio-2027-01-01'`), e ajuste `since`. Os números começam do zero e todos os
aparelhos voltam a contar como visitantes únicos (a marca do aparelho inclui o namespace).
Em `npm run dev`, um namespace novo mostra "0" e o console registra um erro 404: é normal, o serviço só
cria o contador na primeira visita ao site publicado.

**Se o serviço sair do ar:** o texto vira "Visitantes: indisponível no momento" e o jogo continua normal.
Para trocar de serviço, só a função `call()` em `visitors.js` precisa mudar.

---

### 5.18 Foto de perfil: miniatura, céu e janela "Sobre"

**Arquivos:** `src/assets/images/profile.jpeg` (a foto), `PROFILE` em `src/data/level.js` (configuração),
`src/ui/profile.js` (comportamento) e os blocos "Foto de perfil" em `src/styles/main.css` (aparência).

A mesma foto aparece em três lugares:

1. **Miniatura** no canto superior esquerdo (clicar abre a janela "Sobre a Marina").
2. **Céu:** bem transparente, atrás do cenário, com os **olhos sempre visíveis** na tela.
3. **Janela "Sobre a Marina":** foto maior, apresentação, easter egg da bike e contatos.

**Passo a passo para colocar a foto:**

1. Salve a foto como `src/assets/images/profile.jpeg` (ou `.jpg`/`.png`/`.webp`; nesse caso troque o nome em
   `PROFILE.image`). Prefira o rosto bem visível e até 1600 px no maior lado.
2. Abra `http://localhost:5173/?olhos`. Uma **mira vermelha** marca o ponto onde os olhos devem ficar.
3. Em `level.js`, ajuste `eyes` até a mira ficar sobre os olhos:
   ```js
   eyes: { x: 0.5, y: 0.36 }, // 0 = esquerda/topo da FOTO, 1 = direita/base
   ```
   Salve e veja a página atualizar. Aumente `y` se a mira ficou acima dos olhos; diminua se ficou abaixo.
4. Redimensione a janela e teste no modo celular (F12 → Ctrl + Shift + M): a mira continua sobre os olhos.
5. Tire o `?olhos` do endereço quando terminar.

| Quero… | O que mudar em `PROFILE` |
|---|---|
| Olhos em outro ponto da tela | `anchor: { x: 0.5, y: 0.3 }` (0.3 = a 30% da altura da janela) |
| Foto mais ou menos visível no céu | `sky.opacity` (0.15 sutil … 0.4 forte) |
| Foto sumindo mais cedo/tarde na parte de baixo | `sky.fadeFrom` (onde começa a sumir) e `sky.fadeTo` (onde já sumiu), frações da altura |
| Foto "normal" em vez de só clarear o escuro | `sky.blend: 'normal'` (padrão `'screen'`) |
| Texto alternativo e nome | `alt` e `name` |

Enquanto a foto não existir, o jogo mostra um **retrato provisório** com olhos desenhados exatamente em `eyes`, e
a janela "Sobre" avisa "Retrato provisório".

---

### 5.19 Partículas da bike

**Arquivo de configuração:** `PARTICLES` em `src/data/level.js`. **Lógica:** `src/world/particles.js`.

Enquanto a bike se move (arrastada ou no teclado), ela solta um rastro de "faíscas de papel" que encolhem e somem.

| Quero… | O que mudar |
|---|---|
| Desligar o efeito | `enabled: false` |
| Rastro mais denso / mais leve | `perMeter` (partículas por metro percorrido) |
| Partículas durarem mais | `life: [0.5, 1.2]` (segundos, mínimo e máximo) |
| Partículas maiores | `size: [0.22, 0.55]` (metros) |
| Outras cores | `colors: [PALETTE.lilac, …]` |
| Papel opaco em vez de brilho | `additive: false` |
| Só soltar quando a bike está rápida | aumente `minSpeed` (m/s) |
| Mudar o desenho (triângulo) | função `makeSparkTexture()` em `particles.js` |

Quem ativou "reduzir movimento" no sistema recebe menos partículas automaticamente.

---

### 5.20 SEO, favicon e prévia ao compartilhar

Tudo fica no `<head>` do `index.html`, em blocos comentados. Veja o passo a passo completo no
[README, seção 4.1 (favicon) e 4.5 (SEO)](../README.md#41-como-alterar-o-favicon).

Resumo:

- **Título/descrição** que o Google mostra: `<title>` e `<meta name="description">`.
- **Prévia no WhatsApp/LinkedIn:** tags `og:*` e `twitter:*` + a imagem `public/og-image.jpg` (1200×630).
  Troque a imagem mantendo o nome. Teste em https://www.opengraph.xyz.
- **Favicon:** troque `public/favicon.svg` e `public/apple-touch-icon.png` mantendo os nomes.
- **Endereço do site mudou?** Procure `https://marinamicas.github.io/marina-portfolio/` em `index.html`,
  `public/robots.txt` e `public/sitemap.xml` e troque em todos.

---

### 5.21 Easter egg da bicicleta

A frase "A escolha da bicicleta não foi por acaso: é o meu veículo predileto e amo andar de bike!" fica em
`TEXTS.bike` (`src/data/level.js`) e aparece:

- na janela **"Sobre a Marina"** (miniatura da foto e primeiro recorte), em destaque lilás;
- como **aviso** uma vez por visita, depois de 4 segundos pedalando. Para mudar o tempo ou
  desligar, veja `maybeTellBikeStory()` em `src/main.js` (`movingFor < 4`).

---

### 5.22 Vidas (árvores, onças e recortes)

**Configuração:** `LIVES` em `src/data/level.js`. **Regras:** função `hurt()` e `checkHazards()` em `src/main.js`.

```js
export const LIVES = {
  start: 6,                 // vidas ao começar (e o máximo)
  treeDamage: 1,            // perde ao bater numa árvore
  jaguarDamage: 1,          // perde ao encostar numa onça
  cutoutHeal: 1,            // ganha ao explodir um recorte (nunca passa de start)
  invulnerableSeconds: 1.6, // depois de perder vida, a bike pisca e fica imune por este tempo
}
```

- Os corações do cabeçalho são desenhados sozinhos a partir de `start` (`renderLives()` em `screens.js`).
- As vidas ficam salvas na aba (como o inventário). Recarregar a página com 0 vidas recomeça com 6.
- Texto da janela "Fim das vidas!": `TEXTS.livesOver`.
- Segurar ▲ contra uma árvore faz a bike bater de novo a cada `invulnerableSeconds` (perde outra vida).

---

### 5.23 Floresta, bichos e neve

| Quero… | Onde |
|---|---|
| Mais/menos árvores ou flores | `FOREST.trees` / `FOREST.flowers` (`level.js`). Menos = mais leve no celular. |
| Árvores mais longe/perto da rua | `FOREST.roadClearance` (metros do centro da rua; a rua tem 7 de largura). |
| Cores das copas | `FOREST.canopyColors` (verdes + roxos da marca). |
| Altura das árvores | `FOREST.treeHeight: [mín, máx]`. |
| Quantidade de borboletas, pássaros, coelhos | `CRITTERS.butterflies`, `birds`, `rabbits`. |
| Mudar/adicionar onças | `CRITTERS.jaguars`: cada uma anda de `from: [x, z]` até `to: [x, z]` e volta, a `speed` m/s. Copie uma linha para criar outra. |
| Raio de batida | `FOREST.hitRadius` (árvores) e `CRITTERS.jaguarHitRadius` (onças). |
| Neve mais/menos visível | `SNOW.opacity` (0 a 1), `SNOW.count`, `SNOW.size`, `SNOW.fallSpeed`. |
| Formato das peças | `src/world/forest.js` (árvores/flores), `critters.js` (bichos), `snow.js` (flocos). |

As árvores são sorteadas a cada carregamento, mas **nunca** nascem: na rua, no ponto de partida, perto de
placas, recortes, janelas do chão, prismas e no caminho das onças.

---

### 5.24 Botões de direção na tela, teclado e arrastar a bike

**Arquivos:** `src/ui/controls.js` (botões), `src/core/input.js` (teclado + botões), `index.html`
(bloco `.touch-controls`), `main.css` (bloco "Botões de direção").

- **Os botões e o teclado são o mesmo comando**: cada botão "aperta" uma tecla virtual. Por isso a
  precisão é idêntica. Para calibrar, mexa em `BIKE` no `level.js` (receita 5.13).
- **Dois botões ao mesmo tempo**: cada botão acompanha o seu próprio dedo (dá para virar e acelerar juntos).
- **Botão 🎮 "Botões"** no topo: mostra/oculta os botões. A escolha fica salva no navegador.
  - Botões visíveis → tocar/arrastar a bike não a move.
  - Botões ocultos → tocar/clicar na bike e arrastar faz ela pedalar até o ponto apontado.
- **Começar com os botões ocultos**: em `controls.js`, `const DEFAULT_VISIBLE = false`.
- **Tamanho dos botões**: `--pad-size: 64px` no `:root` do `main.css` (58 px no celular).
- **Teclado** (sempre ativo): W/↑ frente, S/↓ ré, A/← esquerda, D/→ direita, Shift turbo, + − 0 zoom.

---

### 5.25 Abertura (triângulo neon) e janela inicial de instruções

- **Abertura:** `src/world/intro.js`; ajustes em `INTRO` no `level.js` (tamanho do triângulo,
  tempo de desenho, tempo da bike subindo, cores do neon).
- **Janela inicial:** `src/ui/onboarding.js`. As instruções vêm de `buildInstructions()` em
  `src/ui/guide.js`, que monta o texto conforme o aparelho (celular x computador) e o modo
  (botões x arrastar). O mesmo texto aparece no botão **? Ajuda**.
- **Botão do currículo**: `CV_URL` em `onboarding.js` (padrão `./docs/curriculo-marina-micas.pdf`).

---

### 5.26 Música de fundo e créditos

- **Arquivo:** `public/som.mp3`. Para trocar a música, substitua o arquivo mantendo o nome
  (ou mude `AUDIO.file` no `level.js`).
- **Por que `.mp3` e não `.mpeg`:** o arquivo original era um MP3 com a extensão `.mpeg`. O GitHub Pages
  entrega `.mpeg` como vídeo e o Firefox não toca; com `.mp3` funciona em todos os navegadores.
- **Volume e crédito:** `AUDIO.volume` (0 a 1) e `AUDIO.credit` ("Daniel Micas Jardim da Silva").
- **Autoplay:** os navegadores só deixam tocar som depois do primeiro toque/clique do visitante.
  O jogo tenta tocar sozinho e, se o navegador bloquear, começa no primeiro gesto (ex.: "Começar a pedalar").
- O botão 🔊/🔇 no topo liga/desliga; a escolha fica salva. A música pausa quando a aba fica escondida.

---

### 5.27 Placas de fim de rota

**Arquivo:** `END_SIGNS` em `src/data/level.js`.

```js
{ route: 'Design', x: -30, z: -160, text: 'Toda forma bonita nasceu de alguém que parou para escutar…' },
```

- `route` aparece na faixa "FIM DA ROTA · DESIGN"; `text` é a frase poética.
- `x` é a rua; `z: -160` é logo antes do fim (as ruas terminam em -165).
- A placa tem colisão: a bike para nela. O desenho fica em `makeEndSignTexture()` (`src/utils/textures.js`).

---

### 5.28 Bike 3D (cores e formato)

**Arquivo:** `src/world/bike.js`.

- **Cores:** objeto `COLORS` no topo (quadro, pneus, raios, camiseta, cabelo, capacete…).
- **Tamanho das rodas:** `WHEEL_R`. **Peças:** função `buildModel()`.
- **Seta neon no chão** (mostra a direção): `buildDirectionMarker()`; cor `PALETTE.lilac`.
- O farol branco (frente) e a lanterna vermelha (trás) também deixam claro para onde a bike aponta.
- A imagem antiga `src/assets/cutouts/avatar/bike.png` não é mais usada (a bike agora é 3D).

---

## 6. Testando antes de publicar

Rode o projeto (`npm run dev`) e confira esta lista:

- [ ] Ao carregar: o triângulo neon é desenhado e a bike sai da terra; depois abre a janela "Como jogar".
- [ ] A janela "Como jogar" mostra instruções do aparelho certo e o botão "Ver o currículo agora" abre o PDF.
- [ ] Atropelar o primeiro recorte ("Marina Micas Jardim") abre a janela "Sobre"; ao fechar, ela fica presa no chão.
- [ ] Atropelar cada recorte: abre a janela, o contador do inventário aumenta 1, devolve 1 vida e depois aparece a janela no chão.
- [ ] Bater numa árvore ou encostar numa onça tira 1 vida (clarão vermelho); com 0 vidas aparece "Fim das vidas!".
- [ ] Botões ◀ ▶ ▲ ▼ ⚡ funcionam, inclusive dois ao mesmo tempo; as teclas W A S D acendem os botões equivalentes.
- [ ] Com os botões visíveis, arrastar a bike não a move; ocultando no 🎮, arrastar passa a funcionar.
- [ ] A câmera acompanha a bike o tempo todo.
- [ ] No fim de cada rua há uma placa "Fim da rota" com a frase.
- [ ] O botão de som liga/desliga a música e mostra "Daniel Micas Jardim da Silva".
- [ ] Rebobinar: cena verde, chuva de caracteres e volta rápida.
- [ ] O "Saiba mais" (janela e janela do chão) abre no visualizador em tela cheia, sem nova aba, e o inventário mostra "🔗 saiba mais visitado".
- [ ] Os contatos do topo (LinkedIn, GitHub, WhatsApp, currículo) abrem direto em nova aba e o e-mail abre o app de e-mail, sem aviso de saída.
- [ ] Rebobinar para a bifurcação e para o início: os recortes conquistados **continuam destruídos**.
- [ ] Apertar F5: os recortes conquistados continuam destruídos e o contador continua igual.
- [ ] Com recortes faltando, recarregar a página (F5) → aviso do navegador → "Cancelar/Ficar" → Game Over.
- [ ] Menu ⟲ Rebobinar → ↺ Resetar tudo → confirmação → "Sim, resetar tudo" → inventário volta a 0.
- [ ] "Manter o inventário" → volta ao início com tudo conquistado.
- [ ] "Resetar tudo" → contador volta a `0/…` e todos os recortes ficam de pé.
- [ ] Coletar tudo e recarregar a página → nenhum aviso aparece.
- [ ] O contador "Visitantes: … (desde 22/10/2026)" aparece no cabeçalho.
- [ ] Roda do mouse / pinça do trackpad aproxima e afasta a câmera sem dar zoom na página; duplo clique volta ao normal.
- [ ] Atropelar um recorte: câmera lenta, aproximação e tremida, e depois tudo volta ao normal.
- [ ] No modo celular do F12: cabeçalho em duas linhas, botões nas bordas, pinça dá zoom, toque duplo volta ao normal.
- [ ] Clicar 3 vezes seguidas no mapa abre o guia; "Não mostrar esta dica novamente" faz ele parar de aparecer.
- [ ] A miniatura da foto aparece no canto superior esquerdo e abre a janela "Sobre a Marina" com a frase da bike.
- [ ] A foto no céu está sutil e, com `?olhos` no endereço, a mira fica sobre os olhos em qualquer tamanho de tela.
- [ ] Arrastar a bike solta um rastro de partículas que encolhem e somem.
- [ ] O console (F12) não mostra erros em vermelho.

Depois, gere a versão final e teste:

```bash
npm run build     # cria a pasta dist/
npm run preview   # abre a versão final em http://localhost:4173
```

Se o `npm run build` mostrar erro, leia a mensagem: ela indica o arquivo e a linha do problema.

---

## 7. Publicando no GitHub Pages

O site é publicado automaticamente toda vez que você envia alterações para a branch `main`.

**Primeira vez:**

1. Crie um repositório vazio no GitHub.
2. No terminal, dentro da pasta do projeto:
   ```bash
   git add .
   git commit -m "Portfólio gamificado"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/NOME-DO-REPO.git
   git push -u origin main
   ```
3. No GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Aguarde alguns minutos. O endereço fica `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

**Nas próximas alterações:**

```bash
git status                       # mostra os arquivos alterados
git add .                        # prepara todos para salvar
git commit -m "Atualiza textos das formações"   # descreva o que mudou
git push                         # envia e publica
```

Acompanhe a publicação na aba **Actions** do repositório. Um ✅ verde significa que deu certo;
um ❌ vermelho mostra o erro ao clicar nele.

**Voltar atrás se algo der errado:** no VS Code, a aba **Controle do Código-Fonte** (ícone de ramificação
na lateral) mostra cada arquivo alterado; clique com o botão direito → **Descartar Alterações** para voltar
à última versão salva no Git.

---

## 8. Problemas comuns e soluções

| Problema | Causa provável | Solução |
|---|---|---|
| Tela preta / nada aparece | Erro de digitação no código | Abra o console (F12) e leia a mensagem em vermelho: ela mostra arquivo e linha. Normalmente é vírgula, aspas ou chave faltando. |
| `Unexpected token` no console | Vírgula, aspas ou `}` faltando | Confira a linha indicada e a linha anterior a ela. |
| A imagem do recorte não aparece | Nome ou pasta diferente do `image` | Confira letra por letra, inclusive a extensão (`.webp` x `.png`). |
| O contador mostra mais itens do que deveria | `id` repetido em `ITEMS` | Cada `item(...)` precisa de um `id` diferente. |
| Já atropelei tudo, mas não aparece "Você zerou!" | Algum recorte está fora da rua ou inalcançável | Abra o inventário e veja qual está com "???". Confira o `x`/`z` dele. |
| Quero testar do zero, mas o progresso continua | O progresso fica salvo na aba | Botão ↺ Resetar, ou `sessionStorage.clear()` no console. |
| `npm` não é reconhecido | Node.js não instalado ou terminal aberto antes da instalação | Instale o Node e feche/abra o VS Code. |
| `npm run dev` diz que a porta está em uso | Outro servidor já está rodando | Feche o outro terminal (Ctrl + C) ou use o novo endereço que o Vite mostrar. |
| O site publicado está desatualizado | O deploy ainda está rodando ou falhou | Veja a aba **Actions** no GitHub. Atualize a página com Ctrl + F5. |

---

## 9. Glossário

| Termo | Significado |
|---|---|
| **Recorte / totem** | Cada imagem colecionável espalhada pelas ruas. |
| **Inventário** | Lista dos recortes já atropelados. |
| **HUD** | Elementos fixos na tela: contatos no topo, barra de progresso, botões embaixo. |
| **Modal / janela flutuante** | A janela branca que aparece no meio da tela. |
| **Janela presa no chão (pin)** | Versão pequena da janela que fica no lugar do recorte destruído. |
| **Toast** | Aviso roxo rápido que aparece embaixo e some sozinho. |
| **sessionStorage** | Memória do navegador que dura enquanto a aba estiver aberta. |
| **id** | Nome único de cada recorte, usado pelo inventário. |
| **x / z** | Coordenadas no chão: `x` é esquerda/direita, `z` é frente/trás (negativo = mais longe do início). |
| **Partículas** | Faíscas de papel que a bike solta ao se mover (configuração em `PARTICLES`). |
| **Âncora dos olhos** | Ponto da tela onde os olhos da foto de perfil ficam sempre (`PROFILE.anchor`). |
| **SEO** | Ajustes para o site aparecer bem no Google e nas prévias de compartilhamento. |
| **Favicon** | Ícone da aba do navegador (`public/favicon.svg`). |
| **Build** | Versão final otimizada do site, gerada na pasta `dist/`. |
| **Deploy** | Publicar o site na internet. |
| **Commit** | Um "ponto de salvamento" no histórico do Git. |
