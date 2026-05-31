import React, { useState } from 'react';
import {
  UploadCloud,
  Download,
  CheckCircle,
  Receipt,
  Activity,
  Home,
  Utensils,
  FileText,
  Info,
  HelpCircle,
  Server,
  AlertTriangle,
  Trash2,
  ShieldCheck,
  Globe,
  Landmark,
  ArrowRight,
  Wallet,
} from 'lucide-react';
import { mergeAnexoJ, isinToCodPais } from './anexoJ';
import { parseCSV, computeGains, getCountryFromIsin, isPortugueseIsin } from './gains';
import { calcSalario, TABELA_2026_I, TABELA_2026_II, TABELA_2026_III } from './salario';
import { calcDividendos } from './dividendos';
import { calcMaisValiaImovel, ANO_VENDA } from './imovel';

export default function App() {
  const [activeTab, setActiveTab] = useState('investimentos');
  const [step, setStep] = useState(1);
  const [processedGains, setProcessedGains] = useState([]);
  const [unmatchedSales, setUnmatchedSales] = useState([]);
  const [corporateActions, setCorporateActions] = useState([]);
  const [csvError, setCsvError] = useState('');
  const [taxYear, setTaxYear] = useState('2024');
  const [declarationXml, setDeclarationXml] = useState(null);
  const [declarationName, setDeclarationName] = useState('');
  const [xmlError, setXmlError] = useState('');
  const [xmlWarnings, setXmlWarnings] = useState([]);
  const [xmlReady, setXmlReady] = useState(false);
  const [efatura, setEfatura] = useState({ geral: '', saude: '', educacao: '', habitacao: '', iva: '' });
  const [salBruto, setSalBruto] = useState('');
  const [salDeps, setSalDeps] = useState('0');
  const [salSit, setSalSit] = useState('solteiro');
  const [divEntries, setDivEntries] = useState([{ id: 1, pais: 'Estados Unidos', bruto: '', imp: '' }]);
  const [imv, setImv] = useState({ anoAquisicao: '', valorAquisicao: '', valorRealizacao: '', despesasAquisicao: '', encargosValorizacao: '', despesasVenda: '', reinvestimento: false });

  const efaturaLimits = {
    geral: { max: 250, rate: 0.35, label: 'Despesas Gerais', icon: Receipt, color: 'text-blue-500' },
    saude: { max: 1000, rate: 0.15, label: 'Saúde', icon: Activity, color: 'text-green-500' },
    educacao: { max: 800, rate: 0.30, label: 'Educação', icon: FileText, color: 'text-yellow-500' },
    habitacao: { max: 502, rate: 0.15, label: 'Habitação', icon: Home, color: 'text-purple-500' },
    iva: { max: 250, rate: 0.15 * 0.23, label: 'Fatura Exigida', icon: Utensils, color: 'text-orange-500' },
  };

  const processarCSV = (csvText) => {
    const { transactions, skipped } = parseCSV(csvText);
    const { realizations, unmatched } = computeGains(transactions);
    setProcessedGains(realizations);
    setUnmatchedSales(unmatched);
    setCorporateActions(skipped);
    setXmlReady(false);
    // Seleciona automaticamente o ano mais recente com mais-valias.
    const years = Array.from(new Set(realizations.map((r) => r.year))).sort((a, b) => b.localeCompare(a));
    if (years.length) setTaxYear(years[0]);
    setStep(3);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setCsvError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        processarCSV(e.target.result);
      } catch (err) {
        setCsvError('Não foi possível ler este ficheiro. Confirme que é um CSV de transações da sua corretora.');
      }
    };
    reader.readAsText(file);
  };

  // Folha de cálculo para CONFERÊNCIA / preenchimento manual do Quadro 9.2-A (NÃO importável).
  const downloadATCSV = () => {
    let csvContent = 'Pais_Fonte_Codigo;Pais_Fonte;Codigo;Data_Aquisicao;Valor_Aquisicao;Data_Realizacao;Valor_Realizacao;Despesas;ISIN;Produto\n';
    anexoJGains.forEach((g) => {
      const pais = isinToCodPais(g.isin);
      csvContent += `${pais.code};${pais.alpha2 || getCountryFromIsin(g.isin)};${g.codigo};${g.dataAquisicao};${g.valorAquisicao.replace('.', ',')};${g.dataRealizacao};${g.valorRealizacao.replace('.', ',')};${g.despesas.replace('.', ',')};${g.isin};"${g.produto}"\n`;
    });
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AnexoJ_Conferencia_${taxYear}.csv`;
    link.click();
  };

  // Relatório dos ativos PORTUGUESES para preenchimento manual do Anexo G (Quadro 9).
  // Colunas alinhadas com o formulário: Titular, NIF da entidade emitente, Código, Realização
  // (Ano/Mês/Dia/Valor), Aquisição (Ano/Mês/Dia/Valor), Despesas, País contraparte, Admitido a
  // negociação. NIF da entidade emitente fica em branco (tem de ser preenchido manualmente).
  const downloadAnexoGCSV = () => {
    const n = (v) => parseInt(v, 10);
    let csv = 'Titular;NIF_Entidade_Emitente;Codigo;Ano_Realizacao;Mes_Realizacao;Dia_Realizacao;Valor_Realizacao;Ano_Aquisicao;Mes_Aquisicao;Dia_Aquisicao;Valor_Aquisicao;Despesas;Pais_Contraparte;Admitido_Negociacao;ISIN;Produto\n';
    anexoGGains.forEach((g) => {
      const [ra, rm, rd] = g.dataRealizacao.split('-');
      const [aa, am, ad] = g.dataAquisicao.split('-');
      const pais = isinToCodPais(g.isin); // PT -> 620
      csv += `A;;${g.codigo};${ra};${n(rm)};${n(rd)};${g.valorRealizacao.replace('.', ',')};${aa};${n(am)};${n(ad)};${g.valorAquisicao.replace('.', ',')};${g.despesas.replace('.', ',')};${pais.code};S;${g.isin};"${g.produto}"\n`;
    });
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AnexoG_${taxYear}.csv`;
    link.click();
  };

  const handleDeclarationUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setXmlError('');
    setXmlWarnings([]);
    setXmlReady(false);
    const reader = new FileReader();
    reader.onload = (e) => {
      setDeclarationXml(e.target.result);
      setDeclarationName(file.name);
    };
    reader.readAsText(file);
  };

  const exportAnexoJXML = () => {
    setXmlError('');
    setXmlWarnings([]);
    setXmlReady(false);
    if (!declarationXml) {
      setXmlError('Carregue primeiro o XML da sua declaração exportado do Portal das Finanças.');
      return;
    }
    if (anexoJGains.length === 0) {
      setXmlError(`Não há mais-valias de ativos estrangeiros em ${taxYear} para incluir no Anexo J.`);
      return;
    }
    try {
      const { xml, warnings } = mergeAnexoJ(declarationXml, anexoJGains);
      setXmlWarnings(warnings);
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Declaracao_AnexoJ_${taxYear}.xml`;
      link.click();
      setXmlReady(true);
    } catch (err) {
      setXmlError(err.message || 'Não foi possível gerar o XML.');
    }
  };

  const updateGainCode = (id, newCode) => {
    setProcessedGains((prev) => prev.map((g) => (g.id === id ? { ...g, codigo: newCode } : g)));
  };

  const removeGainRow = (id) => {
    setProcessedGains((prev) => prev.filter((g) => g.id !== id));
  };

  const restart = () => {
    setStep(1);
    setDeclarationXml(null);
    setDeclarationName('');
    setXmlError('');
    setXmlWarnings([]);
    setXmlReady(false);
  };

  const availableYears = Array.from(new Set(processedGains.map((g) => g.year))).sort((a, b) => b.localeCompare(a));
  const yearOptions = availableYears.length ? availableYears : ['2025', '2024', '2023'];
  const yearGains = processedGains.filter((g) => g.year === taxYear);
  const anexoJGains = yearGains.filter((g) => !isPortugueseIsin(g.isin)); // estrangeiros -> Anexo J
  const anexoGGains = yearGains.filter((g) => isPortugueseIsin(g.isin)); // portugueses -> Anexo G
  const filteredUnmatched = unmatchedSales.filter((u) => u.year === taxYear);
  const filteredCorporateActions = corporateActions.filter((c) => c.year === taxYear);

  const stats = anexoJGains.reduce(
    (acc, curr) => {
      acc.vendas += parseFloat(curr.valorRealizacao);
      acc.compras += parseFloat(curr.valorAquisicao);
      acc.despesas += parseFloat(curr.despesas);
      return acc;
    },
    { vendas: 0, compras: 0, despesas: 0 }
  );
  const netGains = stats.vendas - stats.compras - stats.despesas;

  const getRemainingText = (key, val) => {
    const limit = efaturaLimits[key].max;
    const current = parseFloat(val) || 0;
    if (current >= limit) return 'Limite máximo atingido!';
    const needed = (limit - current) / efaturaLimits[key].rate;
    return `Para atingir o limite, gastar aprox. ${needed.toFixed(2)}€`;
  };

  // Mapeia a situação para a tabela de retenção e se a contagem de dependentes se aplica.
  const SAL_SITUACOES = {
    solteiro: { tabela: TABELA_2026_I, deps: false },
    casado2: { tabela: TABELA_2026_I, deps: true },
    solteiro_dep: { tabela: TABELA_2026_II, deps: true },
    casado1: { tabela: TABELA_2026_III, deps: true },
  };
  const salCfg = SAL_SITUACOES[salSit];
  const salResult =
    salBruto && parseFloat(salBruto) > 0
      ? calcSalario(parseFloat(salBruto), salCfg.tabela, salCfg.deps ? parseInt(salDeps, 10) || 0 : 0)
      : null;

  const addDiv = () => setDivEntries((p) => [...p, { id: Math.max(0, ...p.map((e) => e.id)) + 1, pais: '', bruto: '', imp: '' }]);
  const updateDiv = (id, field, val) => setDivEntries((p) => p.map((e) => (e.id === id ? { ...e, [field]: val } : e)));
  const removeDiv = (id) => setDivEntries((p) => (p.length > 1 ? p.filter((e) => e.id !== id) : p));
  const divResult = calcDividendos(divEntries.map((e) => ({ pais: e.pais, bruto: e.bruto, impostoEstrangeiro: e.imp })));
  const setImvField = (f, v) => setImv((p) => ({ ...p, [f]: v }));
  const imvResult =
    imv.anoAquisicao && imv.valorAquisicao && imv.valorRealizacao
      ? calcMaisValiaImovel({ ...imv, reinvestimentoTotal: imv.reinvestimento })
      : null;

  const downloadDividendosCSV = () => {
    let csv = 'Pais;Valor_Bruto;Imposto_Pago_Estrangeiro\n';
    divEntries.forEach((e) => {
      if (e.pais || e.bruto) csv += `"${e.pais}";${(parseFloat(e.bruto) || 0).toFixed(2).replace('.', ',')};${(parseFloat(e.imp) || 0).toFixed(2).replace('.', ',')}\n`;
    });
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Dividendos_AnexoJ_8A.csv';
    link.click();
  };

  const tabBtn = (id, label) =>
    `flex-1 min-w-[110px] py-3 rounded-xl font-bold transition-all ${
      activeTab === id ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
    }`;

  // Indicador de passos (1 Carregar -> 2 Rever -> 3 Importar)
  const Stepper = () => {
    const stages = [
      { n: 1, label: 'Carregar transações' },
      { n: 2, label: 'Rever mais-valias' },
      { n: 3, label: 'Importar no Portal' },
    ];
    const current = step === 1 ? 1 : xmlReady ? 3 : 2;
    return (
      <div className="flex items-center justify-center gap-2 sm:gap-4 mb-8">
        {stages.map((s, i) => (
          <React.Fragment key={s.n}>
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                  current > s.n
                    ? 'bg-green-500 text-white'
                    : current === s.n
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {current > s.n ? <CheckCircle size={16} /> : s.n}
              </div>
              <span className={`text-xs font-semibold hidden sm:block ${current >= s.n ? 'text-gray-800' : 'text-gray-400'}`}>
                {s.label}
              </span>
            </div>
            {i < stages.length - 1 && <div className={`h-0.5 w-4 sm:w-10 ${current > s.n ? 'bg-green-400' : 'bg-gray-200'}`} />}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 sm:p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900">Assistente de IRS</h1>
          <p className="text-gray-500 mt-2 max-w-xl mx-auto">
            Calcula as mais-valias dos seus investimentos (FIFO) e gera o <b>Anexo J</b> pronto a importar no Portal das Finanças.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs">
            <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">
              <ShieldCheck size={14} /> 100% local e privado
            </span>
            <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">
              <Activity size={14} /> Cálculo FIFO automático
            </span>
          </div>
        </header>

        <div className="flex flex-wrap gap-1 bg-white rounded-2xl p-1 shadow-sm border border-gray-200 mb-8">
          <button onClick={() => setActiveTab('investimentos')} className={tabBtn('investimentos')}>Mais-Valias</button>
          <button onClick={() => setActiveTab('salario')} className={tabBtn('salario')}>Salário Líquido</button>
          <button onClick={() => setActiveTab('dividendos')} className={tabBtn('dividendos')}>Dividendos</button>
          <button onClick={() => setActiveTab('imoveis')} className={tabBtn('imoveis')}>Imóveis</button>
          <button onClick={() => setActiveTab('efatura')} className={tabBtn('efatura')}>e-Fatura</button>
          <button onClick={() => setActiveTab('instrucoes')} className={tabBtn('instrucoes')}>Instruções</button>
        </div>

        {activeTab === 'investimentos' && (
          <div className="space-y-6">
            <Stepper />

            {step === 1 && (
              <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                <div className="text-center">
                  <h2 className="text-xl font-bold text-gray-800">Passo 1 — Carregue o histórico da sua corretora</h2>
                  <p className="text-sm text-gray-500 mt-1">Um ficheiro CSV com todas as suas transações de compra e venda.</p>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-left space-y-3">
                  <h3 className="font-bold text-blue-900 flex items-center gap-2">
                    <Info size={18} /> Como obter o ficheiro
                  </h3>
                  <p className="text-sm text-blue-800 leading-relaxed">
                    Exemplo DEGIRO: entre na sua conta, vá a <b>Atividade &gt; Transações</b>, <b>remova os filtros de data</b>{' '}
                    (selecione desde a abertura da conta) e exporte o histórico completo. É importante incluir tudo, para o
                    cálculo FIFO encontrar também as compras de anos anteriores.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {['DEGIRO', 'Trading 212', 'XTB', 'e outros'].map((b) => (
                      <span key={b} className="bg-white px-3 py-1 rounded-full border border-blue-200 text-blue-700 font-semibold text-xs">{b}</span>
                    ))}
                  </div>
                </div>

                <div
                  className="border-2 border-dashed border-gray-200 rounded-2xl p-10 sm:p-12 hover:border-blue-500 hover:bg-blue-50/30 transition-all cursor-pointer bg-gray-50/50 text-center"
                  onClick={() => document.getElementById('fileInput').click()}
                >
                  <UploadCloud className="mx-auto text-blue-400 mb-4" size={48} />
                  <p className="font-bold text-gray-700 text-lg">Arraste ou clique para carregar o CSV</p>
                  <p className="text-xs text-gray-400 mt-1">O ficheiro nunca sai do seu computador</p>
                  <input id="fileInput" type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                </div>
                {csvError && (
                  <p className="text-sm text-red-600 font-semibold flex items-center justify-center gap-1">
                    <AlertTriangle size={16} /> {csvError}
                  </p>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                {/* Cabeçalho + seletor de ano */}
                <div className="bg-white p-5 sm:p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                      <CheckCircle className="text-green-500" /> Passo 2 — Reveja as suas mais-valias
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Escolha o ano que vai declarar. Verifique os valores antes de gerar o ficheiro.</p>
                  </div>
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <span className="text-sm text-gray-500 font-medium whitespace-nowrap">Ano:</span>
                    <select value={taxYear} onChange={(e) => setTaxYear(e.target.value)} className="flex-1 p-3 border rounded-xl font-semibold bg-gray-50 text-gray-800">
                      {yearOptions.map((yr) => (
                        <option key={yr} value={yr}>{yr}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Dashboard — Anexo J (estrangeiros) */}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Resumo do Anexo J (ativos estrangeiros)</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                    <div className="bg-white p-4 sm:p-5 rounded-2xl border text-center">
                      <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Total de Vendas</p>
                      <p className="text-lg sm:text-xl font-extrabold text-gray-900 mt-1">{stats.vendas.toFixed(2)}€</p>
                    </div>
                    <div className="bg-white p-4 sm:p-5 rounded-2xl border text-center">
                      <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Custo de Compra (FIFO)</p>
                      <p className="text-lg sm:text-xl font-extrabold text-gray-900 mt-1">{stats.compras.toFixed(2)}€</p>
                    </div>
                    <div className="bg-white p-4 sm:p-5 rounded-2xl border text-center">
                      <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Despesas</p>
                      <p className="text-lg sm:text-xl font-extrabold text-gray-900 mt-1">{stats.despesas.toFixed(2)}€</p>
                    </div>
                    <div className={`p-4 sm:p-5 rounded-2xl border text-center ${netGains >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Mais-Valia Líquida</p>
                      <p className={`text-lg sm:text-xl font-extrabold mt-1 ${netGains >= 0 ? 'text-green-600' : 'text-red-600'}`}>{netGains.toFixed(2)}€</p>
                    </div>
                  </div>
                </div>

                {/* Ativos portugueses -> Anexo G (excluídos do Anexo J) */}
                {anexoGGains.length > 0 && (
                  <div className="bg-indigo-50 border border-indigo-200 p-5 rounded-2xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h4 className="font-bold text-indigo-900 flex items-center gap-2">
                        <Landmark size={20} /> {anexoGGains.length} ativo(s) português(es) — vão para o Anexo G
                      </h4>
                      <button onClick={downloadAnexoGCSV} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-1 justify-center whitespace-nowrap">
                        <Download size={14} /> Relatório Anexo G (CSV)
                      </button>
                    </div>
                    <p className="text-xs text-indigo-800 leading-relaxed">
                      O <b>Anexo J é só para rendimentos do estrangeiro</b>. Estes ativos têm ISIN português (PT…), por isso
                      <b> foram excluídos do ficheiro XML</b> e o Portal recusaria a "País da Fonte". Descarregue o relatório e
                      declare estas mais-valias <b>manualmente no Anexo G</b> (Quadro 9).
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-indigo-900 bg-white/60 rounded-xl overflow-hidden mt-1">
                        <thead>
                          <tr className="bg-indigo-100 font-semibold text-indigo-800 border-b border-indigo-200">
                            <th className="p-2">Ativo / ISIN</th>
                            <th className="p-2">Compra</th>
                            <th className="p-2">Venda</th>
                            <th className="p-2">Despesas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-indigo-100">
                          {anexoGGains.map((g) => (
                            <tr key={g.id}>
                              <td className="p-2 font-medium">{g.produto}<span className="block text-[10px] text-indigo-500 font-mono">{g.isin}</span></td>
                              <td className="p-2">{g.dataAquisicao} · {g.valorAquisicao}€</td>
                              <td className="p-2">{g.dataRealizacao} · {g.valorRealizacao}€</td>
                              <td className="p-2 font-bold">{g.despesas}€</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Aviso: eventos societários (splits/fusões) */}
                {filteredCorporateActions.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 p-5 rounded-2xl space-y-2">
                    <h4 className="font-bold text-orange-800 flex items-center gap-2">
                      <AlertTriangle size={20} /> {filteredCorporateActions.length} movimento(s) sem preço em {taxYear}
                    </h4>
                    <p className="text-xs text-orange-700 leading-relaxed">
                      Têm quantidade mas não têm preço — costumam ser <b>splits, fusões ou outros eventos societários</b>.
                      Não entram no cálculo FIFO, mas <b>alteram o número de ações</b> e podem afetar os custos. Verifique os
                      ativos afetados:
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-orange-900 bg-white/50 rounded-xl overflow-hidden mt-1">
                        <thead>
                          <tr className="bg-orange-100 font-semibold text-orange-800 border-b border-orange-200">
                            <th className="p-2">Ativo / ISIN</th>
                            <th className="p-2">Data</th>
                            <th className="p-2">Quantidade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-orange-100">
                          {filteredCorporateActions.map((c, i) => (
                            <tr key={i}>
                              <td className="p-2 font-medium">{c.product}<span className="block text-[10px] text-orange-600 font-mono">{c.isin}</span></td>
                              <td className="p-2">{c.date}</td>
                              <td className="p-2 font-bold">{c.qty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Aviso: vendas sem compra correspondente */}
                {filteredUnmatched.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl space-y-3">
                    <h4 className="font-bold text-amber-800 flex items-center gap-2">
                      <AlertTriangle size={20} /> {filteredUnmatched.length} venda(s) sem compra correspondente
                    </h4>
                    <p className="text-xs text-amber-700 leading-relaxed">
                      Vendas em {taxYear} para as quais <b>não foi encontrada a compra</b> neste ficheiro (provavelmente
                      comprou antes de {taxYear}). <b>Volte a exportar o CSV desde a abertura da conta</b> para incluir todo o
                      histórico — caso contrário estas mais-valias ficam por declarar.
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-amber-900 bg-white/50 rounded-xl overflow-hidden mt-1">
                        <thead>
                          <tr className="bg-amber-100 font-semibold text-amber-800 border-b border-amber-200">
                            <th className="p-2">Ativo / ISIN</th>
                            <th className="p-2">Data da Venda</th>
                            <th className="p-2">Quant.</th>
                            <th className="p-2">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100">
                          {filteredUnmatched.map((u) => (
                            <tr key={u.id}>
                              <td className="p-2 font-medium">{u.produto}<span className="block text-[10px] text-amber-600 font-mono">{u.isin}</span></td>
                              <td className="p-2">{u.dataRealizacao}</td>
                              <td className="p-2">{u.qtyNaoCorrespondida} / {u.qtyVendida}</td>
                              <td className="p-2 font-bold">{u.valorNaoCorrespondido}€</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tabela de transações do Anexo J */}
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                  <div className="p-5 border-b flex justify-between items-center">
                    <h4 className="font-bold text-gray-800">Linhas do Anexo J ({anexoJGains.length})</h4>
                    <button onClick={restart} className="text-sm text-red-500 font-semibold hover:underline">Carregar outro ficheiro</button>
                  </div>

                  {anexoJGains.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                      <AlertTriangle className="mx-auto mb-2 text-yellow-500" />
                      Sem mais-valias de ativos estrangeiros para {taxYear}.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider border-b">
                            <th className="p-4">Ativo / País</th>
                            <th className="p-4">Compra (Data/€)</th>
                            <th className="p-4">Venda (Data/€)</th>
                            <th className="p-4">Despesas</th>
                            <th className="p-4">Código</th>
                            <th className="p-4 text-center">Remover</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-sm text-gray-700">
                          {anexoJGains.map((g) => {
                            const pais = isinToCodPais(g.isin);
                            return (
                              <tr key={g.id} className="hover:bg-gray-50/50">
                                <td className="p-4 font-medium">
                                  <div className="max-w-[160px] truncate font-bold text-gray-800" title={g.produto}>{g.produto}</div>
                                  <div className="text-xs text-gray-400 font-mono flex items-center gap-1">
                                    <Globe size={11} className={pais.known ? 'text-blue-400' : 'text-red-400'} />
                                    {pais.alpha2 || '??'} <span className="text-gray-300">·</span> {g.isin}
                                  </div>
                                </td>
                                <td className="p-4">
                                  <span className="text-xs text-gray-400 block">{g.dataAquisicao}</span>
                                  <span className="font-semibold">{g.valorAquisicao}€</span>
                                </td>
                                <td className="p-4">
                                  <span className="text-xs text-gray-400 block">{g.dataRealizacao}</span>
                                  <span className="font-semibold">{g.valorRealizacao}€</span>
                                </td>
                                <td className="p-4 font-semibold text-gray-600">{g.despesas}€</td>
                                <td className="p-4">
                                  <select value={g.codigo} onChange={(e) => updateGainCode(g.id, e.target.value)} className="p-1.5 border rounded-lg bg-gray-50 text-xs font-bold text-gray-700">
                                    <option value="G01">G01 (Ações)</option>
                                    <option value="G20">G20 (ETFs/Fundos)</option>
                                  </select>
                                </td>
                                <td className="p-4 text-center">
                                  <button onClick={() => removeGainRow(g.id)} className="text-red-400 hover:text-red-600 p-1" title="Remover linha">
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Passo 3 — gerar XML */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 sm:p-6 space-y-4">
                  <h4 className="font-bold text-blue-900 text-lg flex items-center gap-2">
                    <FileText size={20} /> Passo 3 — Gere e importe o Anexo J
                  </h4>
                  <p className="text-sm text-blue-800 leading-relaxed">
                    O Portal das Finanças <b>não aceita CSV</b> — só o ficheiro XML da sua declaração. Por isso juntamos as
                    mais-valias à <b>sua</b> declaração, sem mexer no resto:
                  </p>

                  <ol className="space-y-3">
                    {[
                      <>No Portal, abra a sua declaração de IRS, <b>adicione o Anexo J (deixe-o vazio)</b> e clique em <b>Gravar</b> para descarregar o ficheiro <b>.xml</b>.</>,
                      <>Aqui em baixo, <b>carregue esse .xml</b> e clique em <b>Gerar XML do Anexo J</b>.</>,
                      <>No Portal, escolha <b>"Leitura de uma declaração gravada num ficheiro"</b>, importe o ficheiro gerado, e use <b>Validar</b> e <b>Simular</b> antes de submeter.</>,
                    ].map((txt, i) => (
                      <li key={i} className="flex gap-3 text-sm text-blue-900">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">{i + 1}</span>
                        <span className="leading-relaxed">{txt}</span>
                      </li>
                    ))}
                  </ol>

                  <div className="flex flex-col sm:flex-row gap-3 items-stretch pt-1">
                    <button onClick={() => document.getElementById('declInput').click()} className="flex-1 bg-white border-2 border-blue-300 text-blue-700 font-semibold px-4 py-3 rounded-xl flex items-center gap-2 justify-center hover:bg-blue-50 transition">
                      <UploadCloud size={18} /> {declarationName ? `✓ ${declarationName}` : '1. Carregar XML da declaração'}
                    </button>
                    <input id="declInput" type="file" className="hidden" accept=".xml" onChange={handleDeclarationUpload} />
                    <ArrowRight className="hidden sm:block text-blue-300 self-center shrink-0" size={20} />
                    <button onClick={exportAnexoJXML} disabled={!declarationXml} className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold px-6 py-3 rounded-xl shadow-md transition flex items-center gap-2 justify-center">
                      <Download size={18} /> 2. Gerar XML do Anexo J
                    </button>
                  </div>

                  {xmlReady && !xmlError && (
                    <p className="text-sm text-green-700 font-semibold flex items-center gap-1 bg-green-50 border border-green-200 rounded-lg p-3">
                      <CheckCircle size={16} /> Ficheiro gerado! Importe <b>Declaracao_AnexoJ_{taxYear}.xml</b> no Portal e valide.
                    </p>
                  )}
                  {xmlError && (
                    <p className="text-sm text-red-600 font-semibold flex items-center gap-1"><AlertTriangle size={16} /> {xmlError}</p>
                  )}
                  {xmlWarnings.length > 0 && (
                    <ul className="text-xs text-amber-700 list-disc pl-5 space-y-1 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      {xmlWarnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}

                  <div className="flex items-center justify-between text-xs text-blue-700/70 border-t border-blue-200 pt-3">
                    <span>Prefere conferir à parte? Exporte uma folha de cálculo (não importável).</span>
                    <button onClick={downloadATCSV} className="font-semibold hover:underline flex items-center gap-1 whitespace-nowrap">
                      <Download size={14} /> Folha de cálculo (CSV)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'salario' && (
          <div className="space-y-6">
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm space-y-5">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 justify-center"><Wallet className="text-blue-600" /> Salário Líquido</h2>
                <p className="text-sm text-gray-500 mt-1">Do vencimento bruto ao líquido: Segurança Social + retenção de IRS ({TABELA_2026_I.ano}, Continente).</p>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Vencimento bruto mensal</label>
                  <div className="relative mt-1">
                    <input type="number" value={salBruto} onChange={(e) => setSalBruto(e.target.value)} placeholder="1500" className="w-full p-3 border rounded-xl font-semibold pr-8" />
                    <span className="absolute right-3 top-3.5 text-gray-400 font-semibold">€</span>
                  </div>
                </div>
                <div className="sm:col-span-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Situação</label>
                  <select value={salSit} onChange={(e) => setSalSit(e.target.value)} className="w-full mt-1 p-3 border rounded-xl font-semibold bg-gray-50 text-gray-800">
                    <option value="solteiro">Não casado, sem dependentes</option>
                    <option value="solteiro_dep">Não casado, com dependentes</option>
                    <option value="casado2">Casado, dois titulares</option>
                    <option value="casado1">Casado, único titular</option>
                  </select>
                </div>
                <div className="sm:col-span-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Dependentes</label>
                  <input type="number" min="0" value={salDeps} onChange={(e) => setSalDeps(e.target.value)} disabled={!salCfg.deps} className="w-full mt-1 p-3 border rounded-xl font-semibold disabled:bg-gray-100 disabled:text-gray-400" />
                </div>
              </div>

              {salResult && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-gray-50 p-4 rounded-2xl border text-center">
                      <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Bruto</p>
                      <p className="text-lg font-extrabold text-gray-900 mt-1">{salResult.bruto.toFixed(2)}€</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 text-center">
                      <p className="text-[11px] text-orange-500 font-bold uppercase tracking-wider">Seg. Social (11%)</p>
                      <p className="text-lg font-extrabold text-orange-700 mt-1">−{salResult.ss.toFixed(2)}€</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-center">
                      <p className="text-[11px] text-red-500 font-bold uppercase tracking-wider">Retenção IRS</p>
                      <p className="text-lg font-extrabold text-red-700 mt-1">−{salResult.irs.toFixed(2)}€</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-2xl border border-green-200 text-center">
                      <p className="text-[11px] text-green-600 font-bold uppercase tracking-wider">Líquido</p>
                      <p className="text-xl font-extrabold text-green-700 mt-1">{salResult.liquido.toFixed(2)}€</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 px-1">
                    <span>Taxa efetiva de IRS: <b className="text-gray-700">{salResult.taxaEfetivaIRS.toFixed(1)}%</b></span>
                    <span>Líquido anual (×14): <b className="text-gray-700">{(salResult.liquido * 14).toFixed(2)}€</b></span>
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-400 border-t pt-3">
                Estimativa para trabalho dependente no Continente, {TABELA_2026_I.ano}. A retenção é só um adiantamento — o
                imposto final é apurado no IRS anual. Subsídios de férias/Natal são tributados à parte. Confirme nas tabelas
                oficiais da AT.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'dividendos' && (
          <div className="space-y-6">
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm space-y-5">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 justify-center"><Globe className="text-blue-600" /> Dividendos Estrangeiros</h2>
                <p className="text-sm text-gray-500 mt-1">Imposto a pagar em Portugal sobre dividendos de fora (Anexo J, Quadro 8A) — 28% com crédito do imposto pago no estrangeiro.</p>
              </div>

              <div className="space-y-3">
                <div className="hidden sm:grid grid-cols-12 gap-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">
                  <span className="col-span-5">País da fonte</span>
                  <span className="col-span-3">Dividendo bruto (€)</span>
                  <span className="col-span-3">Imposto retido lá fora (€)</span>
                  <span className="col-span-1" />
                </div>
                {divEntries.map((e) => (
                  <div key={e.id} className="grid grid-cols-12 gap-2 items-center">
                    <input value={e.pais} onChange={(ev) => updateDiv(e.id, 'pais', ev.target.value)} placeholder="Estados Unidos" className="col-span-12 sm:col-span-5 p-2.5 border rounded-lg" />
                    <input type="number" value={e.bruto} onChange={(ev) => updateDiv(e.id, 'bruto', ev.target.value)} placeholder="1000" className="col-span-6 sm:col-span-3 p-2.5 border rounded-lg" />
                    <input type="number" value={e.imp} onChange={(ev) => updateDiv(e.id, 'imp', ev.target.value)} placeholder="150" className="col-span-5 sm:col-span-3 p-2.5 border rounded-lg" />
                    <button onClick={() => removeDiv(e.id)} className="col-span-1 text-red-400 hover:text-red-600 flex justify-center" title="Remover">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button onClick={addDiv} className="text-blue-600 font-semibold text-sm hover:underline">+ Adicionar dividendo</button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t pt-4">
                <div className="bg-gray-50 p-4 rounded-2xl border text-center">
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Total Bruto</p>
                  <p className="text-lg font-extrabold text-gray-900 mt-1">{divResult.bruto.toFixed(2)}€</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-center">
                  <p className="text-[11px] text-blue-500 font-bold uppercase tracking-wider">Imposto PT (28%)</p>
                  <p className="text-lg font-extrabold text-blue-700 mt-1">{divResult.impostoPT.toFixed(2)}€</p>
                </div>
                <div className="bg-green-50 p-4 rounded-2xl border border-green-100 text-center">
                  <p className="text-[11px] text-green-600 font-bold uppercase tracking-wider">Crédito (imposto lá fora)</p>
                  <p className="text-lg font-extrabold text-green-700 mt-1">−{divResult.credito.toFixed(2)}€</p>
                </div>
                <div className="bg-red-50 p-4 rounded-2xl border border-red-200 text-center">
                  <p className="text-[11px] text-red-500 font-bold uppercase tracking-wider">A pagar em PT</p>
                  <p className="text-xl font-extrabold text-red-700 mt-1">{divResult.aPagar.toFixed(2)}€</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 border-t pt-3">
                <span>Líquido final estimado (após imposto PT e estrangeiro): <b className="text-gray-700">{divResult.liquidoFinal.toFixed(2)}€</b></span>
                <button onClick={downloadDividendosCSV} className="text-gray-700 font-semibold hover:underline flex items-center gap-1 whitespace-nowrap">
                  <Download size={14} /> Folha Anexo J 8A (CSV)
                </button>
              </div>

              <p className="text-xs text-gray-400 border-t pt-3">
                Estimativa à taxa autónoma de 28%. O crédito por dupla tributação está limitado a 28% do bruto; ao abrigo das
                convenções, a retenção no estrangeiro costuma estar limitada (ex.: 15%) — o excesso retido tem de ser reclamado
                ao país da fonte. Pode optar pelo englobamento. Não é aconselhamento fiscal.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'imoveis' && (
          <div className="space-y-6">
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm space-y-5">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 justify-center"><Home className="text-blue-600" /> Mais-Valias Imobiliárias</h2>
                <p className="text-sm text-gray-500 mt-1">Venda de imóvel em {ANO_VENDA} (Anexo G, Quadro 4). Corrige a aquisição pela inflação e tributa 50%.</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  ['anoAquisicao', 'Ano de aquisição', 'number', '2010'],
                  ['valorAquisicao', 'Valor de aquisição (€)', 'number', '100000'],
                  ['valorRealizacao', 'Valor de venda (€)', 'number', '200000'],
                  ['despesasAquisicao', 'Despesas de aquisição: IMT, selo, escritura (€)', 'number', '5000'],
                  ['encargosValorizacao', 'Obras de valorização — últimos 12 anos (€)', 'number', '10000'],
                  ['despesasVenda', 'Despesas de venda: comissão, certificado (€)', 'number', '8000'],
                ].map(([f, label, type, ph]) => (
                  <div key={f}>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</label>
                    <input type={type} value={imv[f]} onChange={(e) => setImvField(f, e.target.value)} placeholder={ph} className="w-full mt-1 p-3 border rounded-xl font-semibold" />
                  </div>
                ))}
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={imv.reinvestimento} onChange={(e) => setImvField('reinvestimento', e.target.checked)} className="w-4 h-4" />
                Habitação própria permanente com <b>reinvestimento total</b> (isenta a mais-valia)
              </label>

              {imvResult && !imvResult.anoSuportado && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
                  <AlertTriangle size={16} /> Sem coeficiente para {imv.anoAquisicao} (a tabela cobre 2000–{ANO_VENDA}). Consulte a Portaria para anos anteriores.
                </p>
              )}

              {imvResult && imvResult.anoSuportado && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t pt-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border text-center">
                      <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Coeficiente</p>
                      <p className="text-lg font-extrabold text-gray-900 mt-1">×{imvResult.coef.toFixed(2)}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border text-center">
                      <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Aquisição corrigida</p>
                      <p className="text-lg font-extrabold text-gray-900 mt-1">{imvResult.valorAquisicaoCorrigido.toFixed(2)}€</p>
                    </div>
                    <div className={`p-4 rounded-2xl border text-center ${imvResult.maisValia >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-green-50 border-green-100'}`}>
                      <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Mais-valia</p>
                      <p className={`text-lg font-extrabold mt-1 ${imvResult.maisValia >= 0 ? 'text-blue-700' : 'text-green-700'}`}>{imvResult.maisValia.toFixed(2)}€</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-2xl border border-red-200 text-center">
                      <p className="text-[11px] text-red-500 font-bold uppercase tracking-wider">Tributável (50%)</p>
                      <p className="text-xl font-extrabold text-red-700 mt-1">{imvResult.tributavel.toFixed(2)}€</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 px-1">
                    A parte tributável é <b>englobada</b> com os seus outros rendimentos e tributada às taxas progressivas
                    do IRS (use o simulador de IRS para estimar o imposto final).
                  </p>
                </div>
              )}

              <p className="text-xs text-gray-400 border-t pt-3">
                Estimativa para vendas em {ANO_VENDA} (Portaria 382/2025). Não cobre regras especiais (ex.: reinvestimento
                parcial, imóveis afetos a atividade, heranças). Não é aconselhamento fiscal.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'efatura' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 flex items-start gap-2">
              <Info size={16} className="mt-0.5 shrink-0" />
              <span>
                Estimativa indicativa. Os limites e taxas de dedução do e-Fatura variam por ano fiscal e dependem do agregado
                familiar. Confirme sempre os valores oficiais no Portal das Finanças.
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {Object.entries(efaturaLimits).map(([key, data]) => (
                <div key={key} className="bg-white p-5 rounded-2xl border shadow-sm">
                  <h3 className="font-bold flex items-center gap-2 mb-3"><data.icon size={20} className={data.color} /> {data.label}</h3>
                  <input type="number" onChange={(e) => setEfatura({ ...efatura, [key]: e.target.value })} className="w-full p-2 border rounded-lg" placeholder="Valor atual (€)" />
                  <p className="text-xs text-gray-500 mt-2 font-medium">{getRemainingText(key, efatura[key])}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'instrucoes' && (
          <div className="space-y-6">
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm">
              <h2 className="text-2xl font-bold flex items-center gap-2 mb-6"><HelpCircle className="text-blue-600" /> Como funciona, passo a passo</h2>
              <div className="space-y-4">
                {[
                  { t: 'Exporte as transações da corretora', d: 'No separador Mais-Valias, carregue o CSV com o histórico completo (desde a abertura da conta). DEGIRO, Trading 212, XTB e outros.' },
                  { t: 'A app calcula as mais-valias (FIFO)', d: 'As compras e vendas são emparelhadas pelo critério FIFO da AT. Escolha o ano a declarar e confirme os valores na tabela.' },
                  { t: 'Ativos portugueses vão para o Anexo G', d: 'O Anexo J é só para o estrangeiro. Ativos com ISIN PT… são separados e devem ser declarados no Anexo G (a app avisa-o).' },
                  { t: 'Prepare a declaração no Portal', d: 'No Portal das Finanças, inicie o IRS, adicione o Anexo J (vazio) e grave a declaração num ficheiro XML ("Gravar").' },
                  { t: 'Gere o XML e importe', d: 'Carregue esse XML na app e clique em "Gerar XML do Anexo J". As mais-valias são fundidas no Quadro 9.2-A sem alterar o resto. Importe o ficheiro gerado no Portal.' },
                  { t: 'Valide e simule antes de submeter', d: 'No Portal, use "Validar" e "Simular" para confirmar que está tudo certo. Confira o país da fonte de cada linha.' },
                ].map((s, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center">{i + 1}</div>
                    <div>
                      <h3 className="font-bold text-gray-800">{s.t}</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">{s.d}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 flex items-start gap-2">
                <Info size={16} className="mt-0.5 shrink-0" />
                <span><b>Porque preciso do meu XML?</b> A importação no Portal substitui a declaração inteira. Por isso partimos do <b>seu</b> ficheiro — assim o salário e os outros rendimentos mantêm-se, e só acrescentamos o Anexo J.</span>
              </div>
              <p className="text-xs text-gray-400 mt-4">
                Esta ferramenta é um auxiliar de cálculo e <b>não constitui aconselhamento fiscal</b>. Confirme sempre os valores antes de submeter.
              </p>
            </div>

            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-lg flex items-center gap-2 mb-3"><Server className="text-blue-600" /> Privacidade</h3>
              <p className="text-gray-700 mb-2">A aplicação corre <b>100% no seu browser</b>.</p>
              <p className="text-sm text-gray-500">Nenhum ficheiro ou dado financeiro é enviado para qualquer servidor. O cálculo e a geração do XML acontecem inteiramente na sua máquina.</p>
            </div>
          </div>
        )}

        <footer className="text-center text-xs text-gray-400 mt-10 pb-4">
          Auxiliar de cálculo — não constitui aconselhamento fiscal. Os seus dados nunca saem do seu computador.
        </footer>
      </div>
    </div>
  );
}
