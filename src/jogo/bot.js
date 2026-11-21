// Bot simples e deterministico: olha o proximo evento de decisao a frente (ate ~3 s), testa varias
// posicoes x que ainda alcanca a tempo e fica com a que deixa o maior bando (guloso), o menor (pior)
// ou erra de proposito em ~30% das decisoes (ruidoso, o "jogador comum" dos testes). O gerador de fases
// usa o guloso para provar que a fase e vencivel; os testes medem o ritmo com ele.
import { VEL_LATERAL, FORCA, DANO, raioBando, limiteX, aplicarOp, fracaoNaFaixa, perdaObstaculo, centroFaixa, valorPortao, faixaPortao } from './regras.js';
import { criarCorrida, largar, passoCorrida } from './corrida.js';
import { BONUS_VAZIO } from './meta.js';

/** @typedef {'guloso'|'pior'|'ruidoso'} ModoBot */

const AMOSTRAS = 17;
const OLHAR_S = 3.2;

/** @param {any} ev */
const decisivo = (ev) => ev.tipo !== 'inimigo' || !!ev.lado;

/**
 * Bando previsto depois do evento `ev` se o centro estiver em x no instante t.
 * @param {import('./corrida.js').Corrida} c @param {any} ev @param {number} x @param {number} t
 */
export function preverEvento(c, ev, x, t) {
  const n = c.n;
  const b = c.bonus;
  const r = raioBando(n);
  if (ev.tipo === 'portoes') {
    for (const p of ev.portas) {
      const [x0, x1] = faixaPortao(p, t);
      if (x < x0 || x >= x1) continue;
      const { op, v } = valorPortao(p, t);
      if (op === '+') return aplicarOp(n, '+', v + b.mais);
      if (op === 'x') return Math.round(aplicarOp(n, 'x', v + c.primeiroX) * (1 + b.multPct));
      return aplicarOp(n, op, v);
    }
    return n;
  }
  if (ev.tipo === 'obstaculo') {
    let frac = 0;
    for (const fx of ev.faixas) {
      const cx = centroFaixa(fx, t);
      frac += fracaoNaFaixa(x, r, cx - fx.w, cx + fx.w);
    }
    if (frac <= 0.004) return n + 0.01; // um pouquinho melhor que encostar
    let dano = (DANO[ev.sub] || 0.6) * (1 - b.obstaculoRed);
    if (ev.sub === 'ralo' && b.imuneRalo) dano = 0;
    if (c.escudo) return n;
    return n - perdaObstaculo(n, frac, dano);
  }
  if (ev.tipo === 'inimigo') {
    const lado = x < 0 ? -1 : 1;
    if (ev.lado && ev.lado !== lado) return n;
    return n - Math.round(ev.qtd * (FORCA[ev.sub] || 1) * (1 - b.inimigoRed));
  }
  if (ev.tipo === 'moeda') return n + (Math.abs(x - ev.x) <= r + 0.35 ? 0.5 : 0);
  if (ev.tipo === 'gaiola') return n + (Math.abs(x - ev.x) <= r + 0.3 ? ev.qtd : 0);
  return n;
}

/** Hash inteiro pequeno e deterministico. @param {number} a @param {number} b */
function misturar(a, b) {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}

/**
 * x alvo do bot para este passo.
 * @param {import('./corrida.js').Corrida} c
 * @param {ModoBot} [modo]
 * @param {number} [semente] so no ruidoso: decide em quais eventos ele erra
 * @returns {{ x: number, ev: any }}
 */
export function alvoBot(c, modo = 'guloso', semente = 1) {
  const f = c.fase;
  const v = f.velocidade;
  const lim = limiteX(c.n);
  for (let j = c.i; j < f.eventos.length; j++) {
    const ev = f.eventos[j];
    if (ev.z - c.z > v * OLHAR_S) break;
    if (!decisivo(ev)) continue;
    const dtChega = Math.max(0, ev.z - c.z) / v;
    const t = c.t + dtChega;
    const alcance = VEL_LATERAL * dtChega + 0.05;
    let pior = modo === 'pior';
    if (modo === 'ruidoso') pior = misturar(ev.id + 1, semente) % 100 < 30;
    let melhorX = c.x;
    let melhorV = pior ? Infinity : -Infinity;
    for (let k = 0; k < AMOSTRAS; k++) {
      const x = -lim + (2 * lim * k) / (AMOSTRAS - 1);
      if (Math.abs(x - c.x) > alcance) continue;
      const val = preverEvento(c, ev, x, t);
      const melhor = pior ? val < melhorV - 1e-6 : val > melhorV + 1e-6;
      const empate = Math.abs(val - melhorV) <= 1e-6 && Math.abs(x - c.x) < Math.abs(melhorX - c.x);
      if (melhor || empate) {
        melhorV = val;
        melhorX = x;
      }
    }
    return { x: melhorX, ev };
  }
  return { x: c.x * 0.98, ev: null };
}

/**
 * Joga uma fase inteira com o bot (passo fixo).
 * @param {import('./fase.js').Fase} fase
 * @param {{ modo?: ModoBot, bonus?: import('./meta.js').Bonus, semente?: number, dt?: number }} [o]
 */
export function simular(fase, o = {}) {
  const dt = o.dt || 1 / 60;
  const c = criarCorrida(fase, o.bonus || BONUS_VAZIO);
  largar(c);
  let choques = 0;
  let passos = 0;
  for (; passos < 60 * 600 && c.estado !== 'vitoria' && c.estado !== 'derrota'; passos++) {
    const { x } = alvoBot(c, o.modo || 'guloso', o.semente || 1);
    for (const a of passoCorrida(c, dt, x)) if (a.tipo === 'choque') choques++;
  }
  const degraus = c.escada ? c.escada.degraus : 0;
  return {
    venceu: c.estado === 'vitoria',
    n: c.n,
    ganho: c.ganho,
    degraus,
    perdidos: c.perdidos,
    choques,
    /** tempo de jogo da fase em s: corrida + choques + escada */
    tempo: passos * dt,
    vidaChefe: c.vidaChefe,
  };
}
