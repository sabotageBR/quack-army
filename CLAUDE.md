# CLAUDE.md

Orientação para o Claude Code neste repositório.

## O que é

**Quack Army** (`quack-army`): corredor 3D de multidão. Um bando de patinhos de borracha corre pelo Reino da Banheira; o jogador arrasta para os lados e escolhe portões que somam, subtraem, multiplicam e dividem o bando, atropela exércitos de brinquedos de banho e, no fim, os patos fazem uma escada para derrubar o castelo do chefe. Jogo original do estúdio (nome, tema, personagens e
arte próprios) para Poki, CrazyGames e californiagames.io, a partir do kit multiportal
(`../distribuicao/kit`, ver o README de lá). Catálogo no cofre: `../Nettools Games/Jogos/quack-army.md`.

## Rodar e testar

- `npm run servir` → http://127.0.0.1:5440/ (a PlataformaSDK em modo autônomo, anúncios simulados).
  Parâmetros só em localhost: `?novo`, `?fase=N`, `?semente=N`, `?auto`, `?filme=30`, `?semanuncio`, `?lang=pt|en|es`, `?limpo`, `?debug`.
- `npm test`: lógica pura, bots, portais e as fronteiras do código (`test/estilo.test.js`).
- `npm run empacotar` (5 alvos: poki, crazygames, crazygames-basic, californiagames, y8) e `npm run verificar`; prova do California: de `../distribuicao`,
  `node ferramentas/provar.mjs quack-army`.

## Arquitetura

- `src/main.js`: único módulo que toca portal, DOM, áudio e salvamento. Ciclo do portal como no kit.
- `src/jogo/`: lógica pura e determinística (sem DOM, relógio nem `Math.random`): `regras.js` (contas, raio do
  bando, perda nos obstáculos), `fase.js` (gerador por semente com curva de dificuldade, provado pelo bot),
  `corrida.js` (simulação de passo fixo usada pelo jogo e pelos testes), `bot.js` (guloso, pior e ruidoso),
  `meta.js` (melhorias, 9 lendas, presente do dia).
- `src/render/`: three.js r187 (`cena.js`: pista, multidão em `InstancedMesh`, portões, inimigos, escada, castelo e o
  final do líder; `bando.js`: física do bando, sem three.js; `corpos.js`: balística do que é arremessado;
  `rotulos.js`: números em canvas dentro da cena; `arte.js`: carga das texturas).
- Sons: um som limpo por acerto, sem camada de ruído junto nem sequência rápida de cliques (ver `src/som/sons.js`).
- Arte: `node tools/montar-arte.mjs` refaz `src/arte/` a partir de `arte/bruto/` (nomes de cada recorte lá dentro).
- `src/som/`: sons sintetizados. `src/i18n/textos.js`: pt, en, es.
- `src/core/`: kit (não mexer sem motivo; correções voltam para `../distribuicao/kit`).
- `src/arte/`: arte processada (WebP). `arte/bruto/`: originais do Grok (fora do build). `docs/autoria.md`: prompts.

## Regras

- Código, comentários e docs em português; comentários ASCII em `src/jogo/`.
- Nenhum anúncio antes da fase 6 (ou ~4 min); intervalo só em pausa natural; premiado só por escolha, fora do jogo ativo.
- Armazenamento só com o prefixo `quackarmy.`; nunca `clear()`.
- Toda arte nova pelo `tools/grok.mjs` com o bloco de estilo do `docs/GDD.md`; conferir a olho antes de usar.
- Não fazer commit sem o usuário pedir.
- Registrar atividade no cofre: linha em `Atividades/AAAA-MM-DD.md` e histórico em `Jogos/<slug>.md`.
