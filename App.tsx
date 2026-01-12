import React, { useState, useEffect, useMemo } from 'react';
import { Module, ContentItem } from './types';
import { analyzeContent } from './geminiService';
import * as firebaseApp from "firebase/app";
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
  SparklesIcon, 
  XMarkIcon, 
  ArchiveBoxIcon, 
  LockClosedIcon, 
  CloudIcon, 
  ExclamationCircleIcon, 
  MagnifyingGlassIcon, 
  PencilSquareIcon, 
  CheckIcon, 
  Bars3Icon 
} from '@heroicons/react/24/outline';

const firebaseConfig = {
  apiKey: "AIzaSyBQ7ezdVLef5esjediEQA7_Wd_0YigejP0",
  authDomain: "database-bb3eb.firebaseapp.com",
  projectId: "database-bb3eb",
  storageBucket: "database-bb3eb.firebasestorage.app",
  messagingSenderId: "1058518823725",
  appId: "1:1058518823725:web:042a70100bc58ab8aed9a4"
};

const app = !firebaseApp.getApps().length ? firebaseApp.initializeApp(firebaseConfig) : firebaseApp.getApp();
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'подключено' | 'ошибка' | 'синхронизация'>('синхронизация');
  const [hasLocalData, setHasLocalData] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem('vault_auth');
    if (auth === 'true') setIsAuthenticated(true);
  }, []);

  // Проверка наличия локальных данных (БЕЗ АВТОМАТИЧЕСКОГО ПЕРЕНОСА)
  useEffect(() => {
    const localModules = localStorage.getItem('vault_modules');
    const localItems = localStorage.getItem('vault_items');
    if (localModules || localItems) {
      // Проверяем, есть ли там реальные данные
      const hasModules = localModules && JSON.parse(localModules).length > 0;
      const hasItems = localItems && JSON.parse(localItems).length > 0;
      if (hasModules || hasItems) {
        setHasLocalData(true);
      }
    }
  }, []);

  // Ручная миграция по кнопке
  const handleManualMigration = async () => {
    if (!window.confirm('ВЫ УВЕРЕНЫ? ЭТО ОТПРАВИТ ВСЕ ВАШИ ЛОКАЛЬНЫЕ ДАННЫЕ В ОБЛАКО FIREBASE.\n\nВАШИ ЛОКАЛЬНЫЕ ДАННЫЕ НЕ БУДУТ УДАЛЕНЫ.')) return;

    try {
      setCloudStatus('синхронизация');
      const batch = writeBatch(db);
      let count = 0;

      const localModules = localStorage.getItem('vault_modules');
      if (localModules) {
        const parsed = JSON.parse(localModules);
        if (Array.isArray(parsed)) {
            parsed.forEach((m: any) => {
                batch.set(doc(db, "modules", m.id), m);
                count++;
            });
        }
      }

      const localItems = localStorage.getItem('vault_items');
      if (localItems) {
        const parsed = JSON.parse(localItems);
        if (Array.isArray(parsed)) {
            parsed.forEach((i: any) => {
                batch.set(doc(db, "items", i.id), i);
                count++;
            });
        }
      }

      if (count > 0) {
        await batch.commit();
        setCloudStatus('подключено');
        alert(`УСПЕШНО! ${count} ЗАПИСЕЙ СОХРАНЕНО В ОБЛАКЕ.`);
      } else {
        alert('НЕТ ЛОКАЛЬНЫХ ДАННЫХ ДЛЯ ПЕРЕНОСА.');
        setCloudStatus('подключено');
      }

    } catch (e) {
      console.error(e);
      setCloudStatus('ошибка');
      alert('ОШИБКА СИНХРОНИЗАЦИИ. ПРОВЕРЬТЕ КОНСОЛЬ.');
    }
  };

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
    if (password === '1337') {
      setIsAuthenticated(true);
      localStorage.setItem('vault_auth', 'true');
    } else {
      alert('ОШИБКА ДОСТУПА');
    }
  };

  const addModule = async () => {
    if (!newModuleTitle.trim()) return;
    const id = Date.now().toString();
    try {
      setCloudStatus('синхронизация');
      await setDoc(doc(db, "modules", id), {
        id,
        title: newModuleTitle.toUpperCase(),
        description: '',
        createdAt: Date.now()
      });
      setNewModuleTitle('');
      setIsAddingModule(false);
    } catch (e) { setCloudStatus('ошибка'); }
  };

  const saveModuleTitle = async (id: string) => {
    try {
      setCloudStatus('синхронизация');
      await updateDoc(doc(db, "modules", id), { title: tempModuleTitle.toUpperCase() });
      setEditingModuleId(null);
    } catch (e) { setCloudStatus('ошибка'); }
  };

  const addItem = async (useAI: boolean) => {
    if (!newContent.trim() || !activeModuleId) return;
    let title = newContent.trim().split('\n')[0].substring(0, 40).toUpperCase();
    let tags: string[] = [];
    if (useAI) {
      setIsProcessing(true);
      try {
        const analysis = await analyzeContent(newContent);
        title = analysis.title?.toUpperCase() || title;
        tags = analysis.suggestedTags || [];
      } catch (e) { console.error(e); } finally { setIsProcessing(false); }
    }
    const id = Date.now().toString();
    try {
      setCloudStatus('синхронизация');
      await setDoc(doc(db, "items", id), {
        id,
        moduleId: activeModuleId,
        title,
        content: newContent,
        tags,
        type: 'text',
        createdAt: Date.now()
      });
      setNewContent('');
    } catch (e) { setCloudStatus('ошибка'); }
  };

  const updateItemContent = async () => {
    if (!selectedItem) return;
    try {
      setCloudStatus('синхронизация');
      await updateDoc(doc(db, "items", selectedItem.id), { content: selectedItem.content });
      setIsEditingContent(false);
    } catch (e) { setCloudStatus('ошибка'); }
  };

  const handleDeleteItem = async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('УДАЛИТЬ ЗАПИСЬ НАВСЕГДА?')) return;
    try {
      setCloudStatus('синхронизация');
      await deleteDoc(doc(db, "items", itemId));
      setCloudStatus('подключено');
    } catch (e) {
      alert("Ошибка удаления записи");
      setCloudStatus('ошибка');
    }
  };

  const handleDeleteModule = async (moduleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('УДАЛИТЬ КАТЕГОРИЮ? ВСЕ ЗАПИСИ ОСТАНУТСЯ В ОБЩЕМ СПИСКЕ.')) return;
    try {
      setCloudStatus('синхронизация');
      await deleteDoc(doc(db, "modules", moduleId));
      if (activeModuleId === moduleId) setActiveModuleId(null);
      setCloudStatus('подключено');
    } catch (e) {
      alert("Ошибка удаления категории");
      setCloudStatus('ошибка');
    }
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
          <div className="flex justify-center mb-8"><LockClosedIcon className="w-12 h-12 md:w-16 md:h-16 text-black" /></div>
          <h1 className="text-2xl md:text-4xl font-black text-center mb-10 uppercase italic tracking-tighter leading-none">ДОСТУП_ОГРАНИЧЕН</h1>
          <input type="password" autoFocus className="w-full b-input text-center text-xl md:text-2xl mb-6 border-4" placeholder="****" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="w-full b-btn bg-black text-white py-4 hover:bg-[#00FF00] hover:text-black transition-all uppercase text-sm">ДЕШИФРОВАТЬ</button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white text-black font-bold selection:bg-[#00FF00] selection:text-black">
      {/* МОБИЛЬНЫЙ ОВЕРЛЕЙ */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* БОКОВАЯ ПАНЕЛЬ */}
      <aside className={`fixed md:relative w-80 h-full b-border-r flex flex-col bg-white z-50 transition-transform duration-300 ease-in-out shrink-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-8 b-border-b bg-black text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ArchiveBoxIcon className="w-8 h-8 text-[#00FF00]" />
            <h1 className="text-3xl font-black italic tracking-tighter uppercase">БАЗА.</h1>
          </div>
          <button className="md:hidden" onClick={() => setIsSidebarOpen(false)}><XMarkIcon className="w-8 h-8 text-white" /></button>
        </div>
        
        <nav className="flex-1 overflow-y-auto custom-scrollbar">
          <button onClick={() => { setActiveModuleId(null); setIsSidebarOpen(false); }} className={`w-full text-left px-8 py-6 text-xs b-border-b uppercase tracking-widest ${!activeModuleId ? 'bg-[#00FF00]' : 'hover:bg-gray-100'}`}>
            [ ВСЕ_ДАННЫЕ: {items.length} ]
          </button>
          
          <div className="px-8 py-4 bg-gray-50 b-border-b flex justify-between items-center">
            <span className="text-[10px] uppercase opacity-40 italic">КАТЕГОРИИ</span>
            <button onClick={() => setIsAddingModule(true)} className="hover:scale-125 transition-transform"><PlusIcon className="w-6 h-6 stroke-[3px]" /></button>
          </div>

          {modules.map(module => (
            <div key={module.id} className="group relative b-border-b flex items-center">
              {editingModuleId === module.id ? (
                <div className="flex-1 p-2 flex gap-1 bg-[#00FF00]/10">
                  <input autoFocus className="flex-1 b-input text-xs py-2 uppercase" value={tempModuleTitle} onChange={(e) => setTempModuleTitle(e.target.value)} />
                  <button onClick={() => saveModuleTitle(module.id)} className="p-2 bg-black text-white"><CheckIcon className="w-5 h-5" /></button>
                </div>
              ) : (
                <>
                  <button onClick={() => { setActiveModuleId(module.id); setIsSidebarOpen(false); }} className={`flex-1 text-left px-8 py-5 text-sm uppercase transition-all ${activeModuleId === module.id ? 'bg-black text-white' : 'hover:bg-gray-50'}`}>
                    {module.title}
                  </button>
                  <div className="absolute right-2 flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity bg-white/80 p-1 md:bg-transparent">
                    <button onClick={() => { setEditingModuleId(module.id); setTempModuleTitle(module.title); }} className="p-2 hover:text-[#00FF00]"><PencilSquareIcon className="w-5 h-5" /></button>
                    <button onClick={(e) => handleDeleteModule(module.id, e)} className="p-2 hover:text-red-600"><TrashIcon className="w-5 h-5" /></button>
                  </div>
                </>
              )}
            </div>
          ))}

          {isAddingModule && (
            <div className="p-6 b-border-b bg-white animate-fade">
              <input autoFocus placeholder="ИМЯ..." className="w-full b-input text-sm mb-3 uppercase" value={newModuleTitle} onChange={(e) => setNewModuleTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addModule()} />
              <div className="flex gap-2">
                <button onClick={addModule} className="b-btn flex-1 text-[10px] bg-black text-white">СОЗДАТЬ</button>
                <button onClick={() => setIsAddingModule(false)} className="b-btn flex-1 text-[10px]">ОТМЕНА</button>
              </div>
            </div>
          )}
        </nav>

        <div className="p-4 b-border-t bg-black text-[#00FF00] text-[9px] uppercase flex flex-col gap-3">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <CloudIcon className={`w-4 h-4 ${cloudStatus === 'ошибка' ? 'text-red-500' : ''}`} />
              {cloudStatus}
            </div>
            <button onClick={() => { localStorage.removeItem('vault_auth'); window.location.reload(); }} className="hover:underline opacity-50">ВЫЙТИ</button>
          </div>
          
          {hasLocalData && (
            <button 
              onClick={handleManualMigration} 
              className="w-full py-3 border-2 border-[#00FF00] text-[#00FF00] hover:bg-[#00FF00] hover:text-black transition-all font-bold text-[10px] animate-pulse flex items-center justify-center gap-2"
            >
              <ExclamationCircleIcon className="w-4 h-4" />
              [! ЭКСТРЕННЫЙ ПЕРЕНОС ДАННЫХ !]
            </button>
          )}
        </div>
      </aside>

      {/* ОСНОВНОЙ КОНТЕНТ */}
      <main className="flex-1 flex flex-col relative bg-[#f3f3f3] overflow-hidden">
        <header className="h-20 md:h-24 b-border-b flex items-center justify-between px-6 md:px-12 bg-white shrink-0 z-20">
          <div className="flex items-center gap-4 overflow-hidden">
            <button className="md:hidden p-2" onClick={() => setIsSidebarOpen(true)}><Bars3Icon className="w-8 h-8" /></button>
            <h2 className="text-xl md:text-4xl font-black italic tracking-tighter uppercase underline decoration-[#00FF00] decoration-4 truncate">
              {activeModuleId ? `/${modules.find(m => m.id === activeModuleId)?.title}` : '/ВЕСЬ_АРХИВ'}
            </h2>
          </div>
          <div className="relative w-40 md:w-72 group hidden sm:block">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
            <input placeholder="ПОИСК..." className="w-full b-input py-2 pl-10 text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-12 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-8 md:space-y-12 pb-32">
            {activeModuleId && (
              <div className="b-border bg-white p-6 md:p-10 shadow-[8px_8px_0px_0px_#000] md:shadow-[15px_15px_0px_0px_#000] animate-fade">
                <textarea className="w-full min-h-[120px] md:min-h-[160px] border-none focus:ring-0 text-xl md:text-2xl resize-none placeholder:opacity-10 font-bold outline-none leading-relaxed italic" placeholder="НОВЫЕ ДАННЫЕ..." value={newContent} onChange={(e) => setNewContent(e.target.value)} />
                <div className="mt-4 md:mt-8 pt-4 md:pt-8 b-border-t border-dashed flex flex-col sm:flex-row justify-end gap-3 md:gap-6">
                  <button onClick={() => addItem(true)} disabled={isProcessing || !newContent.trim()} className="b-btn flex items-center justify-center gap-3 text-[10px] md:text-xs bg-[#00FF00] px-4 md:px-8 py-3">
                    <SparklesIcon className="w-5 h-5" /> {isProcessing ? 'АНАЛИЗ...' : 'ИИ_АНАЛИЗ'}
                  </button>
                  <button onClick={() => addItem(false)} disabled={!newContent.trim()} className="b-btn bg-black text-white px-4 md:px-10 py-3 text-[10px] md:text-xs uppercase">СОХРАНИТЬ</button>
                </div>
              </div>
            )}

            <div className="grid gap-6 md:gap-10">
              {filteredItems.map(item => (
                <article key={item.id} className="b-border bg-white cursor-pointer hover:shadow-[10px_10px_0px_0px_#00FF00] transition-all group overflow-hidden" onClick={() => setSelectedItem(item)}>
                  <div className="p-4 md:p-5 b-border-b flex justify-between items-center bg-white group-hover:bg-gray-50 transition-colors">
                    <h3 className="text-sm md:text-lg font-black uppercase italic underline decoration-[#00FF00] decoration-2 tracking-tight truncate mr-4">{item.title}</h3>
                    <button onClick={(e) => handleDeleteItem(item.id, e)} className="p-2 hover:text-red-600 transition-all hover:scale-110"><TrashIcon className="w-6 h-6" /></button>
                  </div>
                  <div className="p-6 md:p-8">
                    <p className="line-clamp-3 md:line-clamp-4 text-lg md:text-xl leading-relaxed opacity-60 readable-text italic">{item.content}</p>
                    {item.tags?.length > 0 && (
                      <div className="mt-4 md:mt-6 flex gap-2 flex-wrap">
                        {item.tags.map(tag => <span key={tag} className="text-[8px] md:text-[10px] bg-black text-white px-2 md:px-3 py-1 uppercase tracking-tighter">#{tag}</span>)}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        {/* МОДАЛЬНОЕ ОКНО ЧТЕНИЯ */}
        {selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-12 animate-fade">
            <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => setSelectedItem(null)} />
            <div className="relative w-full max-w-6xl h-full bg-white b-border md:shadow-[40px_40px_0px_0px_#00FF00] flex flex-col overflow-hidden">
              <header className="p-6 md:p-10 b-border-b flex justify-between items-center bg-white shrink-0">
                <div className="space-y-1 overflow-hidden">
                  <h2 className="text-xl md:text-4xl font-black italic underline uppercase tracking-tighter leading-none truncate">{selectedItem.title}</h2>
                  <p className="text-[10px] opacity-40 uppercase font-mono italic truncate">ID: {selectedItem.id}</p>
                </div>
                <div className="flex gap-2 md:gap-4 shrink-0">
                  <button onClick={() => setIsEditingContent(!isEditingContent)} className={`b-btn p-3 md:p-4 ${isEditingContent ? 'bg-[#00FF00]' : 'bg-white'}`}>
                    {isEditingContent ? <CheckIcon className="w-6 h-6 md:w-8 md:h-8" onClick={updateItemContent} /> : <PencilSquareIcon className="w-6 h-6 md:w-8 md:h-8" />}
                  </button>
                  <button onClick={() => setSelectedItem(null)} className="b-btn bg-black text-white hover:bg-red-600 p-3 md:p-4">
                    <XMarkIcon className="w-6 h-6 md:w-8 md:h-8 stroke-[3px]" />
                  </button>
                </div>
              </header>
              <div className="flex-1 overflow-y-auto p-6 md:p-24 bg-white custom-scrollbar">
                <div className="max-w-3xl mx-auto">
                  {isEditingContent ? (
                    <textarea 
                      className="w-full h-[60vh] b-input text-lg md:text-2xl readable-text italic leading-relaxed bg-gray-50" 
                      value={selectedItem.content}
                      onChange={(e) => setSelectedItem({...selectedItem, content: e.target.value})}
                    />
                  ) : (
                    <p className="readable-text text-2xl md:text-5xl leading-[1.7] md:leading-[1.85] whitespace-pre-wrap italic font-medium text-[#1a1a1a]">
                      {selectedItem.content}
                    </p>
                  )}
                  <div className="h-64" />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;