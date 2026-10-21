# Marina Micas Jardim — Portfólio gamificado

Portfólio 3D em **Three.js + cannon-es (física) + GSAP (câmera e tempo)**, empacotado com **Vite** e publicado como site estático no **GitHub Pages**.

O jogador pedala uma bicicleta preta em recorte 2D por um mundo de colagem digital triangular, atropela os recortes da trajetória da Marina (que se desfazem em pedaços de papel) e acompanha o próprio progresso até "zerar".

> 📘 **Novo no projeto?** Leia o [Manual de atualização e modificação](docs/MANUAL-DE-ATUALIZACAO.md), com passo a passo para cada alteração.

## Rodando localmente

Requer Node.js 20+ (recomendado: 24 LTS).

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # gera a pasta dist/
npm run preview   # serve o dist/ localmente
```

Em modo dev, `window.__game` expõe `scene`, `world`, `rig`, `bike`, `totems` e `state` no console, para depuração.

## Controles

| Ação | Teclado | Celular |
|---|---|---|
| Mover a bike | clicar na bike e arrastar | tocar na bike e arrastar |
| Olhar o mapa (pan) | clicar no cenário e arrastar | tocar no cenário e arrastar |
| Pedalar (alternativa) | W A S D / setas, Shift acelera | — |
| Zoom | roda do mouse, pinça no trackpad ou + / − | pinça com dois dedos |
| Zoom normal + câmera na bike | duplo clique ou 0 | toque duplo |
| Guia de navegação | botão **? Ajuda** | botão **? Ajuda** |
| Fechar janela | Esc | botão × |

Gestos não suportados (cliques/toques soltos repetidos, botão direito, três dedos, segurar o dedo parado, deslizar para os lados, teclas sem função) abrem um **guia de navegação** adaptado ao aparelho (touch ou PC). O visitante pode marcar **"Não mostrar esta dica novamente"**, e a escolha fica salva no `localStorage`.

A bike arrastada segue exatamente o ponto do chão sob o dedo/mouse, sem inércia. Levá-la até a borda da tela faz a câmera andar junto. A única desaceleração é o efeito cinematográfico do atropelo (câmera lenta + aproximação + tremida).

## Onde editar o conteúdo

**Tudo fica em [`src/data/level.js`](src/data/level.js):** textos, recortes (`ITEMS`), links "saiba mais", ruas, placas, checkpoints e enquadramentos de câmera.

Para adicionar uma experiência ou formação, copie uma linha `item(...)` e ajuste:

```js
item('edu-4', 'formacoes', 'Pós em Ciência de Dados', 'Dados', 30, -150, {
  image: 'formacoes/edu-4.webp',
  body: 'Texto da janela flutuante…',
  links: [{ label: 'Certificado', url: 'https://…' }],
}),
```

`x` e `z` são a posição no mapa. As ruas ficam em x = -46 (Desenvolvimento), -30 (Design), -14 (Diversidade) e 30 (Formações), de z = -78 até -165.

## Colocando suas artes (recortes)

Coloque os arquivos em `src/assets/cutouts/` com o nome indicado em `image` no `level.js`. **Enquanto o arquivo não existir, o jogo gera um recorte provisório automaticamente.**

| Arte | Caminho esperado |
|---|---|
| Bicicleta + avatar | `cutouts/avatar/bike.webp` (virada para a **direita**, rodas encostando na base) |
| Recorte da Marina | `cutouts/intro/marina.webp` |
| Placas | `cutouts/signs/experiencias.webp`, `formacoes.webp`, `desenvolvimento.webp`, `design.webp`, `diversidade.webp` |
| Experiências | `cutouts/experiencias/{desenvolvimento,design,diversidade}/*.webp` |
| Formações | `cutouts/formacoes/*.webp` |

Dicas:
- Use **PNG/WebP com fundo transparente**. O contorno do recorte é o próprio alfa da imagem, e é ele que vira os pedaços de papel na explosão.
- O ideal é ter no máximo 2048 px no maior lado. WebP ou AVIF deixam o site bem mais leve.
- A altura do totem vem de `size` no `level.js`; a largura se ajusta à proporção da imagem.

## Antes de publicar

1. Em [`index.html`](index.html), troque os links do header: `SEU-PERFIL`, `SEU-USUARIO`, `seu-email@exemplo.com` e `55DDDNUMERO`.
2. Coloque o currículo em `public/docs/curriculo-marina-micas.pdf`.
3. (Opcional) Coloque uma imagem de preview em `public/og-image.jpg` (1200×630), usada quando o link é compartilhado no LinkedIn ou WhatsApp.
4. Troque os `https://example.com` dos links em `src/data/level.js`.

## Publicando no GitHub Pages

O deploy é automático via GitHub Actions ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)):

1. Crie um repositório no GitHub e envie o projeto:
   ```bash
   git add .
   git commit -m "Portfólio gamificado"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/NOME-DO-REPO.git
   git push -u origin main
   ```
2. No repositório: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. A cada `push` na `main`, o site é publicado em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

O `vite.config.js` usa `base: './'`, então funciona com qualquer nome de repositório, inclusive `SEU-USUARIO.github.io`.

## Arquitetura

```
src/
├── main.js              # orquestra: loop (gsap.ticker), zonas, atropelos, tela inicial
├── data/level.js        # LEVEL DESIGN: conteúdo, mapa, câmera
├── core/
│   ├── stage.js         # renderer, cena, câmera, luzes
│   ├── physics.js       # mundo cannon-es + materiais de contato
│   ├── CameraRig.js     # câmera que segue a bike; API pronta para GSAP (frame, cinematic, shake)
│   ├── input.js         # teclado, roda do mouse/trackpad (zoom), gestos do Safari, sensibilidades
│   ├── pointerControls.js # Pointer Events: arrastar a bike, arrastar o cenário (pan), pinça
│   ├── device.js        # detecta touch (celular/tablet) x mouse/teclado (PC)
│   ├── invalidGestures.js # detector de gestos não suportados
│   ├── state.js         # progresso no sessionStorage (sem banco de dados)
│   └── timeMachine.js   # gravação da trajetória, rebobinar, viagens do inventário
├── world/
│   ├── environment.js   # chão, ruas, colagem triangular, props físicos, placas magnéticas, horizonte
│   ├── bike.js          # avatar 2D + corpo físico
│   └── totems.js        # recortes colecionáveis + destruição em pedaços de papel
├── ui/
│   ├── modal.js         # janela flutuante
│   ├── guide.js         # guia de navegação (touch/PC) + "não mostrar novamente"
│   ├── pins.js          # janelas "saiba mais" presas no chão
│   ├── screens.js       # HUD, item, inventário, zerou, game over, resetar, aviso de saída, contador
│   ├── viewer.js        # visualizador em tela cheia para links externos (iframe)
│   └── effects.js       # toast e partículas triangulares na tela
└── utils/               # texturas em canvas, carregamento de recortes, helpers
```

## Regras de jogo implementadas

- **Progresso:** cada recorte atropelado conta uma vez e fica em `sessionStorage`, válido enquanto a aba estiver aberta.
- **Estado final mantido:** recortes conquistados continuam destruídos, com a janela "saiba mais" presa no chão, ao rebobinar (bifurcação ou início) e ao recarregar a página.
- **Rebobinar:** pode voltar para a bifurcação das placas ou para o início. Os objetos soltos do cenário voltam ao lugar; o inventário é mantido.
- **Reset completo:** botão **↺ Resetar** (com confirmação), ou **Tentar novamente → Resetar tudo** no Game Over. A opção **Manter o inventário** apenas leva a bike ao ponto de partida.
- **Placas magnéticas:** ao passar perto de uma placa sem virar, a bike é puxada suavemente para a rua que ela indica.
- **Inventário:** mostra os recortes conquistados e se o link "saiba mais" de cada um foi aberto. Clicar num recorte leva a bike até ele, com opção de voltar ao ponto anterior.
- **Game Over:** só quando a pessoa tenta **fechar ou recarregar a aba** sem 100% do inventário. O navegador mostra o aviso nativo dele ("Sair do site?", texto não personalizável); se ela escolher ficar, o jogo mostra o Game Over. Com o inventário completo, nada é bloqueado. Celulares (principalmente iPhone) nem sempre disparam esse aviso.
- **Links externos:** todos (topo, "Saiba mais", currículo) abrem num visualizador em tela cheia dentro do jogo, sem nova aba. Sites que proíbem exibição em iframe (LinkedIn, GitHub, WhatsApp…) mostram um cartão com "Copiar link".
- **Contador de visitantes:** "Visitantes: X únicos · Y visualizações (desde DD/MM/AAAA)", via API gratuita [Abacus](https://abacus.jasoncameron.dev). Únicos = 1 por aparelho (marcado no `localStorage`); visualizações = toda abertura do site. Configuração em `VISITORS` (`src/data/level.js`).
- **Zerou:** aparece automaticamente quando o último recorte é atropelado, e no lugar do Game Over quando o inventário está completo.
