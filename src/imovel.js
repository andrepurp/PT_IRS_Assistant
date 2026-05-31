// Mais-valias imobiliárias (venda de imóvel) — Anexo G, Quadro 4.
//
// Mais-valia = Valor de realização − (Valor de aquisição × coeficiente de desvalorização)
//              − despesas e encargos (aquisição/venda + valorização nos últimos 12 anos)
// Para residentes, 50% da mais-valia é tributada por englobamento (somada aos outros rendimentos).
//
// Coeficientes de desvalorização da moeda para bens alienados em 2025 — Portaria 382/2025/1,
// confirmados em duas fontes. O coeficiente só se aplica se decorreram mais de 24 meses entre a
// aquisição e a venda (por isso 2024/2025 = 1,00).

export const ANO_VENDA = 2025;

export const COEFICIENTES_2025 = {
  2000: 1.67, 2001: 1.55, 2002: 1.49, 2003: 1.45, 2004: 1.43, 2005: 1.4, 2006: 1.34,
  2007: 1.32, 2008: 1.28, 2009: 1.3, 2010: 1.28, 2011: 1.24, 2012: 1.2, 2013: 1.2,
  2014: 1.2, 2015: 1.2, 2016: 1.19, 2017: 1.18, 2018: 1.17, 2019: 1.17, 2020: 1.17,
  2021: 1.16, 2022: 1.06, 2023: 1.02, 2024: 1.0, 2025: 1.0,
};

const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

export function coeficiente(anoAquisicao) {
  return COEFICIENTES_2025[parseInt(anoAquisicao, 10)] ?? null;
}

// Devolve a decomposição da mais-valia imobiliária. `reinvestimentoTotal` (habitação própria
// permanente reinvestida na totalidade) isenta a parte tributável.
export function calcMaisValiaImovel({
  anoAquisicao,
  valorAquisicao,
  valorRealizacao,
  despesasAquisicao = 0,
  encargosValorizacao = 0,
  despesasVenda = 0,
  reinvestimentoTotal = false,
}) {
  const coef = coeficiente(anoAquisicao);
  const va = parseFloat(valorAquisicao) || 0;
  const vr = parseFloat(valorRealizacao) || 0;
  const despesas = (parseFloat(despesasAquisicao) || 0) + (parseFloat(encargosValorizacao) || 0) + (parseFloat(despesasVenda) || 0);

  if (coef == null) return { coef: null, anoSuportado: false };

  const valorAquisicaoCorrigido = round2(va * coef);
  const maisValia = round2(vr - valorAquisicaoCorrigido - despesas);
  const tributavel = reinvestimentoTotal ? 0 : round2(Math.max(0, maisValia) * 0.5);
  return {
    coef,
    anoSuportado: true,
    valorAquisicaoCorrigido,
    despesas: round2(despesas),
    maisValia,
    tributavel, // 50% (incluído no englobamento, tributado às taxas progressivas)
  };
}
