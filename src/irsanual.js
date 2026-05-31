// Simulador de IRS anual (liquidação) — trabalho dependente, um titular, Continente.
//
// Escalões em vigor para rendimentos de 2025 (art. 68.º CIRS, Lei n.º 73-A/2025). A coleta é
// progressiva: aplica-se a taxa de cada escalão à fração do rendimento nesse escalão. Este método
// (marginal acumulado) é equivalente à fórmula oficial taxa normal / taxa média — verificado:
// no limite de cada escalão, coleta/rendimento dá a taxa média publicada.

export const ANO = 2025;
const SS = 0.11;
const DEDUCAO_ESPECIFICA_MIN = 4104; // dedução específica mínima da categoria A

export const ESCALOES_2025 = [
  { limite: 8342, taxa: 0.125 },
  { limite: 12587, taxa: 0.157 },
  { limite: 17838, taxa: 0.212 },
  { limite: 23089, taxa: 0.241 },
  { limite: 29397, taxa: 0.311 },
  { limite: 43090, taxa: 0.349 },
  { limite: 46566, taxa: 0.431 },
  { limite: 86634, taxa: 0.446 },
  { limite: Infinity, taxa: 0.48 },
];

const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

// Coleta de IRS sobre o rendimento coletável, pelas taxas progressivas.
export function coletaIRS(rendimentoColetavel) {
  let imposto = 0;
  let lower = 0;
  for (const e of ESCALOES_2025) {
    if (rendimentoColetavel > e.limite) {
      imposto += (e.limite - lower) * e.taxa;
      lower = e.limite;
    } else {
      imposto += (rendimentoColetavel - lower) * e.taxa;
      return round2(imposto);
    }
  }
  return round2(imposto);
}

// Estimativa da liquidação anual para um titular (trabalho dependente).
//  saldo > 0 => reembolso; saldo < 0 => imposto a pagar.
export function calcIRSAnual({ rendimentoBruto, retencoes = 0, deducoesColeta = 0 }) {
  const bruto = parseFloat(rendimentoBruto) || 0;
  const contribSS = bruto * SS;
  const deducaoEspecifica = Math.max(DEDUCAO_ESPECIFICA_MIN, round2(contribSS));
  const coletavel = Math.max(0, round2(bruto - deducaoEspecifica));
  const coleta = coletaIRS(coletavel);
  const deducoes = parseFloat(deducoesColeta) || 0;
  const impostoDevido = Math.max(0, round2(coleta - deducoes));
  const ret = parseFloat(retencoes) || 0;
  return {
    deducaoEspecifica,
    coletavel,
    coleta,
    impostoDevido,
    retencoes: round2(ret),
    saldo: round2(ret - impostoDevido), // + reembolso / − a pagar
    taxaEfetiva: bruto > 0 ? round2((impostoDevido / bruto) * 100) : 0,
  };
}
