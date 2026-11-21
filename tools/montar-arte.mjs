// Monta src/arte/ a partir dos brutos do Grok (arte/bruto/), sempre igual: recorta as folhas (sprite.mjs
// recortar --separar), da nome a cada objeto, reduz para WebP e costura as texturas. Rodar de novo depois
// de refazer um bruto. Uso: node tools/montar-arte.mjs [--so=patos,lendas]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, copyFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const TMP = join(RAIZ, '.tmp/montar');
const ARTE = join(RAIZ, 'src/arte');
const so = (process.argv.find((a) => a.startsWith('--so=')) || '').slice(5).split(',').filter(Boolean);
const quer = (k) => !so.length || so.includes(k);
const sprite = (...a) => execFileSync('node', [join(RAIZ, 'tools/sprite.mjs'), ...a], { stdio: ['ignore', 'pipe', 'inherit'] });

/**
 * Folhas: bruto, opcoes extras do recorte, largura final e o nome de cada objeto na ordem de leitura
 * (null = descartar).
 */
const FOLHAS = [
  { id: 'patos', largura: 160, nomes: ['patos/tras-1', 'patos/tras-2', 'patos/tras-3', 'patos/pulo-1', 'patos/pulo-2', 'patos/pulo-3', 'patos/frente-1', 'patos/frente-2', 'patos/feliz'] },
  { id: 'inimigos', largura: 192, nomes: ['inimigos/sapo-1', 'inimigos/sapo-2', 'inimigos/sapo-3', 'inimigos/tubarao-1', 'inimigos/tubarao-2', 'inimigos/tubarao-3', 'chefes/reisapo', 'chefes/tubarao', 'chefes/imperador'], larguraDe: { 'chefes/': 320 } },
  { id: 'polvos2', largura: 192, nomes: ['inimigos/polvo-1', 'inimigos/polvo-2', 'inimigos/polvo-3', 'chefes/polvo'], larguraDe: { 'chefes/': 320 } },
  { id: 'polvos', largura: 192, nomes: [null, null, null, null, 'aderecos/sabonete-rosa', null, 'castelos/rosa', 'castelos/azul', 'castelos/lilas'], larguraDe: { 'castelos/': 384 } },
  { id: 'aderecos', largura: 192, nomes: ['aderecos/sabonete', 'aderecos/escova', 'aderecos/ralo', 'aderecos/moeda', 'aderecos/gaiola', 'aderecos/presente', 'aderecos/escudo', 'aderecos/estrela', 'aderecos/espuma'] },
  { id: 'lendas', largura: 192, extra: ['--tol=0.08', '--suave=0.05'], nomes: ['lendas/capitao', 'lendas/escudo', 'lendas/sortudo', 'lendas/mergulhador', 'lendas/ninja', 'lendas/almirante', 'lendas/ouro', 'lendas/rainha', 'lendas/trovao'] },
  { id: 'icones', largura: 128, nomes: ['ui/patos', 'ui/bolha', 'ui/moedas', 'ui/trofeu', 'ui/cadeado', 'ui/relogio', 'ui/cabeca', 'ui/gota', 'ui/coracao'] },
];
const TEXTURAS = ['banheira', 'piscina', 'lago', 'chuveiro', 'agua'];
const FUNDOS = ['banheira', 'piscina', 'lago', 'chuveiro'];

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

for (const f of FOLHAS) {
  if (!quer(f.id)) continue;
  const bruto = join(RAIZ, 'arte/bruto', `${f.id}.jpg`);
  if (!existsSync(bruto)) { process.stdout.write(`falta ${f.id}.jpg (pula)\n`); continue; }
  const pasta = join(TMP, f.id);
  sprite('recortar', bruto, `${pasta}/`, '--separar', `--nome=${f.id}`, '--largura=512', ...(f.extra || []));
  const pngs = readdirSync(pasta).filter((n) => n.endsWith('.png')).sort();
  if (pngs.length !== f.nomes.length) process.stdout.write(`AVISO ${f.id}: ${pngs.length} objetos, esperado ${f.nomes.length}\n`);
  pngs.forEach((png, i) => {
    const nome = f.nomes[i];
    if (!nome) return;
    const destino = join(ARTE, `${nome}.webp`);
    mkdirSync(join(destino, '..'), { recursive: true });
    const larg = Object.entries(f.larguraDe || {}).find(([p]) => nome.startsWith(p))?.[1] || f.largura;
    let origem = join(pasta, png);
    if (nome === 'lendas/ouro') {
      // o Grok fez o pato de ouro amarelo comum: puxa para o dourado metalico
      const dourado = join(pasta, 'ouro.png');
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', origem, '-vf', 'colorchannelmixer=rr=1:rg=0.05:gg=0.8:gb=0.05:bb=0.2,eq=contrast=1.12:saturation=1.25', dourado]);
      origem = dourado;
    }
    sprite('reduzir', origem, destino, `--largura=${larg}`, '--q=84');
  });
  process.stdout.write(`ok ${f.id}\n`);
}

if (quer('texturas')) {
  for (const t of TEXTURAS) {
    const bruto = join(RAIZ, 'arte/bruto', `tex-${t}.jpg`);
    if (!existsSync(bruto)) { process.stdout.write(`falta tex-${t}.jpg\n`); continue; }
    mkdirSync(join(ARTE, 'texturas'), { recursive: true });
    const png = join(TMP, `tex-${t}.png`);
    sprite('costurar', bruto, png, '--lado=512');
    sprite('reduzir', png, join(ARTE, 'texturas', `${t}.webp`), '--largura=512', '--q=80');
  }
  process.stdout.write('ok texturas\n');
}

if (quer('fundos')) {
  for (const t of FUNDOS) {
    const bruto = join(RAIZ, 'arte/bruto', `fundo-${t}.jpg`);
    if (!existsSync(bruto)) { process.stdout.write(`falta fundo-${t}.jpg\n`); continue; }
    mkdirSync(join(ARTE, 'fundos'), { recursive: true });
    sprite('reduzir', bruto, join(ARTE, 'fundos', `${t}.webp`), '--largura=1024', '--q=78');
  }
  process.stdout.write('ok fundos\n');
}
copyFileSync(join(RAIZ, 'arte/escolhida/chave.jpg'), join(TMP, 'chave.jpg'));
