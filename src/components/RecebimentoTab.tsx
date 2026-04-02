import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import { FileText, Download, CheckCircle, XCircle, MinusCircle, AlertCircle, Save, Mail, Table } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

export default function RecebimentoTab({ user }: { user: any }) {
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
    temperature: '',
    collaborator: user?.displayName || '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].substring(0, 5),
    observations: ''
  });

  const checklistItems = [
    { id: 1, text: "Prazo de Entrega: O prazo está de acordo com o estabelecido na ordem de compra?" },
    { id: 2, text: "Dados da OC: Os dados estão de acordo com a OC? (valor, quantidade, condição de pagamento)" },
    { id: 3, text: "Horário: A entrega foi efetuada dentro do horário de atendimento do Recebimento?" },
    { id: 4, text: "Marca: A marca dos produtos a receber está de acordo com a informada na ordem de compra?" },
    { id: 5, text: "Medicamentos Refrigerados: A temperatura está dentro da curva térmica de 2º a 8ºC?" },
    { id: 6, text: "Validade: A validade do produto está maior que 30% da vida útil e 90 dias para dietas?" },
    { id: 7, text: "Lote: O lote informado na NF é igual ao Físico? (Conferir todos os lotes)" },
    { id: 8, text: "Controlados: A NF possui a sigla obrigatória de acordo com a característica do medicamento?" },
    { id: 9, text: "Integridade: As embalagens estão íntegras, sem avarias que comprometam o produto?" },
    { id: 10, text: "Nota Fiscal: A nota fiscal física foi recebida?" }
  ];

  const [checks, setChecks] = useState<Record<number, string>>({
    1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '', 8: '', 9: '', 10: ''
  });

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheck = (id: number, value: string) => {
    setChecks(prev => ({ ...prev, [id]: value }));
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  // Função para salvar no Banco de Dados (Firebase Firestore)
  const saveToDatabase = async () => {
    if (!user) {
      showToast("⚠️ É necessário fazer login para salvar.");
      return;
    }
    
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        checklist: JSON.stringify(checks),
        dataHoraRegistro: `${formData.date} ${formData.time}`,
        uid: user.uid,
        createdAt: Date.now()
      };

      await addDoc(collection(db, 'recebimentos'), payload);

      showToast("✅ Registro salvo com sucesso no Firebase!");
      
    } catch (error) {
      console.error("Erro ao salvar:", error);
      showToast("❌ Erro ao comunicar com o servidor. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  // Função para preparar e abrir o E-mail
  const sendEmail = () => {
    const subject = encodeURIComponent(`Conferência de Recebimento - NF: ${formData.invoice || '(Sem NF)'} - ${formData.supplier}`);
    
    // Identificar divergências
    const hasDivergence = Object.values(checks).includes('nao');
    const statusText = hasDivergence ? '⚠️ ATENÇÃO: ENTREGA COM DIVERGÊNCIAS (Ver Observações)' : '✅ Entrega Conforme';

    const body = encodeURIComponent(`Olá,

Segue o resumo da conferência de recebimento efetuada:

STATUS: ${statusText}

DADOS DA ENTREGA:
- Fornecedor: ${formData.supplier || 'Não informado'}
- Transportadora: ${formData.carrier || 'Não informada'}
- Nota Fiscal: ${formData.invoice || 'Não informada'}
- Ordem de Compra: ${formData.orderNumber || 'Não informada'}
- Qtd. Volumes: ${formData.volumes || 'Não informada'}
- Temperatura Aferida: ${formData.temperature ? formData.temperature + ' °C' : 'N/A'}
- Data/Hora: ${formData.date.split('-').reverse().join('/')} às ${formData.time}
- Colaborador responsável: ${formData.collaborator || 'Não informado'}

OBSERVAÇÕES:
${formData.observations || 'Nenhuma observação registada.'}

Os detalhes completos do checklist encontram-se no sistema ou no PDF gerado.
`);
    
    // Link direto para o compositor de e-mail do Office 365 (Outlook Web)
    const outlookLink = `https://outlook.office.com/mail/deeplink/compose?subject=${subject}&body=${body}`;
    
    // Abre num novo separador (ignora bloqueios locais do navegador)
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
      filename: `Conferencia_Recebimento_NF${formData.invoice || 'S-N'}.pdf`,
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
      'Transportadora': formData.carrier,
      'Entregador': formData.deliveryPerson,
      'Temperatura (ºC)': formData.temperature,
      'Volume/Qtd': formData.volume,
      'Colaborador': formData.collaborator,
      ...Object.keys(checks).reduce((acc, key) => {
        acc[key] = checks[key] ? 'Conforme' : 'Não Conforme';
        return acc;
      }, {} as any)
    }];

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `recebimento_${formData.invoice || 'registro'}.csv`);
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

      {/* Controles do Aplicativo (Não aparecem no PDF) */}
      <div className="max-w-4xl mx-auto mb-6 flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="text-blue-600" />
            Conferência Administrativa
          </h1>
          <p className="text-sm text-slate-500 hidden md:block">Preencha os dados e escolha a ação pretendida.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Botão de E-mail */}
          <button
            onClick={sendEmail}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all border border-slate-300"
            title="Abre o seu programa de email com os dados preenchidos"
          >
            <Mail size={18} />
            <span className="hidden sm:inline">E-mail</span>
          </button>

          {/* Botão de Salvar (Banco de Dados) */}
          <button
            onClick={saveToDatabase}
            disabled={isSaving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-all shadow-sm
              ${isSaving ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            <Save size={18} />
            <span className="hidden sm:inline">{isSaving ? 'Salvando...' : 'Salvar Registro'}</span>
          </button>

          {/* Botão de Planilha */}
          <button
            onClick={downloadCSV}
            disabled={!isPdfReady}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-all shadow-sm
              ${isPdfReady ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-400 cursor-not-allowed'}`}
          >
            <Table size={18} />
            <span className="hidden sm:inline">Baixar Planilha</span>
          </button>

          {/* Botão de PDF */}
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
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-none sm:rounded-xl overflow-hidden">
        <div ref={pdfRef} className="p-8 md:p-12 bg-white" id="pdf-content">
          
          {/* Cabeçalho do Documento */}
          <div className="border-b-2 border-slate-800 pb-6 mb-8 text-center">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-wide">
              Checklist Técnico de Recebimento
            </h2>
            <h3 className="text-lg font-semibold text-slate-600 mt-1">
              Etapa: Recebimento de Fornecedor
            </h3>
            <p className="text-xs text-slate-500 mt-2 uppercase tracking-widest">
              Apenas Documentação e Volumes Físicos
            </p>
          </div>

          {/* Seção 1: Dados Gerais */}
          <div className="mb-8">
            <h4 className="text-sm font-bold text-slate-800 uppercase border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
              1. Identificação da Entrega
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase">Fornecedor</label>
                <input 
                  type="text" name="supplier" value={formData.supplier} onChange={handleInputChange}
                  className="mt-1 pb-1 border-b border-slate-300 focus:border-blue-500 outline-none w-full bg-transparent text-slate-900 font-medium placeholder-slate-300"
                  placeholder="Empresa emissora da NF"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase">Transportadora</label>
                <input 
                  type="text" name="carrier" value={formData.carrier} onChange={handleInputChange}
                  className="mt-1 pb-1 border-b border-slate-300 focus:border-blue-500 outline-none w-full bg-transparent text-slate-900 font-medium placeholder-slate-300"
                  placeholder="Empresa que realizou a entrega"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase">Ordem de Compra (OC)</label>
                <input 
                  type="text" name="orderNumber" value={formData.orderNumber} onChange={handleInputChange}
                  className="mt-1 pb-1 border-b border-slate-300 focus:border-blue-500 outline-none w-full bg-transparent text-slate-900 font-medium placeholder-slate-300"
                  placeholder="Nº do pedido"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase">Número da Nota Fiscal (NF)</label>
                <input 
                  type="text" name="invoice" value={formData.invoice} onChange={handleInputChange}
                  className="mt-1 pb-1 border-b border-slate-300 focus:border-blue-500 outline-none w-full bg-transparent text-slate-900 font-medium placeholder-slate-300"
                  placeholder="Ex: 123456-7"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase">Qtd. Volumes Recebidos</label>
                <input 
                  type="number" name="volumes" value={formData.volumes} onChange={handleInputChange}
                  className="mt-1 pb-1 border-b border-slate-300 focus:border-blue-500 outline-none w-full bg-transparent text-slate-900 font-medium placeholder-slate-300"
                  placeholder="Ex: 5 caixas"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-slate-500 uppercase">Temp. Aferida (°C)</label>
                <input 
                  type="text" name="temperature" value={formData.temperature} onChange={handleInputChange}
                  className="mt-1 pb-1 border-b border-slate-300 focus:border-blue-500 outline-none w-full bg-transparent text-slate-900 font-medium placeholder-slate-300"
                  placeholder="Ex: 4.5"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex flex-col w-1/2">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Data</label>
                  <input 
                    type="date" name="date" value={formData.date} onChange={handleInputChange}
                    className="mt-1 pb-1 border-b border-slate-300 focus:border-blue-500 outline-none w-full bg-transparent text-slate-900 font-medium"
                  />
                </div>
                <div className="flex flex-col w-1/2">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Hora</label>
                  <input 
                    type="time" name="time" value={formData.time} onChange={handleInputChange}
                    className="mt-1 pb-1 border-b border-slate-300 focus:border-blue-500 outline-none w-full bg-transparent text-slate-900 font-medium"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seção 2: Checklist */}
          <div className="mb-8">
            <h4 className="text-sm font-bold text-slate-800 uppercase border-b border-slate-200 pb-2 mb-4 flex items-center justify-between">
              <span>2. Checklist de Verificação</span>
              <span className="text-xs font-normal text-slate-500 normal-case flex gap-4">
                <span className="flex items-center gap-1"><CheckCircle size={14} className="text-green-600"/> Sim</span>
                <span className="flex items-center gap-1"><XCircle size={14} className="text-red-600"/> Não</span>
                <span className="flex items-center gap-1"><MinusCircle size={14} className="text-slate-400"/> N/A</span>
              </span>
            </h4>
            
            <div className="space-y-4">
              {checklistItems.map((item) => (
                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg gap-4">
                  <p className="text-sm text-slate-700 flex-1 leading-snug">
                    <span className="font-bold text-slate-400 mr-2">{item.id}.</span>
                    {item.text}
                  </p>
                  
                  <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <label className={`flex items-center gap-1 cursor-pointer px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${checks[item.id] === 'sim' ? 'bg-green-100 text-green-800 border-green-300 border' : 'bg-white border-slate-200 border text-slate-500 hover:bg-slate-100'}`}>
                      <input type="radio" name={`check-${item.id}`} value="sim" className="hidden" onChange={() => handleCheck(item.id, 'sim')} />
                      Sim
                    </label>
                    <label className={`flex items-center gap-1 cursor-pointer px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${checks[item.id] === 'nao' ? 'bg-red-100 text-red-800 border-red-300 border' : 'bg-white border-slate-200 border text-slate-500 hover:bg-slate-100'}`}>
                      <input type="radio" name={`check-${item.id}`} value="nao" className="hidden" onChange={() => handleCheck(item.id, 'nao')} />
                      Não
                    </label>
                    <label className={`flex items-center gap-1 cursor-pointer px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${checks[item.id] === 'nao-aplica' ? 'bg-slate-200 text-slate-800 border-slate-400 border' : 'bg-white border-slate-200 border text-slate-500 hover:bg-slate-100'}`}>
                      <input type="radio" name={`check-${item.id}`} value="nao-aplica" className="hidden" onChange={() => handleCheck(item.id, 'nao-aplica')} />
                      N/A
                    </label>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Alerta Visual se houver Não Conforme */}
            {Object.values(checks).includes('nao') && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-800">
                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                <p className="text-sm font-medium">Atenção: Existem itens marcados como "Não". Justifique as divergências no campo de observações abaixo e acione o responsável técnico caso necessário.</p>
              </div>
            )}
          </div>

          {/* Seção 3: Observações */}
          <div className="mb-12">
            <h4 className="text-sm font-bold text-slate-800 uppercase border-b border-slate-200 pb-2 mb-4">
              3. Observações / Divergências
            </h4>
            <textarea 
              name="observations" 
              value={formData.observations} 
              onChange={handleInputChange}
              rows={4}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-sm text-slate-800 resize-none"
              placeholder="Descreva aqui qualquer irregularidade de volume, avarias, temperatura fora do padrão ou falta de documentação..."
            ></textarea>
          </div>

          {/* Seção 4: Assinaturas */}
          <div className="mt-16 pt-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="flex flex-col items-center">
                <div className="w-full border-b border-slate-800 mb-2 h-8 relative">
                  <div className="absolute bottom-0 w-full text-center text-slate-800 font-medium text-lg">
                    {formData.collaborator}
                  </div>
                </div>
                <input 
                  type="text" name="collaborator" value={formData.collaborator} onChange={handleInputChange}
                  className="text-center outline-none bg-transparent placeholder-slate-400 text-sm w-full"
                  placeholder="Digite o seu nome aqui"
                />
                <span className="text-xs font-bold text-slate-500 uppercase mt-1">Colaborador do Recebimento</span>
                <span className="text-xs text-slate-400 mt-1">Assinatura / Carimbo</span>
              </div>

              <div className="flex flex-col items-center opacity-50">
                <div className="w-full border-b border-slate-800 mb-2 h-8"></div>
                <span className="text-xs font-bold text-slate-500 uppercase mt-1">Responsável Técnico / Farmacêutico</span>
                <span className="text-xs text-slate-400 mt-1">(Preencher apenas se houver divergência técnica)</span>
              </div>
            </div>
          </div>

          {/* Rodapé do PDF */}
          <div className="mt-12 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400 uppercase tracking-wider">
            Documento gerado eletronicamente em {formData.date.split('-').reverse().join('/')} às {formData.time}
          </div>

        </div>
      </div>
    </div>
  );
}
