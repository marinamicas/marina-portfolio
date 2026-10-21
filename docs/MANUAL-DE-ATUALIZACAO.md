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
├── index.html              ← estrutura da página: topo com contatos, botões, tela inicial
├── public/                 ← arquivos copiados sem alteração (currículo, favicon, imagem de prévia)
│   └── docs/               ← coloque aqui o currículo em PDF
├── docs/                   ← este manual
└── src/
    ├── main.js             ← "maestro": junta tudo, roda o loop do jogo e trata os atropelos
    ├── data/level.js       ← ★ CONTEÚDO: textos, recortes, links, ruas, placas, câmera
    ├── styles/main.css     ← aparência das janelas, botões, HUD (cores, tamanhos, fontes)
    ├── assets/
    │   ├── cutouts/        ← ★ IMAGENS dos recortes (bike, Marina, placas, experiências…)
    │   └── ui/icons/       ← ícones do topo (LinkedIn, GitHub, e-mail…)
    ├── core/
    │   ├── state.js        ← inventário/progresso salvo na aba do navegador
    │   ├── timeMachine.js  ← rebobinar, viagens pelo inventário, reset do mundo
    │   ├── CameraRig.js    ← câmera que segue a bike
    │   ├── input.js        ← teclado, roda do mouse (zoom) e as sensibilidades (SETTINGS)
    │   ├── pointerControls.js ← arrastar a bike, arrastar o cenário (pan) e pinça (mouse e dedo)
    │   ├── device.js       ← descobre se o visitante usa dedo (celular) ou mouse (PC)
    │   ├── invalidGestures.js ← percebe gestos que o site não suporta
    │   ├── physics.js      ← física (gravidade, colisões)
    │   └── stage.js        ← cena 3D, luzes, câmera
    ├── world/
    │   ├── totems.js       ← os recortes colecionáveis e a explosão em papel
    │   ├── bike.js         ← a bicicleta (velocidade, curvas, placas magnéticas)
    │   └── environment.js  ← chão, ruas, enfeites, placas, horizonte
    ├── ui/
    │   ├── screens.js      ← janelas: item, inventário, zerou, game over, resetar, contador de visitantes
    │   ├── viewer.js       ← visualizador em tela cheia para links externos e "Saiba mais"
    │   ├── pins.js         ← janelas presas no chão depois que o recorte é destruído
    │   ├── guide.js        ← guia de navegação (celular x PC) e "não mostrar novamente"
    │   ├── modal.js        ← a janela flutuante (abrir/fechar)
    │   └── effects.js      ← avisos (toast) e papeizinhos voando na tela
    └── utils/              ← funções auxiliares e texturas
```

**Na maioria das vezes você só vai mexer em 3 lugares:**

1. `src/data/level.js` → conteúdo (textos, recortes, links).
2. `src/assets/cutouts/` → imagens.
3. `index.html` → contatos do topo.

---

## 4. Como o jogo funciona (regras)

Entender as regras ajuda a saber onde mexer:

1. **Atropelar um recorte**: a bike precisa estar em movimento. O recorte explode em pedaços de papel,
   entra no **inventário** e abre uma janela com o texto e o botão **"Saiba mais"**.
2. **Janela presa no chão**: depois da explosão, uma versão pequena da janela fica fixa no chão, ao lado
   de onde o recorte estava. O link "Saiba mais" dela pode ser clicado a qualquer momento.
3. **Estado final mantido**: o que já foi capturado **continua destruído** (com a janela no chão) mesmo
   quando você:
   - rebobina para a bifurcação;
   - rebobina para o início;
   - escolhe "Manter o inventário" ao tentar novamente;
   - recarrega a página (F5) na mesma aba.
4. **Reset completo pelo botão ↺ Resetar** (pede confirmação) ou por Game Over → Tentar novamente → **Resetar tudo**. Só aí o inventário
   é apagado e os recortes voltam a ficar de pé.
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
   | Mover a bike | clicar na bike e arrastar | tocar na bike e arrastar |
   | Olhar outro ponto do mapa (pan) | clicar no cenário e arrastar | tocar no cenário e arrastar |
   | Ir longe com a bike | arrastar a bike até a borda da tela | arrastar a bike até a borda da tela |
   | Pedalar (alternativa) | W A S D / setas, Shift acelera | — |
   | Zoom | roda do mouse, pinça no trackpad, teclas + e − | pinça com dois dedos |
   | Zoom normal + câmera de volta na bike | duplo clique ou tecla 0 | toque duplo |
   | Ajuda | botão **? Ajuda** | botão **? Ajuda** |

9. **Guia de navegação**: se a pessoa tenta um gesto que o site não suporta (clicar/tocar no mapa várias
   vezes, botão direito, três dedos, segurar o dedo parado, deslizar para os lados, apertar teclas sem
   função), aparece um guia com as instruções do aparelho dela. O botão **"Não mostrar esta dica
   novamente"** grava a escolha no `localStorage`, que continua valendo mesmo depois de fechar o navegador.

---

## 5. Receitas de alteração

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
| Bicicleta + avatar | `cutouts/avatar/bike.webp` (virada para a **direita**, rodas encostando na base) |
| Recorte da Marina | `cutouts/intro/marina.webp` |
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
| Tempo até ela aparecer depois do atropelo | Em `src/main.js`, função `hitTotem`: `showPin(totem, 1)`. O `1` é o atraso em segundos. |

O recorte da apresentação (Marina) **não** tem janela no chão, porque ele já mostra o texto em 3D.

---

### 5.9 Inventário e progresso salvo

**Arquivo:** `src/core/state.js`.

- `state.collected` → lista dos ids dos recortes atropelados.
- `state.links` → lista dos ids cujo "Saiba mais" já foi clicado.
- `state.won` → se a janela "Você zerou!" já apareceu.

Funções principais:

| Função | O que faz |
|---|---|
| `collect(id)` | Adiciona o recorte ao inventário (só conta uma vez). |
| `markLink(id)` | Marca que o "Saiba mais" foi aberto (janela grande ou janela do chão). |
| `resetProgress()` | Apaga tudo. Chamada pelo botão ↺ Resetar (depois da confirmação) ou por "Resetar tudo". |

O contador do botão **Inventário** e a barra **"Conhecimento sobre Marina"** são atualizados sozinhos
toda vez que o estado muda (função `updateHUD` em `src/ui/screens.js`).

**Testar do zero:** durante o desenvolvimento, para começar sem progresso, use uma destas opções:

- botão **↺ Resetar → Sim, resetar tudo**; ou
- feche a aba e abra de novo; ou
- no console (F12): `sessionStorage.clear()` e depois F5.

**Apagar o progresso de todos os visitantes após uma mudança grande:** troque a versão da chave em
`state.js`:

```js
const STORAGE_KEY = 'mmj-portfolio:v1'  // mude para 'mmj-portfolio:v2'
```

---

### 5.10 Botão Resetar, Game Over e "Tentar novamente"

**Arquivo:** `src/ui/screens.js`.

O caminho completo é:

```
Botão "↺ Resetar"
   └── showResetConfirm()  → "Resetar o jogo?" [Sim, resetar tudo] [Cancelar]
         └── Sim → rewind('start', { fresh: true })  (apaga o inventário e remonta os recortes)

Fechar/recarregar a aba (evento "beforeunload")
   ├── inventário completo → sai sem aviso
   └── faltam recortes     → aviso nativo do navegador
         ├── "Sair"  → a página fecha
         └── "Ficar" → showGameOver() → [Continuar jogando] [Tentar novamente] [Ir aos contatos]

[Tentar novamente] ou [Jogar de novo]
   └── showRetryChoice()
         ├── inventário vazio → volta direto ao início
         └── senão pergunta:
               [Manter o inventário] → rewind('start')                   (mantém tudo)
               [Resetar tudo]        → rewind('start', { fresh: true })  (apaga tudo)
```

**Como os botões funcionam:** cada botão tem um atributo `data-action="nome"`. No fim do arquivo há um
`switch` que decide o que fazer com cada nome:

```js
switch (el.dataset.action) {
  case 'retry':          showRetryChoice(); break
  case 'restart-keep':   rewind('start'); break
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

**Textos:** o texto da confirmação fica em `TEXTS.resetConfirm` e o do Game Over em `TEXTS.gameOver`
(`src/data/level.js`).

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

- **Velocidade:** `src/world/bike.js` → função `updateBike`:
  ```js
  const max = input.boost ? 17 : 10  // 17 com Shift, 10 normal
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
  drag: { bikeHitRadius: 44, edgeMargin: 0.1, edgeSpeed: 28 },
  tap: { maxMove: 10, maxTime: 260, doubleGap: 320 },
  longPressMs: 900,
}
```

| Quero… | O que mudar |
|---|---|
| Facilitar "pegar" a bike com o dedo | Aumente `drag.bikeHitRadius` (em pixels, ex.: `60`). |
| Câmera andar mais rápido quando a bike chega na borda | Aumente `drag.edgeSpeed` (metros por segundo). |
| Faixa da borda que faz a câmera andar mais larga | Aumente `drag.edgeMargin` (`0.1` = 10% da tela). |
| Zoom da roda do mouse mais rápido | Aumente `zoom.wheel` (ex.: `0.002`). |
| Zoom da pinça do trackpad mais suave | Diminua `zoom.trackpadPinch` (ex.: `0.008`). |
| Cada toque em + / − dar mais zoom | Aumente `zoom.key`. |
| Toque duplo mais fácil de acertar | Aumente `tap.doubleGap` (em milissegundos). |

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

Todo link para outro site, PDF, e-mail ou telefone é interceptado e aberto por cima do jogo, em tela cheia.
O jogo fica pausado e, ao fechar (botão **✕ Voltar ao jogo**, tecla **Esc** ou botão **voltar** do celular),
tudo continua exatamente de onde parou. Nada abre em nova aba.

| Tipo de link | O que aparece |
|---|---|
| Site comum (ex.: portfólio no Behance, artigo) | O site dentro de um quadro (iframe) |
| YouTube / Vimeo | O player de vídeo (o endereço é convertido para a versão "embed") |
| PDF (ex.: currículo) | O PDF no leitor do navegador; no celular, pelo visualizador do Google (só com o site publicado) |
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

**Mudar a data de início:** em `level.js`, troque `since: '2026-10-21'` (formato AAAA-MM-DD).

**Zerar a contagem:** troque o `namespace` (ex.: `'marinamicas-portfolio-2027'`). Os números começam do zero.

**Se o serviço sair do ar:** o texto vira "Visitantes: indisponível no momento" e o jogo continua normal.
Para trocar de serviço, só a função `call()` em `visitors.js` precisa mudar.

---

## 6. Testando antes de publicar

Rode o projeto (`npm run dev`) e confira esta lista:

- [ ] A tela inicial abre e o botão "Pedalar ▶" funciona.
- [ ] Atropelar a Marina mostra o texto de apresentação em 3D.
- [ ] Atropelar cada recorte: abre a janela, o contador do inventário aumenta 1, e depois aparece a janela no chão.
- [ ] O "Saiba mais" (janela e janela do chão) abre no visualizador em tela cheia, sem nova aba, e o inventário mostra "🔗 saiba mais visitado".
- [ ] Os links do topo (LinkedIn, GitHub, e-mail, WhatsApp, currículo) abrem no visualizador; Esc e "voltar" fecham.
- [ ] Rebobinar para a bifurcação e para o início: os recortes conquistados **continuam destruídos**.
- [ ] Apertar F5: os recortes conquistados continuam destruídos e o contador continua igual.
- [ ] Com recortes faltando, recarregar a página (F5) → aviso do navegador → "Cancelar/Ficar" → Game Over.
- [ ] Botão ↺ Resetar → confirmação → "Sim, resetar tudo" → inventário volta a 0.
- [ ] "Manter o inventário" → volta ao início com tudo conquistado.
- [ ] "Resetar tudo" → contador volta a `0/…` e todos os recortes ficam de pé.
- [ ] Coletar tudo e recarregar a página → nenhum aviso aparece.
- [ ] O contador "Visitantes: … (desde …)" aparece na tela inicial e embaixo da barra de conhecimento.
- [ ] Roda do mouse / pinça do trackpad aproxima e afasta a câmera sem dar zoom na página; duplo clique volta ao normal.
- [ ] Clicar na bike e arrastar: ela acompanha o mouse exatamente e para onde for solta.
- [ ] Clicar no cenário e arrastar: o mapa acompanha o mouse; a bike não se mexe.
- [ ] Arrastar a bike até um recorte: câmera lenta, aproximação e tremida, e depois tudo volta ao normal.
- [ ] No modo celular do F12: tocar na bike e arrastar, arrastar o cenário, pinça dá zoom, toque duplo volta ao normal.
- [ ] Clicar 3 vezes seguidas no mapa abre o guia; "Não mostrar esta dica novamente" faz ele parar de aparecer.
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
| **Build** | Versão final otimizada do site, gerada na pasta `dist/`. |
| **Deploy** | Publicar o site na internet. |
| **Commit** | Um "ponto de salvamento" no histórico do Git. |
