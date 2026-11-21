// Textos em pt (pt-BR), en e es. O idioma vem do portal (portal.idioma: 'pt-BR' | 'en' | 'es'; vazio na
// Poki, e ai vale o do navegador). Ingles e obrigatorio na CrazyGames: na duvida, en.
// No HTML, data-t="chave" troca o textContent e data-t-aria="chave" o aria-label.

/** @typedef {'pt'|'en'|'es'} Idioma */

export const TEXTOS = {
  pt: {
    titulo: 'Quack Army',
    continuar: 'Continuar',
    seguir: 'Continuar ▶',
    pausa: 'Pausa',
    som: 'Som',
    fase: 'Fase {n}',
    dica1: 'Arraste para guiar o bando!',
    dica2: 'Escolha o portão que dá mais patos!',
    dica3: 'Desvie e fique maior que o inimigo!',
    largar: 'Arraste para correr',
    vitoria: 'Quack-tástico!',
    vitoriaChefe: 'Castelo derrubado!',
    derrota: 'O bando acabou!',
    derrotaChefe: 'O chefe aguentou!',
    tentar: 'Tentar de novo',
    reviver: 'Reviver com {n}',
    moedasVideo: '+{n} moedas',
    melhoriaPatos: 'Patos',
    melhoriaBolha: 'Bolha',
    melhoriaRenda: 'Renda',
    descPatos: '+3 no início',
    descBolha: '+1 nos portões',
    descRenda: '+10% moedas',
    maximo: 'Máx.',
    nivel: 'Nv {n}',
    lendas: 'Lendas',
    lendasTitulo: 'Lendas do Bando',
    lendasSub: 'Cada chefe vencido entrega uma lenda. Toque para escolher quem lidera.',
    proximaLenda: 'Próxima lenda: fase {n}',
    ativa: 'Liderando',
    escolher: 'Escolher',
    bloqueada: 'Fase {n}',
    fechar: 'Fechar',
    presente: 'Presente',
    presenteTitulo: 'Presente do dia',
    presenteSub: 'Dia {n} seguido. Volte amanhã para um presente maior!',
    pegar: 'Pegar',
    pegarDobro: 'Pegar ×2',
    novaLenda: 'Nova lenda!',
    novo: 'Novo!',
    nov_sabonete: 'Sabonetes deslizam: desvie!',
    nov_sapo: 'Sapos de corda: seja maior que eles!',
    nov_divisao: 'Portão ÷ divide o bando. Moedas na pista!',
    nov_chefe: 'Chefe! Chegue com mais patos que a vida dele',
    nov_tubarao: 'Piscina! Tubarões valem 2 patos',
    nov_desliza: 'Portões que deslizam!',
    nov_polvo: 'Lago! Polvos valem 3 patos',
    nov_gaiola: 'Gaiolas: resgate patos presos!',
    nov_pisca: 'Chuveiro! Portões que piscam',
    l_capitao: 'Capitão Bico',
    l_capitao_d: '+5 patos no início',
    l_escudo: 'Pata Escudo',
    l_escudo_d: 'Ignora o 1º obstáculo',
    l_sortudo: 'Pato Sortudo',
    l_sortudo_d: '+2 em todo portão +',
    l_mergulhador: 'Mergulhador',
    l_mergulhador_d: 'Ralos não tiram patos',
    l_ninja: 'Pato Ninja',
    l_ninja_d: 'Obstáculos tiram 40% menos',
    l_almirante: 'Almirante',
    l_almirante_d: 'Inimigos 15% mais fracos',
    l_ouro: 'Pato de Ouro',
    l_ouro_d: '+30% de moedas',
    l_rainha: 'Rainha Pata',
    l_rainha_d: 'Escada começa no ×1,5',
    l_trovao: 'Pato Trovão',
    l_trovao_d: '1º portão × vale +1',
  },
  en: {
    titulo: 'Quack Army',
    continuar: 'Continue',
    seguir: 'Continue ▶',
    pausa: 'Paused',
    som: 'Sound',
    fase: 'Level {n}',
    dica1: 'Drag to lead the flock!',
    dica2: 'Pick the gate that gives more ducks!',
    dica3: 'Dodge, and be bigger than the enemy!',
    largar: 'Drag to run',
    vitoria: 'Quack-tastic!',
    vitoriaChefe: 'Castle down!',
    derrota: 'The flock is gone!',
    derrotaChefe: 'The boss held on!',
    tentar: 'Try again',
    reviver: 'Revive with {n}',
    moedasVideo: '+{n} coins',
    melhoriaPatos: 'Ducks',
    melhoriaBolha: 'Bubble',
    melhoriaRenda: 'Income',
    descPatos: '+3 at start',
    descBolha: '+1 on gates',
    descRenda: '+10% coins',
    maximo: 'Max',
    nivel: 'Lv {n}',
    lendas: 'Legends',
    lendasTitulo: 'Flock Legends',
    lendasSub: 'Every boss you beat hands over a legend. Tap to pick who leads.',
    proximaLenda: 'Next legend: level {n}',
    ativa: 'Leading',
    escolher: 'Pick',
    bloqueada: 'Level {n}',
    fechar: 'Close',
    presente: 'Gift',
    presenteTitulo: 'Daily gift',
    presenteSub: 'Day {n} in a row. Come back tomorrow for a bigger gift!',
    pegar: 'Take',
    pegarDobro: 'Take ×2',
    novaLenda: 'New legend!',
    novo: 'New!',
    nov_sabonete: 'Soap bars slide: dodge them!',
    nov_sapo: 'Wind-up frogs: be bigger than them!',
    nov_divisao: 'The ÷ gate splits the flock. Coins on the track!',
    nov_chefe: 'Boss! Arrive with more ducks than its health',
    nov_tubarao: 'Pool! Sharks are worth 2 ducks',
    nov_desliza: 'Sliding gates!',
    nov_polvo: 'Lake! Octopuses are worth 3 ducks',
    nov_gaiola: 'Cages: rescue trapped ducks!',
    nov_pisca: 'Shower! Blinking gates',
    l_capitao: 'Captain Beak',
    l_capitao_d: '+5 ducks at start',
    l_escudo: 'Shield Duck',
    l_escudo_d: 'Ignores the 1st obstacle',
    l_sortudo: 'Lucky Duck',
    l_sortudo_d: '+2 on every + gate',
    l_mergulhador: 'Diver',
    l_mergulhador_d: 'Drains take no ducks',
    l_ninja: 'Ninja Duck',
    l_ninja_d: 'Obstacles take 40% less',
    l_almirante: 'Admiral',
    l_almirante_d: 'Enemies 15% weaker',
    l_ouro: 'Golden Duck',
    l_ouro_d: '+30% coins',
    l_rainha: 'Queen Duck',
    l_rainha_d: 'Stairs start at ×1.5',
    l_trovao: 'Thunder Duck',
    l_trovao_d: '1st × gate is +1',
  },
  es: {
    titulo: 'Quack Army',
    continuar: 'Continuar',
    seguir: 'Continuar ▶',
    pausa: 'Pausa',
    som: 'Sonido',
    fase: 'Nivel {n}',
    dica1: '¡Arrastra para guiar la bandada!',
    dica2: '¡Elige el portal que da más patos!',
    dica3: '¡Esquiva y sé más grande que el enemigo!',
    largar: 'Arrastra para correr',
    vitoria: '¡Cuac-tástico!',
    vitoriaChefe: '¡Castillo derribado!',
    derrota: '¡Se acabó la bandada!',
    derrotaChefe: '¡El jefe aguantó!',
    tentar: 'Intentar de nuevo',
    reviver: 'Revivir con {n}',
    moedasVideo: '+{n} monedas',
    melhoriaPatos: 'Patos',
    melhoriaBolha: 'Burbuja',
    melhoriaRenda: 'Ingresos',
    descPatos: '+3 al inicio',
    descBolha: '+1 en portales',
    descRenda: '+10% monedas',
    maximo: 'Máx.',
    nivel: 'Nv {n}',
    lendas: 'Leyendas',
    lendasTitulo: 'Leyendas de la Bandada',
    lendasSub: 'Cada jefe vencido entrega una leyenda. Toca para elegir quién lidera.',
    proximaLenda: 'Próxima leyenda: nivel {n}',
    ativa: 'Liderando',
    escolher: 'Elegir',
    bloqueada: 'Nivel {n}',
    fechar: 'Cerrar',
    presente: 'Regalo',
    presenteTitulo: 'Regalo del día',
    presenteSub: 'Día {n} seguido. ¡Vuelve mañana por un regalo mayor!',
    pegar: 'Tomar',
    pegarDobro: 'Tomar ×2',
    novaLenda: '¡Nueva leyenda!',
    novo: '¡Nuevo!',
    nov_sabonete: 'Los jabones se deslizan: ¡esquívalos!',
    nov_sapo: 'Ranas de cuerda: ¡sé más grande que ellas!',
    nov_divisao: 'El portal ÷ divide la bandada. ¡Monedas en la pista!',
    nov_chefe: '¡Jefe! Llega con más patos que su vida',
    nov_tubarao: '¡Piscina! Los tiburones valen 2 patos',
    nov_desliza: '¡Portales que se deslizan!',
    nov_polvo: '¡Lago! Los pulpos valen 3 patos',
    nov_gaiola: 'Jaulas: ¡rescata patos atrapados!',
    nov_pisca: '¡Ducha! Portales que parpadean',
    l_capitao: 'Capitán Pico',
    l_capitao_d: '+5 patos al inicio',
    l_escudo: 'Pata Escudo',
    l_escudo_d: 'Ignora el 1.er obstáculo',
    l_sortudo: 'Pato Suertudo',
    l_sortudo_d: '+2 en cada portal +',
    l_mergulhador: 'Buzo',
    l_mergulhador_d: 'Los desagües no quitan patos',
    l_ninja: 'Pato Ninja',
    l_ninja_d: 'Obstáculos quitan 40% menos',
    l_almirante: 'Almirante',
    l_almirante_d: 'Enemigos 15% más débiles',
    l_ouro: 'Pato de Oro',
    l_ouro_d: '+30% de monedas',
    l_rainha: 'Reina Pata',
    l_rainha_d: 'La escalera empieza en ×1,5',
    l_trovao: 'Pato Trueno',
    l_trovao_d: '1.er portal × vale +1',
  },
};

/**
 * 'pt-BR', 'pt', 'es-419', 'en-US'... -> pt | en | es (o resto vira en).
 * @param {string} codigo
 * @returns {Idioma}
 */
export function escolherIdioma(codigo) {
  const c = String(codigo || '').toLowerCase();
  if (c.startsWith('pt')) return 'pt';
  if (c.startsWith('es')) return 'es';
  return 'en';
}

/** @type {Idioma} */
let atual = 'en';

/** @param {Idioma} i */
export function definirIdioma(i) {
  atual = TEXTOS[i] ? i : 'en';
}

export const idioma = () => atual;

/**
 * @param {string} chave
 * @param {Record<string, string|number>} [vars]
 */
export function t(chave, vars) {
  const tabela = /** @type {Record<string, string>} */ (TEXTOS[atual]);
  let s = tabela[chave] ?? /** @type {Record<string, string>} */ (TEXTOS.en)[chave] ?? chave;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** @param {ParentNode} raiz */
export function aplicarTextos(raiz) {
  for (const el of raiz.querySelectorAll('[data-t]')) el.textContent = t(/** @type {string} */ (el.getAttribute('data-t')));
  for (const el of raiz.querySelectorAll('[data-t-aria]')) el.setAttribute('aria-label', t(/** @type {string} */ (el.getAttribute('data-t-aria'))));
}
