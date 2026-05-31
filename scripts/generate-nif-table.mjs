#!/usr/bin/env node
// Gera/verifica a tabela ISIN -> NIF do emitente (src/nifPt.json) usando a API pública do GLEIF.
//
// Fluxo: ISIN -> registo LEI (GLEIF) -> entidade { país, registeredAs (NIPC em PT) }.
// É uma ferramenta de MANUTENÇÃO (build-time). NUNCA corre no browser — a app continua 100% local.
//
// Uso:
//   node scripts/generate-nif-table.mjs                 # só verifica e reporta (não grava)
//   node scripts/generate-nif-table.mjs --write         # grava entradas NOVAS e confirma
//   node scripts/generate-nif-table.mjs --write --force # também sobrepõe divergências (cuidado)
//   node scripts/generate-nif-table.mjs PTXXX0XX0000    # acrescenta ISIN(s) a verificar
//
// Requer Node 18+ (fetch global) e acesso à internet. As divergências em relação à tabela atual
// NÃO são sobrepostas sem --force — devem ser revistas à mão, por serem dados de uma declaração fiscal.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const tablePath = fileURLToPath(new URL('../src/nifPt.json', import.meta.url));
const table = JSON.parse(readFileSync(tablePath, 'utf8'));

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const FORCE = args.includes('--force');
const extra = args
  .map((a) => a.toUpperCase())
  .filter((a) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(a));

const isins = [...new Set([...Object.keys(table), ...extra])];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const digits9 = (s) => {
  const d = String(s || '').replace(/\D/g, '');
  return d.length === 9 ? d : null;
};

async function gleif(isin) {
  const url = `https://api.gleif.org/api/v1/lei-records?filter%5Bisin%5D=${encodeURIComponent(isin)}&page%5Bsize%5D=1`;
  const res = await fetch(url, { headers: { accept: 'application/vnd.api+json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const rec = json.data && json.data[0];
  if (!rec) return null;
  const e = (rec.attributes && rec.attributes.entity) || {};
  const addr = e.legalAddress || e.headquartersAddress || {};
  return { lei: rec.attributes.lei, name: e.legalName && e.legalName.name, country: addr.country, registeredAs: e.registeredAs };
}

const report = { confirmed: [], mismatch: [], added: [], nonPt: [], unresolved: [] };

for (const isin of isins) {
  process.stdout.write(`${isin} … `);
  let info;
  try {
    info = await gleif(isin);
  } catch (err) {
    console.log(`erro GLEIF (${err.message})`);
    report.unresolved.push({ isin, reason: err.message });
    await sleep(300);
    continue;
  }
  const current = table[isin] && table[isin].nipc;
  if (!info) {
    console.log('sem dados no GLEIF (mantém manual)');
    report.unresolved.push({ isin, reason: 'sem LEI para o ISIN' });
  } else if (info.country && info.country !== 'PT') {
    console.log(`NÃO-PT (${info.country}) — pertence ao Anexo J`);
    report.nonPt.push({ isin, country: info.country, name: info.name });
  } else if (!digits9(info.registeredAs)) {
    console.log('PT mas GLEIF sem NIPC utilizável (mantém manual)');
    report.unresolved.push({ isin, reason: 'registeredAs ausente/inválido', name: info.name });
  } else {
    const nipc = digits9(info.registeredAs);
    if (current === nipc) {
      console.log('✓ confirmado');
      report.confirmed.push({ isin, nipc });
    } else if (current && current !== nipc) {
      console.log(`⚠ DIVERGÊNCIA tabela=${current} GLEIF=${nipc}`);
      report.mismatch.push({ isin, current, gleif: nipc, name: info.name });
      if (WRITE && FORCE) table[isin] = { nipc, name: info.name || table[isin].name };
    } else {
      console.log(`+ novo ${nipc} (${info.name || '—'})`);
      report.added.push({ isin, nipc, name: info.name });
      if (WRITE) table[isin] = { nipc, name: info.name || '' };
    }
  }
  await sleep(300); // ser simpático com a API pública
}

console.log('\n== Resumo ==');
console.log(`confirmados:        ${report.confirmed.length}`);
console.log(`novos:              ${report.added.length}`);
if (report.added.length) console.table(report.added);
console.log(`divergências:       ${report.mismatch.length} (rever à mão; só --force sobrepõe)`);
if (report.mismatch.length) console.table(report.mismatch);
console.log(`não-PT (Anexo J):   ${report.nonPt.length}`);
if (report.nonPt.length) console.table(report.nonPt);
console.log(`por resolver:       ${report.unresolved.length} (ficam com aviso manual na app)`);

if (WRITE) {
  writeFileSync(tablePath, JSON.stringify(table, null, 2) + '\n');
  console.log(`\nGravado ${tablePath} — ${Object.keys(table).length} entradas.`);
  if (report.mismatch.length && !FORCE) console.log('Divergências NÃO foram sobrepostas. Reveja-as antes de confiar.');
} else {
  console.log('\n(modo leitura — use --write para gravar)');
}
