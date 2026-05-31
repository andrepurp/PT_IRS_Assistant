import { parseCSV, computeGains, isSell, getTaxCode, parseDate, isPortugueseIsin } from './gains';

const seqId = () => {
  let n = 0;
  return () => `id${n++}`;
};

const DEGIRO = [
  'Data;Produto;ISIN;Quantidade;Cotação;Valor em EUR;Custos de transação',
  '20-08-2024;Apple;US0378331005;10;4.392;-43.92;-0.50',
  '23-08-2024;Apple;US0378331005;-10;4.779;47.79;-0.50',
].join('\n');

const TRADING212 = [
  'Action,Time,ISIN,Ticker,Name,No. of shares,Price / share,Currency (Price / share),Total,Currency (Total)',
  'Market buy,2024-08-20 10:00:00,US0378331005,AAPL,Apple,10,4.392,EUR,43.92,EUR',
  'Market sell,2024-08-23 10:00:00,US0378331005,AAPL,Apple,10,4.779,EUR,47.79,EUR',
].join('\n');

test('parseCSV reads DEGIRO semicolon format with signed quantity', () => {
  const { transactions } = parseCSV(DEGIRO);
  expect(transactions).toHaveLength(2);
  expect(transactions[0]).toMatchObject({ isin: 'US0378331005', qty: 10, valueEur: -43.92 });
  expect(transactions[1].qty).toBe(-10);
});

test('parseCSV reads Trading 212 comma format with Action column', () => {
  const { transactions } = parseCSV(TRADING212);
  expect(transactions).toHaveLength(2);
  expect(transactions[0].side).toContain('buy');
  expect(transactions[1].side).toContain('sell');
  expect(transactions[0].valueEur).toBe(43.92);
});

test('isSell prefers the explicit side column, then quantity sign, then value sign', () => {
  expect(isSell({ side: 'market sell', qty: 5, valueEur: 10 })).toBe(true);
  expect(isSell({ side: 'market buy', qty: 5, valueEur: 10 })).toBe(false); // side wins over value sign
  expect(isSell({ side: '', qty: -5, valueEur: 0 })).toBe(true); // DEGIRO sell
  expect(isSell({ side: '', qty: 5, valueEur: -50 })).toBe(false); // DEGIRO buy (cash out)
  expect(isSell({ side: '', qty: 5, valueEur: 50 })).toBe(true); // cash in => sell
});

test('computeGains produces a FIFO realization for DEGIRO', () => {
  const { transactions } = parseCSV(DEGIRO);
  const { realizations, unmatched } = computeGains(transactions, seqId());
  expect(unmatched).toHaveLength(0);
  expect(realizations).toHaveLength(1);
  expect(realizations[0]).toMatchObject({
    valorRealizacao: '47.79',
    valorAquisicao: '43.92',
    despesas: '1.00', // 0.50 compra + 0.50 venda
    codigo: 'G01',
    year: '2024',
  });
});

test('computeGains gives the same result for Trading 212', () => {
  const { realizations } = computeGains(parseCSV(TRADING212).transactions, seqId());
  expect(realizations[0]).toMatchObject({ valorRealizacao: '47.79', valorAquisicao: '43.92', despesas: '0.00' });
});

test('FIFO matches the oldest lot first across multiple buys', () => {
  const csv = [
    'Data;Produto;ISIN;Quantidade;Cotação;Valor em EUR;Custos de transação',
    '01-01-2024;X;US0000000001;10;1;-10;0',
    '01-02-2024;X;US0000000001;10;2;-20;0',
    '01-03-2024;X;US0000000001;-15;3;45;0',
  ].join('\n');
  const { realizations } = computeGains(parseCSV(csv).transactions, seqId());
  // 15 vendidas: 10 do lote @1 + 5 do lote @2 => 2 linhas
  expect(realizations).toHaveLength(2);
  expect(realizations[0].valorAquisicao).toBe('10.00'); // lote mais antigo
  expect(realizations[1].valorAquisicao).toBe('10.00'); // 5 @2
  const totalVenda = realizations.reduce((s, r) => s + parseFloat(r.valorRealizacao), 0);
  expect(totalVenda).toBeCloseTo(45);
});

test('computeGains reports sells with no matching purchase as unmatched', () => {
  const csv = [
    'Data;Produto;ISIN;Quantidade;Cotação;Valor em EUR;Custos de transação',
    '01-03-2024;Y;US0000000002;-5;3;15;0',
  ].join('\n');
  const { realizations, unmatched } = computeGains(parseCSV(csv).transactions, seqId());
  expect(realizations).toHaveLength(0);
  expect(unmatched).toHaveLength(1);
  expect(unmatched[0].qtyNaoCorrespondida).toBe('5.00');
});

test('parseCSV flags quantity-only rows as corporate actions (splits/mergers)', () => {
  const csv = [
    'Data;Produto;ISIN;Quantidade;Cotação;Valor em EUR;Custos de transação',
    '01-06-2024;Apple Split;US0378331005;40;0;0;0',
    '02-06-2024;Apple;US0378331005;10;4;-40;0',
  ].join('\n');
  const { transactions, skipped } = parseCSV(csv);
  expect(transactions).toHaveLength(1);
  expect(skipped).toHaveLength(1);
  expect(skipped[0]).toMatchObject({ isin: 'US0378331005', qty: '40.00', year: '2024' });
});

test('getTaxCode classifies ETFs/funds as G20 and shares as G01', () => {
  expect(getTaxCode('iShares Core MSCI World UCITS ETF', 'IE00B4L5Y983')).toBe('G20');
  expect(getTaxCode('Apple Inc', 'US0378331005')).toBe('G01');
});

// Regressão: a DEGIRO exporta linhas com nº de colunas variável (17 vs 18). Linhas mais
// antigas (Order ID logo a seguir ao Total) têm menos uma coluna que o cabeçalho. O parser
// não pode descartá-las — caso contrário perde todo o histórico antigo e o FIFO falha.
const DEGIRO_RAGGED = [
  'Date,Time,Product,ISIN,Reference exchange,Venue,Quantity,Price,,Local value,,Value EUR,Exchange rate,AutoFX Fee,Transaction and/or third party fees EUR,Total EUR,Order ID,',
  '29-10-2024,15:20,VOLKSWAGEN AG PREFERRED,DE0007664039,XET,XETA,-23,"89,5400",EUR,"2059,42",EUR,"2059,42",,"0,00","-4,90","2054,52",,269a6fcb', // 18 colunas (venda)
  '02-09-2024,14:08,VOLKSWAGEN AG PREFERRED,DE0007664039,XET,XETA,3,"95,9200",EUR,"-287,76",EUR,"-287,76",,"0,00","-4,90","-292,66",,f8c22a01', // 18 colunas (compra)
  '08-08-2024,15:48,VOLKSWAGEN AG PREFERRED,DE0007664039,XET,XETA,20,"93,8000",EUR,"-1876,00",EUR,"-1876,00",,"0,00","-4,90","-1880,90",138a4747', // 17 colunas (compra)
].join('\n');

test('parseCSV keeps rows with fewer columns than the header (DEGIRO ragged export)', () => {
  const { transactions } = parseCSV(DEGIRO_RAGGED);
  expect(transactions).toHaveLength(3); // a compra de 20 (17 colunas) NÃO pode ser descartada
  const buy20 = transactions.find((t) => t.qty === 20);
  expect(buy20).toBeTruthy();
  expect(buy20.valueEur).toBe(-1876);
});

test('computeGains fully matches the VW sale once the 20-share buy is kept', () => {
  const { realizations, unmatched } = computeGains(parseCSV(DEGIRO_RAGGED).transactions, seqId());
  expect(unmatched).toHaveLength(0); // antes do fix: 20 ações ficavam por corresponder
  const totalQtyMatched = realizations.length; // 2 lotes: 20 + 3
  expect(totalQtyMatched).toBe(2);
  const totalVenda = realizations.reduce((s, r) => s + parseFloat(r.valorRealizacao), 0);
  expect(totalVenda).toBeCloseTo(2059.42, 1);
  const totalCompra = realizations.reduce((s, r) => s + parseFloat(r.valorAquisicao), 0);
  expect(totalCompra).toBeCloseTo(2163.76, 1); // 1876.00 + 287.76
});

test('computeGains sorts by date AND time so same-day FIFO pairs correctly', () => {
  // CSV em ordem inversa (mais recente primeiro, como a DEGIRO exporta). Sem ordenar por hora,
  // a venda das 12:00 seria processada antes das compras e ficaria por corresponder.
  const csv = [
    'Data;Hora;Produto;ISIN;Quantidade;Cotação;Valor em EUR;Custos de transação',
    '01-03-2024;12:00;X;US0000000001;-15;3;45;0',
    '01-03-2024;11:00;X;US0000000001;10;2;-20;0',
    '01-03-2024;10:00;X;US0000000001;10;1;-10;0',
  ].join('\n');
  const { realizations, unmatched } = computeGains(parseCSV(csv).transactions, seqId());
  expect(unmatched).toHaveLength(0);
  expect(realizations).toHaveLength(2);
  expect(realizations[0].valorAquisicao).toBe('10.00'); // lote das 10:00 (@1), o mais antigo por hora
  expect(realizations[1].valorAquisicao).toBe('10.00'); // 5 ações do lote das 11:00 (@2)
});

test('despesas include the AutoFX currency-conversion fee', () => {
  const csv = [
    'Date,Time,Product,ISIN,Reference exchange,Venue,Quantity,Price,,Local value,,Value EUR,Exchange rate,AutoFX Fee,Transaction and/or third party fees EUR,Total EUR,Order ID,',
    '20-08-2024,15:30,FOO,US1111111111,NDQ,XNAS,1,"100,0000",USD,"-100,00",USD,"-100,00","1,10","-0,50","-2,00","-102,50",,o1',
    '22-08-2024,15:30,FOO,US1111111111,NDQ,XNAS,-1,"110,0000",USD,"110,00",USD,"110,00","1,10","-0,30","-2,00","107,70",,o2',
  ].join('\n');
  const { realizations } = computeGains(parseCSV(csv).transactions, seqId());
  expect(realizations).toHaveLength(1);
  // 2.00 + 0.50 (compra) + 2.00 + 0.30 (venda) = 4.80
  expect(realizations[0].despesas).toBe('4.80');
});

test('isPortugueseIsin detects PT-registered securities (Anexo G, not J)', () => {
  expect(isPortugueseIsin('PTGAL0AM0009')).toBe(true);
  expect(isPortugueseIsin('US0378331005')).toBe(false);
  expect(isPortugueseIsin('IE00B4L5Y983')).toBe(false);
});

test('parseDate normalises DD-MM-YYYY and ignores time component', () => {
  expect(parseDate('23-08-2024 10:00:00')).toBe('2024-08-23');
  expect(parseDate('2024-08-23')).toBe('2024-08-23');
});
