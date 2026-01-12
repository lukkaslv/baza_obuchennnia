
import React, { useState, useEffect, useMemo } from 'react';
import { Module, ContentItem } from './types';
// Fixed: Using correct firebase import path for this environment
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
  CloudArrowUpIcon,
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

  useEffect(() => {
    const auth = localStorage.getItem('vault_auth');
    if (auth === 'true') setIsAuthenticated(true);

    const savedModules = localStorage.getItem('eduvault_modules');
    const savedItems = localStorage.getItem('eduvault_items');
    
    if (savedModules || savedItems) {
      setHasLocalData(true);
      if (savedModules && modules.length === 0) setModules(JSON.parse(savedModules));
      if (savedItems && items.length === 0) setItems(JSON.parse(savedItems));
      setSyncStatus('local');
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      const unsubModules = onSnapshot(collection(db, "modules"), (snapshot) => {
        const cloudModules = snapshot.docs.map(doc => doc.data() as Module);
        if (cloudModules.length > 0) {
          setModules(cloudModules);
          setSyncStatus('idle');
          setHasLocalData(false);
        }
      });

      const unsubItems = onSnapshot(collection(db, "items"), (snapshot) => {
        const cloudItems = snapshot.docs.map(doc => doc.data() as ContentItem);
        if (cloudItems.length > 0) {
          setItems(cloudItems);
        }
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

  const migrateToCloud = async () => {
    setSyncStatus('syncing');
    try {
      const batch = writeBatch(db);
      
      modules.forEach((m) => {
        const ref = doc(db, "modules", m.id);
        batch.set(ref, m);
      });

      items.forEach((item) => {
        const ref = doc(db, "items", item.id);
        batch.set(ref, item);
      });

      await batch.commit();
      
      localStorage.removeItem('eduvault_modules');
      localStorage.removeItem('eduvault_items');
      setHasLocalData(false);
      setSyncStatus('idle');
      alert("МИГРАЦИЯ ИЗ LOCALSTORAGE УСПЕШНА.");
    } catch (e) {
      console.error(e);
      setSyncStatus('error');
      alert("ОШИБКА МИГРАЦИИ");
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
    setSyncStatus('syncing');
    await setDoc(doc(db, "modules", newModule.id), newModule);
    setNewModuleTitle('');
    setIsAddingModule(false);
    setSyncStatus('idle');
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
    setSyncStatus('syncing');
    await setDoc(doc(db, "items", newItem.id), newItem);
    setNewContent('');
    setSyncStatus('idle');
  };

  const deleteItem = async (id: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (window.confirm('УДАЛИТЬ ЗАПИСЬ?')) {
      setSyncStatus('syncing');
      await deleteDoc(doc(db, "items", id));
      if (selectedItem?.id === id) setSelectedItem(null);
      setSyncStatus('idle');
    }
  };

  const deleteModule = async (id: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (window.confirm('УДАЛИТЬ МОДУЛЬ И ВСЁ СОДЕРЖИМОЕ?')) {
      setSyncStatus('syncing');
      await deleteDoc(doc(db, "modules", id));
      const q = query(collection(db, "items"), where("moduleId", "==", id));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.forEach(d => batch.delete(d.ref));
      await batch.commit();
      if (activeModuleId === id) setActiveModuleId(null);
      setSyncStatus('idle');
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
          <h1 className="text-4xl font-black text-center mb-8 uppercase italic">Vault_Locked</h1>
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
      <aside className="w-80 border-r-4 border-black flex flex-col z-30 shrink-0 bg-white">
        <div className="p-8 border-b-4 border-black bg-black text-white relative">
          <div className="flex items-center gap-3">
            <ArchiveBoxIcon className="w-8 h-8 text-[#00FF00]" />
            <h1 className="text-2xl font-black italic">VAULT_BASE</h1>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${syncStatus === 'syncing' ? 'bg-yellow-400 animate-pulse' : 'bg-[#00FF00]'}`} />
            <span className="text-[10px] uppercase opacity-50">
              {syncStatus === 'local' ? 'LOCAL_DATA_DETECTED' : 'FIREBASE_ONLINE'}
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto">
          {hasLocalData && (
             <div className="p-6 bg-[#00FF00]/10 border-b-4 border-black">
                <p className="text-[10px] uppercase mb-4 text-black font-black">Обнаружены данные в LocalStorage!</p>
                <button 
                  onClick={migrateToCloud}
                  className="w-full border-2 border-black bg-black text-white text-[10px] py-3 flex items-center justify-center gap-2 hover:bg-[#00FF00] hover:text-black transition-colors"
                >
                  <ArrowUpCircleIcon className="w-4 h-4" />
                  MIGRATE TO FIREBASE
                </button>
             </div>
          )}

          <button
            onClick={() => setActiveModuleId(null)}
            className={`w-full text-left px-8 py-5 text-xs border-b-2 border-black uppercase font-black ${!activeModuleId ? 'bg-[#00FF00]' : 'hover:bg-gray-100'}`}
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

      <main className="flex-1 flex flex-col h-full bg-[#fafafa]">
        <header className="h-20 border-b-4 border-black flex items-center justify-between px-10 bg-white">
          <h2 className="text-2xl font-black uppercase italic">
            {activeModule ? `/${activeModule.title}` : '/ALL_DATA'}
          </h2>
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

        <div className="flex-1 overflow-y-auto p-10">
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
                    className="border-2 border-black bg-black text-white px-10 py-3 text-[10px] font-black hover:bg-[#00FF00] hover:text-black transition-colors disabled:opacity-30 disabled:hover:bg-black disabled:hover:text-white"
                  >
                    SAVE_TO_FIREBASE
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-8 pb-20">
              {filteredItems.map(item => (
                <article 
                  key={item.id} 
                  className="border-4 border-black bg-white cursor-pointer hover:shadow-[8px_8px_0px_0px_#00FF00] transition-all"
                  onClick={() => setSelectedItem(item)}
                >
                  <div className="p-4 border-b-2 border-black flex justify-between items-center">
                     <h3 className="text-md font-black uppercase underline decoration-[#00FF00] decoration-4">
                       {item.title}
                     </h3>
                     <div className="flex items-center gap-4">
                       <span className="text-[9px] opacity-30 font-black">{new Date(item.createdAt).toLocaleDateString()}</span>
                       <button 
                          onClick={(e) => deleteItem(item.id, e)}
                          className="p-1 hover:text-red-600 transition-colors"
                       >
                         <TrashIcon className="w-4 h-4" />
                       </button>
                     </div>
                  </div>
                  <div className="p-6 bg-white line-clamp-3 text-sm opacity-70 font-black italic">
                    {item.content}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        {selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 animate-in fade-in">
            <div className="absolute inset-0" onClick={() => setSelectedItem(null)} />
            <div className="relative w-full max-w-5xl h-[80vh] bg-white border-4 border-black shadow-[20px_20px_0px_0px_#00FF00] flex flex-col">
              <header className="p-6 border-b-4 border-black flex justify-between items-center bg-white sticky top-0">
                <h2 className="text-2xl font-black uppercase underline decoration-[#00FF00] decoration-4">{selectedItem.title}</h2>
                <button onClick={() => setSelectedItem(null)} className="border-4 border-black bg-black text-white p-2 hover:bg-[#00FF00] hover:text-black transition-colors">
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </header>
              <div className="flex-1 overflow-y-auto p-12 bg-white">
                <div className="text-xl leading-relaxed whitespace-pre-wrap italic font-black">
                  {selectedItem.content}
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
