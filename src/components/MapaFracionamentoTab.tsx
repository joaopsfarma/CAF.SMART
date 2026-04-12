import React, { useState, useMemo, useRef } from 'react';
import { Upload, Printer, FileSpreadsheet, Search, Map as MapIcon, FileText, CheckSquare, Scissors, Info } from 'lucide-react';
import { Logo } from './Logo';

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

export default function MapaFracionamentoTab() {
  const [data, setData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
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
          setError('Não foi possível encontrar dados válidos. Verifique se o CSV é o relatório correto.');
        }
        setData(parsed);
        setSelectedItems(new Set(parsed.map(item => item.id)));
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

  const processedData = useMemo(() => {
    return data
      .filter(item => item.product.toLowerCase().includes(searchTerm.toLowerCase()))
      .map(item => ({
        ...item,
        category: getCategory(item.product, item.unit)
      }));
  }, [data, searchTerm]);

  const toggleItem = (id: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedItems(newSelected);
  };

  const toggleAll = () => {
    if (selectedItems.size === processedData.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(processedData.map(item => item.id)));
    }
  };

  const groupedData = useMemo(() => {
    const groups: Record<string, any[]> = {};
    processedData.forEach(item => {
      if (selectedItems.has(item.id)) {
        if (!groups[item.category]) groups[item.category] = [];
        groups[item.category].push(item);
      }
    });
    return groups;
  }, [processedData, selectedItems]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full bg-slate-100">
      {/* Estilos de Impressão */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%;
            padding: 0;
            margin: 0;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          .no-print { display: none !important; }
        }
      `}} />

      <div className="flex flex-col lg:flex-row h-full overflow-hidden">
        {/* Painel Lateral de Controle */}
        <div className="w-full lg:w-80 bg-white border-r border-slate-200 p-6 flex flex-col gap-6 no-print">
          <div className="flex items-center gap-3 text-purple-700">
            <MapIcon className="w-6 h-6" />
            <h2 className="text-lg font-black uppercase tracking-tight">Mapa de Fracionamento</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">1. Importar Dados</label>
              <div className="relative group">
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="border-2 border-dashed border-slate-200 group-hover:border-purple-400 rounded-xl p-4 transition-all flex flex-col items-center text-center bg-slate-50">
                  <Upload className="w-8 h-8 text-slate-300 group-hover:text-purple-500 mb-2" />
                  <span className="text-xs font-bold text-slate-600">{fileName || 'Selecionar CSV'}</span>
                  <span className="text-[10px] text-slate-400 mt-1">Relatório de Consumo</span>
                </div>
              </div>
              {error && <p className="text-red-500 text-[10px] mt-2 font-bold">{error}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">2. Filtrar e Selecionar</label>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Pesquisar produto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <button 
                onClick={toggleAll}
                className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-purple-600 border border-slate-200 rounded-lg transition-colors"
              >
                {selectedItems.size === processedData.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-xl p-2 space-y-1 custom-scrollbar">
              {processedData.map(item => (
                <div 
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedItems.has(item.id) ? 'bg-purple-50 text-purple-700' : 'hover:bg-slate-50 text-slate-500'}`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedItems.has(item.id) ? 'bg-purple-600 border-purple-600' : 'border-slate-300'}`}>
                    {selectedItems.has(item.id) && <CheckSquare className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-[10px] font-bold truncate">{item.product}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={handlePrint}
              disabled={selectedItems.size === 0}
              className="w-full bg-slate-900 hover:bg-black text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              <Printer className="w-5 h-5" />
              Imprimir Mapa A4
            </button>
          </div>

          <div className="mt-auto p-4 bg-purple-50 rounded-xl border border-purple-100">
            <div className="flex items-center gap-2 text-purple-700 mb-2">
              <Info className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Dica de Uso</span>
            </div>
            <p className="text-[10px] text-purple-600 leading-relaxed">
              Este mapa visual é ideal para organizar a bancada de fracionamento. Cada card representa um item a ser preparado.
            </p>
          </div>
        </div>

        {/* Área do Mapa (A4) */}
        <div className="flex-1 overflow-auto p-4 lg:p-8 flex justify-center items-start bg-slate-200">
          {data.length === 0 ? (
            <div className="mt-20 text-center text-slate-400">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-bold">Aguardando importação...</h3>
              <p className="text-sm">Os cards do mapa aparecerão aqui após o upload.</p>
            </div>
          ) : (
            <div id="print-area" ref={printRef} className="bg-white w-[210mm] min-h-[297mm] shadow-2xl p-[10mm] font-sans">
              {/* Cabeçalho do Mapa */}
              <div className="border-b-4 border-slate-900 pb-4 mb-8 flex justify-between items-end">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12">
                    <Logo className="w-full h-full" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase m-0">Mapa de Fracionamento</h1>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] m-0 mt-1">Guia Visual de Preparo • CAF SMART</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase m-0">Data de Geração</p>
                  <p className="text-sm font-bold text-slate-900 m-0">{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>

              {/* Grid de Cards */}
              <div className="space-y-10">
                {(Object.entries(groupedData) as [string, any[]][]).map(([category, items]) => (
                  <div key={category} className="break-inside-avoid">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-6 w-1 bg-purple-600 rounded-full"></div>
                      <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">{category}</h2>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {items.map((item) => (
                        <div key={item.id} className="border-2 border-slate-200 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden break-inside-avoid">
                          {/* Background Decorativo */}
                          <div className="absolute top-0 right-0 p-2 opacity-5">
                            <Scissors className="w-12 h-12" />
                          </div>

                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{item.code}</span>
                              <h3 className="text-sm font-black text-slate-900 leading-tight uppercase line-clamp-2">{item.product}</h3>
                              <p className="text-[10px] font-bold text-slate-500 mt-1">{item.unit}</p>
                            </div>
                            <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-center min-w-[60px]">
                              <span className="block text-[8px] font-bold uppercase opacity-60">Qtd</span>
                              <span className="text-xl font-black leading-none">{item.consumption}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-2">
                            <div className="border-b border-slate-300 pb-1">
                              <span className="text-[8px] font-bold text-slate-400 uppercase block">Lote</span>
                              <div className="h-5"></div>
                            </div>
                            <div className="border-b border-slate-300 pb-1">
                              <span className="text-[8px] font-bold text-slate-400 uppercase block">Validade</span>
                              <div className="h-5"></div>
                            </div>
                          </div>

                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 border-2 border-slate-300 rounded-md"></div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase">Preparado</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 border-2 border-slate-300 rounded-md"></div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase">Conferido</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Rodapé da Página */}
              <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-center text-slate-400">
                <span className="text-[9px] font-bold uppercase tracking-widest">CAF SMART • Sistema de Gestão Farmacêutica</span>
                <span className="text-[9px] font-bold uppercase tracking-widest">Página 1 de 1</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
