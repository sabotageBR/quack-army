# Quack Army: documento de design

Jogo original do estúdio (nome, tema, personagens, fases e arte próprios). Da referência de gênero (corredor
de multidão com portões de conta) vem só a mecânica. Kit multiportal: Poki, CrazyGames (Full e Basic) e
californiagames.io. Porta local 5440, prefixo de armazenamento `quackarmy.`.

**Nome.** Pesquisa em 2026-11-20 (web, Poki, CrazyGames, App Store e Google Play): nenhum jogo chamado
"Quack Army". Vizinhos sem colisão: *Quack Quest* (Poki, jogo de criação), *Quack Attack* (projeto da RIT e um
jogo do Steam), *Quack Squad* (Epic, tiro), *Duck Warfare* (torre). Nome mantido.

## Gancho

Um bando de **patinhos de borracha** corre pelo **Reino da Banheira**. Arraste para os lados e escolha os
portões de bolha: **+10, ×3, −8, ÷2**. Desvie de sabonetes, escovas e ralos, atropele exércitos de brinquedos
de banho e, no fim, os patos fazem uma escada para derrubar o castelo do chefe. Quanto mais alto, mais moedas.

## Laço

1. **Largada** (pausa natural): o bando parado na linha, o próximo castelo ao fundo, dois cartões de melhoria
   embaixo e a mão-guia "arraste". O primeiro arrasto já é corrida (`gameplayStart` no gesto real).
2. **Corrida** (20 a 35 s): o bando anda sozinho; o jogador só decide o lado. Portões em pares, obstáculos,
   moedas soltas, gaiolas com patos para resgatar e exércitos inimigos (subtração animada no choque).
3. **Final**: a escada de patos sobe pelos degraus ×1, ×1,2, ×1,5... até acabar o bando; o último degrau
   multiplica as moedas. Aí o **pato líder** sai da frente do bando, sobe aos pulos o que falta da escada,
   corre pelo planalto e mergulha na porta do castelo, que se despedaça (pedaços com física). O castelo nunca
   cai sozinho: a festa e o som de vitória saem no impacto. A cada 5 fases o castelo tem um **chefe grande** com vida: o bando
   precisa ser maior que a vida dele.
4. **Festa curta** (1,8 s, sem véu) e a próxima fase já aparece na largada. Intervalo comercial só aqui, a
   partir da fase 6.

Derrota: o bando chega a zero, ou o chefe grande sobra com vida. "Tentar de novo" volta à largada da mesma
fase na hora; uma vez por fase, a partir da fase 6, há a escolha "🎬 Reviver com 25 patos" ao lado de
"Tentar de novo" do mesmo tamanho.

## Controles

- **Toque e mouse**: arrastar na horizontal em qualquer lugar da tela move o bando (relativo, sem pular).
- **Teclado**: A/D e ←/→ movem; ESC, espaço ou P pausam.
- Tablet usa o controle do toque. Retrato e paisagem (a câmera abre o campo na paisagem).

## Os 3 primeiros minutos

| Tempo | O que acontece |
|---|---|
| 0 s | Direto no jogo: 6 patos na largada, mão-guia arrastando. Texto curto: "Arraste para guiar o bando!" |
| ~4 s | Primeiro par: **×5** e +2. A mão aponta o ×5. O bando explode para 30 patos (o "uau"), confete de bolhas |
| ~8–15 s | +10 / ×2, depois ×3 / +20: o bando passa de 100. Fase 1 sem obstáculo nem inimigo |
| ~20 s | Escada de patos, o líder mergulha na porta e o castelo se despedaça, moedas voam. Festa e a fase 2 já está na largada |
| ~35 s | Fase 2: estreia o **sabonete deslizando** (tira patos do lado que encosta). Portões só positivos |
| ~1 min 10 | Fase 3: portão **−** e o primeiro **exército de sapos de corda** (choque com subtração animada) |
| ~1 min 50 | Fase 4: portão **÷** e **moedas soltas** na pista; cartões de melhoria já têm preço alcançável |
| ~2 min 30 | Fase 5: **chefe Rei Sapo** no castelo; vencer dá a **1ª lenda** (Capitão Bico, +5 patos na largada) |
| até ~3 min | Sem derrota: as fases 1 a 6 têm piso de 5 patos e o chefe da fase 5 é menor que o bando do pior caminho |

## Novidade a cada ~2 min

| Fase | Novidade |
|---|---|
| 1 | Portões + e ×; o ×5 do uau |
| 2 | Sabonete deslizando |
| 3 | Portão −; exército de sapos de corda |
| 4 | Portão ÷; moedas na pista |
| 5 | Chefe Rei Sapo; 1ª lenda |
| 6 | **Mundo 2, Piscina**: tubarões de plástico (valem 2 cada), escova girando |
| 8 | Portões que deslizam |
| 10 | Chefe Tubarão Capitão; lenda |
| 11 | **Mundo 3, Lago**: polvos (valem 3), ralos |
| 13 | Gaiolas: resgatar patos presos |
| 15 | Chefe Polvo Almirante; lenda |
| 16 | **Mundo 4, Chuveiro**: portões que piscam entre dois valores |
| 20 | Chefe Sapo Imperador; lenda |
| 21+ | Os mundos giram com dificuldade maior; chefes e lendas continuam até completar a coleção |

## Meta longa

- **Moedas** (uma moeda só, sem segunda moeda): da escada, das moedas na pista e do presente do dia.
- **Melhorias** (cartões na largada, preço crescente): **Patos iniciais** (+3 por nível), **Bolha extra**
  (+1 em todo portão + e +5% nos ×, por nível) e **Renda** (+10% de moedas por nível).
- **Lendas**: 9 heróis-pato colecionáveis com passivas. Uma ativa por vez (corre à frente do bando), escolhida
  na coleção. Cada chefe derrotado dá a próxima lenda; a coleção mostra "próxima lenda: fase N".
  1. Capitão Bico: +5 patos na largada
  2. Pata Escudo: ignora o 1º obstáculo da fase
  3. Pato Sortudo: +2 em todo portão +
  4. Mergulhador: ralos não tiram patos
  5. Ninja: obstáculos tiram 40% menos
  6. Almirante: inimigos com 15% menos
  7. Pato de Ouro: +30% de moedas
  8. Rainha Pata: escada começa no degrau ×1,5
  9. Trovão: o 1º portão × vale +1
- **Presente do dia**: uma vez por dia, na largada, um presente de moedas (cresce com a sequência até 7 dias,
  só como carimbo; perder um dia não tira nada). Escolha "Pegar" ou "🎬 Pegar ×2", do mesmo tamanho.

## Anúncios

- `commercialBreak` só na troca de fase (depois da festa, antes da largada) e só depois de completar a fase 6 (~3,5–4 min).
- Premiados só por escolha, fora da corrida, sempre com a opção grátis do mesmo tamanho ao lado:
  reviver (uma vez por fase, a partir da fase 6), presente do dia ×2, e "🎬 +moedas" no menu de pausa.
  Escondidos sem `portal.temVideo` (CrazyGames Basic não tem nenhum).

## Fases procedurais

Cada fase sai de `semente × número da fase` (`src/jogo/fase.js`) com uma curva de dificuldade: comprimento,
número de portões, força dos inimigos e obstáculos sobem devagar; os portões ruins ficam mais tentadores. O
gerador mede o **caminho guloso** e o **pior caminho** com o próprio bot; nas fases 1 a 6 o pior caminho também vence (piso de patos), e da fase 7 em diante o gerador facilita inimigos, portões ruins e chefe até o bot "ruidoso" (erra 30% das escolhas) vencer 7 ou 8 de 8 tentativas.
O bot (`src/jogo/bot.js`, escolha gulosa) joga cada fase nos testes: todas as fases de 1 a 60 precisam ser
vencidas pelo bot (duas sementes), e o teste mede o ritmo: fase 5 aos ~1,9 min, fase 10 aos ~4,2 min, fase 20 aos
~9,1 min e fase 30 aos ~14,6 min de corrida (bot, sem hesitar; o jogador real leva mais).

## Técnica

- three.js r187 vendorizado; uma luz ambiente e uma direcional, sem sombra dinâmica (sombra de disco falso).
- Multidão: sprites do Grok em **billboards instanciados** (`InstancedMesh`, um por quadro da animação); até
  600 patos visíveis (380 no celular), o resto só no número (o número do bando fica sempre visível).
- Física do desenho (a simulação em `src/jogo` continua mandando no número): `src/render/bando.js` trata cada
  pato como corpo com velocidade própria. Ele segue o centro com atraso individual (balança nas curvas e se
  inclina), os vizinhos se empurram (separação por posição com grade espacial), uma mola radial por fila enche
  a elipse por igual e fecha buracos, e no portão escolhido o bando se espreme na abertura e se espalha
  depois. `src/render/corpos.js` faz a balística do que é arremessado: patos atingidos e brinquedos
  atropelados voam rodando, quicam, assentam e somem num puf; o que sai da pista respinga na água; sabonete
  escorrega girando, escova tomba e quica, ralo engole em redemoinho; o chefe vencido voa para a água; o
  castelo e a gaiola se partem em pedaços. Custo medido: ~0,1 ms por quadro com 380 patos.
- Som: um som limpo por acerto (portão, moeda, gaiola). Nada de camada de ruído junto nem sequência rápida de
  cliques: o choque não toca um "plop" por pato, moedas em fileira tocam um "plim" só, e a escada é uma subida
  contínua, não uma nota por degrau.
- Texturas WebP pequenas (256–512 px), `preserveDrawingBuffer` só no `?filme`. Build Poki abaixo de 8 MB.

## Bíblia de arte

**Mundo:** um reino inteiro de banheiro visto como brinquedo: pistas de azulejo flutuando sobre a água,
espuma, bolhas, castelos de esponja e sabonete.

**Paleta**
- Patos: amarelo de pato `#FFD23F`, sombra `#F2A516`, bico laranja `#FF8A1F`.
- Água e banheira: aqua `#3EC6E0`, aqua claro `#8FE3F0`, espuma branca `#FFFFFF`.
- Inimigos em contraste com o amarelo: sapo verde `#5BC236`, tubarão azul-cinza `#6C8CB5`, polvo roxo
  `#9B5DE5` (roxo pede fundo verde na geração).
- Contorno e tinta: azul-marinho `#1D1D2B`. Portões: azul bolha (bons) e vermelho morango (ruins).

**Traço e forma:** brinquedo de vinil lustroso, formas gordinhas e arredondadas, contorno escuro grosso e
limpo, sombreado em dois tons com um brilho branco especular. Olhos grandes e simples (dois pontos pretos com
brilho), sem dentes afiados. Nada realista.

**Luz:** luz suave de cima à esquerda, sem sombra dura, céu claro de banheiro (azulejo e vapor).

**Bloco de estilo (vai no fim de TODO prompt, sem mudar uma palavra):**

> Style: glossy vinyl bath-toy look, chunky rounded shapes, thick clean dark navy outlines, soft two-tone cel
> shading with one small white specular highlight, bright saturated sunny palette of rubber-duck yellow,
> bath-water aqua and bubble white, soft light from the top left, friendly casual mobile game art, crisp
> edges, no text, no letters, no numbers, no logo, no watermark.

Sprites: `isolated on a perfectly flat solid magenta (#FF00FF) background, no shadow, no gradient, no
ground, no text` (polvo e qualquer coisa roxa ou rosa: fundo verde `#00FF00`).
