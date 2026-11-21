// Simulacao pura de uma corrida: o bando anda sozinho em z, o jogador (ou o bot) so escolhe o x alvo.
// O mesmo codigo roda no jogo (passo fixo de 1/60 s do laco) e nos testes (bot). Cada passo devolve a
// lista do que aconteceu (portao, perda, choque, moeda...) para o desenho e o som.
import {
  ESCADA, FORCA, DANO, PISO_SEM_DERROTA, VEL_LATERAL, MAX_BANDO, raioBando, limiteX, limitar, aplicarOp,
  fracaoNaFaixa, perdaObstaculo, centroFaixa, valorPortao, faixaPortao,
} from './regras.js';
import { BONUS_VAZIO } from './meta.js';

/** Tempo de cada degrau da escada (s). */
export const T_DEGRAU = 0.24;

/**
 * @typedef {import('./fase.js').Fase} Fase
 * @typedef {import('./meta.js').Bonus} Bonus
 * @typedef {'largada'|'correndo'|'choque'|'escada'|'vitoria'|'derrota'} EstadoCorrida
 * @typedef {{ tipo: string, [k: string]: any }} Acontecimento
 */

/**
 * @param {Fase} fase
 * @param {Bonus} [bonus]
 */
export function criarCorrida(fase, bonus = BONUS_VAZIO) {
  return {
    fase,
    bonus,
    n: Math.min(MAX_BANDO, fase.inicio + bonus.inicioExtra),
    x: 0,
    z: 0,
    t: 0,
    /** @type {EstadoCorrida} */
    estado: 'largada',
    /** indice do proximo evento da pista */
    i: 0,
    moedas: 0,
    escudo: bonus.escudo,
    primeiroX: bonus.primeiroX,
    /** @type {null | { tipo: 'inimigo'|'chefe', ev: any, n0: number, nFim: number, total: number, dur: number, t: number }} */
    choque: null,
    /** vida que sobra do chefe (para reviver e para o desenho) */
    vidaChefe: fase.chefe ? fase.chefe.vida : 0,
    /** @type {null | { k: number, degraus: number, t: number }} */
    escada: null,
    mult: 1,
    ganho: 0,
    perdidos: 0,
    /** inimigos derrotados (ev.id -> true) para o desenho */
    vencidos: /** @type {Record<number, boolean>} */ ({}),
  };
}

/** @typedef {ReturnType<typeof criarCorrida>} Corrida */

/** Comeca a corrida (primeiro arrasto). @param {Corrida} c */
export function largar(c) {
  if (c.estado === 'largada') c.estado = 'correndo';
}

/** Piso das fases sem derrota. @param {Corrida} c @param {number} n */
function piso(c, n) {
  return c.fase.semDerrota ? Math.max(PISO_SEM_DERROTA, n) : n;
}

/**
 * Um passo da simulacao.
 * @param {Corrida} c
 * @param {number} dt
 * @param {number} alvoX x desejado (sera limitado a pista)
 * @returns {Acontecimento[]}
 */
export function passoCorrida(c, dt, alvoX) {
  /** @type {Acontecimento[]} */
  const ac = [];
  if (c.estado === 'correndo') correr(c, dt, alvoX, ac);
  else if (c.estado === 'choque') chocar(c, dt, ac);
  else if (c.estado === 'escada') subir(c, dt, ac);
  return ac;
}

/** @param {Corrida} c @param {number} dt @param {number} alvoX @param {Acontecimento[]} ac */
function correr(c, dt, alvoX, ac) {
  const f = c.fase;
  c.t += dt;
  const lim = limiteX(c.n);
  const alvo = limitar(alvoX, -lim, lim);
  const passoX = VEL_LATERAL * dt;
  c.x = limitar(c.x + limitar(alvo - c.x, -passoX, passoX), -lim, lim);
  c.z += f.velocidade * dt;
  while (c.i < f.eventos.length && f.eventos[c.i].z <= c.z) {
    const ev = f.eventos[c.i++];
    cruzar(c, ev, ac);
    if (c.estado !== 'correndo') return;
  }
  if (c.z >= f.comprimento) {
    c.z = f.comprimento;
    if (f.chefe && c.vidaChefe > 0) iniciarChoque(c, 'chefe', null, c.vidaChefe, ac);
    else iniciarEscada(c, ac);
  }
}

/** @param {Corrida} c @param {any} ev @param {Acontecimento[]} ac */
function cruzar(c, ev, ac) {
  const b = c.bonus;
  const r = raioBando(c.n);
  if (ev.tipo === 'portoes') {
    for (const p of ev.portas) {
      const [x0, x1] = faixaPortao(p, c.t);
      if (c.x < x0 || c.x >= x1) continue;
      const { op, v } = valorPortao(p, c.t);
      const antes = c.n;
      let depois;
      if (op === '+') depois = aplicarOp(c.n, '+', v + b.mais);
      else if (op === 'x') {
        const extra = c.primeiroX;
        c.primeiroX = 0;
        depois = Math.round(aplicarOp(c.n, 'x', v + extra) * (1 + b.multPct));
      } else depois = aplicarOp(c.n, op, v);
      c.n = piso(c, Math.min(MAX_BANDO, depois));
      ac.push({ tipo: 'portao', ev, porta: p, op, v, antes, depois: c.n });
      if (c.n <= 0) derrota(c, ac);
      return;
    }
    ac.push({ tipo: 'portao-vazio', ev });
    return;
  }
  if (ev.tipo === 'obstaculo') {
    let frac = 0;
    for (const fx of ev.faixas) {
      const cx = centroFaixa(fx, c.t);
      frac += fracaoNaFaixa(c.x, r, cx - fx.w, cx + fx.w);
    }
    if (frac <= 0.004) return;
    let dano = (DANO[ev.sub] || 0.6) * (1 - b.obstaculoRed);
    if (ev.sub === 'ralo' && b.imuneRalo) dano = 0;
    if (c.escudo && dano > 0) {
      c.escudo = false;
      ac.push({ tipo: 'escudo', ev });
      return;
    }
    const perda = perdaObstaculo(c.n, frac, dano);
    if (perda <= 0) return;
    const antes = c.n;
    c.n = piso(c, c.n - perda);
    c.perdidos += antes - c.n;
    ac.push({ tipo: 'obstaculo', ev, antes, depois: c.n, frac: Math.min(1, frac) });
    if (c.n <= 0) derrota(c, ac);
    return;
  }
  if (ev.tipo === 'inimigo') {
    const lado = c.x < 0 ? -1 : 1;
    if (ev.lado && ev.lado !== lado) {
      ac.push({ tipo: 'desviou', ev });
      return;
    }
    const total = Math.max(1, Math.round(ev.qtd * (FORCA[ev.sub] || 1) * (1 - b.inimigoRed)));
    iniciarChoque(c, 'inimigo', ev, total, ac);
    return;
  }
  if (ev.tipo === 'moeda') {
    if (Math.abs(c.x - ev.x) <= r + 0.35) {
      c.moedas++;
      ac.push({ tipo: 'moeda', ev });
    }
    return;
  }
  if (ev.tipo === 'gaiola') {
    if (Math.abs(c.x - ev.x) <= r + 0.3) {
      const antes = c.n;
      c.n = Math.min(MAX_BANDO, c.n + ev.qtd);
      ac.push({ tipo: 'gaiola', ev, antes, depois: c.n });
    }
  }
}

/**
 * @param {Corrida} c @param {'inimigo'|'chefe'} tipo @param {any} ev @param {number} total
 * @param {Acontecimento[]} ac
 */
function iniciarChoque(c, tipo, ev, total, ac) {
  const nFim = piso(c, c.n - total);
  c.choque = { tipo, ev, n0: c.n, nFim, total, dur: limitar(0.45 + Math.min(c.n, total) / 90, 0.55, 1.7), t: 0 };
  c.estado = 'choque';
  ac.push({ tipo: 'choque', choque: c.choque });
}

/** @param {Corrida} c @param {number} dt @param {Acontecimento[]} ac */
function chocar(c, dt, ac) {
  const k = /** @type {NonNullable<Corrida['choque']>} */ (c.choque);
  k.t += dt;
  const p = Math.min(1, k.t / k.dur);
  const antes = c.n;
  c.n = Math.round(k.n0 - (k.n0 - Math.max(0, k.nFim)) * p);
  if (c.n < antes) ac.push({ tipo: 'baixa', qtd: antes - c.n, choque: k });
  if (k.tipo === 'chefe') c.vidaChefe = Math.max(0, Math.round(k.total - (k.n0 - c.n)));
  if (p < 1) return;
  c.n = Math.max(0, k.nFim);
  c.perdidos += k.n0 - c.n;
  c.choque = null;
  if (k.tipo === 'inimigo') {
    c.vencidos[k.ev.id] = true;
    if (c.n <= 0) {
      derrota(c, ac);
      return;
    }
    ac.push({ tipo: 'venceu-inimigo', ev: k.ev });
    c.estado = 'correndo';
    return;
  }
  // chefe
  if (k.nFim <= 0) {
    c.vidaChefe = Math.max(1, k.total - k.n0);
    derrota(c, ac);
    return;
  }
  c.vidaChefe = 0;
  ac.push({ tipo: 'venceu-chefe' });
  iniciarEscada(c, ac);
}

/** @param {Corrida} c @param {Acontecimento[]} ac */
function iniciarEscada(c, ac) {
  c.estado = 'escada';
  c.escada = { k: c.fase.patosPorDegrau, degraus: 0, t: 0 };
  ac.push({ tipo: 'escada' });
}

/** @param {Corrida} c @param {number} dt @param {Acontecimento[]} ac */
function subir(c, dt, ac) {
  const e = /** @type {NonNullable<Corrida['escada']>} */ (c.escada);
  e.t += dt;
  const maxDegraus = ESCADA.length - c.bonus.escadaInicio;
  while (e.t >= T_DEGRAU) {
    e.t -= T_DEGRAU;
    if (c.n >= e.k && e.degraus < maxDegraus) {
      c.n -= e.k;
      e.degraus++;
      ac.push({ tipo: 'degrau', degrau: e.degraus, indice: c.bonus.escadaInicio + e.degraus - 1 });
    } else {
      vitoria(c, ac);
      return;
    }
  }
}

/** Multiplicador da escada para `degraus` subidos. @param {number} degraus @param {number} inicio */
export function multEscada(degraus, inicio = 0) {
  return ESCADA[Math.min(ESCADA.length - 1, inicio + Math.max(0, degraus - 1))];
}

/** @param {Corrida} c @param {Acontecimento[]} ac */
function vitoria(c, ac) {
  const e = /** @type {NonNullable<Corrida['escada']>} */ (c.escada);
  c.mult = multEscada(e.degraus, c.bonus.escadaInicio);
  c.ganho = Math.round((Math.round(c.fase.moedasBase * c.mult) + c.moedas) * (1 + c.bonus.moedaPct));
  c.estado = 'vitoria';
  ac.push({ tipo: 'vitoria', ganho: c.ganho, mult: c.mult, degraus: e.degraus });
}

/** @param {Corrida} c @param {Acontecimento[]} ac */
function derrota(c, ac) {
  c.n = 0;
  c.estado = 'derrota';
  ac.push({ tipo: 'derrota' });
}

/**
 * Reviver (video premiado): o bando volta com `qtd` patos de onde parou; no chefe, o choque recomeca
 * com a vida que sobrou.
 * @param {Corrida} c @param {number} qtd
 */
export function reviver(c, qtd) {
  if (c.estado !== 'derrota') return;
  c.n = Math.max(1, Math.round(qtd));
  // de volta a corrida; no fim da pista, o proximo passo recomeca o choque com o que sobrou do chefe
  c.estado = 'correndo';
}

/**
 * Patos do reviver: 25, ou o bastante para vencer o que sobrou do chefe.
 * @param {Corrida} c
 */
export function patosDoReviver(c) {
  if (c.fase.chefe && c.vidaChefe > 0 && c.z >= c.fase.comprimento) return Math.max(25, Math.ceil(c.vidaChefe * 1.3) + 5);
  return 25;
}

/** Progresso na pista (0..1). @param {Corrida} c */
export const progresso = (c) => Math.min(1, c.z / c.fase.comprimento);
