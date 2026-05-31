import { calcRetencaoIRS, calcSalario, TABELA_2026_I, TABELA_2026_II, TABELA_2026_III, SS_RATE } from './salario';

const T = TABELA_2026_I;

const continuityCheck = (tabela, limites) => {
  limites.forEach((L) => {
    const aqui = calcRetencaoIRS(L, tabela);
    const acima = calcRetencaoIRS(L + 0.01, tabela);
    expect(Math.abs(acima - aqui)).toBeLessThan(0.05);
  });
};

test('salário mínimo (920€) está isento de retenção de IRS', () => {
  expect(calcRetencaoIRS(920, T)).toBe(0);
});

test('os escalões são contínuos nas fronteiras (sem saltos na retenção)', () => {
  // Em cada limite, a retenção calculada pelo escalão deve ser ~igual à do escalão seguinte.
  const limites = [920, 1042, 1108, 1154, 1212, 1819, 2119, 2499, 3305, 5547, 20221];
  limites.forEach((L) => {
    const aqui = calcRetencaoIRS(L, T);
    const acima = calcRetencaoIRS(L + 0.01, T);
    expect(Math.abs(acima - aqui)).toBeLessThan(0.05);
  });
});

test('retenção de IRS para valores de referência', () => {
  expect(calcRetencaoIRS(1000, T)).toBeCloseTo(36.0, 1); // escalão com fórmula especial
  expect(calcRetencaoIRS(1500, T)).toBeCloseTo(168.17, 1); // 1500*0.241 - 193.33
  expect(calcRetencaoIRS(2500, T)).toBeCloseTo(471.34, 1); // 2500*0.3836 - 487.66
});

test('cada dependente reduz a retenção em 21,43€', () => {
  const base = calcRetencaoIRS(2000, T, 0);
  const com2 = calcRetencaoIRS(2000, T, 2);
  expect(base - com2).toBeCloseTo(2 * 21.43, 2);
});

test('calcSalario decompõe bruto em Segurança Social (11%) + IRS + líquido', () => {
  const r = calcSalario(1500, T);
  expect(r.ss).toBeCloseTo(1500 * SS_RATE, 2); // 165.00
  expect(r.irs).toBeCloseTo(168.17, 1);
  expect(r.liquido).toBeCloseTo(1500 - r.ss - r.irs, 2);
});

test('a retenção nunca é negativa', () => {
  expect(calcRetencaoIRS(950, T, 10)).toBe(0); // muitos dependentes não dão retenção negativa
});

test('Tabela II = Tabela I nos escalões, mas dependente vale 34,29€', () => {
  expect(calcRetencaoIRS(2000, TABELA_2026_II, 0)).toBe(calcRetencaoIRS(2000, T, 0));
  const reducao = calcRetencaoIRS(2000, TABELA_2026_II, 0) - calcRetencaoIRS(2000, TABELA_2026_II, 1);
  expect(reducao).toBeCloseTo(34.29, 2);
});

test('Tabela III (casado único titular) é contínua e retém menos que a Tabela I', () => {
  continuityCheck(TABELA_2026_III, [991, 1042, 1108, 1119, 1432, 1962, 2240, 2773, 3389, 5965, 20265]);
  expect(calcRetencaoIRS(1500, TABELA_2026_III)).toBeCloseTo(94.18, 1); // 1500*0.157 - 141.32
  expect(calcRetencaoIRS(1500, TABELA_2026_III)).toBeLessThan(calcRetencaoIRS(1500, T));
});
