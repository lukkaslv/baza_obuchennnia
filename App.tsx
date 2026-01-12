
import React, { useState, useEffect, useMemo } from 'react';
import { Module, ContentItem } from './types';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where,
  onSnapshot,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  PlusIcon, 
  TrashIcon, 
  MagnifyingGlassIcon, 
  XMarkIcon,
  ArchiveBoxIcon,
  LockClosedIcon,
  ArrowUpCircleIcon
} from '@heroicons/react/24/outline';

const firebaseConfig = {
  apiKey: "AIzaSyBQ7ezdVLef5esjediEQA7_Wd_0YigejP0",
  authDomain: "database-bb3eb.firebaseapp.com",
  projectId: "database-bb3eb",
  storageBucket: "database-bb3eb.firebasestorage.app",
  messagingSenderId: "1058518823725",
  appId: "1:1058518823725:web:042a70100bc58ab8aed9a4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  
  // Состояния для данных
  const [modules, setModules] = useState<Module[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [isAddingModule, setIsAddingModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'local'>('idle');
  const [hasLocalData, setHasLocalData] = useState(false);

  // 1. ИНИЦИАЛИЗАЦИЯ ИЗ LOCALSTORAGE (БЕЗ УДАЛЕНИЯ ПРИ СТАРТЕ)
  useEffect(() => {
    const auth = localStorage.getItem('vault_auth');
    if (auth === 'true') setIsAuthenticated(true);

    const savedModulesRaw = localStorage.getItem('eduvault_modules');
    const savedItemsRaw = localStorage.getItem('eduvault_items');
    
    if (savedModulesRaw || savedItemsRaw) {
      const localMods = savedModulesRaw ? JSON.parse(savedModulesRaw) : [];
      const localItems = savedItemsRaw ? JSON.parse(savedItemsRaw) : [];
      
      if (localMods.length > 0 || localItems.length > 0) {
        setHasLocalData(true);
        setModules(localMods);
        setItems(localItems);
        setSyncStatus('local');
      }
    }
  }, []);

  // 2. СИНХРОНИЗАЦИЯ С FIREBASE (СЛИЯНИЕ, А НЕ ЗАМЕНА)
  useEffect(() => {
    if (isAuthenticated) {
      // Подписка на модули с логикой слияния
      const unsubModules = onSnapshot(collection(db, "modules"), (snapshot) => {
        const cloudModules = snapshot.docs.map(doc => doc.data() as Module);
        
        setModules(prev => {
          // Если облако пустое, а у нас есть локальные данные — не затираем!
          if (cloudModules.length === 0) return prev;
          
          // Если в облаке что-то есть, мерджим (облако приоритетнее по ID)
          const merged = [...cloudModules];
          prev.forEach(localMod => {
            if (!merged.find(m => m.id === localMod.id)) {
              merged.push(localMod);
            }
          });
          return merged;
        });
        
        if (cloudModules.length > 0) {
          setSyncStatus('idle');
        }
      });

      // Подписка на записи с логикой слияния
      const unsubItems = onSnapshot(collection(db, "items"), (snapshot) => {
        const cloudItems = snapshot.docs.map(doc => doc.data() as ContentItem);
        
        setItems(prev => {
          if (cloudItems.length === 0) return prev;
          
          const merged = [...cloudItems];
          prev.forEach(localItem => {
            if (!merged.find(i => i.id === localItem.id)) {
              merged.push(localItem);
            }
          });
          return merged;
        });
      });

      return () => {
        unsubModules();
        unsubItems();
      };
    }
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

  // МИГРАЦИЯ: ПУШИМ ВСЁ ТЕКУЩЕЕ В ОБЛАКО
  const migrateToCloud = async () => {
    if (!window.confirm("ЭТО ДЕЙСТВИЕ ПЕРЕНЕСЕТ ВСЕ ЛОКАЛЬНЫЕ ФАЙЛЫ В FIREBASE. ПРОДОЛЖИТЬ?")) return;
    
    setSyncStatus('syncing');
    try {
      const batch = writeBatch(db);
      
      // Берем всё, что сейчас в стейте (локальное + облачное)
      modules.forEach((m) => {
        const ref = doc(db, "modules", m.id);
        batch.set(ref, m);
      });

      items.forEach((item) => {
        const ref = doc(db, "items", item.id);
        batch.set(ref, item);
      });

      await batch.commit();
      
      // Только после успеха чистим localstorage
      localStorage.removeItem('eduvault_modules');
      localStorage.removeItem('eduvault_items');
      setHasLocalData(false);
      setSyncStatus('idle');
      alert("МИГРАЦИЯ УСПЕШНА. ДАННЫЕ В ОБЛАКЕ.");
    } catch (e) {
      console.error(e);
      setSyncStatus('error');
      alert("ОШИБКА ПРИ ПЕРЕНОСЕ: " + (e as Error).message);
    }
  };

  const addModule = async () => {
    if (!newModuleTitle.trim()) return;
    const newModule: Module = {
      id: Date.now().toString(),
      title: newModuleTitle.toUpperCase(),
      description: '',
      createdAt: Date.now()
    };
    await setDoc(doc(db, "modules", newModule.id), newModule);
    setNewModuleTitle('');
    setIsAddingModule(false);
  };

  const handleQuickAdd = async () => {
    if (!newContent.trim() || !activeModuleId) return;
    const firstLine = newContent.trim().split('\n')[0].substring(0, 40);
    const newItem: ContentItem = {
      id: Date.now().toString(),
      moduleId: activeModuleId,
      title: (firstLine || 'БЕЗ НАЗВАНИЯ').toUpperCase(),
      content: newContent,
      tags: [],
      type: 'text',
      createdAt: Date.now()
    };
    await setDoc(doc(db, "items", newItem.id), newItem);
    setNewContent('');
  };

  const deleteItem = async (id: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (window.confirm('УДАЛИТЬ?')) {
      await deleteDoc(doc(db, "items", id));
      // Если это был локальный айтем, он исчезнет из стейта при след. обновлении, 
      // но лучше также удалить из локалстореджа если мы в локальном режиме
      if (hasLocalData) {
        setItems(prev => prev.filter(i => i.id !== id));
      }
    }
  };

  const deleteModule = async (id: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (window.confirm('УДАЛИТЬ МОДУЛЬ?')) {
      await deleteDoc(doc(db, "modules", id));
      const q = query(collection(db, "items"), where("moduleId", "==", id));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.forEach(d => batch.delete(d.ref));
      await batch.commit();
      if (hasLocalData) {
        setModules(prev => prev.filter(m => m.id !== id));
        setItems(prev => prev.filter(i => i.moduleId !== id));
      }
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesModule = activeModuleId ? item.moduleId === activeModuleId : true;
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           item.content.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesModule && matchesSearch;
    }).sort((a, b) => b.createdAt - a.createdAt);
  }, [items, activeModuleId, searchQuery]);

  const activeModule = modules.find(m => m.id === activeModuleId);

  if (!isAuthenticated) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center p-6 font-bold">
        <form onSubmit={handleLogin} className="w-full max-w-md border-4 border-white bg-white p-12 shadow-[20px_20px_0px_0px_#00FF00]">
          <div className="flex justify-center mb-8">
            <LockClosedIcon className="w-12 h-12 text-black" />
          </div>
          <h1 className="text-4xl font-black text-center mb-8 uppercase italic tracking-tighter">Vault_Locked</h1>
          <input 
            type="password"
            autoFocus
            className="w-full border-4 border-black p-4 text-center text-2xl mb-6 focus:bg-[#00FF00]/10 outline-none"
            placeholder="****"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="w-full border-4 border-black bg-black text-white py-4 text-sm font-black tracking-widest hover:bg-[#00FF00] hover:text-black transition-colors">
            ACCESS_DATABASE
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white text-black font-bold">
      <aside className="w-80 border-r-4 border-black flex flex-col z-30 shrink-0 bg-white shadow-[10px_0px_30px_rgba(0,0,0,0.05)]">
        <div className="p-8 border-b-4 border-black bg-black text-white relative">
          <div className="flex items-center gap-3">
            <ArchiveBoxIcon className="w-8 h-8 text-[#00FF00]" />
            <h1 className="text-2xl font-black italic tracking-tighter">VAULT_BASE</h1>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${syncStatus === 'syncing' ? 'bg-yellow-400 animate-pulse' : (hasLocalData ? 'bg-orange-500 shadow-[0_0_8px_#f97316]' : 'bg-[#00FF00] shadow-[0_0_8px_#00FF00]')}`} />
            <span className="text-[10px] uppercase opacity-70">
              {hasLocalData ? 'UNSYNCED_LOCAL_DATA' : 'DATABASE_CLOUD_SYNC'}
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto custom-scrollbar">
          {hasLocalData && (
             <div className="p-6 bg-orange-100 border-b-4 border-black animate-pulse-subtle">
                <p className="text-[11px] uppercase mb-4 text-black font-black leading-tight">
                  Внимание! Обнаружены локальные файлы. Они не синхронизированы с облаком.
                </p>
                <button 
                  onClick={migrateToCloud}
                  className="w-full border-4 border-black bg-[#00FF00] text-black text-[10px] py-3 flex items-center justify-center gap-2 hover:bg-black hover:text-white transition-all font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1"
                >
                  <ArrowUpCircleIcon className="w-5 h-5" />
                  SYNC ALL TO CLOUD
                </button>
             </div>
          )}

          <button
            onClick={() => setActiveModuleId(null)}
            className={`w-full text-left px-8 py-5 text-xs border-b-2 border-black uppercase font-black transition-colors ${!activeModuleId ? 'bg-[#00FF00]' : 'hover:bg-gray-100'}`}
          >
            [ Весь архив ]
          </button>

          <div className="px-8 py-4 bg-gray-50 border-b-2 border-black flex items-center justify-between">
            <span className="text-[10px] uppercase opacity-40">Категории</span>
            <button onClick={() => setIsAddingModule(true)} className="p-1 border-2 border-black bg-white hover:bg-black hover:text-white transition-colors">
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col">
            {modules.map(module => (
              <div key={module.id} className="group relative border-b-2 border-black">
                <button
                  onClick={() => setActiveModuleId(module.id)}
                  className={`w-full text-left px-8 py-4 text-sm transition-all pr-16 uppercase font-black ${activeModuleId === module.id ? 'bg-black text-white' : 'hover:bg-gray-50'}`}
                >
                  {module.title}
                </button>
                <button 
                  onClick={(e) => deleteModule(module.id, e)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all z-40 border-2 border-black bg-white"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {isAddingModule && (
            <div className="p-8 border-b-2 border-black bg-white">
              <input 
                autoFocus
                placeholder="ИМЯ МОДУЛЯ..."
                className="w-full border-2 border-black p-3 text-xs mb-4 uppercase outline-none focus:bg-[#00FF00]/10"
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addModule()}
              />
              <div className="flex gap-2">
                <button onClick={addModule} className="border-2 border-black flex-1 bg-black text-white text-[10px] py-2 hover:bg-[#00FF00] hover:text-black font-black">SAVE</button>
                <button onClick={() => setIsAddingModule(false)} className="border-2 border-black flex-1 text-[10px] py-2 hover:bg-gray-100 font-black">CANCEL</button>
              </div>
            </div>
          )}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-full bg-[#f4f4f4]">
        <header className="h-20 border-b-4 border-black flex items-center justify-between px-10 bg-white">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">
              {activeModule ? `/${activeModule.title}` : '/ARCHIVE_ALL'}
            </h2>
            {hasLocalData && <span className="bg-orange-500 text-white text-[8px] px-2 py-1 rounded">LOCAL_VIEW</span>}
          </div>
          <div className="relative w-64">
            <input 
              placeholder="ПОИСК..."
              className="w-full border-2 border-black px-4 py-2 text-xs uppercase outline-none focus:bg-[#00FF00]/10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <MagnifyingGlassIcon className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 opacity-30" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-10">
            {activeModuleId && (
              <div className="border-4 border-black bg-white p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <textarea 
                  className="w-full min-h-[120px] border-none focus:ring-0 text-lg leading-relaxed resize-none placeholder:text-gray-200 bg-transparent outline-none font-black italic"
                  placeholder="Введите текст для сохранения в базу..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                />
                <div className="mt-6 pt-6 border-t-2 border-black border-dashed flex justify-end">
                  <button 
                    onClick={handleQuickAdd}
                    disabled={!newContent.trim()}
                    className="border-4 border-black bg-black text-white px-10 py-3 text-[10px] font-black hover:bg-[#00FF00] hover:text-black transition-colors disabled:opacity-30 active:shadow-none active:translate-x-1 active:translate-y-1"
                  >
                    ADD_TO_DATABASE
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-8 pb-20">
              {filteredItems.map(item => (
                <article 
                  key={item.id} 
                  className="border-4 border-black bg-white cursor-pointer hover:shadow-[12px_12px_0px_0px_#00FF00] transition-all group"
                  onClick={() => setSelectedItem(item)}
                >
                  <div className="p-4 border-b-2 border-black flex justify-between items-center bg-gray-50 group-hover:bg-[#00FF00]/5">
                     <h3 className="text-md font-black uppercase underline decoration-[#00FF00] decoration-4 tracking-tight">
                       {item.title}
                     </h3>
                     <div className="flex items-center gap-4">
                       <span className="text-[9px] opacity-30 font-black tracking-widest">{new Date(item.createdAt).toLocaleDateString()}</span>
                       <button 
                          onClick={(e) => deleteItem(item.id, e)}
                          className="p-1 hover:text-red-600 transition-colors"
                       >
                         <TrashIcon className="w-4 h-4" />
                       </button>
                     </div>
                  </div>
                  <div className="p-6 bg-white line-clamp-3 text-sm opacity-70 font-black italic leading-relaxed">
                    {item.content}
                  </div>
                </article>
              ))}
              
              {filteredItems.length === 0 && (
                <div className="text-center py-20 opacity-20 italic uppercase font-black text-4xl tracking-tighter">
                  No_Data_Found
                </div>
              )}
            </div>
          </div>
        </div>

        {selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 animate-in fade-in duration-300 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => setSelectedItem(null)} />
            <div className="relative w-full max-w-5xl h-[85vh] bg-white border-4 border-black shadow-[20px_20px_0px_0px_#00FF00] flex flex-col">
              <header className="p-6 border-b-4 border-black flex justify-between items-center bg-white sticky top-0">
                <h2 className="text-2xl font-black uppercase underline decoration-[#00FF00] decoration-4 tracking-tighter">{selectedItem.title}</h2>
                <button onClick={() => setSelectedItem(null)} className="border-4 border-black bg-black text-white p-2 hover:bg-[#00FF00] hover:text-black transition-colors">
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </header>
              <div className="flex-1 overflow-y-auto p-12 bg-white custom-scrollbar selection:bg-[#00FF00]">
                <div className="text-xl leading-relaxed whitespace-pre-wrap italic font-black text-black/80">
                  {selectedItem.content}
                </div>
              </div>
              <footer className="p-4 border-t-2 border-black bg-gray-50 text-[10px] uppercase opacity-40 font-black flex justify-between italic">
                <span>Created: {new Date(selectedItem.createdAt).toLocaleString()}</span>
                <span>ID: {selectedItem.id}</span>
              </footer>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
