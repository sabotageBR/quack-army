// Textos dentro da cena 3D (numero do bando, dos inimigos, do chefe, dos portoes e dos degraus):
// desenhados em canvas com a fonte do jogo e usados como textura. Ficam no canvas do WebGL, entao
// aparecem tambem nas gravacoes de video (?filme).
import * as THREE from 'three';

const FONTE = "'Fredoka', 'Arial Rounded MT Bold', system-ui, sans-serif";
let DECIMAL = '.';
/** Separador decimal dos degraus (',' em pt e es). @param {string} s */
export function definirDecimal(s) { DECIMAL = s; }

/** Simbolos bonitos das contas. @param {string} op */
export const simbolo = (op) => ({ '+': '+', '-': '−', x: '×', '/': '÷' })[op] || op;

/**
 * @param {CanvasRenderingContext2D} g @param {number} x @param {number} y @param {number} w @param {number} h @param {number} r
 */
function retanguloRedondo(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/**
 * Plaquinha que sempre olha para a camera (THREE.Sprite), redesenhada so quando o texto muda.
 * @param {{ largura?: number, altura?: number, fundo?: string, tamanho?: number }} [o]
 */
export function criarPlaca(o = {}) {
  const c = document.createElement('canvas');
  c.width = o.largura || 256;
  c.height = o.altura || 112;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 20;
  sprite.center.set(0.5, 0);
  let atual = '';
  let corAtual = '';
  return {
    sprite,
    /** @param {string} texto @param {string} [fundo] */
    escrever(texto, fundo = o.fundo || '#ff8a1f') {
      if (texto === atual && fundo === corAtual) return;
      atual = texto;
      corAtual = fundo;
      g.clearRect(0, 0, c.width, c.height);
      const tam = o.tamanho || 72;
      g.font = `700 ${tam}px ${FONTE}`;
      const larg = Math.min(c.width - 8, g.measureText(texto).width + 48);
      const x = (c.width - larg) / 2;
      g.fillStyle = '#1d1d2b';
      retanguloRedondo(g, x, 10, larg, c.height - 14, (c.height - 14) / 2);
      g.fill();
      g.fillStyle = fundo;
      retanguloRedondo(g, x + 5, 6, larg - 10, c.height - 20, (c.height - 20) / 2);
      g.fill();
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 10;
      g.lineJoin = 'round';
      g.strokeStyle = '#1d1d2b';
      g.strokeText(texto, c.width / 2, c.height / 2 - 2);
      g.fillStyle = '#ffffff';
      g.fillText(texto, c.width / 2, c.height / 2 - 2);
      tex.needsUpdate = true;
    },
    descartar() {
      tex.dispose();
      mat.dispose();
    },
  };
}

/**
 * Textura do painel de um portao: bolha translucida azul (bom) ou vermelha (ruim) com a conta.
 * @param {string} op @param {number} v @param {number} largura do painel (u), para nao esticar o texto
 */
export function texturaPortao(op, v, largura) {
  const c = document.createElement('canvas');
  const proporcao = Math.max(0.6, largura / 2.4);
  c.width = Math.round(256 * proporcao);
  c.height = 256;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const bom = op === '+' || op === 'x';
  const grad = g.createLinearGradient(0, 0, 0, c.height);
  if (bom) {
    grad.addColorStop(0, 'rgba(120,215,245,0.86)');
    grad.addColorStop(1, 'rgba(30,130,215,0.74)');
  } else {
    grad.addColorStop(0, 'rgba(255,140,150,0.88)');
    grad.addColorStop(1, 'rgba(225,40,70,0.76)');
  }
  retanguloRedondo(g, 6, 6, c.width - 12, c.height - 12, 36);
  g.fillStyle = grad;
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.stroke();
  // brilho de bolha
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.ellipse(c.width * 0.26, 52, c.width * 0.14, 18, -0.2, 0, Math.PI * 2);
  g.fill();
  const texto = `${simbolo(op)}${v}`;
  let tam = 132;
  g.font = `700 ${tam}px ${FONTE}`;
  while (g.measureText(texto).width > c.width - 40 && tam > 40) {
    tam -= 8;
    g.font = `700 ${tam}px ${FONTE}`;
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 16;
  g.strokeStyle = '#1d1d2b';
  g.strokeText(texto, c.width / 2, c.height / 2 + 6);
  g.fillStyle = '#ffffff';
  g.fillText(texto, c.width / 2, c.height / 2 + 6);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Textura do espelho de um degrau da escada (x1.5).
 * @param {number} mult @param {string} cor
 */
export function texturaDegrau(mult, cor) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 64;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.fillStyle = cor;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(0, 0, c.width, 10);
  g.font = `700 56px ${FONTE}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 9;
  g.strokeStyle = '#1d1d2b';
  const t = `×${String(mult).replace('.', ',')}`;
  g.strokeText(t, c.width / 2, 35);
  g.fillStyle = '#fff';
  g.fillText(t, c.width / 2, 35);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Sombra redonda macia (textura), para o bando e os chefes. */
export function texturaSombra() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(29,29,43,0.42)');
  grad.addColorStop(0.7, 'rgba(29,29,43,0.2)');
  grad.addColorStop(1, 'rgba(29,29,43,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
