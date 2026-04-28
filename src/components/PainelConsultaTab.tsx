import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
  BarChart3, 
  Package, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  DollarSign, 
  ChevronDown, 
  ChevronUp, 
  Activity,
  FileSpreadsheet,
  Download,
  Info,
  ArrowRight,
  Pill,
  ShieldAlert,
  Clock,
  Layers,
  ArrowUpDown,
  FileText,
  Percent,
  X,
  Camera,
  Printer,
  TrendingUp as TrendingUpIcon
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

// --- UTILITÁRIOS ---
const toTitleCase = (str: string) =>
  str ? str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const parseBrNumber = (str: string) => {
  if (!str) return 0;
  const cleaned = str.toString().replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

// --- COMPONENTES DE UI ---

const KpiCard = ({ title, value, subValue, icon: Icon, color, trend }: any) => (
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col gap-3 hover:shadow-md transition-all group">
    <div className="flex items-center justify-between">
      <div className={`p-2.5 rounded-xl ${color.bg} ${color.text}`}>
        <Icon size={20} />
      </div>
      {trend !== undefined && (
        <span className={`text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 ${trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(trend)}%
        </span>
      )}
    </div>
    <div>
      <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{title}</p>
      <h3 className="text-xl font-black text-slate-800 mt-1 truncate" title={value}>{value}</h3>
      {subValue && <p className="text-[10px] text-slate-400 font-medium mt-1">{subValue}</p>}
    </div>
  </div>
);

const Badge = ({ children, variant = 'default' }: any) => {
  const variants: any = {
    default: 'bg-slate-100 text-slate-600 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border-amber-100',
    danger: 'bg-rose-50 text-rose-700 border-rose-100',
    info: 'bg-blue-50 text-blue-700 border-blue-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${variants[variant]}`}>
      {children}
    </span>
  );
};

export default function PainelConsultaTab() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [filters, setFilters] = useState({
    abc: 'Todos',
    xyz: 'Todos',
    pqr: 'Todos',
    sinalizador: 'Todos',
  });

  const [sortConfig, setSortConfig] = useState({ key: 'Cobertura', direction: 'asc' });
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 50;
  const modalRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // --- PARSER ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      if (lines.length < 2) {
        setLoading(false);
        return;
      }

      const headers = lines[0].split(';').map(h => h.replace(/"/g, '').trim());
      const results = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(';');
        const obj: any = {};
        headers.forEach((h, idx) => {
          obj[h] = cols[idx]?.replace(/"/g, '').trim() || '';
        });
        results.push(obj);
      }

      setData(results);
      setPaginaAtual(1);
      setLoading(false);
    };
    reader.readAsText(file, 'UTF-8');
  };

  // --- LÓGICA DE DADOS ---
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchSearch = 
        item['Desc Item']?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item['Cod Item']?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchAbc = filters.abc === 'Todos' || item['ABC'] === filters.abc;
      const matchXyz = filters.xyz === 'Todos' || item['XYZ'] === filters.xyz;
      const matchPqr = filters.pqr === 'Todos' || item['PQR'] === filters.pqr;
      const matchSinal = filters.sinalizador === 'Todos' || item['Sinalizador'] === filters.sinalizador;

      return matchSearch && matchAbc && matchXyz && matchPqr && matchSinal;
    });
  }, [data, searchTerm, filters]);

  const sortedData = useMemo(() => {
    const sorted = [...filteredData];
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        let aVal: any = a[sortConfig.key];
        let bVal: any = b[sortConfig.key];

        // Tratar números
        if (['Cobertura', 'VL Médio (R$)', 'Estoq Disp', 'Média 6M', 'Cons 1D', 'Estoq Tot', 'Excesso', 'Excesso (R$)'].includes(sortConfig.key)) {
          aVal = parseBrNumber(aVal);
          bVal = parseBrNumber(bVal);
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [filteredData, sortConfig]);

  const paginatedData = useMemo(() => {
    const start = (paginaAtual - 1) * itensPorPagina;
    return sortedData.slice(start, start + itensPorPagina);
  }, [sortedData, paginaAtual]);

  const totalPaginas = Math.ceil(sortedData.length / itensPorPagina);

  // --- KPIs ---
  const kpis = useMemo(() => {
    if (data.length === 0) return null;

    const totalItens = data.length;
    const rupturas = data.filter(i => parseBrNumber(i['Cobertura']) === 0 || i['Sinalizador'] === 'Zero').length;
    const riscoCritico = data.filter(i => {
      const cob = parseBrNumber(i['Cobertura']);
      return cob > 0 && cob < 7;
    }).length;
    
    const valorEstoque = data.reduce((acc, i) => acc + (parseBrNumber(i['Estoq Tot']) * parseBrNumber(i['VL Médio (R$)'])), 0);
    const curvaA = data.filter(i => i['ABC'] === 'A').length;
    
    const itensExcesso = data.filter(i => parseBrNumber(i['Excesso']) > 0).length;
    const valorExcesso = data.reduce((acc, i) => acc + parseBrNumber(i['Excesso (R$)']), 0);
    
    const cobValidas = data.map(i => parseBrNumber(i['Cobertura'])).filter(c => c > 0);
    const cobMedia = cobValidas.length > 0 ? (cobValidas.reduce((a, b) => a + b, 0) / cobValidas.length).toFixed(1) : 0;
    
    const taxaRuptura = ((rupturas / totalItens) * 100).toFixed(1);

    return { 
      totalItens, 
      rupturas, 
      riscoCritico, 
      valorEstoque, 
      curvaA, 
      itensExcesso, 
      valorExcesso, 
      cobMedia, 
      taxaRuptura 
    };
  }, [data]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setPaginaAtual(1);
  };

  useEffect(() => {
    setPaginaAtual(1);
  }, [searchTerm, filters]);

  // --- EXPORT PDF ---
  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(75, 44, 127); // Purple
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('CAF SMART - Relatório de Abastecimento', 15, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 15, 30);
    doc.text(`Filtros: ABC(${filters.abc}), XYZ(${filters.xyz}), Status(${filters.sinalizador})`, 15, 35);

    // KPI Summary in PDF
    if (kpis) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, 45, pageWidth - 30, 25, 'F');
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(9);
      doc.text('RESUMO ESTRATÉGICO', 20, 52);
      
      doc.setFontSize(8);
      doc.text(`Total Itens: ${kpis.totalItens}`, 20, 60);
      doc.text(`Rupturas: ${kpis.rupturas} (${kpis.taxaRuptura}%)`, 60, 60);
      doc.text(`Risco Crítico: ${kpis.riscoCritico}`, 110, 60);
      doc.text(`Valor Estoque: ${formatCurrency(kpis.valorEstoque)}`, 160, 60);
      doc.text(`Itens Excesso: ${kpis.itensExcesso}`, 220, 60);
    }

    // Table
    const tableHeaders = ['Status', 'Código', 'Descrição', 'ABC/XYZ', 'Estoque', 'Cobertura', 'Vl. Unit'];
    const tableData = sortedData.map(item => [
      item['Sinalizador'] || '-',
      item['Cod Item'] || '-',
      item['Desc Item']?.substring(0, 50) || '-',
      `${item['ABC'] || '-'}/${item['XYZ'] || '-'}`,
      item['Estoq Disp'] || '0',
      `${item['Cobertura'] || '0'}d`,
      formatCurrency(parseBrNumber(item['VL Médio (R$)']))
    ]);

    autoTable(doc, {
      startY: 75,
      head: [tableHeaders],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [75, 44, 127], textColor: [255, 255, 255], fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 80 },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 20, halign: 'center' },
        6: { cellWidth: 30, halign: 'right' },
      },
      styles: { fontSize: 7, cellPadding: 2 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const val = data.cell.raw;
          if (val === 'Zero') data.cell.styles.textColor = [220, 38, 38];
          if (val === 'Muito Baixo' || val === 'Baixo') data.cell.styles.textColor = [217, 119, 6];
        }
      }
    });

    doc.save(`CAF_SMART_Relatorio_${new Date().getTime()}.pdf`);
  };

  const exportItemAsImage = async (elementRef: React.RefObject<HTMLDivElement>, fileName: string) => {
    if (!elementRef.current) return;
    
    try {
      const canvas = await html2canvas(elementRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Melhor qualidade
        logging: false,
        useCORS: true
      });
      
      const link = document.createElement('a');
      link.download = `${fileName}_${new Date().getTime()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Erro ao exportar imagem:', error);
    }
  };

  const essentialHeaders = [
    { key: 'Sinalizador', label: 'Status' },
    { key: 'Cod Item', label: 'Código' },
    { key: 'Desc Item', label: 'Medicamento / Material' },
    { key: 'ABC', label: 'ABC' },
    { key: 'XYZ', label: 'XYZ' },
    { key: 'Estoq Disp', label: 'Estoque' },
    { key: 'Cobertura', label: 'Cobertura' },
    { key: 'VL Médio (R$)', label: 'Vl. Unit' },
  ];

  // --- RENDER ---
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white rounded-3xl border-2 border-dashed border-slate-200 p-12 text-center">
        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
          <FileSpreadsheet className="text-indigo-600 w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Painel de Consulta Farmacêutica</h2>
        <p className="text-slate-500 mt-2 max-w-md">
          Importe o relatório de sinalizadores (CSV) para iniciar a análise interativa de estoque e demanda.
        </p>
        <label className="mt-8 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center gap-3">
          <Download size={20} />
          Selecionar Arquivo CSV
          <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
        </label>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-10">
      
      {/* HEADER & SEARCH */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <ShieldAlert className="text-indigo-600" />
            Consulta de Abastecimento
          </h1>
          <p className="text-slate-400 text-sm font-medium">Análise de Risco, Curva ABC e Cobertura</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por código ou descrição..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-rose-100"
            title="Exportar PDF"
          >
            <FileText size={18} />
            PDF
          </button>
          <button 
            onClick={() => setData([])}
            className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
            title="Limpar dados"
          >
            <Activity size={20} />
          </button>
        </div>
      </div>

      {/* KPI GRID */}
      {kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
          <KpiCard 
            title="Total Itens" 
            value={kpis.totalItens} 
            icon={Package} 
            color={{ bg: 'bg-blue-50', text: 'text-blue-600' }} 
          />
          <KpiCard 
            title="Taxa Ruptura" 
            value={`${kpis.taxaRuptura}%`} 
            subValue={`${kpis.rupturas} itens zerados`}
            icon={ShieldAlert} 
            color={{ bg: 'bg-rose-50', text: 'text-rose-600' }} 
          />
          <KpiCard 
            title="Risco Crítico" 
            value={kpis.riscoCritico} 
            subValue="Cobertura < 7 dias"
            icon={Clock} 
            color={{ bg: 'bg-amber-50', text: 'text-amber-600' }} 
          />
          <KpiCard 
            title="Cob. Média" 
            value={`${kpis.cobMedia}d`} 
            subValue="Geral do estoque"
            icon={Activity} 
            color={{ bg: 'bg-indigo-50', text: 'text-indigo-600' }} 
          />
          <KpiCard 
            title="Curva A" 
            value={kpis.curvaA} 
            subValue="Alto impacto financeiro"
            icon={Layers} 
            color={{ bg: 'bg-purple-50', text: 'text-purple-600' }} 
          />
          <KpiCard 
            title="Valor Estoque" 
            value={formatCurrency(kpis.valorEstoque)} 
            icon={DollarSign} 
            color={{ bg: 'bg-emerald-50', text: 'text-emerald-600' }} 
          />
          <KpiCard 
            title="Itens Excesso" 
            value={kpis.itensExcesso} 
            subValue="Acima do estoque alvo"
            icon={TrendingUpIcon} 
            color={{ bg: 'bg-orange-50', text: 'text-orange-600' }} 
          />
          <KpiCard 
            title="Valor Excesso" 
            value={formatCurrency(kpis.valorExcesso)} 
            subValue="Capital imobilizado"
            icon={DollarSign} 
            color={{ bg: 'bg-rose-50', text: 'text-rose-600' }} 
          />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        
        {/* FILTERS SIDEBAR */}
        <div className="xl:col-span-1 flex flex-col gap-4">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-5 sticky top-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3">
              <Filter size={18} className="text-indigo-600" />
              Filtros Avançados
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Curva ABC</label>
                <div className="flex flex-wrap gap-2">
                  {['Todos', 'A', 'B', 'C'].map(v => (
                    <button 
                      key={v}
                      onClick={() => setFilters(f => ({...f, abc: v}))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filters.abc === v ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Criticidade (XYZ)</label>
                <div className="flex flex-wrap gap-2">
                  {['Todos', 'X', 'Y', 'Z'].map(v => (
                    <button 
                      key={v}
                      onClick={() => setFilters(f => ({...f, xyz: v}))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filters.xyz === v ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Sinalizador</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={filters.sinalizador}
                  onChange={(e) => setFilters(f => ({...f, sinalizador: e.target.value}))}
                >
                  <option value="Todos">Todos os Status</option>
                  <option value="Ideal">Ideal</option>
                  <option value="Baixo">Baixo</option>
                  <option value="Muito Baixo">Muito Baixo</option>
                  <option value="Alto">Alto</option>
                  <option value="Muito Alto">Muito Alto</option>
                  <option value="Zero">Zero / Ruptura</option>
                </select>
              </div>
            </div>
          </div>

          {/* ITEM SELECIONADO (RESUMO) */}
          {selectedItem && (
            <div 
              ref={cardRef}
              className="bg-indigo-600 text-white p-6 rounded-3xl shadow-lg shadow-indigo-100 flex flex-col gap-4 animate-in slide-in-from-left duration-300"
            >
              <div className="flex justify-between items-start">
                <Pill size={32} className="opacity-50" />
                <button onClick={() => setSelectedItem(null)} className="text-white/60 hover:text-white print:hidden">✕</button>
              </div>
              <div>
                <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest">Item Selecionado</p>
                <h4 className="text-lg font-bold leading-tight mt-1">{toTitleCase(selectedItem['Desc Item'])}</h4>
                <p className="text-indigo-100 text-xs mt-1 font-mono">{selectedItem['Cod Item']}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="bg-white/10 p-3 rounded-2xl">
                  <p className="text-[10px] text-indigo-200 uppercase font-bold">Estoque</p>
                  <p className="text-lg font-black">{selectedItem['Estoq Disp']}</p>
                </div>
                <div className="bg-white/10 p-3 rounded-2xl">
                  <p className="text-[10px] text-indigo-200 uppercase font-bold">Cobertura</p>
                  <p className="text-lg font-black">{selectedItem['Cobertura']}d</p>
                </div>
              </div>
              <div className="space-y-2 mt-2">
                <div className="flex justify-between text-xs border-b border-white/10 pb-1">
                  <span className="text-indigo-200">Média 6M:</span>
                  <span className="font-bold">{selectedItem['Média 6M']}</span>
                </div>
                <div className="flex justify-between text-xs border-b border-white/10 pb-1">
                  <span className="text-indigo-200">Consumo 1D:</span>
                  <span className="font-bold">{selectedItem['Cons 1D']}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-indigo-200">Excesso:</span>
                  <span className="font-bold text-rose-300">{selectedItem['Excesso']}</span>
                </div>
              </div>
              
              <button 
                onClick={() => exportItemAsImage(cardRef, `Etiqueta_${selectedItem['Cod Item']}`)}
                className="w-full bg-white text-indigo-600 py-3 rounded-2xl font-bold text-sm hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 shadow-xl shadow-indigo-900/20 print:hidden"
              >
                <Camera size={16} />
                Exportar Etiqueta
              </button>
            </div>
          )}
        </div>

        {/* DATA TABLE */}
        <div className="xl:col-span-4 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  {essentialHeaders.map((header) => (
                    <th 
                      key={header.key} 
                      className={`p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors ${['Estoq Disp', 'Cobertura', 'ABC', 'XYZ'].includes(header.key) ? 'text-center' : ''} ${header.key === 'VL Médio (R$)' ? 'text-right' : ''}`}
                      onClick={() => handleSort(header.key)}
                    >
                      <div className={`flex items-center gap-1 ${['Estoq Disp', 'Cobertura', 'ABC', 'XYZ'].includes(header.key) ? 'justify-center' : ''} ${header.key === 'VL Médio (R$)' ? 'justify-end' : ''}`}>
                        {header.label}
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedData.map((item, idx) => {
                  const isSelected = selectedItem?.['Cod Item'] === item['Cod Item'];

                  return (
                    <tr 
                      key={idx} 
                      onClick={() => setSelectedItem(item)}
                      className={`group cursor-pointer transition-all hover:bg-slate-50/80 ${isSelected ? 'bg-indigo-50/50' : ''}`}
                    >
                      {essentialHeaders.map((header) => {
                        const val = item[header.key];
                        
                        if (header.key === 'Sinalizador') {
                          const cob = parseBrNumber(item['Cobertura']);
                          let variant: any = 'default';
                          if (val === 'Zero' || cob === 0) variant = 'danger';
                          else if (cob < 7 || val === 'Muito Baixo' || val === 'Baixo') variant = 'warning';
                          else if (val === 'Ideal') variant = 'success';
                          else if (val === 'Muito Alto' || val === 'Alto') variant = 'purple';
                          return (
                            <td key={header.key} className="p-4 whitespace-nowrap">
                              <Badge variant={variant}>{val || 'N/A'}</Badge>
                            </td>
                          );
                        }

                        if (header.key === 'Desc Item') {
                          return (
                            <td key={header.key} className="p-4 min-w-[200px]">
                              <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors line-clamp-1">
                                {toTitleCase(val)}
                              </span>
                            </td>
                          );
                        }

                        if (header.key === 'Cobertura') {
                          const cob = parseBrNumber(val);
                          return (
                            <td key={header.key} className="p-4 text-center whitespace-nowrap">
                              <div className="flex flex-col items-center">
                                <span className={`text-sm font-black ${cob === 0 ? 'text-rose-600' : cob < 7 ? 'text-amber-600' : 'text-slate-700'}`}>
                                  {cob}d
                                </span>
                                <div className="w-12 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${cob === 0 ? 'bg-rose-500' : cob < 7 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(cob * 3, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          );
                        }

                        if (header.key === 'VL Médio (R$)') {
                          return (
                            <td key={header.key} className="p-4 text-right whitespace-nowrap">
                              <span className="text-xs font-bold text-slate-600">{formatCurrency(parseBrNumber(val))}</span>
                            </td>
                          );
                        }

                        if (['ABC', 'XYZ', 'Estoq Disp'].includes(header.key)) {
                          return (
                            <td key={header.key} className="p-4 text-sm text-slate-600 text-center whitespace-nowrap font-bold">
                              {val}
                            </td>
                          );
                        }

                        return (
                          <td key={header.key} className="p-4 text-sm text-slate-600 whitespace-nowrap">
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {paginatedData.length === 0 && (
            <div className="p-12 text-center">
              <Info className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-500 text-sm">Nenhum item corresponde aos filtros aplicados.</p>
            </div>
          )}

          <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Mostrando {Math.min(sortedData.length, (paginaAtual - 1) * itensPorPagina + 1)} - {Math.min(sortedData.length, paginaAtual * itensPorPagina)} de {sortedData.length} itens
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                disabled={paginaAtual === 1}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-30"
              >
                <ChevronDown size={16} className="rotate-90" />
              </button>
              <button 
                onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                disabled={paginaAtual === totalPaginas}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-30"
              >
                <ChevronDown size={16} className="-rotate-90" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE DETALHES COMPLETOS */}
      {selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            ref={modalRef}
            className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
          >
            <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-2xl">
                  <Pill size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black">{toTitleCase(selectedItem['Desc Item'])}</h2>
                  <p className="text-indigo-100 text-xs font-mono">Código: {selectedItem['Cod Item']}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedItem(null)}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors print:hidden"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {Object.entries(selectedItem).map(([key, value]: [string, any]) => (
                  <div key={key} className="flex flex-col gap-1 border-b border-slate-50 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{key}</span>
                    <span className="text-sm font-bold text-slate-700">
                      {key.includes('VL Médio') || key.includes('(R$)') ? formatCurrency(parseBrNumber(value)) : value || '-'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-slate-50 p-6 border-t border-slate-100 flex justify-end gap-3 print:hidden">
              <button 
                onClick={() => exportItemAsImage(modalRef, `Detalhes_${selectedItem['Cod Item']}`)}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                <Camera size={18} />
                Exportar Imagem
              </button>
              <button 
                onClick={() => setSelectedItem(null)}
                className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
