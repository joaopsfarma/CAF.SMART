import React, { useState, useRef } from 'react';
import { FileText, Download, Upload, FileSpreadsheet, Printer } from 'lucide-react';
import Papa from 'papaparse';

export default function FichaTransferenciasTab() {
  const [fichas, setFichas] = useState<any[]>([]);
  const [statusText, setStatusText] = useState('A aguardar ficheiro...');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setStatusText(`A processar ${file.name}...`);

    Papa.parse(file, {
      complete: function(results) {
        processData(results.data);
      },
      error: function(error) {
        alert("Erro ao ler o ficheiro CSV. Verifique o formato.");
        console.error(error);
        setStatusText('Erro ao processar ficheiro.');
        setIsProcessing(false);
      }
    });
  };

  const processData = (rows: any[]) => {
    const newFichas: any[] = [];
    let currentProduct = "Medicamento Não Identificado";

    // Começa de i=1 para saltar o cabeçalho do CSV
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      if (row.length < 11) continue;

      // Mapeamento baseado no padrão do CSV
      const prodRaw = row[2];
      const loteRaw = row[8];
      const valRaw = row[10];

      const prod = prodRaw ? prodRaw.trim() : "";
      const lote = loteRaw ? loteRaw.trim() : "";
      const validade = valRaw ? valRaw.trim() : "";

      if (prod !== "") {
        currentProduct = prod;
      }

      if (currentProduct.toUpperCase().includes("DONEZEPILA")) {
        continue;
      }

      if (lote !== "" && validade !== "") {
        newFichas.push({ medicamento: currentProduct, lote: lote, validade: validade });
      }
    }

    // Ordenar por ordem alfabética
    newFichas.sort((a, b) => a.medicamento.localeCompare(b.medicamento));

    setFichas(newFichas);
    
    if (newFichas.length === 0) {
      setStatusText("Nenhum lote válido encontrado no ficheiro.");
    } else {
      setStatusText(`${newFichas.length} fichas geradas com sucesso! Prontas para PDF.`);
    }
    setIsProcessing(false);
  };

  const gerarPDFGarantido = () => {
    const printContent = document.getElementById('fichasContainer')?.innerHTML;
    
    if (!printContent) return;

    // Abre uma nova janela limpa para evitar bloqueios de pré-visualização
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      alert("Por favor, permita as janelas pop-up (pop-ups) no seu navegador para poder guardar o PDF.");
      return;
    }

    // Injeta o HTML e o CSS nativo otimizado para a impressora do navegador
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-PT">
      <head>
          <title>Fichas_Transferencia_CAF_${new Date().toISOString().split('T')[0]}</title>
          <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
              body {
                  font-family: 'Inter', Arial, sans-serif;
                  margin: 0;
                  padding: 20px;
                  background-color: white;
                  color: #1e293b;
              }
              .print-page {
                  page-break-inside: avoid;
                  padding: 15px 0;
                  width: 100%;
                  border-bottom: 2px dashed #cbd5e1;
                  margin-bottom: 10px;
              }
              .print-page:last-child { border-bottom: none; }
              
              .header-ficha { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e293b; padding-bottom: 8px; margin-bottom: 12px; }
              .header-ficha h2 { margin: 0; font-size: 16px; text-transform: uppercase; font-weight: bold; }
              .header-ficha .header-right { font-size: 11px; color: #64748b; }

              .info-grid { display: flex; gap: 10px; background-color: #f8fafc; padding: 10px; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 12px; }
              .info-box { display: flex; flex-direction: column; }
              .info-box .label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 2px; }
              .info-box .value { font-size: 13px; font-weight: bold; }

              table { width: 100%; border-collapse: collapse; margin-bottom: 10px; text-align: center; }
              th, td { border: 1px solid #000; padding: 6px; }
              th { background-color: #f1f5f9; font-size: 11px; font-weight: 600; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              
              /* Altura da linha em branco para o carimbo (aprox h-14 do tailwind) */
              .blank-row td { height: 50px; }

              @media print {
                  body { padding: 0; }
              }
          </style>
      </head>
      <body>
          ${printContent}
          <script>
              // Aguarda um instante para garantir que a fonte Inter carrega e chama a impressão
              window.onload = function() {
                  setTimeout(function() {
                      window.print();
                  }, 500);
              };
          <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const NUM_LINHAS_BRANCO = 4;

  return (
    <div className="font-sans text-slate-800 relative pb-12">
      <div className="max-w-4xl mx-auto mb-6 flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-700 rounded-lg">
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Gerador de Fichas de Controlo</h1>
            <p className="text-sm text-slate-500">Controlo de Estoque de Psicotrópicos (Portaria 344/98)</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-none sm:rounded-xl overflow-hidden p-6">
        <div className="space-y-4">
          <div 
            className="p-8 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 text-center hover:bg-slate-100 transition-colors cursor-pointer flex flex-col items-center justify-center" 
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={40} className="text-slate-400 mb-3" />
            <p className="text-sm font-medium text-slate-700">Clique para selecionar o ficheiro CSV do sistema</p>
            <p className="text-xs text-slate-500 mt-1">O sistema lerá apenas Medicamento, Lote e Validade. (Donezepila ignorada)</p>
            <input 
              type="file" 
              ref={fileInputRef}
              accept=".csv" 
              className="hidden" 
              onChange={handleFileUpload} 
            />
          </div>

          <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100">
            <span className={`text-sm font-medium ${fichas.length > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
              {statusText}
            </span>
            
            <button 
              onClick={gerarPDFGarantido} 
              disabled={fichas.length === 0 || isProcessing} 
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Printer size={18} />
              <span className="hidden sm:inline">Salvar como PDF / Imprimir</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contentor Oculto (Usado apenas para construir as fichas antes de exportar) */}
      <div id="fichasContainer" className="hidden w-full bg-white">
        {fichas.map((ficha, index) => (
          <div key={index} className="print-page">
            <div className="header-ficha">
              <div className="header-left">
                <h2>Transferência de Psicotrópicos: CAF ➔ Satélite</h2>
              </div>
              <div className="header-right">
                Gerado em: {new Date().toLocaleDateString('pt-PT')}
              </div>
            </div>

            <div className="info-grid">
              <div className="info-box" style={{ width: '50%' }}>
                <span className="label">Medicamento</span>
                <span className="value">{ficha.medicamento}</span>
              </div>
              <div className="info-box" style={{ width: '25%' }}>
                <span className="label">Lote</span>
                <span className="value">{ficha.lote}</span>
              </div>
              <div className="info-box" style={{ width: '25%' }}>
                <span className="label">Validade</span>
                <span className="value">{ficha.validade}</span>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style={{ width: '10%' }}>Data</th>
                  <th style={{ width: '22%' }}>Destino (Satélite)</th>
                  <th style={{ width: '8%' }}>Qtd.</th>
                  <th style={{ width: '18%' }}>Entregue por (CAF)</th>
                  <th style={{ width: '18%' }}>Recebido por (Satélite)</th>
                  <th style={{ width: '24%' }}>Carimbo Farmacêutico</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: NUM_LINHAS_BRANCO }).map((_, i) => (
                  <tr key={i} className="blank-row">
                    <td></td><td></td><td></td><td></td><td></td><td></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
