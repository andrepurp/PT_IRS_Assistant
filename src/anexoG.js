// Fusão do Anexo G (Quadro 9 — alienação de partes sociais nacionais) no XML da declaração.
//
// Estrutura obtida de um ficheiro real exportado pela AT (Modelo3IRSv2026):
//
//   <AnexoG>
//     <Quadro09>
//       <AnexoGq09T01>
//         <AnexoGq09T01-Linha numero="1">
//           <NLinha>9001</NLinha> <Titular>A</Titular> <NIF>...</NIF> (NIF da entidade emitente)
//           <CodEncargos>G01</CodEncargos>
//           <AnoRealizacao/> <MesRealizacao/> <DiaRealizacao/> <ValorRealizacao/>
//           <AnoAquisicao/>  <MesAquisicao/>  <DiaAquisicao/>  <ValorAquisicao/>
//           <DespesasEncargos/> <PaisContraparte/> <RespeitaValoresMobiliarios/> (S/N)
//         </AnexoGq09T01-Linha>
//       </AnexoGq09T01>
//       <AnexoGq09T01SomaC01/> ... C02 (aquisição) C03 (despesas)
//     </Quadro09>
//   </AnexoG>

import { splitDate } from './anexoJ';

// ISIN do emitente -> NIF da entidade emitente. A AT exige o NIF do emitente no Anexo G; não é
// derivável do ISIN. Tabela das principais cotadas na Euronext Lisboa — NIPC confirmado em fontes
// oficiais (nif.pt / registo comercial). Para ISIN não listado, avisamos para preencher à mão.
const ISIN_NIF_PT = {
  PTGAL0AM0009: '504499777', // Galp Energia SGPS
  PTBCP0AM0015: '501525882', // Banco Comercial Português
  PTEDP0AM0009: '500697256', // EDP - Energias de Portugal
  PTJMT0AE0001: '500100144', // Jerónimo Martins SGPS
  PTSON0AM0001: '500273170', // Sonae SGPS
  PTMEN0AE0005: '502399694', // Mota-Engil SGPS
  PTPTI0AM0006: '503025798', // The Navigator Company
  PTREL0AM0008: '503264032', // REN - Redes Energéticas Nacionais
  PTCOR0AE0006: '500077797', // Corticeira Amorim SGPS
  PTNOS0AM0006: '504453513', // NOS SGPS
  PTSEM0AM0004: '502593130', // Semapa
  PTALT0AE0002: '507172086', // Altri SGPS
  PTCTT0AM0001: '500077568', // CTT - Correios de Portugal
};

const money = (v) => (Math.round((parseFloat(v) || 0) * 100) / 100).toFixed(2);

const FIELD_ORDER = [
  'NLinha', 'Titular', 'NIF', 'CodEncargos',
  'AnoRealizacao', 'MesRealizacao', 'DiaRealizacao', 'ValorRealizacao',
  'AnoAquisicao', 'MesAquisicao', 'DiaAquisicao', 'ValorAquisicao',
  'DespesasEncargos', 'PaisContraparte', 'RespeitaValoresMobiliarios',
];

function gainToLine(g, numero) {
  const real = splitDate(g.dataRealizacao);
  const aq = splitDate(g.dataAquisicao);
  const nif = ISIN_NIF_PT[g.isin] || '';
  return {
    numero,
    isin: g.isin,
    needsNif: !nif,
    fields: {
      NLinha: String(9000 + numero),
      Titular: 'A',
      NIF: nif,
      CodEncargos: g.codigo,
      AnoRealizacao: real.ano,
      MesRealizacao: real.mes,
      DiaRealizacao: real.dia,
      ValorRealizacao: money(g.valorRealizacao),
      AnoAquisicao: aq.ano,
      MesAquisicao: aq.mes,
      DiaAquisicao: aq.dia,
      ValorAquisicao: money(g.valorAquisicao),
      DespesasEncargos: money(g.despesas),
      PaisContraparte: '620', // Portugal
      RespeitaValoresMobiliarios: 'S',
    },
  };
}

const prevSuffix = (suffix) => 'C' + String(parseInt(suffix.slice(1), 10) - 1).padStart(2, '0');

// Funde as mais-valias de ativos PORTUGUESES `gains` no Anexo G do XML `xmlString`.
// Devolve { xml, warnings, lineCount } ou { skipped: true } se a declaração não tiver Anexo G.
export function mergeAnexoG(xmlString, gains) {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('O ficheiro XML não é válido ou está corrompido.');
  const root = doc.documentElement;
  if (!root || !/^Modelo3IRS/.test(root.nodeName)) throw new Error('Este ficheiro não é uma declaração Modelo 3 do IRS.');

  const ns = root.namespaceURI;
  const create = (name) => doc.createElementNS(ns, name);
  const getChild = (parent, name) =>
    Array.from(parent.childNodes).find((n) => n.nodeType === 1 && n.localName === name) || null;

  const anexoG = root.getElementsByTagNameNS(ns, 'AnexoG')[0];
  if (!anexoG) return { skipped: true };
  const quadro09 = getChild(anexoG, 'Quadro09');
  if (!quadro09) return { skipped: true };

  let container = getChild(quadro09, 'AnexoGq09T01');
  if (!container) {
    container = create('AnexoGq09T01');
    const before = getChild(quadro09, 'AnexoGq09T01SomaC01') || getChild(quadro09, 'AnexoGq09AT01');
    quadro09.insertBefore(container, before);
  }
  while (container.firstChild) container.removeChild(container.firstChild);

  const warnings = [];
  const totals = { C01: 0, C02: 0, C03: 0 };

  gains.forEach((g, i) => {
    const line = gainToLine(g, i + 1);
    if (line.needsNif) warnings.push(`Anexo G: preencha o NIF da entidade emitente para ${line.isin} (não é derivável do ISIN).`);
    const el = create('AnexoGq09T01-Linha');
    el.setAttribute('numero', String(line.numero));
    FIELD_ORDER.forEach((name) => {
      const child = create(name);
      child.textContent = line.fields[name];
      el.appendChild(child);
    });
    container.appendChild(el);
    totals.C01 += parseFloat(line.fields.ValorRealizacao);
    totals.C02 += parseFloat(line.fields.ValorAquisicao);
    totals.C03 += parseFloat(line.fields.DespesasEncargos);
  });

  const setSum = (suffix, value) => {
    const name = `AnexoGq09T01Soma${suffix}`;
    let el = getChild(quadro09, name);
    if (!el) {
      el = create(name);
      const after = getChild(quadro09, `AnexoGq09T01Soma${prevSuffix(suffix)}`) || container;
      quadro09.insertBefore(el, after.nextSibling);
    }
    el.textContent = money(value);
  };
  setSum('C01', totals.C01);
  setSum('C02', totals.C02);
  setSum('C03', totals.C03);

  return { xml: new XMLSerializer().serializeToString(doc), warnings, lineCount: gains.length, skipped: false };
}
