import { mergeAnexoG } from './anexoG';

// Esqueleto real de uma declaração com Anexo G (sem dados pessoais).
const BASE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Modelo3IRSv2026 xmlns="http://www.dgci.gov.pt/2009/Modelo3IRSv2026" versao="1">
<Rosto><Quadro01/></Rosto>
<AnexoG>
<Quadro03><AnexoGq03C01>999999990</AnexoGq03C01></Quadro03>
<Quadro09>
<AnexoGq09T01/>
<AnexoGq09AT01/>
</Quadro09>
</AnexoG>
</Modelo3IRSv2026>`;

const SEM_ANEXO_G = `<?xml version="1.0" encoding="UTF-8"?>
<Modelo3IRSv2026 xmlns="http://www.dgci.gov.pt/2009/Modelo3IRSv2026" versao="1">
<Rosto><Quadro01/></Rosto>
</Modelo3IRSv2026>`;

const galp = (over = {}) => ({
  isin: 'PTGAL0AM0009',
  codigo: 'G01',
  dataRealizacao: '2023-11-09',
  valorRealizacao: '26.83',
  dataAquisicao: '2023-11-06',
  valorAquisicao: '28.25',
  despesas: '0.44',
  ...over,
});

test('mergeAnexoG injeta uma linha no Quadro 9 com os campos do Anexo G', () => {
  const { xml, warnings, skipped } = mergeAnexoG(BASE_XML, [galp()]);
  expect(skipped).toBe(false);
  expect(warnings).toEqual([]); // GALP tem NIF conhecido

  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const linha = doc.getElementsByTagName('AnexoGq09T01-Linha')[0];
  const t = (tag) => linha.getElementsByTagName(tag)[0].textContent;
  expect(linha.getAttribute('numero')).toBe('1');
  expect(t('NLinha')).toBe('9001');
  expect(t('Titular')).toBe('A');
  expect(t('NIF')).toBe('504499777'); // Galp Energia SGPS
  expect(t('CodEncargos')).toBe('G01');
  expect(t('ValorRealizacao')).toBe('26.83');
  expect(t('PaisContraparte')).toBe('620');
  expect(t('RespeitaValoresMobiliarios')).toBe('S');
});

test('mergeAnexoG numera as linhas 9001, 9002 e soma C01/C02/C03', () => {
  const { xml } = mergeAnexoG(BASE_XML, [galp(), galp({ valorRealizacao: '93.90', valorAquisicao: '98.87', despesas: '3.56' })]);
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const linhas = doc.getElementsByTagName('AnexoGq09T01-Linha');
  expect(linhas).toHaveLength(2);
  expect(linhas[1].getElementsByTagName('NLinha')[0].textContent).toBe('9002');
  expect(doc.getElementsByTagName('AnexoGq09T01SomaC01')[0].textContent).toBe('120.73');
  expect(doc.getElementsByTagName('AnexoGq09T01SomaC02')[0].textContent).toBe('127.12');
  expect(doc.getElementsByTagName('AnexoGq09T01SomaC03')[0].textContent).toBe('4.00');
});

test('NIFs das principais cotadas são preenchidos automaticamente', () => {
  const casos = [
    ['PTBCP0AM0015', '501525882'], // BCP
    ['PTEDP0AM0009', '500697256'], // EDP
    ['PTJMT0AE0001', '500100144'], // Jerónimo Martins
    ['PTGNV0AM0001', '506042715'], // Greenvolt
    ['PTSLB0AM0010', '504882066'], // Benfica SAD
    ['PTZON0AM0006', '504453513'], // NOS (ISIN legado)
  ];
  casos.forEach(([isin, nif]) => {
    const { xml, warnings } = mergeAnexoG(BASE_XML, [galp({ isin })]);
    expect(warnings).toEqual([]);
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.getElementsByTagName('NIF')[0].textContent).toBe(nif);
  });
});

test('mergeAnexoG avisa quando não conhece o NIF do emitente', () => {
  const { warnings } = mergeAnexoG(BASE_XML, [galp({ isin: 'PTXXX0000000' })]);
  expect(warnings.length).toBe(1);
  expect(warnings[0]).toMatch(/PTXXX0000000/);
});

test('mergeAnexoG devolve skipped quando a declaração não tem Anexo G', () => {
  expect(mergeAnexoG(SEM_ANEXO_G, [galp()])).toEqual({ skipped: true });
});

test('mergeAnexoG rejeita um ficheiro que não é Modelo 3', () => {
  expect(() => mergeAnexoG('<foo/>', [])).toThrow(/Modelo 3/);
});
