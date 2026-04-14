import React, { useState, useMemo, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  Package, 
  Search, 
  BarChart3, 
  ChevronDown,
  ChevronRight,
  Link as LinkIcon,
  Building,
  Calendar,
  Layers,
  ArrowRight,
  CheckCircle2,
  ListOrdered
} from 'lucide-react';

export default function PainelContratosTab() {
  const [rawContracts, setRawContracts] = useState([]);
  const [productsDict, setProductsDict] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [expandedRows, setExpandedRows] = useState(new Set());
  
  const contractsInputRef = useRef(null);
  const productsInputRef = useRef(null);

  // --- Leitura e Parsing ---
  const handleContractsUpload = (event) => {
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
        setRawContracts(parsedRows);
      } catch (error) {
        alert("Erro ao processar o arquivo de Contratos. Verifique o formato.");
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleProductsUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.trim().split('\n');
        const dict = {};
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue;
          const values = line.split(/;(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/["\r\n\uFEFF]/g, '').trim());
          const cod = String(values[0]).trim();
          const desc = values[1];
          if (cod) dict[cod] = desc;
        }
        setProductsDict(dict);
      } catch (error) {
        alert("Erro ao processar o arquivo de Equivalências.");
      }
    };
    reader.readAsText(file);
  };

  // --- Lógica de Dados e Deduplicação ---
  const contracts = useMemo(() => {
    const contractMap = new Map();
    
    rawContracts.forEach(row => {
      const id = row['ID Contrato'];
      if (!id) return;

      const codItem = String(row['Cod Item'] || '').trim();
      const descOriginal = row['Desc Item'] || '';
      
      // Busca equivalência ou usa o original
      let nomeProduto = productsDict[codItem];
      if (!nomeProduto) nomeProduto = descOriginal ? descOriginal : '-';

      const itemObj = {
        cod: codItem || '-',
        nome: nomeProduto,
        unidade: row['Un.'] || '-',
        valor: row['Vl Unit'] || '-',
        status: row['Status Item'] || '-'
      };

      if (!contractMap.has(id)) {
        contractMap.set(id, {
          id: id,
          nome: row['Nome Contrato'] || 'Sem Nome',
          status: row['Status'] || 'Indefinido',
          fornecedor: row['Fornecedor'] || 'Desconhecido',
          dataVencimento: row['Data de Vencimento'],
          itensMap: new Map() // Usamos um Map interno para remover repetições de produtos
        });
      } 
      
      const contract = contractMap.get(id);
      
      // Remove a repetição: Só adiciona se este código de produto ainda não estiver no contrato
      const itemKey = codItem !== '-' ? codItem : nomeProduto;
      if (!contract.itensMap.has(itemKey)) {
        contract.itensMap.set(itemKey, itemObj);
      }
    });

    // Converte os Maps internos para Arrays e ordena os produtos por nome (alfabético)
    return Array.from(contractMap.values()).map(contract => {
      const itensList = Array.from(contract.itensMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));
      return {
        ...contract,
        itensList,
        itensCount: itensList.length
      };
    });
  }, [rawContracts, productsDict]);

  // --- Filtragem (Ocultado Gestor) ---
  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
      const searchLower = searchTerm.toLowerCase();
      const matchesContract = 
        c.id.toLowerCase().includes(searchLower) ||
        c.nome.toLowerCase().includes(searchLower) ||
        c.fornecedor.toLowerCase().includes(searchLower);
        
      const matchesProducts = c.itensList.some(item => 
        item.nome.toLowerCase().includes(searchLower) || item.cod.toLowerCase().includes(searchLower)
      );
      
      const matchesSearch = matchesContract || matchesProducts;
      const matchesStatus = statusFilter === 'Todos' || c.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [contracts, searchTerm, statusFilter]);

  // --- Métricas (Top Fornecedores em vez de Top Gestores) ---
  const metrics = useMemo(() => {
    if (contracts.length === 0) return null;
    const totalContracts = contracts.length;
    
    // Calcula fornecedores únicos usando apenas o nome limpo
    const uniqueSuppliers = new Set(
      contracts.map(c => c.fornecedor ? c.fornecedor.split('-').pop().trim() : '')
    ).size;
    
    const totalItems = contracts.reduce((acc, curr) => acc + curr.itensCount, 0);
    
    const statusCount = {};
    const supplierCount = {};

    contracts.forEach(c => { 
      // Contagem de Status
      statusCount[c.status] = (statusCount[c.status] || 0) + 1; 
      
      // Contagem de Fornecedores limpos (Agrupa filiais/CNPJs do mesmo fornecedor)
      if (c.fornecedor) {
        const cleanSupplierName = c.fornecedor.split('-').pop().trim();
        supplierCount[cleanSupplierName] = (supplierCount[cleanSupplierName] || 0) + 1;
      }
    });
    
    const topFornecedores = Object.entries(supplierCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { totalContracts, uniqueSuppliers, totalItems, statusCount, topFornecedores };
  }, [contracts]);

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
    
    if (s.includes('finalizado') || s.includes('ativo')) {
      bg = 'bg-emerald-50'; text = 'text-emerald-700'; dot = 'bg-emerald-500'; border = 'border-emerald-200/60';
    } else if (s.includes('pendente') || s.includes('revisão') || s.includes('andamento')) {
      bg = 'bg-amber-50'; text = 'text-amber-700'; dot = 'bg-amber-500'; border = 'border-amber-200/60';
    } else if (s.includes('cancelado') || s.includes('encerrado')) {
      bg = 'bg-rose-50'; text = 'text-rose-700'; dot = 'bg-rose-500'; border = 'border-rose-200/60';
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${bg} ${text} ${border}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${dot}`}></div>
        {status}
      </span>
    );
  };

  const hasProducts = Object.keys(productsDict).length > 0;
  const uniqueStatuses = ['Todos', ...new Set(contracts.map(c => c.status))];

  // ==========================================
  // TELA 1: ONBOARDING / UPLOAD
  // ==========================================
  if (rawContracts.length === 0) {
    return (
      <div className="h-full bg-zinc-50 text-zinc-900 font-sans flex flex-col items-center justify-center p-6 rounded-2xl">
        <div className="max-w-3xl w-full">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-6 border border-zinc-100">
              <Layers className="w-8 h-8 text-blue-600" strokeWidth={1.5} />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 mb-3">
              Inteligência de Contratos
            </h1>
            <p className="text-zinc-500 text-lg max-w-xl mx-auto">
              Transforme seus relatórios brutos em painéis focados nos seus produtos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div 
              onClick={() => contractsInputRef.current?.click()}
              className="group relative bg-white rounded-3xl p-8 border border-zinc-200 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col items-center text-center h-full"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-600"></div>
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <FileText size={28} strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-bold text-zinc-800 mb-2">1. Relatório de Contratos</h3>
              <p className="text-sm text-zinc-500 mb-6 flex-grow">
                Arquivo CSV contendo a lista de contratos, fornecedores e itens.
              </p>
              <div className="inline-flex items-center font-semibold text-blue-600 bg-blue-50/50 px-4 py-2 rounded-lg group-hover:bg-blue-100 transition-colors">
                {isLoading ? 'Carregando...' : 'Selecionar Arquivo'} <ArrowRight size={16} className="ml-2" />
              </div>
              <input type="file" accept=".csv" onChange={handleContractsUpload} className="hidden" ref={contractsInputRef} />
            </div>

            <div 
              onClick={() => productsInputRef.current?.click()}
              className="group relative bg-zinc-50/50 rounded-3xl p-8 border-2 border-dashed border-zinc-200 hover:border-blue-400 hover:bg-white transition-all cursor-pointer flex flex-col items-center text-center h-full"
            >
              <div className="w-14 h-14 bg-zinc-100 text-zinc-400 group-hover:bg-blue-50 group-hover:text-blue-600 rounded-full flex items-center justify-center mb-5 transition-colors duration-300">
                <LinkIcon size={28} strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-bold text-zinc-800 mb-2">
                2. Dicionário de Produtos <span className="text-xs font-normal text-zinc-400 uppercase tracking-widest ml-1">Opcional</span>
              </h3>
              <p className="text-sm text-zinc-500 mb-6 flex-grow">
                Arquivo CSV de equivalências para traduzir códigos em nomes reais de medicamentos.
              </p>
              <div className="inline-flex items-center font-medium text-zinc-500 group-hover:text-blue-600 transition-colors">
                {hasProducts ? <span className="text-emerald-600 flex items-center"><CheckCircle2 size={16} className="mr-1"/> Carregado</span> : 'Adicionar Equivalências'}
              </div>
              <input type="file" accept=".csv" onChange={handleProductsUpload} className="hidden" ref={productsInputRef} />
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
      <input type="file" accept=".csv" onChange={handleContractsUpload} className="hidden" ref={contractsInputRef} />
      <input type="file" accept=".csv" onChange={handleProductsUpload} className="hidden" ref={productsInputRef} />

      {/* Header Premium */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 backdrop-blur-md bg-white/90 shrink-0">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white">
              <Layers size={18} strokeWidth={2} />
            </div>
            <span className="font-bold tracking-tight text-lg text-slate-900">Contract<span className="text-blue-600 font-extrabold">IQ</span></span>
          </div>
          
          <div className="flex items-center gap-4">
            {!hasProducts && (
              <button onClick={() => productsInputRef.current?.click()} className="hidden md:flex items-center gap-2 text-sm font-medium text-amber-600 bg-amber-50 px-3 py-1.5 rounded-md hover:bg-amber-100 transition-colors border border-amber-200/50">
                <LinkIcon size={14} /> Otimizar Nomes (CSV)
              </button>
            )}
            <button onClick={() => contractsInputRef.current?.click()} className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors">
              <UploadCloud size={16} /> Nova Base
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto max-w-[1400px] w-full mx-auto px-6 py-8 space-y-8">
        
        {/* Título da Página */}
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Visão Geral da Operação</h2>
          <p className="text-slate-500 text-sm mt-1">Análise focada em produtos (itens duplicados foram removidos da contagem).</p>
        </div>

        {/* KPIs Grid (Atualizado) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { label: 'Total de Contratos', value: metrics?.totalContracts, icon: FileText, color: 'blue' },
            { label: 'Fornecedores Únicos', value: metrics?.uniqueSuppliers, icon: Building, color: 'indigo' },
            { label: 'Medicamentos Únicos', value: metrics?.totalItems, icon: Package, color: 'emerald' },
            { label: 'Média Med./Contrato', value: (metrics?.totalItems / metrics?.totalContracts || 0).toFixed(1), icon: ListOrdered, color: 'violet' }
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

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Gráfico 1: Status */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.02)]">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
              <BarChart3 size={16} className="text-slate-400"/> Distribuição por Status
            </h3>
            <div className="space-y-4">
              {metrics && Object.entries(metrics.statusCount)
                .sort((a: any, b: any) => b[1] - a[1])
                .map(([status, count]: [string, any]) => {
                  const percent = Math.round((count / metrics.totalContracts) * 100);
                  let color = 'bg-slate-800';
                  if(status.toLowerCase().includes('finalizado')) color = 'bg-emerald-500';
                  else if(status.toLowerCase().includes('pendente')) color = 'bg-amber-400';

                  return (
                    <div key={status}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-semibold text-slate-700">{status}</span>
                        <span className="text-slate-900 font-bold">{count} <span className="text-slate-400 font-normal text-xs ml-1">({percent}%)</span></span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className={`${color} h-full rounded-full`} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Gráfico 2: Top Fornecedores (Substituiu os Gestores) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.02)]">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
              <Building size={16} className="text-slate-400"/> Top Fornecedores (Contratos)
            </h3>
            <div className="space-y-4">
              {metrics && metrics.topFornecedores.map((fornecedor, idx) => {
                const max = metrics.topFornecedores[0].count;
                const percent = Math.round((fornecedor.count / max) * 100);
                return (
                  <div key={fornecedor.name}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-semibold text-slate-700 truncate pr-4">{fornecedor.name}</span>
                      <span className="text-slate-900 font-bold">{fornecedor.count}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className={`h-full rounded-full ${idx === 0 ? 'bg-indigo-600' : 'bg-indigo-400'}`} style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tabela de Dados (Sem Gestor, Foco em Produtos) */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.02)] overflow-hidden">
          
          <div className="p-5 border-b border-slate-100 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ListOrdered size={18} className="text-slate-400"/> Base de Contratos e Produtos
            </h3>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={16} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Pesquisar medicamento, contrato, fornecedor..."
                  className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 block w-full sm:w-[320px] outline-none transition-all placeholder:text-slate-400"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <select
                className="pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 block bg-white font-medium text-slate-700 outline-none cursor-pointer hover:bg-slate-50 transition-colors"
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
                  <th className="px-6 py-3 w-2/5">Contrato e Produtos Principais</th>
                  <th className="px-6 py-3">Fornecedor</th>
                  <th className="px-4 py-3 text-center">Medicamentos</th>
                  <th className="px-6 py-3">Vencimento</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredContracts.length > 0 ? (
                  filteredContracts.map((contract: any) => {
                    const isExpanded = expandedRows.has(contract.id);
                    // Pega os 3 primeiros produtos para colocar como prévia na linha do contrato
                    const topItemsPreview = contract.itensList.slice(0, 3).map((i: any) => i.nome).join(', ');
                    const hasMoreItems = contract.itensList.length > 3;

                    return (
                      <React.Fragment key={contract.id}>
                        {/* Linha Principal do Contrato */}
                        <tr 
                          onClick={() => toggleRow(contract.id)} 
                          className={`group cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}
                        >
                          <td className="px-4 py-4 text-center">
                            <button className={`p-1 rounded-md transition-colors ${isExpanded ? 'bg-blue-100 text-blue-600' : 'text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600'}`}>
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900 flex items-center gap-2">
                              {contract.id}
                              <span className="text-[10px] uppercase font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200 truncate max-w-[150px]">
                                {contract.nome}
                              </span>
                            </div>
                            
                            {/* Prévia dos Medicamentos com mais ênfase */}
                            <div className="text-xs text-slate-500 mt-2 truncate w-full" title={contract.itensList.map((i: any) => i.nome).join(', ')}>
                              <span className="font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded mr-1.5">
                                <Package size={12} className="inline mr-1 -mt-0.5"/>
                                Produtos:
                              </span> 
                              {topItemsPreview}
                              {hasMoreItems && <span className="font-semibold text-slate-400"> +{contract.itensList.length - 3}</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-700 truncate max-w-[200px]" title={contract.fornecedor}>
                              {contract.fornecedor.split('-').pop().trim()}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold ${isExpanded ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                              {contract.itensCount}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={14} className="text-slate-400"/>
                              {contract.dataVencimento ? contract.dataVencimento.trim() : '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <StatusBadge status={contract.status} />
                          </td>
                        </tr>
                        
                        {/* Linha Expandida (Sub-tabela FOCADA EM PRODUTOS) */}
                        {isExpanded && (
                          <tr className="bg-slate-50/50 border-b border-slate-200">
                            <td colSpan={6} className="p-0">
                              <div className="pl-14 pr-6 py-6 border-l-4 border-blue-500 shadow-inner">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                  <Package size={14} /> Medicamentos Atrelados
                                </h4>
                                
                                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                  <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500">
                                      <tr>
                                        <th className="px-5 py-3">Medicamento / Descrição</th>
                                        <th className="px-5 py-3 w-32">Cód. Sistema</th>
                                        <th className="px-5 py-3 text-center">Unidade</th>
                                        <th className="px-5 py-3 text-right">Valor Unit.</th>
                                        <th className="px-5 py-3 text-center">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {contract.itensList.map((item: any, idx: number) => (
                                        <tr key={`${item.cod}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                                          {/* NOME DO MEDICAMENTO COMO COLUNA PRINCIPAL */}
                                          <td className="px-5 py-3 font-bold text-slate-800 text-sm">
                                            {item.nome}
                                          </td>
                                          {/* DEMAIS INFORMAÇÕES */}
                                          <td className="px-5 py-3 font-mono text-xs font-medium text-slate-500">
                                            {item.cod}
                                          </td>
                                          <td className="px-5 py-3 text-center text-slate-500 text-xs font-medium">
                                            {item.unidade}
                                          </td>
                                          <td className="px-5 py-3 text-right font-bold text-slate-600">
                                            {item.valor}
                                          </td>
                                          <td className="px-5 py-3 text-center">
                                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                              {item.status}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
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
                    <td colSpan={6} className="px-6 py-20 text-center">
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
            <span>Exibindo {filteredContracts.length} de {contracts.length} contratos</span>
          </div>
        </div>

      </main>
    </div>
  );
}
