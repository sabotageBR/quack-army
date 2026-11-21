// Fisica do bando para o desenho (a simulacao em src/jogo continua mandando no numero e no centro).
// Cada pato e um corpo com velocidade propria: segue o centro com atraso individual (balanco nas
// curvas), e empurrado pelos vizinhos (separacao com grade espacial), fica dentro da elipse do bando,
// bate nas paredes da pista e se espreme no portao escolhido. Sem DOM nem three.js: da para testar.
//
// Coordenadas da simulacao: x para os lados, z para a frente (o three.js usa -z). x e no mundo; dz e
// relativo ao centro do bando, que anda sozinho para a frente.

/** Gravidade dos patos (u/s^2). */
const G = 22;
/** Achatamento da elipse do bando em z (o mesmo do desenho antigo). */
const ACHATA = 0.85;
/** Mola radial (cada pato vai para o raio do seu lugar na fila do centro para a borda), borda e z. */
const KR = 9;
const KB = 60;
/** Fracao da sobreposicao desfeita por quadro (separacao por posicao). */
const REL = 0.45;
const KDZ = 7;
const VMAX = 9;
/** Grade espacial: GW x GW celulas cobrindo +-ALC em volta do centro. */
const GW = 48;
const ALC = 6;

/**
 * @param {number} max patos desenhados no maximo
 */
export function criarBandoFisico(max) {
  const x = new Float32Array(max);
  const dz = new Float32Array(max);
  const y = new Float32Array(max);
  const vx = new Float32Array(max);
  const vz = new Float32Array(max);
  const vy = new Float32Array(max);
  /** rapidez com que cada pato acompanha o centro (atraso individual) */
  const kf = new Float32Array(max);
  /** fase da animacao */
  const fase = new Float32Array(max);
  const cabeca = new Int32Array(GW * GW);
  const prox = new Int32Array(max);
  const celula = new Int32Array(max);
  const ax = new Float32Array(max);
  const az = new Float32Array(max);
  /** raio normalizado de cada pato e a ordem do centro para a borda (o bando enche a elipse por igual) */
  const er = new Float32Array(max);
  const ordem = new Int32Array(max);
  let n = 0;
  let d0 = 0.4;

  /**
   * Novo pato no indice i.
   * @param {number} i @param {number} px @param {number} pdz @param {number} py
   */
  function nascer(i, px, pdz, py) {
    x[i] = px;
    dz[i] = pdz;
    y[i] = py;
    vx[i] = 0;
    vz[i] = 0;
    vy[i] = 0;
    kf[i] = 6 + Math.random() * 12;
    fase[i] = Math.random() * Math.PI * 2;
  }

  /** Copia o pato j para o indice i (remocao por troca com o ultimo). @param {number} i @param {number} j */
  function copiar(i, j) {
    x[i] = x[j];
    dz[i] = dz[j];
    y[i] = y[j];
    vx[i] = vx[j];
    vz[i] = vz[j];
    vy[i] = vy[j];
    kf[i] = kf[j];
    fase[i] = fase[j];
  }

  return {
    get n() { return n; },
    x, dz, y, vx, vz, fase,

    /**
     * Arruma `qtd` patos num disco de raio R em volta de (cx, 0), parados (comeco de fase).
     * @param {number} qtd @param {number} cx @param {number} R @param {number} [cy]
     */
    dispor(qtd, cx, R, cy = 0) {
      n = Math.min(max, Math.max(0, qtd));
      for (let i = 0; i < n; i++) {
        const r = R * Math.sqrt((i + 0.5) / n);
        const a = i * 2.39996323;
        nascer(i, cx + Math.cos(a) * r, Math.sin(a) * r * ACHATA, cy);
      }
    },

    /**
     * Acrescenta patos saindo de um ponto (portao, gaiola, ceu...).
     * @param {number} qtd
     * @param {{ x: number, dz: number, larg?: number, fundo?: number, y?: number, vx?: number, vz?: number }} o
     */
    adicionar(qtd, o) {
      const q = Math.min(qtd, max - n);
      for (let k = 0; k < q; k++) {
        const i = n++;
        nascer(i, o.x + (Math.random() - 0.5) * (o.larg ?? 0.8), o.dz + (Math.random() - 0.5) * (o.fundo ?? 0.5), o.y ?? 0);
        vx[i] = (o.vx ?? 0) + (Math.random() - 0.5) * 2;
        vz[i] = (o.vz ?? 0) + (Math.random() - 0.5) * 1.5;
      }
      return q;
    },

    /**
     * Tira `qtd` patos escolhidos pelo criterio e devolve onde estavam (para virarem corpos soltos).
     * frente: os mais a frente; perto: os mais perto de x (obstaculo); fora: os da borda; tras: os de tras.
     * @param {number} qtd
     * @param {{ tipo: 'frente'|'perto'|'fora'|'tras', x?: number, cx?: number }} crit
     * @returns {{ x: number, y: number, dz: number, vx: number, vz: number }[]}
     */
    remover(qtd, crit) {
      const q = Math.min(qtd, n);
      if (q <= 0) return [];
      const nota = new Float32Array(n);
      const cx = crit.cx ?? 0;
      for (let i = 0; i < n; i++) {
        const ruido = Math.random() * 0.05;
        if (crit.tipo === 'frente') nota[i] = dz[i] + ruido;
        else if (crit.tipo === 'tras') nota[i] = -dz[i] + ruido;
        else if (crit.tipo === 'perto') nota[i] = -Math.abs(x[i] - (crit.x ?? 0)) + ruido;
        else nota[i] = Math.hypot(x[i] - cx, dz[i] / ACHATA) + ruido;
      }
      const ids = Array.from({ length: n }, (_, i) => i).sort((a, b) => nota[b] - nota[a]).slice(0, q).sort((a, b) => b - a);
      const saiu = [];
      for (const i of ids) {
        saiu.push({ x: x[i], y: y[i], dz: dz[i], vx: vx[i], vz: vz[i] });
        n--;
        if (i !== n) copiar(i, n);
      }
      return saiu;
    },

    /**
     * Um passo da fisica.
     * @param {number} dt
     * @param {{
     *   cx: number, vcx: number, cz: number, R: number, meia: number, avanco?: number,
     *   funil?: { z: number, x0: number, x1: number } | null,
     *   chao?: (x: number, z: number) => number,
     * }} o
     */
    passo(dt, o) {
      if (n === 0 || dt <= 0) return;
      const { cx, vcx, cz, R } = o;
      const av = o.avanco || 0;
      // 1. velocidade: acompanha o centro de lado com o atraso de cada um (em z o referencial ja anda
      //    junto); mola radial ate o raio que cabe a cada um na fila (centro -> borda), assim o bando
      //    espremido reabre e os buracos se fecham; mola forte se sair da elipse
      for (let i = 0; i < n; i++) {
        const rx = x[i] - cx;
        const rz = (dz[i] - av) / ACHATA;
        er[i] = Math.sqrt(rx * rx + rz * rz);
        ordem[i] = i;
      }
      const fila = ordem.subarray(0, n).sort((a, b) => er[a] - er[b]);
      for (let k = 0; k < n; k++) {
        const i = fila[k];
        const rx = x[i] - cx;
        const rz = dz[i] - av;
        let fx = -(vx[i] - vcx) * kf[i];
        let fz = -vz[i] * KDZ;
        const e = er[i];
        if (e > 1e-4) {
          const alvo = R * Math.sqrt((k + 0.5) / n);
          const mola = (alvo - e) * KR + (e > R ? (R - e) * KB : 0);
          fx += (rx / e) * mola;
          fz += (rz / e) * mola * ACHATA;
        }
        vx[i] += fx * dt;
        vz[i] += fz * dt;
        const rvx = vx[i] - vcx;
        const vel = Math.hypot(rvx, vz[i]);
        if (vel > VMAX) {
          vx[i] = vcx + (rvx / vel) * VMAX;
          vz[i] = (vz[i] / vel) * VMAX;
        }
        x[i] += vx[i] * dt;
        dz[i] += vz[i] * dt;
      }
      // 2. separacao direto na posicao (grade espacial; cada par uma vez): o bando espremido reabre
      //    rapido e ninguem fica encavalado. A distancia vem da area da elipse dividida entre os patos.
      d0 = Math.max(0.15, Math.min(0.55, Math.sqrt((Math.PI * R * R * ACHATA) / Math.max(1, n)) * 1.25));
      const tam = Math.max(d0, (2 * ALC) / GW);
      const lado = Math.min(GW, Math.ceil((2 * ALC) / tam));
      cabeca.fill(-1, 0, lado * lado);
      for (let i = 0; i < n; i++) {
        const gx = Math.min(lado - 1, Math.max(0, Math.floor((x[i] - cx + ALC) / tam)));
        const gz = Math.min(lado - 1, Math.max(0, Math.floor((dz[i] + ALC) / tam)));
        const c = gz * lado + gx;
        celula[i] = c;
        prox[i] = cabeca[c];
        cabeca[c] = i;
      }
      ax.fill(0, 0, n);
      az.fill(0, 0, n);
      const d2 = d0 * d0;
      for (let i = 0; i < n; i++) {
        const c = celula[i];
        const gx = c % lado;
        const gz = (c - gx) / lado;
        for (let oz = -1; oz <= 1; oz++) {
          const z2 = gz + oz;
          if (z2 < 0 || z2 >= lado) continue;
          for (let ox = -1; ox <= 1; ox++) {
            const x2 = gx + ox;
            if (x2 < 0 || x2 >= lado) continue;
            for (let j = cabeca[z2 * lado + x2]; j !== -1; j = prox[j]) {
              if (j <= i) continue;
              let ddx = x[i] - x[j];
              let ddz = dz[i] - dz[j];
              let q = ddx * ddx + ddz * ddz;
              if (q >= d2) continue;
              if (q < 1e-6) {
                // dois no mesmo ponto: separa para um lado qualquer
                ddx = (Math.random() - 0.5) * 0.02;
                ddz = (Math.random() - 0.5) * 0.02;
                q = ddx * ddx + ddz * ddz;
              }
              const d = Math.sqrt(q);
              const corr = ((d0 - d) / d) * 0.5;
              ax[i] += ddx * corr;
              az[i] += ddz * corr;
              ax[j] -= ddx * corr;
              az[j] -= ddz * corr;
            }
          }
        }
      }
      const f = o.funil;
      const k = Math.min(1, dt * 14);
      for (let i = 0; i < n; i++) {
        x[i] += ax[i] * REL;
        dz[i] += az[i] * REL;
        // portao: quem esta chegando no plano fica dentro da abertura (o bando se espreme)
        if (f) {
          const antes = f.z - (cz + dz[i]);
          if (antes > -0.4 && antes < 1.1) {
            const m = Math.min(0.2, (f.x1 - f.x0) * 0.1);
            const dentro = Math.min(f.x1 - m, Math.max(f.x0 + m, x[i]));
            if (dentro !== x[i]) {
              x[i] += (dentro - x[i]) * k;
              if (antes > 0 && antes < 0.35) {
                // ainda fora da abertura: o poste segura o pato atras do plano
                dz[i] = f.z - cz - 0.35;
                vz[i] = Math.min(0, vz[i]);
              }
            }
          }
        }
        // paredes
        if (x[i] > o.meia) {
          x[i] = o.meia;
          if (vx[i] > 0) vx[i] = 0;
        } else if (x[i] < -o.meia) {
          x[i] = -o.meia;
          if (vx[i] < 0) vx[i] = 0;
        }
        // altura: sobe degrau na hora (pulinho) e cai com gravidade
        const g = o.chao ? o.chao(x[i], cz + dz[i]) : 0;
        if (y[i] < g) {
          y[i] = Math.min(g, y[i] + Math.max(3, (g - y[i]) * 16) * dt);
          vy[i] = 0;
        } else if (y[i] > g) {
          vy[i] -= G * dt;
          y[i] += vy[i] * dt;
          if (y[i] < g) {
            y[i] = g;
            vy[i] = 0;
          }
        }
      }
    },

    /** Distancia de separacao atual (testes). */
    get d0() { return d0; },
  };
}
