// Nenhum pacote sai com arte faltando ou provisoria: todo arquivo que o jogo carrega existe em src/arte,
// veio do Grok (tem bruto e prompt em docs/autoria.md) e cabe no orcamento da Poki.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname;
const fonte = readFileSync(join(RAIZ, 'src/render/arte.js'), 'utf8');
const lista = (nome) => {
  const m = fonte.match(new RegExp(`export const ${nome} = Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\)`));
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
};

test('toda arte carregada pela cena existe em src/arte', () => {
  const todas = [...lista('SPRITES'), ...lista('TEXTURAS'), ...lista('FUNDOS')];
  assert.ok(todas.length > 40);
  for (const a of todas) assert.ok(existsSync(join(RAIZ, 'src/arte', `${a}.webp`)), `falta src/arte/${a}.webp`);
});

test('toda imagem citada no HTML, no main.js e nas lendas existe', () => {
  const textos = ['index.html', 'src/main.js'].map((p) => readFileSync(join(RAIZ, p), 'utf8')).join('\n');
  for (const m of textos.matchAll(/src\/arte\/([a-z0-9/-]+)\.webp/g)) assert.ok(existsSync(join(RAIZ, 'src/arte', `${m[1]}.webp`)), `falta ${m[0]}`);
  for (const id of ['capitao', 'escudo', 'sortudo', 'mergulhador', 'ninja', 'almirante', 'ouro', 'rainha', 'trovao']) {
    assert.ok(existsSync(join(RAIZ, 'src/arte/lendas', `${id}.webp`)), `falta a lenda ${id}`);
  }
});

test('arte do jogo leve (orcamento Poki: total ate 8 MB) e com autoria registrada', () => {
  let total = 0;
  const andar = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) andar(p);
      else total += statSync(p).size;
    }
  };
  andar(join(RAIZ, 'src/arte'));
  assert.ok(total < 2.5 * 1024 * 1024, `src/arte com ${(total / 1048576).toFixed(2)} MB`);
  const autoria = readFileSync(join(RAIZ, 'docs/autoria.md'), 'utf8');
  for (const id of ['chave-a', 'patos', 'inimigos', 'polvos2', 'aderecos', 'lendas', 'icones', 'tex-banheira', 'tex-agua', 'fundo-lago']) {
    assert.ok(autoria.includes(`| ${id} |`), `docs/autoria.md sem o prompt de ${id}`);
    assert.ok(existsSync(join(RAIZ, 'arte/bruto', `${id}.jpg`)), `sem o bruto ${id}.jpg`);
  }
});
