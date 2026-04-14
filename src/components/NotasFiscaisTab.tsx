import React, { useState, useMemo, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  Search, 
  ChevronDown,
  ChevronRight,
  Building,
  Calendar,
  ArrowRight,
  Receipt,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';

export default function NotasFiscaisTab() {
  const [rawNFs, setRawNFs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [expandedRows, setExpandedRows] = useState(new Set());
  
  const nfInputRef = useRef(null);

  // --- Leitura e Parsing ---
  const handleNfUpload = (event) => {
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
        setRawNFs(parsedRows);
      } catch (error) {
        alert("Erro ao processar o arquivo de Notas Fiscais. Verifique o formato.");
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
  };

  // --- Lógica de Dados ---
  const nfs = useMemo(() => {
    return rawNFs.map((row, index) => {
      const valorStr = row['Valor total (R$)'] || '0';
      const valorNumerico = parseFloat(valorStr.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;

      return {
        id: index,
        status: row['Status Entrega'] || row['Status'] || 'Pendente',
        numero: row['NF - Núm'] || '-',
        dataCriacao: row['NF - Criação'] || '-',
        cnpj: row['CNPJ'] || '-',
        fornecedor: row['Desc. Fornecedor'] || 'Desconhecido',
        destino: row['Cód. Estab Destino'] || '-',
        valorFormatado: valorStr,
        valorNumerico: valorNumerico,
        numItens: row['Núm. Itens'] || '0',
        chaveAcesso: row['Chave de Acesso'] || '-',
        motivo: row['Motivo'] || '-',
        checklist: row['Checklist Preenchido'] || '-'
      };
    });
  }, [rawNFs]);

  // --- Filtragem ---
  const filteredNFs = useMemo(() => {
    return nfs.filter(nf => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        nf.numero.toLowerCase().includes(searchLower) ||
        nf.fornecedor.toLowerCase().includes(searchLower) ||
        nf.chaveAcesso.toLowerCase().includes(searchLower);
        
      const matchesStatus = statusFilter === 'Todos' || nf.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [nfs, searchTerm, statusFilter]);

  // --- Métricas ---
  const metrics = useMemo(() => {
    if (nfs.length === 0) return null;
    
    const totalNFs = nfs.length;
    const totalValor = nfs.reduce((acc, curr) => acc + curr.valorNumerico, 0);
    
    const statusCount = {};
    nfs.forEach(nf => { 
      statusCount[nf.status] = (statusCount[nf.status] || 0) + 1; 
    });

    const pendentes = statusCount['Pendente'] || 0;
    const entregues = statusCount['Entregue'] || 0;

    return { 
      totalNFs, 
      totalValorFormatado: `R$ ${totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      pendentes,
      entregues,
      statusCount
    };
  }, [nfs]);

  const toggleRow = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedRows(newExpanded);
  };

  // --- Componentes Visuais ---
  const StatusBadge = ({ status }) => {
    let bg = 'bg-zinc-100', text = 'text-zinc-600', dot = 'bg-zinc-400', border = 'border-zinc-200';
    const s = status.toLowerCase();
    
    if (s.includes('entregue') || s.includes('concluído')) {
      bg = 'bg-emerald-50'; text = 'text-emerald-700'; dot = 'bg-emerald-500'; border = 'border-emerald-200/60';
    } else if (s.includes('pendente') || s.includes('andamento')) {
      bg = 'bg-amber-50'; text = 'text-amber-700'; dot = 'bg-amber-500'; border = 'border-amber-200/60';
    } else if (s.includes('cancelado') || s.includes('erro')) {
      bg = 'bg-rose-50'; text = 'text-rose-700'; dot = 'bg-rose-500'; border = 'border-rose-200/60';
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${bg} ${text} ${border}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${dot}`}></div>
        {status}
      </span>
    );
  };

  const uniqueStatuses = ['Todos', ...new Set(nfs.map(nf => nf.status))];

  // ==========================================
  // TELA 1: ONBOARDING / UPLOAD
  // ==========================================
  if (rawNFs.length === 0) {
    return (
      <div className="h-full bg-zinc-50 text-zinc-900 font-sans flex flex-col items-center justify-center p-6 rounded-2xl">
        <div className="max-w-3xl w-full">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-6 border border-zinc-100">
              <Receipt className="w-8 h-8 text-teal-600" strokeWidth={1.5} />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 mb-3">
              Gestão de Notas Fiscais
            </h1>
            <p className="text-zinc-500 text-lg max-w-xl mx-auto">
              Acompanhe o status, valores e detalhes das notas fiscais de entrada.
            </p>
          </div>

          <div className="flex justify-center">
            <div 
              onClick={() => nfInputRef.current?.click()}
              className="group relative bg-white rounded-3xl p-8 border border-zinc-200 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col items-center text-center max-w-md w-full"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-teal-600"></div>
              <div className="w-14 h-14 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <FileText size={28} strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-bold text-zinc-800 mb-2">Relatório de NFs</h3>
              <p className="text-sm text-zinc-500 mb-6 flex-grow">
                Arquivo CSV contendo a lista de notas fiscais, status e valores.
              </p>
              <div className="inline-flex items-center font-semibold text-teal-600 bg-teal-50/50 px-4 py-2 rounded-lg group-hover:bg-teal-100 transition-colors">
                {isLoading ? 'Carregando...' : 'Selecionar Arquivo'} <ArrowRight size={16} className="ml-2" />
              </div>
              <input type="file" accept=".csv" onChange={handleNfUpload} className="hidden" ref={nfInputRef} />
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
      <input type="file" accept=".csv" onChange={handleNfUpload} className="hidden" ref={nfInputRef} />

      {/* Header */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 backdrop-blur-md bg-white/90 shrink-0">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-teal-600 p-1.5 rounded-lg text-white">
              <Receipt size={18} strokeWidth={2} />
            </div>
            <span className="font-bold tracking-tight text-lg text-slate-900">Painel de <span className="text-teal-600 font-extrabold">NFs</span></span>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={() => nfInputRef.current?.click()} className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors">
              <UploadCloud size={16} /> Nova Base
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto max-w-[1400px] w-full mx-auto px-6 py-8 space-y-8">
        
        {/* Título da Página */}
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Visão Geral das Notas Fiscais</h2>
          <p className="text-slate-500 text-sm mt-1">Acompanhamento de recebimentos e valores.</p>
        </div>

        {/* KPIs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { label: 'Total de NFs', value: metrics?.totalNFs, icon: FileText, color: 'blue' },
            { label: 'Valor Total', value: metrics?.totalValorFormatado, icon: Building, color: 'emerald' },
            { label: 'NFs Pendentes', value: metrics?.pendentes, icon: Clock, color: 'amber' },
            { label: 'NFs Entregues', value: metrics?.entregues, icon: CheckCircle2, color: 'teal' }
          ].map((kpi, idx) => (
            <div key={idx} className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.02)] flex items-start gap-4">
              <div className={`p-3 rounded-xl bg-${kpi.color}-50 text-${kpi.color}-600`}>
                <kpi.icon size={22} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{kpi.label}</p>
                <h3 className={`text-${kpi.label === 'Valor Total' ? 'xl mt-1' : '3xl'} font-extrabold text-slate-800 tracking-tight`}>{kpi.value}</h3>
              </div>
            </div>
          ))}
        </div>

        {/* Tabela de Dados */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.02)] overflow-hidden">
          
          <div className="p-5 border-b border-slate-100 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Receipt size={18} className="text-slate-400"/> Lista de Notas Fiscais
            </h3>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={16} className="text-slate-400 group-focus-within:text-teal-500 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Pesquisar NF, fornecedor, chave..."
                  className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 block w-full sm:w-[320px] outline-none transition-all placeholder:text-slate-400"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <select
                className="pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 block bg-white font-medium text-slate-700 outline-none cursor-pointer hover:bg-slate-50 transition-colors"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {uniqueStatuses.map(status => (
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
                  <th className="px-6 py-3">Número NF</th>
                  <th className="px-6 py-3">Fornecedor</th>
                  <th className="px-6 py-3">Data Criação</th>
                  <th className="px-6 py-3 text-right">Valor Total</th>
                  <th className="px-6 py-3 text-center">Itens</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredNFs.length > 0 ? (
                  filteredNFs.map((nf: any) => {
                    const isExpanded = expandedRows.has(nf.id);

                    return (
                      <React.Fragment key={nf.id}>
                        {/* Linha Principal da NF */}
                        <tr 
                          onClick={() => toggleRow(nf.id)} 
                          className={`group cursor-pointer transition-colors ${isExpanded ? 'bg-teal-50/30' : 'hover:bg-slate-50'}`}
                        >
                          <td className="px-4 py-4 text-center">
                            <button className={`p-1 rounded-md transition-colors ${isExpanded ? 'bg-teal-100 text-teal-600' : 'text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600'}`}>
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900 flex items-center gap-2">
                              {nf.numero}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-700 truncate max-w-[250px]" title={nf.fornecedor}>
                              {nf.fornecedor}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">{nf.cnpj}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={14} className="text-slate-400"/>
                              {nf.dataCriacao}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-slate-700">
                            {nf.valorFormatado}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                              {nf.numItens}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <StatusBadge status={nf.status} />
                          </td>
                        </tr>
                        
                        {/* Linha Expandida (Detalhes da NF) */}
                        {isExpanded && (
                          <tr className="bg-slate-50/50 border-b border-slate-200">
                            <td colSpan={7} className="p-0">
                              <div className="pl-14 pr-6 py-6 border-l-4 border-teal-500 shadow-inner">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                  <AlertCircle size={14} /> Detalhes da Nota Fiscal
                                </h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                  <div>
                                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Chave de Acesso</p>
                                    <p className="text-sm font-mono text-slate-700 break-all">{nf.chaveAcesso}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Destino</p>
                                    <p className="text-sm text-slate-700">{nf.destino}</p>
                                  </div>
                                  {nf.motivo && nf.motivo !== '-' && (
                                    <div className="md:col-span-2">
                                      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Motivo</p>
                                      <p className="text-sm text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">{nf.motivo}</p>
                                    </div>
                                  )}
                                  {nf.checklist && nf.checklist !== '-' && (
                                    <div className="md:col-span-2">
                                      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Checklist Preenchido</p>
                                      <p className="text-sm text-slate-700">{nf.checklist}</p>
                                    </div>
                                  )}
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
            <span>Exibindo {filteredNFs.length} de {nfs.length} notas fiscais</span>
          </div>
        </div>

      </main>
    </div>
  );
}
