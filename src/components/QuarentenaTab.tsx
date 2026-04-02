import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import { FileText, Download, CheckCircle, XCircle, MinusCircle, AlertCircle, Save, Mail, ClipboardCheck, Table, Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

export default function QuarentenaTab({ user }: { user: any }) {
  const [isPdfReady, setIsPdfReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const pdfRef = useRef(null);

  // Carrega a biblioteca html2pdf dinamicamente
  useEffect(() => {
    if ((window as any).html2pdf) {
      setIsPdfReady(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.async = true;
    script.onload = () => setIsPdfReady(true);
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const [formData, setFormData] = useState({
    supplier: '',
    carrier: '',
    invoice: '',
    orderNumber: '',
    volumes: '',
    collaborator: '',
    pharmacist: user?.displayName || '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].substring(0, 5),
    observations: '',
    finalDecision: '' // 'aprovado' ou 'reprovado'
  });

  // Checklist - Etapa 2: Triagem (Recebimento)
  const checklistItems = [
    { id: 1, text: "As embalagens coletivas encontram-se íntegras e foram mantidas rigorosamente fechadas, sem abertura prévia à inspeção técnica." },
    { id: 2, text: "Todos os volumes recebidos foram devidamente identificados com a sinalização 'EM QUARENTENA — AGUARDANDO CONFERÊNCIA FARMACÊUTICA'." },
    { id: 3, text: "Medicamentos termolábeis foram imediatamente segregados e armazenados no Refrigerador de Inspeção, garantindo a manutenção da cadeia de frio." },
    { id: 4, text: "Os demais medicamentos (temperatura ambiente) foram corretamente direcionados e alocados no Armário de Quarentena do setor." },
    { id: 5, text: "Os psicotrópicos foram retidos na área de quarentena, vetando o seu direcionamento direto à sala de psicotrópicos nesta etapa." }
  ];

  // Checklist - Etapa 4: Conferência Física (Farmacêutico)
  const pharmacyItems = [
    { id: 'p1', crit: 'DCB (Denominação Comum Brasileira)', como: 'Comparar rótulo do produto × pedido de compra × nota fiscal', apr: 'DCB idêntica ao pedido', rep: 'Qualquer divergência na substância ativa' },
    { id: 'p2', crit: 'Forma farmacêutica', como: 'Ler o rótulo: comprimido, cápsula, solução injetável, etc.', apr: 'Forma idêntica ao pedido', rep: 'Ex: chegou solução quando pediu comprimido' },
    { id: 'p3', crit: 'Concentração', como: 'Ler rótulo: mg, mg/mL, mcg/mL, etc.', apr: 'Concentração idêntica ao pedido', rep: 'Qualquer diferença — mesmo que pareça equivalente' },
    { id: 'p4', crit: 'Validade residual', como: 'Calcular: (meses restantes / prazo total) × 100', apr: '≥ 75% do prazo total', rep: '< 75% do prazo total (exige carta de troca)' },
    { id: 'p5', crit: 'Quantidade física', como: 'Contar: nº de caixas × unidades por caixa × volumes', apr: 'Igual ao descrito na nota fiscal', rep: 'Qualquer divergência de quantidade' },
    { id: 'p6', crit: 'Número de lote', como: 'Registrar no formulário FOR-01 todos os lotes presentes', apr: 'Registrado corretamente', rep: 'Lote ilegível ou ausente no rótulo' },
    { id: 'p7', crit: 'Integridade das embalagens primárias', como: 'Inspecionar blisteres, ampolas, frascos, lacres', apr: 'Embalagem íntegra', rep: 'Blister rompido, frasco vazado, lacre violado' }
  ];

  const [checks, setChecks] = useState<Record<number | string, string>>({
    1: '', 2: '', 3: '', 4: '', 5: ''
  });

  const [pharmacyChecks, setPharmacyChecks] = useState<Record<string, string>>({
    p1: '', p2: '', p3: '', p4: '', p5: '', p6: '', p7: ''
  });

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheck = (id: number | string, value: string) => {
    setChecks(prev => ({ ...prev, [id]: value }));
  };

  const handlePharmacyCheck = (id: string, value: string) => {
    setPharmacyChecks(prev => ({ ...prev, [id]: value }));
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const saveToDatabase = async () => {
    if (!user) {
      showToast("⚠️ É necessário fazer login para salvar.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        recebimentoChecks: JSON.stringify(checks),
        farmaciaChecks: JSON.stringify(pharmacyChecks),
        dataHoraRegistro: `${formData.date} ${formData.time}`,
        uid: user.uid,
        createdAt: Date.now()
      };

      await addDoc(collection(db, 'quarentenas'), payload);

      showToast("✅ Registro salvo com sucesso no Firebase!");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      showToast("❌ Erro ao comunicar com o servidor. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const sendEmail = () => {
    const subject = encodeURIComponent(`Auditoria de Psicotrópicos - NF: ${formData.invoice || '(Sem NF)'} - ${formData.supplier}`);
    
    const hasDivergence = Object.values(checks).includes('nao-conforme') || Object.values(pharmacyChecks).includes('nao-conforme');
    const statusText = hasDivergence ? '⚠️ ATENÇÃO: AUDITORIA COM DIVERGÊNCIAS (Ver Observações)' : '✅ Auditoria de Psicotrópicos Conforme';
    
    let decisionText = "Pendente";
    if (formData.finalDecision === 'aprovado') decisionText = "✅ LOTE APROVADO";
    if (formData.finalDecision === 'reprovado') decisionText = "❌ LOTE REPROVADO";

    const body = encodeURIComponent(`Olá,

Segue o resumo da auditoria de psicotrópicos no recebimento e conferência física:

STATUS GERAL: ${statusText}
DECISÃO FINAL DO FARMACÊUTICO: ${decisionText}

DADOS DA ENTREGA:
- Fornecedor: ${formData.supplier || 'Não informado'}
- Transportadora: ${formData.carrier || 'Não informada'}
- Nota Fiscal: ${formData.invoice || 'Não informada'}
- Ordem de Compra: ${formData.orderNumber || 'Não informada'}
- Qtd. Volumes: ${formData.volumes || 'Não informada'}
- Data/Hora: ${formData.date.split('-').reverse().join('/')} às ${formData.time}
- Recebedor: ${formData.collaborator || 'Não informado'}
- Farmacêutico: ${formData.pharmacist || 'Não informado'}

OBSERVAÇÕES:
${formData.observations || 'Nenhuma observação registada.'}

Os detalhes completos dos checklists encontram-se no sistema ou no PDF gerado.
`);
    
    const outlookLink = `https://outlook.office.com/mail/deeplink/compose?subject=${subject}&body=${body}`;
    window.open(outlookLink, '_blank');
    
    showToast("📧 A abrir o Outlook (Office 365)...");
  };

  const generatePDF = async () => {
    if (!isPdfReady) {
      showToast("A biblioteca de PDF ainda está a carregar. Tente novamente.");
      return;
    }

    if (isGeneratingPdf) return;

    setIsGeneratingPdf(true);
    showToast("⚙️ A processar o PDF... Aguarde um momento.");

    const element = pdfRef.current;
    const opt = {
      margin: 10,
      filename: `Auditoria_Psicotropicos_NF${formData.invoice || 'S-N'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 1.5, 
        useCORS: true,
        logging: false,
        letterRendering: true
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      await (window as any).html2pdf().set(opt).from(element).save();
      showToast("✅ PDF gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      showToast("❌ Erro ao gerar PDF. Tente novamente.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const downloadCSV = () => {
    const dataToExport = [{
      'Data': formData.date,
      'Hora': formData.time,
      'Fornecedor': formData.supplier,
      'Nº Pedido/OC': formData.orderNumber,
      'Nota Fiscal': formData.invoice,
      'Farmacêutico': formData.pharmacist,
      'Status': formData.status,
      'Motivo Quarentena': formData.quarantineReason,
      ...Object.keys(checks).reduce((acc, key) => {
        acc[`Recebimento: ${key}`] = checks[key] ? 'Conforme' : 'Não Conforme';
        return acc;
      }, {} as any),
      ...Object.keys(pharmacyChecks).reduce((acc, key) => {
        acc[`Farmácia: ${key}`] = pharmacyChecks[key] ? 'Conforme' : 'Não Conforme';
        return acc;
      }, {} as any)
    }];

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `quarentena_${formData.invoice || 'registro'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="font-sans text-slate-800 relative pb-12">
      
      {/* Sistema de Notificação (Toast) */}
      {toastMsg && (
        <div className="fixed top-4 right-4 bg-slate-800 text-white px-6 py-3 rounded-lg shadow-xl z-50 flex items-center gap-2 animate-bounce">
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Controles do Aplicativo */}
      <div className="max-w-[210mm] mx-auto mb-6 flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardCheck className="text-blue-600" />
            Auditoria de Psicotrópicos Completa
          </h1>
          <p className="text-sm text-slate-500 hidden md:block">Preencha as etapas de recebimento e conferência técnica.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={sendEmail} className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all border border-slate-300">
            <Mail size={18} /> <span className="hidden sm:inline">E-mail</span>
          </button>
          <button onClick={saveToDatabase} disabled={isSaving} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-all shadow-sm ${isSaving ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
            <Save size={18} /> <span className="hidden sm:inline">{isSaving ? 'Salvando...' : 'Salvar'}</span>
          </button>
          <button
            onClick={generatePDF}
            disabled={!isPdfReady || isGeneratingPdf}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-all shadow-sm
              ${(!isPdfReady || isGeneratingPdf) ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isGeneratingPdf ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
            <span className="hidden sm:inline">{isGeneratingPdf ? 'Gerando...' : 'Baixar PDF'}</span>
          </button>
        </div>
      </div>

      {/* Container que será convertido em PDF */}
      <div className="max-w-[210mm] mx-auto bg-white shadow-lg rounded-none sm:rounded-xl overflow-hidden">
        <div ref={pdfRef} className="p-8 md:p-10 bg-white" id="pdf-content">
          
          {/* Cabeçalho do Documento */}
          <div className="border-b-2 border-slate-800 pb-4 mb-6 text-center">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-wide">
              Auditoria de Psicotrópicos
            </h2>
            <h3 className="text-sm font-semibold text-slate-600 mt-1 uppercase">
              Etapas: Recebimento e Conferência Farmacêutica
            </h3>
          </div>

          {/* Seção 1: Dados Gerais */}
          <div className="mb-6">
            <h4 className="text-xs font-bold text-slate-800 uppercase border-b border-slate-200 pb-1 mb-3 flex items-center gap-2">
              1. Identificação da Entrega
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex flex-col col-span-2">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Fornecedor</label>
                <input type="text" name="supplier" value={formData.supplier} onChange={handleInputChange} className="mt-1 pb-1 border-b border-slate-300 focus:border-blue-500 outline-none w-full bg-transparent text-slate-900 font-medium text-sm" placeholder="Empresa emissora da NF"/>
              </div>
              <div className="flex flex-col col-span-2">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Transportadora</label>
                <input type="text" name="carrier" value={formData.carrier} onChange={handleInputChange} className="mt-1 pb-1 border-b border-slate-300 focus:border-blue-500 outline-none w-full bg-transparent text-slate-900 font-medium text-sm" placeholder="Empresa que realizou a entrega"/>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Ordem de Compra</label>
                <input type="text" name="orderNumber" value={formData.orderNumber} onChange={handleInputChange} className="mt-1 pb-1 border-b border-slate-300 focus:border-blue-500 outline-none w-full bg-transparent text-slate-900 font-medium text-sm" placeholder="Nº do pedido"/>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Nota Fiscal (NF)</label>
                <input type="text" name="invoice" value={formData.invoice} onChange={handleInputChange} className="mt-1 pb-1 border-b border-slate-300 focus:border-blue-500 outline-none w-full bg-transparent text-slate-900 font-medium text-sm" placeholder="Ex: 123456-7"/>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Qtd. Volumes</label>
                <input type="number" name="volumes" value={formData.volumes} onChange={handleInputChange} className="mt-1 pb-1 border-b border-slate-300 focus:border-blue-500 outline-none w-full bg-transparent text-slate-900 font-medium text-sm" placeholder="Ex: 5 caixas"/>
              </div>
              <div className="flex gap-2">
                <div className="flex flex-col w-1/2">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Data</label>
                  <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="mt-1 pb-1 border-b border-slate-300 focus:border-blue-500 outline-none w-full bg-transparent text-slate-900 font-medium text-sm"/>
                </div>
                <div className="flex flex-col w-1/2">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Hora</label>
                  <input type="time" name="time" value={formData.time} onChange={handleInputChange} className="mt-1 pb-1 border-b border-slate-300 focus:border-blue-500 outline-none w-full bg-transparent text-slate-900 font-medium text-sm"/>
                </div>
              </div>
            </div>
          </div>

          {/* Seção 2: Checklist Triagem */}
          <div className="mb-6">
            <h4 className="text-xs font-bold text-slate-800 uppercase border-b border-slate-200 pb-1 mb-3 flex items-center justify-between">
              <span>2. Triagem e Encaminhamento p/ Quarentena (Recebimento)</span>
            </h4>
            <div className="space-y-2">
              {checklistItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded gap-2" style={{ pageBreakInside: 'avoid' }}>
                  <p className="text-[11px] text-slate-700 flex-1 leading-tight">
                    <span className="font-bold text-slate-400 mr-1">{item.id}.</span> {item.text}
                  </p>
                  <div className="flex gap-1 shrink-0">
                    <label className={`cursor-pointer px-2 py-1 rounded text-[10px] font-bold transition-colors ${checks[item.id] === 'conforme' ? 'bg-green-100 text-green-800 border-green-300 border' : 'bg-white border-slate-200 border text-slate-500'}`}>
                      <input type="radio" name={`check-${item.id}`} value="conforme" className="hidden" onChange={() => handleCheck(item.id, 'conforme')} /> C
                    </label>
                    <label className={`cursor-pointer px-2 py-1 rounded text-[10px] font-bold transition-colors ${checks[item.id] === 'nao-conforme' ? 'bg-red-100 text-red-800 border-red-300 border' : 'bg-white border-slate-200 border text-slate-500'}`}>
                      <input type="radio" name={`check-${item.id}`} value="nao-conforme" className="hidden" onChange={() => handleCheck(item.id, 'nao-conforme')} /> NC
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Seção 3: Conferência Física (NOVO) */}
          <div className="mb-6">
            <h4 className="text-xs font-bold text-slate-800 uppercase border-b border-slate-200 pb-1 mb-3 flex items-center justify-between">
              <span>4. Conferência Física dos Itens na Quarentena (Farmacêutico)</span>
            </h4>
            <p className="text-[10px] text-slate-500 mb-2 font-medium italic">Para cada item presente na quarentena, conferir TODOS os critérios abaixo:</p>
            
            <div className="border border-slate-300 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-[10px] uppercase text-slate-700">
                    <th className="p-2 w-1/5 font-bold border-r border-slate-300">Critério</th>
                    <th className="p-2 w-1/4 font-bold border-r border-slate-300">Como Verificar</th>
                    <th className="p-2 w-1/5 font-bold border-r border-slate-300 text-green-700">Aprovado se...</th>
                    <th className="p-2 w-1/5 font-bold border-r border-slate-300 text-red-700">Reprovado se...</th>
                    <th className="p-2 w-24 font-bold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="text-[10px] text-slate-800 align-top">
                  {pharmacyItems.map((item, index) => (
                    <tr key={item.id} className={`border-b border-slate-200 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`} style={{ pageBreakInside: 'avoid' }}>
                      <td className="p-2 border-r border-slate-200 font-bold">{item.crit}</td>
                      <td className="p-2 border-r border-slate-200">{item.como}</td>
                      <td className="p-2 border-r border-slate-200 text-green-700">{item.apr}</td>
                      <td className="p-2 border-r border-slate-200 text-red-700">{item.rep}</td>
                      <td className="p-2 text-center align-middle">
                        <div className="flex flex-col gap-1 items-center justify-center">
                          <label className={`cursor-pointer w-full text-center py-1 rounded text-[9px] font-bold transition-colors ${pharmacyChecks[item.id] === 'conforme' ? 'bg-green-100 text-green-800 border-green-300 border' : 'bg-white border-slate-300 border text-slate-500'}`}>
                            <input type="radio" name={`pcheck-${item.id}`} value="conforme" className="hidden" onChange={() => handlePharmacyCheck(item.id, 'conforme')} /> C
                          </label>
                          <label className={`cursor-pointer w-full text-center py-1 rounded text-[9px] font-bold transition-colors ${pharmacyChecks[item.id] === 'nao-conforme' ? 'bg-red-100 text-red-800 border-red-300 border' : 'bg-white border-slate-300 border text-slate-500'}`}>
                            <input type="radio" name={`pcheck-${item.id}`} value="nao-conforme" className="hidden" onChange={() => handlePharmacyCheck(item.id, 'nao-conforme')} /> NC
                          </label>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(Object.values(checks).includes('nao-conforme') || Object.values(pharmacyChecks).includes('nao-conforme')) && (
              <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-800 flex items-start gap-2 text-xs">
                <AlertCircle className="shrink-0 mt-0.5" size={14} />
                <p className="font-medium">Existem itens marcados como "Não Conforme" (NC). Registe os detalhes nas observações.</p>
              </div>
            )}
          </div>

          {/* Seção 4: Decisão Final (NOVO) e Observações */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8" style={{ pageBreakInside: 'avoid' }}>
            
            <div className="md:col-span-1 bg-slate-50 p-4 border border-slate-300 rounded-lg flex flex-col justify-center">
              <h4 className="text-xs font-bold text-slate-800 uppercase mb-3 text-center">
                5. Decisão do Lote
              </h4>
              <div className="flex flex-col gap-3">
                <label className={`cursor-pointer flex items-center justify-center gap-2 p-3 rounded-md border-2 transition-all ${formData.finalDecision === 'aprovado' ? 'bg-green-50 border-green-500 text-green-800 font-bold' : 'bg-white border-slate-200 text-slate-600'}`}>
                  <input type="radio" name="decision" value="aprovado" className="hidden" onChange={(e) => setFormData({...formData, finalDecision: e.target.value})} />
                  <CheckCircle size={18} className={formData.finalDecision === 'aprovado' ? 'text-green-600' : 'text-slate-400'}/>
                  APROVADO
                </label>
                <label className={`cursor-pointer flex items-center justify-center gap-2 p-3 rounded-md border-2 transition-all ${formData.finalDecision === 'reprovado' ? 'bg-red-50 border-red-500 text-red-800 font-bold' : 'bg-white border-slate-200 text-slate-600'}`}>
                  <input type="radio" name="decision" value="reprovado" className="hidden" onChange={(e) => setFormData({...formData, finalDecision: e.target.value})} />
                  <XCircle size={18} className={formData.finalDecision === 'reprovado' ? 'text-red-600' : 'text-slate-400'}/>
                  REPROVADO
                </label>
              </div>
            </div>

            <div className="md:col-span-2 flex flex-col">
              <h4 className="text-xs font-bold text-slate-800 uppercase border-b border-slate-200 pb-1 mb-2">
                Observações / Divergências / Justificativas
              </h4>
              <textarea 
                name="observations" value={formData.observations} onChange={handleInputChange}
                className="flex-1 w-full p-2 bg-slate-50 border border-slate-200 rounded outline-none focus:border-blue-500 text-xs text-slate-800 resize-none"
                placeholder="Registe divergências da triagem, avarias, lotes reprovados, ou justifique reprovações de itens da quarentena..."
              ></textarea>
            </div>

          </div>

          {/* Seção 5: Assinaturas */}
          <div className="mt-8 pt-6" style={{ pageBreakInside: 'avoid' }}>
            <div className="grid grid-cols-2 gap-8">
              <div className="flex flex-col items-center">
                <div className="w-full border-b border-slate-800 mb-1 h-6 relative">
                  <div className="absolute bottom-0 w-full text-center text-slate-800 font-medium text-sm">
                    {formData.collaborator}
                  </div>
                </div>
                <input type="text" name="collaborator" value={formData.collaborator} onChange={handleInputChange} className="text-center outline-none bg-transparent placeholder-slate-400 text-[11px] w-full" placeholder="Nome do Recebedor"/>
                <span className="text-[10px] font-bold text-slate-500 uppercase mt-1">Colaborador do Recebimento</span>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-full border-b border-slate-800 mb-1 h-6 relative">
                  <div className="absolute bottom-0 w-full text-center text-slate-800 font-medium text-sm">
                    {formData.pharmacist}
                  </div>
                </div>
                <input type="text" name="pharmacist" value={formData.pharmacist} onChange={handleInputChange} className="text-center outline-none bg-transparent placeholder-slate-400 text-[11px] w-full" placeholder="Nome do Farmacêutico"/>
                <span className="text-[10px] font-bold text-slate-500 uppercase mt-1">Farmacêutico Responsável</span>
              </div>
            </div>
          </div>

          {/* Rodapé do PDF */}
          <div className="mt-8 border-t border-slate-200 pt-2 flex justify-between text-[9px] text-slate-400 uppercase tracking-wider font-semibold">
            <span>Doc. Registro Interno</span>
            <span>Gerado em: {formData.date.split('-').reverse().join('/')} às {formData.time}</span>
          </div>

        </div>
      </div>
    </div>
  );
}
