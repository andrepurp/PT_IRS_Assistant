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
  Trash2
} from 'lucide-react';
import { mergeAnexoJ, isinToCodPais } from './anexoJ';
import { parseCSV, computeGains, getCountryFromIsin } from './gains';

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
  const [efatura, setEfatura] = useState({ geral: '', saude: '', educacao: '', habitacao: '', iva: '' });

  const efaturaLimits = {
    geral: { max: 250, rate: 0.35, label: "Despesas Gerais", icon: Receipt, color: "text-blue-500" },
    saude: { max: 1000, rate: 0.15, label: "Saúde", icon: Activity, color: "text-green-500" },
    educacao: { max: 800, rate: 0.30, label: "Educação", icon: FileText, color: "text-yellow-500" },
    habitacao: { max: 502, rate: 0.15, label: "Habitação", icon: Home, color: "text-purple-500" },
    iva: { max: 250, rate: 0.15 * 0.23, label: "Fatura Exigida", icon: Utensils, color: "text-orange-500" }
  };

  const processarCSV = (csvText) => {
    const { transactions, skipped } = parseCSV(csvText);
    const { realizations, unmatched } = computeGains(transactions);

    setProcessedGains(realizations);
    setUnmatchedSales(unmatched);
    setCorporateActions(skipped);
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

  // Folha de c\u00E1lculo para CONFER\u00CANCIA / preenchimento manual do Quadro 9.2-A (N\u00C3O import\u00E1vel).
  const downloadATCSV = () => {
    let csvContent = "Pais_Fonte_Codigo;Pais_Fonte;Codigo;Data_Aquisicao;Valor_Aquisicao;Data_Realizacao;Valor_Realizacao;Despesas;ISIN;Produto\n";
    filteredGains.forEach(g => {
      const pais = isinToCodPais(g.isin);
      csvContent += `${pais.code};${pais.alpha2 || getCountryFromIsin(g.isin)};${g.codigo};${g.dataAquisicao};${g.valorAquisicao.replace('.',',')};${g.dataRealizacao};${g.valorRealizacao.replace('.',',')};${g.despesas.replace('.',',')};${g.isin};"${g.produto}"\n`;
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `AnexoJ_Conferencia_${taxYear}.csv`;
    link.click();
  };

  const handleDeclarationUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setXmlError('');
    setXmlWarnings([]);
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
    if (!declarationXml) {
      setXmlError('Carregue primeiro o XML da sua declaração exportado do Portal das Finanças.');
      return;
    }
    if (filteredGains.length === 0) {
      setXmlError(`Não há mais-valias correspondidas para ${taxYear} para incluir no Anexo J.`);
      return;
    }
    try {
      const { xml, warnings } = mergeAnexoJ(declarationXml, filteredGains);
      setXmlWarnings(warnings);
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Declaracao_AnexoJ_${taxYear}.xml`;
      link.click();
    } catch (err) {
      setXmlError(err.message || 'Não foi possível gerar o XML.');
    }
  };

  const updateGainCode = (id, newCode) => {
    setProcessedGains(prev => prev.map(g => g.id === id ? { ...g, codigo: newCode } : g));
  };

  const removeGainRow = (id) => {
    setProcessedGains(prev => prev.filter(g => g.id !== id));
  };

  const filteredGains = processedGains.filter(g => g.year === taxYear);
  const filteredUnmatched = unmatchedSales.filter(u => u.year === taxYear);
  const filteredCorporateActions = corporateActions.filter(c => c.year === taxYear);

  const stats = filteredGains.reduce((acc, curr) => {
    acc.vendas += parseFloat(curr.valorRealizacao);
    acc.compras += parseFloat(curr.valorAquisicao);
    acc.despesas += parseFloat(curr.despesas);
    return acc;
  }, { vendas: 0, compras: 0, despesas: 0 });

  const netGains = stats.vendas - stats.compras - stats.despesas;

  const getRemainingText = (key, val) => {
    const limit = efaturaLimits[key].max;
    const current = parseFloat(val) || 0;
    if (current >= limit) return "Limite máximo atingido!";
    const needed = (limit - current) / efaturaLimits[key].rate;
    return `Para atingir o limite, gastar aprox. ${needed.toFixed(2)}€`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold text-gray-900">Assistente de IRS</h1>
          <p className="text-gray-500 mt-2">Calculadora de Mais-Valias FIFO & Otimização do e-Fatura</p>
        </header>

        <div className="flex flex-wrap bg-white rounded-2xl p-1 shadow-sm border border-gray-200 mb-8">
          <button onClick={() => setActiveTab('investimentos')} className={`flex-1 min-w-[120px] py-3 rounded-xl font-bold transition-all ${activeTab === 'investimentos' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>Mais-Valias</button>
          <button onClick={() => setActiveTab('efatura')} className={`flex-1 min-w-[120px] py-3 rounded-xl font-bold transition-all ${activeTab === 'efatura' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>e-Fatura</button>
          <button onClick={() => setActiveTab('instrucoes')} className={`flex-1 min-w-[120px] py-3 rounded-xl font-bold transition-all ${activeTab === 'instrucoes' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>Instruções</button>
        </div>

        {activeTab === 'investimentos' && (
          <div className="space-y-6">
            {step === 1 && (
              <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6 text-center">
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 text-left">
                  <h2 className="text-lg font-bold text-blue-900 mb-2 flex items-center gap-2">
                    <Info size={20}/> Como preparar o seu ficheiro:
                  </h2>
                  <p className="text-sm text-blue-800 leading-relaxed mb-4">
                    Abra a sua conta DEGIRO, vá a <b>Atividade &gt; Transações</b>. Remova quaisquer filtros de datas (selecione desde que abriu a conta) e exporte o histórico completo para garantir que o cálculo **FIFO** encontra as compras antigas de anos anteriores!
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['DEGIRO (Semicolon)', 'Trading 212', 'XTB'].map(b => (
                      <span key={b} className="bg-white px-3 py-1 rounded-full border border-blue-200 text-blue-700 font-semibold text-xs">{b}</span>
                    ))}
                  </div>
                </div>

                <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 hover:border-blue-500 transition-all cursor-pointer bg-gray-50/50" onClick={() => document.getElementById('fileInput').click()}>
                  <UploadCloud className="mx-auto text-gray-400 mb-4" size={48} />
                  <p className="font-bold text-gray-700 text-lg">Carregue o seu CSV de transações</p>
                  <p className="text-xs text-gray-400 mt-1">DEGIRO, Trading 212, XTB e outros formatos de transações</p>
                  <input id="fileInput" type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                </div>
                {csvError && (
                  <p className="text-sm text-red-600 font-semibold flex items-center justify-center gap-1"><AlertTriangle size={16}/> {csvError}</p>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-5">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                        <CheckCircle className="text-green-500" /> Ficheiro analisado com sucesso!
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">Selecione o ano fiscal que pretende declarar:</p>
                    </div>
                    <select value={taxYear} onChange={(e) => setTaxYear(e.target.value)} className="p-3 border rounded-xl font-semibold bg-gray-50 text-gray-800 w-full md:w-auto">
                      {['2025', '2024', '2023'].map(yr => (
                        <option key={yr} value={yr}>Declarar Ano {yr}</option>
                      ))}
                    </select>
                  </div>

                  {/* Fluxo principal: fundir as mais-valias no XML da declaração */}
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 space-y-3">
                    <h4 className="font-bold text-blue-900 flex items-center gap-2">
                      <FileText size={18}/> Gerar XML para importar no Anexo J
                    </h4>
                    <p className="text-xs text-blue-800 leading-relaxed">
                      O Portal das Finanças <b>não importa CSV</b>. Importa o XML da declaração Modelo 3 — e essa
                      importação <b>substitui</b> toda a declaração. Por isso: no Portal, comece a declaração (com o
                      Anexo J adicionado) e <b>grave-a num ficheiro XML</b>. Carregue-o aqui em baixo para fundirmos as
                      suas mais-valias no Quadro 9.2-A sem perder os restantes dados, e reimporte o ficheiro gerado.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                      <button onClick={() => document.getElementById('declInput').click()} className="flex-1 bg-white border border-blue-300 text-blue-700 font-semibold px-4 py-3 rounded-xl flex items-center gap-2 justify-center hover:bg-blue-50 transition">
                        <UploadCloud size={18}/> {declarationName ? `XML: ${declarationName}` : 'Carregar XML da declaração'}
                      </button>
                      <input id="declInput" type="file" className="hidden" accept=".xml" onChange={handleDeclarationUpload} />
                      <button onClick={exportAnexoJXML} disabled={!declarationXml} className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold px-6 py-3 rounded-xl shadow-md transition flex items-center gap-2 justify-center">
                        <Download size={18}/> Gerar XML do Anexo J
                      </button>
                    </div>

                    {xmlError && (
                      <p className="text-xs text-red-600 font-semibold flex items-center gap-1"><AlertTriangle size={14}/> {xmlError}</p>
                    )}
                    {xmlWarnings.length > 0 && (
                      <ul className="text-xs text-amber-700 list-disc pl-5 space-y-1">
                        {xmlWarnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    )}
                  </div>

                  {/* Alternativa: folha de cálculo para conferência / preenchimento manual */}
                  <div className="flex items-center justify-between text-xs text-gray-500 border-t pt-4">
                    <span>Prefere conferir os valores ou preencher à mão? Exporte uma folha de cálculo.</span>
                    <button onClick={downloadATCSV} className="text-gray-700 font-semibold hover:underline flex items-center gap-1 whitespace-nowrap">
                      <Download size={14}/> Folha de cálculo (CSV)
                    </button>
                  </div>
                </div>

                {/* Dashboard Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-2xl border text-center">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Vendas Correspondidas</p>
                    <p className="text-xl font-extrabold text-gray-900 mt-1">{stats.vendas.toFixed(2)}€</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border text-center">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Custo Aquisição (FIFO)</p>
                    <p className="text-xl font-extrabold text-gray-900 mt-1">{stats.compras.toFixed(2)}€</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border text-center">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Despesas Deduções</p>
                    <p className="text-xl font-extrabold text-gray-900 mt-1">{stats.despesas.toFixed(2)}€</p>
                  </div>
                  <div className={`p-5 rounded-2xl border text-center ${netGains >= 0 ? 'bg-green-50/50 border-green-100' : 'bg-red-50/50 border-red-100'}`}>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Mais-valias Líquidas</p>
                    <p className={`text-xl font-extrabold mt-1 ${netGains >= 0 ? 'text-green-600' : 'text-red-600'}`}>{netGains.toFixed(2)}€</p>
                  </div>
                </div>

                {/* Aviso: possíveis eventos societários (splits/fusões) que afetam o FIFO */}
                {filteredCorporateActions.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 p-5 rounded-2xl space-y-2">
                    <h4 className="font-bold text-orange-800 flex items-center gap-2">
                      <AlertTriangle size={20}/> {filteredCorporateActions.length} movimento(s) sem preço detetado(s) em {taxYear}
                    </h4>
                    <p className="text-xs text-orange-700 leading-relaxed">
                      Estes movimentos têm quantidade mas não têm preço/valor — costumam ser <b>splits, fusões ou outros
                      eventos societários</b>. Não entram no cálculo FIFO, mas <b>alteram o número de ações</b> e podem
                      enviesar os custos de aquisição. Verifique manualmente os ativos afetados:
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
                              <td className="p-2 font-medium">{c.product} <span className="block text-[10px] text-orange-600 font-mono">{c.isin}</span></td>
                              <td className="p-2">{c.date}</td>
                              <td className="p-2 font-bold">{c.qty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Warnings Section for missing Purchases (FIFO) */}
                {filteredUnmatched.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl space-y-3">
                    <h4 className="font-bold text-amber-800 flex items-center gap-2">
                      <AlertTriangle size={20}/> Atenção: {filteredUnmatched.length} Vendas Não Declaradas por falta de Histórico de Compra
                    </h4>
                    <p className="text-xs text-amber-700 leading-relaxed">
                      Detetámos vendas de ativos em {taxYear} para as quais **não foi encontrada nenhuma compra correspondente** neste ficheiro (provavelmente porque comprou esses ativos antes de {taxYear}). Para declarar estas mais-valias, volte a exportar o ficheiro CSV da DEGIRO desde a **abertura da conta** para carregar todo o seu histórico.
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-amber-900 bg-white/50 rounded-xl overflow-hidden mt-2">
                        <thead>
                          <tr className="bg-amber-100 font-semibold text-amber-800 border-b border-amber-200">
                            <th className="p-2">Ativo / ISIN</th>
                            <th className="p-2">Data da Venda</th>
                            <th className="p-2">Quant. Vendida</th>
                            <th className="p-2">Valor Estimado (Venda)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100">
                          {filteredUnmatched.map(u => (
                            <tr key={u.id}>
                              <td className="p-2 font-medium">{u.produto} <span className="block text-[10px] text-amber-600 font-mono">{u.isin}</span></td>
                              <td className="p-2">{u.dataRealizacao}</td>
                              <td className="p-2">{u.qtyNaoCorrespondida} / {u.qtyVendida} un.</td>
                              <td className="p-2 font-bold">{u.valorNaoCorrespondido}€</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Transaction Matches List */}
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                  <div className="p-5 border-b flex justify-between items-center">
                    <h4 className="font-bold text-gray-800">Transações Declaradas no Anexo J ({filteredGains.length})</h4>
                    <button onClick={() => setStep(1)} className="text-sm text-red-500 font-semibold hover:underline">Reiniciar e Carregar Outro</button>
                  </div>

                  {filteredGains.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                      <AlertTriangle className="mx-auto mb-2 text-yellow-500" />
                      Sem transações de venda correspondidas para o ano {taxYear}.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider border-b">
                            <th className="p-4">Ativo / ISIN</th>
                            <th className="p-4">Aquisição (Data/€)</th>
                            <th className="p-4">Venda (Data/€)</th>
                            <th className="p-4">Despesas</th>
                            <th className="p-4">Código IRS</th>
                            <th className="p-4 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-sm text-gray-700">
                          {filteredGains.map((g) => (
                            <tr key={g.id} className="hover:bg-gray-50/50">
                              <td className="p-4 font-medium">
                                <div className="max-w-[150px] truncate font-bold text-gray-800" title={g.produto}>{g.produto}</div>
                                <div className="text-xs text-gray-400 font-mono">{g.isin}</div>
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
                                <button onClick={() => removeGainRow(g.id)} className="text-red-500 hover:text-red-700 p-1">
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'efatura' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 flex items-start gap-2">
              <Info size={16} className="mt-0.5 shrink-0"/>
              <span>
                Estimativa indicativa. Os limites e taxas de dedução do e-Fatura podem variar por ano fiscal e
                dependem do agregado familiar. Confirme sempre os valores oficiais no Portal das Finanças.
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {Object.entries(efaturaLimits).map(([key, data]) => (
                <div key={key} className="bg-white p-5 rounded-2xl border shadow-sm">
                  <h3 className="font-bold flex items-center gap-2 mb-3"><data.icon size={20} className={data.color}/> {data.label}</h3>
                  <input type="number" onChange={(e) => setEfatura({...efatura, [key]: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="Valor atual (€)" />
                  <p className="text-xs text-gray-500 mt-2 font-medium">{getRemainingText(key, efatura[key])}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'instrucoes' && (
          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-8">
            <section>
              <h2 className="text-2xl font-bold flex items-center gap-2 mb-4"><HelpCircle className="text-blue-600"/> Como utilizar</h2>
              <ul className="list-decimal pl-6 space-y-2 text-gray-700">
                <li>No separador <b>Mais-Valias</b>, importe o ficheiro de histórico da sua corretora.</li>
                <li>O sistema processará as transações automaticamente calculando os pares de compra e venda usando o critério **FIFO** regulamentado pela AT.</li>
                <li>Selecione o ano da declaração para filtrar as mais-valias obtidas nesse ano.</li>
                <li>Verifique os dados na tabela e ajuste os códigos dos ativos se necessário (G01 para ações normais, G20 para Fundos/ETFs).</li>
                <li>No Portal das Finanças, inicie a declaração de IRS, <b>adicione o Anexo J</b> e <b>grave-a num ficheiro XML</b> (botão "Gravar").</li>
                <li>Carregue esse XML nesta aplicação e clique em <b>Gerar XML do Anexo J</b>: as suas mais-valias são fundidas no Quadro 9.2-A sem alterar os restantes dados.</li>
                <li>No Portal, <b>importe o XML gerado</b>. ⚠️ A importação substitui a declaração atual — por isso é que partimos sempre do seu próprio ficheiro exportado.</li>
                <li>Confira o Quadro 9.2-A do Anexo J e o país da fonte de cada linha antes de submeter.</li>
              </ul>
              <p className="text-xs text-gray-400 mt-4">
                Esta ferramenta é um auxiliar de cálculo e não constitui aconselhamento fiscal. Confirme sempre os
                valores antes de submeter a declaração.
              </p>
            </section>

            <section className="bg-gray-100 p-6 rounded-2xl">
              <h3 className="font-bold text-lg flex items-center gap-2 mb-4"><Server className="text-blue-600"/> Arquitetura do software</h3>
              <p className="text-gray-700 mb-2">Este software opera a 100% no seu browser local (Client-Side).</p>
              <p className="text-sm text-gray-500">Nenhum dado financeiro ou ficheiro é enviado para qualquer servidor externo. O processamento dos dados e a geração do ficheiro final para o anexo J são realizados inteiramente na sua máquina local de forma anónima e segura.</p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}