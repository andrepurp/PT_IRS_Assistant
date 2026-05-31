// Geração / fusão do Anexo J (Quadro 9.2-A) no ficheiro XML da declaração Modelo 3.
//
// O Portal das Finanças NÃO importa CSV: importa o XML da declaração Modelo 3, que
// SUBSTITUI a declaração atual por completo. Por isso a abordagem segura é fundir as
// linhas calculadas DENTRO do XML que o utilizador exportou (preservando Rosto e os
// restantes anexos) e devolver o ficheiro completo para reimportar.
//
// A estrutura foi obtida a partir de um ficheiro real exportado pela AT (Modelo3IRSv2026):
//
//   <AnexoJ id="NIF">
//     <Quadro09>
//       <AnexoJq092AT01>
//         <AnexoJq092AT01-Linha numero="1">
//           <CodPais>840</CodPais>            país da fonte (ISO 3166-1 numérico)
//           <Codigo>G01</Codigo>
//           <AnoRealizacao/> <MesRealizacao/> <DiaRealizacao/> <ValorRealizacao/>
//           <AnoAquisicao/>  <MesAquisicao/>  <DiaAquisicao/>  <ValorAquisicao/>
//           <DespesasEncargos/>
//         </AnexoJq092AT01-Linha>
//       </AnexoJq092AT01>
//       <AnexoJq092AT01SomaC01/> ... C02 (aquisição) C03 (despesas) C04 (imposto estrangeiro)
//     </Quadro09>
//   </AnexoJ>

// ISIN -> país (alfa-2) -> código ISO 3166-1 numérico usado pela AT (Tabela de países do
// Anexo J). Lista completa ISO 3166-1; os códigos numéricos da AT coincidem com a norma ISO.
const ISO_ALPHA2_TO_NUM = {
  AD: '020', AE: '784', AF: '004', AG: '028', AI: '660', AL: '008', AM: '051', AO: '024',
  AR: '032', AT: '040', AU: '036', AW: '533', AZ: '031', BA: '070', BB: '052', BD: '050',
  BE: '056', BF: '854', BG: '100', BH: '048', BI: '108', BJ: '204', BM: '060', BN: '096',
  BO: '068', BR: '076', BS: '044', BT: '064', BW: '072', BY: '112', BZ: '084', CA: '124',
  CD: '180', CF: '140', CG: '178', CH: '756', CI: '384', CL: '152', CM: '120', CN: '156',
  CO: '170', CR: '188', CU: '192', CV: '132', CW: '531', CY: '196', CZ: '203', DE: '276',
  DJ: '262', DK: '208', DM: '212', DO: '214', DZ: '012', EC: '218', EE: '233', EG: '818',
  ER: '232', ES: '724', ET: '231', FI: '246', FJ: '242', FM: '583', FO: '234', FR: '250',
  GA: '266', GB: '826', GD: '308', GE: '268', GG: '831', GH: '288', GI: '292', GL: '304',
  GM: '270', GN: '324', GQ: '226', GR: '300', GT: '320', GU: '316', GW: '624', GY: '328',
  HK: '344', HN: '340', HR: '191', HT: '332', HU: '348', ID: '360', IE: '372', IL: '376',
  IM: '833', IN: '356', IQ: '368', IR: '364', IS: '352', IT: '380', JE: '832', JM: '388',
  JO: '400', JP: '392', KE: '404', KG: '417', KH: '116', KM: '174', KN: '659', KP: '408',
  KR: '410', KW: '414', KY: '136', KZ: '398', LA: '418', LB: '422', LC: '662', LI: '438',
  LK: '144', LR: '430', LS: '426', LT: '440', LU: '442', LV: '428', LY: '434', MA: '504',
  MC: '492', MD: '498', ME: '499', MG: '450', MH: '584', MK: '807', ML: '466', MM: '104',
  MN: '496', MO: '446', MR: '478', MT: '470', MU: '480', MV: '462', MW: '454', MX: '484',
  MY: '458', MZ: '508', NA: '516', NC: '540', NE: '562', NG: '566', NI: '558', NL: '528',
  NO: '578', NP: '524', NR: '520', NZ: '554', OM: '512', PA: '591', PE: '604', PF: '258',
  PG: '598', PH: '608', PK: '586', PL: '616', PR: '630', PS: '275', PT: '620', PW: '585',
  PY: '600', QA: '634', RO: '642', RS: '688', RU: '643', RW: '646', SA: '682', SB: '090',
  SC: '690', SD: '729', SE: '752', SG: '702', SI: '705', SK: '703', SL: '694', SM: '674',
  SN: '686', SO: '706', SR: '740', SS: '728', ST: '678', SV: '222', SX: '534', SY: '760',
  SZ: '748', TC: '796', TD: '148', TG: '768', TH: '764', TJ: '762', TL: '626', TM: '795',
  TN: '788', TO: '776', TR: '792', TT: '780', TV: '798', TW: '158', TZ: '834', UA: '804',
  UG: '800', US: '840', UY: '858', UZ: '860', VA: '336', VC: '670', VE: '862', VG: '092',
  VN: '704', VU: '548', WS: '882', YE: '887', ZA: '710', ZM: '894', ZW: '716',
};

export function isinToCodPais(isin) {
  if (!isin || isin.length < 2) return { code: '', alpha2: '', known: false };
  const alpha2 = isin.substring(0, 2).toUpperCase();
  const code = ISO_ALPHA2_TO_NUM[alpha2] || '';
  return { code, alpha2, known: Boolean(code) };
}

// "2024-08-23" -> { ano: '2024', mes: '8', dia: '23' } (meses/dias sem zero à esquerda,
// como no ficheiro de referência da AT).
export function splitDate(iso) {
  const [ano = '', mes = '', dia = ''] = (iso || '').split('-');
  return { ano, mes: String(parseInt(mes, 10) || ''), dia: String(parseInt(dia, 10) || '') };
}

const money = (v) => (Math.round((parseFloat(v) || 0) * 100) / 100).toFixed(2);

// Converte uma realização (mais-valia FIFO) numa linha estruturada do Quadro 9.2-A.
function gainToLine(g, numero) {
  const pais = isinToCodPais(g.isin);
  const real = splitDate(g.dataRealizacao);
  const aq = splitDate(g.dataAquisicao);
  return {
    numero,
    needsCountryReview: !pais.known,
    isin: g.isin,
    fields: {
      CodPais: pais.code,
      Codigo: g.codigo,
      AnoRealizacao: real.ano,
      MesRealizacao: real.mes,
      DiaRealizacao: real.dia,
      ValorRealizacao: money(g.valorRealizacao),
      AnoAquisicao: aq.ano,
      MesAquisicao: aq.mes,
      DiaAquisicao: aq.dia,
      ValorAquisicao: money(g.valorAquisicao),
      DespesasEncargos: money(g.despesas),
    },
  };
}

const FIELD_ORDER = [
  'CodPais', 'Codigo',
  'AnoRealizacao', 'MesRealizacao', 'DiaRealizacao', 'ValorRealizacao',
  'AnoAquisicao', 'MesAquisicao', 'DiaAquisicao', 'ValorAquisicao',
  'DespesasEncargos',
];

// Funde as mais-valias `gains` (já filtradas pelo ano fiscal) no XML `xmlString` que o
// utilizador exportou do Portal das Finanças. Devolve { xml, warnings, lineCount }.
// Lança Error se o ficheiro não for uma declaração Modelo 3 válida com Anexo J.
export function mergeAnexoJ(xmlString, gains) {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('O ficheiro XML não é válido ou está corrompido.');
  }
  const root = doc.documentElement;
  if (!root || !/^Modelo3IRS/.test(root.nodeName)) {
    throw new Error('Este ficheiro não é uma declaração Modelo 3 do IRS.');
  }
  const ns = root.namespaceURI;
  const create = (name) => doc.createElementNS(ns, name);
  const getChild = (parent, name) =>
    Array.from(parent.childNodes).find((n) => n.nodeType === 1 && n.localName === name) || null;

  const anexoJ = root.getElementsByTagNameNS(ns, 'AnexoJ')[0];
  if (!anexoJ) {
    throw new Error(
      'A declaração exportada não contém o Anexo J. Adicione o Anexo J no Portal e exporte de novo.'
    );
  }
  const quadro09 = getChild(anexoJ, 'Quadro09');
  if (!quadro09) throw new Error('O Anexo J não contém o Quadro 09.');

  // Reconstroi o contentor das linhas (AnexoJq092AT01) preservando a posição no Quadro09.
  let container = getChild(quadro09, 'AnexoJq092AT01');
  if (!container) {
    container = create('AnexoJq092AT01');
    const before = getChild(quadro09, 'AnexoJq092AT01SomaC01') || getChild(quadro09, 'AnexoJq092A1T01');
    quadro09.insertBefore(container, before);
  }
  while (container.firstChild) container.removeChild(container.firstChild);

  const warnings = [];
  const totals = { C01: 0, C02: 0, C03: 0, C04: 0 };

  gains.forEach((g, i) => {
    const line = gainToLine(g, i + 1);
    if (line.needsCountryReview) {
      warnings.push(`Sem código de país para o ISIN ${line.isin}. Preencha o país da fonte manualmente.`);
    }
    const el = create('AnexoJq092AT01-Linha');
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

  // Recalcula as somas C01..C04 (criando os elementos se não existirem).
  const setSum = (suffix, value) => {
    const name = `AnexoJq092AT01Soma${suffix}`;
    let el = getChild(quadro09, name);
    if (!el) {
      el = create(name);
      // colocar logo a seguir ao contentor das linhas / às somas anteriores
      const after = getChild(quadro09, `AnexoJq092AT01Soma${prevSuffix(suffix)}`) || container;
      quadro09.insertBefore(el, after.nextSibling);
    }
    el.textContent = money(value);
  };
  setSum('C01', totals.C01);
  setSum('C02', totals.C02);
  setSum('C03', totals.C03);
  setSum('C04', totals.C04);

  const xml = new XMLSerializer().serializeToString(doc);
  return { xml, warnings, lineCount: gains.length };
}

function prevSuffix(suffix) {
  const n = parseInt(suffix.slice(1), 10);
  return 'C' + String(n - 1).padStart(2, '0');
}
