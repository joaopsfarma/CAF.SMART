import React, { useState, useMemo } from 'react';
import { FileText, AlertTriangle, CheckCircle, Download, Settings, Box, ArrowRightLeft, Activity, Printer, Loader2, ClipboardCheck, CheckSquare } from 'lucide-react';

// --- Funções Auxiliares de Parsing à Prova de Falhas ---

const detectDelimiter = (text: string) => {
  const sample = text.slice(0, 1000);
  const semiCount = (sample.match(/;/g) || []).length;
  const commaCount = (sample.match(/,/g) || []).length;
  return semiCount > commaCount ? ';' : ',';
};

const parseCSVLine = (line: string, delimiter = ',') => {
  const result = [];
  let start = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQuotes = !inQuotes;
    if (line[i] === delimiter && !inQuotes) {
      result.push(line.substring(start, i).replace(/^"|"$/g, '').trim());
      start = i + 1;
    }
  }
  result.push(line.substring(start).replace(/^"|"$/g, '').trim());
  return result;
};

const parseBRNum = (str: any) => {
  if (!str) return 0;
  const clean = str.toString().replace(/"/g, '').trim();
  if (clean === '') return 0;
  const enStr = clean.replace(/\./g, '').replace(',', '.');
  return parseFloat(enStr) || 0;
};

const cleanId = (str: string) => str ? str.replace(/^0+/, '').trim() : null;

const parseDate = (dateStr: string) => {
  if (!dateStr) return new Date(9999, 11, 31);
  const parts = dateStr.split('/');
  if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  return new Date(9999, 11, 31);
};

export default function FracionamentoTab() {
  const [files, setFiles] = useState<Record<string, File | null>>({ caf: null, destino: null, consumo: null, transferencias: null });
  const [diasMinimo, setDiasMinimo] = useState(2); 
  const [diasReposicao, setDiasReposicao] = useState(5); 
  
  const [searchTerm, setSearchTerm] = useState('');
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const [abaAtiva, setAbaAtiva] = useState('analise');

  // Estados para edições manuais nas duas abas
  const [fracionamentosManuais, setFracionamentosManuais] = useState<Record<string, number>>({});
  const [qtdLotesSeparacao, setQtdLotesSeparacao] = useState<Record<string, number>>({});

  // Estados dos dados processados
  const [dadosCaf, setDadosCaf] = useState<Record<string, any>>({});
  const [dadosDestino, setDadosDestino] = useState<Record<string, any>>({});
  const [dadosConsumo, setDadosConsumo] = useState<any[]>([]);
  const [dadosTransf, setDadosTransf] = useState<Record<string, number>>({});

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFiles(prev => ({ ...prev, [type]: file }));
    setMostrarResultados(false); 

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string).replace(/^\uFEFF/, '').replace(/\r/g, '');
      processData(text, type);
    };
    reader.readAsText(file, 'latin1'); 
  };

  const processData = (text: string, type: string) => {
    const delimiter = detectDelimiter(text);
    const lines = text.split('\n').filter(line => line.trim() !== '');
    
    if (type === 'consumo') {
      const parsed = [];
      let mediaIdx = -1;
      
      for (let i = 0; i < Math.min(10, lines.length); i++) {
         const header = parseCSVLine(lines[i], delimiter).map(h => h.toLowerCase());
         const found = header.findIndex(h => h === 'média' || h === 'media' || h.includes('méd'));
         if (found !== -1) { mediaIdx = found; break; }
      }

      for (let i = 0; i < lines.length; i++) {
        const row = parseCSVLine(lines[i], delimiter);
        let idStr = null;
        let nomeStr = null;
        
        for (let j = 0; j < 4; j++) {
            if (row[j] && /^\d+$/.test(row[j].trim())) {
                idStr = cleanId(row[j]);
                nomeStr = row[j+1] ? row[j+1].trim() : '';
                break;
            }
        }

        if (idStr) {
          let media = 0;
          if (mediaIdx !== -1 && row[mediaIdx]) {
              media = parseBRNum(row[mediaIdx]);
          } else {
              for (let j = row.length - 1; j >= 0; j--) {
                  const cell = row[j] ? row[j].trim() : '';
                  if (cell !== '' && /^-?\d+(?:[.,]\d+)?$/.test(cell)) {
                      media = parseBRNum(cell);
                      break;
                  }
              }
          }
          if (media > 0 || (nomeStr && nomeStr.length > 2)) {
             parsed.push({ id: idStr, nome: nomeStr, mediaDia: media });
          }
        }
      }
      setDadosConsumo(parsed);
    } 
    else if (type === 'transferencias') {
      const parsed: Record<string, number> = {};
      let qtdIdx = 5; 
      
      for (let i = 0; i < Math.min(10, lines.length); i++) {
         const header = parseCSVLine(lines[i], delimiter).map(h => h.toLowerCase());
         const found = header.findIndex(h => h === 'qtd' || h === 'quantidade');
         if (found !== -1) { qtdIdx = found; break; }
      }

      for (let i = 0; i < lines.length; i++) {
        const row = parseCSVLine(lines[i], delimiter);
        let idStr = null;
        
        for (let j = 0; j < 4; j++) {
            if (row[j] && /^\d+$/.test(row[j].trim())) {
                idStr = cleanId(row[j]);
                break;
            }
        }

        if (idStr && row[qtdIdx]) {
          const qtd = parseBRNum(row[qtdIdx]);
          if (!parsed[idStr]) parsed[idStr] = 0;
          parsed[idStr] += qtd;
        }
      }
      setDadosTransf(parsed);
    }
    else if (type === 'caf' || type === 'destino') {
      const parsed: Record<string, any> = {};
      let currentId: string | null = null;

      for (let i = 0; i < lines.length; i++) {
        const row = parseCSVLine(lines[i], delimiter);
        let idStr = null;
        let nomeStr = null;
        
        for (let j = 0; j < 4; j++) {
            if (row[j] && /^\d+$/.test(row[j].trim())) {
                idStr = cleanId(row[j]);
                nomeStr = row[j+1] ? row[j+1].trim() : '';
                break;
            }
        }

        if (idStr) {
          currentId = idStr;
          let estoqueGeral = 0;
          
          for (let j = 2; j < row.length; j++) {
             const cell = row[j] ? row[j].trim() : '';
             if (cell !== '' && /^-?\d+(?:[.,]\d+)?$/.test(cell)) {
                 estoqueGeral = parseBRNum(cell);
                 break; 
             }
          }

          if (!parsed[currentId]) {
              parsed[currentId] = { id: currentId, nome: nomeStr, estoqueTotal: estoqueGeral, lotes: [] };
          }
        }

        if (currentId) {
          const dateIdx = row.findIndex(cell => /^\d{2}\/\d{2}\/\d{4}$/.test(cell.trim()));
          
          if (dateIdx !== -1) {
            const validade = row[dateIdx].trim();
            const lote = (row[dateIdx - 1] || row[dateIdx - 2] || 'S/LOTE').trim();
            
            let qtdLote = 0;
            for (let j = row.length - 1; j > dateIdx; j--) {
              const cell = row[j] ? row[j].trim() : '';
              if (cell !== '' && /^-?\d+(?:[.,]\d+)?$/.test(cell)) {
                  qtdLote = parseBRNum(cell);
                  break;
              }
            }

            if (qtdLote > 0 || row.join('').includes(validade)) {
                const loteExiste = parsed[currentId].lotes.find((l: any) => l.lote === lote && l.validade === validade);
                if (!loteExiste) {
                     parsed[currentId].lotes.push({ lote, validade, qtd: qtdLote, dateObj: parseDate(validade) });
                }
            }
          }
        }
      }

      Object.keys(parsed).forEach(key => {
        parsed[key].lotes.sort((a: any, b: any) => a.dateObj - b.dateObj);
        const somaLotes = parsed[key].lotes.reduce((acc: number, curr: any) => acc + curr.qtd, 0);
        if (somaLotes > 0) parsed[key].estoqueTotal = somaLotes;
      });

      if (type === 'caf') setDadosCaf(parsed);
      if (type === 'destino') setDadosDestino(parsed);
    }
  };

  // --- Motor de Cálculo e Cruzamento ---
  const relatorioGerado = useMemo(() => {
    if (dadosConsumo.length === 0) return [];

    return dadosConsumo.map(item => {
      const media = item.mediaDia;
      
      const estoqueMinimo = Math.ceil(media * diasMinimo);
      const estoqueAlvo = Math.ceil(media * diasReposicao);
      
      const estoqueDestino = dadosDestino[item.id]?.estoqueTotal || 0;
      const transfEmAndamento = dadosTransf[item.id] || 0;
      const saldoRealDestino = Math.round(estoqueDestino + transfEmAndamento);
      
      // Modificado: Agora pré-carrega sempre com a Quantidade total do Alvo para todos os itens
      let aFracionarCalculado = estoqueAlvo;

      let aFracionar = Math.ceil(aFracionarCalculado);

      // Override Manual (Edição de Quantidade na Aba 1)
      if (fracionamentosManuais[item.id] !== undefined && !isNaN(fracionamentosManuais[item.id])) {
          aFracionar = fracionamentosManuais[item.id];
      }
      
      const estoqueCAF = dadosCaf[item.id]?.estoqueTotal || 0;
      let faltaNaCaf = 0;

      const lotesSugeridos = [];
      const lotesDisponiveisCaf = dadosCaf[item.id] ? dadosCaf[item.id].lotes : [];

      if (aFracionar > 0) {
        let qtdRestanteParaPegar = Math.ceil(aFracionar); 
        for (const lote of lotesDisponiveisCaf) {
          if (qtdRestanteParaPegar <= 0) break;
          
          if (lote.qtd > 0) {
            const pegarDesteLote = Math.min(qtdRestanteParaPegar, lote.qtd);
            lotesSugeridos.push({ lote: lote.lote, validade: lote.validade, qtd: pegarDesteLote });
            qtdRestanteParaPegar -= pegarDesteLote;
          }
        }
        
        if (qtdRestanteParaPegar > 0) {
          faltaNaCaf = qtdRestanteParaPegar;
        }
      } else {
        for (const lote of lotesDisponiveisCaf) {
          if (lote.qtd > 0) {
            lotesSugeridos.push({ lote: lote.lote, validade: lote.validade, qtd: lote.qtd });
          }
        }
      }

      return {
        id: item.id,
        nome: item.nome,
        media,
        estoqueMinimo,
        estoqueAlvo,
        estoqueDestino,
        transfEmAndamento,
        saldoRealDestino,
        estoqueCAF,
        aFracionar: Math.ceil(aFracionar),
        faltaNaCaf,
        lotesSugeridos
      };
    }).filter(item => {
       const matchSearch = item.nome.toLowerCase().includes(searchTerm.toLowerCase()) || item.id.includes(searchTerm);
       if (searchTerm) return matchSearch;
       return true; 
    }).sort((a, b) => {
       // Prioriza itens que atingiram o gatilho (estoque crítico) no topo da lista
       const aCritico = a.saldoRealDestino <= a.estoqueMinimo ? 1 : 0;
       const bCritico = b.saldoRealDestino <= b.estoqueMinimo ? 1 : 0;
       if (aCritico !== bCritico) return bCritico - aCritico;
       
       return b.aFracionar - a.aFracionar;
    });

  }, [dadosConsumo, dadosCaf, dadosDestino, dadosTransf, diasMinimo, diasReposicao, searchTerm, fracionamentosManuais]);

  const handleFracionamentoManual = (id: string, val: string) => {
    setFracionamentosManuais(prev => {
        const next = {...prev};
        if (val === '') {
            delete next[id];
        } else {
            next[id] = parseInt(val, 10);
        }
        return next;
    });
  };

  const handleQtdLoteSeparacao = (id: string, lote: string, val: string) => {
    const key = `${id}-${lote}`;
    setQtdLotesSeparacao(prev => {
        const next = {...prev};
        if (val === '') {
            delete next[key];
        } else {
            next[key] = parseInt(val, 10);
        }
        return next;
    });
  };

  const exportarPDF = async () => {
    setGerandoPdf(true);
    try {
      if (!(window as any).jspdf) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      if (!(window as any).jspdf.autoTable) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const { jsPDF } = (window as any).jspdf;
      
      // Se estiver na aba da ficha, formata o PDF como checklist de separação
      if (abaAtiva === 'separacao') {
         const doc = new jsPDF('l', 'mm', 'a4'); // Alterado para paisagem ('l')
         doc.setFontSize(16);
         doc.text("Ficha de Separacao e Fracionamento", 14, 15);
         doc.setFontSize(10);
         doc.setTextColor(100);
         doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 22);

         const tableColumn = ["[ ]", "Produto", "Lote/Val (Sugerido)", "Qtd", "Etiq."];
         const tableRows: any[] = [];

         const itensParaSeparar = relatorioGerado.filter(r => r.aFracionar > 0);

         itensParaSeparar.forEach(row => {
            if (row.lotesSugeridos.length > 0) {
               row.lotesSugeridos.forEach((lote: any) => {
                   tableRows.push([
                     "", // Checkbox
                     `${row.id}\n${row.nome}`,
                     `Lt: ${lote.lote}\nVal: ${lote.validade}\n(Sug: ${lote.qtd})`,
                     "", // Qtd em branco para anotar
                     ""  // Etiqueta (checkbox)
                   ]);
               });
            } else {
               tableRows.push([
                 "",
                 `${row.id}\n${row.nome}`,
                 "FALTA ESTOQUE",
                 "", // Qtd
                 ""  // Etiqueta
               ]);
            }
         });

         doc.autoTable({
           head: [tableColumn],
           body: tableRows,
           startY: 28,
           styles: { fontSize: 8, cellPadding: 3, valign: 'middle', minCellHeight: 20 },
           headStyles: { fillColor: [15, 23, 42], textColor: 255 },
           columnStyles: {
               0: { cellWidth: 10 },
               1: { cellWidth: 110 },
               2: { cellWidth: 60 },
               3: { cellWidth: 40, halign: 'center' },
               4: { cellWidth: 45, halign: 'center' }
           },
           didDrawCell: function(data: any) {
              if (data.section === 'body') {
                 doc.setLineWidth(0.8); // Traço ainda mais forte
                 doc.setDrawColor(0, 0, 0); // Cor preta para destacar
                 
                 if (data.column.index === 0) {
                    const sqSize = 6;
                    const mX = (data.cell.width - sqSize) / 2;
                    const mY = (data.cell.height - sqSize) / 2;
                    doc.rect(data.cell.x + mX, data.cell.y + mY, sqSize, sqSize); 
                 }
                 if (data.column.index === 3) {
                    doc.line(data.cell.x + 2, data.cell.y + data.cell.height - 4, data.cell.x + data.cell.width - 2, data.cell.y + data.cell.height - 4);
                 }
                 if (data.column.index === 4) {
                    // Etiqueta GIGANTE e centralizada
                    const sqSize = 16;
                    const mX = (data.cell.width - sqSize) / 2;
                    const mY = (data.cell.height - sqSize) / 2;
                    doc.rect(data.cell.x + mX, data.cell.y + mY, sqSize, sqSize); 
                 }
                 
                 doc.setLineWidth(0.1); // Reseta para o padrão
              }
           }
         });

         // Adiciona as assinaturas no final do PDF
         let finalY = (doc as any).lastAutoTable.finalY || 28;
         let signatureY = finalY + 30;

         // Se não houver espaço suficiente na página (A4 paisagem = 210mm de altura), cria nova página
         if (signatureY > 180) {
            doc.addPage();
            signatureY = 40;
         }

         doc.setLineWidth(0.5);
         doc.setDrawColor(0, 0, 0);
         doc.setFontSize(10);

         // Separador
         doc.line(20, signatureY, 90, signatureY);
         doc.text("Separador", 55, signatureY + 5, { align: "center" });

         // Conferente
         doc.line(110, signatureY, 180, signatureY);
         doc.text("Conferente", 145, signatureY + 5, { align: "center" });

         // Farmacêutico
         doc.line(200, signatureY, 270, signatureY);
         doc.text("Farmacêutico", 235, signatureY + 5, { align: "center" });

         doc.save(`Ficha_Separacao.pdf`);
      } 
      else {
         // PDF Padrão da Análise
         const doc = new jsPDF('l', 'mm', 'a4');
         doc.setFontSize(16);
         doc.text("Relatorio de Fracionamento", 14, 15);
         doc.setFontSize(10);
         doc.setTextColor(100);
         doc.text(`Parametros: ${diasMinimo}d (Minimo) | ${diasReposicao}d (Alvo) | Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 22);

         const tableColumn = ["ID", "Produto", "Minimo\n(Gatilho)", "Alvo\n(Reposicao)", "Saldo\nDestino", "A\nFracionar", "Disp.\nCAF", "Mapa de Lotes (PEPS)"];
         const tableRows: any[] = [];

         relatorioGerado.forEach(row => {
           let lotesStr = "";
           if (row.lotesSugeridos.length > 0) {
              lotesStr = row.lotesSugeridos.map((l: any) =>
                `Lote: ${l.lote} (Val: ${l.validade}) -> ${row.aFracionar === 0 ? 'Disp' : 'Qtd'}: ${l.qtd}`
              ).join('\n');

              if (row.faltaNaCaf > 0) {
                  lotesStr += `\n[!] Faltam ${row.faltaNaCaf} na CAF`;
              }
           } else {
              lotesStr = row.aFracionar > 0 ? `[!] Faltam ${row.aFracionar} na CAF\n(Sem Estoque)` : "Sem Estoque";
           }

           tableRows.push([
             row.id, row.nome, row.estoqueMinimo.toString(), row.estoqueAlvo.toString(),
             row.saldoRealDestino.toString(), row.aFracionar.toString(), row.estoqueCAF.toString(), lotesStr
           ]);
         });

         doc.autoTable({
           head: [tableColumn],
           body: tableRows,
           startY: 28,
           styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
           headStyles: { fillColor: [15, 23, 42], textColor: 255, halign: 'center' },
           alternateRowStyles: { fillColor: [248, 250, 252] },
           columnStyles: {
               0: { cellWidth: 15 }, 1: { cellWidth: 45 }, 2: { halign: 'center' }, 3: { halign: 'center' },
               4: { halign: 'center' }, 5: { halign: 'center', fontStyle: 'bold', textColor: [29, 78, 216] },
               6: { halign: 'center' }, 7: { cellWidth: 80 }
           },
           didParseCell: function(data: any) {
              if (data.section === 'body') {
                  const row = relatorioGerado[data.row.index];
                  if (data.column.index === 4 && row.saldoRealDestino <= row.estoqueMinimo) {
                      data.cell.styles.textColor = [220, 38, 38];
                      data.cell.styles.fontStyle = 'bold';
                  }
                  if (row.aFracionar === 0 && data.column.index !== 7) {
                      data.cell.styles.textColor = [148, 163, 184];
                  }
              }
           }
         });
         doc.save(`Fracionamento_Analise.pdf`);
      }

    } catch (error) {
       console.error("Erro ao gerar PDF: ", error);
       alert("Ocorreu um erro ao exportar o PDF.");
    } finally {
       setGerandoPdf(false);
    }
  };

  const exportarCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Codigo;Produto;Media/Dia;Estoque Minimo;Estoque Alvo;Saldo Destino;Estoque CAF;A Fracionar;Lotes Sugeridos;Alerta CAF\n";
    
    relatorioGerado.forEach(row => {
      const lotesStr = row.lotesSugeridos.map((l: any) => `Lote: ${l.lote} (Val: ${l.validade}) -> ${row.aFracionar > 0 ? 'Sugerido' : 'Disp'}: ${l.qtd}`).join(' | ');
      const alerta = row.faltaNaCaf > 0 ? `Falta ${row.faltaNaCaf} na CAF` : 'OK';
      const line = `${row.id};"${row.nome}";${Math.round(row.media)};${row.estoqueMinimo};${row.estoqueAlvo};${row.saldoRealDestino};${row.estoqueCAF};${row.aFracionar};"${lotesStr}";"${alerta}"`;
      csvContent += line + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Fracionamento_Min${diasMinimo}_Alvo${diasReposicao}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const FileUploadCard = ({ title, type, icon: Icon, stateData }: { title: string, type: string, icon: any, stateData: any }) => (
    <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors h-32">
      <input 
        type="file" accept=".csv" onChange={(e) => handleFileUpload(e, type)} 
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      {files[type] ? (
        <div className="text-emerald-600 flex flex-col items-center w-full">
          <CheckCircle className="w-8 h-8 mb-2" />
          <span className="font-semibold text-sm text-center truncate w-full px-2" title={files[type].name}>{files[type].name}</span>
          <span className="text-xs text-slate-500 mt-1 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
            {Object.keys(stateData).length > 0 ? `${Object.keys(stateData).length} ids detetados` : 'Erro na leitura'}
          </span>
        </div>
      ) : (
        <div className="text-slate-500 flex flex-col items-center">
          <Icon className="w-8 h-8 mb-2 text-slate-400" />
          <span className="font-semibold text-sm">{title}</span>
        </div>
      )}
    </div>
  );

  const isReady = Object.keys(dadosConsumo).length > 0 && Object.keys(dadosCaf).length > 0;

  // Filtra itens que precisam ser separados para a nova aba
  const itensParaSeparar = relatorioGerado.filter(item => item.aFracionar > 0);

  return (
    <div className="min-h-screen bg-slate-100 p-6 font-sans text-slate-800 print:bg-white print:p-0">
      <div className="max-w-[1400px] mx-auto space-y-6 print:space-y-0 print:block">
        
        {/* Cabeçalho */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 print:hidden">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Activity className="text-blue-600" /> 
              Inteligência de Fracionamento (Min/Máx)
            </h1>
            <p className="text-slate-500 text-sm mt-1">Previne ruturas disparando o fracionamento apenas quando atinge o Mínimo, reabastecendo até ao Alvo.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 w-full xl:w-auto">
            <div className="flex items-center gap-3 w-full sm:w-auto border-b sm:border-b-0 sm:border-r border-slate-200 pb-3 sm:pb-0 sm:pr-4">
              <div className="bg-amber-100 p-2 rounded-lg"><AlertTriangle className="text-amber-600 w-5 h-5" /></div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Gatilho (Estoque Mínimo)</label>
                <div className="flex items-center gap-2 mt-0.5">
                  <input 
                    type="number" min="0.5" step="0.5" value={diasMinimo} 
                    onChange={(e) => setDiasMinimo(Number(e.target.value))}
                    className="w-16 p-1 border border-slate-300 rounded text-center font-bold text-slate-700 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <span className="text-xs text-slate-600 font-medium leading-tight">Dias a<br/>proteger</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto pt-3 sm:pt-0">
              <div className="bg-blue-100 p-2 rounded-lg"><Box className="text-blue-600 w-5 h-5" /></div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Reposição (Estoque Alvo)</label>
                <div className="flex items-center gap-2 mt-0.5">
                  <input 
                    type="number" min="1" step="1" value={diasReposicao} 
                    onChange={(e) => setDiasReposicao(Number(e.target.value))}
                    className="w-16 p-1 border border-slate-300 rounded text-center font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <span className="text-xs text-slate-600 font-medium leading-tight">Dias a<br/>abastecer</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Grelha de Upload */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
          <FileUploadCard title="1. Consumo Médio" type="consumo" icon={Activity} stateData={dadosConsumo} />
          <FileUploadCard title="2. Estoque CAF" type="caf" icon={Box} stateData={dadosCaf} />
          <FileUploadCard title="3. Estoque Destino" type="destino" icon={FileText} stateData={dadosDestino} />
          <FileUploadCard title="4. Transf. Efetuadas" type="transferencias" icon={ArrowRightLeft} stateData={dadosTransf} />
        </div>

        {!isReady && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-center gap-3 print:hidden">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">Faça o upload obrigatório do ficheiro de <b>Consumo</b> e do <b>Estoque CAF</b> para ativar a análise.</p>
          </div>
        )}

        {isReady && !mostrarResultados && (
          <div className="flex justify-center py-6 print:hidden">
            <button 
              onClick={() => setMostrarResultados(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold text-lg flex items-center gap-3 shadow-lg hover:shadow-xl transition-all"
            >
              <Activity className="w-6 h-6" /> Processar Algoritmo
            </button>
          </div>
        )}

        {/* Cabeçalho exclusivo para Impressão */}
        {mostrarResultados && (
          <div className="hidden print:block mb-4 pb-4 border-b border-slate-300">
            <h1 className="text-2xl font-bold text-slate-800">
              {abaAtiva === 'separacao' ? 'Ficha de Separação e Etiquetagem' : 'Relatório de Fracionamento (Sugerido)'}
            </h1>
            <p className="text-sm text-slate-500">
              {abaAtiva === 'separacao' 
                ? `Total de Itens a Separar: ${itensParaSeparar.length} | Data: ${new Date().toLocaleDateString('pt-BR')}`
                : `Parâmetros: ${diasMinimo}d (Mínimo) | ${diasReposicao}d (Alvo) | ${new Date().toLocaleDateString('pt-BR')}`}
            </p>
          </div>
        )}

        {/* Content Area */}
        {isReady && mostrarResultados && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 print:shadow-none print:border-none print:rounded-none">
            
            {/* Navegação de Abas */}
            <div className="flex border-b border-slate-200 bg-slate-50 print:hidden">
              <button
                onClick={() => setAbaAtiva('analise')}
                className={`px-6 py-4 font-bold text-sm transition-colors border-b-2 ${abaAtiva === 'analise' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                1. Análise e Cálculo
              </button>
              <button
                onClick={() => setAbaAtiva('separacao')}
                className={`px-6 py-4 font-bold text-sm transition-colors border-b-2 flex items-center gap-2 ${abaAtiva === 'separacao' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <ClipboardCheck className="w-4 h-4" />
                2. Ficha de Separação
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white print:hidden">
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                <input 
                  type="text" placeholder="Filtrar por nome ou ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-80 px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <button 
                  onClick={exportarPDF}
                  disabled={gerandoPdf}
                  className={`flex items-center gap-2 text-white px-5 py-2 rounded-lg font-medium transition-colors w-full md:w-auto justify-center shadow-sm ${gerandoPdf ? 'bg-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {gerandoPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} 
                  {gerandoPdf ? 'A Gerar PDF...' : `Exportar ${abaAtiva === 'separacao' ? 'Ficha' : 'PDF'}`}
                </button>
                <button 
                  onClick={() => window.print()}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 rounded-lg font-medium transition-colors w-full md:w-auto justify-center shadow-sm"
                >
                  <Printer className="w-4 h-4" /> Imprimir
                </button>
              </div>
            </div>

            <div className="overflow-x-auto print:overflow-visible">
              
              {/* ABA 1: ANÁLISE */}
              {abaAtiva === 'analise' && (
                <table className="w-full text-left border-collapse text-sm print:text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 uppercase text-[11px] tracking-wider font-bold">
                      <th className="p-4 print:p-2 border-b">ID</th>
                      <th className="p-4 print:p-2 border-b">Produto</th>
                      <th className="p-4 print:p-2 border-b text-center border-l border-slate-200 bg-amber-50/50 text-amber-800">Mínimo<br/><span className="text-[9px] font-normal">Gatilho ({diasMinimo}d)</span></th>
                      <th className="p-4 print:p-2 border-b text-center bg-blue-50/50 text-blue-800">Alvo<br/><span className="text-[9px] font-normal">Repor p/ {diasReposicao}d</span></th>
                      <th className="p-4 print:p-2 border-b text-center bg-slate-50 border-l border-slate-200">Saldo<br/>Destino</th>
                      <th className="p-4 print:p-2 border-b text-center border-r border-slate-200 bg-blue-50 text-blue-700">A Fracionar<br/><span className="text-[9px] font-normal text-slate-400 print:hidden">(Editável)</span></th>
                      <th className="p-4 print:p-2 border-b text-center">Disp. CAF</th>
                      <th className="p-4 print:p-2 border-b">Mapa de Lotes (PEPS)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {relatorioGerado.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-slate-500 bg-slate-50/50">Nenhum item exibido para a sua busca.</td>
                      </tr>
                    ) : (
                      relatorioGerado.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50 transition-colors print:break-inside-avoid">
                          <td className="p-4 print:p-2 text-slate-500 font-mono text-xs">{row.id}</td>
                          <td className="p-4 print:p-2 font-medium text-slate-800 max-w-[200px] truncate print:whitespace-normal" title={row.nome}>{row.nome}</td>
                          
                          <td className="p-4 print:p-2 text-center border-l border-slate-100 bg-amber-50/20">
                             <div className="font-bold text-amber-700">{row.estoqueMinimo}</div>
                             <div className="text-[10px] text-slate-400">Md: {Math.round(row.media)}</div>
                          </td>

                          <td className="p-4 print:p-2 text-center bg-blue-50/20">
                             <div className="font-bold text-blue-700">{row.estoqueAlvo}</div>
                          </td>
                          
                          <td className="p-4 print:p-2 text-center bg-slate-50/50 border-l border-slate-100">
                            <span className={`font-bold ${row.saldoRealDestino <= row.estoqueMinimo ? "text-red-600 text-lg print:text-base" : "text-emerald-600"}`}>
                              {row.saldoRealDestino}
                            </span>
                            {row.transfEmAndamento > 0 && (
                              <div className="text-[10px] font-medium text-blue-600 bg-blue-100 rounded inline-block px-1 mt-1 print:border print:border-blue-200" title="Em trânsito">
                                +{row.transfEmAndamento} tf.
                              </div>
                            )}
                          </td>
                          
                          <td className="p-4 print:p-2 text-center border-r border-slate-100 bg-blue-50/30">
                            <input 
                              type="number" min="0" 
                              value={fracionamentosManuais[row.id] !== undefined ? fracionamentosManuais[row.id] : row.aFracionar}
                              onChange={(e) => handleFracionamentoManual(row.id, e.target.value)}
                              className={`w-16 p-1 text-center font-black text-lg bg-white border border-slate-300 rounded shadow-inner focus:ring-2 focus:ring-blue-500 outline-none print:border-none print:bg-transparent print:shadow-none print:p-0 ${row.aFracionar > 0 ? 'text-blue-700' : 'text-slate-400'}`}
                              title="Pode alterar manualmente este valor"
                            />
                          </td>
                          
                          <td className="p-4 print:p-2 text-center align-middle">
                            <span className={`font-bold ${row.estoqueCAF < row.aFracionar ? "text-red-500" : "text-slate-700"}`}>
                              {row.estoqueCAF}
                            </span>
                          </td>
                          
                          <td className="p-4 print:p-2 text-xs">
                            {row.lotesSugeridos.length > 0 ? (
                              <div className="space-y-1.5">
                                {row.lotesSugeridos.map((lote: any, idx: number) => (
                                  <div key={idx} className="flex justify-between items-center p-2 rounded border border-slate-200 bg-white shadow-sm print:p-1 print:border-slate-300">
                                    <div className="flex flex-col">
                                      <span className="font-mono font-medium text-slate-700">{lote.lote}</span>
                                      <span className="text-[10px] text-slate-400 uppercase">Val: {lote.validade}</span>
                                    </div>
                                    <span className={`font-black px-2 py-1 rounded print:border print:border-slate-300 ${row.aFracionar === 0 ? 'text-slate-500 bg-slate-100 print:bg-transparent' : 'text-blue-700 bg-blue-50 print:bg-transparent'}`}>
                                      {row.aFracionar === 0 ? `Disp: ${lote.qtd}` : `Q: ${lote.qtd}`}
                                    </span>
                                  </div>
                                ))}
                                {row.faltaNaCaf > 0 && (
                                  <div className="mt-1 text-[10px] text-red-600 font-bold bg-red-50 p-1.5 rounded border border-red-200 print:bg-transparent print:border-red-400">
                                    ⚠️ Faltam {row.faltaNaCaf} na CAF
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <span className="text-red-500 font-medium bg-red-50 px-2 py-1 rounded border border-red-100 print:bg-transparent print:border-red-400">Sem Estoque</span>
                                {row.aFracionar > 0 && <span className="text-[10px] text-red-600 font-bold">⚠️ Faltam {row.aFracionar}</span>}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* ABA 2: FICHA DE SEPARAÇÃO */}
              {abaAtiva === 'separacao' && (
                <>
                  <table className="w-full text-left border-collapse text-sm print:text-[11px]">
                    <thead>
                      <tr className="bg-emerald-50 text-emerald-800 uppercase text-[11px] tracking-wider font-bold border-b-2 border-emerald-200">
                        <th className="p-4 print:p-2 text-center w-12">Atend.</th>
                        <th className="p-4 print:p-2">Produto</th>
                        <th className="p-4 print:p-2">Lote/Val (Sugerido)</th>
                        <th className="p-4 print:p-2 text-center bg-emerald-100/50 w-24">Qtd<br/><span className="text-[9px] font-normal text-emerald-600 print:hidden">(Anotar)</span></th>
                        <th className="p-4 print:p-2 text-center w-24">Etiq.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {itensParaSeparar.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-12 text-center text-slate-500 bg-slate-50/50">
                            <CheckSquare className="w-8 h-8 mx-auto text-emerald-300 mb-2" />
                            Nenhum medicamento necessita de fracionamento neste momento.
                          </td>
                        </tr>
                      ) : (
                        itensParaSeparar.map((row) => (
                          row.lotesSugeridos.length > 0 ? (
                            row.lotesSugeridos.map((lote: any, idx: number) => (
                              <tr key={`${row.id}-${idx}`} className="hover:bg-emerald-50/30 transition-colors print:break-inside-avoid">
                                <td className="p-4 print:p-2 text-center align-middle">
                                  <input type="checkbox" className="w-6 h-6 text-emerald-600 rounded border-2 border-slate-400 focus:ring-emerald-500 cursor-pointer" />
                                </td>
                                <td className="p-4 print:p-2">
                                  <div className="font-mono text-xs text-slate-500">{row.id}</div>
                                  <div className="font-bold text-slate-800">{row.nome}</div>
                                </td>
                                <td className="p-4 print:p-2">
                                  <div className="flex items-start gap-2">
                                    <input type="checkbox" className="mt-1 w-4 h-4 text-emerald-600 rounded border-slate-300 print:hidden" title="Marcar lote" />
                                    <div>
                                      <div className="font-mono font-medium text-slate-700">{lote.lote}</div>
                                      <div className="text-xs text-slate-500">Val: {lote.validade} <span className="font-semibold text-emerald-600 ml-1">(Sug: {lote.qtd})</span></div>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4 print:p-2 text-center bg-emerald-50/30 align-middle">
                                  <input 
                                    type="text" 
                                    placeholder="" 
                                    className="w-16 p-1 text-center font-black text-lg text-emerald-700 bg-transparent border-b border-emerald-300 focus:ring-0 focus:border-emerald-600 outline-none print:border-none print:p-0 print:placeholder-transparent"
                                  />
                                </td>
                                <td className="p-4 print:p-2 text-center align-middle border-l border-slate-100">
                                  <input type="checkbox" className="w-12 h-12 text-blue-600 rounded-sm border-2 border-slate-400 focus:ring-blue-500 cursor-pointer mx-auto" />
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr key={row.id} className="bg-red-50/30 print:break-inside-avoid">
                              <td className="p-4 print:p-2 text-center"><AlertTriangle className="w-5 h-5 text-red-500 mx-auto" /></td>
                              <td className="p-4 print:p-2">
                                <div className="font-mono text-xs text-slate-500">{row.id}</div>
                                <div className="font-bold text-slate-800">{row.nome}</div>
                              </td>
                              <td className="p-4 print:p-2 text-center">
                                <span className="text-red-600 font-bold uppercase text-xs">Falta Estoque na CAF</span>
                                <div className="text-xs text-slate-500">Deveria repor {row.aFracionar} unid.</div>
                              </td>
                              <td className="p-4 print:p-2 align-middle bg-emerald-50/30">
                                  <input type="text" className="w-16 p-1 bg-transparent border-b border-red-300 outline-none print:border-none print:p-0" />
                              </td>
                              <td className="p-4 print:p-2 text-center border-l border-slate-100"></td>
                            </tr>
                          )
                        ))
                      )}
                    </tbody>
                  </table>
                  
                  {/* Assinaturas no final da página HTML */}
                  {itensParaSeparar.length > 0 && (
                    <div className="mt-20 mb-10 flex flex-col md:flex-row justify-between items-end px-10 gap-10 print:mt-32 print:px-4 print:flex-row print:gap-4">
                      <div className="w-full md:w-64 text-center">
                        <div className="border-b-2 border-slate-800 mb-2"></div>
                        <span className="font-bold text-slate-700 uppercase text-sm">Separador</span>
                      </div>
                      <div className="w-full md:w-64 text-center">
                        <div className="border-b-2 border-slate-800 mb-2"></div>
                        <span className="font-bold text-slate-700 uppercase text-sm">Conferente</span>
                      </div>
                      <div className="w-full md:w-64 text-center">
                        <div className="border-b-2 border-slate-800 mb-2"></div>
                        <span className="font-bold text-slate-700 uppercase text-sm">Farmacêutico</span>
                      </div>
                    </div>
                  )}
                </>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
