import React, { useState, useRef } from 'react';
import { Tag, UploadCloud, Download, Trash2, Search, Printer, AlertTriangle } from 'lucide-react';
import jsPDF from 'jspdf';

// Dicionário de Tall Man Lettering para Medicamentos LASA (Look-Alike, Sound-Alike)
const tallManDictionary: Record<string, string> = {
  'ALFENTANILA': 'ALFENTANila',
  'FENTANILA': 'FENTANila',
  'SUFENTANILA': 'SUFENTANila',
  'REMIFENTANILA': 'REMIFENTANila',
  'DOPAMINA': 'DOPAmine',
  'DOBUTAMINA': 'DOBUTamine',
  'CISPLATINA': 'CISplatina',
  'CARBOPLATINA': 'CARBOplatina',
  'VINBLASTINA': 'vinBLAStina',
  'VINCRISTINA': 'vinCRIStina',
  'EPINEFRINA': 'EPINEFrina',
  'NOREPINEFRINA': 'NOREPINEFrina',
  'CEFAZOLINA': 'CEFAZolina',
  'CEFOTAXIMA': 'CEFOtaxima',
  'CEFOXITINA': 'CEFOxitina',
  'CEFTAZIDIMA': 'CEFTAzidima',
  'CEFTRIAXONA': 'CEFTRIAXona',
  'CEFUROXIMA': 'CEFUroxima',
  'DIAZEPAM': 'DIAZEpam',
  'LORAZEPAM': 'LORAZEpam',
  'MIDAZOLAM': 'MIDAZOlam',
  'ALPRAZOLAM': 'ALPRAZOlam',
  'CLONAZEPAM': 'CLONAZEpam',
  'AMITRIPTILINA': 'AMITRIptilina',
  'NORTRIPTILINA': 'NORTRIptilina',
  'CLORPROMAZINA': 'CLORPROmazina',
  'LEVOMEPROMAZINA': 'LEVOMEPROmazina',
  'PROMETAZINA': 'PROMETAzina',
  'HALOPERIDOL': 'HALOPERidol',
  'RISPERIDONA': 'RISPERidona',
  'QUETIAPINA': 'QUETIApina',
  'OLANZAPINA': 'OLANZApina',
  'MORFINA': 'MORFina',
  'MEPERIDINA': 'MEPERidina',
  'NALOXONA': 'NALOXona',
  'NALBUFINA': 'NALBUfina',
  'TRAMADOL': 'TRAMAdol',
  'CODEINA': 'CODEina',
  'PROPOFOL': 'PROPOfol',
  'ETOMIDATO': 'ETOMIdato',
  'QUETAMINA': 'QUETAMina',
  'ESCETAMINA': 'ESCETAMina',
  'LEVETIRACETAM': 'LEVETIRAzetam',
  'LACOSAMIDA': 'LACOSamida',
  'GABAPENTINA': 'GABAPENtina',
  'PREGABALINA': 'PREGABAlina',
  'FENITOINA': 'FENITOina',
  'FENOBARBITAL': 'FENOBARBITal',
  'VALPROATO': 'VALPROato',
  'DIVALPROATO': 'DIVALPROato',
  'DEXMEDETOMIDINA': 'DEXMEDETOMidina',
  'ZOLPIDEM': 'ZOLPIdem',
  'DONEPEZILA': 'DONEPEzila',
  'MEMANTINA': 'MEMANtina',
  'RIVASTIGMINA': 'RIVAStigmina',
};

const applyTallMan = (text: string) => {
  let formattedText = text.toUpperCase();
  Object.keys(tallManDictionary).forEach(key => {
    const regex = new RegExp(`\\b${key}\\b`, 'gi');
    formattedText = formattedText.replace(regex, tallManDictionary[key]);
  });
  return formattedText;
};

const parseCSVLine = (line: string) => {
  const result = [];
  let curVal = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) {
      result.push(curVal);
      curVal = '';
    } else {
      curVal += char;
    }
  }
  result.push(curVal);
  return result;
};

interface LabelItem {
  id: string;
  codigo: string;
  produto: string;
  unidade: string;
  produtoFormatado: string;
}

export default function EtiquetasPrateleiraTab() {
  const [data, setData] = useState<LabelItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processCSV = (text: string) => {
    try {
      const lines = text.split(/\r?\n/);
      const itemsMap = new Map<string, LabelItem>();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('Produto')) continue;

        const row = parseCSVLine(line);
        const codigo = row[1]?.trim();
        const produtoRaw = row[2]?.trim();
        const unidade = row[4]?.trim();

        if (codigo && produtoRaw) {
          if (itemsMap.has(codigo)) {
            const existing = itemsMap.get(codigo)!;
            // Evitar duplicar o mesmo nome se ele aparecer em várias linhas (lotes)
            if (!existing.produto.includes(produtoRaw)) {
              existing.produto = `${existing.produto} ${produtoRaw}`.trim();
              existing.produtoFormatado = applyTallMan(existing.produto);
            }
            if (unidade && !existing.unidade) {
              existing.unidade = unidade;
            }
          } else {
            itemsMap.set(codigo, {
              id: `${codigo}-${i}`,
              codigo: codigo,
              produto: produtoRaw,
              unidade: unidade || '',
              produtoFormatado: applyTallMan(produtoRaw)
            });
          }
        }
      }

      const parsedData = Array.from(itemsMap.values());

      if (parsedData.length === 0) {
        throw new Error('Nenhum produto válido encontrado no arquivo.');
      }

      setData(parsedData.sort((a, b) => a.produto.localeCompare(b.produto)));
      setError('');
    } catch (err: any) {
      setError(err.message || 'Erro ao processar arquivo CSV.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        processCSV(event.target?.result as string);
      };
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
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        processCSV(event.target?.result as string);
      };
      reader.readAsText(file, 'ISO-8859-1');
    } else {
      setError('Por favor, arraste um arquivo CSV válido.');
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const margin = 12; // Margem um pouco maior para segurança
    const cols = 2;
    const rowsPerPage = 5; // Forçar 5 linhas por página para evitar cortes
    const gapX = 8;
    const gapY = 6;
    
    const labelWidth = (pageWidth - (margin * 2) - gapX) / cols;
    const labelHeight = (pageHeight - (margin * 2) - (gapY * (rowsPerPage - 1))) / rowsPerPage;
    const padding = 5;

    const filteredData = data.filter(item => 
      item.produto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.codigo.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filteredData.forEach((item, index) => {
      const itemsPerPage = cols * rowsPerPage;
      const pageIndex = Math.floor(index / itemsPerPage);
      const itemInPageIndex = index % itemsPerPage;
      const col = itemInPageIndex % cols;
      const row = Math.floor(itemInPageIndex / cols);

      if (index > 0 && itemInPageIndex === 0) {
        doc.addPage();
      }

      // Desenhar guias de corte na página (apenas uma vez por página)
      if (itemInPageIndex === 0) {
        doc.setDrawColor(220, 220, 220); // Cinza claro
        doc.setLineWidth(0.1);
        
        // Linhas verticais de guia
        [margin, margin + labelWidth, margin + labelWidth + gapX, margin + 2 * labelWidth + gapX].forEach(lx => {
          doc.line(lx, 0, lx, pageHeight);
        });

        // Linhas horizontais de guia
        for (let r = 0; r < rowsPerPage; r++) {
          const yTop = margin + r * (labelHeight + gapY);
          const yBottom = yTop + labelHeight;
          doc.line(0, yTop, pageWidth, yTop);
          doc.line(0, yBottom, pageWidth, yBottom);
        }
      }

      const x = margin + (col * (labelWidth + gapX));
      const y = margin + (row * (labelHeight + gapY));

      // Fundo Preto
      doc.setFillColor(0, 0, 0);
      doc.rect(x, y, labelWidth, labelHeight, 'F');

      // Texto Branco
      doc.setTextColor(255, 255, 255);
      
      // Código (Canto superior esquerdo)
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(`CÓD: ${item.codigo}`, x + padding, y + padding + 1);

      // Unidade (Canto superior direito)
      const unitText = item.unidade;
      const unitWidth = doc.getTextWidth(unitText);
      doc.text(unitText, x + labelWidth - unitWidth - padding, y + padding + 1);

      // Nome do Produto (Centralizado)
      let fontSize = 14;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize);
      
      let splitTitle = doc.splitTextToSize(item.produtoFormatado, labelWidth - (padding * 2));
      
      // Ajuste dinâmico de fonte
      while ((splitTitle.length * (fontSize * 0.6) > labelHeight - 15) && fontSize > 7) {
        fontSize -= 0.5;
        doc.setFontSize(fontSize);
        splitTitle = doc.splitTextToSize(item.produtoFormatado, labelWidth - (padding * 2));
      }
      
      // Centralizar verticalmente o título
      const lineHeight = fontSize * 0.6;
      const titleHeight = splitTitle.length * lineHeight;
      const titleY = y + (labelHeight / 2) - (titleHeight / 2) + (lineHeight / 2);
      
      doc.text(splitTitle, x + (labelWidth / 2), titleY, { align: 'center' });

      // Rodapé LASA
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text('IDENTIFICAÇÃO DE PRATELEIRA - PADRÃO LASA', x + (labelWidth / 2), y + labelHeight - 2, { align: 'center' });
    });

    doc.save('etiquetas_prateleira_lasa.pdf');
  };

  const exportRollPDF = () => {
    // Usar o construtor com argumentos posicionais para maior compatibilidade com tamanhos customizados
    // 'l' para landscape pois 33 > 22
    const doc = new jsPDF('l', 'mm', [33, 22]);

    const filteredData = data.filter(item => 
      item.produto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.codigo.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filteredData.forEach((item, index) => {
      if (index > 0) {
        doc.addPage([33, 22], 'l');
      }

      // Obter dimensões reais da página atual para garantir cobertura total
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const padding = 1.5;

      // Fundo Preto - Cobrindo 100% da página independente de margens
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      // Texto Branco
      doc.setTextColor(255, 255, 255);
      
      // Código (Canto superior esquerdo)
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text(`CÓD: ${item.codigo}`, padding, 4);

      // Unidade (Canto superior direito)
      const unitText = item.unidade;
      doc.setFontSize(6);
      const unitWidth = doc.getTextWidth(unitText);
      doc.text(unitText, pageWidth - unitWidth - padding, 4);

      // Nome do Produto (Centralizado)
      let fontSize = 11;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize);
      
      let splitTitle = doc.splitTextToSize(item.produtoFormatado, pageWidth - (padding * 2));
      
      // Cálculo de altura (1pt = 0.3527mm)
      const getTitleHeight = (fSize: number, lines: string[]) => lines.length * (fSize * 0.3527 * 1.2);

      while (getTitleHeight(fontSize, splitTitle) > (pageHeight - 8) && fontSize > 6) {
        fontSize -= 0.5;
        doc.setFontSize(fontSize);
        splitTitle = doc.splitTextToSize(item.produtoFormatado, pageWidth - (padding * 2));
      }
      
      const titleHeight = getTitleHeight(fontSize, splitTitle);
      const titleY = (pageHeight / 2) - (titleHeight / 2) + (fontSize * 0.3527);
      
      doc.text(splitTitle, pageWidth / 2, titleY, { align: 'center' });

      // Rodapé LASA
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.text('PADRÃO LASA', pageWidth / 2, pageHeight - 1.5, { align: 'center' });
    });

    doc.save('etiquetas_rolo_33x22.pdf');
  };

  const filteredData = data.filter(item => 
    item.produto.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Tag className="text-purple-600" />
              Gerador de Etiquetas de Prateleira (LASA)
            </h2>
            <p className="text-slate-500">Gere etiquetas com fundo preto e Tall Man Lettering para identificação segura.</p>
          </div>
          {data.length > 0 && (
            <div className="flex gap-2">
              <button 
                onClick={() => setData([])}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-all border border-red-100"
              >
                <Trash2 size={18} />
                Limpar
              </button>
              <button 
                onClick={exportPDF}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all border border-slate-200"
              >
                <Printer size={18} />
                Folha A4
              </button>
              <button 
                onClick={exportRollPDF}
                className="flex items-center gap-2 px-6 py-2 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-700 transition-all shadow-lg shadow-purple-200"
              >
                <Printer size={18} />
                Etiqueta Rolo (33x22mm)
              </button>
            </div>
          )}
        </div>

        {data.length === 0 ? (
          <div 
            className={`border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer
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
            <h3 className="text-lg font-bold text-slate-700 mb-1">Importe o CSV de Produtos</h3>
            <p className="text-slate-500 text-sm">Arraste ou clique para selecionar o arquivo</p>
            {error && (
              <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-100 text-sm">
                <AlertTriangle size={16} />
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                type="text"
                placeholder="Pesquisar produto para etiqueta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredData.map((item) => (
                <div key={item.id} className="bg-black p-4 rounded-lg border border-slate-800 flex flex-col justify-between h-32 relative overflow-hidden">
                  <div className="flex justify-between items-start z-10">
                    <span className="text-[10px] text-slate-400 font-mono">CÓD: {item.codigo}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{item.unidade}</span>
                  </div>
                  
                  <div className="flex-1 flex items-center justify-center z-10">
                    <h3 className="text-white font-bold text-center text-lg leading-tight">
                      {item.produtoFormatado}
                    </h3>
                  </div>

                  <div className="text-[8px] text-slate-600 text-center uppercase tracking-widest z-10">
                    Padrão LASA
                  </div>

                  {/* Efeito de brilho sutil */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent opacity-20"></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-3">
        <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
        <div className="text-sm text-amber-800">
          <p className="font-bold mb-1">Sobre o Padrão LASA (Tall Man Lettering):</p>
          <p>As etiquetas utilizam letras maiúsculas em partes específicas dos nomes para diferenciar medicamentos com grafia ou som semelhantes, reduzindo erros de seleção na prateleira. O fundo preto com letra branca garante alto contraste para leitura em ambientes de farmácia.</p>
        </div>
      </div>
    </div>
  );
}
