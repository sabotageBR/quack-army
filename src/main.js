// Quack Army: montagem do jogo. O UNICO modulo que toca portal, DOM, audio e salvamento
// (test/estilo.test.js). Ciclo do portal como no kit multiportal:
//
//  1. ganchos do portal ANTES do init (anuncio cala o audio e congela o laco; mudo e pausa do portal);
//  2. portal.init() primeiro, sem nada pesado antes (o handshake do californiagames.io dura 1,5 s);
//  3. carregar a arte com gameLoadingProgress; o laco so comeca depois do init;
//  4. idioma do portal (Poki: vazio, vale o navegador); progresso da nuvem do portal quando existe;
//  5. gameLoadingFinished no primeiro quadro; gameplayStart SO em jogadorAgiu() (gesto real);
//  6. commercialBreak SO em pausa natural (a troca de fase) e so depois da FASE_PRIMEIRO_INTERVALO;
//  7. video premiado so por escolha, fora da corrida, com opcao gratis do mesmo tamanho;
//  8. ESC, espaco ou P pausam; aba oculta pausa; o mudo do portal nao desfaz o do jogador;
//  9. portal.intervaloSoNoClique (Y8): o intervalo so sai depois de um clique em "Continuar";
//     portal.pausaNoBlur (Y8): perder o foco abre a pausa.
import { portal, PLATAFORMA } from './core/plataforma.js';
import { criarArmazem } from './core/armazenamento.js';
import { criarAudio } from './core/audio.js';
import { criarHaptico } from './core/haptico.js';
import { criarLaco } from './core/laco.js';
import { criarEntrada } from './core/entrada.js';
import { lerDepuracao } from './core/depuracao.js';
import { criarTelemetria } from './core/telemetria.js';
import { escolherIdioma, definirIdioma, aplicarTextos, t, idioma } from './i18n/textos.js';
import { criarMao, celebrar, botaoPremiado } from './ui/kit.js';
import { SONS } from './som/sons.js';
import { criarFase } from './jogo/fase.js';
import { criarCorrida, largar, passoCorrida, reviver, patosDoReviver, progresso, T_DEGRAU } from './jogo/corrida.js';
import { alvoBot } from './jogo/bot.js';
import { MEIA_PISTA, VEL_LATERAL, ESCADA, limiteX, limitar, portaoBom } from './jogo/regras.js';
import {
  metaNova, normalizarMeta, bonusDe, comprar, precoMelhoria, MELHORIAS, LENDAS, lendaDoChefe, faseDaLenda,
  presenteDoDia, pegarPresente,
} from './jogo/meta.js';
import { carregarArte } from './render/arte.js';
import { criarCena } from './render/cena.js';
import { definirDecimal } from './render/rotulos.js';

/** Sem intervalo comercial antes de completar esta fase (~4 min de jogo). */
const FASE_PRIMEIRO_INTERVALO = 6;
/** Reviver por video so a partir desta fase (e uma vez por fase). */
const FASE_REVIVER = 6;
/** Presente do dia so aparece a partir desta fase (o comeco fica limpo). */
const FASE_PRESENTE = 4;

const dbg = lerDepuracao();
const armazem = criarArmazem({ prefixo: 'quackarmy.' });
const audio = criarAudio();
const haptico = criarHaptico();
const tele = criarTelemetria(portal);

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const tela = /** @type {HTMLCanvasElement} */ ($('tela'));
const camada = $('camada');
const mao = criarMao(camada);
const movel = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } })();
if (dbg.limpo) document.body.classList.add('limpo');

// ------------------------------------------------------------------ estado
const E = {
  meta: metaNova(),
  /** @type {import('./jogo/fase.js').Fase|null} */
  fase: null,
  /** @type {import('./jogo/corrida.js').Corrida|null} */
  c: null,
  /** @type {'largada'|'corrida'|'festa'|'derrota'} */
  modo: 'largada',
  alvoX: 0,
  /** @type {null | { px0: number, x0: number }} */
  arrasto: null,
  teclas: { esq: false, dir: false },
  semente: dbg.semente || 7,
  t: 0,
  tModo: 0,
  pausado: false,
  pausaPortal: false,
  menu: false,
  /** depois de reviver ou do bonus do menu, a corrida espera um toque (gameplayStart no gesto) */
  esperandoToque: false,
  /** falhas seguidas nesta fase (ajuda automatica a partir de 1) */
  falhas: 0,
  ajudaContada: false,
  /** @type {Set<number>} fases em que o reviver ja foi usado */
  reviveu: new Set(),
  /** ultimo "plim" de moeda (uma fileira toca um som so, nunca uma contagem) */
  ultimaMoeda: -9,
};

function carregarProgresso() {
  E.meta = dbg.novo ? metaNova() : normalizarMeta(armazem.ler('progresso', null));
  if (dbg.fase) E.meta.fase = dbg.fase;
}
function salvar() {
  armazem.gravar('progresso', E.meta);
}
/** Numero do dia local (presente do dia). */
const hoje = () => {
  const d = new Date();
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
};

// ------------------------------------------------------------------ portal: ganchos antes do init
const laco = criarLaco({ passo, desenhar });
portal.onAdStart = () => {
  audio.mudoParaAnuncio();
  laco.pausar(true);
};
portal.onAdEnd = () => {
  audio.voltarDoAnuncio();
  if (!congelado()) laco.pausar(false);
};
portal.onMudoPlataforma = (m) => audio.definirMudoPlataforma(m);
portal.onPausaPlataforma = (p) => {
  E.pausaPortal = p;
  if (p) portal.gameplayStop();
  laco.pausar(congelado() || portal.emAnuncio);
};
portal.onSemAnuncios = () => atualizarVideos();

const congelado = () => E.pausado || E.pausaPortal || E.menu;

/** Unico lugar com gameplayStart: gesto real do jogador, fora de pausa e de anuncio. */
function jogadorAgiu() {
  if (congelado() || portal.emAnuncio) return;
  portal.gameplayStart();
}

// ------------------------------------------------------------------ cena
const cena = criarCena(tela, { filme: dbg.filme > 0, movel });
let W = 1;
let H = 1;
function medir() {
  W = window.innerWidth;
  H = window.innerHeight;
  cena.medir(W, H);
}

// ------------------------------------------------------------------ fases
/** Monta a fase n na largada (o bando parado, cartoes de melhoria embaixo). @param {number} n */
function prepararFase(n) {
  E.fase = criarFase(n, E.semente);
  E.c = criarCorrida(E.fase, bonusDe(E.meta));
  E.modo = 'largada';
  E.tModo = 0;
  E.alvoX = 0;
  E.arrasto = null;
  E.esperandoToque = false;
  E.ajudaContada = false;
  cena.montarFase(E.fase, { lenda: E.meta.ativa, escadaInicio: bonusDe(E.meta).escadaInicio, n: E.c.n });
  cena.focar('largada');
  $('hudFase').textContent = t('fase', { n });
  $('hudFim').setAttribute('src', E.fase.chefe ? `src/arte/${{ reisapo: 'chefes/reisapo', tubarao: 'chefes/tubarao', polvo: 'chefes/polvo', imperador: 'chefes/imperador' }[E.fase.chefe.tipo]}.webp` : 'src/arte/ui/trofeu.webp');
  mostrarLargada();
}

/** Recria a corrida da largada com o bonus novo (comprou melhoria, trocou de lenda). @param {boolean} [cenaToda] */
function refazerLargada(cenaToda = false) {
  if (!E.fase || E.modo !== 'largada') return;
  E.c = criarCorrida(E.fase, bonusDe(E.meta));
  if (cenaToda) cena.montarFase(E.fase, { lenda: E.meta.ativa, escadaInicio: bonusDe(E.meta).escadaInicio, n: E.c.n });
}

function mostrarLargada() {
  const n = E.meta.fase;
  $('largada').hidden = false;
  atualizarCartoes();
  const nov = E.fase && E.fase.novidade;
  $('novidade').hidden = !nov;
  if (nov) {
    $('novidadeTexto').textContent = t(`nov_${nov}`);
    const img = { sabonete: 'aderecos/sabonete', sapo: 'inimigos/sapo-1', divisao: 'aderecos/moeda', chefe: 'chefes/reisapo', tubarao: 'inimigos/tubarao-1',
      desliza: 'ui/bolha', polvo: 'inimigos/polvo-1', gaiola: 'aderecos/gaiola', pisca: 'ui/bolha' }[nov] || 'aderecos/estrela';
    $('novidadeImg').setAttribute('src', `src/arte/${img}.webp`);
  }
  const dica = n <= 3 ? t(`dica${n}`) : '';
  $('dica').hidden = !dica;
  $('dica').textContent = dica;
  $('btPresente').hidden = !(n >= FASE_PRESENTE && presenteDoDia(E.meta, hoje()).disponivel);
  $('contaLendas').textContent = `${E.meta.lendas.length}/${LENDAS.length}`;
  $('imgLider').setAttribute('src', E.meta.ativa ? `src/arte/lendas/${E.meta.ativa}.webp` : 'src/arte/ui/cabeca.webp');
}

function atualizarCartoes() {
  for (const el of document.querySelectorAll('.cartao')) {
    const id = /** @type {string} */ (el.getAttribute('data-melhoria'));
    const nivel = E.meta.melhorias[id] || 0;
    const p = precoMelhoria(id, nivel);
    /** @type {HTMLElement} */ (el.querySelector('.preco i')).textContent = Number.isFinite(p) ? String(p) : t('maximo');
    /** @type {HTMLElement} */ (el.querySelector('.nv')).textContent = t('nivel', { n: nivel + 1 });
    el.classList.toggle('caro', !Number.isFinite(p) || E.meta.moedas < p);
    el.classList.toggle('pode', Number.isFinite(p) && E.meta.moedas >= p);
  }
  $('hudMoedas').textContent = String(E.meta.moedas + (E.c ? E.c.moedas : 0));
}

/** Primeiro gesto na largada: a corrida comeca. */
function largarCorrida() {
  if (!E.c || E.modo !== 'largada' || congelado()) return;
  jogadorAgiu();
  largar(E.c);
  cena.focar('corrida');
  E.modo = 'corrida';
  E.tModo = 0;
  $('largada').hidden = true;
  $('novidade').hidden = true;
  if (E.meta.fase > 1) $('dica').hidden = true;
  tele.fase(E.meta.fase, 'start');
}

// ------------------------------------------------------------------ laco
/** @param {number} dt */
function passo(dt) {
  if (congelado()) return;
  E.t += dt;
  E.tModo += dt;
  const c = E.c;
  if (!c) return;
  if (E.modo === 'largada') {
    if (dbg.auto && E.tModo > 0.7) largarCorrida();
    guiaLargada();
    return;
  }
  if (E.modo !== 'corrida') return;
  if (E.esperandoToque) {
    if (dbg.auto) { E.esperandoToque = false; jogadorAgiu(); }
    return;
  }
  if (portal.jogando) tele.jogando(dt);
  // teclado: o alvo anda na velocidade lateral
  const lim = limiteX(c.n);
  if (E.teclas.esq !== E.teclas.dir) E.alvoX = limitar(E.alvoX + (E.teclas.dir ? 1 : -1) * VEL_LATERAL * dt, -lim, lim);
  const alvo = dbg.auto ? alvoBot(c, 'guloso').x : E.alvoX;
  const ac = passoCorrida(c, dt, alvo);
  if (ac.length) tratar(ac);
  guiaCorrida();
  if (E.meta.fase === 1 && E.tModo > 2.5) $('dica').hidden = true;
  if (E.meta.fase <= 3 && E.tModo > 5) $('dica').hidden = true;
}

/** Mao-guia na largada: arrasto para os lados (primeiras fases, ajuda e jogador parado). */
function guiaLargada() {
  if (E.meta.fase <= 3 || E.falhas > 0 || E.tModo > 4) {
    const y = H * (H > W ? 0.6 : 0.56);
    mao.mostrar(W / 2 - Math.min(W, 520) * 0.18, y, { ateX: W / 2 + Math.min(W, 520) * 0.18, ateY: y });
  } else mao.esconder();
}

/** Mao-guia na corrida: aponta o melhor lado antes da decisao (fases 1-2 e depois de errar). */
function guiaCorrida() {
  const c = /** @type {NonNullable<typeof E.c>} */ (E.c);
  const ajuda = E.meta.fase <= 2 || E.falhas > 0;
  if (!ajuda || c.estado !== 'correndo' || dbg.auto) {
    mao.esconder();
    return;
  }
  const { x, ev } = alvoBot(c, 'guloso');
  if (!ev || ev.z - c.z > c.fase.velocidade * 2.2 || Math.abs(x - c.x) < 0.7) {
    mao.esconder();
    return;
  }
  if (E.falhas > 0 && !E.ajudaContada) {
    E.ajudaContada = true;
    tele.ajuda(E.meta.fase);
  }
  const a = cena.paraTela(c.x, 0.2, c.z);
  const b = cena.paraTela(x, 0.2, c.z);
  mao.mostrar(a.x, a.y + 30, { ateX: b.x, ateY: b.y + 30 });
}

/** Reage ao que a simulacao contou neste passo. @param {any[]} ac */
function tratar(ac) {
  const c = /** @type {NonNullable<typeof E.c>} */ (E.c);
  cena.reagir(ac, c);
  for (const a of ac) {
    switch (a.tipo) {
      case 'portao':
        if (portaoBom(a.op) && a.depois >= a.antes) {
          audio.tocarReceita(SONS.portao, { k: Math.min(1, (a.depois - a.antes) / Math.max(1, a.antes * 2)) }, { chave: 'portao' });
          haptico.vibrar(12);
        } else {
          audio.tocarReceita(SONS.ruim, {}, { chave: 'ruim' });
          haptico.vibrar([20, 30, 20]);
        }
        break;
      case 'obstaculo':
        audio.tocarReceita(SONS.plop, { k: a.frac }, { chave: 'plop' });
        haptico.vibrar(25);
        break;
      case 'choque':
        audio.tocarReceita(a.choque.tipo === 'chefe' ? SONS.chefe : SONS.choque, {}, { chave: 'choque' });
        haptico.vibrar(30);
        break;
      case 'moeda':
        if (E.t - E.ultimaMoeda > 0.7) {
          E.ultimaMoeda = E.t;
          audio.tocarReceita(SONS.moeda, {}, { chave: 'moeda', max: 1 });
        }
        $('hudMoedas').textContent = String(E.meta.moedas + c.moedas);
        break;
      case 'gaiola':
        audio.tocarReceita(SONS.gaiola, {}, { chave: 'gaiola' });
        haptico.vibrar(15);
        break;
      case 'escudo':
        audio.tocarReceita(SONS.escudo, {}, { chave: 'escudo' });
        break;
      case 'escada': {
        // uma subida continua do tamanho da escada que o bando vai fazer (nada de nota por degrau)
        const e = c.escada;
        const degraus = e ? Math.min(ESCADA.length - c.bonus.escadaInicio, Math.floor(c.n / Math.max(1, e.k))) : 0;
        if (degraus > 0) audio.tocarReceita(SONS.subida, { dur: degraus * T_DEGRAU }, { chave: 'subida', max: 1 });
        break;
      }
      case 'venceu-chefe':
        audio.tocarReceita(SONS.castelo, {}, { chave: 'castelo' });
        break;
      case 'vitoria':
        // o som e a festa saem quando o lider bate no castelo (faseCompleta espera a cena)
        faseCompleta();
        break;
      case 'derrota':
        audio.tocarReceita(SONS.derrota, {}, { chave: 'derrota' });
        haptico.vibrar([40, 60, 40]);
        mostrarDerrota();
        break;
      default:
        break;
    }
  }
}

// ------------------------------------------------------------------ fim de fase
async function faseCompleta() {
  const c = /** @type {NonNullable<typeof E.c>} */ (E.c);
  const f = /** @type {NonNullable<typeof E.fase>} */ (E.fase);
  E.modo = 'festa';
  mao.esconder();
  $('dica').hidden = true;
  portal.gameplayStop();
  const n = f.n;
  tele.fase(n, 'complete');
  E.meta.moedas += c.ganho;
  E.falhas = 0;
  /** @type {string} */
  let novaLenda = '';
  if (f.chefe) {
    tele.evento('chefe', `vencido-${n}`);
    portal.festa();
    const i = lendaDoChefe(n);
    if (i >= 0 && !E.meta.lendas.includes(LENDAS[i].id)) {
      novaLenda = LENDAS[i].id;
      E.meta.lendas.push(novaLenda);
      if (!E.meta.ativa) E.meta.ativa = novaLenda;
      tele.evento('lenda', novaLenda);
    }
  }
  E.meta.fase = n + 1;
  salvar();
  // o lider sobe o que falta da escada e derruba o castelo; a festa comeca no impacto
  await cena.esperarImpacto();
  audio.tocarReceita(SONS.vitoria, {}, { chave: 'festa' });
  audio.tocarReceita(SONS.castelo, {}, { chave: 'castelo' });
  haptico.vibrar([20, 40, 30]);
  $('hudMoedas').textContent = String(E.meta.moedas);
  $('hudMoedas').parentElement?.classList.remove('ganhou');
  void $('hudMoedas').offsetWidth;
  $('hudMoedas').parentElement?.classList.add('ganhou');
  cena.festa();
  if (novaLenda) {
    $('lendaNovaImg').setAttribute('src', `src/arte/lendas/${novaLenda}.webp`);
    $('lendaNovaNome').textContent = t(`l_${novaLenda}`);
    $('lendaNova').hidden = false;
  }
  // festa curta, sem tela de "fase concluida": a proxima fase ja aparece na largada
  await Promise.all([
    celebrar(camada, f.chefe ? t('vitoriaChefe') : t('vitoria'), { sub: `+${c.ganho}`, ms: novaLenda ? 2400 : 1800 }),
    cena.esperarFim(),
  ]);
  $('lendaNova').hidden = true;
  // pausa natural: o unico ponto do intervalo comercial
  await intervalo(n);
  prepararFase(E.meta.fase);
}

/** s de jogo no ultimo intervalo pedido (so para o portal que exige clique) */
let ultimoIntervalo = -Infinity;
/** @param {number} faseFeita */
async function intervalo(faseFeita) {
  if (dbg.semAnuncio || !portal.temAnuncios || faseFeita < FASE_PRIMEIRO_INTERVALO) return;
  if (portal.intervaloSoNoClique) {
    // Y8: o intersticial so pode sair logo depois de um clique num botao (nunca automatico), e o portal
    // so exibe um a cada ~3 min: o botao "Continuar" aparece so quando o intervalo pode sair de fato.
    if (tele.segundos - ultimoIntervalo < 180) return;
    await esperarClique(/** @type {HTMLButtonElement} */ ($('btSeguir')));
  }
  ultimoIntervalo = tele.segundos;
  await portal.commercialBreak();
}
/** @param {HTMLButtonElement} bt */
function esperarClique(bt) {
  return new Promise((ok) => {
    bt.hidden = false;
    bt.addEventListener('click', () => { bt.hidden = true; ok(undefined); }, { once: true });
  });
}

function mostrarDerrota() {
  const f = /** @type {NonNullable<typeof E.fase>} */ (E.fase);
  const c = /** @type {NonNullable<typeof E.c>} */ (E.c);
  E.modo = 'derrota';
  mao.esconder();
  portal.gameplayStop();
  tele.fase(f.n, 'fail');
  E.falhas++;
  const noChefe = !!(f.chefe && c.vidaChefe > 0 && c.z >= f.comprimento);
  $('derrotaTitulo').textContent = noChefe ? t('derrotaChefe') : t('derrota');
  const rv = /** @type {HTMLButtonElement} */ ($('btReviver'));
  rv.dataset.ok = String(f.n >= FASE_REVIVER && !E.reviveu.has(f.n));
  botaoPremiado(rv, t('reviver', { n: patosDoReviver(c) }));
  atualizarVideos();
  if (dbg.auto) {
    setTimeout(() => tentarDeNovo(), 600);
    return;
  }
  setTimeout(() => { if (E.modo === 'derrota') $('derrota').hidden = false; }, 700);
}

function tentarDeNovo() {
  $('derrota').hidden = true;
  if (!E.fase) return;
  prepararFase(E.fase.n);
}

async function pedirReviver() {
  if (E.modo !== 'derrota' || !E.c || !E.fase) return;
  const n = E.fase.n;
  const ok = await portal.rewardedBreak('medium');
  if (ok && E.modo === 'derrota') {
    E.reviveu.add(n);
    tele.evento('reviver', 'premio');
    reviver(E.c, patosDoReviver(E.c));
    $('derrota').hidden = true;
    E.modo = 'corrida';
    E.esperandoToque = true;
    $('dica').textContent = t('largar');
    $('dica').hidden = false;
  }
  atualizarVideos();
}

// ------------------------------------------------------------------ desenho
let carregouJa = false;
let lentos = 0;
/** @param {number} dtReal */
function desenhar(dtReal) {
  const dt = congelado() || portal.emAnuncio ? 0 : Math.min(0.05, dtReal);
  cena.atualizar(dt, E.c);
  cena.desenhar();
  if (E.c && E.modo !== 'largada') {
    /** @type {HTMLElement} */ ($('hudProgresso')).style.width = `${progresso(E.c) * 100}%`;
  } else /** @type {HTMLElement} */ ($('hudProgresso')).style.width = '0%';
  // qualidade adaptativa: celular lento abaixa a resolucao uma vez
  if (laco.medidas.fps && laco.medidas.fps < 40 && !dbg.filme) {
    if (++lentos === 240) cena.economizar();
  } else lentos = 0;
  primeiroQuadro();
}

function primeiroQuadro() {
  if (carregouJa) return;
  carregouJa = true;
  portal.gameLoadingFinished();
  $('carregando').classList.add('saindo');
  setTimeout(() => $('carregando').remove(), 400);
}

// ------------------------------------------------------------------ menus
function abrirMenu() {
  if (E.menu || $('derrota').hidden === false) return;
  E.menu = true;
  portal.gameplayStop();
  laco.pausar(true);
  mao.esconder();
  atualizarVideos();
  $('menu').hidden = false;
}
function fecharMenu() {
  if (!E.menu) return;
  E.menu = false;
  $('menu').hidden = true;
  laco.pausar(congelado() || portal.emAnuncio);
}
/** @param {string} id */
function abrirTela(id) {
  E.menu = true;
  laco.pausar(true);
  mao.esconder();
  atualizarVideos();
  $(id).hidden = false;
}
/** @param {string} id */
function fecharTela(id) {
  $(id).hidden = true;
  E.menu = false;
  laco.pausar(congelado() || portal.emAnuncio);
}

const bonusMenu = () => 40 + 10 * Math.min(60, E.meta.fase);
function atualizarVideos() {
  const v = portal.temVideo;
  const bt = /** @type {HTMLButtonElement} */ ($('btBonus'));
  bt.hidden = !v;
  if (v) botaoPremiado(bt, t('moedasVideo', { n: bonusMenu() }));
  const rv = /** @type {HTMLButtonElement} */ ($('btReviver'));
  rv.hidden = !(v && rv.dataset.ok === 'true');
  const pd = /** @type {HTMLButtonElement} */ ($('btPegarDobro'));
  pd.hidden = !v;
  if (v) botaoPremiado(pd, t('pegarDobro'));
}
async function pedirBonus() {
  const ok = await portal.rewardedBreak('small');
  if (ok) {
    E.meta.moedas += bonusMenu();
    salvar();
    tele.evento('bonus', 'premio');
    fecharMenu();
    if (E.modo === 'corrida') E.esperandoToque = true;
    atualizarCartoes();
    celebrar(camada, `+${bonusMenu()}`);
  }
  atualizarVideos();
}

function abrirLendas() {
  const grade = $('gradeLendas');
  grade.innerHTML = '';
  for (const [i, l] of LENDAS.entries()) {
    const tem = E.meta.lendas.includes(l.id);
    const bt = document.createElement('button');
    bt.type = 'button';
    bt.className = `lenda${tem ? '' : ' trancada'}${E.meta.ativa === l.id ? ' ativa' : ''}`;
    const img = document.createElement('img');
    img.src = `src/arte/lendas/${l.id}.webp`;
    img.alt = '';
    const b = document.createElement('b');
    b.textContent = tem ? t(`l_${l.id}`) : t('bloqueada', { n: faseDaLenda(i) });
    const s = document.createElement('small');
    s.textContent = tem ? (E.meta.ativa === l.id ? t('ativa') : t(`l_${l.id}_d`)) : t(`l_${l.id}_d`);
    bt.append(img, b, s);
    bt.addEventListener('click', () => {
      if (!tem) {
        audio.tocarReceita(SONS.nao, {}, { chave: 'nao' });
        return;
      }
      E.meta.ativa = l.id;
      salvar();
      audio.tocarReceita(SONS.compra, {}, { chave: 'compra' });
      tele.evento('lenda-ativa', l.id);
      refazerLargada(true);
      abrirLendas();
      mostrarLargada();
    });
    grade.appendChild(bt);
  }
  const prox = LENDAS.findIndex((l) => !E.meta.lendas.includes(l.id));
  $('proximaLenda').textContent = prox >= 0 ? t('proximaLenda', { n: faseDaLenda(prox) }) : '';
  if ($('lendasTela').hidden) abrirTela('lendasTela');
}

function abrirPresente() {
  const p = presenteDoDia(E.meta, hoje());
  if (!p.disponivel) return;
  $('presenteValor').textContent = String(p.valor);
  $('presenteSub').textContent = t('presenteSub', { n: p.seq });
  abrirTela('presenteTela');
}
/** @param {number} mult */
async function pegar(mult) {
  if (mult > 1) {
    const ok = await portal.rewardedBreak('small');
    if (!ok) { atualizarVideos(); return; }
  }
  const ganho = pegarPresente(E.meta, hoje(), mult);
  if (ganho > 0) {
    salvar();
    tele.evento('presente', mult > 1 ? 'video' : 'gratis');
    audio.tocarReceita(SONS.moeda, { k: 3 }, { chave: 'moeda' });
  }
  fecharTela('presenteTela');
  mostrarLargada();
  if (ganho > 0) celebrar(camada, `+${ganho}`);
}

// ------------------------------------------------------------------ entrada
/** @param {number} x px */
function moverArrasto(x) {
  if (!E.arrasto || !E.c) return;
  const escala = (2 * MEIA_PISTA) / (Math.min(W, H * 1.3) * 0.62);
  const lim = limiteX(E.c.n);
  let alvo = E.arrasto.x0 + (x - E.arrasto.px0) * escala;
  if (Math.abs(alvo) > lim) {
    alvo = limitar(alvo, -lim, lim);
    E.arrasto.x0 = alvo;
    E.arrasto.px0 = x;
  }
  E.alvoX = alvo;
}

criarEntrada(window, {
  primeiroGesto: () => audio.iniciar(),
  ponteiro: (fase, x, y, e) => {
    if (E.menu) return;
    if (fase === 'baixo') {
      tele.gesto(e.pointerType === 'mouse' ? 'mouse' : 'toque');
      E.arrasto = { px0: x, x0: E.c ? E.c.x : 0 };
      if (E.modo === 'largada') largarCorrida();
      else if (E.modo === 'corrida') {
        if (E.esperandoToque) {
          E.esperandoToque = false;
          $('dica').hidden = true;
        }
        jogadorAgiu();
      }
    } else if (fase === 'mover') moverArrasto(x);
    else if (fase === 'cima') E.arrasto = null;
  },
  tecla: (codigo, baixo) => {
    if (codigo === 'Escape' || codigo === 'Space' || codigo === 'KeyP') {
      if (!baixo) return;
      if (E.menu && !$('menu').hidden) fecharMenu();
      else if (!E.menu) abrirMenu();
      return;
    }
    const esq = codigo === 'KeyA' || codigo === 'ArrowLeft';
    const dir = codigo === 'KeyD' || codigo === 'ArrowRight';
    if (!esq && !dir) return;
    if (esq) E.teclas.esq = baixo;
    if (dir) E.teclas.dir = baixo;
    if (!baixo || E.menu) return;
    if (E.c && !E.teclas.esq !== !E.teclas.dir) E.alvoX = E.c.x;
    if (E.modo === 'largada') largarCorrida();
    else if (E.modo === 'corrida') {
      if (E.esperandoToque) {
        E.esperandoToque = false;
        $('dica').hidden = true;
      }
      jogadorAgiu();
    }
  },
});
$('btPausa').addEventListener('click', () => abrirMenu());
$('btContinuar').addEventListener('click', () => { fecharMenu(); jogadorAgiu(); });
$('btBonus').addEventListener('click', () => pedirBonus());
$('btSom').addEventListener('click', () => {
  audio.definirMudo(!audio.mudo);
  $('btSom').setAttribute('aria-pressed', String(!audio.mudo));
  armazem.gravar('mudo', audio.mudo);
});
$('btTentar').addEventListener('click', () => tentarDeNovo());
$('btReviver').addEventListener('click', () => pedirReviver());
$('btLendas').addEventListener('click', () => abrirLendas());
$('btFecharLendas').addEventListener('click', () => fecharTela('lendasTela'));
$('btPresente').addEventListener('click', () => abrirPresente());
$('btPegar').addEventListener('click', () => pegar(1));
$('btPegarDobro').addEventListener('click', () => pegar(2));
for (const el of document.querySelectorAll('.cartao')) {
  el.addEventListener('click', () => {
    const id = /** @type {string} */ (el.getAttribute('data-melhoria'));
    if (E.modo !== 'largada') return;
    if (comprar(E.meta, id)) {
      salvar();
      audio.tocarReceita(SONS.compra, {}, { chave: 'compra' });
      haptico.vibrar(10);
      tele.evento('melhoria', `${id}-${E.meta.melhorias[id]}`);
      refazerLargada();
      atualizarCartoes();
    } else audio.tocarReceita(SONS.nao, {}, { chave: 'nao' });
  });
}
document.addEventListener('visibilitychange', () => {
  audio.pausarAba(document.hidden);
  if (document.hidden) {
    portal.gameplayStop();
    laco.pausar(true);
  } else laco.pausar(congelado() || portal.emAnuncio);
});
// Y8: pausar quando a janela perde o foco (requisito do portal)
window.addEventListener('blur', () => { if (portal.pausaNoBlur && carregouJa) abrirMenu(); });
// o iframe do portal precisa de foco para o teclado (espaco nao rola a pagina do portal)
window.addEventListener('pointerdown', () => { try { window.focus(); } catch { /* ignora */ } });
window.addEventListener('resize', medir);

// ------------------------------------------------------------------ partida
async function iniciar() {
  medir();
  const pedidoInit = portal.init();
  const barra = /** @type {HTMLElement|null} */ (document.querySelector('#carregando .barra i'));
  const fonte = Promise.race([document.fonts ? document.fonts.load("700 64px 'Fredoka'") : Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]);
  await carregarArte((f) => {
    portal.gameLoadingProgress(f);
    if (barra) barra.style.width = `${f * 100}%`;
  }, cena.renderer.capabilities.getMaxAnisotropy ? Math.min(4, cena.renderer.capabilities.getMaxAnisotropy()) : 1);
  await fonte;
  await pedidoInit;
  armazem.usarFonte(await portal.fonteDados(), ['progresso', 'mudo']);
  definirIdioma(escolherIdioma(dbg.lang || portal.idioma || navigator.language));
  document.documentElement.lang = { pt: 'pt-BR', en: 'en', es: 'es' }[idioma()];
  definirDecimal(idioma() === 'en' ? '.' : ',');
  aplicarTextos(document);
  audio.definirMudo(armazem.ler('mudo', false) === true);
  $('btSom').setAttribute('aria-pressed', String(!audio.mudo));
  carregarProgresso();
  prepararFase(E.meta.fase);
  atualizarVideos();
  if (dbg.filme) {
    desenhar(0);
    return;
  }
  laco.iniciar();
}

// ------------------------------------------------------------------ ganchos de teste (so local)
if (dbg.ganchos) {
  /** @type {any} */ (window).__jogo = {
    E,
    portal,
    audio,
    cena,
    plataforma: PLATAFORMA,
    get lang() { return idioma(); },
    get jogou() { return portal.jogando; },
    get emAnuncio() { return portal.emAnuncio; },
    get menuAberto() { return E.menu; },
    get moedas() { return E.meta.moedas; },
    /** posicao (px CSS) do bando, para cliques e arrastos reais dos roteiros */
    alvo() {
      const c = E.c;
      if (!c) return { x: W / 2, y: H * 0.7 };
      const p = cena.paraTela(c.x, 0.3, c.z);
      return { x: limitar(p.x, 20, W - 20), y: limitar(p.y, 80, H - 20) };
    },
    /** vai para a largada da fase n */
    irFase(/** @type {number} */ n) {
      E.meta.fase = n;
      E.falhas = 0;
      $('derrota').hidden = true;
      prepararFase(n);
    },
    /** vence a fase atual na hora (prints e provas) */
    completar() {
      if (!E.c || (E.modo !== 'corrida' && E.modo !== 'largada')) return;
      E.modo = 'corrida';
      E.c.escada = { k: 1, degraus: 5, t: 0 };
      E.c.estado = 'vitoria';
      E.c.ganho = 20;
      faseCompleta();
    },
    /** perde a fase atual na hora (prints e provas da tela de derrota) */
    perder() {
      if (!E.c || E.modo === 'derrota') return;
      E.modo = 'corrida';
      E.c.n = 0;
      E.c.estado = 'derrota';
      mostrarDerrota();
    },
    /** um quadro de video sem relogio real (?filme): avanca 1/fps e devolve o JPEG */
    quadro(fps = 30) {
      const passos = Math.max(1, Math.round(60 / fps));
      for (let i = 0; i < passos; i++) passo(1 / 60);
      desenhar(1 / fps);
      return tela.toDataURL('image/jpeg', 0.9);
    },
  };
}

iniciar();
