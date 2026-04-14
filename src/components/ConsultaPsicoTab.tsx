import React, { useState, useEffect, useMemo } from 'react';
import { Search, Upload, Database, Trash2, Pill, AlertCircle, ChevronLeft, ChevronRight, FileText, Cloud, CloudOff } from 'lucide-react';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

const appId = 'psicotropicos-app';

export default function ConsultaPsicoTab({ user }: { user: any }) {
  const [medicamentos, setMedicamentos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  
  // Estados para Filtro e Busca
  const [busca, setBusca] = useState('');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('Todas');
  
  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 50;

  // 2. Carregar dados da Base de Dados (Firestore)
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const carregarDadosDaNuvem = async () => {
      setLoading(true);
      try {
        // Busca um único documento contendo toda a lista (Rápido e eficiente)
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'medicamentos_db', 'lista_principal');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const parsedDados = JSON.parse(data.items || '[]');
          setMedicamentos(parsedDados);
          extrairCategorias(parsedDados);
        }
      } catch (err) {
        console.error(err);
        setError('Erro ao ler a base de dados na nuvem.');
      } finally {
        setLoading(false);
      }
    };

    carregarDadosDaNuvem();
  }, [user]);

  const extrairCategorias = (dados: any[]) => {
    const cats = [...new Set(dados.map(m => m.categoria))] as string[];
    setCategorias(cats.sort());
  };

  // ============================================================================
  // PARSER DE CSV OTIMIZADO (Super rápido, não bloqueia o navegador)
  // ============================================================================
  const parseCSVLine = (text: string) => {
    const ret = [];
    let inQuote = false;
    let value = '';
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (inQuote) {
        if (char === '"') {
          if (i + 1 < text.length && text[i + 1] === '"') {
            value += '"';
            i++; 
          } else {
            inQuote = false;
          }
        } else {
          value += char;
        }
      } else {
        if (char === '"') {
          inQuote = true;
        } else if (char === ',') {
          ret.push(value);
          value = '';
        } else {
          value += char;
        }
      }
    }
    ret.push(value);
    return ret.map(s => s.trim());
  };

  const processarCSV = (texto: string) => {
    const linhas = texto.split('\n');
    let categoriaAtual = 'Sem Categoria';
    const resultados = [];

    for (let i = 0; i < linhas.length; i++) {
      const linhaLimpa = linhas[i].trim();
      if (!linhaLimpa) continue;

      const colunas = parseCSVLine(linhaLimpa);

      // Identifica título da categoria
      if (colunas[0] === 'Código:') {
        categoriaAtual = colunas[5] || colunas[2] || 'Desconhecida';
        continue;
      }

      if (colunas[1] === 'Produto') continue;

      const id = colunas[1];
      
      // Valida se tem ID numérico
      if (id && !isNaN(parseInt(id))) {
        // Encontra a descrição (geralmente nas últimas colunas)
        let descricao = '';
        for(let c = colunas.length - 1; c >= 2; c--) {
            if (colunas[c] && colunas[c] !== '') {
                descricao = colunas[c];
                break;
            }
        }

        if(descricao) {
            resultados.push({
                id: id,
                categoria: categoriaAtual,
                descricao: descricao.toUpperCase()
            });
        }
      }
    }

    return resultados;
  };

  // Guardar na Nuvem (Firestore)
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.readAsText(file, 'ISO-8859-1'); 
    
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const dadosProcessados = processarCSV(text);
        
        if (dadosProcessados.length === 0) {
          throw new Error("Não foram encontrados dados. Verifique se o ficheiro é o CSV correto.");
        }

        // Grava no Firestore (Serializado em JSON num único documento para eficiência)
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'medicamentos_db', 'lista_principal');
        await setDoc(docRef, { 
          items: JSON.stringify(dadosProcessados),
          updatedAt: new Date().toISOString()
        });
        
        setMedicamentos(dadosProcessados);
        extrairCategorias(dadosProcessados);
        setPaginaAtual(1);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Erro ao processar o ficheiro CSV.');
      } finally {
        setLoading(false);
      }
    };
    
    reader.onerror = () => {
      setError('Erro de leitura do ficheiro pelo navegador.');
      setLoading(false);
    };
  };

  const confirmarLimparBaseDados = async () => {
    setShowConfirmDelete(false);
    setLoading(true);
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'medicamentos_db', 'lista_principal');
      await deleteDoc(docRef);
      setMedicamentos([]);
      setCategorias([]);
    } catch (err) {
      setError('Erro ao apagar dados na nuvem.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // LÓGICA DE FILTRO E BUSCA
  // ============================================================================
  const medicamentosFiltrados = useMemo(() => {
    return medicamentos.filter(med => {
      const matchCategoria = categoriaSelecionada === 'Todas' || med.categoria === categoriaSelecionada;
      const matchBusca = med.descricao.includes(busca.toUpperCase()) || med.id.includes(busca);
      return matchCategoria && matchBusca;
    });
  }, [medicamentos, busca, categoriaSelecionada]);

  // Lógica de Paginação
  const totalPaginas = Math.ceil(medicamentosFiltrados.length / itensPorPagina);
  const indexUltimoItem = paginaAtual * itensPorPagina;
  const indexPrimeiroItem = indexUltimoItem - itensPorPagina;
  const medicamentosExibidos = medicamentosFiltrados.slice(indexPrimeiroItem, indexUltimoItem);

  // Zera a página quando faz uma nova busca
  useEffect(() => {
    setPaginaAtual(1);
  }, [busca, categoriaSelecionada]);

  // ============================================================================
  // INTERFACE UTILIZADOR (UI)
  // ============================================================================
  return (
    <div className="bg-gray-50 font-sans text-gray-800 h-full flex flex-col rounded-2xl overflow-hidden shadow-sm border border-slate-200">
      
      {/* Cabeçalho */}
      <header className="bg-slate-800 text-white p-4 shrink-0">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500 p-2 rounded-lg shadow-inner">
              <Pill className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-wide flex items-center gap-2">
                SisPsico
                {user ? (
                  <span className="flex items-center text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded-full border border-green-500/30">
                    <Cloud className="w-3 h-3 mr-1" /> Nuvem Online
                  </span>
                ) : (
                  <span className="flex items-center text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded-full border border-red-500/30">
                    <CloudOff className="w-3 h-3 mr-1" /> Desconectado
                  </span>
                )}
              </h1>
              <p className="text-slate-300 text-sm">Consulta de Medicamentos Sujeitos a Controlo Especial</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-full border border-slate-700">
            <Database className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-slate-300">
              Registos na DB: <strong className="text-white">{medicamentos.length}</strong>
            </span>
            {medicamentos.length > 0 && (
              <button 
                onClick={() => setShowConfirmDelete(true)}
                className="ml-3 text-red-400 hover:text-red-200 transition-colors bg-red-400/10 p-1 rounded-full"
                title="Apagar Base de Dados da Nuvem"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 relative">
        
        {/* Alertas */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded shadow-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* ESTADO VAZIO: DB Vazia, pedir para inicializar */}
        {medicamentos.length === 0 && !loading && (
          <div className="bg-white p-10 rounded-xl shadow-sm border border-slate-200 text-center flex flex-col items-center mt-10">
            <Database className="w-20 h-20 text-slate-200 mb-4" />
            <h2 className="text-2xl font-semibold text-slate-700 mb-2">A Base de Dados está Vazia</h2>
            <p className="text-slate-500 max-w-lg mb-8">
              Para começar a usar a aplicação, carregue o ficheiro <code className="bg-slate-100 px-2 py-1 rounded text-slate-700 font-mono">R_LISTA_DCB.csv</code>.
              <strong> Ele ficará guardado na Nuvem.</strong> Nas próximas vezes, a aplicação já vai abrir com os dados prontos automaticamente.
            </p>
            
            <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-medium shadow-lg transition-all flex items-center gap-3 hover:-translate-y-1">
              <Upload className="w-6 h-6" />
              <span>Inicializar Base de Dados (Upload CSV)</span>
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                onChange={handleFileUpload}
              />
            </label>
          </div>
        )}

        {/* ESTADO CARREGANDO */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-500 font-medium">A sincronizar com a nuvem...</p>
          </div>
        )}

        {/* ESTADO COM DADOS: Interface de Consulta */}
        {medicamentos.length > 0 && !loading && (
          <div className="space-y-6">
            
            {/* Barra de Filtros */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
              <div className="flex-1 w-full relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="text-slate-400 w-5 h-5" />
                </div>
                <input
                  type="text"
                  placeholder="Pesquisar por nome do medicamento ou código ID..."
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              
              <div className="w-full md:w-1/3">
                <select
                  className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-slate-700"
                  value={categoriaSelecionada}
                  onChange={(e) => setCategoriaSelecionada(e.target.value)}
                >
                  <option value="Todas">Todas as Listas / Categorias</option>
                  {categorias.map((cat, idx) => (
                    <option key={idx} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Botão para atualizar dados na DB */}
              <label className="w-full md:w-auto cursor-pointer bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 justify-center shrink-0">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="text-sm">Substituir CSV</span>
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  onChange={handleFileUpload}
                />
              </label>
            </div>

            {/* Resultados / Tabela */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider font-semibold">
                      <th className="p-4 w-24">ID / Cód</th>
                      <th className="p-4 w-1/4">Categoria / Lista</th>
                      <th className="p-4">Descrição do Produto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {medicamentosExibidos.length > 0 ? (
                      medicamentosExibidos.map((med) => (
                        <tr key={med.id} className="hover:bg-blue-50/50 transition-colors group">
                          <td className="p-4 text-slate-500 text-sm font-mono">{med.id}</td>
                          <td className="p-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 group-hover:bg-indigo-100 transition-colors">
                              {med.categoria}
                            </span>
                          </td>
                          <td className="p-4 text-slate-800 font-medium text-sm">
                            {med.descricao}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="p-12 text-center text-slate-500">
                          <Search className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                          <p>Nenhum medicamento encontrado para esta pesquisa.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Paginação */}
              {totalPaginas > 1 && (
                <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <span className="text-sm text-slate-500 text-center sm:text-left">
                    A mostrar <span className="font-medium text-slate-700">{indexPrimeiroItem + 1}</span> até <span className="font-medium text-slate-700">{Math.min(indexUltimoItem, medicamentosFiltrados.length)}</span> de <span className="font-medium text-slate-700">{medicamentosFiltrados.length}</span> resultados
                  </span>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPaginaAtual(prev => Math.max(prev - 1, 1))}
                      disabled={paginaAtual === 1}
                      className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-slate-600 transition-colors flex items-center"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setPaginaAtual(prev => Math.min(prev + 1, totalPaginas))}
                      disabled={paginaAtual === totalPaginas}
                      className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-slate-600 transition-colors flex items-center"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
            
          </div>
        )}

        {/* Modal de Confirmação de Exclusão */}
        {showConfirmDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
              <div className="flex items-center gap-4 mb-4 text-red-600">
                <AlertCircle className="w-8 h-8" />
                <h3 className="text-xl font-bold">Atenção</h3>
              </div>
              <p className="text-slate-600 mb-6">
                Isto apagará a base de dados da nuvem para <strong>todos os utilizadores</strong>. Tem a certeza que deseja continuar?
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setShowConfirmDelete(false)}
                  className="px-4 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmarLimparBaseDados}
                  className="px-4 py-2 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  Sim, apagar dados
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
