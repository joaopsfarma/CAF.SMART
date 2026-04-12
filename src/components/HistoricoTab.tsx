import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { FileText, Archive, ClipboardCheck, Search, Loader2, Download, Trash2, CheckCircle, AlertCircle, XCircle, MinusCircle, FileSpreadsheet } from 'lucide-react';
import { isAdminUser } from '../config';

export default function HistoricoTab({ user }: { user: any }) {
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos'); // 'todos', 'recebimento', 'quarentena'
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedReg, setSelectedReg] = useState<any | null>(null);
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

  const recebimentoChecklist = [
    "Prazo de Entrega: O prazo está de acordo com o estabelecido na ordem de compra?",
    "Dados da OC: Os dados estão de acordo com a OC? (valor, quantidade, condição de pagamento)",
    "Horário: A entrega foi efetuada dentro do horário de atendimento do Recebimento?",
    "Marca: A marca dos produtos a receber está de acordo com a informada na ordem de compra?",
    "Medicamentos Refrigerados: A temperatura está dentro da curva térmica de 2º a 8ºC?",
    "Validade: A validade do produto está maior que 30% da vida útil e 90 dias para dietas?",
    "Lote: O lote informado na NF é igual ao Físico? (Conferir todos os lotes)",
    "Controlados: A NF possui a sigla obrigatória de acordo com a característica do medicamento?",
    "Integridade: As embalagens estão íntegras, sem avarias que comprometam o produto?",
    "Nota Fiscal: A nota fiscal física foi recebida?"
  ];

  const quarentenaChecklist = [
    "As embalagens coletivas encontram-se íntegras e foram mantidas rigorosamente fechadas, sem abertura prévia à inspeção técnica.",
    "Todos os volumes recebidos foram devidamente identificados com a sinalização 'EM QUARENTENA — AGUARDANDO CONFERÊNCIA FARMACÊUTICA'.",
    "Medicamentos termolábeis foram imediatamente segregados e armazenados no Refrigerador de Inspeção, garantindo a manutenção da cadeia de frio.",
    "Os demais medicamentos (temperatura ambiente) foram corretamente direcionados e alocados no Armário de Quarentena do setor.",
    "Os psicotrópicos foram retidos na área de quarentena, vetando o seu direcionamento direto à sala de psicotrópicos nesta etapa."
  ];

  const farmaciaChecklist = {
    p1: { crit: 'DCB (Denominação Comum Brasileira)', como: 'Comparar rótulo do produto × pedido de compra × nota fiscal' },
    p2: { crit: 'Forma farmacêutica', como: 'Ler o rótulo: comprimido, cápsula, solução injetável, etc.' },
    p3: { crit: 'Concentração', como: 'Ler rótulo: mg, mg/mL, mcg/mL, etc.' },
    p4: { crit: 'Validade residual', como: 'Calcular: (meses restantes / prazo total) × 100' },
    p5: { crit: 'Quantidade física', como: 'Contar: nº de caixas × unidades por caixa × volumes' },
    p6: { crit: 'Número de lote', como: 'Registrar no formulário FOR-01 todos os lotes presentes' },
    p7: { crit: 'Integridade das embalagens primárias', como: 'Inspecionar blisteres, ampolas, frascos, lacres' }
  };

  useEffect(() => {
    fetchRegistros();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchRegistros = async () => {
    setLoading(true);
    try {
      const recebimentosRef = collection(db, 'recebimentos');
      const quarentenasRef = collection(db, 'quarentenas');

      // Busca as duas coleções ordenadas pela data de criação
      const [recebimentosSnap, quarentenasSnap] = await Promise.all([
        getDocs(query(recebimentosRef, orderBy('createdAt', 'desc'))),
        getDocs(query(quarentenasRef, orderBy('createdAt', 'desc')))
      ]);

      const recebimentosData = recebimentosSnap.docs.map(doc => ({ id: doc.id, tipo: 'Recebimento', ...doc.data() }));
      const quarentenasData = quarentenasSnap.docs.map(doc => ({ id: doc.id, tipo: 'Quarentena', ...doc.data() }));

      // Junta tudo e ordena do mais recente para o mais antigo
      const todosRegistros = [...recebimentosData, ...quarentenasData].sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
      setRegistros(todosRegistros);
    } catch (error) {
      console.error("Erro ao buscar registros:", error);
    } finally {
      setLoading(false);
    }
  };

  const registrosFiltrados = registros.filter(reg => {
    if (filtro === 'todos') return true;
    if (filtro === 'recebimento') return reg.tipo === 'Recebimento';
    if (filtro === 'quarentena') return reg.tipo === 'Quarentena';
    return true;
  });

  const isAdmin = isAdminUser(user?.email);

  const handleDelete = async (id: string, tipo: string) => {
    try {
      const collectionName = tipo === 'Recebimento' ? 'recebimentos' : 'quarentenas';
      await deleteDoc(doc(db, collectionName, id));
      
      setRegistros(prev => prev.filter(reg => reg.id !== id));
      setToast({ msg: 'Registro excluído com sucesso!', type: 'success' });
    } catch (error) {
      console.error('Erro ao excluir registro:', error);
      setToast({ msg: 'Erro ao excluir. Verifique sua conexão ou permissões.', type: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  const exportToCSV = () => {
    if (registrosFiltrados.length === 0) return;
    
    const dataToExport = registrosFiltrados.map(reg => {
      const cleanReg: any = {
        'Data/Hora': reg.dataHoraRegistro || `${reg.date} ${reg.time}`,
        'Tipo': reg.tipo,
        'Fornecedor': reg.supplier || '-',
        'Transportadora': reg.carrier || '-',
        'Nº Pedido/OC': reg.orderNumber || '-',
        'Nota Fiscal': reg.invoice || '-',
        'Volumes': reg.volumes || '-',
        'Temperatura (ºC)': reg.temperature || '-',
        'Responsável': reg.collaborator || reg.pharmacist || '-',
        'Observações': reg.observations || '-',
      };
      
      // Processar Checklists de Recebimento
      if (reg.tipo === 'Recebimento' && reg.checklist) {
        try {
          const checks = JSON.parse(reg.checklist);
          recebimentoChecklist.forEach((text, index) => {
            const key = index + 1;
            cleanReg[`Checklist - ${text.substring(0, 50)}...`] = checks[key] || '-';
          });
        } catch (e) { console.error("Erro ao processar checklist CSV", e); }
      }

      // Processar Checklists de Quarentena
      if (reg.tipo === 'Quarentena') {
        if (reg.recebimentoChecks) {
          try {
            const checks = JSON.parse(reg.recebimentoChecks);
            quarentenaChecklist.forEach((text, index) => {
              const key = index + 1;
              cleanReg[`Triagem - ${text.substring(0, 50)}...`] = checks[key] || '-';
            });
          } catch (e) { console.error("Erro ao processar triagem CSV", e); }
        }
        if (reg.farmaciaChecks) {
          try {
            const checks = JSON.parse(reg.farmaciaChecks);
            Object.entries(farmaciaChecklist).forEach(([key, info]: [string, any]) => {
              cleanReg[`Farmácia - ${info.crit}`] = checks[key] || '-';
            });
          } catch (e) { console.error("Erro ao processar farmacia CSV", e); }
        }
      }

      return cleanReg;
    });

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `analise_indicadores_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = () => {
    if (registrosFiltrados.length === 0) return;
    
    const dataToExport = registrosFiltrados.map(reg => {
      const cleanReg: any = {
        'Data/Hora': reg.dataHoraRegistro || `${reg.date} ${reg.time}`,
        'Tipo': reg.tipo,
        'Fornecedor': reg.supplier || '-',
        'Transportadora': reg.carrier || '-',
        'Nº Pedido/OC': reg.orderNumber || '-',
        'Nota Fiscal': reg.invoice || '-',
        'Volumes': reg.volumes || '-',
        'Temperatura (ºC)': reg.temperature || '-',
        'Responsável': reg.collaborator || reg.pharmacist || '-',
        'Observações': reg.observations || '-',
      };
      
      // Processar Checklists de Recebimento
      if (reg.tipo === 'Recebimento' && reg.checklist) {
        try {
          const checks = JSON.parse(reg.checklist);
          recebimentoChecklist.forEach((text, index) => {
            const key = index + 1;
            cleanReg[`Checklist - ${text.substring(0, 50)}...`] = checks[key] || '-';
          });
        } catch (e) { console.error("Erro ao processar checklist Excel", e); }
      }

      // Processar Checklists de Quarentena
      if (reg.tipo === 'Quarentena') {
        if (reg.recebimentoChecks) {
          try {
            const checks = JSON.parse(reg.recebimentoChecks);
            quarentenaChecklist.forEach((text, index) => {
              const key = index + 1;
              cleanReg[`Triagem - ${text.substring(0, 50)}...`] = checks[key] || '-';
            });
          } catch (e) { console.error("Erro ao processar triagem Excel", e); }
        }
        if (reg.farmaciaChecks) {
          try {
            const checks = JSON.parse(reg.farmaciaChecks);
            Object.entries(farmaciaChecklist).forEach(([key, info]: [string, any]) => {
              cleanReg[`Farmácia - ${info.crit}`] = checks[key] || '-';
            });
          } catch (e) { console.error("Erro ao processar farmacia Excel", e); }
        }
      }

      return cleanReg;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Indicadores");
    
    // Ajustar largura das colunas
    const wscols = Object.keys(dataToExport[0] || {}).map(() => ({ wch: 25 }));
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `analise_indicadores_${new Date().toISOString().split('T')[0]}.xlsx`);
    setToast({ msg: 'Excel gerado com sucesso!', type: 'success' });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-8 right-8 px-6 py-3 rounded-xl shadow-lg z-50 animate-bounce flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold">{toast.msg}</span>
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Histórico de Registros</h2>
          <p className="text-slate-500 text-sm mt-1">Consulte todos os formulários salvos no sistema.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={exportToExcel} 
            disabled={registrosFiltrados.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-white transition-all shadow-sm ${registrosFiltrados.length === 0 ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
            title="Exportar para Excel (.xlsx)"
          >
            <FileSpreadsheet size={18} />
            <span className="hidden sm:inline">Excel</span>
          </button>
          <button 
            onClick={exportToCSV} 
            disabled={registrosFiltrados.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-white transition-all shadow-sm ${registrosFiltrados.length === 0 ? 'bg-slate-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
            title="Exportar para CSV"
          >
            <Download size={18} />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <select 
            value={filtro} 
            onChange={(e) => setFiltro(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm font-medium text-slate-700"
          >
            <option value="todos">Todos os Registros</option>
            <option value="recebimento">Apenas Recebimento</option>
            <option value="quarentena">Apenas Quarentena</option>
          </select>
          <button onClick={fetchRegistros} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-slate-600" title="Atualizar">
            <Search size={20} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-purple-500" />
          <p>Carregando registros...</p>
        </div>
      ) : registrosFiltrados.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-xl">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-700">Nenhum registro encontrado</h3>
          <p className="text-slate-500 mt-1">Os formulários salvos aparecerão aqui.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-sm text-slate-500">
                <th className="pb-3 font-medium">Data/Hora</th>
                <th className="pb-3 font-medium">Tipo</th>
                <th className="pb-3 font-medium">Fornecedor</th>
                <th className="pb-3 font-medium">Nº Pedido/OC</th>
                <th className="pb-3 font-medium">Responsável</th>
                <th className="pb-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {registrosFiltrados.map((reg) => (
                <tr key={reg.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 text-slate-700 font-medium">
                    {reg.dataHoraRegistro || `${reg.date} ${reg.time}`}
                  </td>
                  <td className="py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
                      reg.tipo === 'Recebimento' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'
                    }`}>
                      {reg.tipo === 'Recebimento' ? <ClipboardCheck size={14} /> : <Archive size={14} />}
                      {reg.tipo}
                    </span>
                  </td>
                  <td className="py-4 text-slate-600">{reg.supplier || '-'}</td>
                  <td className="py-4 text-slate-600">{reg.orderNumber || '-'}</td>
                  <td className="py-4 text-slate-600">{reg.collaborator || reg.pharmacist || '-'}</td>
                  <td className="py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setSelectedReg(reg)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Ver detalhes"
                      >
                        <Search size={18} />
                      </button>
                      {isAdmin && (
                        deletingId === reg.id ? (
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleDelete(reg.id, reg.tipo)}
                              className="text-[10px] bg-red-600 text-white px-2 py-1 rounded font-bold hover:bg-red-700"
                            >
                              CONFIRMAR
                            </button>
                            <button 
                              onClick={() => setDeletingId(null)}
                              className="text-[10px] bg-slate-200 text-slate-600 px-2 py-1 rounded font-bold hover:bg-slate-300"
                            >
                              CANCELAR
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setDeletingId(reg.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir registro"
                          >
                            <Trash2 size={18} />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Detalhes */}
      {selectedReg && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  {selectedReg.tipo === 'Recebimento' ? <ClipboardCheck className="text-blue-600" /> : <Archive className="text-orange-600" />}
                  Detalhes do Registro - {selectedReg.tipo}
                </h3>
                <p className="text-sm text-slate-500 mt-1">ID: {selectedReg.id} | Registrado em: {selectedReg.dataHoraRegistro || `${selectedReg.date} ${selectedReg.time}`}</p>
              </div>
              <button 
                onClick={() => setSelectedReg(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
              >
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Informações Gerais */}
                <div>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Informações Gerais</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between border-b border-slate-50 pb-2">
                      <span className="text-slate-500">Fornecedor:</span>
                      <span className="font-medium text-slate-800">{selectedReg.supplier || '-'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 pb-2">
                      <span className="text-slate-500">Transportadora:</span>
                      <span className="font-medium text-slate-800">{selectedReg.carrier || '-'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 pb-2">
                      <span className="text-slate-500">Nota Fiscal:</span>
                      <span className="font-medium text-slate-800">{selectedReg.invoice || '-'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 pb-2">
                      <span className="text-slate-500">Ordem de Compra:</span>
                      <span className="font-medium text-slate-800">{selectedReg.orderNumber || '-'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 pb-2">
                      <span className="text-slate-500">Volumes:</span>
                      <span className="font-medium text-slate-800">{selectedReg.volumes || '-'}</span>
                    </div>
                    {selectedReg.temperature && (
                      <div className="flex justify-between border-b border-slate-50 pb-2">
                        <span className="text-slate-500">Temperatura:</span>
                        <span className="font-medium text-slate-800">{selectedReg.temperature} °C</span>
                      </div>
                    )}
                    <div className="flex justify-between border-b border-slate-50 pb-2">
                      <span className="text-slate-500">Responsável:</span>
                      <span className="font-medium text-slate-800">{selectedReg.collaborator || selectedReg.pharmacist || '-'}</span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Observações</h4>
                    <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-700 min-h-[80px]">
                      {selectedReg.observations || 'Nenhuma observação registrada.'}
                    </div>
                  </div>
                </div>

                {/* Checklists */}
                <div>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Checklist de Verificação</h4>
                  <div className="space-y-2">
                    {selectedReg.tipo === 'Recebimento' ? (
                      (() => {
                        const checks = JSON.parse(selectedReg.checklist || '{}');
                        return recebimentoChecklist.map((text, index) => (
                          <div key={index} className="flex items-start gap-3 p-2 rounded-lg bg-slate-50/50 text-xs">
                            <span className="shrink-0 mt-0.5">
                              {checks[index + 1] === 'sim' ? <CheckCircle size={14} className="text-green-600" /> : 
                               checks[index + 1] === 'nao' ? <XCircle size={14} className="text-red-600" /> : 
                               <MinusCircle size={14} className="text-slate-400" />}
                            </span>
                            <span className="text-slate-700">{text}</span>
                          </div>
                        ));
                      })()
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Triagem (Recebimento)</p>
                          {(() => {
                            const checks = JSON.parse(selectedReg.recebimentoChecks || '{}');
                            return quarentenaChecklist.map((text, index) => (
                              <div key={index} className="flex items-start gap-3 p-2 rounded-lg bg-slate-50/50 text-xs mb-1">
                                <span className="shrink-0 mt-0.5">
                                  {checks[index + 1] === 'sim' ? <CheckCircle size={14} className="text-green-600" /> : 
                                   checks[index + 1] === 'nao' ? <XCircle size={14} className="text-red-600" /> : 
                                   <MinusCircle size={14} className="text-slate-400" />}
                                </span>
                                <span className="text-slate-700">{text}</span>
                              </div>
                            ));
                          })()}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Conferência Física (Farmacêutico)</p>
                          {(() => {
                            const checks = JSON.parse(selectedReg.farmaciaChecks || '{}');
                            return Object.entries(farmaciaChecklist).map(([key, info]: [string, any]) => (
                              <div key={key} className="flex items-start gap-3 p-2 rounded-lg bg-slate-50/50 text-xs mb-1">
                                <span className="shrink-0 mt-0.5">
                                  {checks[key] === 'sim' ? <CheckCircle size={14} className="text-green-600" /> : 
                                   checks[key] === 'nao' ? <XCircle size={14} className="text-red-600" /> : 
                                   <MinusCircle size={14} className="text-slate-400" />}
                                </span>
                                <div>
                                  <p className="font-bold text-slate-800">{info.crit}</p>
                                  <p className="text-slate-500 italic">{info.como}</p>
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSelectedReg(null)}
                className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all"
              >
                FECHAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
