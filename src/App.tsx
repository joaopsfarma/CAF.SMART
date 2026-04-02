import React, { useState, useEffect, useRef } from 'react';
import { FileText, Download, CheckCircle, XCircle, MinusCircle, AlertCircle, Save, Mail, Menu, X, LayoutDashboard, ClipboardCheck, History, Settings, Archive, Calculator, Scissors, ChevronRight, FileSpreadsheet, LogOut, UserCircle } from 'lucide-react';
import { Logo } from './components/Logo';
import PrevisaoTab from './components/PrevisaoTab';
import FracionamentoTab from './components/FracionamentoTab';
import RecebimentoTab from './components/RecebimentoTab';
import QuarentenaTab from './components/QuarentenaTab';
import FichaTransferenciasTab from './components/FichaTransferenciasTab';
import HistoricoTab from './components/HistoricoTab';
import { auth } from './firebase';
import { signInWithPopup, GoogleAuthProvider, signInAnonymously, signOut, onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('quarentena');
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Email/Password Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error("Erro na autenticação por email:", error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setAuthError('Email ou senha incorretos.');
      } else if (error.code === 'auth/email-already-in-use') {
        setAuthError('Este email já está em uso.');
      } else if (error.code === 'auth/weak-password') {
        setAuthError('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setAuthError('Ocorreu um erro ao autenticar. Verifique os seus dados.');
      }
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Erro ao fazer login com Google:", error);
      alert("Erro ao fazer login com Google. Verifique o console para mais detalhes.");
    }
  };

  const handleAnonymousLogin = async () => {
    try {
      await signInAnonymously(auth);
    } catch (error) {
      console.error("Erro ao fazer login anônimo:", error);
      alert("Erro ao entrar como anônimo. Certifique-se de que ativou o provedor Anônimo no console do Firebase.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  if (!isAuthReady) {
    return <div className="flex h-screen items-center justify-center bg-slate-100">Carregando...</div>;
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto mb-6">
            <Logo className="w-full h-full" />
          </div>
          <h1 className="text-3xl font-black text-[#0f4c81] mb-2 flex items-baseline justify-center">
            CAF<span className="text-[#4caf50] mx-0.5 text-4xl leading-none">.</span>SMART
          </h1>
          <p className="text-slate-500 mb-6">Faça login para acessar o sistema</p>
          
          <form onSubmit={handleEmailAuth} className="space-y-4 mb-6 text-left">
            {authError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 text-center">
                {authError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-sm"
            >
              {isRegistering ? 'Criar conta' : 'Entrar'}
            </button>
            <div className="text-center mt-2">
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setAuthError('');
                }}
                className="text-sm text-purple-600 hover:text-purple-800 font-medium transition-colors"
              >
                {isRegistering ? 'Já tem uma conta? Faça login' : 'Não tem conta? Cadastre-se'}
              </button>
            </div>
          </form>

          <div className="relative py-2 mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-slate-400 uppercase tracking-wider font-semibold">Ou</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleLogin}
              className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-3 shadow-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Entrar com o Google
            </button>

            <button
              onClick={handleAnonymousLogin}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-3 shadow-sm"
            >
              <UserCircle className="w-5 h-5 text-slate-500" />
              Entrar sem conta (Anônimo)
            </button>
          </div>
        </div>
      </div>
    );
  }

  const menuItems = [
    { id: 'historico', label: 'Histórico', icon: History },
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-100 to-teal-50 flex items-center justify-center text-sm font-bold text-purple-700 border border-purple-200/50">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-bold text-slate-700 truncate max-w-[120px]">{user.displayName || 'Usuário'}</span>
                <span className="text-xs font-medium text-slate-400">Farmácia</span>
              </div>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 transition-colors p-2" title="Sair">
              <LogOut size={18} />
            </button>
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
          {activeTab === 'historico' && <HistoricoTab />}
          {activeTab === 'recebimento' && <RecebimentoTab user={user} />}
          {activeTab === 'quarentena' && <QuarentenaTab user={user} />}
          {activeTab === 'previsao' && <PrevisaoTab />}
          {activeTab === 'fracionamento' && <FracionamentoTab />}
          {activeTab === 'fichas' && <FichaTransferenciasTab />}
        </div>
      </main>
    </div>
  );
}
