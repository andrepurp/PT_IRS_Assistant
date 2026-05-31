import { calcDividendos, TAXA_DIVIDENDOS } from './dividendos';

test('dividendo sem imposto estrangeiro paga 28% em Portugal', () => {
  const r = calcDividendos([{ pais: 'EUA', bruto: 1000, impostoEstrangeiro: 0 }]);
  expect(r.impostoPT).toBeCloseTo(280, 2);
  expect(r.credito).toBe(0);
  expect(r.aPagar).toBeCloseTo(280, 2);
});

test('crédito de imposto reduz o imposto a pagar (retenção 15%)', () => {
  const r = calcDividendos([{ pais: 'EUA', bruto: 1000, impostoEstrangeiro: 150 }]);
  expect(r.impostoPT).toBeCloseTo(280, 2);
  expect(r.credito).toBeCloseTo(150, 2); // 150 < 280
  expect(r.aPagar).toBeCloseTo(130, 2); // 280 - 150
  expect(r.liquidoFinal).toBeCloseTo(1000 - 150 - 130, 2); // 720
});

test('o crédito está limitado a 28% do bruto (excesso não é creditável)', () => {
  // Retenção de 35% no estrangeiro — só 28% é creditável em Portugal.
  const r = calcDividendos([{ pais: 'X', bruto: 1000, impostoEstrangeiro: 350 }]);
  expect(r.credito).toBeCloseTo(280, 2);
  expect(r.aPagar).toBeCloseTo(0, 2); // 280 - 280
});

test('soma vários dividendos de países diferentes', () => {
  const r = calcDividendos([
    { pais: 'EUA', bruto: 1000, impostoEstrangeiro: 150 },
    { pais: 'Alemanha', bruto: 500, impostoEstrangeiro: 131.75 },
  ]);
  expect(r.bruto).toBeCloseTo(1500, 2);
  expect(r.impostoPT).toBeCloseTo(1500 * TAXA_DIVIDENDOS, 2);
});

test('lista vazia devolve zeros', () => {
  const r = calcDividendos([]);
  expect(r).toMatchObject({ bruto: 0, impostoPT: 0, aPagar: 0 });
});
