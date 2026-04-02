import React, { useState, useRef } from 'react';
import { 
  UploadCloud, Printer, Trash2, FileText, FileSpreadsheet, 
  Info, Download, Save, Loader2, Table, Camera, 
  CheckCircle, AlertTriangle, Image as ImageIcon, X, Zap 
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function FichaContagemTab({ user }: { user: any }) {
  const [activeTab, setActiveTab] = useState('gerar');
  const [data, setData] = useState<any[]>([]);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [auditResults, setAuditResults] = useState<any[] | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const parseCSVLine = (text: string) => {
    let result = [];
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

  const processCSV = (text: string) => {
    try {
      const lines = text.split(/\r?\n/);
      const parsedData = [];
      let currentCode = '';
      let currentDesc = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const row = parseCSVLine(line);
        if (row.length < 8) continue;

        let code = row[1]?.trim();
        let desc = row[2]?.trim();

        if (
          row[0]?.toLowerCase().includes('produto') ||
          code?.toLowerCase() === 'produto' ||
          line.toLowerCase().includes('estoque atual') ||
          line.toLowerCase().includes('total')
        ) {
          continue;
        }

        let lote = row[8]?.trim();
        let validade = row[10]?.trim();
        let estoque = row[18]?.trim() || '0,000'; 

        if (lote === '-' || lote === '--' || lote === '.') lote = '';
        if (validade === '-' || validade === '--' || validade === '.') validade = '';

        if (code && code !== '') {
          currentCode = code;
          currentDesc = desc;

          parsedData.push({
            id: i,
            codigo: currentCode,
            descricao: currentDesc,
            lote: lote || '_______________',
            validade: validade || '___/___/_____',
            estoque: estoque
          });
        } 
        else if (!code && lote) {
          parsedData.push({
            id: i,
            codigo: currentCode,
            descricao: currentDesc,
            lote: lote,
            validade: validade || '___/___/_____',
            estoque: estoque
          });
        }
      }

      if (parsedData.length === 0) {
        setError('Nenhum dado válido encontrado. Verifique se o formato do CSV está correto.');
      } else {
        setData(parsedData);
        setError('');
        setAuditResults(null);
        setImages([]);
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao processar o arquivo CSV.');
    }
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => processCSV(event.target?.result as string);
      reader.readAsText(file, 'ISO-8859-1');
    } else {
      setError('Por favor, envie um arquivo .csv válido.');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    Promise.all(files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = (event.target?.result as string).split(',')[1];
          resolve({ 
            id: Math.random().toString(36).substr(2, 9),
            mimeType: file.type, 
            data: base64, 
            preview: event.target?.result as string,
            name: file.name
          });
        };
        reader.readAsDataURL(file);
      });
    })).then(newImages => {
      setImages(prev => [...prev, ...newImages]);
      setAuditResults(null); 
    });
  };

  const removeImage = (idToRemove: string) => {
    setImages(images.filter(img => img.id !== idToRemove));
    setAuditResults(null);
  };

  const analisarComIA = async () => {
    if (images.length === 0) {
      setError("Por favor, adicione pelo menos uma foto das fichas preenchidas.");
      return;
    }
    setIsAnalyzing(true);
    setError('');

    try {
      // Use environment API key if available, otherwise empty string as provided
      const apiKey = process.env.GEMINI_API_KEY || "";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

      const prompt = `
        Você é um assistente de auditoria de estoque hospitalar especializado em visão computacional.
        Analise estas imagens anexadas que são fotos ou digitalizações de fichas de contagem física.
        A tabela possui as colunas 'Código', 'Descrição do Produto', 'Lote', 'Validade' e 'Contagem Física'.
        
        Sua tarefa: Extrair o número manuscrito (ou digitado) na coluna 'Contagem Física' para cada produto listado nas imagens.
        Seja preciso. Se uma caixa de contagem física estiver completamente em branco, rabiscada ou ilegível, retorne null para ela.
        
        Retorne estritamente um JSON no seguinte formato:
        [
          {
            "codigo": "187",
            "lote": "50028075",
            "contagem": 55
          }
        ]
      `;

      const parts: any[] = [{ text: prompt }];
      images.forEach(img => {
        parts.push({
          inlineData: { mimeType: img.mimeType, data: img.data }
        });
      });

      const payload = {
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                codigo: { type: "STRING" },
                lote: { type: "STRING" },
                contagem: { type: "NUMBER", nullable: true }
              }
            }
          }
        }
      };

      const fetchWithBackoff = async (retries = 5, delay = 1000) => {
        for (let i = 0; i < retries; i++) {
          try {
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
            return await res.json();
          } catch (e) {
            if (i === retries - 1) throw e;
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
          }
        }
      };

      const result = await fetchWithBackoff();
      let textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResponse) throw new Error("Resposta em branco da IA.");
      
      textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      const aiData = JSON.parse(textResponse);

      const matchedResults = data.map(item => {
        const found = aiData.find((ai: any) => 
          ai.codigo === item.codigo && 
          ai.lote?.replace(/\s/g, '') === item.lote?.replace(/\s/g, '')
        );
        
        const contagemFisica = found && found.contagem !== undefined && found.contagem !== null ? found.contagem : null;
        const sistemaFormatado = parseFloat(item.estoque.replace(/\./g, '').replace(',', '.')) || 0;
        
        let diferenca = 0;
        let status = 'pendente';

        if (contagemFisica !== null) {
          diferenca = contagemFisica - sistemaFormatado;
          status = diferenca === 0 ? 'ok' : 'divergente';
        }

        return {
          ...item,
          estoqueSistema: sistemaFormatado,
          contagemFisica: contagemFisica,
          diferenca: diferenca,
          status: status
        };
      });

      matchedResults.sort((a, b) => {
        if (a.status === 'divergente' && b.status !== 'divergente') return -1;
        if (a.status !== 'divergente' && b.status === 'divergente') return 1;
        return 0;
      });

      setAuditResults(matchedResults);
      setError('');

    } catch (err) {
      console.error(err);
      setError("Houve uma falha ao comunicar com a Inteligência Artificial. Verifique as fotos e tente novamente.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePrint = () => { window.print(); };

  const handleExportPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text("FICHA DE CONTAGEM FÍSICA", 105, 15, { align: "center" });

      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');

      doc.text("Data: _____ / _____ / _______", 14, 25);
      doc.text("Horário: _______ : _______", 196, 25, { align: "right" });

      autoTable(doc, {
        startY: 32,
        head: [['Código', 'Descrição do Produto', 'Lote', 'Validade', 'Contagem Física']],
        body: data.map(item => [
            item.codigo,
            item.descricao,
            `${item.lote}\n[   ] Conf.    [   ] Não conf.`,
            `${item.validade}\n[   ] Conf.    [   ] Não conf.`,
            '' 
        ]),
        styles: { fontSize: 7, valign: 'middle', cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { cellWidth: 15, halign: 'center' },
          1: { cellWidth: 70 },
          2: { cellWidth: 40 },
          3: { cellWidth: 40 },
          4: { cellWidth: 25 }
        },
        theme: 'grid',
        margin: { top: 15, right: 10, bottom: 20, left: 10 }
      });

      let finalY = (doc as any).lastAutoTable.finalY || 40;
      if (finalY + 40 > 280) { 
        doc.addPage();
        finalY = 20;
      } else {
        finalY += 20; 
      }

      const drawSignatureField = (title: string, x: number, y: number) => {
         doc.line(x, y, x + 70, y);
         doc.text(title, x + 35, y + 4, { align: "center" });
      };

      drawSignatureField("Colaborador CAF", 20, finalY);
      drawSignatureField("Farmacêutico", 120, finalY);

      doc.save(`Ficha_Contagem_${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Ocorreu um erro ao gerar o PDF. Tente novamente.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleExportWord = () => {
    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Ficha de Contagem</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; }
        .title { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
        .divider { border-bottom: 2px solid #1f2937; margin-bottom: 12px; }
        .info-table { width: 100%; margin-bottom: 15px; border: none; font-size: 12px; font-weight: bold; color: #374151; }
        .info-table td { border: none; padding: 2px; }
        .main-table { width: 100%; border-collapse: collapse; }
        .main-table th, .main-table td { border: 1px solid #374151; padding: 5px 6px; text-align: left; vertical-align: middle; font-size: 11px; }
        .main-table th { background-color: #f3f4f6; font-weight: bold; color: #374151; font-size: 12px; }
        .main-table th.center { text-align: center; }
        .signatures { width: 100%; margin-top: 50px; text-align: center; border: none; font-size: 12px; }
        .signatures td { border: none; padding-top: 50px; }
        .sig-line { border-top: 1px solid #1f2937; width: 70%; margin: 0 auto; padding-top: 5px; }
      </style>
      </head><body>
    `;

    let body = `
      <div class="title">Ficha de Contagem Física</div>
      <div class="divider"></div>
      <table class="info-table">
        <tr>
          <td>Data: <span style="font-weight: normal;">_____ / _____ / _______</span></td>
          <td style="text-align: right;">Horário: <span style="font-weight: normal;">_______ : _______</span></td>
        </tr>
      </table>
      <table class="main-table">
        <thead>
          <tr>
            <th width="12%" class="center">Código</th>
            <th width="35%">Descrição do Produto</th>
            <th width="20%">Lote</th>
            <th width="20%">Validade</th>
            <th width="13%" class="center" style="background-color: #eff6ff; color: #1e40af;">Contagem Física</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.forEach((item, index) => {
      let bgColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
      body += `
        <tr bgcolor="${bgColor}">
          <td class="center">${item.codigo}</td>
          <td style="font-weight: bold; color: #111827;">${item.descricao}</td>
          <td>
            <span style="font-weight: bold; color: #111827; font-size: 12px;">${item.lote}</span><br>
            <span style="font-size: 10px; color: #4b5563;">&#9744; Conf. &nbsp;&nbsp;&nbsp; &#9744; Não conf.</span>
          </td>
          <td>
            <span style="font-weight: bold; color: #111827; font-size: 12px;">${item.validade}</span><br>
            <span style="font-size: 10px; color: #4b5563;">&#9744; Conf. &nbsp;&nbsp;&nbsp; &#9744; Não conf.</span>
          </td>
          <td style="height: 35px;"></td>
        </tr>
      `;
    });

    body += `
        </tbody>
      </table>
      <table class="signatures">
        <tr>
          <td><div class="sig-line">Colaborador CAF</div></td>
          <td><div class="sig-line">Farmacêutico</div></td>
        </tr>
      </table>
      </body></html>
    `;

    const sourceHTML = header + body;
    const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ficha_Contagem_${new Date().getTime()}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    const header = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Ficha de Contagem</x:Name>
                <x:WorksheetOptions>
                  <x:Print>
                    <x:ValidPrinterInfo/>
                    <x:PaperSizeIndex>9</x:PaperSizeIndex>
                    <x:HorizontalResolution>600</x:HorizontalResolution>
                    <x:VerticalResolution>600</x:VerticalResolution>
                    <x:FitWidth>1</x:FitWidth>
                    <x:FitHeight>999</x:FitHeight>
                  </x:Print>
                  <x:Selected/>
                  <x:DoNotDisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          .table-border { border-collapse: collapse; }
          .table-border th, .table-border td { border: 1px solid black; padding: 6px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; vertical-align: middle; }
          .header-cell { background-color: #f3f4f6; font-weight: bold; text-align: center; font-size: 12px; }
          .title-cell { font-size: 20px; font-weight: bold; text-align: center; border: none; letter-spacing: 1px; }
          .info-cell { font-size: 12px; font-weight: bold; border: none; padding-bottom: 15px;}
          .sig-cell { border-top: 1px solid black; text-align: center; font-weight: bold; font-size: 12px; border-bottom: none; border-left: none; border-right: none; }
        </style>
      </head>
      <body>
    `;

    let body = `
      <table>
        <tr>
          <td colspan="5" class="title-cell">FICHA DE CONTAGEM FÍSICA</td>
        </tr>
        <tr><td colspan="5" style="border:none;"></td></tr>
        <tr>
          <td colspan="3" class="info-cell">Data: <span style="font-weight: normal;">_____ / _____ / _______</span></td>
          <td colspan="2" class="info-cell" style="text-align: right;">Horário: <span style="font-weight: normal;">_______ : _______</span></td>
        </tr>
      </table>
      <table class="table-border">
        <thead>
          <tr>
            <th class="header-cell" style="width: 70px;">Código</th>
            <th class="header-cell" style="width: 320px;">Descrição do Produto</th>
            <th class="header-cell" style="width: 140px;">Lote</th>
            <th class="header-cell" style="width: 140px;">Validade</th>
            <th class="header-cell" style="width: 120px; background-color: #eff6ff; color: #1e40af;">Contagem Física</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.forEach((item, index) => {
      let bgColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
      body += `
        <tr style="background-color: ${bgColor};">
          <td style="text-align: center;">${item.codigo}</td>
          <td style="font-weight: bold; color: #111827;">${item.descricao}</td>
          <td>
            <b style="font-size: 12px;">${item.lote}</b><br>
            <span style="font-size: 10px; color: #4b5563;">&#9744; Conf.   &#9744; Não conf.</span>
          </td>
          <td>
            <b style="font-size: 12px;">${item.validade}</b><br>
            <span style="font-size: 10px; color: #4b5563;">&#9744; Conf.   &#9744; Não conf.</span>
          </td>
          <td style="height: 35px;"></td>
        </tr>
      `;
    });

    body += `
        </tbody>
      </table>
      <br><br><br>
      <table style="width: 100%; text-align: center; border: none;">
        <tr>
          <td style="border:none; width: 15%;"></td>
          <td class="sig-cell" style="width: 30%;">Colaborador CAF</td>
          <td style="border:none; width: 10%;"></td>
          <td class="sig-cell" style="width: 30%;">Farmacêutico</td>
          <td style="border:none; width: 15%;"></td>
        </tr>
      </table>
      </body></html>
    `;

    const sourceHTML = header + body;
    const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ficha_Contagem_${new Date().getTime()}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setData([]);
    setFileName('');
    setError('');
    setImages([]);
    setAuditResults(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  return (
    <div className="min-h-full bg-gray-50 text-gray-800 font-sans">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        
        <header className="mb-6 print:hidden flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4 mb-4 md:mb-0">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Zap size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Estoque Inteligente</h1>
              <p className="text-sm text-gray-500">Gerador de Fichas e Auditoria de Contagem via IA</p>
            </div>
          </div>
          
          {data.length > 0 && (
            <div className="flex flex-wrap justify-end gap-3 mt-4 md:mt-0">
              <button onClick={handleClear} className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors font-medium">
                <Trash2 size={18} /> Limpar
              </button>
            </div>
          )}
        </header>

        {!data.length ? (
          <div className="print:hidden">
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex justify-center mb-4 text-blue-500">
                <UploadCloud size={48} />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Arraste e solte o arquivo CSV do sistema aqui</h3>
              <p className="text-gray-500 mb-6">para iniciar</p>
              <label className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm cursor-pointer inline-flex items-center justify-center">
                Selecionar Arquivo
                <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
              </label>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-center gap-3 rounded-r-lg">
                <Info size={20} /> <p>{error}</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex border-b border-gray-200 mb-6 print:hidden bg-white px-2 rounded-t-xl">
              <button
                onClick={() => setActiveTab('gerar')}
                className={`py-4 px-6 font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'gerar' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <FileText size={18} /> 1. Fichas de Contagem
              </button>
              <button
                onClick={() => setActiveTab('auditoria')}
                className={`py-4 px-6 font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'auditoria' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Camera size={18} /> 2. Auditoria com IA
                <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-bold ml-1">Beta</span>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-center gap-3 rounded-r-lg print:hidden">
                <Info size={20} /> <p>{error}</p>
              </div>
            )}

            {activeTab === 'gerar' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 print:shadow-none print:border-none print:m-0 print:p-0">
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap justify-between items-center print:hidden rounded-t-xl gap-4">
                  <div className="flex items-center gap-2 text-gray-600">
                    <FileSpreadsheet size={18} />
                    <span className="font-medium">Base de Dados:</span> {fileName} ({data.length} lotes)
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleExportExcel} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors shadow-sm">
                      <Table size={16} /> Excel (A4)
                    </button>
                    <button onClick={handleExportWord} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors shadow-sm">
                      <Download size={16} /> Word
                    </button>
                    <button 
                      onClick={handleExportPDF} 
                      disabled={isGeneratingPDF}
                      className="flex items-center gap-2 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm rounded transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isGeneratingPDF ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      {isGeneratingPDF ? 'A Gerar...' : 'Exportar PDF'}
                    </button>
                    <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-800 text-white text-sm rounded transition-colors shadow-sm">
                      <Printer size={16} /> Imprimir
                    </button>
                  </div>
                </div>
                
                <div className="hidden print:block mb-4 border-b-2 border-gray-800 pb-2 pt-4">
                  <h2 className="text-xl font-bold text-center uppercase tracking-wider mb-2">Ficha de Contagem Física</h2>
                  <div className="flex justify-between text-sm mt-4 font-semibold px-2">
                    <span className="text-gray-900">Data: _____ / _____ / _______</span>
                    <span className="text-gray-900">Horário: _______ : _______</span>
                  </div>
                </div>

                <div className="p-4 print:p-0 print:mt-4">
                  <div className="overflow-x-auto print:overflow-visible">
                    <table className="w-full text-left text-xs border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100 text-gray-700 print:bg-gray-200">
                          <th className="p-2 border border-gray-300 print:border-gray-800 font-bold w-16 text-center">Código</th>
                          <th className="p-2 border border-gray-300 print:border-gray-800 font-bold min-w-[200px]">Descrição do Produto</th>
                          <th className="p-2 border border-gray-300 print:border-gray-800 font-bold w-36">Lote</th>
                          <th className="p-2 border border-gray-300 print:border-gray-800 font-bold w-36">Validade</th>
                          <th className="p-2 border border-gray-300 print:border-gray-800 font-bold w-32 text-center text-blue-800 print:text-black bg-blue-50 print:bg-transparent">
                            Contagem Física
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((item, index) => (
                          <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50 print:bg-transparent'}`}>
                            <td className="p-2 border border-gray-300 print:border-gray-800 text-gray-900 align-middle text-center">{item.codigo}</td>
                            <td className="p-2 border border-gray-300 print:border-gray-800 text-gray-900 font-semibold align-middle">{item.descricao}</td>
                            <td className="p-2 border border-gray-300 print:border-gray-800 text-gray-600 align-middle">
                              <div className="font-bold text-gray-900 mb-1">{item.lote}</div>
                              <div className="flex flex-row gap-3 text-[10px] text-gray-700 print:text-black font-medium mt-2">
                                <span className="flex items-center gap-1"><div className="w-3 h-3 border border-gray-500 print:border-black bg-white"></div> Conf.</span>
                                <span className="flex items-center gap-1"><div className="w-3 h-3 border border-gray-500 print:border-black bg-white"></div> Não conf.</span>
                              </div>
                            </td>
                            <td className="p-2 border border-gray-300 print:border-gray-800 text-gray-600 align-middle">
                              <div className="font-bold text-gray-900 mb-1">{item.validade}</div>
                              <div className="flex flex-row gap-3 text-[10px] text-gray-700 print:text-black font-medium mt-2">
                                <span className="flex items-center gap-1"><div className="w-3 h-3 border border-gray-500 print:border-black bg-white"></div> Conf.</span>
                                <span className="flex items-center gap-1"><div className="w-3 h-3 border border-gray-500 print:border-black bg-white"></div> Não conf.</span>
                              </div>
                            </td>
                            <td className="p-2 border border-gray-300 print:border-gray-800 bg-blue-50/30 print:bg-transparent align-middle">
                              <div className="w-full h-full min-h-[35px]"></div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="hidden print:block mt-8 text-sm break-inside-avoid">
                  <div className="grid grid-cols-2 gap-y-16 gap-x-8 mt-12 text-center font-semibold">
                    <div>
                      <div className="border-t border-gray-800 mx-8 pt-2">Colaborador CAF</div>
                    </div>
                    <div>
                      <div className="border-t border-gray-800 mx-8 pt-2">Farmacêutico</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'auditoria' && (
              <div className="space-y-6 print:hidden">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-100">
                  <h3 className="text-lg font-bold text-indigo-900 mb-2 flex items-center gap-2">
                    <ImageIcon size={20} /> Processamento de Fotos
                  </h3>
                  <p className="text-gray-600 mb-4 text-sm">
                    Tire fotos ou digitalize as fichas que a equipa preencheu à mão e adicione aqui. A IA vai ler as quantidades manuscritas e cruzar com o stock atual do sistema ({data.length} lotes carregados).
                  </p>
                  
                  <div className="flex flex-wrap gap-4 mb-4">
                    {images.map(img => (
                      <div key={img.id} className="relative w-32 h-40 rounded-lg overflow-hidden border border-gray-200 shadow-sm group">
                        <img src={img.preview} alt="Upload" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => removeImage(img.id)}
                          className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    
                    <label className="w-32 h-40 border-2 border-dashed border-indigo-300 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors text-indigo-500 hover:text-indigo-600">
                      <Camera size={28} className="mb-2" />
                      <span className="text-xs font-semibold px-2 text-center">Adicionar Foto</span>
                      <input type="file" accept="image/*" multiple className="hidden" ref={imageInputRef} onChange={handleImageUpload} />
                    </label>
                  </div>

                  {images.length > 0 && !auditResults && (
                    <button
                      onClick={analisarComIA}
                      disabled={isAnalyzing}
                      className="w-full md:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-semibold shadow-md flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isAnalyzing ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} />}
                      {isAnalyzing ? 'Lendo Caligrafia e Processando Dados...' : 'Analisar Contagens com IA'}
                    </button>
                  )}
                </div>

                {auditResults && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-indigo-50 p-4 border-b border-indigo-100 flex justify-between items-center">
                      <h3 className="font-bold text-indigo-900 text-lg">Relatório de Divergências</h3>
                      <div className="flex gap-4 text-sm font-medium">
                        <span className="text-green-600 flex items-center gap-1"><CheckCircle size={16}/> {auditResults.filter(r => r.status === 'ok').length} Bateram</span>
                        <span className="text-red-600 flex items-center gap-1"><AlertTriangle size={16}/> {auditResults.filter(r => r.status === 'divergente').length} Divergências</span>
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto p-4">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="border-b-2 border-gray-200 text-gray-600">
                            <th className="pb-2 font-semibold w-16">Status</th>
                            <th className="pb-2 font-semibold">Produto</th>
                            <th className="pb-2 font-semibold">Lote</th>
                            <th className="pb-2 font-semibold text-center text-gray-500">Stock Sist.</th>
                            <th className="pb-2 font-semibold text-center text-blue-600">Físico (IA)</th>
                            <th className="pb-2 font-semibold text-center">Diferença</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditResults.map((item, idx) => (
                            <tr key={idx} className={`border-b border-gray-100 ${item.status === 'divergente' ? 'bg-red-50/30' : ''} hover:bg-gray-50`}>
                              <td className="p-3">
                                {item.status === 'ok' && <CheckCircle className="text-green-500" size={20} />}
                                {item.status === 'divergente' && <AlertTriangle className="text-red-500" size={20} />}
                                {item.status === 'pendente' && <span className="text-gray-400 text-xs font-bold uppercase">Sem dado</span>}
                              </td>
                              <td className="p-3">
                                <span className="text-xs text-gray-500 block">{item.codigo}</span>
                                <span className="font-medium text-gray-900">{item.descricao}</span>
                              </td>
                              <td className="p-3 font-medium text-gray-600">{item.lote}</td>
                              <td className="p-3 text-center text-gray-500">{item.estoqueSistema}</td>
                              <td className="p-3 text-center font-bold text-blue-700 text-base">
                                {item.contagemFisica !== null ? item.contagemFisica : '-'}
                              </td>
                              <td className="p-3 text-center">
                                {item.status === 'divergente' && (
                                  <span className={`px-2 py-1 rounded font-bold text-xs ${item.diferenca < 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                    {item.diferenca > 0 ? '+' : ''}{item.diferenca}
                                  </span>
                                )}
                                {item.status === 'ok' && <span className="text-green-500 font-bold">-</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body {
            background-color: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact;
          }
          @page {
            size: A4 portrait;
            margin: 1.5cm;
          }
        }
      `}} />
    </div>
  );
}
