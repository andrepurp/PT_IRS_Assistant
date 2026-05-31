import { coeficiente, calcMaisValiaImovel, COEFICIENTES_2025 } from './imovel';

test('coeficiente devolve o valor da tabela 2025', () => {
  expect(coeficiente(2010)).toBe(1.28);
  expect(coeficiente(2024)).toBe(1.0);
  expect(coeficiente('2000')).toBe(1.67);
});

test('ano não suportado devolve coeficiente nulo', () => {
  expect(coeficiente(1995)).toBeNull();
  const r = calcMaisValiaImovel({ anoAquisicao: 1995, valorAquisicao: 100000, valorRealizacao: 200000 });
  expect(r.anoSuportado).toBe(false);
});

test('mais-valia corrige a aquisição pelo coeficiente e tributa 50%', () => {
  const r = calcMaisValiaImovel({
    anoAquisicao: 2010,
    valorAquisicao: 100000,
    valorRealizacao: 200000,
    despesasAquisicao: 5000,
    encargosValorizacao: 10000,
    despesasVenda: 8000,
  });
  expect(r.valorAquisicaoCorrigido).toBe(128000); // 100000 * 1.28
  expect(r.despesas).toBe(23000);
  expect(r.maisValia).toBe(49000); // 200000 - 128000 - 23000
  expect(r.tributavel).toBe(24500); // 50%
});

test('menos-valia (perda) não gera valor tributável', () => {
  const r = calcMaisValiaImovel({ anoAquisicao: 2021, valorAquisicao: 200000, valorRealizacao: 180000 });
  expect(r.maisValia).toBeLessThan(0);
  expect(r.tributavel).toBe(0);
});

test('reinvestimento total (HPP) isenta a parte tributável', () => {
  const r = calcMaisValiaImovel({
    anoAquisicao: 2010,
    valorAquisicao: 100000,
    valorRealizacao: 200000,
    reinvestimentoTotal: true,
  });
  expect(r.maisValia).toBeGreaterThan(0);
  expect(r.tributavel).toBe(0);
});

test('a tabela cobre todos os anos de 2000 a 2025', () => {
  for (let y = 2000; y <= 2025; y++) expect(COEFICIENTES_2025[y]).toBeGreaterThan(0);
});
