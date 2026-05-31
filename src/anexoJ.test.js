import { isinToCodPais, splitDate, mergeAnexoJ } from './anexoJ';

// Esqueleto mínimo de uma declaração exportada pela AT (estrutura real, sem dados pessoais).
const BASE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Modelo3IRSv2026 xmlns="http://www.dgci.gov.pt/2009/Modelo3IRSv2026" versao="1">
<Rosto><Quadro01/></Rosto>
<AnexoJ id="999999990">
<Quadro03><AnexoJq03C03>999999990</AnexoJq03C03></Quadro03>
<Quadro09>
<AnexoJq091AT01/>
<AnexoJq091BT01/>
<AnexoJq092AT01/>
<AnexoJq092A1T01/>
</Quadro09>
</AnexoJ>
</Modelo3IRSv2026>`;

const gain = (over = {}) => ({
  isin: 'US0378331005',
  codigo: 'G01',
  dataRealizacao: '2024-08-23',
  valorRealizacao: '47.79',
  dataAquisicao: '2024-08-20',
  valorAquisicao: '43.92',
  despesas: '4.00',
  ...over,
});

test('isinToCodPais maps US to ISO numeric 840', () => {
  expect(isinToCodPais('US0378331005')).toEqual({ code: '840', alpha2: 'US', known: true });
  expect(isinToCodPais('IE00B4L5Y983').code).toBe('372');
  expect(isinToCodPais('ZZ000').known).toBe(false);
});

test('splitDate strips leading zeros from month and day', () => {
  expect(splitDate('2024-08-23')).toEqual({ ano: '2024', mes: '8', dia: '23' });
});

test('mergeAnexoJ injects a line and recomputes sums', () => {
  const { xml, warnings, lineCount } = mergeAnexoJ(BASE_XML, [gain()]);
  expect(lineCount).toBe(1);
  expect(warnings).toEqual([]);

  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const line = doc.getElementsByTagName('AnexoJq092AT01-Linha')[0];
  expect(line.getAttribute('numero')).toBe('1');
  const text = (t) => line.getElementsByTagName(t)[0].textContent;
  expect(text('CodPais')).toBe('840');
  expect(text('Codigo')).toBe('G01');
  expect(text('ValorRealizacao')).toBe('47.79');
  expect(text('DespesasEncargos')).toBe('4.00');

  expect(doc.getElementsByTagName('AnexoJq092AT01SomaC01')[0].textContent).toBe('47.79');
  expect(doc.getElementsByTagName('AnexoJq092AT01SomaC02')[0].textContent).toBe('43.92');
  expect(doc.getElementsByTagName('AnexoJq092AT01SomaC03')[0].textContent).toBe('4.00');
  expect(doc.getElementsByTagName('AnexoJq092AT01SomaC04')[0].textContent).toBe('0.00');
});

test('mergeAnexoJ sums multiple lines', () => {
  const { xml } = mergeAnexoJ(BASE_XML, [gain(), gain({ valorRealizacao: '10.00', valorAquisicao: '5.00', despesas: '1.00' })]);
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  expect(doc.getElementsByTagName('AnexoJq092AT01-Linha').length).toBe(2);
  expect(doc.getElementsByTagName('AnexoJq092AT01SomaC01')[0].textContent).toBe('57.79');
  expect(doc.getElementsByTagName('AnexoJq092AT01SomaC03')[0].textContent).toBe('5.00');
});

test('mergeAnexoJ warns when country is unknown', () => {
  const { warnings } = mergeAnexoJ(BASE_XML, [gain({ isin: 'ZZ123456789' })]);
  expect(warnings.length).toBe(1);
  expect(warnings[0]).toMatch(/ZZ123456789/);
});

test('mergeAnexoJ rejects a non-Modelo3 file', () => {
  expect(() => mergeAnexoJ('<foo/>', [])).toThrow(/Modelo 3/);
});
