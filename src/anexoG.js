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
// derivável do ISIN. Tabela das cotadas na Euronext Lisboa (mercado regulado + Access) e emitentes
// recentemente saídos de bolsa. Cada NIPC foi confirmado em fonte oficial (nif.pt / registo
// comercial). Para ISIN não listado, avisamos para preencher o NIF à mão.
const ISIN_NIF_PT = {
  // Mercado principal / PSI
  PTGAL0AM0009: '504499777', // Galp Energia SGPS
  PTBCP0AM0015: '501525882', // Banco Comercial Português
  PTEDP0AM0009: '500697256', // EDP - Energias de Portugal
  PTJMT0AE0001: '500100144', // Jerónimo Martins SGPS
  PTSON0AM0001: '500273170', // Sonae SGPS
  PTMEN0AE0005: '502399694', // Mota-Engil SGPS
  PTPTI0AM0006: '503025798', // The Navigator Company (ex-Portucel)
  PTREL0AM0008: '503264032', // REN - Redes Energéticas Nacionais
  PTCOR0AE0006: '500077797', // Corticeira Amorim SGPS
  PTNOS0AM0006: '504453513', // NOS SGPS
  PTZON0AM0006: '504453513', // NOS SGPS (ISIN legado ZON)
  PTSEM0AM0004: '502593130', // Semapa
  PTALT0AE0002: '507172086', // Altri SGPS
  PTCTT0AM0001: '500077568', // CTT - Correios de Portugal
  PTIBS0AM0008: '501669477', // Ibersol SGPS
  PTSNC0AM0006: '502028351', // Sonaecom SGPS
  PTCFN0AE0003: '502293225', // Cofina SGPS
  PTIPR0AM0000: '502437464', // Impresa SGPS
  PTGMC0AM0003: '502816481', // Grupo Média Capital SGPS
  PTMCP0AM0001: '502816481', // Grupo Média Capital SGPS (ISIN alt.)
  PTSML0AM0009: '500277486', // Sumol+Compal
  PTGNV0AM0001: '506042715', // Greenvolt - Energias Renováveis
  PTNBA0AM0006: '502280182', // Novabase SGPS
  PTMFR0AM0003: '505127261', // Martifer SGPS
  PTVAA0AM0019: '500978654', // VAA - Vista Alegre Atlantis SGPS
  PTFRV0AE0004: '508548527', // Ramada Investimentos
  PTESO0AM0000: '500101221', // Estoril-Sol SGPS
  PTTD10AM0000: '509234526', // Teixeira Duarte
  PTSCT0AP0018: '500239037', // Toyota Caetano Portugal
  PTPAD0AM0007: '503541320', // Glintt Global
  PTRED0AP0010: '500400997', // Reditus SGPS
  PTINA0AP0008: '500137994', // Inapa
  PTEPT0AM0005: '504885367', // Luz Saúde (ex-Espírito Santo Saúde)
  PTPTC0AM0009: '503215058', // Pharol SGPS (ex-Portugal Telecom)
  PTS3P0AM0025: '506035034', // Sonae Indústria SGPS
  PTSNP0AE0008: '508276756', // SC - Sonae Capital Investments SGPS
  // SAD de futebol cotadas
  PTSLB0AM0010: '504882066', // Sport Lisboa e Benfica - Futebol SAD
  PTSCP0AM0001: '503994499', // Sporting Clube de Portugal - Futebol SAD
  PTFCP0AM0008: '504076574', // Futebol Clube do Porto - Futebol SAD
  PTSCB0AM0001: '504205498', // Sporting Clube de Braga - Futebol SAD
  // Euronext Access / outros
  PTCDU0AE0003: '500070210', // Conduril - Engenharia
  PTCOM0AE0007: '500069891', // Future Compta (ex-Compta)
  PTLIG0AE0002: '500166587', // Lisgráfica
  PTGPA0AP0007: '500136971', // Imobiliária Construtora Grão-Pará
  PTRIZ0AM0009: '510896197', // Raize
  PTSAG0AM0009: '503219886', // SAG Gest (entidade renomeada após saída de bolsa)
  // Emitentes saídos de bolsa (anos fiscais anteriores)
  PTBPI0AM0004: '501214534', // Banco BPI
  PTBRI0AM0000: '500048177', // Brisa - Auto-estradas de Portugal
  PTBES0AM0007: '500852367', // Banco Espírito Santo (em liquidação)
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
