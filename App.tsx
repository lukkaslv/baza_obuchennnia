
import React, { useState, useEffect, useMemo } from 'react';
import { Module, ContentItem } from './types';
// Fixed Firebase imports for version 9+
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy,
  writeBatch
} from "firebase/firestore";
import { 
  PlusIcon, 
  TrashIcon, 
  XMarkIcon, 
  ArchiveBoxIcon, 
  LockClosedIcon, 
  CloudIcon, 
  MagnifyingGlassIcon, 
  PencilSquareIcon, 
  CheckIcon, 
  Bars3Icon,
  ExclamationCircleIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { GoogleGenAI } from "@google/genai";

const firebaseConfig = {
  apiKey: "AIzaSyBQ7ezdVLef5esjediEQA7_Wd_0YigejP0",
  authDomain: "database-bb3eb.firebaseapp.com",
  projectId: "database-bb3eb",
  storageBucket: "database-bb3eb.firebasestorage.app",
  messagingSenderId: "1058518823725",
  appId: "1:1058518823725:web:042a70100bc58ab8aed9a4"
};

const ACCESS_PASSWORD = '1337';
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [modules, setModules] = useState<Module[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [isAddingModule, setIsAddingModule] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [tempModuleTitle, setTempModuleTitle] = useState('');
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'подключено' | 'ошибка' | 'синхронизация'>('синхронизация');
  const [hasLocalData, setHasLocalData] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem('vault_auth');
    if (auth === 'true') setIsAuthenticated(true);

    const localModules = localStorage.getItem('vault_modules');
    const localItems = localStorage.getItem('vault_items');
    try {
      if ((localModules && JSON.parse(localModules).length > 0) || 
          (localItems && JSON.parse(localItems).length > 0)) {
        setHasLocalData(true);
      }
    } catch (e) { console.warn("Local storage check skipped"); }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const q = query(collection(db, "modules"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setModules(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Module)));
      setCloudStatus('подключено');
    }, () => setCloudStatus('ошибка'));
    return () => unsub();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const q = query(collection(db, "items"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ContentItem)));
    }, () => setCloudStatus('ошибка'));
    return () => unsub();
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ACCESS_PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem('vault_auth', 'true');
    } else {
      alert('ОШИБКА ДОСТУПА: НЕВЕРНЫЙ КОД');
    }
  };

  const handleManualMigration = async () => {
    if (!window.confirm('ПЕРЕНЕСТИ ВСЕ ЛОКАЛЬНЫЕ ДАННЫЕ В ОБЛАКО?')) return;
    setCloudStatus('синхронизация');
    try {
      const batch = writeBatch(db);
      const localModules = JSON.parse(localStorage.getItem('vault_modules') || '[]');
      const localItems = JSON.parse(localStorage.getItem('vault_items') || '[]');
      localModules.forEach((m: Module) => batch.set(doc(db, "modules", m.id), m));
      localItems.forEach((i: ContentItem) => batch.set(doc(db, "items", i.id), i));
      await batch.commit();
      setHasLocalData(false);
      setCloudStatus('подключено');
      alert('ДАННЫЕ УСПЕШНО СИНХРОНИЗИРОВАНЫ С ОБЛАКОМ');
    } catch (e) {
      setCloudStatus('ошибка');
      alert('ОШИБКА СИНХРОНИЗАЦИИ');
    }
  };

  const analyzeContent = async () => {
    if (!newContent.trim()) return;
    setIsAnalysing(true);
    try {
      // Gemini initialization using the specified model for coding/reasoning tasks
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Проведи синтез следующего текста через призму науки, глубинной психологии и алхимии. Оформи как структурированный отчет: ${newContent}`,
      });
      if (response.text) {
        setNewContent(prev => `${prev}\n\n--- СИНТЕЗ (ALCHYMIA/PSYCHE/RATIO) ---\n${response.text}`);
      }
    } catch (e) {
      console.error("Gemini Error:", e);
      alert("ОШИБКА АНАЛИЗА ГЕНЕЗИСА");
    } finally {
      setIsAnalysing(false);
    }
  };

  const addItem = async () => {
    if (!newContent.trim() || !activeModuleId) return;
    const title = newContent.trim().split('\n')[0].substring(0, 40).toUpperCase();
    const id = Date.now().toString();
    try {
      setCloudStatus('синхронизация');
      await setDoc(doc(db, "items", id), {
        id, moduleId: activeModuleId, title, content: newContent, tags: [], type: 'text', createdAt: Date.now()
      });
      setNewContent('');
      setCloudStatus('подключено');
    } catch (e) { setCloudStatus('ошибка'); }
  };

  const addModule = async () => {
    if (!newModuleTitle.trim()) return;
    const id = Date.now().toString();
    try {
      await setDoc(doc(db, "modules", id), { id, title: newModuleTitle.toUpperCase(), description: '', createdAt: Date.now() });
      setNewModuleTitle('');
      setIsAddingModule(false);
    } catch (e) { setCloudStatus('ошибка'); }
  };

  const saveModuleTitle = async (id: string) => {
    try {
      await updateDoc(doc(db, "modules", id), { title: tempModuleTitle.toUpperCase() });
      setEditingModuleId(null);
    } catch (e) { setCloudStatus('ошибка'); }
  };

  const updateItemContent = async () => {
    if (!selectedItem) return;
    try {
      await updateDoc(doc(db, "items", selectedItem.id), { content: selectedItem.content });
      setIsEditingContent(false);
    } catch (e) { setCloudStatus('ошибка'); }
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesModule = activeModuleId ? item.moduleId === activeModuleId : true;
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           item.content.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesModule && matchesSearch;
    });
  }, [items, activeModuleId, searchQuery]);

  if (!isAuthenticated) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center p-6 animate-fade">
        <form onSubmit={handleLogin} className="w-full max-w-md b-border bg-white p-8 md:p-12 shadow-[15px_15px_0px_0px_#00FF00]">
          <div className="flex justify-center mb-8"><LockClosedIcon className="w-16 h-16 text-black" /></div>
          <h1 className="text-3xl font-black text-center mb-10 uppercase italic tracking-tighter">PRIVATE_STORAGE</h1>
          <input type="password" autoFocus className="w-full b-input text-center text-2xl mb-6" placeholder="****" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="w-full b-btn bg-black text-white py-4 hover:bg-[#00FF00] hover:text-black uppercase text-sm tracking-widest">ВОЙТИ</button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white text-black font-bold">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`fixed md:relative w-80 h-full b-border-r flex flex-col bg-white z-50 transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-8 b-border-b bg-black text-white flex items-center justify-between">
          <div className="flex items-center gap-3"><ArchiveBoxIcon className="w-8 h-8 text-[#00FF00]" /><h1 className="text-3xl font-black italic tracking-tighter uppercase">БАЗА.</h1></div>
          <button className="md:hidden" onClick={() => setIsSidebarOpen(false)}><XMarkIcon className="w-8 h-8 text-white" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto custom-scrollbar">
          <button onClick={() => { setActiveModuleId(null); setIsSidebarOpen(false); }} className={`w-full text-left px-8 py-6 text-xs b-border-b uppercase tracking-widest ${!activeModuleId ? 'bg-[#00FF00]' : 'hover:bg-gray-100'}`}>[ ВЕСЬ_АРХИВ: {items.length} ]</button>
          <div className="px-8 py-4 bg-gray-50 b-border-b flex justify-between items-center"><span className="text-[10px] uppercase opacity-40 italic">КАТЕГОРИИ</span><button onClick={() => setIsAddingModule(true)}><PlusIcon className="w-6 h-6 stroke-[3px]" /></button></div>
          {modules.map(module => (
            <div key={module.id} className="group relative b-border-b flex items-center">
              {editingModuleId === module.id ? (
                <div className="flex-1 p-2 flex gap-1 bg-[#00FF00]/10"><input autoFocus className="flex-1 b-input text-xs py-2 uppercase" value={tempModuleTitle} onChange={(e) => setTempModuleTitle(e.target.value)} /><button onClick={() => saveModuleTitle(module.id)} className="p-2 bg-black text-white"><CheckIcon className="w-5 h-5" /></button></div>
              ) : (
                <><button onClick={() => { setActiveModuleId(module.id); setIsSidebarOpen(false); }} className={`flex-1 text-left px-8 py-5 text-sm uppercase transition-all ${activeModuleId === module.id ? 'bg-black text-white' : 'hover:bg-gray-50'}`}>{module.title}</button>
                <div className="absolute right-2 opacity-0 group-hover:opacity-100 flex gap-1"><button onClick={() => { setEditingModuleId(module.id); setTempModuleTitle(module.title); }} className="p-2 hover:text-[#00FF00]"><PencilSquareIcon className="w-5 h-5" /></button></div></>
              )}
            </div>
          ))}
          {isAddingModule && <div className="p-6 b-border-b"><input autoFocus placeholder="ИМЯ..." className="w-full b-input text-sm mb-3 uppercase" value={newModuleTitle} onChange={(e) => setNewModuleTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addModule()} /><div className="flex gap-2"><button onClick={addModule} className="b-btn flex-1 text-[10px] bg-black text-white">ОК</button><button onClick={() => setIsAddingModule(false)} className="b-btn flex-1 text-[10px]">ОТМЕНА</button></div></div>}
        </nav>
        <div className="p-4 b-border-t bg-black text-[#00FF00] text-[9px] uppercase flex flex-col gap-2">
          {hasLocalData && <button onClick={handleManualMigration} className="w-full py-2 border-2 border-[#00FF00] text-[#00FF00] hover:bg-[#00FF00] hover:text-black flex items-center justify-center gap-2 animate-pulse font-bold tracking-tighter"><ExclamationCircleIcon className="w-4 h-4" />[! ПЕРЕНЕСТИ ЛОКАЛЬНЫЕ ДАННЫЕ !]</button>}
          <div className="flex justify-between items-center"><div className="flex items-center gap-2"><CloudIcon className={`w-4 h-4 ${cloudStatus === 'ошибка' ? 'text-red-500' : ''}`} />{cloudStatus}</div><button onClick={() => { localStorage.removeItem('vault_auth'); window.location.reload(); }} className="hover:underline opacity-50">ВЫЙТИ</button></div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col relative bg-[#f3f3f3] overflow-hidden">
        <header className="h-20 b-border-b flex items-center justify-between px-6 md:px-12 bg-white shrink-0 z-20">
          <div className="flex items-center gap-4"><button className="md:hidden p-2" onClick={() => setIsSidebarOpen(true)}><Bars3Icon className="w-8 h-8" /></button><h2 className="text-xl md:text-3xl font-black italic uppercase truncate">{activeModuleId ? `/${modules.find(m => m.id === activeModuleId)?.title}` : '/ОБЩИЙ_ДОСТУП'}</h2></div>
          <div className="relative group hidden sm:block"><MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" /><input placeholder="ПОИСК..." className="b-input py-2 pl-10 text-xs w-64" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-12 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-8 pb-32">
            {activeModuleId && (
              <div className="b-border bg-white p-6 shadow-[8px_8px_0px_0px_#000] animate-fade">
                <textarea className="w-full min-h-[120px] border-none text-xl resize-none font-bold outline-none italic placeholder:opacity-20" placeholder="НАЧНИТЕ ПИСАТЬ..." value={newContent} onChange={(e) => setNewContent(e.target.value)} />
                <div className="mt-4 pt-4 b-border-t border-dashed flex justify-between items-center">
                  <button onClick={analyzeContent} disabled={isAnalysing || !newContent.trim()} className="flex items-center gap-2 text-xs uppercase hover:text-[#00FF00] transition-colors disabled:opacity-30">
                    <SparklesIcon className={`w-5 h-5 ${isAnalysing ? 'animate-spin' : ''}`} /> {isAnalysing ? 'СИНТЕЗ...' : 'ЗАПУСТИТЬ СИНТЕЗ'}
                  </button>
                  <button onClick={addItem} disabled={!newContent.trim()} className="b-btn bg-black text-white px-10 py-3 text-xs uppercase tracking-widest">СОХРАНИТЬ В ОБЛАКО</button>
                </div>
              </div>
            )}
            <div className="grid gap-6">
              {filteredItems.map(item => (
                <article key={item.id} className="b-border bg-white cursor-pointer hover:shadow-[10px_10px_0px_0px_#00FF00] transition-all group overflow-hidden" onClick={() => setSelectedItem(item)}>
                  <div className="p-4 b-border-b flex justify-between items-center bg-white group-hover:bg-gray-50"><h3 className="text-sm md:text-lg font-black uppercase italic tracking-tight truncate mr-4">{item.title}</h3><button onClick={(e) => { e.stopPropagation(); if(confirm('УДАЛИТЬ ЗАПИСЬ НАВСЕГДА?')) deleteDoc(doc(db, "items", item.id)); }} className="p-2 hover:text-red-600 transition-all"><TrashIcon className="w-5 h-5" /></button></div>
                  <div className="p-6"><p className="line-clamp-3 text-lg readable-text italic opacity-60">{item.content}</p></div>
                </article>
              ))}
              {filteredItems.length === 0 && <div className="text-center py-20 opacity-20 uppercase tracking-widest">[ ПУСТО ]</div>}
            </div>
          </div>
        </div>
        {selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center animate-fade">
            <div className="absolute inset-0 bg-black/95" onClick={() => setSelectedItem(null)} />
            <div className="relative w-full max-w-5xl h-[90vh] bg-white b-border flex flex-col overflow-hidden m-4 shadow-[20px_20px_0px_0px_#00FF00]">
              <header className="p-6 b-border-b flex justify-between items-center bg-white">
                <h2 className="text-xl md:text-3xl font-black italic uppercase truncate">{selectedItem.title}</h2>
                <div className="flex gap-2">
                  <button onClick={() => setIsEditingContent(!isEditingContent)} className={`b-btn p-3 ${isEditingContent ? 'bg-[#00FF00]' : 'bg-white'}`}>{isEditingContent ? <CheckIcon className="w-6 h-6" onClick={updateItemContent} /> : <PencilSquareIcon className="w-6 h-6" />}</button>
                  <button onClick={() => setSelectedItem(null)} className="b-btn bg-black text-white p-3"><XMarkIcon className="w-6 h-6 stroke-[3px]" /></button>
                </div>
              </header>
              <div className="flex-1 overflow-y-auto p-6 md:p-12 bg-white custom-scrollbar"><div className="max-w-3xl mx-auto">{isEditingContent ? <textarea className="w-full h-full min-h-[60vh] b-input text-lg readable-text italic leading-relaxed" value={selectedItem.content} onChange={(e) => setSelectedItem({...selectedItem, content: e.target.value})} /> : <p className="readable-text text-2xl md:text-4xl leading-relaxed whitespace-pre-wrap italic text-[#1a1a1a]">{selectedItem.content}</p>}</div></div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
