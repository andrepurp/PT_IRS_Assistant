// Dividendos de fonte estrangeira (Anexo J, Quadro 8A).
//
// Em Portugal os dividendos são tributados à taxa autónoma de 28% (opção de englobamento
// possível, mas aqui assumimos a taxa liberatória). Existe crédito de imposto por dupla
// tributação internacional: deduz-se o imposto pago no estrangeiro, limitado à fração da coleta
// portuguesa correspondente a esse rendimento (ou seja, no máximo 28% do bruto).
//
// Nota: ao abrigo das convenções (CDT), a retenção no estrangeiro costuma estar limitada (ex.: 15%
// nos EUA). Se a corretora reteve mais do que a convenção permite, só a parte convencionada é
// creditável — o excesso tem de ser reclamado ao país da fonte. Este cálculo usa o imposto
// efetivamente retido como estimativa.

export const TAXA_DIVIDENDOS = 0.28;

const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

// entries: [{ pais, bruto, impostoEstrangeiro }]
export function calcDividendos(entries) {
  const tot = (entries || []).reduce(
    (acc, e) => {
      const bruto = parseFloat(e.bruto) || 0;
      const estrangeiro = parseFloat(e.impostoEstrangeiro) || 0;
      const impostoPT = bruto * TAXA_DIVIDENDOS;
      const credito = Math.min(estrangeiro, impostoPT); // limitado à coleta PT desse rendimento
      acc.bruto += bruto;
      acc.impostoEstrangeiro += estrangeiro;
      acc.impostoPT += impostoPT;
      acc.credito += credito;
      return acc;
    },
    { bruto: 0, impostoEstrangeiro: 0, impostoPT: 0, credito: 0 }
  );
  return {
    bruto: round2(tot.bruto),
    impostoEstrangeiro: round2(tot.impostoEstrangeiro),
    impostoPT: round2(tot.impostoPT),
    credito: round2(tot.credito),
    aPagar: round2(tot.impostoPT - tot.credito), // imposto português ainda a pagar
    liquidoFinal: round2(tot.bruto - tot.impostoEstrangeiro - (tot.impostoPT - tot.credito)),
  };
}
