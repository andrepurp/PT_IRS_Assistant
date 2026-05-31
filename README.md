# Assistente de IRS — Mais-Valias & Anexo J

Ferramenta **100% local (client-side)** para investidores residentes em Portugal que usam
corretoras estrangeiras (DEGIRO, Trading 212, XTB, …). Calcula as mais-valias por **FIFO** a
partir do CSV de transações da corretora e gera o **XML do Anexo J (Quadro 9.2-A)** pronto a
importar no Portal das Finanças.

Nenhum ficheiro ou dado financeiro é enviado para qualquer servidor — todo o processamento
acontece no browser.

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
- [`src/App.js`](src/App.js) — interface.
