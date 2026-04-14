import React, { useState, useMemo, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  Search, 
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  ArrowRight,
  Activity,
  TrendingDown,
  TrendingUp,
  Package,
  Layers
} from 'lucide-react';

export default function SinalizadorTab() {
  const [rawData, setRawData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sinalizadorFilter, setSinalizadorFilter] = useState('Todos');
  const [expandedRows, setExpandedRows] = useState(new Set());
  
  const fileInputRef = useRef(null);

  // --- Leitura e Parsing ---
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.trim().split('\n');
        const headers = lines[0].split(';').map(h => h.replace(/["\r\n\uFEFF]/g, '').trim());
        const parsedRows = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue;
          const values = line.split(/;(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/["\r\n\uFEFF]/g, '').trim());
          let rowObj = {};
          headers.forEach((header, index) => { rowObj[header] = values[index] || ''; });
          parsedRows.push(rowObj);
        }
        setRawData(parsedRows);
      } catch (error) {
        alert("Erro ao processar o arquivo. Verifique o formato.");
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
  };

  // --- Lógica de Dados ---
  const data = useMemo(() => {
    return rawData.map((row, index) => {
      const valorMedioStr = row['VL Médio (R$)'] || '0';
      const valorMedio = parseFloat(valorMedioStr.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
      
      const estoqueDisp = parseInt(row['Estoq Disp']) || 0;
      const estoqueTot = parseInt(row['Estoq Tot']) || 0;
      const media6M = parseFloat((row['Média 6M'] || '0').replace(',', '.')) || 0;
      const cobertura = parseInt(row['Cobertura']) || 0;

      return {
        id: index,
        codItem: row['Cod Item'] || '-',
        descItem: row['Desc Item'] || '-',
        unidade: row['Un'] || '-',
        abc: row['ABC'] || '-',
        valorMedioFormatado: `R$ ${valorMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        estoqueDisp,
        estoqueTot,
        media6M: media6M.toFixed(2),
        cobertura,
        sinalizador: row['Sinalizador'] || '-',
        dtProxOC: row['DT Próx OC'] || '-',
        politica: row['Política'] || '-',
        categoria: row['Categoria'] || '-'
      };
    });
  }, [rawData]);

  // --- Filtragem ---
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        item.codItem.toLowerCase().includes(searchLower) ||
        item.descItem.toLowerCase().includes(searchLower);
        
      const matchesSinalizador = sinalizadorFilter === 'Todos' || item.sinalizador === sinalizadorFilter;
      
      return matchesSearch && matchesSinalizador;
    });
  }, [data, searchTerm, sinalizadorFilter]);

  // --- Métricas ---
  const metrics = useMemo(() => {
    if (data.length === 0) return null;
    
    const totalItens = data.length;
    let itensCriticos = 0;
    let valorEstoqueCritico = 0;
    let itensSemCobertura = 0;
    let itensCurvaA = 0;
    
    data.forEach(item => { 
      if (item.sinalizador.toLowerCase().includes('baixo') || item.sinalizador.toLowerCase().includes('muito baixo')) {
        itensCriticos++;
        valorEstoqueCritico += (item.estoqueDisp * parseFloat(item.valorMedioFormatado.replace('R$ ', '').replace('.', '').replace(',', '.')));
      }
      if (item.cobertura === 0) {
        itensSemCobertura++;
      }
      if (item.abc === 'A') {
        itensCurvaA++;
      }
    });

    return { 
      totalItens, 
      itensCriticos,
      valorEstoqueCriticoFormatado: `R$ ${valorEstoqueCritico.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      itensSemCobertura,
      itensCurvaA
    };
  }, [data]);

  const toggleRow = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedRows(newExpanded);
  };

  // --- Componentes Visuais ---
  const SinalizadorBadge = ({ sinalizador }) => {
    let bg = 'bg-zinc-100', text = 'text-zinc-600', border = 'border-zinc-200';
    const s = sinalizador.toLowerCase();
    
    if (s.includes('muito baixo')) {
      bg = 'bg-rose-50'; text = 'text-rose-700'; border = 'border-rose-200/60';
    } else if (s.includes('baixo')) {
      bg = 'bg-amber-50'; text = 'text-amber-700'; border = 'border-amber-200/60';
    } else if (s.includes('normal') || s.includes('ok')) {
      bg = 'bg-emerald-50'; text = 'text-emerald-700'; border = 'border-emerald-200/60';
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${bg} ${text} ${border}`}>
        {sinalizador}
      </span>
    );
  };

  const uniqueSinalizadores = ['Todos', ...new Set(data.map(item => item.sinalizador))];

  // ==========================================
  // TELA 1: ONBOARDING / UPLOAD
  // ==========================================
  if (rawData.length === 0) {
    return (
      <div className="h-full bg-zinc-50 text-zinc-900 font-sans flex flex-col items-center justify-center p-6 rounded-2xl">
        <div className="max-w-3xl w-full">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-6 border border-zinc-100">
              <Activity className="w-8 h-8 text-rose-600" strokeWidth={1.5} />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 mb-3">
              Monitoramento de Ruptura (Sinalizador)
            </h1>
            <p className="text-zinc-500 text-lg max-w-xl mx-auto">
              Acompanhe os níveis de estoque crítico e previna rupturas no abastecimento da farmácia.
            </p>
          </div>

          <div className="flex justify-center">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group relative bg-white rounded-3xl p-8 border border-zinc-200 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col items-center text-center max-w-md w-full"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-rose-600"></div>
              <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <FileText size={28} strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-bold text-zinc-800 mb-2">Relatório de Sinalizadores</h3>
              <p className="text-sm text-zinc-500 mb-6 flex-grow">
                Arquivo CSV contendo a lista de medicamentos/materiais, níveis de estoque e sinalizadores de risco.
              </p>
              <div className="inline-flex items-center font-semibold text-rose-600 bg-rose-50/50 px-4 py-2 rounded-lg group-hover:bg-rose-100 transition-colors">
                {isLoading ? 'Carregando...' : 'Selecionar Arquivo'} <ArrowRight size={16} className="ml-2" />
              </div>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" ref={fileInputRef} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // TELA 2: DASHBOARD PRINCIPAL
  // ==========================================
  return (
    <div className="h-full bg-[#F8FAFC] text-slate-800 font-sans flex flex-col rounded-2xl overflow-hidden shadow-sm border border-slate-200">
      <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" ref={fileInputRef} />

      {/* Header */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 backdrop-blur-md bg-white/90 shrink-0">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-rose-600 p-1.5 rounded-lg text-white">
              <Activity size={18} strokeWidth={2} />
            </div>
            <span className="font-bold tracking-tight text-lg text-slate-900">Painel <span className="text-rose-600 font-extrabold">Sinalizador</span></span>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors">
              <UploadCloud size={16} /> Nova Base
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto max-w-[1400px] w-full mx-auto px-6 py-8 space-y-8">
        
        {/* Título da Página */}
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Visão Geral do Estoque</h2>
          <p className="text-slate-500 text-sm mt-1">Acompanhamento de itens com base nos sinalizadores de risco.</p>
        </div>

        {/* KPIs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { label: 'Total de Itens Monitorados', value: metrics?.totalItens, icon: Package, color: 'blue' },
            { label: 'Itens em Risco (Baixo/M. Baixo)', value: metrics?.itensCriticos, icon: AlertTriangle, color: 'rose' },
            { label: 'Itens Sem Cobertura (0 dias)', value: metrics?.itensSemCobertura, icon: TrendingDown, color: 'orange' },
            { label: 'Itens Curva A Monitorados', value: metrics?.itensCurvaA, icon: Activity, color: 'emerald' }
          ].map((kpi, idx) => (
            <div key={idx} className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.02)] flex items-start gap-4">
              <div className={`p-3 rounded-xl bg-${kpi.color}-50 text-${kpi.color}-600`}>
                <kpi.icon size={22} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{kpi.label}</p>
                <h3 className="text-3xl font-extrabold text-slate-800 tracking-tight">{kpi.value}</h3>
              </div>
            </div>
          ))}
        </div>

        {/* Tabela de Dados */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.02)] overflow-hidden">
          
          <div className="p-5 border-b border-slate-100 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Layers size={18} className="text-slate-400"/> Monitoramento de Itens Críticos
            </h3>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={16} className="text-slate-400 group-focus-within:text-rose-500 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Pesquisar código ou descrição..."
                  className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 block w-full sm:w-[320px] outline-none transition-all placeholder:text-slate-400"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <select
                className="pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 block bg-white font-medium text-slate-700 outline-none cursor-pointer hover:bg-slate-50 transition-colors"
                value={sinalizadorFilter}
                onChange={(e) => setSinalizadorFilter(e.target.value)}
              >
                {uniqueSinalizadores.map(status => (
                  <option key={status} value={status as string}>{status as string}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                  <th className="w-12 px-4 py-3 text-center">Info</th>
                  <th className="px-6 py-3">Código</th>
                  <th className="px-6 py-3 w-1/3">Descrição</th>
                  <th className="px-6 py-3 text-center">ABC</th>
                  <th className="px-6 py-3 text-center">Estoque Disp.</th>
                  <th className="px-6 py-3 text-center">Cobertura</th>
                  <th className="px-6 py-3 text-right">Sinalizador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.length > 0 ? (
                  filteredData.map((item: any) => {
                    const isExpanded = expandedRows.has(item.id);

                    return (
                      <React.Fragment key={item.id}>
                        {/* Linha Principal */}
                        <tr 
                          onClick={() => toggleRow(item.id)} 
                          className={`group cursor-pointer transition-colors ${isExpanded ? 'bg-rose-50/30' : 'hover:bg-slate-50'}`}
                        >
                          <td className="px-4 py-4 text-center">
                            <button className={`p-1 rounded-md transition-colors ${isExpanded ? 'bg-rose-100 text-rose-600' : 'text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600'}`}>
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-mono text-sm text-slate-600">
                              {item.codItem}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-800 text-sm">
                              {item.descItem}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">{item.categoria}</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              item.abc === 'A' ? 'bg-red-100 text-red-700' :
                              item.abc === 'B' ? 'bg-amber-100 text-amber-700' :
                              item.abc === 'C' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {item.abc}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="font-bold text-slate-700">{item.estoqueDisp}</div>
                            <div className="text-[10px] text-slate-400">Tot: {item.estoqueTot}</div>
                          </td>
                          <td className="px-6 py-4 text-center font-medium text-slate-600">
                            {item.cobertura}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <SinalizadorBadge sinalizador={item.sinalizador} />
                          </td>
                        </tr>
                        
                        {/* Linha Expandida (Detalhes) */}
                        {isExpanded && (
                          <tr className="bg-slate-50/50 border-b border-slate-200">
                            <td colSpan={7} className="p-0">
                              <div className="pl-14 pr-6 py-6 border-l-4 border-rose-500 shadow-inner">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                  <AlertTriangle size={14} /> Detalhes do Item
                                </h4>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                  <div>
                                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Unidade</p>
                                    <p className="text-sm text-slate-700">{item.unidade}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Valor Médio</p>
                                    <p className="text-sm font-bold text-slate-700">{item.valorMedioFormatado}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Média 6 Meses</p>
                                    <p className="text-sm text-slate-700">{item.media6M}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Próxima OC</p>
                                    <p className="text-sm text-slate-700">{item.dtProxOC}</p>
                                  </div>
                                  <div className="md:col-span-4">
                                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Política</p>
                                    <p className="text-sm text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">{item.politica}</p>
                                  </div>
                                </div>

                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <Search size={32} className="mx-auto text-slate-300 mb-4" />
                      <p className="text-slate-800 font-bold text-lg">Nenhum resultado encontrado</p>
                      <p className="text-slate-500 text-sm mt-1">Tente pesquisar por outro termo ou limpar os filtros.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Exibindo {filteredData.length} de {data.length} itens</span>
          </div>
        </div>

      </main>
    </div>
  );
}
