# Quack Army

Corredor 3D de multidão do estúdio: um bando de patinhos de borracha corre pelo Reino da Banheira, o jogador
arrasta para os lados e escolhe portões que somam, subtraem, multiplicam e dividem o bando, atropela exércitos de
brinquedos de banho e, no fim, os patos fazem uma escada colorida para derrubar o castelo do chefe.

- Design, os 3 primeiros minutos, meta longa, anúncios e a bíblia de arte: [`docs/GDD.md`](docs/GDD.md).
- Arte (todos os prompts do Grok e a escolha da arte-chave): [`docs/autoria.md`](docs/autoria.md).
- Como rodar, testar e a arquitetura: [`CLAUDE.md`](CLAUDE.md).
- O kit multiportal de onde ele saiu (empacotar, verificar, capas, vídeos, prints, provas):
  [`../distribuicao/kit/README.md`](../distribuicao/kit/README.md).

```bash
npm run servir      # http://127.0.0.1:5440/  (?novo, ?fase=N, ?auto, ?lang=en...)
npm test            # lógica pura, bot jogando as fases 1-60, arte, portais e fronteiras do código
npm run empacotar   # poki, crazygames, crazygames-basic, californiagames e y8 (ids da Y8 em package.json "kit.ids.y8")
npm run verificar
node tools/montar-arte.mjs   # refaz src/arte/ a partir de arte/bruto/
```
