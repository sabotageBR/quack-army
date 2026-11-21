// Gerador de fases, puro e deterministico: a mesma (fase, semente) sempre da a mesma pista.
// Curva de dificuldade: pista mais longa, inimigos mais fortes em relacao ao bando, portoes ruins mais
// tentadores. Cada fase sai provada: o bot guloso (bot.js) precisa vencer, senao o gerador tenta outra
// sub-semente. As fases 1 a 6 nao tem derrota (piso de patos na corrida) e o chefe da fase 5 e menor
// que o bando do pior caminho.
import { criarRng, hashTexto } from '../core/rng.js';
import { MEIA_PISTA, FASES_SEM_DERROTA, FORCA, redondo, aplicarOp } from './regras.js';
import { simular } from './bot.js';

export const MUNDOS = Object.freeze(['banheira', 'piscina', 'lago', 'chuveiro']);
export const CHEFES = Object.freeze(['reisapo', 'tubarao', 'polvo', 'imperador']);

/** Mundo da fase n (5 fases por mundo, depois gira). @param {number} n */
export const mundoDaFase = (n) => Math.floor((n - 1) / 5) % MUNDOS.length;
/** @param {number} n */
export const ehChefe = (n) => n % 5 === 0;

/** O que ja apareceu ate a fase n (novidade a cada ~2 min). @param {number} n */
export function liberado(n) {
  return {
    sabonete: n >= 2, menos: n >= 3, sapo: n >= 3, div: n >= 4, moedas: n >= 4, tubarao: n >= 6, escova: n >= 6,
    meiaLado: n >= 7, desliza: n >= 8, polvo: n >= 11, ralo: n >= 11, gaiola: n >= 13, pisca: n >= 16,
  };
}

/** Novidade que a fase n estreia (para o cartaz da largada). */
export const NOVIDADES = Object.freeze({
  2: 'sabonete', 3: 'sapo', 4: 'divisao', 5: 'chefe', 6: 'tubarao', 8: 'desliza', 11: 'polvo', 13: 'gaiola', 16: 'pisca',
});

/**
 * @typedef {{ x0: number, x1: number, op: '+'|'-'|'x'|'/', v: number, op2?: string, v2?: number, periodo?: number,
 *   amp?: number, omega?: number, fase?: number }} Porta
 * @typedef {{
 *   n: number, semente: number, mundo: number, chefe: null | { tipo: string, vida: number },
 *   comprimento: number, velocidade: number, inicio: number, eventos: any[], patosPorDegrau: number,
 *   moedasBase: number, semDerrota: boolean, novidade: string | null
 * }} Fase
 */

/** @template T @param {() => number} r @param {T[]} a @returns {T} */
const sortear = (r, a) => a[Math.floor(r() * a.length) % a.length];

/** @param {number} n */
const tetoBando = (n) => Math.min(700, 60 + n * 12);

/**
 * Uma fase completa e provada.
 * @param {number} n fase (1..)
 * @param {number} semente
 * @returns {Fase}
 */
export function criarFase(n, semente) {
  /** @type {Fase|null} */
  let ultima = null;
  for (let tentativa = 0; tentativa < 24; tentativa++) {
    const f = calibrar(esbocar(n, semente, tentativa));
    if (f) return f;
    ultima = esbocar(n, semente, tentativa);
  }
  // reserva (nunca visto nos testes): a ultima tentativa sem inimigos
  const f = /** @type {Fase} */ (ultima);
  f.eventos = f.eventos.filter((e) => e.tipo !== 'inimigo');
  return /** @type {Fase} */ (calibrar(f) || f);
}

/**
 * Chefe, degraus da escada e prova pelos bots. Devolve null se o bot guloso perde. Depois facilita os
 * inimigos e o chefe ate o bot ruidoso (erra 30% das decisoes) vencer a meta de vezes: nenhuma fase
 * pode virar muro (regra do cofre: conclusao acima de ~82%).
 * @param {Fase} f
 * @returns {Fase|null}
 */
function calibrar(f) {
  const chefe = f.chefe;
  let fatorChefe = 1;
  const meta = f.novidade || f.n < 12 ? 8 : f.n < 20 ? 7 : 6;
  for (let ajuste = 0; ajuste < 10; ajuste++) {
    f.chefe = null;
    f.patosPorDegrau = 1e9; // so medir o bando no fim da pista
    const g = simular(f, { modo: 'guloso' });
    if (!g.venceu || g.n < 4) return null;
    let sobra = g.n;
    if (chefe) {
      const frac = (0.45 + Math.min(0.2, f.n * 0.004)) * fatorChefe;
      let vida = Math.round(g.n * frac);
      if (f.semDerrota) {
        const w = simular(f, { modo: 'pior' });
        vida = Math.min(vida, Math.max(3, w.n - 2));
      }
      vida = Math.max(3, Math.min(vida, g.n - 3));
      chefe.vida = vida;
      sobra = g.n - vida;
    }
    f.chefe = chefe;
    f.patosPorDegrau = Math.max(1, Math.round(sobra / 7.5));
    if (!simular(f, { modo: 'guloso' }).venceu) return null;
    if (f.semDerrota) return f;
    let ok = 0;
    for (let s = 1; s <= 8; s++) if (simular(f, { modo: 'ruidoso', semente: s }).venceu) ok++;
    if (ok >= meta) return f;
    for (const ev of f.eventos) {
      if (ev.tipo === 'inimigo') ev.qtd = Math.max(1, Math.round(ev.qtd * 0.8));
      if (ev.tipo !== 'portoes') continue;
      for (const p of ev.portas) {
        if (p.op === '-') p.v = Math.max(2, redondo(p.v * 0.75));
        if (p.op2 === '-') p.v2 = Math.max(2, redondo(/** @type {number} */ (p.v2) * 0.75));
        if (p.op === '/' && p.v > 2) p.v = 2;
      }
    }
    fatorChefe *= 0.85;
  }
  return f;
}

/**
 * Pista crua (sem chefe calibrado nem degraus).
 * @param {number} n @param {number} semente @param {number} tentativa
 * @returns {Fase}
 */
function esbocar(n, semente, tentativa) {
  const r = criarRng(hashTexto(`quack:${semente}:${n}:${tentativa}`));
  const lib = liberado(n);
  const mundo = mundoDaFase(n);
  const semDerrota = n <= FASES_SEM_DERROTA;
  const velocidade = 9 + Math.min(3, (n - 1) * 0.06);
  const comprimento = n === 1 ? 120 : Math.round(150 + Math.min(150, n * 5));
  const inicio = n === 1 ? 6 : 8 + Math.floor(Math.min(n, 30) / 3);
  /** @type {any[]} */
  const eventos = [];
  const add = (/** @type {any} */ ev) => { ev.id = eventos.length; eventos.push(ev); };
  const L = MEIA_PISTA;

  if (n === 1) {
    // roteiro da primeira fase: o x5 explode o bando em ~3 s (o "uau"), so contas boas
    add({ tipo: 'portoes', z: 30, portas: [{ x0: -L, x1: 0, op: '+', v: 2 }, { x0: 0, x1: L, op: 'x', v: 5 }] });
    add({ tipo: 'portoes', z: 60, portas: [{ x0: -L, x1: 0, op: '+', v: 10 }, { x0: 0, x1: L, op: 'x', v: 2 }] });
    add({ tipo: 'portoes', z: 92, portas: [{ x0: -L, x1: 0, op: 'x', v: 3 }, { x0: 0, x1: L, op: '+', v: 20 }] });
  } else {
    let g = inicio;
    let w = inicio;
    const teto = tetoBando(n);
    const forcados = forcadosDaFase(n);
    let z = 24 + r() * 4;
    let ultimo = '';
    let k = 0;
    while (z < comprimento - 16) {
      let tipo = k === 0 ? 'portoes' : '';
      let sub = '';
      if (!tipo && forcados.length && k >= 1) [tipo, sub] = /** @type {string[]} */ (forcados.shift());
      if (!tipo) tipo = sortearTipo(r, lib, ultimo);
      let passo = 18;
      if (tipo === 'portoes') {
        const p = portoes(r, lib, g, w, n, teto, sub);
        add({ tipo, z, portas: p.portas, sub: p.sub });
        g = p.g;
        w = p.w;
        passo = 17 + r() * 5;
      } else if (tipo === 'obstaculo') {
        add(obstaculo(r, lib, n, mundo, z, sub));
        g = Math.round(g * 0.93);
        w = Math.max(semDerrota ? 5 : 0, Math.round(w * 0.65));
        passo = 14 + r() * 4;
      } else if (tipo === 'inimigo') {
        const ev = inimigo(r, lib, n, mundo, z, g, w, semDerrota, sub);
        add(ev);
        const total = ev.qtd * FORCA[ev.sub];
        if (!ev.lado) g -= total;
        w = Math.max(semDerrota ? 5 : 0, w - total);
        passo = 19 + r() * 4;
      } else if (tipo === 'moedas') {
        const x = sortear(r, [-2.4, 0, 2.4]);
        const qtd = 5 + Math.floor(r() * 4);
        for (let i = 0; i < qtd; i++) add({ tipo: 'moeda', z: z + i * 1.3, x });
        passo = qtd * 1.3 + 8 + r() * 3;
      } else if (tipo === 'gaiola') {
        const qtd = Math.max(5, redondo(g * (0.2 + r() * 0.15)));
        add({ tipo: 'gaiola', z, x: (r() < 0.5 ? -1 : 1) * (L - 0.9), qtd });
        g += qtd;
        passo = 13 + r() * 3;
      }
      ultimo = tipo;
      k++;
      z += passo;
    }
  }
  const chefe = ehChefe(n) ? { tipo: CHEFES[mundo], vida: 1 } : null;
  return {
    n, semente, mundo, chefe, comprimento, velocidade, inicio, eventos, patosPorDegrau: 1,
    moedasBase: 12 + 3 * Math.min(n, 60), semDerrota, novidade: /** @type {any} */ (NOVIDADES)[n] || null,
  };
}

/** Eventos que a fase precisa mostrar (a novidade dela), na ordem. @param {number} n @returns {string[][]} */
function forcadosDaFase(n) {
  /** @type {Record<number, string[][]>} */
  const tabela = {
    2: [['obstaculo', 'sabonete']],
    3: [['portoes', 'menos'], ['inimigo', 'sapo']],
    4: [['moedas', ''], ['portoes', 'div']],
    6: [['inimigo', 'tubarao'], ['obstaculo', 'escova']],
    8: [['portoes', 'desliza']],
    11: [['inimigo', 'polvo'], ['obstaculo', 'ralo']],
    13: [['gaiola', '']],
    16: [['portoes', 'pisca']],
  };
  return (tabela[n] || []).map((x) => [...x]);
}

/** @param {() => number} r @param {ReturnType<typeof liberado>} lib @param {string} ultimo */
function sortearTipo(r, lib, ultimo) {
  /** @type {[string, number][]} */
  const pesos = [['portoes', 4.5]];
  if (lib.sabonete && ultimo !== 'obstaculo') pesos.push(['obstaculo', 2.4]);
  if (lib.sapo && ultimo !== 'inimigo') pesos.push(['inimigo', 2.2]);
  if (lib.moedas && ultimo !== 'moedas') pesos.push(['moedas', 1]);
  if (lib.gaiola && ultimo !== 'gaiola') pesos.push(['gaiola', 0.7]);
  const total = pesos.reduce((s, p) => s + p[1], 0);
  let x = r() * total;
  for (const [t, p] of pesos) if ((x -= p) <= 0) return t;
  return 'portoes';
}

/**
 * Um par de portoes (ou um deslizante, ou um piscante).
 * @param {() => number} r @param {ReturnType<typeof liberado>} lib @param {number} g @param {number} w
 * @param {number} n @param {number} teto @param {string} sub
 */
function portoes(r, lib, g, w, n, teto, sub) {
  const L = MEIA_PISTA;
  const mults = g > teto ? [2] : g > teto * 0.5 ? [2, 2, 3] : [2, 3, 3, 4];
  const aplicar = (/** @type {number} */ v, /** @type {any} */ p) => aplicarOp(v, p.op, p.v);
  if (sub === 'desliza' || (!sub && lib.desliza && r() < 0.25)) {
    const ruim = lib.menos && r() < 0.35;
    const p = ruim ? { op: '-', v: redondo(Math.max(4, g * 0.4)) } : (r() < 0.5 ? { op: 'x', v: 2 } : { op: '+', v: redondo(Math.max(5, g * 0.6)) });
    const porta = { x0: -1.3, x1: 1.3, ...p, amp: L - 1.5, omega: 1.1 + r() * 0.6, fase: r() * 6.283 };
    return { portas: [porta], sub: 'desliza', g, w: ruim ? aplicar(w, p) : w };
  }
  if (sub === 'pisca' || (!sub && lib.pisca && r() < 0.3)) {
    const ruimV = redondo(Math.max(4, g * 0.4));
    const a = { op: 'x', v: 2, op2: '-', v2: ruimV, periodo: 1 + r() * 0.4 };
    const b = { op: '+', v: redondo(Math.max(5, g * 0.5)) };
    const lados = r() < 0.5 ? [a, b] : [b, a];
    return {
      portas: [{ x0: -L, x1: 0, ...lados[0] }, { x0: 0, x1: L, ...lados[1] }], sub: 'pisca',
      g: Math.max(g * 2, aplicar(g, b)), w: Math.min(aplicarOp(w, '-', ruimV), aplicar(w, b)),
    };
  }
  const ruim = sub === 'menos' || sub === 'div' || (lib.menos && r() < 0.35 + Math.min(0.2, n * 0.01));
  let a;
  let b;
  if (!ruim) {
    const m = sortear(r, mults);
    a = { op: 'x', v: m };
    b = { op: '+', v: redondo(Math.max(3, g * (m - 1) * (0.55 + r() * 0.9))) };
    if (g > teto) {
      a = { op: '+', v: redondo(g * 0.25 + 5) };
      b = { op: '+', v: redondo(g * 0.12 + 3) };
    }
  } else {
    a = r() < 0.5 ? { op: '+', v: redondo(Math.max(4, g * (0.3 + r() * 0.5))) } : { op: 'x', v: sortear(r, mults) };
    const div = sub === 'div' || (sub !== 'menos' && lib.div && r() < 0.4);
    b = div ? { op: '/', v: r() < 0.6 ? 2 : 3 } : { op: '-', v: redondo(Math.max(3, g * (0.3 + r() * 0.35))) };
  }
  const lados = r() < 0.5 ? [a, b] : [b, a];
  return {
    portas: [{ x0: -L, x1: 0, ...lados[0] }, { x0: 0, x1: L, ...lados[1] }], sub: ruim ? 'ruim' : 'bom',
    g: Math.max(aplicar(g, a), aplicar(g, b)), w: Math.min(aplicar(w, a), aplicar(w, b)),
  };
}

/**
 * @param {() => number} r @param {ReturnType<typeof liberado>} lib @param {number} n @param {number} mundo
 * @param {number} z @param {string} sub
 */
function obstaculo(r, lib, n, mundo, z, sub) {
  if (!sub) {
    /** @type {string[]} */
    const opcoes = ['sabonete'];
    if (lib.escova) opcoes.push('escova', mundo === 1 ? 'escova' : 'sabonete');
    if (lib.ralo) opcoes.push('ralo', mundo === 2 ? 'ralo' : 'escova');
    sub = sortear(r, opcoes);
  }
  /** @type {any[]} */
  let faixas;
  if (sub === 'sabonete') {
    faixas = [{ x: (r() - 0.5) * 1.5, w: 0.75, amp: 1.6 + r() * 1.4, omega: 1.3 + r() * 1.1, fase: r() * 6.283 }];
    if (n >= 12 && r() < 0.4) faixas.push({ x: -faixas[0].x, w: 0.75, amp: faixas[0].amp, omega: faixas[0].omega, fase: faixas[0].fase + Math.PI });
  } else {
    const pos = [-2.6, 0, 2.6];
    const qtd = n >= 9 && r() < 0.55 ? 2 : 1;
    const escolhidos = [];
    while (escolhidos.length < qtd) {
      const p = sortear(r, pos);
      if (!escolhidos.includes(p)) escolhidos.push(p);
    }
    faixas = escolhidos.map((x) => ({ x, w: sub === 'escova' ? 1.15 : 1 + r() * 0.4 }));
  }
  return { tipo: 'obstaculo', z, sub, faixas };
}

/**
 * @param {() => number} r @param {ReturnType<typeof liberado>} lib @param {number} n @param {number} mundo
 * @param {number} z @param {number} g @param {number} w @param {boolean} semDerrota @param {string} sub
 */
function inimigo(r, lib, n, mundo, z, g, w, semDerrota, sub) {
  if (!sub) {
    /** @type {string[]} */
    let opcoes = ['sapo'];
    if (mundo === 1) opcoes = lib.tubarao ? ['tubarao', 'tubarao', 'sapo'] : ['sapo'];
    else if (mundo === 2) opcoes = lib.polvo ? ['polvo', 'polvo', 'tubarao', 'sapo'] : ['tubarao', 'sapo'];
    else if (mundo === 3) opcoes = ['sapo', 'tubarao', 'polvo'];
    else if (lib.tubarao) opcoes = ['sapo', 'sapo', 'tubarao'];
    sub = sortear(r, opcoes);
  }
  const forca = FORCA[/** @type {keyof typeof FORCA} */ (sub)];
  const lado = lib.meiaLado && r() < 0.3 ? (r() < 0.5 ? -1 : 1) : 0;
  let frac = lado ? 0.6 + r() * 0.4 : 0.22 + Math.min(0.33, n * 0.011) + r() * 0.12;
  if (semDerrota) frac = Math.min(frac, (w * 0.8) / Math.max(1, g));
  frac = Math.min(frac, (g - 3) / Math.max(1, g));
  const total = Math.max(forca, Math.round(g * Math.max(0.05, frac)));
  const qtd = Math.max(1, Math.round(total / forca));
  return { tipo: 'inimigo', z, sub, qtd, lado };
}
