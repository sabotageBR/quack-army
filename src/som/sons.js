// Sons do Quack Army, sintetizados (src/som/receitas.js). Contrato de cada receita: (v, t0, p) => duracao
// em s, sem sorteio. Quack de borracha = tom com glide rapido para baixo e filtro de banda (o "squeak").
//
// Regra de limpeza (pedido do usuario, 2026-11-20): acerto, ponto, portao e moeda tocam UM som limpo.
// Nada de camada de ruido junto, nem sequencia rapida de cliques (tique-tique, contagem, catraca):
// as perdas no choque nao tocam um "plop" por pato e a escada toca uma subida continua, nao uma nota por degrau.
import { tom, sopro } from './receitas.js';

/** Quack de pato de borracha. @param {any} v @param {number} t0 @param {number} f @param {number} vol */
function quack(v, t0, f, vol) {
  tom(v, t0, { f: f * 1.35, f2: f, glide: 0.05, vol, ataque: 0.004, queda: 0.09, tipo: 'sawtooth', filtro: { tipo: 'bandpass', f: f * 2.2, q: 4 } });
  return tom(v, t0 + 0.05, { f, f2: f * 0.7, glide: 0.08, vol: vol * 0.8, ataque: 0.006, queda: 0.1, tipo: 'square', filtro: { tipo: 'bandpass', f: f * 2, q: 3 } });
}

export const SONS = {
  /** portao bom: um quack que sobe com o tamanho do ganho (p.k de 0 a 1) */
  portao(v, t0, p) {
    const k = (p && p.k) || 0;
    return quack(v, t0, 520 + k * 380, 0.12) - t0;
  },
  /** portao ruim: quack grave */
  ruim(v, t0) {
    return quack(v, t0, 300, 0.1) - t0;
  },
  /** obstaculo: um "plop" so (uma vez por obstaculo, nunca em sequencia) */
  plop(v, t0, p) {
    const k = (p && p.k) || 0;
    return tom(v, t0, { f: 700 - k * 200, f2: 260, vol: 0.08, ataque: 0.002, queda: 0.08, tipo: 'sine' }) - t0;
  },
  /** choque com o exercito: baque abafado */
  choque(v, t0) {
    return tom(v, t0, { f: 150, f2: 70, vol: 0.15, ataque: 0.004, queda: 0.24, tipo: 'triangle' }) - t0;
  },
  /** moeda: um "plim" senoidal (o jogo toca no maximo um por fileira de moedas) */
  moeda(v, t0) {
    return tom(v, t0, { f: 1320, f2: 1760, glide: 0.05, vol: 0.06, ataque: 0.003, queda: 0.2, tipo: 'sine' }) - t0;
  },
  /** gaiola aberta: um quack alegre */
  gaiola(v, t0) {
    return quack(v, t0, 820, 0.1) - t0;
  },
  /** subida da escada: um tom continuo que sobe durante `p.dur` segundos */
  subida(v, t0, p) {
    const dur = Math.max(0.3, (p && p.dur) || 1);
    return tom(v, t0, { f: 420, f2: 1050, glide: dur, vol: 0.06, ataque: 0.04, segurar: dur, queda: 0.12, tipo: 'triangle' }) - t0;
  },
  /** o lider bateu no castelo: acorde de festa (notas juntas, nao em sequencia) e um quack */
  vitoria(v, t0) {
    let fim = t0;
    for (const f of [523, 659, 784]) fim = tom(v, t0 + 0.05, { f, vol: 0.06, ataque: 0.01, queda: 0.6, tipo: 'triangle' });
    quack(v, t0, 760, 0.1);
    return fim - t0;
  },
  derrota(v, t0) {
    let fim = t0;
    [392, 330, 262].forEach((f, i) => { fim = tom(v, t0 + i * 0.16, { f, f2: f * 0.94, vol: 0.09, ataque: 0.01, queda: 0.3, tipo: 'triangle' }); });
    return fim - t0;
  },
  chefe(v, t0) {
    return tom(v, t0, { f: 110, f2: 80, vol: 0.13, ataque: 0.03, queda: 0.6, tipo: 'sawtooth', filtro: { tipo: 'lowpass', f: 600 } }) - t0;
  },
  /** castelo desabando: um rumor grave so */
  castelo(v, t0) {
    sopro(v, t0, { f: 260, f2: 90, q: 0.6, vol: 0.12, ataque: 0.01, queda: 0.55 });
    return tom(v, t0, { f: 160, f2: 55, vol: 0.12, ataque: 0.006, queda: 0.5, tipo: 'triangle' }) - t0;
  },
  compra(v, t0) {
    return tom(v, t0, { f: 784, f2: 1175, glide: 0.08, vol: 0.08, ataque: 0.003, queda: 0.22, tipo: 'triangle' }) - t0;
  },
  nao(v, t0) {
    return tom(v, t0, { f: 220, f2: 180, vol: 0.06, ataque: 0.004, queda: 0.12, tipo: 'square', filtro: { tipo: 'lowpass', f: 1200 } }) - t0;
  },
  escudo(v, t0) {
    return tom(v, t0, { f: 1200, f2: 2400, vol: 0.07, ataque: 0.003, queda: 0.25, tipo: 'sine' }) - t0;
  },
};
