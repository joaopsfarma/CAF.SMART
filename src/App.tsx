import React, { useState, useEffect, useRef } from 'react';
import { FileText, Download, CheckCircle, XCircle, MinusCircle, AlertCircle, Save, Mail, Menu, X, LayoutDashboard, ClipboardCheck, History, Settings, Archive, Calculator, Scissors, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { Logo } from './components/Logo';
import PrevisaoTab from './components/PrevisaoTab';
import FracionamentoTab from './components/FracionamentoTab';
import RecebimentoTab from './components/RecebimentoTab';
import QuarentenaTab from './components/QuarentenaTab';
import FichaTransferenciasTab from './components/FichaTransferenciasTab';

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('quarentena');

  const menuItems = [
    { id: 'recebimento', label: 'Recebimento', icon: ClipboardCheck },
    { id: 'quarentena', label: 'Quarentena', icon: Archive },
    { id: 'previsao', label: 'Previsão', icon: Calculator },
    { id: 'fracionamento', label: 'Fracionamento', icon: Scissors },
    { id: 'fichas', label: 'Ficha de Transferências', icon: FileSpreadsheet },
  ];

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {/* Overlay Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-100 transform transition-transform duration-300 ease-in-out flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)]
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 flex items-center justify-center">
              <Logo className="w-full h-full" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-2xl font-black text-[#0f4c81] tracking-tight leading-none flex items-baseline">
                CAF<span className="text-[#4caf50] mx-0.5 text-3xl leading-none">.</span>SMART
              </h2>
              <span className="text-[9px] font-bold text-[#0f4c81] tracking-widest mt-1 uppercase">Central de Abastecimento Farmacêutico</span>
            </div>
          </div>
          <button className="md:hidden text-slate-400 hover:text-slate-600" onClick={() => setIsSidebarOpen(false)}>
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
          <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wider mb-4 px-3">Menu Principal</div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button 
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false); // Fecha no mobile ao clicar
                }} 
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-200 group
                  ${isActive 
                    ? 'bg-purple-50/80 text-purple-700 shadow-sm border border-purple-100/50' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon size={20} className={`${isActive ? 'text-purple-600' : 'text-slate-400 group-hover:text-slate-500'} transition-colors`} strokeWidth={isActive ? 2.5 : 2} /> 
                  <span className={`font-medium ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
                </div>
                {isActive && <ChevronRight size={16} className="text-purple-400" />}
              </button>
            );
          })}
        </nav>

        <div className="p-6 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-100 to-teal-50 flex items-center justify-center text-sm font-bold text-purple-700 border border-purple-200/50">
              U
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-bold text-slate-700">Usuário Logado</span>
              <span className="text-xs font-medium text-slate-400">Farmácia</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#f8fafc]">
        {/* Header Mobile */}
        <header className="bg-white shadow-sm p-4 flex items-center md:hidden z-30 border-b border-slate-100">
          <button 
            onClick={() => setIsSidebarOpen(true)} 
            className="text-slate-600 hover:text-slate-900 transition-colors p-1"
          >
            <Menu size={24} />
          </button>
          <div className="ml-4 flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center">
              <Logo className="w-full h-full" />
            </div>
            <h1 className="text-lg font-black text-[#0f4c81] flex items-baseline">
              CAF<span className="text-[#4caf50] mx-0.5 text-2xl leading-none">.</span>SMART
            </h1>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeTab === 'recebimento' && <RecebimentoTab />}
          {activeTab === 'quarentena' && <QuarentenaTab />}
          {activeTab === 'previsao' && <PrevisaoTab />}
          {activeTab === 'fracionamento' && <FracionamentoTab />}
          {activeTab === 'fichas' && <FichaTransferenciasTab />}
        </div>
      </main>
    </div>
  );
}
