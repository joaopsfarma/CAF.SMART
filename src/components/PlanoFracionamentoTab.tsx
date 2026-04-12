import React, { useState, useMemo, useRef } from 'react';
import { Upload, Printer, FileSpreadsheet, Percent, Search, PackageOpen, AlertCircle, FileText, Info } from 'lucide-react';

// Função auxiliar para categorizar os produtos
const getCategory = (product: string, unit: string) => {
  const p = product.toUpperCase();
  const u = unit.toUpperCase();
  
  if (u.includes('COMP') || u.includes('CAPS') || u.includes('DRG') || p.includes('COMP') || p.includes('CAPS') || p.includes('DRG') || p.includes('CP')) {
    return 'Comprimidos e Sólidos Orais';
  }
  if (u.includes('AMP') || u.includes('FRASCO') || u.includes('FA') || u.includes('FR') || p.includes('AMP') || p.includes('FR/') || p.includes('INJ')) {
    return 'Ampolas e Frascos (Injetáveis/Líquidos)';
  }
  return 'Outros Materiais e Medicamentos';
};

export default function PlanoFracionamentoTab() {
  const [data, setData] = useState<any[]>([]);
  const [margin, setMargin] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [customTotals, setCustomTotals] = useState<Record<number, number | string>>({});
  const [fractionatedTotals, setFractionatedTotals] = useState<Record<number, number | string>>({}); // Novo estado para Qtd Fracionada
  const printRef = useRef<HTMLDivElement>(null);

  // Lida com o upload e leitura do arquivo CSV
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
    setError('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = parseReport(text);
        if (parsed.length === 0) {
          setError('Não foi possível encontrar dados válidos. Verifique se o CSV é o relatório correto de consumo.');
        }
        setData(parsed);
        setSelectedItems(new Set(parsed.map(item => item.id)));
        setCustomTotals({});
        setFractionatedTotals({});
      } catch (err) {
        setError('Erro ao processar o arquivo. Verifique o formato.');
        console.error(err);
      }
    };
    reader.readAsText(file, 'ISO-8859-1'); 
  };

  // Parser customizado robusto para lidar com o formato específico do relatório CSV
  const parseReport = (text: string) => {
    const rows: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let val = '';
    
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const nextC = text[i + 1];
      if (c === '"') {
        if (inQuotes && nextC === '"') { val += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (c === ',' && !inQuotes) {
        row.push(val); val = '';
      } else if ((c === '\n' || c === '\r') && !inQuotes) {
        if (c === '\r' && nextC === '\n') i++;
        row.push(val); rows.push(row); row = []; val = '';
      } else {
        val += c;
      }
    }
    if (row.length > 0 || val !== '') { row.push(val); rows.push(row); }

    const extracted: any[] = [];
    rows.forEach((r, idx) => {
      const filtered = r.map((c) => c.trim()).filter((c) => c !== '');
      if (filtered.length >= 8) {
        const last = filtered[filtered.length - 1];
        if (last.includes('%')) {
          let prodIndex = -1;
          for (let i = 1; i < Math.min(5, filtered.length); i++) {
            if (/[A-Za-z]/.test(filtered[i]) && filtered[i].length > 3) {
              prodIndex = i;
              break;
            }
          }

          if (prodIndex !== -1) {
            const productCode = prodIndex > 0 ? filtered[prodIndex - 1] : '-';
            const product = filtered[prodIndex];
            const unit = filtered[prodIndex + 1] || '';
            const qtdStr = filtered[filtered.length - 4];
            
            if (product.toUpperCase().includes('TOTAL') || product.toUpperCase() === 'PRODUTO') return;

            const qtd = parseFloat(qtdStr.replace(/\./g, '').replace(',', '.'));
            
            if (!isNaN(qtd) && qtd > 0) {
              extracted.push({
                id: idx,
                code: productCode,
                product,
                unit,
                consumption: qtd,
              });
            }
          }
        }
      }
    });

    const finalData: any[] = [];
    const seen = new Set();
    extracted.forEach(item => {
      const key = item.product + item.unit;
      if (!seen.has(key)) {
        seen.add(key);
        finalData.push(item);
      }
    });

    return finalData;
  };

  // Aplica a margem, arredonda e categoriza
  const processedData = useMemo(() => {
    return data
      .filter(item => item.product.toLowerCase().includes(searchTerm.toLowerCase()))
      .map(item => {
        const rawExtra = item.consumption * (margin / 100);
        const calculatedTotal = Math.ceil((item.consumption + rawExtra) / 10) * 10;
        
        const total = (customTotals[item.id] !== undefined && customTotals[item.id] !== '') ? Number(customTotals[item.id]) : calculatedTotal;
        const extra = total > item.consumption ? total - item.consumption : 0;
        const fractionated = fractionatedTotals[item.id] !== undefined ? fractionatedTotals[item.id] : '';
        const category = getCategory(item.product, item.unit);
        
        return { ...item, extra, total, fractionated, category };
      });
  }, [data, margin, searchTerm, customTotals, fractionatedTotals]);

  // Agrupa os dados processados por categoria
  const groupedData = useMemo(() => {
    const groups: Record<string, any[]> = {
      'Comprimidos e Sólidos Orais': [],
      'Ampolas e Frascos (Injetáveis/Líquidos)': [],
      'Outros Materiais e Medicamentos': []
    };
    processedData.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [processedData]);

  const maxTotal = useMemo(() => {
    if (processedData.length === 0) return 1;
    return Math.max(...processedData.map(d => d.total));
  }, [processedData]);

  const toggleItem = (id: number) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const visibleIds = processedData.map(item => item.id);
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (e.target.checked) {
        visibleIds.forEach(id => next.add(id));
      } else {
        visibleIds.forEach(id => next.delete(id));
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  const handleTotalChange = (id: number, val: string) => {
    setCustomTotals(prev => ({
      ...prev,
      [id]: val === '' ? '' : Number(val)
    }));
  };

  const handleFractionatedChange = (id: number, val: string) => {
    setFractionatedTotals(prev => ({
      ...prev,
      [id]: val === '' ? '' : Number(val)
    }));
  };

  const handleTotalBlur = (id: number, val: string) => {
    if (val === '') return;
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      const rounded = Math.ceil(num / 10) * 10;
      setCustomTotals(prev => ({ ...prev, [id]: rounded }));
    }
  };

  // Método de Impressão com Janela Separada
  const handlePrint = () => {
    let printWindow: Window | null = null;
    try {
      printWindow = window.open('', '_blank');
    } catch (e) {
      console.warn('O navegador bloqueou a abertura da janela.');
    }

    if (!printWindow) {
      alert("Por favor, permita pop-ups neste site para o botão de impressão funcionar. Em alternativa, pressione Ctrl+P (Cmd+P no Mac) no teclado.");
      window.print();
      return;
    }

    const content = printRef.current?.innerHTML || '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <title>Plano de Fracionamento</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              /* Forçando formato PAISAGEM (landscape) */
              @page { size: A4 landscape; margin: 10mm; }
              body { 
                background-color: white !important; 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important; 
              }
              table { page-break-inside: auto; width: 100%; border-collapse: collapse; }
              tr { page-break-inside: avoid; page-break-after: auto; }
              thead { display: table-header-group; }
              th, td { border-bottom: 1px solid #e2e8f0; }
              .cat-row td { 
                background-color: #f1f5f9 !important; 
                border-top: 2px solid #1e293b !important; 
                border-bottom: 1px solid #cbd5e1 !important; 
                font-weight: bold; 
              }
            }
          </style>
        </head>
        <body class="bg-white text-slate-800 p-0 m-0 font-sans">
          <!-- O container foi ajustado para a largura de A4 Paisagem (29.7cm) -->
          <div class="p-2 max-w-[29.7cm] mx-auto">
            ${content}
          </div>
          <script>
            setTimeout(function() {
              window.print();
              window.close();
            }, 1000);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <>
      <style>
        {`
          /* Esconde setinhas do input number na tela */
          input[type=number]::-webkit-inner-spin-button, 
          input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
          input[type=number] { -moz-appearance: textfield; }
        `}
      </style>

      {/* ======================= INTERFACE DA TELA ======================= */}
      <div className="min-h-full bg-slate-100 text-slate-900 font-sans flex flex-col lg:flex-row">
        
        {/* PAINEL LATERAL (Controles) */}
        <div className="w-full lg:w-[400px] bg-white border-r border-slate-200 flex flex-col h-auto lg:h-[calc(100vh-120px)] lg:sticky lg:top-0 z-10 shadow-lg shrink-0">
          <div className="p-6 overflow-y-auto h-full flex flex-col">
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3 mb-2">
              <PackageOpen className="w-7 h-7 text-blue-600" />
              Fracionamento
            </h1>
            <p className="text-sm text-slate-500 mb-8">Controle de dispensários inteligente</p>

            <div className="space-y-6">
              {/* Resumo de Seleção */}
              {data.length > 0 && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Itens Selecionados</span>
                    <button 
                      onClick={clearSelection}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline uppercase"
                    >
                      Limpar
                    </button>
                  </div>
                  <div className="text-2xl font-black text-blue-800">
                    {selectedItems.size} <span className="text-sm font-medium text-blue-600">de {data.length}</span>
                  </div>
                </div>
              )}

              {/* Upload */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">1. Importar Relatório (CSV)</label>
                <div className="relative">
                  <input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleFileUpload} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className={`flex items-center justify-start gap-3 w-full px-4 py-3 border-2 border-dashed rounded-xl transition-colors ${fileName ? 'border-green-300 bg-green-50' : 'border-slate-300 bg-slate-50 hover:bg-blue-50 hover:border-blue-400'}`}>
                    <FileSpreadsheet className={`w-6 h-6 flex-shrink-0 ${fileName ? 'text-green-600' : 'text-blue-500'}`} />
                    <span className="text-sm text-slate-600 font-medium truncate">
                      {fileName || 'Clique para selecionar...'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Margem */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">2. Margem de Segurança</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Percent className="h-4 w-4 text-slate-400" />
                  </div>
                  <input 
                    type="number" 
                    min="0"
                    max="500"
                    value={margin}
                    onChange={(e) => setMargin(Number(e.target.value))}
                    className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 font-bold text-slate-700"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">Os valores serão sempre arredondados para a dezena superior.</p>
              </div>

              {/* Filtro */}
              {data.length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Buscar Produto</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-slate-400" />
                    </div>
                    <input 
                      type="text" 
                      placeholder="Filtrar..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-2 border border-red-100">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}
            </div>

            <div className="mt-auto pt-8">
              <button 
                onClick={handlePrint}
                disabled={data.length === 0}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold rounded-xl transition-colors shadow-md text-lg"
              >
                <Printer className="w-6 h-6" />
                GERAR PDF / IMPRIMIR
              </button>
              <div className="flex gap-2 mt-3 p-3 bg-blue-50 rounded-lg text-blue-800 text-xs items-start">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>O layout está configurado para <strong>Folha A4 Paisagem</strong>. O assistente de impressão iniciará automaticamente.</p>
              </div>
            </div>
          </div>
        </div>

        {/* ÁREA DE VISUALIZAÇÃO DA TELA */}
        <div className="flex-1 bg-slate-200 p-4 lg:p-6 overflow-auto">
          
          {data.length === 0 && !error ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500">
              <FileText className="w-16 h-16 mb-4 opacity-20" />
              <h2 className="text-xl font-bold">Nenhum dado importado</h2>
              <p className="text-sm">Faça o upload do CSV no painel lateral para começar.</p>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto print:max-w-none print:w-[297mm] print:mx-0" ref={printRef}>
              <div className="bg-white shadow-xl rounded-t-xl border-x border-t border-slate-300 p-6 print:shadow-none print:border-slate-800 print:rounded-none">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                  <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase m-0">Plano de Fracionamento</h1>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest m-0 mt-1">Análise de Dispensário e Cotas</p>
                  </div>
                  <div className="flex items-center gap-3 print:hidden">
                    <div className="bg-slate-100 px-3 py-1.5 rounded border border-slate-200 flex flex-col items-end">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Margem de Segurança</span>
                      <span className="text-lg font-black text-blue-700">+{margin}%</span>
                    </div>
                  </div>
                  <div className="hidden print:block text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Data: {new Date().toLocaleDateString('pt-BR')}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Margem: +{margin}%</p>
                  </div>
                </div>
              </div>

              {/* Tabela Principal */}
              <div className="bg-white border border-slate-300 overflow-hidden print:border-slate-800 print:rounded-none">
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full text-left border-collapse text-[11px] print:text-[10px]">
                    <thead>
                      <tr className="bg-slate-900 text-white border-b border-slate-900 print:bg-slate-100 print:text-slate-900 print:border-b-2 print:border-slate-800">
                        <th className="py-3 px-3 w-10 text-center print:hidden">
                          <input 
                            type="checkbox" 
                            checked={processedData.length > 0 && processedData.every(item => selectedItems.has(item.id))}
                            onChange={toggleAll}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-3 font-bold uppercase tracking-wider w-20 text-center border-l border-slate-800 print:border-slate-300 print:py-2">Cód.</th>
                        <th className="py-3 px-3 font-bold uppercase tracking-wider print:py-2">Produto</th>
                        <th className="py-3 px-3 font-bold uppercase tracking-wider w-20 print:py-2">Unidade</th>
                        <th className="py-3 px-3 font-bold uppercase tracking-wider text-right w-20 print:py-2">Base</th>
                        <th className="py-3 px-3 font-bold uppercase tracking-wider text-right w-20 print:py-2">Margem</th>
                        <th className="py-3 px-3 font-bold uppercase tracking-wider text-center w-24 bg-blue-900/20 text-blue-100 border-l border-slate-800 print:bg-slate-50 print:text-slate-900 print:border-slate-300 print:py-2">Total</th>
                        <th className="py-3 px-3 font-bold uppercase tracking-wider text-center w-28 bg-indigo-900/20 text-indigo-100 border-l border-slate-800 print:bg-slate-50 print:text-slate-900 print:border-slate-300 print:py-2">Fracionada</th>
                        <th className="py-3 px-3 font-bold uppercase tracking-wider w-24 border-l border-slate-800 print:hidden">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 print:divide-slate-300">
                      {(Object.entries(groupedData) as [string, any[]][]).map(([category, items]) => {
                        if (items.length === 0) return null;
                        const selectedInCategory = items.filter(item => selectedItems.has(item.id)).length;
                        
                        return (
                          <React.Fragment key={category}>
                            <tr className={`bg-slate-100 border-y border-slate-300 print:bg-slate-50 print:border-slate-400 ${selectedInCategory === 0 ? 'print:hidden' : ''}`}>
                              <td colSpan={9} className="py-2 px-4 print:py-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{category}</span>
                                  <span className="text-[9px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200 uppercase print:hidden">
                                    {selectedInCategory} de {items.length} selecionados
                                  </span>
                                </div>
                              </td>
                            </tr>
                            
                            {items.map((item) => {
                              const isSelected = selectedItems.has(item.id);
                              return (
                                <tr 
                                  key={item.id} 
                                  onClick={() => toggleItem(item.id)}
                                  className={`group transition-colors cursor-pointer ${!isSelected ? 'bg-slate-50/50 opacity-50 print:hidden' : 'hover:bg-blue-50/30 print:hover:bg-transparent print:cursor-default print:break-inside-avoid'}`}
                                >
                                  <td className="py-2 px-3 text-center align-middle print:hidden" onClick={(e) => e.stopPropagation()}>
                                    <input 
                                      type="checkbox" 
                                      checked={isSelected}
                                      onChange={() => toggleItem(item.id)}
                                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                  </td>
                                  <td className="py-2 px-3 text-center font-mono font-bold text-slate-400 border-l border-slate-100 print:border-slate-200 print:text-slate-600 print:py-1.5">{item.code}</td>
                                  <td className="py-2 px-3 font-bold text-slate-800 align-middle pr-4 print:py-1.5">{item.product}</td>
                                  <td className="py-2 px-3 text-slate-500 font-medium align-middle print:py-1.5">{item.unit}</td>
                                  <td className="py-2 px-3 font-mono text-slate-600 text-right align-middle print:py-1.5">{item.consumption.toLocaleString('pt-BR')}</td>
                                  <td className="py-2 px-3 font-mono font-bold text-orange-600 text-right align-middle print:py-1.5">+{item.extra.toLocaleString('pt-BR')}</td>
                                  
                                  <td className="py-0 px-0 bg-blue-50/50 border-l border-slate-200 align-middle print:bg-transparent print:border-slate-200" onClick={(e) => e.stopPropagation()}>
                                    <input 
                                      type="number"
                                      min="0"
                                      step="10"
                                      value={item.total}
                                      onChange={(e) => handleTotalChange(item.id, e.target.value)}
                                      onBlur={(e) => handleTotalBlur(item.id, e.target.value)}
                                      className="w-full h-10 text-center bg-transparent font-black text-blue-700 text-sm focus:outline-none focus:bg-white transition-colors print:h-8 print:text-slate-900"
                                    />
                                  </td>

                                  <td className="py-0 px-0 bg-indigo-50/50 border-l border-slate-200 align-middle print:bg-transparent print:border-slate-200" onClick={(e) => e.stopPropagation()}>
                                    <input 
                                      type="number"
                                      min="0"
                                      placeholder="---"
                                      value={item.fractionated}
                                      onChange={(e) => handleFractionatedChange(item.id, e.target.value)}
                                      className="w-full h-10 text-center bg-transparent font-black text-indigo-700 text-sm focus:outline-none focus:bg-white placeholder-indigo-300 transition-colors print:h-8 print:text-slate-900 print:placeholder-transparent"
                                    />
                                  </td>
                                  
                                  <td className="py-2 px-3 align-middle border-l border-slate-100 print:hidden">
                                    <div className="flex h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                      <div 
                                        className="bg-blue-500 h-full" 
                                        style={{ width: `${Math.min(100, (item.consumption / maxTotal) * 100)}%` }}
                                      ></div>
                                      <div 
                                        className="bg-orange-400 h-full" 
                                        style={{ width: `${Math.min(100, (item.extra / maxTotal) * 100)}%` }}
                                      ></div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-slate-50 border-x border-b border-slate-300 rounded-b-xl p-4 flex justify-between items-center print:bg-white print:border-slate-800 print:rounded-none">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total de itens: {processedData.filter(i => selectedItems.has(i.id)).length}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">CAF SMART • Plano de Fracionamento</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ======================= LAYOUT DE IMPRESSÃO (Oculto na tela, injetado no Popup) ======================= */}
      <div className="hidden">
        <div ref={printRef} className="font-sans text-[11px] leading-snug w-full text-black">
          <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 m-0">Plano de Fracionamento</h1>
              <p className="text-sm text-slate-600 m-0 mt-1">Documento de controle interno de dispensários (Formato Paisagem)</p>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1 border border-slate-300 rounded inline-block mb-1">
                Margem de Segurança: +{margin}%
              </div>
              <p className="text-[10px] text-slate-500 m-0">Gerado em: {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR').slice(0,5)}</p>
            </div>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="py-2 px-1 font-bold uppercase w-[8%] border-b-2 border-slate-900">Código</th>
                <th className="py-2 px-1 font-bold uppercase w-[35%] border-b-2 border-slate-900">Produto</th>
                <th className="py-2 px-1 font-bold uppercase w-[10%] border-b-2 border-slate-900">Unidade</th>
                <th className="py-2 px-1 font-bold uppercase text-right w-[9%] border-b-2 border-slate-900">Consumo</th>
                <th className="py-2 px-1 font-bold uppercase text-right w-[9%] text-slate-500 border-b-2 border-slate-900">Margem</th>
                <th className="py-2 px-1 font-bold uppercase text-right w-[14%] border-b-2 border-slate-900">Total a Fracionar</th>
                <th className="py-2 px-1 font-bold uppercase text-center w-[15%] border-b-2 border-slate-900">Qtd. Fracionada</th>
              </tr>
            </thead>
            <tbody>
              {(Object.entries(groupedData) as [string, any[]][]).map(([category, items]) => {
                const itemsToExport = items.filter(item => selectedItems.has(item.id));
                if (itemsToExport.length === 0) return null;
                
                return (
                  <React.Fragment key={`print-${category}`}>
                    <tr className="cat-row">
                      <td colSpan={7} className="py-2 px-2 font-bold uppercase tracking-wider text-[11px] text-slate-800">
                        {category} <span className="font-normal text-slate-500 ml-2">({itemsToExport.length} itens)</span>
                      </td>
                    </tr>
                    {itemsToExport.map((item) => (
                      <tr key={`print-item-${item.id}`}>
                        <td className="py-1.5 px-1 font-mono text-xs text-slate-600 font-bold">{item.code}</td>
                        <td className="py-1.5 px-1 font-semibold text-slate-800">{item.product}</td>
                        <td className="py-1.5 px-1 text-slate-600">{item.unit}</td>
                        <td className="py-1.5 px-1 font-medium text-slate-700 text-right">{item.consumption.toLocaleString('pt-BR')}</td>
                        <td className="py-1.5 px-1 font-medium text-slate-500 text-right">+{item.extra.toLocaleString('pt-BR')}</td>
                        <td className="py-1.5 px-1 font-black text-black text-right text-[12px]">
                          {item.total.toLocaleString('pt-BR')}
                        </td>
                        <td className="py-1.5 px-1 font-black text-indigo-700 text-center text-[12px]">
                          {/* Se houver valor preenchido na tela, ele imprime. Se não houver, fica o espaço para escrever. */}
                          {item.fractionated ? item.fractionated.toLocaleString('pt-BR') : ''}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          
          <div className="mt-6 text-center text-[9px] text-slate-500 pt-3 border-t border-slate-300">
            Gerado via App de Fracionamento • Arquivo de Origem: {fileName}
          </div>
        </div>
      </div>
    </>
  );
}
