// Cena 3D do Quack Army (three.js r187): pista de azulejo sobre a agua, o bando em billboards
// instanciados (InstancedMesh, um por quadro da animacao), portoes, obstaculos, exercitos, moedas,
// gaiolas, a escada de degraus multiplicadores e o castelo do chefe. So le a simulacao (src/jogo);
// nunca decide nada do jogo. Uma luz hemisferica e uma direcional, sem sombra dinamica.
//
// Fisica so do desenho: o bando e um monte de corpos que se empurram (bando.js) e tudo que e
// arremessado (patos atingidos, brinquedos, sabonetes, escovas, pedacos do castelo) e balistico com
// quique e respingo (corpos.js). No fim, o pato lider sobe o que falta da escada e derruba o castelo.
import * as THREE from 'three';
import { TEX, proporcao } from './arte.js';
import { criarPlaca, texturaPortao, texturaDegrau, texturaSombra } from './rotulos.js';
import { criarBandoFisico } from './bando.js';
import { criarCorpos } from './corpos.js';
import { MEIA_PISTA, ESCADA, FORCA, raioBando, centroFaixa, faixaPortao, valorPortao, fracaoNaFaixa } from '../jogo/regras.js';

const CEU = [0xd6f3fb, 0xcdeffd, 0xdcf3e4, 0xeee6fb];
const AGUA = [0xffffff, 0xd8f4ff, 0xb8ecd0, 0xeadfff];
const LATERAL = [0xffffff, 0xe9fbff, 0xb98a5a, 0xf3ecff];
const CASTELO = ['castelos/rosa', 'castelos/azul', 'castelos/lilas', 'castelos/rosa'];
const PISTA = ['texturas/banheira', 'texturas/piscina', 'texturas/lago', 'texturas/chuveiro'];
const FUNDO = ['fundos/banheira', 'fundos/piscina', 'fundos/lago', 'fundos/chuveiro'];
const COR_DEGRAU = ['#ff8fb1', '#ffb347', '#ffd23f', '#9be15d', '#3ec6e0', '#6c8cff', '#b28dff', '#ff7eb6', '#ff9f43', '#2ed1a2'];
const SPRITE_CHEFE = { reisapo: 'chefes/reisapo', tubarao: 'chefes/tubarao', polvo: 'chefes/polvo', imperador: 'chefes/imperador' };
const SPRITE_INIMIGO = { sapo: 'inimigos/sapo-1', tubarao: 'inimigos/tubarao-1', polvo: 'inimigos/polvo-1' };
/** sprites dos corpos soltos (uma malha instanciada para cada) */
const CHAVES_CORPO = ['patos/frente-1', 'patos/pulo-2', 'inimigos/sapo-1', 'inimigos/tubarao-1', 'inimigos/polvo-1'];
const DEGRAU_H = 0.55;
const DEGRAU_D = 1.4;
const ALCANCE = 115;
const Y_AGUA = -0.95;

const Q_ID = new THREE.Quaternion();
const V1 = new THREE.Vector3();
const V2 = new THREE.Vector3();
const M1 = new THREE.Matrix4();
const QR = new THREE.Quaternion();
const EIXO_Z = new THREE.Vector3(0, 0, 1);

/** Plano com a origem no meio da base (para billboards em pe). */
const GEO_PE = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
const GEO_CENTRO = new THREE.PlaneGeometry(1, 1);

/** @param {string} chave */
function matSprite(chave) {
  return new THREE.MeshBasicMaterial({ map: TEX[chave], alphaTest: 0.5, side: THREE.DoubleSide });
}

const sorte = (/** @type {number} */ a, /** @type {number} */ b) => a + Math.random() * (b - a);
const sinal = (/** @type {number} */ v) => (v < 0 ? -1 : 1);
const lado = () => (Math.random() < 0.5 ? -1 : 1);

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ filme?: boolean, movel?: boolean }} o
 */
export function criarCena(canvas, o = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !o.movel, preserveDrawingBuffer: !!o.filme, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  let dprMax = o.movel ? 1.5 : 2;
  const VIS = o.movel ? 380 : 600;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 400);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xa8dcea, 2.1));
  const sol = new THREE.DirectionalLight(0xffffff, 1.6);
  sol.position.set(-6, 12, 6);
  scene.add(sol);
  scene.fog = new THREE.Fog(CEU[0], 55, 125);

  let W = 1;
  let H = 1;
  let retrato = false;
  /** @type {THREE.Texture|null} */
  let fundoTex = null;

  // ---------------------------------------------------------------- grupos por fase
  let nivel = new THREE.Group();
  scene.add(nivel);
  /** billboards que viram para a camera a cada quadro (giro: rotacao no plano da tela, rad) */
  /** @type {{ m: THREE.Object3D, giro: number }[]} */
  let bills = [];
  /** objetos por evento (id -> registro) */
  /** @type {Map<number, any>} */
  let porEvento = new Map();
  /** @type {any} */
  let fase = null;
  let mundo = 0;
  let zFim = 0;
  /** @type {any} */
  let castelo = null;
  /** @type {any} */
  let chefe = null;
  let escadaInicio = 0;
  /** geometria da escada e do planalto em coordenadas da simulacao (z para a frente) */
  const geo = { z0: 0, q: 0, zPl: 0, hTopo: 0 };
  /** final da fase: o lider sobe o resto da escada e derruba o castelo */
  /** @type {null | Final} */
  let final = null;

  // ---------------------------------------------------------------- chao (simulacao: z para a frente)
  const CH = { y: 0, agua: false };
  /** Altura do chao em (x, z) e se ali e agua. Devolve sempre o mesmo objeto (ler na hora). */
  function chao(/** @type {number} */ x, /** @type {number} */ z) {
    const ax = Math.abs(x);
    CH.agua = false;
    if (z >= geo.z0 && z < geo.zPl && ax <= 3.2) CH.y = DEGRAU_H * (Math.floor((z - geo.z0) / DEGRAU_D) + 1);
    else if (z >= geo.zPl && z <= geo.zPl + 9 && ax <= 4.5) CH.y = geo.hTopo;
    else if (ax <= MEIA_PISTA + 0.25 && z >= -10 && z <= zFim + 4) CH.y = 0;
    else {
      CH.y = Y_AGUA;
      CH.agua = true;
    }
    return CH;
  }
  const chaoBando = (/** @type {number} */ x, /** @type {number} */ z) => {
    const g = chao(x, z);
    return g.agua ? 0 : g.y;
  };

  // ---------------------------------------------------------------- bando
  const frames = ['patos/tras-1', 'patos/tras-2', 'patos/tras-3'];
  /** @type {THREE.InstancedMesh[]} */
  let malhasBando = [];
  const bando = criarBandoFisico(VIS);
  let nBando = 0;
  /** centro do bando no desenho (coordenadas do three: z = -z da simulacao) */
  const centro = { x: 0, y: 0, z: 0 };
  let cxAntes = 0;
  /** de onde saem os patos novos (portao, gaiola) e ate quando vale */
  /** @type {null | { x: number, z: number, larg: number, ate: number }} */
  let origemNovos = null;
  const placaBando = criarPlaca({ fundo: '#ff8a1f' });
  placaBando.sprite.scale.set(2.3, 1, 1);
  scene.add(placaBando.sprite);
  const sombra = new THREE.Mesh(GEO_CENTRO, new THREE.MeshBasicMaterial({ map: texturaSombra(), transparent: true, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2;
  scene.add(sombra);
  /** @type {THREE.Mesh|null} */
  let lider = null;
  /** depositados na escada */
  /** @type {THREE.InstancedMesh|null} */
  let deposito = null;
  let nDeposito = 0;
  /** patos pulando do bando para o degrau */
  /** @type {{ x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, t: number, dur: number }[]} */
  let saltos = [];
  /** @type {THREE.InstancedMesh|null} */
  let malhaSaltos = null;

  // ---------------------------------------------------------------- corpos soltos
  const corpos = criarCorpos(o.movel ? 110 : 180);
  /** @type {Record<string, THREE.InstancedMesh>} */
  const malhasCorpo = {};

  // ---------------------------------------------------------------- particulas (espuma, gotas, estrelas, moedas)
  const MAX_P = 180;
  /** @type {{ tipo: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, vida: number, max: number, s: number, giro: number }[]} */
  let parts = [];
  /** @type {THREE.InstancedMesh[]} */
  let malhasPart = [];

  function montarMalhas() {
    for (const m of malhasBando) scene.remove(m);
    malhasBando = frames.map((f) => {
      const m = new THREE.InstancedMesh(GEO_PE, matSprite(f), VIS);
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
      return m;
    });
    for (const m of malhasPart) scene.remove(m);
    malhasPart = ['aderecos/espuma', 'ui/gota', 'aderecos/estrela', 'aderecos/moeda'].map((f) => {
      const m = new THREE.InstancedMesh(GEO_CENTRO, matSprite(f), MAX_P);
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
      return m;
    });
    for (const k of CHAVES_CORPO) {
      const m = new THREE.InstancedMesh(GEO_CENTRO, matSprite(k), o.movel ? 110 : 180);
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
      malhasCorpo[k] = m;
    }
    malhaSaltos = new THREE.InstancedMesh(GEO_PE, matSprite('patos/pulo-1'), 48);
    malhaSaltos.frustumCulled = false;
    malhaSaltos.count = 0;
    scene.add(malhaSaltos);
  }

  // ---------------------------------------------------------------- camera
  const cam = { x: 0, y: 8, z: 10, lx: 0, ly: 0, lz: 0, tremor: 0 };
  /** na largada a camera olha o proprio bando (ele fica no meio da tela, acima dos cartoes) */
  let foco = 'corrida';
  function base() {
    const b = retrato ? { fov: 64, y: 10.5, z: 11.5, frente: 8 } : { fov: 50, y: 8, z: 10.5, frente: 9 };
    if (foco === 'largada') b.frente = retrato ? -1.5 : 0.5;
    // bando pequeno: camera mais perto; bando grande: abre. No final, enquadra o lider e o castelo
    const r = final ? 1.7 : raioBando(nBando);
    const k = 0.78 + 0.32 * Math.min(1, r / 2.6);
    b.y *= k;
    b.z *= k;
    if (final) b.frente = retrato ? 5 : 6;
    return b;
  }

  function medir(/** @type {number} */ w, /** @type {number} */ h) {
    W = Math.max(1, w);
    H = Math.max(1, h);
    retrato = H > W * 1.05;
    renderer.setPixelRatio(Math.min(dprMax, window.devicePixelRatio || 1));
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = base().fov;
    camera.updateProjectionMatrix();
    ajustarFundo();
  }

  function ajustarFundo() {
    if (!fundoTex) return;
    const img = 16 / 9;
    const tela = W / H;
    fundoTex.matrixAutoUpdate = true;
    if (tela < img) {
      fundoTex.repeat.set(tela / img, 1);
      fundoTex.offset.set((1 - tela / img) / 2, 0);
    } else {
      fundoTex.repeat.set(1, img / tela);
      fundoTex.offset.set(0, (1 - img / tela) * 0.35);
    }
  }

  // ---------------------------------------------------------------- utilidades
  /**
   * Billboard em pe (vira para a camera).
   * @param {string} chave @param {number} largura u
   */
  function placaEmPe(chave, largura) {
    const m = new THREE.Mesh(GEO_PE, matSprite(chave));
    const a = proporcao(TEX[chave]);
    m.scale.set(largura, largura / a, 1);
    nivel.add(m);
    bills.push({ m, giro: 0 });
    return m;
  }

  /** @param {THREE.Object3D} m */
  const billDe = (m) => bills.find((b) => b.m === m);

  /** @param {THREE.Texture} t @param {number} rx @param {number} ry */
  function repetir(t, rx, ry) {
    const c = t.clone();
    c.wrapS = THREE.RepeatWrapping;
    c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(rx, ry);
    c.needsUpdate = true;
    return c;
  }

  function limparNivel() {
    nivel.traverse((ob) => {
      const m = /** @type {any} */ (ob);
      if (m.material) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mt of mats) {
          if (mt.map && mt.map.isCanvasTexture) mt.map.dispose();
          if (mt.map && mt.map.userData && mt.map.userData.clone) mt.map.dispose();
          mt.dispose();
        }
      }
      if (m.geometry && m.geometry !== GEO_PE && m.geometry !== GEO_CENTRO) m.geometry.dispose();
    });
    for (const r of porEvento.values()) if (r.placa) r.placa.descartar();
    if (chefe && chefe.placa) chefe.placa.descartar();
    scene.remove(nivel);
    nivel = new THREE.Group();
    scene.add(nivel);
    bills = [];
    porEvento = new Map();
    castelo = null;
    chefe = null;
    lider = null;
    deposito = null;
    nDeposito = 0;
    saltos = [];
    corpos.limpar();
    encerrarFinal();
  }

  // ---------------------------------------------------------------- montar uma fase
  /**
   * @param {any} f Fase
   * @param {{ lenda?: string, escadaInicio?: number, n: number }} op
   */
  function montarFase(f, op) {
    if (!malhasBando.length) montarMalhas();
    limparNivel();
    fase = f;
    mundo = f.mundo;
    escadaInicio = op.escadaInicio || 0;
    zFim = f.comprimento;
    scene.fog = new THREE.Fog(CEU[mundo], 55, 125);
    fundoTex = TEX[FUNDO[mundo]] || null;
    scene.background = fundoTex || new THREE.Color(CEU[mundo]);
    ajustarFundo();

    // pista (caixa: topo com azulejo, lados de cor) do comeco ate o pe da escada
    const largura = MEIA_PISTA * 2 + 0.5;
    const comp = zFim + 14;
    const topo = new THREE.MeshLambertMaterial({ map: repetir(TEX[PISTA[mundo]], 2, comp / 4.6) });
    // a madeira do lago saiu amarela como os patos: escurece para dar contraste
    if (mundo === 2) topo.color = new THREE.Color(0xb98a62);
    /** @type {any} */ (topo.map).userData.clone = true;
    const ladoMat = new THREE.MeshLambertMaterial({ color: LATERAL[mundo] });
    const pista = new THREE.Mesh(new THREE.BoxGeometry(largura, 1.2, comp), [ladoMat, ladoMat, topo, ladoMat, ladoMat, ladoMat]);
    pista.position.set(0, -0.6, -(comp / 2 - 10));
    nivel.add(pista);
    // agua
    const agua = new THREE.Mesh(new THREE.PlaneGeometry(420, comp + 420), new THREE.MeshBasicMaterial({ map: repetir(TEX['texturas/agua'], 24, (comp + 420) / 17.5), color: AGUA[mundo] }));
    /** @type {any} */ (agua.material.map).userData.clone = true;
    agua.rotation.x = -Math.PI / 2;
    agua.position.set(0, Y_AGUA, -comp / 2);
    agua.name = 'agua';
    nivel.add(agua);

    // decoracao: espuma boiando e bolhas no ar dos dois lados (sensacao de velocidade)
    for (let i = 0; i < 34; i++) {
      const s = i % 2 ? 1 : -1;
      const zz = -(i * (comp / 34) + ((i * 7.3) % 5));
      const ehBolha = i % 3 === 0;
      const m = placaEmPe(ehBolha ? 'ui/bolha' : 'aderecos/espuma', ehBolha ? 0.9 + (i % 4) * 0.25 : 2.2 + (i % 5) * 0.5);
      m.position.set(s * (MEIA_PISTA + 2.2 + ((i * 3.7) % 7)), ehBolha ? 1.5 + (i % 5) * 0.6 : Y_AGUA, zz);
    }

    // escada de degraus multiplicadores e o planalto do castelo
    const z0 = zFim + 2;
    const qtdDegraus = ESCADA.length - escadaInicio;
    for (let i = 0; i < qtdDegraus; i++) {
      const h = DEGRAU_H * (i + 1);
      const cor = COR_DEGRAU[(i + escadaInicio) % COR_DEGRAU.length];
      const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(cor) });
      const d = new THREE.Mesh(new THREE.BoxGeometry(6.4, h, DEGRAU_D), mat);
      d.position.set(0, h / 2, -(z0 + i * DEGRAU_D + DEGRAU_D / 2));
      nivel.add(d);
      const rot = new THREE.Mesh(new THREE.PlaneGeometry(6.4, DEGRAU_H), new THREE.MeshBasicMaterial({ map: texturaDegrau(ESCADA[i + escadaInicio], cor) }));
      rot.position.set(0, h - DEGRAU_H / 2, -(z0 + i * DEGRAU_D) + 0.011);
      nivel.add(rot);
    }
    const hTopo = DEGRAU_H * (qtdDegraus + 1);
    const zPlanalto = z0 + qtdDegraus * DEGRAU_D;
    geo.z0 = z0;
    geo.q = qtdDegraus;
    geo.zPl = zPlanalto;
    geo.hTopo = hTopo;
    const planalto = new THREE.Mesh(new THREE.BoxGeometry(9, hTopo, 9), new THREE.MeshLambertMaterial({ color: LATERAL[mundo] === 0xffffff ? 0xf4fbff : LATERAL[mundo] }));
    planalto.position.set(0, hTopo / 2, -(zPlanalto + 4.5));
    nivel.add(planalto);
    const cast = placaEmPe(CASTELO[mundo], 7.5);
    cast.position.set(0, hTopo - 0.05, -(zPlanalto + 5));
    if (mundo === 3) /** @type {any} */ (cast.material).color = new THREE.Color(0xf0e8ff);
    castelo = { m: cast, y0: hTopo - 0.05, z: zPlanalto + 5, chave: CASTELO[mundo], caiu: false };

    if (f.chefe) {
      const m = placaEmPe(SPRITE_CHEFE[/** @type {keyof typeof SPRITE_CHEFE} */ (f.chefe.tipo)] || 'chefes/reisapo', 4.6);
      m.position.set(0, 0, -(zFim + 0.6));
      const placa = criarPlaca({ fundo: '#7a4dff' });
      placa.sprite.scale.set(2.6, 1.13, 1);
      nivel.add(placa.sprite);
      chefe = { m, placa, solto: null, vida: f.chefe.vida, golpe: 0 };
    }

    // lider (lenda ativa) atras do bando, de frente para a camera
    if (op.lenda && TEX[`lendas/${op.lenda}`]) {
      lider = placaEmPe(`lendas/${op.lenda}`, 1.25);
    }
    deposito = new THREE.InstancedMesh(GEO_PE, matSprite('patos/tras-1'), 160);
    deposito.frustumCulled = false;
    deposito.count = 0;
    nivel.add(deposito);

    nBando = Math.max(0, op.n);
    centro.x = 0;
    centro.y = 0;
    centro.z = 0;
    cxAntes = 0;
    origemNovos = null;
    parts = [];
    bando.dispor(Math.min(VIS, nBando), 0, raioBando(nBando));
    cam.x = 0;
    cam.y = base().y;
    cam.z = base().z;
    cam.lx = 0;
    cam.ly = 0;
    cam.lz = -base().frente;
  }

  // ---------------------------------------------------------------- objetos dos eventos (sob demanda)
  /** @param {any} ev */
  function criarEvento(ev) {
    /** @type {any} */
    const r = { ev, objs: [] };
    const z = -ev.z;
    if (ev.tipo === 'portoes') {
      r.paineis = ev.portas.map((/** @type {any} */ p) => {
        const w = p.x1 - p.x0;
        const g = new THREE.Group();
        const t1 = texturaPortao(p.op, p.v, w);
        const t2 = p.op2 ? texturaPortao(p.op2, p.v2, w) : null;
        const mat = new THREE.MeshBasicMaterial({ map: t1, transparent: true, depthWrite: false, side: THREE.DoubleSide });
        const painel = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.16, 2.3), mat);
        painel.position.y = 1.25;
        g.add(painel);
        const matPoste = new THREE.MeshLambertMaterial({ color: 0xffffff });
        for (const lx of [-w / 2, w / 2]) {
          const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 2.6, 8), matPoste);
          poste.position.set(lx, 1.3, 0);
          g.add(poste);
        }
        g.position.set((p.x0 + p.x1) / 2, 0, z);
        nivel.add(g);
        return { g, painel, mat, t1, t2, p, brilho: 0, apagar: 0, balanco: 0 };
      });
    } else if (ev.tipo === 'obstaculo') {
      r.faixas = ev.faixas.map((/** @type {any} */ fx) => {
        if (ev.sub === 'ralo') {
          const m = new THREE.Mesh(GEO_CENTRO, matSprite('aderecos/ralo'));
          m.rotation.x = -Math.PI / 2;
          m.scale.set(fx.w * 2.1, fx.w * 2.1, 1);
          m.position.set(fx.x, 0.02, z);
          nivel.add(m);
          return { m, fx, agito: 0 };
        }
        if (ev.sub === 'escova') {
          const m = placaEmPe('aderecos/escova', fx.w * 2);
          m.position.set(fx.x, 0, z);
          return { m, fx, gira: true };
        }
        const m = placaEmPe(mundo === 3 ? 'aderecos/sabonete-rosa' : 'aderecos/sabonete', 1.75);
        m.position.set(fx.x, 0, z);
        return { m, fx };
      });
    } else if (ev.tipo === 'inimigo') {
      criarExercito(r, ev, z);
    } else if (ev.tipo === 'moeda') {
      r.m = placaEmPe('aderecos/moeda', 0.75);
      r.m.position.set(ev.x, 0.35, z);
    } else if (ev.tipo === 'gaiola') {
      r.m = placaEmPe('aderecos/gaiola', 1.5);
      r.m.position.set(ev.x, 0, z);
      r.placa = criarPlaca({ fundo: '#3ec6e0' });
      r.placa.sprite.scale.set(1.6, 0.7, 1);
      r.placa.escrever(`+${ev.qtd}`);
      r.placa.sprite.position.set(ev.x, 2.1, z);
      nivel.add(r.placa.sprite);
    }
    porEvento.set(ev.id, r);
    return r;
  }

  /** @param {any} r @param {any} ev @param {number} z */
  function criarExercito(r, ev, z) {
    const chave = SPRITE_INIMIGO[/** @type {keyof typeof SPRITE_INIMIGO} */ (ev.sub)] || 'inimigos/polvo-1';
    const alt = ev.sub === 'sapo' ? 0.72 : 0.92;
    const a = proporcao(TEX[chave]);
    const n = Math.min(ev.qtd, 90);
    const x0 = ev.lado === 1 ? 0.25 : -MEIA_PISTA + 0.35;
    const x1 = ev.lado === -1 ? -0.25 : MEIA_PISTA - 0.35;
    const larg = x1 - x0;
    const cols = Math.max(1, Math.min(Math.floor(larg / 0.55), Math.ceil(Math.sqrt(n * 2.4))));
    const passo = larg / cols;
    const linhas = Math.ceil(n / cols);
    const m = new THREE.InstancedMesh(GEO_PE, matSprite(chave), n);
    m.frustumCulled = false;
    nivel.add(m);
    /** posicoes: a linha da frente (mais perto do bando) fica no fim, para sumir primeiro */
    const pos = [];
    for (let i = 0; i < n; i++) {
      const lin = Math.floor(i / cols);
      const col = i % cols;
      const off = (lin % 2) * passo * 0.5;
      pos.push({ x: x0 + passo * (col + 0.5) + off * (col < cols - 1 ? 1 : -1), z: z - (linhas - 1 - lin) * 0.7, f: (i * 0.37) % 1, empurra: 0 });
    }
    for (const p of pos) p.z -= 1.9;
    r.ex = { m, pos, n, alt, a, cols, chave, lastResta: n, total: ev.qtd * (FORCA[/** @type {keyof typeof FORCA} */ (ev.sub)] || 1), forca: FORCA[/** @type {keyof typeof FORCA} */ (ev.sub)] || 1 };
    r.placa = criarPlaca({ fundo: '#e8445a' });
    r.placa.sprite.scale.set(2, 0.88, 1);
    r.placa.escrever(String(ev.qtd));
    r.placa.sprite.position.set((x0 + x1) / 2, alt + 1.1, z - 1.9 - (linhas - 1) * 0.35);
    nivel.add(r.placa.sprite);
  }

  // ---------------------------------------------------------------- particulas e corpos
  /**
   * Particula: tipo 0 espuma, 1 gota, 2 estrela, 3 moeda. Coordenadas do three.
   * @param {number} tipo @param {number} x @param {number} y @param {number} z @param {number} forca
   * @param {{ vy?: number, s?: number, max?: number }} [op]
   */
  function soltar(tipo, x, y, z, forca, op = {}) {
    if (parts.length >= MAX_P) parts.shift();
    const a = Math.random() * Math.PI * 2;
    parts.push({
      tipo, x, y, z,
      vx: Math.cos(a) * forca * (0.4 + Math.random() * 0.6),
      vy: op.vy ?? (tipo === 0 ? 0.6 : 3 + Math.random() * 3),
      vz: Math.sin(a) * forca * 0.6,
      vida: 0,
      max: op.max ?? (tipo === 0 ? 0.38 : tipo === 1 ? 0.6 : 0.85),
      s: op.s ?? (tipo === 0 ? 0.55 + Math.random() * 0.4 : tipo === 1 ? 0.22 + Math.random() * 0.12 : 0.45),
      giro: tipo === 1 ? 0 : (Math.random() - 0.5) * 12,
    });
  }

  /** Respingo na agua (coordenadas da simulacao). @param {number} x @param {number} z @param {number} forca */
  function respingo(x, z, forca) {
    const q = Math.round(4 + forca * 8);
    for (let i = 0; i < q; i++) soltar(1, x, Y_AGUA + 0.1, -z, 1.2 + forca * 2, { vy: 3 + Math.random() * (3 + forca * 4) });
    for (let i = 0; i < 2 + forca * 3; i++) soltar(0, x + (Math.random() - 0.5) * forca, Y_AGUA + 0.05, -z, 0.6, { s: 0.8 + forca * 0.8 });
  }

  /**
   * Pato arremessado (coordenadas da simulacao).
   * @param {number} x @param {number} y @param {number} z
   * @param {{ vx: number, vy: number, vz: number, w?: number }} v
   */
  function patoVoando(x, y, z, v) {
    const a = proporcao(TEX['patos/frente-1']);
    corpos.soltar({
      x, y: y + 0.3, z, vx: v.vx, vy: v.vy, vz: v.vz, w: v.w ?? lado() * sorte(7, 14), a: sorte(-0.5, 0.5),
      h: 0.55, l: 0.55 * a, rest: 0.42, atrito: 7, ref: { chave: Math.random() < 0.35 ? 'patos/pulo-2' : 'patos/frente-1' },
    });
  }

  /**
   * Patos que sairam do bando viram corpos (no maximo `max`; o resto vira espuma).
   * @param {{ x: number, y: number, dz: number, vx: number, vz: number }[]} saiu
   * @param {'choque'|'ruim'|'solto'} modo
   * @param {number} cz z (simulacao) do centro
   */
  function arremessar(saiu, modo, cz, max = 8) {
    let i = 0;
    for (const p of saiu) {
      const z = cz + p.dz;
      if (i++ < max) {
        if (modo === 'choque') patoVoando(p.x, p.y, z, { vx: sorte(-2.2, 2.2), vy: sorte(5, 8), vz: sorte(-4.5, -1.2) });
        else if (modo === 'ruim') patoVoando(p.x, p.y, z, { vx: sinal(p.x - centro.x) * sorte(1.5, 4), vy: sorte(4.5, 7), vz: sorte(-1.5, 0.5) });
        else patoVoando(p.x, p.y, z, { vx: sinal(p.x - centro.x) * sorte(1, 3), vy: sorte(4, 6.5), vz: sorte(-2, 0) });
      } else if (i < max + 10) soltar(0, p.x, p.y + 0.4, -z, 0.8);
    }
  }

  /**
   * Billboard da fase vira corpo (troca para a geometria centrada para girar pelo meio).
   * @param {THREE.Mesh} m @param {number} zSim @param {Partial<import('./corpos.js').Corpo>} v
   */
  function soltarMalha(m, zSim, v) {
    const h = m.scale.y;
    const l = m.scale.x;
    const eraPe = m.geometry === GEO_PE;
    m.geometry = GEO_CENTRO;
    return corpos.soltar({ x: m.position.x, y: m.position.y + (eraPe ? h / 2 : 0), z: zSim, h, l, ...v, ref: { m, bill: billDe(m), h, l } });
  }

  /**
   * Quebra uma billboard em pedacos (castelo, gaiola) que voam a partir de um ponto de impacto.
   * @param {THREE.Mesh} m malha em pe (GEO_PE) @param {string} chave @param {number} zSim
   * @param {{ cols: number, lins: number, ix: number, iy: number, forca: number, vz: number, fica: boolean, cor?: THREE.Color }} op
   */
  function despedacar(m, chave, zSim, op) {
    const w = m.scale.x;
    const h = m.scale.y;
    const y0 = m.position.y;
    m.visible = false;
    for (let lin = 0; lin < op.lins; lin++) {
      for (let col = 0; col < op.cols; col++) {
        const t = TEX[chave].clone();
        t.repeat.set(1 / op.cols, 1 / op.lins);
        t.offset.set(col / op.cols, lin / op.lins);
        t.userData.clone = true;
        t.needsUpdate = true;
        const mat = new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide });
        if (op.cor) mat.color = op.cor;
        const p = new THREE.Mesh(GEO_CENTRO, mat);
        const pl = w / op.cols;
        const ph = h / op.lins;
        p.scale.set(pl, ph, 1);
        const px = m.position.x - w / 2 + pl * (col + 0.5);
        const py = y0 + ph * (lin + 0.5);
        p.position.set(px, py, -zSim);
        nivel.add(p);
        bills.push({ m: p, giro: 0 });
        const dx = px - op.ix;
        const dy = py - op.iy;
        const d = Math.max(0.3, Math.hypot(dx, dy));
        const v = op.forca * sorte(0.75, 1.25);
        corpos.soltar({
          x: px, y: py, z: zSim,
          vx: (dx / d) * v + sorte(-0.6, 0.6),
          vy: 2 + Math.max(0, dy / d) * v * 0.7 + sorte(0, 2) + lin * 0.6,
          vz: op.vz * sorte(0.6, 1.3),
          w: sorte(-6, 6), h: ph, l: pl, rest: 0.25, atrito: 5, fica: op.fica, max: op.fica ? 99 : 2.5,
          ref: { m: p, bill: bills[bills.length - 1], h: ph, l: pl },
        });
      }
    }
  }

  // ---------------------------------------------------------------- reacoes aos acontecimentos da simulacao
  /** @param {any[]} lista @param {any} c Corrida */
  function reagir(lista, c) {
    const cz = -centro.z;
    for (const a of lista) {
      if (a.tipo === 'portao') {
        const r = porEvento.get(a.ev.id);
        let px = c.x;
        let larg = 2;
        if (r && r.paineis) {
          for (const p of r.paineis) {
            if (p.p === a.porta) {
              p.brilho = 1;
              p.balanco = 1;
              px = p.g.position.x;
              larg = (p.p.x1 - p.p.x0) * 0.7;
            } else p.apagar = 1;
          }
        }
        if (a.depois > a.antes) {
          origemNovos = { x: px, z: a.ev.z + 0.3, larg, ate: tempo + 0.5 };
          for (let i = 0; i < Math.min(14, (a.depois - a.antes) / 2 + 3); i++) soltar(2, px, 1.2, -a.ev.z, 3.5);
        } else if (a.depois < a.antes) {
          const tirar = bando.n - Math.min(VIS, a.depois);
          if (tirar > 0) arremessar(bando.remover(tirar, { tipo: 'fora', cx: centro.x }), 'ruim', cz, 10);
        }
      } else if (a.tipo === 'obstaculo') {
        bater(a, c, cz);
      } else if (a.tipo === 'escudo') {
        for (let i = 0; i < 10; i++) soltar(2, centro.x, 1, centro.z, 3);
        empurrarObstaculos(a.ev, c, 1, raioBando(c.n));
      } else if (a.tipo === 'moeda') {
        const r = porEvento.get(a.ev.id);
        if (r && r.m) r.m.visible = false;
        soltar(3, a.ev.x, 0.8, -a.ev.z, 1.5);
      } else if (a.tipo === 'gaiola') {
        const r = porEvento.get(a.ev.id);
        if (r && r.m && r.m.visible) {
          r.placa.sprite.visible = false;
          despedacar(r.m, 'aderecos/gaiola', a.ev.z, { cols: 2, lins: 2, ix: a.ev.x, iy: 0.3, forca: 4, vz: 2, fica: false });
          for (let i = 0; i < 8; i++) soltar(0, a.ev.x, 0.8, -a.ev.z, 1.2);
        }
        origemNovos = { x: a.ev.x, z: a.ev.z, larg: 1.2, ate: tempo + 0.5 };
      } else if (a.tipo === 'choque') {
        cam.tremor = 0.25;
      } else if (a.tipo === 'baixa') {
        // bando maior que o desenho: o numero cai mas o desenho continua cheio; mostra alguns voando
        if (c.n >= VIS) {
          const k = Math.min(5, Math.max(1, Math.round((a.qtd * VIS) / Math.max(1, c.n))));
          arremessar(bando.remover(k, { tipo: 'frente' }), 'choque', cz, 5);
        }
      } else if (a.tipo === 'venceu-chefe' && chefe) {
        chefe.placa.sprite.visible = false;
        chefe.solto = soltarMalha(chefe.m, zFim + 0.6, { vx: lado() * sorte(3.5, 5), vy: 11, vz: 3, w: lado() * 5, rest: 0.3, atrito: 4, max: 4 });
        cam.tremor = 0.3;
        for (let i = 0; i < 18; i++) soltar(2, 0, 2.5, -(zFim + 0.6), 5);
      } else if (a.tipo === 'degrau') {
        depositar(a.degrau, c, cz);
      } else if (a.tipo === 'vitoria') {
        iniciarFinal(c);
      } else if (a.tipo === 'derrota') {
        arremessar(bando.remover(bando.n, { tipo: 'fora', cx: centro.x }), 'choque', cz, 30);
      }
    }
  }

  /**
   * Obstaculo atingido: patos da faixa saem voando (ou somem no ralo) e o obstaculo reage.
   * @param {any} a acontecimento @param {any} c Corrida @param {number} cz
   */
  function bater(a, c, cz) {
    const ev = a.ev;
    const r = porEvento.get(ev.id);
    const R = raioBando(a.antes);
    // quantos sair do desenho: o que o numero pede (ou uma amostra, se o bando e maior que o desenho)
    let tirar = bando.n - Math.min(VIS, a.depois);
    if (a.depois >= VIS) tirar = Math.min(28, Math.max(2, Math.round(((a.antes - a.depois) * VIS) / Math.max(1, a.antes))));
    const faixas = ev.faixas.map((/** @type {any} */ fx) => {
      const x = centroFaixa(fx, c.t);
      return { fx, x, peso: fracaoNaFaixa(c.x, R, x - fx.w, x + fx.w) };
    }).filter((/** @type {any} */ f) => f.peso > 0);
    const soma = faixas.reduce((/** @type {number} */ s, /** @type {any} */ f) => s + f.peso, 0) || 1;
    for (const f of faixas) {
      const q = Math.round((tirar * f.peso) / soma);
      const saiu = bando.remover(q, { tipo: 'perto', x: f.x });
      let i = 0;
      for (const p of saiu) {
        const z = cz + p.dz;
        if (ev.sub === 'ralo') {
          if (i++ < 14) {
            const corpo = corpos.soltar({ x: p.x, y: p.y + 0.3, z, h: 0.55, l: 0.5, ref: { chave: 'patos/frente-1' } });
            corpos.sugar(corpo, f.x, ev.z);
          }
        } else if (i++ < 12) {
          // bate no obstaculo e volta por cima, para o lado de onde veio
          const fora = sinal(p.x - f.x);
          patoVoando(p.x, p.y, z, { vx: fora * sorte(1.5, 4.5), vy: sorte(4.5, 8), vz: sorte(-3, 0.5) });
        } else if (i < 20) soltar(0, p.x, 0.5, -z, 1);
      }
    }
    if (r) empurrarObstaculos(ev, c, 0, R);
    cam.tremor = Math.max(cam.tremor, 0.12);
  }

  /**
   * O bando empurra o obstaculo: sabonete escorrega rodando para fora da pista, escova tomba e quica,
   * ralo gira e borbulha.
   * @param {any} ev @param {any} c Corrida @param {number} extra forca a mais (escudo) @param {number} R raio do bando
   */
  function empurrarObstaculos(ev, c, extra, R) {
    const r = porEvento.get(ev.id);
    if (!r || !r.faixas) return;
    for (const f of r.faixas) {
      if (f.solto) continue;
      const x = centroFaixa(f.fx, c.t);
      const perto = fracaoNaFaixa(c.x, R, x - f.fx.w, x + f.fx.w);
      if (perto <= 0 && !extra) continue;
      if (Math.abs(x - c.x) > R + f.fx.w + 0.5) continue;
      const fora = sinal(x - c.x + (Math.random() - 0.5) * 0.05);
      if (ev.sub === 'ralo') {
        f.agito = 1;
        for (let i = 0; i < 8; i++) soltar(0, x + sorte(-0.5, 0.5), 0.15, -ev.z, 0.9, { vy: 1.2 });
        continue;
      }
      f.solto = true;
      if (ev.sub === 'escova') {
        soltarMalha(f.m, ev.z, { vx: fora * sorte(2, 3.5) * (1 + extra), vy: sorte(5.5, 7) + extra * 2, vz: sorte(2.5, 4.5), w: -fora * sorte(10, 15), rest: 0.45, atrito: 5, max: 3 });
      } else {
        // sabonete: liso, escorrega longe e quase nao quica
        soltarMalha(f.m, ev.z, { vx: fora * sorte(4.5, 7) * (1 + extra * 0.5), vy: sorte(2.2, 3.2) + extra, vz: sorte(2, 4) + c.fase.velocidade * 0.25, w: -fora * sorte(6, 9), rest: 0.22, atrito: 0.9, max: 3.2 });
      }
      for (let i = 0; i < 5; i++) soltar(0, x, 0.5, -ev.z, 1.6);
    }
  }

  /** Patos que ficam no degrau d (a partir de 1): saltam do bando para o degrau. @param {number} d @param {any} c @param {number} cz */
  function depositar(d, c, cz) {
    if (!deposito) return;
    const h = DEGRAU_H * d;
    const zc = geo.z0 + (d - 1) * DEGRAU_D + DEGRAU_D * 0.55;
    const qtd = Math.min(12, c.escada ? c.escada.k : 6);
    const tirar = c.n >= VIS ? qtd : Math.min(qtd, Math.max(0, bando.n - c.n));
    const saiu = bando.remover(tirar, { tipo: 'frente' });
    for (let i = 0; i < qtd; i++) {
      const x1 = -2.7 + (5.4 * (i + 0.5)) / qtd;
      const p = saiu[i];
      if (p && saltos.length < 48) {
        saltos.push({ x0: p.x, y0: p.y, z0: cz + p.dz, x1, y1: h, z1: zc, t: 0, dur: sorte(0.18, 0.26) });
      } else fixar(x1, h, zc);
    }
    for (let i = 0; i < 6; i++) soltar(0, (i - 2.5) * 1.1, h + 0.3, -zc, 1);
  }

  /** Pato parado no degrau (malha de depositados). @param {number} x @param {number} y @param {number} zSim */
  function fixar(x, y, zSim) {
    if (!deposito || nDeposito >= 160) return;
    const a = proporcao(TEX['patos/tras-1']);
    V1.set(x, y, -zSim);
    V2.set(0.55 * a, 0.55, 1);
    M1.compose(V1, camera.quaternion, V2);
    deposito.setMatrixAt(nDeposito++, M1);
    deposito.count = nDeposito;
    deposito.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- final: o lider sobe e derruba o castelo
  /**
   * @typedef {{
   *   m: THREE.Mesh, bill: any, pts: { x: number, y: number, z: number, dur: number, arco: number }[],
   *   i: number, t: number, fase: 'subindo'|'volta'|'festa', tempo: number, impacto: number,
   *   x: number, y: number, z: number, peso: number,
   *   okImpacto: (v: boolean) => void, okFim: () => void, pImpacto: Promise<boolean>, pFim: Promise<void>,
   *   volta?: { x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, t: number },
   * }} Final
   */
  function encerrarFinal() {
    if (final) {
      final.okImpacto(false);
      final.okFim();
    }
    final = null;
  }

  /** @param {any} c Corrida */
  function iniciarFinal(c) {
    encerrarFinal();
    if (!castelo || castelo.caiu) return;
    const cz = -centro.z;
    // so anima se o bando chegou mesmo na escada (o atalho dos testes vence no meio da pista)
    if (cz < zFim - 6) return;
    const d = c.escada ? c.escada.degraus : 0;
    const R = raioBando(c.n);
    const pts = [];
    const ini = d > 0
      ? { x: 0, y: DEGRAU_H * d, z: geo.z0 + (d - 1) * DEGRAU_D + DEGRAU_D * 0.5 }
      : { x: centro.x, y: chaoBando(centro.x, cz), z: cz + R * 0.6 };
    pts.push({ ...ini, dur: 0, arco: 0 });
    const restantes = geo.q - d;
    const passo = restantes > 6 ? 0.1 : 0.13;
    for (let i = d; i < geo.q; i++) pts.push({ x: 0, y: DEGRAU_H * (i + 1), z: geo.z0 + i * DEGRAU_D + DEGRAU_D * 0.5, dur: passo, arco: 0.38 });
    pts.push({ x: 0, y: geo.hTopo, z: geo.zPl + 1.3, dur: 0.15, arco: 0.3 });
    pts.push({ x: 0, y: geo.hTopo, z: geo.zPl + 3.0, dur: 0.15, arco: 0.22 });
    // o mergulho final ate a porta do castelo
    pts.push({ x: 0, y: geo.hTopo + 0.7, z: castelo.z - 0.45, dur: 0.28, arco: 1.0 });
    const a = proporcao(TEX['patos/pulo-1']);
    const m = new THREE.Mesh(GEO_CENTRO, matSprite('patos/pulo-1'));
    m.scale.set(0.95 * a, 0.95, 1);
    m.position.set(ini.x, ini.y + 0.48, -ini.z);
    nivel.add(m);
    bills.push({ m, giro: 0 });
    /** @type {(v: boolean) => void} */
    let okImpacto = () => {};
    /** @type {() => void} */
    let okFim = () => {};
    const pImpacto = new Promise((ok) => { okImpacto = ok; });
    const pFim = new Promise((ok) => { okFim = () => ok(undefined); });
    final = { m, bill: bills[bills.length - 1], pts, i: 1, t: 0, fase: 'subindo', tempo: 0, impacto: 0, x: ini.x, y: ini.y, z: ini.z, peso: 0, okImpacto, okFim, pImpacto, pFim };
    for (let i = 0; i < 6; i++) soltar(2, ini.x, ini.y + 0.8, -ini.z, 2.5);
  }

  /** @param {number} dt */
  function atualizarFinal(dt) {
    if (!final) return;
    const f = final;
    f.tempo += dt;
    f.peso = Math.min(1, f.peso + dt * 2.2);
    const a = proporcao(TEX['patos/pulo-1']);
    if (f.fase === 'subindo') {
      f.t += dt;
      while (f.i < f.pts.length && f.t >= f.pts[f.i].dur) {
        f.t -= f.pts[f.i].dur;
        f.i++;
        if (f.i < f.pts.length - 1) soltar(0, f.pts[f.i - 1].x, f.pts[f.i - 1].y + 0.1, -f.pts[f.i - 1].z, 0.6);
      }
      if (f.i >= f.pts.length) {
        impacto();
      } else {
        const p0 = f.pts[f.i - 1];
        const p1 = f.pts[f.i];
        const s = Math.min(1, f.t / p1.dur);
        f.x = p0.x + (p1.x - p0.x) * s;
        f.z = p0.z + (p1.z - p0.z) * s;
        f.y = p0.y + (p1.y - p0.y) * s + p1.arco * 4 * s * (1 - s);
        const ultimo = f.i === f.pts.length - 1;
        f.bill.giro = ultimo ? -0.7 * s : Math.sin(s * Math.PI) * 0.12;
        /** @type {any} */ (f.m.material).map = TEX[`patos/pulo-${1 + (Math.floor(f.tempo * 14) % 3)}`];
      }
    }
    if (f.fase === 'volta' && f.volta) {
      const v = f.volta;
      v.t += dt;
      const s = Math.min(1, v.t / 0.5);
      f.x = v.x0 + (v.x1 - v.x0) * s;
      f.z = v.z0 + (v.z1 - v.z0) * s;
      f.y = v.y0 + (v.y1 - v.y0) * s + 1.3 * 4 * s * (1 - s);
      f.bill.giro = s * Math.PI * 2;
      if (s >= 1) {
        f.fase = 'festa';
        f.bill.giro = 0;
        /** @type {any} */ (f.m.material).map = TEX['patos/feliz'];
        const af = proporcao(TEX['patos/feliz']);
        f.m.scale.set(1.0 * af, 1.0, 1);
        for (let i = 0; i < 10; i++) soltar(2, f.x, f.y + 0.9, -f.z, 3);
      }
    }
    if (f.fase === 'festa') {
      f.y = geo.hTopo + Math.abs(Math.sin((f.tempo - f.impacto) * 7)) * 0.45;
      if (f.tempo - f.impacto > 1.4) f.okFim();
    }
    const meia = f.m.scale.y / 2;
    f.m.position.set(f.x, f.y + meia, -f.z);
    if (f.fase === 'subindo') f.m.scale.set(0.95 * a, 0.95, 1);
  }

  function impacto() {
    if (!final || !castelo) return;
    const f = final;
    f.fase = 'volta';
    f.impacto = f.tempo;
    f.volta = { x0: f.x, y0: f.y, z0: f.z, x1: 0, y1: geo.hTopo, z1: geo.zPl + 2.2, t: 0 };
    castelo.caiu = true;
    const cor = mundo === 3 ? new THREE.Color(0xf0e8ff) : undefined;
    despedacar(castelo.m, castelo.chave, castelo.z, { cols: 3, lins: 3, ix: 0, iy: castelo.y0 + 0.9, forca: 5, vz: 3.2, fica: true, cor });
    cam.tremor = 0.4;
    for (let i = 0; i < 16; i++) soltar(2, 0, castelo.y0 + 1.2, -castelo.z + 0.6, 6);
    for (let i = 0; i < 10; i++) soltar(0, sorte(-2.5, 2.5), castelo.y0 + sorte(0.3, 2.5), -castelo.z + 0.5, 3);
    f.okImpacto(true);
  }

  // ---------------------------------------------------------------- quadro
  let tempo = 0;
  /**
   * @param {number} dt
   * @param {any} c Corrida (ou null)
   */
  function atualizar(dt, c) {
    tempo += dt;
    if (!fase || !c) return;
    const correndo = c.estado === 'correndo' || c.estado === 'escada';
    const naEscada = c.estado === 'escada' || c.estado === 'vitoria';
    // posicao do centro (na escada ele sobe os degraus)
    let alvoZ = c.z;
    let alvoX = c.x;
    if (naEscada) {
      const d = c.escada ? c.escada.degraus : 0;
      alvoZ = zFim + 2 + Math.max(0, d - 0.4) * DEGRAU_D;
      alvoX = 0;
    }
    const k = Math.min(1, dt * 9);
    const czAntes = -centro.z;
    const czVis = naEscada ? czAntes + (alvoZ - czAntes) * k : alvoZ;
    const cxVis = naEscada ? centro.x + (alvoX - centro.x) * k : alvoX;
    nBando = c.n;
    centro.x = cxVis;
    centro.z = -czVis;
    centro.y += (chaoBando(cxVis, czVis) - centro.y) * Math.min(1, dt * 8);
    const vcx = dt > 0 ? (cxVis - cxAntes) / dt : 0;
    cxAntes = cxVis;

    // eventos: cria os que entram no alcance, atualiza e some com os que ficaram para tras; acha o portao
    const R = raioBando(nBando);
    /** @type {null | { z: number, x0: number, x1: number }} */
    let funil = null;
    for (const ev of fase.eventos) {
      if (ev.z > c.z + ALCANCE) break;
      let r = porEvento.get(ev.id);
      if (!r) {
        if (ev.z < c.z - 6) continue;
        r = criarEvento(ev);
      }
      atualizarEvento(r, c, dt);
      if (!funil && ev.tipo === 'portoes' && ev.z > czVis - R - 0.6 && ev.z < czVis + R + 1.6) {
        for (const p of ev.portas) {
          const [x0, x1] = faixaPortao(p, c.t);
          if (c.x >= x0 && c.x < x1) funil = { z: ev.z, x0, x1 };
        }
      }
    }

    // bando: acerta o numero desenhado e roda a fisica
    const alvoN = Math.min(VIS, nBando);
    if (bando.n > alvoN) {
      const choque = c.estado === 'choque';
      const saiu = bando.remover(bando.n - alvoN, choque || naEscada ? { tipo: 'frente' } : { tipo: 'fora', cx: cxVis });
      if (!naEscada) arremessar(saiu, choque || c.estado === 'derrota' ? 'choque' : 'solto', czVis, choque ? 6 : 10);
    } else if (bando.n < alvoN) {
      const q = alvoN - bando.n;
      if (origemNovos && tempo < origemNovos.ate) {
        bando.adicionar(q, { x: origemNovos.x, dz: origemNovos.z - czVis, larg: origemNovos.larg, fundo: 0.6, y: centro.y, vz: 2 });
      } else if (bando.n === 0) {
        // reviver: caem do ceu
        bando.adicionar(q, { x: cxVis, dz: 0, larg: R * 1.6, fundo: R * 1.4, y: centro.y + 4 });
      } else {
        bando.adicionar(q, { x: cxVis, dz: -R * 0.8, larg: R, fundo: 0.6, y: centro.y });
      }
    }
    let avanco = 0;
    if (c.estado === 'choque' && c.choque) avanco = c.choque.tipo === 'chefe' ? 1.3 : 1.0;
    bando.passo(dt, { cx: cxVis, vcx, cz: czVis, R, meia: naEscada ? 3 : MEIA_PISTA - 0.15, avanco, funil, chao: chaoBando });

    // chefe: balanca com os golpes; vencido, voa como corpo solto
    if (chefe && !chefe.solto) {
      const apanhando = c.estado === 'choque' && c.choque && c.choque.tipo === 'chefe';
      chefe.placa.escrever(String(Math.max(0, Math.round(c.vidaChefe))), '#7a4dff');
      chefe.placa.sprite.position.set(0, 4.6 + Math.sin(tempo * 3) * 0.06, -(zFim + 0.6));
      const golpe = apanhando ? Math.abs(Math.sin(tempo * 22)) : 0;
      const b = billDe(chefe.m);
      if (b) b.giro = apanhando ? Math.sin(tempo * 17) * 0.06 : 0;
      chefe.m.position.z = -(zFim + 0.6) - golpe * 0.25;
      chefe.m.scale.y = (4.6 / proporcao(chefe.m.material.map)) * (1 + Math.sin(tempo * 4) * 0.025 - golpe * 0.05);
    }

    atualizarFinal(dt);
    atualizarCorpos(dt);
    atualizarSaltos(dt);

    // bando: desenho
    const a = proporcao(TEX['patos/tras-1']);
    const esc = nBando > 300 ? 0.52 : nBando > 120 ? 0.58 : 0.64;
    const quadro = Math.floor(tempo * 9);
    const contagem = [0, 0, 0];
    const festa = c.estado === 'vitoria';
    const { x: bx, dz: bdz, y: by, vx: bvx, fase: bf } = bando;
    V2.set(esc * a, esc, 1);
    for (let i = 0; i < bando.n; i++) {
      const fi = bf[i];
      const pulo = festa ? Math.abs(Math.sin(tempo * 8 + fi)) * 0.35
        : correndo ? Math.abs(Math.sin(tempo * 11 + fi)) * 0.13 : Math.abs(Math.sin(tempo * 3 + fi)) * 0.03;
      // inclina para o lado em que corre (mais quando atrasado em relacao ao bando)
      const giro = Math.max(-0.38, Math.min(0.38, -bvx[i] * 0.035 - (bvx[i] - vcx) * 0.03));
      V1.set(bx[i], by[i] + pulo, -(czVis + bdz[i]));
      QR.setFromAxisAngle(EIXO_Z, giro).premultiply(camera.quaternion);
      M1.compose(V1, QR, V2);
      const f = correndo ? (quadro + i) % 3 : 0;
      malhasBando[f].setMatrixAt(contagem[f]++, M1);
    }
    for (let f = 0; f < 3; f++) {
      malhasBando[f].count = contagem[f];
      malhasBando[f].instanceMatrix.needsUpdate = true;
    }
    sombra.position.set(centro.x, centro.y + 0.03, centro.z);
    sombra.scale.set(R * 2.6 + 0.6, R * 2.3 + 0.6, 1);
    sombra.visible = nBando > 0;
    placaBando.escrever(String(nBando));
    placaBando.sprite.position.set(centro.x, centro.y + 1.35 + R * 0.25, centro.z - R * 0.3);
    placaBando.sprite.visible = nBando > 0 && !final;
    if (lider) {
      const zl = czVis - R - 0.45;
      const pl = festa ? Math.abs(Math.sin(tempo * 7)) * 0.5 : correndo ? Math.abs(Math.sin(tempo * 9)) * 0.15 : 0;
      lider.position.set(centro.x, chaoBando(centro.x, zl) + pl, -zl);
      lider.visible = nBando > 0 || festa;
    }

    // particulas
    const cont = [0, 0, 0, 0];
    parts = parts.filter((p) => (p.vida += dt) < p.max);
    for (const p of parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.tipo !== 0) p.vy -= (p.tipo === 1 ? 16 : 12) * dt;
      const u = p.vida / p.max;
      const s = p.tipo === 0 ? p.s * Math.sin(Math.PI * Math.min(1, u * 1.3)) : p.s * (1 - u * 0.4);
      QR.setFromAxisAngle(EIXO_Z, p.giro * p.vida);
      QR.premultiply(camera.quaternion);
      V1.set(p.x, p.y, p.z);
      V2.set(s, s, 1);
      M1.compose(V1, QR, V2);
      malhasPart[p.tipo].setMatrixAt(cont[p.tipo]++, M1);
    }
    for (let t = 0; t < 4; t++) {
      malhasPart[t].count = cont[t];
      malhasPart[t].instanceMatrix.needsUpdate = true;
    }

    // agua mexendo
    const agua = /** @type {any} */ (nivel.getObjectByName('agua'));
    if (agua) agua.material.map.offset.set(Math.sin(tempo * 0.4) * 0.05, -tempo * 0.02);

    // camera: segue o bando; no final, o lider ate o castelo
    const b = base();
    let fx = centro.x;
    let fy = centro.y;
    let fz = centro.z;
    if (final) {
      const w = final.peso * 0.85;
      fx += (final.x - fx) * w;
      fy += (final.y - fy) * w;
      fz += (-final.z - fz) * w;
    }
    const alvoCx = fx * 0.45;
    const kc = Math.min(1, dt * 6);
    cam.x += (alvoCx - cam.x) * kc;
    cam.y += (b.y + fy * 0.9 - cam.y) * kc;
    cam.z += (fz + b.z - cam.z) * Math.min(1, dt * (final ? 5 : 10));
    cam.lx += (alvoCx - cam.lx) * kc;
    cam.ly += (fy * 0.85 - cam.ly) * kc;
    cam.lz += (fz - b.frente - cam.lz) * Math.min(1, dt * (final ? 5 : 10));
    cam.tremor = Math.max(0, cam.tremor - dt);
    const tr = cam.tremor > 0 ? (Math.random() - 0.5) * cam.tremor * 0.6 : 0;
    camera.position.set(cam.x + tr, cam.y + tr * 0.5, cam.z);
    camera.lookAt(cam.lx, cam.ly, cam.lz);

    // billboards
    for (const bl of bills) {
      if (bl.giro) {
        QR.setFromAxisAngle(EIXO_Z, bl.giro);
        QR.premultiply(camera.quaternion);
        bl.m.quaternion.copy(QR);
      } else bl.m.quaternion.copy(camera.quaternion);
    }
  }

  /** @param {number} dt */
  function atualizarCorpos(dt) {
    for (const e of corpos.passo(dt, chao)) {
      if (e.tipo === 'respingo') respingo(e.x, e.z, e.forca);
      else if (e.tipo === 'quique') soltar(0, e.x, e.y + 0.1, -e.z, 0.8, { s: 0.35 + e.forca * 0.4 });
      else if (e.tipo === 'puf') soltar(0, e.x, e.y, -e.z, 0.5, { s: 0.5 });
      if (e.c.ref && e.c.ref.m && e.tipo !== 'quique') e.c.ref.m.visible = false;
    }
    /** @type {Record<string, number>} */
    const cont = {};
    for (const k of CHAVES_CORPO) cont[k] = 0;
    for (const c of corpos.lista) {
      const ref = c.ref;
      if (ref && ref.m) {
        ref.m.position.set(c.x, c.y, -c.z);
        ref.m.scale.set(ref.l * c.s, ref.h * c.s, 1);
        if (ref.bill) ref.bill.giro = c.a || 1e-4;
        continue;
      }
      const m = ref && malhasCorpo[ref.chave];
      if (!m || cont[ref.chave] >= m.instanceMatrix.count) continue;
      QR.setFromAxisAngle(EIXO_Z, c.a).premultiply(camera.quaternion);
      V1.set(c.x, c.y, -c.z);
      V2.set(c.l * c.s, c.h * c.s, 1);
      M1.compose(V1, QR, V2);
      m.setMatrixAt(cont[ref.chave]++, M1);
    }
    for (const k of CHAVES_CORPO) {
      const m = malhasCorpo[k];
      if (!m) continue;
      m.count = cont[k];
      m.instanceMatrix.needsUpdate = true;
    }
  }

  /** @param {number} dt */
  function atualizarSaltos(dt) {
    if (!malhaSaltos) return;
    const a = proporcao(TEX['patos/pulo-1']);
    let n = 0;
    V2.set(0.55 * a, 0.55, 1);
    for (const s of saltos) {
      s.t += dt;
      const u = Math.min(1, s.t / s.dur);
      if (u >= 1) {
        fixar(s.x1, s.y1, s.z1);
        continue;
      }
      V1.set(s.x0 + (s.x1 - s.x0) * u, s.y0 + (s.y1 - s.y0) * u + 4 * 0.7 * u * (1 - u), -(s.z0 + (s.z1 - s.z0) * u));
      M1.compose(V1, camera.quaternion, V2);
      malhaSaltos.setMatrixAt(n++, M1);
    }
    saltos = saltos.filter((s) => s.t < s.dur);
    malhaSaltos.count = n;
    malhaSaltos.instanceMatrix.needsUpdate = true;
  }

  /** @param {any} r @param {any} c @param {number} dt */
  function atualizarEvento(r, c, dt) {
    const ev = r.ev;
    const passou = ev.z < c.z - 3;
    if (ev.tipo === 'portoes') {
      for (const p of r.paineis) {
        if (p.p.amp) {
          const [x0, x1] = faixaPortao(p.p, c.t);
          p.g.position.x = (x0 + x1) / 2;
        }
        if (p.t2) {
          const v = valorPortao(p.p, c.t);
          p.mat.map = v.op === p.p.op ? p.t1 : p.t2;
        }
        if (p.brilho > 0) {
          p.brilho = Math.max(0, p.brilho - dt * 2.5);
          const s = 1 + p.brilho * 0.25;
          p.painel.scale.set(s, s, 1);
          p.mat.opacity = 0.5 + p.brilho * 0.5;
        }
        // o bando passando sacode o portao (mola amortecida)
        if (p.balanco > 0) {
          p.balanco = Math.max(0, p.balanco - dt * 1.6);
          p.g.rotation.x = Math.sin(p.balanco * 26) * p.balanco * 0.16;
        }
        if (p.apagar > 0 || passou) {
          p.apagar = Math.min(1, (p.apagar || 0) + dt * 2);
          p.mat.opacity = Math.max(0.15, 1 - p.apagar);
        }
        p.g.visible = ev.z > c.z - 8;
      }
    } else if (ev.tipo === 'obstaculo') {
      for (const f of r.faixas) {
        if (f.solto) continue;
        if (f.fx.amp) f.m.position.x = centroFaixa(f.fx, c.t);
        if (f.gira) {
          const b = billDe(f.m);
          if (b) b.giro += dt * 7;
        }
        if (f.agito !== undefined) {
          f.agito = Math.max(0, f.agito - dt * 1.2);
          f.m.rotation.z += dt * (1.5 + f.agito * 16);
        }
        f.m.visible = ev.z > c.z - 6;
      }
    } else if (ev.tipo === 'inimigo') {
      const ex = r.ex;
      let resta = ex.n;
      let restaQtd = ev.qtd;
      const ch = c.choque;
      const emChoque = ch && ch.tipo === 'inimigo' && ch.ev === ev;
      if (c.vencidos[ev.id]) {
        resta = 0;
        restaQtd = 0;
      } else if (emChoque) {
        const forcaRestante = Math.max(0, ch.total - (ch.n0 - c.n));
        const frac = forcaRestante / Math.max(1, ch.total);
        resta = Math.ceil(ex.n * frac);
        restaQtd = Math.ceil(ev.qtd * frac);
      }
      if (resta < ex.lastResta) {
        // os da frente sao atropelados: voam para tras rodando e quicam (ou caem na agua)
        let q = 0;
        for (let i = ex.lastResta - 1; i >= resta; i--) {
          const p = ex.pos[i];
          if (q++ < 6) {
            corpos.soltar({
              x: p.x, y: ex.alt * 0.5 + 0.1, z: -p.z, vx: sinal(p.x - centro.x + sorte(-0.4, 0.4)) * sorte(2.5, 6), vy: sorte(5, 9), vz: sorte(3, 7),
              w: lado() * sorte(8, 14), h: ex.alt, l: ex.alt * ex.a, rest: 0.42, atrito: 6, ref: { chave: ex.chave },
            });
          } else if (q < 12) soltar(0, p.x, 0.5, p.z, 1);
        }
      }
      ex.lastResta = resta;
      const linhaFrente = Math.max(0, resta - ex.cols);
      for (let i = 0; i < resta; i++) {
        const p = ex.pos[i];
        // no choque a linha da frente avanca contra o bando e todos tremem; parado, so respiram
        const alvo = emChoque ? (i >= linhaFrente ? 0.45 : 0.15) : 0;
        p.empurra += (alvo - p.empurra) * Math.min(1, dt * 10);
        const pulo = Math.abs(Math.sin(tempo * (emChoque ? 13 : 4) + p.f * 6.28)) * (emChoque ? 0.2 : 0.06);
        const treme = emChoque ? Math.sin(tempo * 31 + i) * 0.05 : 0;
        V1.set(p.x + treme, pulo, p.z + p.empurra);
        V2.set(ex.alt * ex.a, ex.alt, 1);
        M1.compose(V1, camera.quaternion, V2);
        ex.m.setMatrixAt(i, M1);
      }
      ex.m.count = resta;
      ex.m.instanceMatrix.needsUpdate = true;
      r.placa.escrever(String(restaQtd), '#e8445a');
      r.placa.sprite.visible = restaQtd > 0 && ev.z > c.z - 4;
      ex.m.visible = ev.z > c.z - 5;
    } else if (ev.tipo === 'moeda') {
      if (r.m.visible) {
        r.m.scale.x = 0.75 * Math.max(0.15, Math.abs(Math.cos(tempo * 4 + ev.z)));
        r.m.position.y = 0.35 + Math.sin(tempo * 3 + ev.z) * 0.08;
      }
    } else if (ev.tipo === 'gaiola') {
      if (passou && r.m.visible) {
        r.m.visible = false;
        r.placa.sprite.visible = false;
      }
    }
  }

  function desenhar() {
    renderer.render(scene, camera);
  }

  /**
   * Ponto do mundo (x, y, z da simulacao) na tela, em px CSS.
   * @param {number} x @param {number} y @param {number} z
   */
  function paraTela(x, y, z) {
    V1.set(x, y, -z).project(camera);
    return { x: (V1.x * 0.5 + 0.5) * W, y: (-V1.y * 0.5 + 0.5) * H };
  }

  return {
    renderer,
    medir,
    montarFase,
    reagir,
    atualizar,
    desenhar,
    paraTela,
    /** baixa a resolucao (aparelho lento) */
    economizar() {
      dprMax = 1;
      medir(W, H);
    },
    get centro() { return centro; },
    /** @param {'largada'|'corrida'} f */
    focar(f) { foco = f; },
    /** confete de estrelas no bando (festa) */
    festa() { for (let i = 0; i < 24; i++) soltar(2, centro.x, centro.y + 1.5, centro.z, 5); },
    /** resolve quando o lider bate no castelo (true) ou na hora, se nao houver final (false) */
    esperarImpacto() { return final ? final.pImpacto : Promise.resolve(false); },
    /** resolve quando o castelo ja caiu e o lider pousou */
    esperarFim() { return final ? final.pFim : Promise.resolve(); },
    /** numeros para os testes no navegador */
    get fisica() { return { patos: bando.n, corpos: corpos.lista.length, final: final ? final.fase : null }; },
    get quaternion() { return Q_ID; },
  };
}
