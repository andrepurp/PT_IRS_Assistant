# Assistente de IRS

Conjunto de ferramentas fiscais **100% locais (client-side)** para contribuintes residentes em
Portugal. Nenhum ficheiro ou dado financeiro é enviado para qualquer servidor — todo o
processamento acontece no browser.

## Ferramentas

- **Mais-Valias** — calcula as mais-valias de investimentos por **FIFO** a partir do CSV da
  corretora (DEGIRO, Trading 212, XTB, …) e gera o **XML do Anexo J (Quadro 9.2-A)** pronto a
  importar no Portal das Finanças. Ativos portugueses são separados para o Anexo G.
- **Salário Líquido** — do vencimento bruto ao líquido: Segurança Social (11%) + retenção de IRS
  pelas tabelas oficiais de 2026 (Tabelas I, II e III).
- **Dividendos** — imposto a pagar sobre dividendos estrangeiros (Anexo J Quadro 8A): 28% com
  crédito do imposto pago no estrangeiro.
- **Imóveis** — mais-valias imobiliárias (Anexo G Quadro 4): correção monetária pela tabela de
  coeficientes de 2025 e tributação de 50%.
- **Simulador IRS** — estimativa da liquidação anual (escalões de 2025): reembolso ou imposto a pagar.
- **e-Fatura** — estimativa das deduções por categoria de despesa.

> As ferramentas são auxiliares de cálculo e **não constituem aconselhamento fiscal**. Os valores
> oficiais (tabelas, escalões, coeficientes) são confirmados em fontes oficiais e datados, mas
> confirme sempre antes de submeter.

## Como funciona

1. **Mais-Valias** → carregue o CSV de transações da sua corretora (histórico completo, desde a
   abertura da conta, para o FIFO encontrar as compras antigas).
2. A app calcula os pares compra/venda por FIFO e mostra as mais-valias por ano fiscal, mais
   avisos para vendas sem compra correspondente e para eventos societários (splits/fusões).
3. No Portal das Finanças, inicie a declaração Modelo 3, **adicione o Anexo J** e **grave-a num
   ficheiro XML**.
4. Carregue esse XML na app e clique em **Gerar XML do Anexo J**. As suas mais-valias são
   **fundidas** no Quadro 9.2-A, preservando o resto da declaração.
5. **Importe o XML gerado** no Portal. ⚠️ A importação **substitui** a declaração atual — por isso
   partimos sempre do seu próprio ficheiro exportado.

> ⚠️ O Portal das Finanças **não importa CSV** para o IRS — só importa o XML da declaração Modelo 3.
> A exportação CSV desta app serve apenas como **folha de conferência / preenchimento manual**.

## Códigos

- **G01** — ações e outros valores mobiliários.
- **G20** — unidades de participação em fundos / ETFs.

O código é inferido pelo nome do produto e pode ser alterado manualmente em cada linha.

## Ativos portugueses (Anexo G)

Ativos com ISIN português (PT…) são rendimento de fonte nacional: pertencem ao **Anexo G**,
não ao Anexo J. A app separa-os automaticamente, exclui-os do XML do Anexo J, e disponibiliza um
**relatório CSV do Anexo G** para preenchimento manual no Quadro 9.

## Detalhes do cálculo

- **FIFO por data e hora** — trades do mesmo dia são emparelhados pela ordem cronológica real.
- **Despesas** incluem os custos de transação e a taxa de conversão cambial da corretora (AutoFX).
- Ficheiros com número de colunas variável (ex.: exports antigos da DEGIRO) são lidos na mesma.

## Limitações conhecidas

- **Imposto pago no estrangeiro** (coluna C04) é exportado a 0. Raro em mais-valias; se aplicável,
  preencha-o manualmente no Portal.
- **Eventos societários** (splits/fusões) são sinalizados mas não ajustados automaticamente —
  reveja os ativos afetados.
- A deteção de compra/venda cobre DEGIRO (sinal da quantidade/valor) e brokers com coluna de
  sentido (Trading 212 "Action"). Outros formatos podem precisar de validação.
- A app é um **auxiliar de cálculo e não constitui aconselhamento fiscal**. Confirme sempre os
  valores antes de submeter.

## Desenvolvimento

```bash
npm install
npm start     # http://localhost:3000
npm test      # testes (gains, anexoJ, App)
npm run build # build de produção
```

A lógica está separada da UI para ser testável:

- [`src/gains.js`](src/gains.js) — parsing de CSV e cálculo FIFO.
- [`src/anexoJ.js`](src/anexoJ.js) — fusão das mais-valias no XML do Anexo J + tabela de países.
- [`src/anexoG.js`](src/anexoG.js) — fusão no Anexo G + NIF do emitente ([`src/nifPt.json`](src/nifPt.json)).
- [`src/salario.js`](src/salario.js), [`src/dividendos.js`](src/dividendos.js), [`src/imovel.js`](src/imovel.js), [`src/irsanual.js`](src/irsanual.js) — calculadoras.
- [`src/App.js`](src/App.js) — interface.

### Manutenção da tabela de NIF (Anexo G)

A tabela ISIN → NIF do emitente ([`src/nifPt.json`](src/nifPt.json)) pode ser verificada/atualizada
com a API pública do GLEIF (ferramenta de build, nunca corre no browser):

```bash
npm run gen:nif                     # verifica e reporta divergências (não grava)
npm run gen:nif -- --write          # grava entradas novas e confirma
node scripts/generate-nif-table.mjs PTXXX0XX0000   # acrescenta um ISIN a resolver
```

Divergências em relação aos valores atuais não são sobrepostas sem `--force` — por serem dados
de uma declaração fiscal, devem ser revistas à mão.
