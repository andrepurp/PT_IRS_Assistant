// Parsing de CSV de corretoras e cálculo de mais-valias por FIFO (critério da AT).
// Lógica pura e testável, separada da UI.

export const getCountryFromIsin = (isin) => {
  if (!isin || isin.length < 2) return 'XX';
  return isin.substring(0, 2).toUpperCase();
};

// Ativos portugueses (ISIN começado por PT) são rendimento de fonte nacional: pertencem ao
// Anexo G, não ao Anexo J (que é só para rendimentos obtidos no estrangeiro).
export const isPortugueseIsin = (isin) => getCountryFromIsin(isin) === 'PT';

export const getTaxCode = (productName, isin) => {
  if (!productName && !isin) return 'G01';
  const name = (productName || '').toLowerCase();
  if (
    name.includes('etf') ||
    name.includes('ucits') ||
    name.includes('fund') ||
    name.includes('fundo') ||
    name.includes('ishares') ||
    name.includes('vanguard') ||
    name.includes('amundi') ||
    name.includes('lyxor')
  ) {
    return 'G20'; // ETFs / Fundos
  }
  return 'G01'; // Ações normais
};

export const parseDate = (dateStr) => {
  if (!dateStr) return '';
  const cleanStr = dateStr.trim();
  const datePart = cleanStr.split(' ')[0]; // Remove o componente das horas se existir
  if (datePart.includes('-')) {
    const parts = datePart.split('-');
    if (parts[0].length === 2) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY -> YYYY-MM-DD
    }
    return datePart;
  }
  if (datePart.includes('/')) {
    const parts = datePart.split('/');
    if (parts[0].length === 2) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD/MM/YYYY -> YYYY-MM-DD
    }
    return datePart.replace(/\//g, '-');
  }
  return datePart;
};

const cleanNum = (val) => {
  if (!val) return 0;
  let clean = val.replace(/"/g, '').trim();
  if (clean.includes('.') && clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  return parseFloat(clean) || 0;
};

// Lê o CSV e devolve { transactions, skipped }.
//  - transactions: linhas de compra/venda com quantidade COM sinal e um campo `side` opcional.
//  - skipped: linhas com quantidade mas sem preço/valor (possíveis eventos societários: splits,
//    fusões, etc.) que não entram no FIFO mas sobre as quais o utilizador deve ser avisado.
export const parseCSV = (text) => {
  const firstLine = text.split('\n')[0] || '';
  const delimiter = firstLine.includes(';') ? ';' : ',';
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) return { transactions: [], skipped: [] };

  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ''));

  const findPriorityIndex = (priorities, exclude = []) => {
    for (const group of priorities) {
      const idx = headers.findIndex((h) => {
        const headerClean = h.toLowerCase().trim();
        if (exclude.some((ex) => headerClean.includes(ex.toLowerCase()))) return false;
        return group.some((name) => {
          const nameClean = name.toLowerCase().trim();
          return headerClean === nameClean || headerClean.includes(nameClean);
        });
      });
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idxDate = findPriorityIndex([['data', 'date', 'datum'], ['time', 'datetime', 'hora']]);
  const idxProduct = findPriorityIndex([['produto', 'product', 'instrument', 'name', 'nome']]);
  const idxIsin = findPriorityIndex([['isin']]);
  const idxQty = findPriorityIndex([['quantidade', 'quantity', 'no. of shares', 'shares', 'volume', 'aantal', 'number']]);
  const idxPrice = findPriorityIndex([['preço', 'preços', 'price / share', 'price', 'koers']]);
  const idxValue = findPriorityIndex([['valor em eur', 'value in eur', 'eur value', 'value (eur)'], ['total', 'value', 'valor', 'totaal']], ['local']);
  const idxFees = findPriorityIndex([['custos de transação', 'custos de transacao', 'taxas de transação', 'transaction costs', 'fees', 'transactiekosten', 'charges']]);
  // Coluna explícita de sentido da operação (Trading 212 "Action", XTB "Type", etc.)
  const idxSide = findPriorityIndex([['action', 'sentido', 'operação', 'operacao', 'buy/sell', 'compra/venda'], ['tipo', 'type']]);

  // Só precisamos das colunas que efetivamente lemos. Alguns ficheiros (ex.: DEGIRO) exportam
  // linhas com número de colunas variável — exigir row.length === headers.length descartaria
  // silenciosamente linhas válidas. Basta a linha ter as colunas essenciais.
  const maxIdx = Math.max(idxDate, idxProduct, idxIsin, idxQty, idxPrice, idxValue, idxFees, idxSide);

  const splitRow = (line) => {
    const row = [];
    let current = '';
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        row.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current);
    return row;
  };

  const transactions = [];
  const skipped = [];

  for (let i = 1; i < lines.length; i++) {
    const row = splitRow(lines[i]);
    if (row.length <= maxIdx) continue; // linha não tem sequer as colunas essenciais

    const rawDate = row[idxDate];
    const isin = row[idxIsin]?.trim().toUpperCase();
    if (!rawDate || !isin) continue;

    const qty = cleanNum(row[idxQty]); // mantém o sinal (negativo = venda em muitas corretoras)
    const price = cleanNum(row[idxPrice]);
    const product = row[idxProduct]?.trim() || 'Desconhecido';
    const date = parseDate(rawDate);

    // Linhas sem quantidade são ignoradas (dividendos, taxas avulsas, etc.).
    if (qty === 0) continue;

    // Quantidade sem preço/valor => provável evento societário (split/fusão) que afeta o FIFO.
    if (price === 0 && cleanNum(row[idxValue]) === 0) {
      skipped.push({ date, product, isin, qty: qty.toFixed(2), year: date.split('-')[0] });
      continue;
    }

    transactions.push({
      date,
      product,
      isin,
      qty,
      price,
      valueEur: cleanNum(row[idxValue]),
      fees: Math.abs(cleanNum(row[idxFees])),
      side: idxSide !== -1 ? (row[idxSide] || '').toLowerCase() : '',
    });
  }

  return { transactions, skipped };
};

// Determina se uma transação é venda, na seguinte ordem de prioridade:
//  1) coluna explícita de sentido (Action/Type: "sell"/"venda" vs "buy"/"compra");
//  2) sinal da quantidade (negativa = venda) — convenção da DEGIRO;
//  3) sinal do fluxo financeiro (valor recebido positivo = venda).
export const isSell = (tx) => {
  const s = tx.side || '';
  if (s.includes('sell') || s.includes('venda') || s.includes('sale')) return true;
  if (s.includes('buy') || s.includes('compra') || s.includes('purchase')) return false;
  if (tx.qty < 0) return true;
  if (tx.qty > 0) return tx.valueEur > 0;
  return tx.valueEur > 0;
};

// Calcula as realizações (mais-valias) por FIFO. Devolve { realizations, unmatched }.
// `idFor(i)` permite injetar IDs determinísticos nos testes.
export const computeGains = (transactions, idFor) => {
  const makeId = idFor || (() => Math.random().toString(36).slice(2, 11));
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  const buyQueues = {};
  const realizations = [];
  const unmatched = [];
  let counter = 0;

  sorted.forEach((tx) => {
    const isin = tx.isin;
    const qty = Math.abs(tx.qty);
    const value = Math.abs(tx.valueEur);
    const fees = tx.fees;

    if (!isSell(tx)) {
      if (!buyQueues[isin]) buyQueues[isin] = [];
      buyQueues[isin].push({
        date: tx.date,
        product: tx.product,
        remainingQty: qty,
        pricePerShare: qty > 0 ? value / qty : 0,
        feesPerShare: qty > 0 ? fees / qty : 0,
      });
      return;
    }

    let sellQty = qty;
    const sellPricePerShare = qty > 0 ? value / qty : 0;
    const sellFeesPerShare = qty > 0 ? fees / qty : 0;
    const queue = buyQueues[isin] || [];

    while (sellQty > 0.00001 && queue.length > 0) {
      const buyLot = queue[0];
      const matchedQty = Math.min(sellQty, buyLot.remainingQty);

      const valorAquisicao = matchedQty * buyLot.pricePerShare;
      const valorRealizacao = matchedQty * sellPricePerShare;
      const matchedFees = matchedQty * buyLot.feesPerShare + matchedQty * sellFeesPerShare;

      realizations.push({
        id: makeId(counter++),
        produto: tx.product,
        isin,
        dataRealizacao: tx.date,
        valorRealizacao: valorRealizacao.toFixed(2),
        dataAquisicao: buyLot.date,
        valorAquisicao: valorAquisicao.toFixed(2),
        despesas: matchedFees.toFixed(2),
        codigo: getTaxCode(tx.product, isin),
        year: tx.date.split('-')[0],
      });

      buyLot.remainingQty -= matchedQty;
      sellQty -= matchedQty;
      if (buyLot.remainingQty <= 0.00001) queue.shift();
    }

    if (sellQty > 0.00001) {
      unmatched.push({
        id: makeId(counter++),
        produto: tx.product,
        isin,
        dataRealizacao: tx.date,
        qtyVendida: qty.toFixed(2),
        qtyNaoCorrespondida: sellQty.toFixed(2),
        valorNaoCorrespondido: (sellQty * sellPricePerShare).toFixed(2),
        year: tx.date.split('-')[0],
      });
    }
  });

  return { realizations, unmatched };
};
