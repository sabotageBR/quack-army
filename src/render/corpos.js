// Corpos soltos do desenho: patos e brinquedos arremessados, sabonetes empurrados, escovas tombando,
// pedacos do castelo e da gaiola. Balistica simples com gravidade, quique com perda, atrito no chao,
// rodopio que assenta deitado ou em pe, respingo ao cair na agua e "puf" quando param. Coordenadas da
// simulacao (z para a frente). Sem DOM nem three.js: o desenho le a lista e posiciona as malhas.

/** Gravidade (u/s^2): um pouco acima da real para parecer brinquedo leve e rapido. */
export const GRAVIDADE = 18;

/**
 * @typedef {{
 *   x: number, y: number, z: number, vx: number, vy: number, vz: number,
 *   a: number, w: number, h: number, l: number,
 *   rest: number, atrito: number, fica: boolean, s: number,
 *   vida: number, max: number, repouso: number, quiques: number,
 *   sugar: null | { x: number, z: number, y0: number, r: number, ang: number },
 *   ref: any, morto?: boolean,
 * }} Corpo
 * h e l: altura e largura do desenho (contato com o chao depende do angulo a).
 */

/** @typedef {{ tipo: 'respingo'|'puf'|'quique', x: number, y: number, z: number, forca: number, c: Corpo }} EventoCorpo */

/**
 * @param {number} max
 */
export function criarCorpos(max) {
  /** @type {Corpo[]} */
  let lista = [];

  return {
    get lista() { return lista; },

    /**
     * @param {Partial<Corpo> & { x: number, y: number, z: number }} o
     * @returns {Corpo}
     */
    soltar(o) {
      if (lista.length >= max) {
        // sai o mais velho que nao precisa ficar
        const i = lista.findIndex((c) => !c.fica);
        if (i >= 0) lista[i].morto = true;
        lista = lista.filter((c) => !c.morto);
      }
      /** @type {Corpo} */
      const c = {
        vx: 0, vy: 0, vz: 0, a: 0, w: 0, h: 0.6, l: 0.5, rest: 0.38, atrito: 7, fica: false, s: 1,
        vida: 0, max: 3.5, repouso: 0, quiques: 0, sugar: null, ref: null, ...o,
      };
      lista.push(c);
      return c;
    },

    /** Leva o corpo para o ralo em espiral. @param {Corpo} c @param {number} rx @param {number} rz */
    sugar(c, rx, rz) {
      c.sugar = { x: rx, z: rz, y0: 0, r: Math.hypot(c.x - rx, c.z - rz), ang: Math.atan2(c.z - rz, c.x - rx) };
      c.max = 0.75;
    },

    limpar() { lista = []; },

    /**
     * @param {number} dt
     * @param {(x: number, z: number) => { y: number, agua: boolean }} chao
     * @returns {EventoCorpo[]}
     */
    passo(dt, chao) {
      /** @type {EventoCorpo[]} */
      const ev = [];
      if (dt <= 0) return ev;
      for (const c of lista) {
        c.vida += dt;
        if (c.sugar) {
          const s = c.sugar;
          // redemoinho rente ao chao: gira mais rapido perto do centro e afunda no fim
          s.ang += dt * Math.min(16, 3 / Math.max(0.2, s.r));
          s.r = Math.max(0, s.r * Math.exp(-dt * 4.5) - dt * 0.8);
          c.x = s.x + Math.cos(s.ang) * s.r;
          c.z = s.z + Math.sin(s.ang) * s.r;
          c.y += (s.y0 + 0.25 * Math.min(1, s.r / 0.7) - 0.3 * (1 - Math.min(1, s.r / 0.3)) - c.y) * Math.min(1, dt * 14);
          c.a += dt * 9;
          c.s = Math.max(0, 1 - c.vida / c.max);
          if (c.vida >= c.max) c.morto = true;
          continue;
        }
        if (!c.fica && c.vida > c.max) {
          c.morto = true;
          ev.push({ tipo: 'puf', x: c.x, y: c.y, z: c.z, forca: 0, c });
          continue;
        }
        c.vy -= GRAVIDADE * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.z += c.vz * dt;
        c.a += c.w * dt;
        const g = chao(c.x, c.z);
        // meia altura do desenho na vertical, conforme o giro (deitado encosta mais baixo)
        const meia = 0.5 * c.s * (c.h * Math.abs(Math.cos(c.a)) + c.l * Math.abs(Math.sin(c.a)));
        if (c.y - meia <= g.y) {
          if (g.agua) {
            c.morto = true;
            ev.push({ tipo: 'respingo', x: c.x, y: g.y, z: c.z, forca: Math.min(1, Math.abs(c.vy) / 10 + c.h * 0.2), c });
            continue;
          }
          c.y = g.y + meia;
          if (c.vy < -1.6) {
            if (c.quiques < 2 && c.vy < -5) ev.push({ tipo: 'quique', x: c.x, y: g.y, z: c.z, forca: Math.min(1, -c.vy / 12), c });
            c.vy = -c.vy * c.rest;
            c.vx *= 0.72;
            c.vz *= 0.72;
            // o atrito do chao troca parte do giro por rolamento
            c.w = c.w * 0.55 - c.vx * 1.2;
            c.quiques++;
          } else {
            c.vy = 0;
            const at = Math.exp(-c.atrito * dt);
            c.vx *= at;
            c.vz *= at;
            c.w *= Math.exp(-7 * dt);
            // assenta deitado de lado ou em pe, o que estiver mais perto
            const alvo = Math.round(c.a / (Math.PI / 2)) * (Math.PI / 2);
            c.a += (alvo - c.a) * Math.min(1, dt * 9);
            if (Math.abs(c.vx) + Math.abs(c.vz) < 0.4) c.repouso += dt;
          }
        }
        if (!c.fica && c.repouso > 0.5) {
          // parado: encolhe e some num puf
          c.s = Math.max(0, c.s - dt * 5);
          if (c.s <= 0) {
            c.morto = true;
            ev.push({ tipo: 'puf', x: c.x, y: c.y, z: c.z, forca: 0, c });
          }
        }
      }
      if (lista.some((c) => c.morto)) lista = lista.filter((c) => !c.morto);
      return ev;
    },
  };
}
