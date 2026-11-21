// Regras puras do Quack Army: medidas da pista, raio do bando, contas dos portoes, perda nos
// obstaculos e a escada do fim. Sem DOM, sem relogio, sem Math.random (test/estilo.test.js).
//
// Eixos da simulacao: x lateral (negativo = esquerda), z para a frente (0 = largada). O desenho
// (src/render) converte para o mundo do three.js.

/** Meia largura da pista (u). */
export const MEIA_PISTA = 4.2;
/** Velocidade lateral maxima do bando (u/s), igual para o jogador e para o bot. */
export const VEL_LATERAL = 11;
/** Raio maximo do disco do bando (u): daqui para cima os patos so ficam mais apertados. */
export const RAIO_MAX = 2.6;
/** Fases sem derrota (os ~3 primeiros minutos) e o piso de patos nelas. */
export const FASES_SEM_DERROTA = 6;
export const PISO_SEM_DERROTA = 5;
/** Multiplicadores dos degraus da escada do castelo. */
export const ESCADA = [1, 1.2, 1.5, 1.8, 2, 2.5, 3, 4, 5, 6];
/** Teto do numero do bando (so para nao estourar o texto). */
export const MAX_BANDO = 99999;

/** Forca de cada inimigo (quantos patos cada um derruba). */
export const FORCA = Object.freeze({ sapo: 1, tubarao: 2, polvo: 3 });
/** Dano dos obstaculos (fracao dos patos que encostam e caem). */
export const DANO = Object.freeze({ sabonete: 0.55, escova: 0.7, ralo: 1 });

/** @param {number} n patos @returns {number} raio do disco do bando */
export function raioBando(n) {
  return n <= 0 ? 0 : Math.min(RAIO_MAX, 0.22 * Math.sqrt(n) + 0.25);
}

/** @param {number} n @returns {number} ate onde o centro do bando vai sem sair da pista */
export function limiteX(n) {
  return Math.max(0, MEIA_PISTA - raioBando(n) - 0.1);
}

/** @param {number} v @param {number} a @param {number} b */
export const limitar = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * Conta de um portao. Divisao arredonda para cima (nunca zera um bando de 1).
 * @param {number} n
 * @param {'+'|'-'|'x'|'/'} op
 * @param {number} v
 */
export function aplicarOp(n, op, v) {
  let r = n;
  if (op === '+') r = n + v;
  else if (op === '-') r = n - v;
  else if (op === 'x') r = n * v;
  else if (op === '/') r = Math.ceil(n / v);
  return limitar(Math.round(r), 0, MAX_BANDO);
}

/** Portao bom (azul) ou ruim (vermelho). @param {string} op */
export const portaoBom = (op) => op === '+' || op === 'x';

/**
 * Fracao da area de um circulo unitario a esquerda da reta x = d (d em -1..1).
 * @param {number} d
 */
function areaEsquerda(d) {
  const c = limitar(d, -1, 1);
  return (Math.PI - Math.acos(c) + c * Math.sqrt(1 - c * c)) / Math.PI;
}

/**
 * Fracao do disco do bando (centro cx, raio r) dentro da faixa [a, b].
 * @param {number} cx @param {number} r @param {number} a @param {number} b
 */
export function fracaoNaFaixa(cx, r, a, b) {
  if (r <= 0 || b <= a) return 0;
  return Math.max(0, areaEsquerda((b - cx) / r) - areaEsquerda((a - cx) / r));
}

/**
 * Patos perdidos quando a fracao `frac` do bando encosta num obstaculo de dano `dano`.
 * @param {number} n @param {number} frac @param {number} dano
 */
export function perdaObstaculo(n, frac, dano) {
  const f = Math.min(1, frac) * dano;
  if (f <= 0.004) return 0;
  const p = n * f;
  return Math.min(n, p < 0.5 ? 1 : Math.round(p));
}

/**
 * Centro de uma faixa que pode deslizar (amp > 0) no instante t.
 * @param {{ x: number, amp?: number, omega?: number, fase?: number }} f
 * @param {number} t
 */
export function centroFaixa(f, t) {
  return f.amp ? f.x + f.amp * Math.sin((f.omega || 1) * t + (f.fase || 0)) : f.x;
}

/**
 * Valor de um portao no instante t (portao piscante alterna entre os dois valores).
 * @param {{ op: string, v: number, op2?: string, v2?: number, periodo?: number }} p
 * @param {number} t
 * @returns {{ op: '+'|'-'|'x'|'/', v: number }}
 */
export function valorPortao(p, t) {
  if (p.op2 && p.periodo) {
    const k = Math.floor(t / p.periodo) % 2;
    if (k === 1) return { op: /** @type {any} */ (p.op2), v: /** @type {number} */ (p.v2) };
  }
  return { op: /** @type {any} */ (p.op), v: p.v };
}

/**
 * Intervalo [x0, x1] de um portao no instante t (o deslizante anda de um lado para o outro).
 * @param {{ x0: number, x1: number, amp?: number, omega?: number, fase?: number }} p
 * @param {number} t
 */
export function faixaPortao(p, t) {
  if (!p.amp) return [p.x0, p.x1];
  const c = (p.x0 + p.x1) / 2 + p.amp * Math.sin((p.omega || 1) * t + (p.fase || 0));
  const w = (p.x1 - p.x0) / 2;
  return [c - w, c + w];
}

/** Numeros redondos para os portoes (5, 10, 15... 50, 60... 250, 300...). @param {number} v */
export function redondo(v) {
  if (v < 1) return 1;
  if (v < 10) return Math.round(v);
  if (v < 50) return Math.round(v / 5) * 5;
  if (v < 200) return Math.round(v / 10) * 10;
  if (v < 1000) return Math.round(v / 50) * 50;
  return Math.round(v / 100) * 100;
}
