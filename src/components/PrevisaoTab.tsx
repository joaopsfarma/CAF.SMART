import React, { useState } from 'react';
import Papa from 'papaparse';
import { Upload, Calculator, AlertCircle, CheckCircle, FileSpreadsheet } from 'lucide-react';

export default function PrevisaoTab() {
  const [consumoFile, setConsumoFile] = useState<File | null>(null);
  const [saldoCafFile, setSaldoCafFile] = useState<File | null>(null);
  const [saldoDestinoFile, setSaldoDestinoFile] = useState<File | null>(null);
  const [transferenciasFile, setTransferenciasFile] = useState<File | null>(null);
  const [margemSeguranca, setMargemSeguranca] = useState<number>(5); // Dias de cobertura alvo
  const [diasAntecedencia, setDiasAntecedencia] = useState<number>(2); // Dias de antecedência do pedido
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<File | null>>) => {
    if (e.target.files && e.target.files.length > 0) {
      setter(e.target.files[0]);
    }
  };

  const parseCSV = (file: File): Promise<any[][]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data as any[][]),
        error: (error) => reject(error)
      });
    });
  };

  const parseNumber = (val: string) => {
    if (!val) return 0;
    // Remove quotes, replace comma with dot for decimals
    return parseFloat(val.toString().replace(/"/g, '').replace(',', '.')) || 0;
  };

  const processData = async () => {
    if (!consumoFile || !saldoCafFile || !saldoDestinoFile || !transferenciasFile) {
      setError('Por favor, importe todos os 4 arquivos CSV.');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const consumoData = await parseCSV(consumoFile);
      const saldoCafData = await parseCSV(saldoCafFile);
      const saldoDestinoData = await parseCSV(saldoDestinoFile);
      const transferenciasData = await parseCSV(transferenciasFile);

      // Process Transferências
      // Header: Código,Produto,Unidade,Estoque Origem,Estoque Destino,Qtd,Vl Unitário,Vl Total
      const transferenciasMap = new Map<string, number>();
      for (let i = 1; i < transferenciasData.length; i++) {
        const row = transferenciasData[i];
        const id = row[0];
        if (id && id !== 'Código') {
          const qtd = parseNumber(row[5]);
          transferenciasMap.set(id, (transferenciasMap.get(id) || 0) + qtd);
        }
      }

      // Helper to process Saldo (CAF or Destino)
      // Header: Produto,,,Unidade,,Estoque Atual,,Lote,,Validade,,Est.,,Qt Kit,,Endereço,,Quantidade,,Qt. Dig.,Fabricante
      const processSaldo = (data: any[][]) => {
        const map = new Map<string, any[]>();
        let currentId = '';
        
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;
          if (row[0] === 'Produto') continue; // Skip header if repeated
          
          // If row[1] has a value, it's a new product
          if (row[1] && row[1].trim() !== '') {
            currentId = row[1].trim();
          }
          
          if (currentId) {
            // Check if the row has enough columns for Lote/Validade/Quantidade
            const lote = row.length > 8 && row[8] ? row[8].trim() : '';
            const validade = row.length > 10 && row[10] ? row[10].trim() : '';
            
            // In the provided CSV, "Estoque Atual" is at index 6, "Quantidade" is at index 18
            // We should use "Quantidade" if available and > 0, otherwise fallback to "Estoque Atual"
            let quantidade = 0;
            if (row.length > 18 && row[18] && row[18].trim() !== '') {
              quantidade = parseNumber(row[18]);
            } else if (row.length > 6 && row[6] && row[6].trim() !== '') {
              quantidade = parseNumber(row[6]);
            }
            
            if (lote || quantidade > 0) {
              const lotes = map.get(currentId) || [];
              lotes.push({ lote, validade, quantidade });
              map.set(currentId, lotes);
            }
          }
        }
        return map;
      };

      const destinoMap = processSaldo(saldoDestinoData);
      const cafMap = processSaldo(saldoCafData);

      // Process Consumo
      // Header: Produto,,Unidade,25,26,27,28,29,30,31,Total,Média,Saldo,Projeç.,
      const forecastResults: any[] = [];
      
      // Find the index of "Média" in the header
      const consumoHeader = consumoData[0];
      let mediaIdx = -1;
      if (consumoHeader) {
        for (let i = 0; i < consumoHeader.length; i++) {
          // Check for "Média" or "Media" (case-insensitive, ignoring accents if possible, but exact match first)
          if (consumoHeader[i] === 'Média' || consumoHeader[i] === 'Media' || consumoHeader[i] === 'Mdia') {
            mediaIdx = i;
            break;
          }
        }
      }

      // Fallback if header parsing fails: in the provided CSV, Média is at index 11
      if (mediaIdx === -1) {
        mediaIdx = 11; 
      }

      for (let i = 1; i < consumoData.length; i++) {
        const row = consumoData[i];
        if (!row || row.length === 0) continue;
        
        const id = row[0];
        const nome = row[1];
        
        if (id && id !== 'Produto' && mediaIdx !== -1 && row.length > mediaIdx) {
          const mediaDiaria = parseNumber(row[mediaIdx]);
          
          // Calculate total Destino stock
          const lotesDestino = destinoMap.get(id) || [];
          const estoqueDestinoBase = lotesDestino.reduce((acc, curr) => acc + curr.quantidade, 0);
          
          const transferencias = transferenciasMap.get(id) || 0;
          const estoqueDestinoAtual = estoqueDestinoBase + transferencias;
          
          // Estoque projetado no momento em que o pedido for entregue (descontando o consumo dos dias de antecedência)
          const consumoProjetado = mediaDiaria * diasAntecedencia;
          const estoqueProjetado = Math.max(0, estoqueDestinoAtual - consumoProjetado);
          
          const coberturaProjetadaDias = mediaDiaria > 0 ? estoqueProjetado / mediaDiaria : 999;
          
          // O alvo é ter a cobertura desejada no momento da entrega
          const estoqueAlvo = margemSeguranca * mediaDiaria;
          let quantidadeAFracionar = estoqueAlvo - estoqueProjetado;
          
          if (quantidadeAFracionar < 0) quantidadeAFracionar = 0;

          // Find lots in CAF to fulfill
          const lotesDisponiveis = cafMap.get(id) || [];
          const estoqueCafTotal = lotesDisponiveis.reduce((acc, curr) => acc + curr.quantidade, 0);
          
          // Sort by validade (simple string sort DD/MM/YYYY -> YYYYMMDD)
          lotesDisponiveis.sort((a, b) => {
            const parseDate = (d: string) => {
              if (!d) return '99999999';
              const parts = d.split('/');
              if (parts.length === 3) return `${parts[2]}${parts[1]}${parts[0]}`;
              return d;
            };
            return parseDate(a.validade).localeCompare(parseDate(b.validade));
          });

          let qtdRestante = quantidadeAFracionar;
          const lotesUsados: any[] = [];
          
          for (const lote of lotesDisponiveis) {
            if (qtdRestante <= 0) break;
            if (lote.quantidade > 0) {
              const usar = Math.min(lote.quantidade, qtdRestante);
              lotesUsados.push({
                lote: lote.lote,
                validade: lote.validade,
                quantidade: usar
              });
              qtdRestante -= usar;
            }
          }

          forecastResults.push({
            id,
            nome,
            mediaDiaria: Math.round(mediaDiaria),
            estoqueCaf: Math.round(estoqueCafTotal),
            estoqueDestino: Math.round(estoqueDestinoAtual),
            estoqueProjetado: Math.round(estoqueProjetado),
            coberturaDias: Math.round(coberturaProjetadaDias),
            quantidadeSugerida: Math.ceil(quantidadeAFracionar),
            lotesSugeridos: lotesUsados
          });
        }
      }

      setResults(forecastResults);
    } catch (err) {
      console.error(err);
      setError('Erro ao processar os arquivos CSV. Verifique o formato.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="bg-slate-900 p-6 text-white flex items-center gap-4">
          <div className="p-3 bg-blue-600 rounded-lg">
            <Calculator size={28} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Previsão de Fracionamento</h2>
            <p className="text-slate-300 text-sm mt-1">
              Importe os relatórios CSV para calcular a necessidade de envio para os estoques.
            </p>
            <p className="text-blue-200 text-xs mt-2 flex items-center gap-1">
              <AlertCircle size={14} />
              Nota: Como o CSV não diferencia o saldo já fracionado na CAF, a "Qtd a Enviar" representa o total necessário. O operador deve descontar visualmente o que já estiver pronto na prateleira.
            </p>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-800">
              <AlertCircle className="shrink-0 mt-0.5" size={18} />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* File Inputs */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase border-b border-slate-200 pb-2">
                1. Importação de Dados (CSV)
              </h3>
              
              <div className="flex flex-col gap-3">
                <label className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-600 mb-1">Consumo dos Estoques</span>
                  <div className="flex items-center gap-2">
                    <input type="file" accept=".csv" onChange={(e) => handleFileChange(e, setConsumoFile)} className="hidden" id="file-consumo" />
                    <label htmlFor="file-consumo" className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors text-sm text-slate-700">
                      <Upload size={16} /> {consumoFile ? consumoFile.name : 'Selecionar Arquivo'}
                    </label>
                    {consumoFile && <CheckCircle size={18} className="text-green-500" />}
                  </div>
                </label>

                <label className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-600 mb-1">Saldo Estoque CAF</span>
                  <div className="flex items-center gap-2">
                    <input type="file" accept=".csv" onChange={(e) => handleFileChange(e, setSaldoCafFile)} className="hidden" id="file-caf" />
                    <label htmlFor="file-caf" className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors text-sm text-slate-700">
                      <Upload size={16} /> {saldoCafFile ? saldoCafFile.name : 'Selecionar Arquivo'}
                    </label>
                    {saldoCafFile && <CheckCircle size={18} className="text-green-500" />}
                  </div>
                </label>

                <label className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-600 mb-1">Saldo Estoque Destino</span>
                  <div className="flex items-center gap-2">
                    <input type="file" accept=".csv" onChange={(e) => handleFileChange(e, setSaldoDestinoFile)} className="hidden" id="file-destino" />
                    <label htmlFor="file-destino" className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors text-sm text-slate-700">
                      <Upload size={16} /> {saldoDestinoFile ? saldoDestinoFile.name : 'Selecionar Arquivo'}
                    </label>
                    {saldoDestinoFile && <CheckCircle size={18} className="text-green-500" />}
                  </div>
                </label>

                <label className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-600 mb-1">Transferências do Estoque</span>
                  <div className="flex items-center gap-2">
                    <input type="file" accept=".csv" onChange={(e) => handleFileChange(e, setTransferenciasFile)} className="hidden" id="file-transf" />
                    <label htmlFor="file-transf" className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors text-sm text-slate-700">
                      <Upload size={16} /> {transferenciasFile ? transferenciasFile.name : 'Selecionar Arquivo'}
                    </label>
                    {transferenciasFile && <CheckCircle size={18} className="text-green-500" />}
                  </div>
                </label>
              </div>
            </div>

            {/* Settings & Action */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase border-b border-slate-200 pb-2">
                2. Parâmetros de Cálculo
              </h3>
              
              <div className="flex flex-col gap-4">
                <label className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-600 mb-1">Dias de Antecedência</span>
                  <input 
                    type="number" 
                    value={diasAntecedencia} 
                    onChange={(e) => setDiasAntecedencia(Number(e.target.value))}
                    className="px-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                  />
                  <span className="text-[10px] text-slate-500 mt-1">
                    Quantos dias antes do uso o fracionamento é feito (consome o estoque atual).
                  </span>
                </label>

                <label className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-600 mb-1">Cobertura Alvo (Dias)</span>
                  <input 
                    type="number" 
                    value={margemSeguranca} 
                    onChange={(e) => setMargemSeguranca(Number(e.target.value))}
                    className="px-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                  />
                  <span className="text-[10px] text-slate-500 mt-1">
                    Quantidade de dias de estoque que deseja garantir no destino no momento da entrega.
                  </span>
                </label>

                <button
                  onClick={processData}
                  disabled={isProcessing}
                  className="mt-4 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Processando...
                    </span>
                  ) : (
                    <>
                      <Calculator size={20} />
                      Calcular Previsão
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Results Table */}
          {results.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <FileSpreadsheet size={20} className="text-blue-600" />
                  Resultados da Previsão
                </h3>
                <span className="text-sm text-slate-500">{results.length} itens analisados</span>
              </div>
              
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Cód</th>
                      <th className="px-4 py-3 font-semibold">Produto</th>
                      <th className="px-4 py-3 font-semibold text-right">Média/Dia</th>
                      <th className="px-4 py-3 font-semibold text-right text-emerald-700 bg-emerald-50">Est. CAF</th>
                      <th className="px-4 py-3 font-semibold text-right">Est. Atual</th>
                      <th className="px-4 py-3 font-semibold text-right text-orange-700 bg-orange-50">Est. Projetado</th>
                      <th className="px-4 py-3 font-semibold text-right">Cobertura Proj.</th>
                      <th className="px-4 py-3 font-semibold text-right text-blue-700 bg-blue-50" title="Quantidade total que precisa ser enviada ao destino (inclui o que já está fracionado e o que precisará ser fracionado na máquina)">Qtd a Enviar (Total)</th>
                      <th className="px-4 py-3 font-semibold">Lotes CAF (Sugestão)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.id}</td>
                        <td className="px-4 py-3 font-medium text-slate-800 max-w-xs truncate" title={item.nome}>{item.nome}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{item.mediaDiaria}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-700 bg-emerald-50/30">{item.estoqueCaf}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{item.estoqueDestino}</td>
                        <td className="px-4 py-3 text-right font-semibold text-orange-700 bg-orange-50/30">{item.estoqueProjetado}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            Number(item.coberturaDias) < 2 ? 'bg-red-100 text-red-800' : 
                            Number(item.coberturaDias) < margemSeguranca ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-green-100 text-green-800'
                          }`}>
                            {item.coberturaDias}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-blue-700 bg-blue-50/50">
                          {item.quantidadeSugerida}
                        </td>
                        <td className="px-4 py-3">
                          {item.quantidadeSugerida > 0 ? (
                            item.lotesSugeridos.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {item.lotesSugeridos.map((l: any, i: number) => (
                                  <span key={i} className="text-xs bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                    Lote: <span className="font-mono">{l.lote || 'N/I'}</span> | Val: {l.validade || 'N/I'} | Qtd: {l.quantidade}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                                <AlertCircle size={12} /> Sem saldo na CAF
                              </span>
                            )
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
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
    </div>
  );
}
