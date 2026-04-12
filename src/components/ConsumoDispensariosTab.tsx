import React, { useState, useRef } from 'react';
import { 
  UploadCloud, FileText, Download, Printer, Loader2, 
  Search, Trash2, CheckCircle, AlertTriangle, FileSpreadsheet,
  Scissors, Activity
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Funções Auxiliares de Parsing ---
const parseBRNum = (str: any) => {
  if (!str) return 0;
  const clean = str.toString().replace(/"/g, '').trim();
  if (clean === '') return 0;
  const enStr = clean.replace(/\./g, '').replace(',', '.');
  return parseFloat(enStr) || 0;
};

const detectCategory = (name: string): 'Medicamento' | 'Material' => {
  const upper = name.toUpperCase();
  
  // Palavras que indicam fortemente ser um medicamento (dosagens, vias de administração)
  const medicationKeywords = [
    'MG', 'ML', 'AMP', 'EV', 'IM', 'SC', 'COMP', 'FRASCO', 'FR', 'UI', 
    'CP', 'CAPS', 'GTS', 'GOTAS', 'XPE', 'SOL', 'INJ', 'PÓ', 'SACHE'
  ];

  const materialKeywords = [
    'CATETER', 'AGULHA', 'SERINGA', 'EQUIPO', 'EXTENSAO', 'SONDA', 'FRALDA', 
    'LUVA', 'GAZE', 'COMPRESSA', 'FIXADOR', 'CONECTOR', 'TORNEIRA', 'TUBO', 
    'LANCETA', 'BISTURI', 'CURATIVO', 'ELETRODO', 'SENSOR', 'SCALP',
    'ATADURA', 'COLETOR', 'DISPOSITIVO', 'KIT', 'ESPARADRAPO', 'MICROPORE',
    'LAMINA DE BISTURI', 'LAMINA P/'
  ];
  
  // Se contiver termos de dosagem/via, é quase certo ser Medicamento
  // Usamos regex para garantir que são termos isolados (ex: MG não bater em "AMIGDALITE")
  const hasMedicationTerm = medicationKeywords.some(key => {
    const regex = new RegExp(`\\b${key}\\b|${key}/`, 'i');
    return regex.test(upper);
  });

  if (hasMedicationTerm) return 'Medicamento';

  if (materialKeywords.some(key => upper.includes(key))) {
    return 'Material';
  }

  // Caso específico para evitar que "ESCOPOLAMINA" caia em "LAMINA"
  if (upper.includes('LAMINA') && !upper.includes('BISTURI') && !upper.includes('MICROSCOPIO')) {
    // Se tem LAMINA mas não é de bisturi/microscópio, e não bateu nos termos de medicação,
    // ainda assim verificamos se parece um nome químico (geralmente termina em INA, OL, OZ, etc)
    if (upper.endsWith('INA') || upper.includes('INA ')) return 'Medicamento';
  }

  return 'Medicamento';
};

const parseCSVLine = (text: string) => {
  const result = [];
  let curVal = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    let char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (i < text.length - 1 && text[i + 1] === '"') {
          curVal += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        curVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(curVal);
        curVal = '';
      } else {
        curVal += char;
      }
    }
  }
  result.push(curVal);
  return result;
};

export default function ConsumoDispensariosTab() {
  const [data, setData] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [margemSeguranca, setMargemSeguranca] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'Todos' | 'Medicamento' | 'Material'>('Todos');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processCSV = (text: string) => {
    try {
      const lines = text.split(/\r?\n/);
      const parsedData = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const row = parseCSVLine(line);
        const seq = parseInt(row[0]);
        if (isNaN(seq)) continue;

        const codigo = row[1]?.trim();
        const produto = row[3]?.trim();
        const unidade = row[4]?.trim();
        const qtdConsumo = parseBRNum(row[10]);

        if (produto && qtdConsumo > 0) {
          parsedData.push({
            id: `${codigo}-${i}`,
            codigo,
            produto,
            unidade,
            qtdConsumo,
            aFracionar: Math.ceil(qtdConsumo * (1 + margemSeguranca / 100)),
            categoria: detectCategory(produto)
          });
        }
      }

      if (parsedData.length === 0) {
        setError('Nenhum dado válido encontrado no arquivo. Verifique o formato.');
      } else {
        parsedData.sort((a, b) => a.produto.localeCompare(b.produto));
        setData(parsedData);
        // Seleciona todos por padrão
        setSelectedIds(new Set(parsedData.map(d => d.id)));
        setError('');
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao processar o arquivo CSV.');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.map(d => d.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleQuantityChange = (id: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setData(prev => prev.map(item => 
      item.id === id ? { ...item, aFracionar: numValue } : item
    ));
  };

  const aplicarMargemGlobal = () => {
    setData(prev => prev.map(item => ({
      ...item,
      aFracionar: Math.ceil(item.qtdConsumo * (1 + margemSeguranca / 100))
    })));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => processCSV(event.target?.result as string);
      reader.readAsText(file, 'ISO-8859-1');
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => processCSV(event.target?.result as string);
      reader.readAsText(file, 'ISO-8859-1');
    }
  };

  const exportPDF = () => {
    const itemsToPrint = data.filter(d => selectedIds.has(d.id) && d.aFracionar > 0);
    if (itemsToPrint.length === 0) {
      alert('Selecione pelo menos um item com quantidade maior que zero para imprimir.');
      return;
    }
    setIsGeneratingPDF(true);

    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      doc.setFontSize(18);
      doc.setTextColor(75, 44, 127);
      doc.text('Relatório de Fracionamento - Consumo Dispensários', 14, 15);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} | Itens: ${itemsToPrint.length}`, 14, 22);

      const meds = itemsToPrint.filter(d => d.categoria === 'Medicamento').sort((a, b) => a.produto.localeCompare(b.produto));
      const mats = itemsToPrint.filter(d => d.categoria === 'Material').sort((a, b) => a.produto.name?.localeCompare(b.produto.name)); // Fix: a.produto is string

      // Actually sorting strings
      const sortedMeds = meds.sort((a, b) => a.produto.localeCompare(b.produto));
      const sortedMats = mats.sort((a, b) => a.produto.localeCompare(b.produto));

      let currentY = 30;

      const printSection = (title: string, items: any[]) => {
        if (items.length === 0) return;

        doc.setFontSize(12);
        doc.setTextColor(75, 44, 127);
        doc.text(title, 14, currentY);
        currentY += 5;

        autoTable(doc, {
          head: [["Código", "Produto", "Unidade", "A Fracionar", "Etiqueta"]],
          body: items.map(item => [
            item.codigo,
            item.produto,
            item.unidade,
            item.aFracionar.toLocaleString('pt-BR'),
            "" // Etiqueta
          ]),
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [75, 44, 127], textColor: [255, 255, 255], fontStyle: 'bold' },
          styles: { fontSize: 8, cellPadding: 2 },
          columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 30 },
            3: { cellWidth: 30, halign: 'center' },
            4: { cellWidth: 30, halign: 'center' }
          },
          didDrawPage: (data) => {
            currentY = data.cursor?.y || currentY;
          }
        });
        
        currentY = (doc as any).lastAutoTable.finalY + 15;
      };

      printSection('1. MEDICAMENTOS', sortedMeds);
      
      if (currentY > 180 && sortedMats.length > 0) {
        doc.addPage();
        currentY = 20;
      }
      
      printSection('2. MATERIAIS', sortedMats);

      doc.save(`Fracionamento_Consumo_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar PDF.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const filteredData = data.filter(item => {
    const matchesSearch = item.produto.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.codigo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'Todos' || item.categoria === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Scissors className="text-purple-600" />
              Consumo Dispensários
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Importe o relatório de consumo para calcular o fracionamento necessário (Estoque = 0).
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 bg-purple-50 p-4 rounded-xl border border-purple-100 w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 p-2 rounded-lg"><Activity className="text-purple-600 w-5 h-5" /></div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Margem de Segurança (%)</label>
                <div className="flex items-center gap-2 mt-0.5">
                  <input 
                    type="number" min="0" step="5" value={margemSeguranca} 
                    onChange={(e) => setMargemSeguranca(Number(e.target.value))}
                    className="w-16 p-1 border border-slate-300 rounded text-center font-bold text-slate-700 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                  <button 
                    onClick={aplicarMargemGlobal}
                    className="text-[10px] bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 transition-colors font-bold"
                  >
                    APLICAR
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {data.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={exportPDF}
                disabled={isGeneratingPDF}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-sm disabled:opacity-50"
              >
                {isGeneratingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                Exportar PDF (Paisagem)
              </button>
              <button
                onClick={() => { setData([]); setFileName(''); setError(''); }}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl font-bold transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Limpar
              </button>
            </div>
          )}
        </div>

        {data.length === 0 ? (
          <div 
            className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer
              ${isDragging ? 'border-purple-500 bg-purple-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv"
              className="hidden"
            />
            <div className="bg-white p-4 rounded-full shadow-sm mb-4">
              <UploadCloud className="w-10 h-10 text-purple-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-1">Arraste o relatório de consumo</h3>
            <p className="text-slate-500 text-sm">ou clique para selecionar o arquivo CSV</p>
            {error && (
              <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-100 text-sm">
                <AlertTriangle size={16} />
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input 
                  type="text"
                  placeholder="Pesquisar por produto ou código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                />
              </div>
              
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                {(['Todos', 'Medicamento', 'Material'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      categoryFilter === cat 
                        ? 'bg-white text-purple-700 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {cat === 'Todos' ? 'Todos' : cat === 'Medicamento' ? 'Medicamentos' : 'Materiais'}
                  </button>
                ))}
              </div>

              <div className="bg-purple-50 px-4 py-2 rounded-xl border border-purple-100 flex items-center gap-2">
                <Activity className="text-purple-600 w-5 h-5" />
                <span className="text-sm font-bold text-purple-700">{data.length} itens detectados</span>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 uppercase text-[11px] tracking-wider font-bold">
                    <th className="p-4 border-b w-10">
                      <input 
                        type="checkbox"
                        checked={selectedIds.size === filteredData.length && filteredData.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                      />
                    </th>
                    <th className="p-4 border-b">Código</th>
                    <th className="p-4 border-b">Produto</th>
                    <th className="p-4 border-b">Unidade</th>
                    <th className="p-4 border-b text-center">Consumo</th>
                    <th className="p-4 border-b text-center bg-purple-50 text-purple-700">A Fracionar</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-50">
                  {filteredData.map((item) => (
                    <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(item.id) ? 'bg-purple-50/20' : ''}`}>
                      <td className="p-4 border-b">
                        <input 
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                        />
                      </td>
                      <td className="p-4 font-mono text-xs text-slate-500">{item.codigo}</td>
                      <td className="p-4 font-medium text-slate-800">
                        <div className="flex flex-col">
                          <span>{item.produto}</span>
                          <span className={`text-[10px] font-bold uppercase ${item.categoria === 'Medicamento' ? 'text-blue-500' : 'text-amber-500'}`}>
                            {item.categoria}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-600">{item.unidade}</td>
                      <td className="p-4 text-center text-slate-600">{item.qtdConsumo.toLocaleString('pt-BR')}</td>
                      <td className="p-4 text-center bg-purple-50/30">
                        <input 
                          type="number"
                          min="0"
                          value={item.aFracionar}
                          onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                          className="w-20 px-2 py-1 text-center font-bold text-purple-700 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
