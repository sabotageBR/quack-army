// Logica pura do Quack Army: contas, simulacao da corrida, gerador de fases e meta. O bot joga as fases:
// o guloso precisa vencer todas, o pior nao pode perder nas fases sem derrota, e o ruidoso (erra 30% das
// decisoes, o "jogador comum") mede se alguma fase virou muro. No fim imprime o ritmo da sessao.
import test from 'node:test';
import assert from 'node:assert/strict';
import { aplicarOp, fracaoNaFaixa, perdaObstaculo, raioBando, limiteX, MEIA_PISTA, ESCADA, redondo, valorPortao, faixaPortao } from '../src/jogo/regras.js';
import { criarCorrida, largar, passoCorrida, reviver, patosDoReviver, multEscada } from '../src/jogo/corrida.js';
import { criarFase, mundoDaFase, ehChefe, liberado, NOVIDADES } from '../src/jogo/fase.js';
import { simular, alvoBot } from '../src/jogo/bot.js';
import {
  BONUS_VAZIO, bonusDe, metaNova, normalizarMeta, comprar, precoMelhoria, LENDAS, lendaDoChefe, faseDaLenda,
  presenteDoDia, pegarPresente,
} from '../src/jogo/meta.js';

const SEMENTE = 7;

test('contas dos portoes', () => {
  assert.equal(aplicarOp(10, '+', 5), 15);
  assert.equal(aplicarOp(10, '-', 15), 0);
  assert.equal(aplicarOp(7, 'x', 3), 21);
  assert.equal(aplicarOp(7, '/', 2), 4);
  assert.equal(aplicarOp(1, '/', 3), 1);
  assert.equal(redondo(37), 35);
  assert.equal(redondo(123), 120);
});

test('fracao do disco numa faixa e perda nos obstaculos', () => {
  assert.ok(Math.abs(fracaoNaFaixa(0, 1, -10, 10) - 1) < 1e-9);
  assert.ok(Math.abs(fracaoNaFaixa(0, 1, 0, 10) - 0.5) < 1e-9);
  assert.equal(fracaoNaFaixa(0, 1, 2, 3), 0);
  assert.equal(perdaObstaculo(100, 0, 1), 0);
  assert.equal(perdaObstaculo(100, 0.5, 1), 50);
  assert.equal(perdaObstaculo(3, 0.05, 1), 1);
  assert.ok(raioBando(10000) <= 2.6 && limiteX(10000) > 1, 'bando enorme ainda escolhe o lado');
  assert.ok(limiteX(1) < MEIA_PISTA);
});

test('portao piscante e deslizante dependem do tempo', () => {
  const p = { op: 'x', v: 2, op2: '-', v2: 10, periodo: 1 };
  assert.deepEqual(valorPortao(p, 0.5), { op: 'x', v: 2 });
  assert.deepEqual(valorPortao(p, 1.5), { op: '-', v: 10 });
  const d = { x0: -1, x1: 1, amp: 2, omega: Math.PI / 2, fase: 0 };
  const [a, b] = faixaPortao(d, 1);
  assert.ok(Math.abs(a - 1) < 1e-9 && Math.abs(b - 3) < 1e-9);
});

test('fase 1: o x5 explode o bando nos primeiros 15 s e nao ha obstaculo nem inimigo', () => {
  const f = criarFase(1, SEMENTE);
  assert.ok(f.eventos.every((e) => e.tipo === 'portoes'));
  const c = criarCorrida(f);
  largar(c);
  let uau = 0;
  for (let i = 0; i < 60 * 15 && c.estado === 'correndo'; i++) {
    for (const a of passoCorrida(c, 1 / 60, alvoBot(c).x)) {
      if (a.tipo === 'portao' && a.op === 'x' && a.v === 5 && !uau) uau = c.t;
    }
  }
  assert.ok(uau > 0 && uau < 6, `x5 aos ${uau.toFixed(1)} s`);
  assert.equal(criarFase(1, 99).eventos.length, f.eventos.length, 'a fase 1 e roteirizada');
});

test('o gerador e deterministico', () => {
  for (const n of [2, 7, 16, 33]) assert.deepEqual(criarFase(n, SEMENTE), criarFase(n, SEMENTE));
  assert.notDeepEqual(criarFase(9, 1).eventos, criarFase(9, 2).eventos);
});

test('mundos, chefes e novidades', () => {
  assert.equal(mundoDaFase(1), 0);
  assert.equal(mundoDaFase(6), 1);
  assert.equal(mundoDaFase(16), 3);
  assert.equal(mundoDaFase(21), 0);
  assert.ok(ehChefe(5) && ehChefe(10) && !ehChefe(11));
  assert.ok(criarFase(5, SEMENTE).chefe && !criarFase(4, SEMENTE).chefe);
  // cada novidade aparece de fato na fase dela
  const tem = (n, pred) => criarFase(n, SEMENTE).eventos.some(pred);
  assert.ok(tem(2, (e) => e.sub === 'sabonete'));
  assert.ok(tem(3, (e) => e.tipo === 'inimigo' && e.sub === 'sapo'));
  assert.ok(tem(3, (e) => e.tipo === 'portoes' && e.portas.some((p) => p.op === '-')));
  assert.ok(tem(4, (e) => e.tipo === 'moeda'));
  assert.ok(tem(6, (e) => e.sub === 'tubarao') && tem(6, (e) => e.sub === 'escova'));
  assert.ok(tem(8, (e) => e.sub === 'desliza'));
  assert.ok(tem(11, (e) => e.sub === 'polvo') && tem(11, (e) => e.sub === 'ralo'));
  assert.ok(tem(13, (e) => e.tipo === 'gaiola'));
  assert.ok(tem(16, (e) => e.sub === 'pisca'));
  assert.ok(!liberado(2).sapo && liberado(3).sapo);
  // novidade a cada ~2 min: nenhuma janela de 4 fases (~2 min) sem estreia ate a fase 16
  const fases = Object.keys(NOVIDADES).map(Number);
  for (let n = 1; n <= 13; n++) assert.ok(fases.some((x) => x > n && x <= n + 4) || n >= 13, `sem novidade depois da fase ${n}`);
});

test('o bot guloso vence as fases 1 a 60 (duas sementes)', () => {
  for (const s of [SEMENTE, 3]) {
    for (let n = 1; n <= 60; n++) {
      const r = simular(criarFase(n, s), { modo: 'guloso' });
      assert.ok(r.venceu, `fase ${n} semente ${s}: o guloso perdeu`);
    }
  }
});

test('sem derrota nos ~3 primeiros minutos: o pior caminho vence as fases 1 a 6', () => {
  for (const s of [SEMENTE, 3, 11]) {
    for (let n = 1; n <= 6; n++) assert.ok(simular(criarFase(n, s), { modo: 'pior' }).venceu, `fase ${n}`);
  }
});

test('nenhuma fase vira muro: o ruidoso vence a maioria em todas e mais de 82% no total', () => {
  let ok = 0;
  let total = 0;
  for (let n = 1; n <= 40; n++) {
    const f = criarFase(n, SEMENTE);
    let v = 0;
    for (let s = 1; s <= 10; s++) if (simular(f, { modo: 'ruidoso', semente: s }).venceu) v++;
    assert.ok(v >= 5, `fase ${n}: o ruidoso venceu ${v}/10`);
    ok += v;
    total += 10;
  }
  assert.ok(ok / total >= 0.82, `ruidoso venceu ${((ok / total) * 100).toFixed(0)}%`);
});

test('choque com o exercito, piso das primeiras fases e reviver', () => {
  const f = criarFase(7, SEMENTE);
  const pequena = { ...f, eventos: [{ id: 0, tipo: 'inimigo', sub: 'sapo', z: 5, qtd: 999, lado: 0 }], chefe: null, semDerrota: false };
  const c = criarCorrida(pequena);
  largar(c);
  for (let i = 0; i < 600 && c.estado !== 'derrota'; i++) passoCorrida(c, 1 / 60, 0);
  assert.equal(c.estado, 'derrota');
  reviver(c, patosDoReviver(c));
  assert.equal(c.estado, 'correndo');
  assert.equal(c.n, 25);
  const segura = { ...pequena, semDerrota: true };
  const c2 = criarCorrida(segura);
  largar(c2);
  for (let i = 0; i < 600 && (c2.estado === 'correndo' || c2.estado === 'choque'); i++) passoCorrida(c2, 1 / 60, 0);
  assert.ok(c2.n >= 5, 'piso nas fases sem derrota');
});

test('escada: degraus multiplicam as moedas e a rainha comeca no x1,5', () => {
  assert.equal(multEscada(0), 1);
  assert.equal(multEscada(3), ESCADA[2]);
  assert.equal(multEscada(1, 2), 1.5);
  const f = criarFase(2, SEMENTE);
  const a = simular(f, { modo: 'guloso' });
  const b = simular(f, { modo: 'guloso', bonus: { ...BONUS_VAZIO, escadaInicio: 2 } });
  assert.ok(b.ganho > a.ganho, 'a rainha rende mais');
  const m = simular(f, { modo: 'guloso', bonus: { ...BONUS_VAZIO, inicioExtra: 30 } });
  assert.ok(m.degraus >= a.degraus, 'mais patos sobem mais degraus');
});

test('meta: melhorias, lendas, bonus e presente do dia', () => {
  const m = metaNova();
  assert.equal(comprar(m, 'patos'), false);
  m.moedas = 1000;
  const p = precoMelhoria('patos', 0);
  assert.ok(comprar(m, 'patos'));
  assert.equal(m.moedas, 1000 - p);
  assert.ok(precoMelhoria('patos', 1) > p);
  assert.equal(bonusDe(m).inicioExtra, 3);
  m.lendas = ['capitao'];
  m.ativa = 'capitao';
  assert.equal(bonusDe(m).inicioExtra, 8);
  assert.equal(lendaDoChefe(5), 0);
  assert.equal(lendaDoChefe(45), 8);
  assert.equal(lendaDoChefe(50), -1);
  assert.equal(faseDaLenda(LENDAS.length - 1), 45);
  // presente: sequencia cresce com dias seguidos, um dia perdido so volta a 1
  const g = metaNova();
  assert.ok(presenteDoDia(g, 100).disponivel);
  const v1 = pegarPresente(g, 100);
  assert.ok(v1 > 0 && !presenteDoDia(g, 100).disponivel);
  assert.equal(presenteDoDia(g, 101).seq, 2);
  pegarPresente(g, 101, 2);
  assert.equal(presenteDoDia(g, 105).seq, 1);
  // save estranho
  const n = normalizarMeta({ fase: '7', moedas: -5, melhorias: { patos: 2 }, lendas: ['capitao', 'xx', 'capitao'], ativa: 'xx' });
  assert.equal(n.fase, 7);
  assert.equal(n.moedas, 0);
  assert.deepEqual(n.lendas, ['capitao']);
  assert.equal(n.ativa, 'capitao');
  assert.deepEqual(normalizarMeta(null), metaNova());
});

test('ritmo da sessao (bot guloso, com festa e largada)', (t) => {
  let s = 0;
  const marcos = {};
  for (let n = 1; n <= 30; n++) {
    s += simular(criarFase(n, SEMENTE), { modo: 'guloso' }).tempo + 2.2 + 1.2;
    if ([5, 10, 20, 30].includes(n)) marcos[n] = (s / 60).toFixed(1);
  }
  t.diagnostic(`minutos ate a fase: 5 -> ${marcos[5]}, 10 -> ${marcos[10]}, 20 -> ${marcos[20]}, 30 -> ${marcos[30]}`);
  assert.ok(Number(marcos[5]) >= 1.6 && Number(marcos[5]) <= 4, 'as fases sem derrota cobrem os primeiros minutos');
});
