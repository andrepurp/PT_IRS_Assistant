// Cálculo de salário líquido (trabalho dependente, Continente).
//
// Modelo oficial de retenção na fonte (desde 2023): por escalão de remuneração mensal aplica-se
//   Retenção = Remuneração × Taxa marginal máxima − Parcela a abater − (Parcela por dependente × nº)
// Nos primeiros escalões a "parcela a abater" é ela própria uma fórmula (suavização do mínimo de
// existência). Valores da Tabela I 2026 — Continente, confirmados por continuidade entre escalões.
// Fonte: Despacho n.º 233-A/2026; tabelas de retenção na fonte para o Continente (2026).

export const SS_RATE = 0.11; // Segurança Social — contribuição do trabalhador (regime geral).

// Escalões partilhados pela Tabela I e II (só difere a parcela por dependente).
const BRACKETS_I = [
  { limite: 920.0, taxa: 0, parcela: () => 0 },
  { limite: 1042.0, taxa: 0.125, parcela: (R) => 0.125 * 2.6 * (1273.85 - R) },
  { limite: 1108.0, taxa: 0.157, parcela: (R) => 0.157 * 1.35 * (1554.83 - R) },
  { limite: 1154.0, taxa: 0.157, parcela: () => 94.71 },
  { limite: 1212.0, taxa: 0.212, parcela: () => 158.18 },
  { limite: 1819.0, taxa: 0.241, parcela: () => 193.33 },
  { limite: 2119.0, taxa: 0.311, parcela: () => 320.66 },
  { limite: 2499.0, taxa: 0.349, parcela: () => 401.19 },
  { limite: 3305.0, taxa: 0.3836, parcela: () => 487.66 },
  { limite: 5547.0, taxa: 0.3969, parcela: () => 531.62 },
  { limite: 20221.0, taxa: 0.4495, parcela: () => 823.4 },
  { limite: Infinity, taxa: 0.4717, parcela: () => 1272.31 },
];

export const TABELA_2026_I = {
  ano: '2026',
  nome: 'Tabela I — não casado sem dependentes / casado dois titulares',
  dependente: 21.43,
  brackets: BRACKETS_I,
};

export const TABELA_2026_II = {
  ano: '2026',
  nome: 'Tabela II — não casado com dependentes',
  dependente: 34.29,
  brackets: BRACKETS_I,
};

export const TABELA_2026_III = {
  ano: '2026',
  nome: 'Tabela III — casado, único titular',
  dependente: 42.86,
  brackets: [
    { limite: 991.0, taxa: 0, parcela: () => 0 },
    { limite: 1042.0, taxa: 0.125, parcela: (R) => 0.125 * 2.6 * (1372.15 - R) },
    { limite: 1108.0, taxa: 0.125, parcela: (R) => 0.125 * 1.35 * (1677.85 - R) },
    { limite: 1119.0, taxa: 0.125, parcela: () => 96.17 },
    { limite: 1432.0, taxa: 0.1272, parcela: () => 98.64 },
    { limite: 1962.0, taxa: 0.157, parcela: () => 141.32 },
    { limite: 2240.0, taxa: 0.1938, parcela: () => 213.53 },
    { limite: 2773.0, taxa: 0.2277, parcela: () => 289.47 },
    { limite: 3389.0, taxa: 0.257, parcela: () => 370.72 },
    { limite: 5965.0, taxa: 0.2881, parcela: () => 476.12 },
    { limite: 20265.0, taxa: 0.3843, parcela: () => 1049.96 },
    { limite: Infinity, taxa: 0.4717, parcela: () => 2821.13 },
  ],
};

const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

// Retenção mensal de IRS para uma remuneração bruta `gross`.
export function calcRetencaoIRS(gross, tabela, dependentes = 0) {
  if (!(gross > 0)) return 0;
  const b = tabela.brackets.find((x) => gross <= x.limite);
  if (!b || b.taxa === 0) return 0;
  const r = gross * b.taxa - b.parcela(gross) - tabela.dependente * dependentes;
  return Math.max(0, round2(r));
}

// Decomposição do salário: bruto -> Segurança Social + IRS -> líquido.
export function calcSalario(gross, tabela, dependentes = 0) {
  const bruto = round2(gross > 0 ? gross : 0);
  const ss = round2(bruto * SS_RATE);
  const irs = calcRetencaoIRS(bruto, tabela, dependentes);
  const liquido = round2(bruto - ss - irs);
  return {
    bruto,
    ss,
    irs,
    liquido,
    taxaEfetivaIRS: bruto > 0 ? round2((irs / bruto) * 100) : 0,
  };
}
