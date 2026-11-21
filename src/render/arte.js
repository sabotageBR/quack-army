// Carga da arte (WebP em src/arte/, do Grok via tools/montar-arte.mjs) como texturas do three.js, com
// progresso para o portal. Arquivo que falta vira um desenho simples de reserva (o jogo nunca trava por
// arte), mas o empacotador so sai com tudo no lugar (test/arte.test.js).
import * as THREE from 'three';

export const SPRITES = Object.freeze([
  'patos/tras-1', 'patos/tras-2', 'patos/tras-3', 'patos/frente-1', 'patos/feliz', 'patos/pulo-1', 'patos/pulo-2', 'patos/pulo-3',
  'inimigos/sapo-1', 'inimigos/sapo-2', 'inimigos/tubarao-1', 'inimigos/tubarao-2', 'inimigos/polvo-1', 'inimigos/polvo-2',
  'chefes/reisapo', 'chefes/tubarao', 'chefes/polvo', 'chefes/imperador',
  'aderecos/sabonete', 'aderecos/sabonete-rosa', 'aderecos/escova', 'aderecos/ralo', 'aderecos/moeda', 'aderecos/gaiola',
  'aderecos/escudo', 'aderecos/estrela', 'aderecos/espuma',
  'castelos/rosa', 'castelos/azul', 'castelos/lilas',
  'lendas/capitao', 'lendas/escudo', 'lendas/sortudo', 'lendas/mergulhador', 'lendas/ninja', 'lendas/almirante',
  'lendas/ouro', 'lendas/rainha', 'lendas/trovao', 'ui/bolha', 'ui/gota',
]);
export const TEXTURAS = Object.freeze(['texturas/banheira', 'texturas/piscina', 'texturas/lago', 'texturas/chuveiro', 'texturas/agua']);
export const FUNDOS = Object.freeze(['fundos/banheira', 'fundos/piscina', 'fundos/lago', 'fundos/chuveiro']);

/** @type {Record<string, THREE.Texture>} */
export const TEX = {};

/**
 * Desenho de reserva (circulo colorido) para arquivo que nao carregou.
 * @param {string} chave
 */
function reserva(chave) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const cor = chave.startsWith('patos') || chave.startsWith('lendas') ? '#ffd23f'
    : chave.includes('sapo') || chave.includes('imperador') ? '#5bc236'
      : chave.includes('tubarao') ? '#6c8cb5' : chave.includes('polvo') ? '#9b5de5'
        : chave.startsWith('texturas') ? '#dff6fb' : chave.startsWith('fundos') ? '#bfe9f5' : '#ffffff';
  if (chave.startsWith('texturas') || chave.startsWith('fundos')) {
    g.fillStyle = cor;
    g.fillRect(0, 0, 64, 64);
  } else {
    g.fillStyle = cor;
    g.strokeStyle = '#1d1d2b';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(32, 34, 26, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Carrega tudo. `progresso(f)` recebe 0..1.
 * @param {(f: number) => void} progresso
 * @param {number} anisotropia
 */
export async function carregarArte(progresso, anisotropia = 1) {
  const lista = [...SPRITES, ...TEXTURAS, ...FUNDOS];
  const loader = new THREE.TextureLoader();
  let feitos = 0;
  await Promise.all(lista.map((chave) => new Promise((ok) => {
    const fim = (/** @type {THREE.Texture} */ t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      if (chave.startsWith('texturas')) {
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = anisotropia;
      }
      TEX[chave] = t;
      feitos++;
      progresso(feitos / lista.length);
      ok(null);
    };
    loader.load(`src/arte/${chave}.webp`, fim, undefined, () => {
      const r = reserva(chave);
      if (chave.startsWith('texturas')) {
        r.wrapS = THREE.RepeatWrapping;
        r.wrapT = THREE.RepeatWrapping;
      }
      fim(r);
    });
  })));
}

/** Proporcao largura/altura da imagem de uma textura (1 se ainda nao tem imagem). @param {THREE.Texture} t */
export function proporcao(t) {
  const im = /** @type {any} */ (t && t.image);
  return im && im.width && im.height ? im.width / im.height : 1;
}
