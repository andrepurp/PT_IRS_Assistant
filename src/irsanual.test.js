import { coletaIRS, calcIRSAnual, ESCALOES_2025 } from './irsanual';

test('coleta no primeiro escalão é 12,5% linear', () => {
  expect(coletaIRS(8342)).toBeCloseTo(8342 * 0.125, 1); // 1042.75
});

test('a coleta reproduz a taxa média oficial nos limites dos escalões', () => {
  // No limite do 2.º escalão (12 587€) a taxa média oficial é 13,579%.
  const c = coletaIRS(12587);
  expect((c / 12587) * 100).toBeCloseTo(13.579, 2);
  // No limite do 3.º escalão (17 838€) a taxa média oficial é 15,823%.
  expect((coletaIRS(17838) / 17838) * 100).toBeCloseTo(15.823, 2);
});

test('coleta é progressiva (sobe com o rendimento)', () => {
  expect(coletaIRS(15896)).toBeCloseTo(2410.72, 1);
  expect(coletaIRS(30000)).toBeGreaterThan(coletaIRS(20000));
});

test('liquidação: dedução específica, coletável e saldo', () => {
  const r = calcIRSAnual({ rendimentoBruto: 20000, retencoes: 3000 });
  expect(r.deducaoEspecifica).toBe(4104); // 11% de 20000 = 2200 < 4104
  expect(r.coletavel).toBe(15896);
  expect(r.coleta).toBeCloseTo(2410.72, 1);
  expect(r.saldo).toBeCloseTo(3000 - 2410.72, 1); // reembolso ~589
});

test('dedução específica usa as contribuições para a SS quando excedem 4104€', () => {
  const r = calcIRSAnual({ rendimentoBruto: 50000 });
  expect(r.deducaoEspecifica).toBeCloseTo(50000 * 0.11, 2); // 5500 > 4104
});

test('deduções à coleta reduzem o imposto devido', () => {
  const sem = calcIRSAnual({ rendimentoBruto: 20000 });
  const com = calcIRSAnual({ rendimentoBruto: 20000, deducoesColeta: 500 });
  expect(sem.impostoDevido - com.impostoDevido).toBeCloseTo(500, 2);
});

test('a tabela tem 9 escalões e o topo é 48%', () => {
  expect(ESCALOES_2025).toHaveLength(9);
  expect(ESCALOES_2025[8].taxa).toBe(0.48);
});
