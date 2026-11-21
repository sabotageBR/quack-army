// Meta longa, pura: melhorias compradas com moedas, as 9 lendas (herois-pato com passivas), o bonus
// que tudo isso da na corrida e o presente do dia (sem FOMO: perder um dia nao tira nada).

/** Bonus da corrida (melhorias + lenda ativa). */
/**
 * @typedef {{
 *   inicioExtra: number, mais: number, multPct: number, escudo: boolean, imuneRalo: boolean,
 *   obstaculoRed: number, inimigoRed: number, moedaPct: number, escadaInicio: number, primeiroX: number
 * }} Bonus
 */

/** @type {Bonus} */
export const BONUS_VAZIO = Object.freeze({
  inicioExtra: 0, mais: 0, multPct: 0, escudo: false, imuneRalo: false,
  obstaculoRed: 0, inimigoRed: 0, moedaPct: 0, escadaInicio: 0, primeiroX: 0,
});

/** Melhorias da largada. preco(nivel) = base * cresc^nivel. */
export const MELHORIAS = Object.freeze([
  { id: 'patos', base: 40, cresc: 1.45, max: 40 },
  { id: 'bolha', base: 60, cresc: 1.6, max: 25 },
  { id: 'renda', base: 50, cresc: 1.5, max: 40 },
]);

/** @param {string} id @param {number} nivel @returns {number} preco do proximo nivel (Infinity no maximo) */
export function precoMelhoria(id, nivel) {
  const m = MELHORIAS.find((x) => x.id === id);
  if (!m || nivel >= m.max) return Infinity;
  const p = m.base * Math.pow(m.cresc, nivel);
  return p < 100 ? Math.round(p / 5) * 5 : Math.round(p / 10) * 10;
}

/** As 9 lendas, na ordem em que os chefes as entregam (fases 5, 10, 15...). */
export const LENDAS = Object.freeze([
  { id: 'capitao' },
  { id: 'escudo' },
  { id: 'sortudo' },
  { id: 'mergulhador' },
  { id: 'ninja' },
  { id: 'almirante' },
  { id: 'ouro' },
  { id: 'rainha' },
  { id: 'trovao' },
]);

/** Fase do chefe que entrega a lenda de indice i. @param {number} i */
export const faseDaLenda = (i) => (i + 1) * 5;

/**
 * Lenda que o chefe da fase n entrega (indice), ou -1.
 * @param {number} n
 */
export function lendaDoChefe(n) {
  if (n % 5 !== 0) return -1;
  const i = n / 5 - 1;
  return i < LENDAS.length ? i : -1;
}

/**
 * @typedef {{
 *   fase: number, moedas: number, melhorias: Record<string, number>, lendas: string[], ativa: string,
 *   presente: { dia: number, seq: number }
 * }} Meta
 */

/** @returns {Meta} */
export function metaNova() {
  return { fase: 1, moedas: 0, melhorias: { patos: 0, bolha: 0, renda: 0 }, lendas: [], ativa: '', presente: { dia: 0, seq: 0 } };
}

/**
 * Normaliza um save (campos faltando, tipos errados).
 * @param {any} s
 * @returns {Meta}
 */
export function normalizarMeta(s) {
  const m = metaNova();
  if (!s || typeof s !== 'object') return m;
  const num = (v, d, min = 0) => (Number.isFinite(Number(v)) ? Math.max(min, Math.floor(Number(v))) : d);
  m.fase = num(s.fase, 1, 1);
  m.moedas = num(s.moedas, 0);
  for (const k of Object.keys(m.melhorias)) m.melhorias[k] = num(s.melhorias && s.melhorias[k], 0);
  const ids = LENDAS.map((l) => l.id);
  m.lendas = Array.isArray(s.lendas) ? s.lendas.filter((x, i, a) => ids.includes(x) && a.indexOf(x) === i) : [];
  m.ativa = m.lendas.includes(s.ativa) ? s.ativa : m.lendas[0] || '';
  if (s.presente && typeof s.presente === 'object') m.presente = { dia: num(s.presente.dia, 0), seq: num(s.presente.seq, 0) };
  return m;
}

/**
 * Bonus da corrida a partir das melhorias e da lenda ativa.
 * @param {Meta} m
 * @returns {Bonus}
 */
export function bonusDe(m) {
  const b = { ...BONUS_VAZIO };
  b.inicioExtra = 3 * (m.melhorias.patos || 0);
  b.mais = m.melhorias.bolha || 0;
  b.multPct = 0.05 * (m.melhorias.bolha || 0);
  b.moedaPct = 0.1 * (m.melhorias.renda || 0);
  switch (m.ativa) {
    case 'capitao': b.inicioExtra += 5; break;
    case 'escudo': b.escudo = true; break;
    case 'sortudo': b.mais += 2; break;
    case 'mergulhador': b.imuneRalo = true; break;
    case 'ninja': b.obstaculoRed = 0.4; break;
    case 'almirante': b.inimigoRed = 0.15; break;
    case 'ouro': b.moedaPct += 0.3; break;
    case 'rainha': b.escadaInicio = 2; break;
    case 'trovao': b.primeiroX = 1; break;
    default: break;
  }
  return b;
}

/**
 * Compra o proximo nivel de uma melhoria (muda m). @returns {boolean} comprou
 * @param {Meta} m @param {string} id
 */
export function comprar(m, id) {
  const nivel = m.melhorias[id] || 0;
  const p = precoMelhoria(id, nivel);
  if (!Number.isFinite(p) || m.moedas < p) return false;
  m.moedas -= p;
  m.melhorias[id] = nivel + 1;
  return true;
}

/**
 * Presente do dia. `dia` = numero do dia (o main.js calcula do relogio; aqui so a conta).
 * A sequencia so cresce (ate 7) com dias seguidos; um dia perdido volta a sequencia a 1, sem tirar nada.
 * @param {Meta} m @param {number} dia
 * @returns {{ disponivel: boolean, valor: number, seq: number }}
 */
export function presenteDoDia(m, dia) {
  if (m.presente.dia === dia) return { disponivel: false, valor: 0, seq: m.presente.seq };
  const seq = m.presente.dia === dia - 1 ? Math.min(7, m.presente.seq + 1) : 1;
  const valor = 60 + 20 * (seq - 1) + 5 * Math.min(40, m.fase);
  return { disponivel: true, valor, seq };
}

/**
 * Pega o presente (mult = 2 com o video). @returns {number} moedas ganhas
 * @param {Meta} m @param {number} dia @param {number} mult
 */
export function pegarPresente(m, dia, mult = 1) {
  const p = presenteDoDia(m, dia);
  if (!p.disponivel) return 0;
  m.presente = { dia, seq: p.seq };
  const ganho = p.valor * mult;
  m.moedas += ganho;
  return ganho;
}
