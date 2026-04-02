import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { FileText, Archive, ClipboardCheck, Search, Loader2 } from 'lucide-react';

export default function HistoricoTab() {
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos'); // 'todos', 'recebimento', 'quarentena'

  useEffect(() => {
    fetchRegistros();
  }, []);

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
      const todosRegistros = [...recebimentosData, ...quarentenasData].sort((a, b) => b.createdAt - a.createdAt);
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

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Histórico de Registros</h2>
          <p className="text-slate-500 text-sm mt-1">Consulte todos os formulários salvos no sistema.</p>
        </div>
        <div className="flex gap-2">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
