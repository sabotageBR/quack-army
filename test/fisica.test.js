// Fisica do desenho (src/render/bando.js e src/render/corpos.js): o bando se empurra e se espreme sem
// virar bloco rigido, e o que e arremessado quica, assenta, some ou cai na agua. Modulos sem DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarBandoFisico } from '../src/render/bando.js';
import { criarCorpos } from '../src/render/corpos.js';
import { MEIA_PISTA, raioBando } from '../src/jogo/regras.js';

const DT = 1 / 60;

/** @param {ReturnType<typeof criarBandoFisico>} b */
function sobrepostos(b) {
  let ruins = 0;
  const lim = (b.d0 * 0.45) ** 2;
  for (let i = 0; i < b.n; i++) {
    for (let j = i + 1; j < b.n; j++) {
      const dx = b.x[i] - b.x[j];
      const dz = b.dz[i] - b.dz[j];
      if (dx * dx + dz * dz < lim) ruins++;
    }
  }
  return ruins / b.n;
}

test('bando de 600: forma estavel, sem NaN, dentro da elipse e da pista, quase sem patos encavalados', () => {
  const b = criarBandoFisico(600);
  const R = raioBando(600);
  b.dispor(600, 0, R);
  for (let i = 0; i < 180; i++) b.passo(DT, { cx: 0, vcx: 0, cz: 0, R, meia: MEIA_PISTA - 0.15 });
  for (let i = 0; i < b.n; i++) {
    assert.ok(Number.isFinite(b.x[i]) && Number.isFinite(b.dz[i]) && Number.isFinite(b.y[i]));
    assert.ok(Math.abs(b.x[i]) <= MEIA_PISTA - 0.15 + 1e-6);
    assert.ok(Math.hypot(b.x[i], b.dz[i] / 0.85) < R * 1.2, `pato ${i} fora da elipse`);
  }
  assert.ok(sobrepostos(b) < 0.05, `encavalados: ${sobrepostos(b)}`);
});

test('curva: cada pato atrasa diferente (balanco), e o bando volta a forma depois', () => {
  const b = criarBandoFisico(200);
  const R = raioBando(200);
  b.dispor(200, -2, R);
  let cx = -2;
  for (let i = 0; i < 60; i++) b.passo(DT, { cx, vcx: 0, cz: 0, R, meia: MEIA_PISTA - 0.15 });
  // guinada para a direita na velocidade lateral do jogo
  let vmin = 0;
  let vmax = 0;
  for (let i = 0; i < 20; i++) {
    cx += 11 * DT;
    b.passo(DT, { cx, vcx: 11, cz: 0, R, meia: MEIA_PISTA - 0.15 });
    if (i === 4) {
      const v = Array.from(b.vx.slice(0, b.n));
      vmin = Math.min(...v);
      vmax = Math.max(...v);
    }
  }
  let soma = 0;
  for (let i = 0; i < b.n; i++) soma += b.x[i];
  const media = soma / b.n;
  assert.ok(media < cx - 0.3, `o bando devia ficar para tras na curva (media ${media.toFixed(2)}, centro ${cx.toFixed(2)})`);
  assert.ok(vmax - vmin > 2, `velocidades quase iguais = bloco rigido (${vmin.toFixed(1)} a ${vmax.toFixed(1)})`);
  for (let i = 0; i < 90; i++) b.passo(DT, { cx, vcx: 0, cz: 0, R, meia: MEIA_PISTA - 0.15 });
  soma = 0;
  for (let i = 0; i < b.n; i++) soma += b.x[i];
  assert.ok(Math.abs(soma / b.n - cx) < 0.25, 'depois da curva o bando se reagrupa no centro');
});

test('portao: o bando se espreme na abertura escolhida e se espalha depois', () => {
  const b = criarBandoFisico(300);
  const R = raioBando(300);
  const cx = 0;
  b.dispor(300, cx, R);
  // porta do meio de tres: bem mais estreita que o bando
  const funil = { z: 6, x0: -1.4, x1: 1.4 };
  let cz = 0;
  let foraNaPassagem = 0;
  let naPassagem = 0;
  for (let i = 0; i < 90; i++) {
    cz += 10 * DT;
    b.passo(DT, { cx, vcx: 0, cz, R, meia: MEIA_PISTA - 0.15, funil });
    for (let k = 0; k < b.n; k++) {
      const z = cz + b.dz[k];
      if (Math.abs(z - funil.z) < 0.15) {
        naPassagem++;
        if (b.x[k] < funil.x0 - 0.05 || b.x[k] > funil.x1 + 0.05) foraNaPassagem++;
      }
    }
  }
  assert.ok(naPassagem > 200, 'patos cruzaram o plano do portao');
  assert.ok(foraNaPassagem / naPassagem < 0.03, `patos atravessando o poste: ${foraNaPassagem}/${naPassagem}`);
  // longe do portao volta a largura do disco
  for (let i = 0; i < 90; i++) b.passo(DT, { cx, vcx: 0, cz: cz + 20, R, meia: MEIA_PISTA - 0.15 });
  const xs = Array.from(b.x.slice(0, b.n));
  assert.ok(Math.max(...xs) - Math.min(...xs) > R * 1.5, 'o bando se espalhou de novo');
});

test('remover escolhe os patos certos (perto do obstaculo, frente) e o desempenho cabe no quadro', () => {
  const b = criarBandoFisico(600);
  const R = raioBando(600);
  b.dispor(600, 0, R);
  const saiu = b.remover(40, { tipo: 'perto', x: 2 });
  assert.equal(saiu.length, 40);
  assert.equal(b.n, 560);
  for (const p of saiu) assert.ok(Math.abs(p.x - 2) < 0.9, `tirou um pato longe do obstaculo (x=${p.x.toFixed(2)})`);
  const frente = b.remover(10, { tipo: 'frente' });
  const resto = Math.max(...Array.from(b.dz.slice(0, b.n)));
  for (const p of frente) assert.ok(p.dz >= resto - 0.06);
  b.adicionar(50, { x: 0, dz: 0.5, larg: 2 });
  assert.equal(b.n, 600);
  const t0 = performance.now();
  for (let i = 0; i < 600; i++) b.passo(DT, { cx: Math.sin(i / 30), vcx: Math.cos(i / 30) / 30 / DT, cz: i * 0.2, R, meia: MEIA_PISTA - 0.15 });
  const ms = (performance.now() - t0) / 600;
  assert.ok(ms < 2.5, `fisica do bando lenta: ${ms.toFixed(2)} ms por passo com 600 patos`);
});

test('corpos: quica na pista, assenta e some; fora da pista respinga na agua; o ralo engole', () => {
  const c = criarCorpos(50);
  /** @param {number} x @param {number} z */
  const chao = (x, z) => (Math.abs(x) <= MEIA_PISTA + 0.25 && z > -10 ? { y: 0, agua: false } : { y: -0.95, agua: true });
  const pato = c.soltar({ x: 0, y: 1, z: 0, vx: 0.5, vy: 6, vz: -1, w: 10, h: 0.55, l: 0.5 });
  const fora = c.soltar({ x: 3.5, y: 1, z: 0, vx: 5, vy: 4, vz: 0, h: 0.6, l: 0.5 });
  const ralo = c.soltar({ x: 1, y: 0.3, z: 5, h: 0.55, l: 0.5 });
  c.sugar(ralo, 0.8, 5.1);
  const fica = c.soltar({ x: -1, y: 2, z: 3, vy: 2, h: 1, l: 1, fica: true });
  const eventos = [];
  let minY = Infinity;
  for (let i = 0; i < 300; i++) {
    for (const e of c.passo(DT, chao)) eventos.push(e);
    if (c.lista.includes(pato)) minY = Math.min(minY, pato.y - 0.5 * pato.s * (pato.h * Math.abs(Math.cos(pato.a)) + pato.l * Math.abs(Math.sin(pato.a))));
  }
  assert.ok(eventos.some((e) => e.c === pato && e.tipo === 'quique'), 'o pato quicou');
  assert.ok(eventos.some((e) => e.c === pato && e.tipo === 'puf'), 'o pato assentou e sumiu');
  assert.ok(minY > -0.02, 'o pato nao atravessou o chao');
  assert.ok(eventos.some((e) => e.c === fora && e.tipo === 'respingo'), 'o que sai da pista cai na agua');
  assert.ok(!c.lista.includes(ralo), 'o ralo engoliu o pato');
  assert.ok(c.lista.includes(fica), 'pedaco do castelo fica no chao');
  assert.ok(Math.abs(fica.vy) < 1e-6 && fica.y > 0, 'pedaco parado em cima do chao');
});
