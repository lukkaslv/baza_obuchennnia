
import React, { useState, useEffect, useMemo } from 'react';
import { Module, ContentItem } from './types';
import { analyzeContent } from './geminiService';
import { 
  PlusIcon, 
  TrashIcon, 
  SparklesIcon, 
  MagnifyingGlassIcon, 
  XMarkIcon,
  ArchiveBoxIcon
} from '@heroicons/react/24/outline';

const App: React.FC = () => {
  const [modules, setModules] = useState<Module[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [isAddingModule, setIsAddingModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);

  useEffect(() => {
    try {
      const savedModules = localStorage.getItem('eduvault_modules');
      const savedItems = localStorage.getItem('eduvault_items');
      if (savedModules) setModules(JSON.parse(savedModules));
      if (savedItems) setItems(JSON.parse(savedItems));
    } catch (e) {
      console.error("Storage error", e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('eduvault_modules', JSON.stringify(modules));
    localStorage.setItem('eduvault_items', JSON.stringify(items));
  }, [modules, items]);

  const addModule = () => {
    if (!newModuleTitle.trim()) return;
    const newModule: Module = {
      id: Date.now().toString(),
      title: newModuleTitle.toUpperCase(),
      description: '',
      createdAt: Date.now()
    };
    setModules([...modules, newModule]);
    setNewModuleTitle('');
    setIsAddingModule(false);
    setActiveModuleId(newModule.id);
  };

  const handleQuickAdd = () => {
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
    setItems([newItem, ...items]);
    setNewContent('');
  };

  const handleAIAdd = async () => {
    if (!newContent.trim() || !activeModuleId) return;
    setIsProcessing(true);
    try {
      const analysis = await analyzeContent(newContent);
      const newItem: ContentItem = {
        id: Date.now().toString(),
        moduleId: activeModuleId,
        title: (analysis.title || 'AI_АНАЛИЗ').toUpperCase(),
        content: newContent,
        tags: analysis.suggestedTags || [],
        type: 'text',
        createdAt: Date.now()
      };
      setItems([newItem, ...items]);
      setNewContent('');
    } catch (error) {
      handleQuickAdd();
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteItem = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('УДАЛИТЬ ЗАПИСЬ НАВСЕГДА?')) {
      setItems(prev => prev.filter(item => item.id !== id));
      if (selectedItem?.id === id) setSelectedItem(null);
    }
  };

  const deleteModule = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('УДАЛИТЬ МОДУЛЬ И ВСЕ ЕГО ЗАПИСИ?')) {
      setModules(prev => prev.filter(m => m.id !== id));
      setItems(prev => prev.filter(item => item.moduleId !== id));
      if (activeModuleId === id) setActiveModuleId(null);
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

  const activeModule = modules.find(m => m.id === activeModuleId);

  return (
    <div className="flex h-screen overflow-hidden font-bold selection:bg-black selection:text-[#00FF00] bg-white text-black">
      {/* SIDEBAR */}
      <aside className="w-80 b-border-r flex flex-col z-30 shrink-0 bg-white">
        <div className="p-8 b-border-b bg-black text-white">
          <div className="flex items-center gap-3">
            <ArchiveBoxIcon className="w-8 h-8 text-[#00FF00]" />
            <h1 className="text-3xl font-black tracking-tighter italic">VAULT.</h1>
          </div>
          <p className="text-[9px] mt-4 tracking-[0.3em] opacity-40 uppercase">Knowledge base / v3.0</p>
        </div>

        <nav className="flex-1 overflow-y-auto custom-scrollbar">
          <button
            onClick={() => setActiveModuleId(null)}
            className={`w-full text-left px-8 py-6 text-xs b-border-b transition-all uppercase tracking-widest ${!activeModuleId ? 'bg-[#00FF00] text-black' : 'hover:bg-gray-100'}`}
          >
            [ Весь архив ]
          </button>

          <div className="px-8 py-4 bg-gray-50 b-border-b flex items-center justify-between">
            <span className="text-[10px] tracking-widest uppercase opacity-40">Модули</span>
            <button onClick={() => setIsAddingModule(true)} className="hover:scale-125 transition-transform p-1">
              <PlusIcon className="w-5 h-5 stroke-[3px]" />
            </button>
          </div>

          <div className="flex flex-col">
            {modules.map(module => (
              <div key={module.id} className="group relative b-border-b">
                <button
                  onClick={() => setActiveModuleId(module.id)}
                  className={`w-full text-left px-8 py-5 text-sm transition-all pr-16 uppercase tracking-tight ${activeModuleId === module.id ? 'bg-black text-white' : 'hover:bg-gray-50'}`}
                >
                  {module.title}
                </button>
                <button 
                  onClick={(e) => deleteModule(module.id, e)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white text-black b-border opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all z-40"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {isAddingModule && (
            <div className="p-8 b-border-b bg-white animate-in slide-in-from-top duration-200">
              <input 
                autoFocus
                placeholder="НАЗВАНИЕ..."
                className="w-full b-border px-4 py-3 text-xs outline-none mb-4 focus:bg-gray-50 font-bold"
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addModule()}
              />
              <div className="flex gap-2">
                <button onClick={addModule} className="b-btn flex-1 bg-black text-white text-[10px]">СОЗДАТЬ</button>
                <button onClick={() => setIsAddingModule(false)} className="b-btn flex-1 text-[10px]">ОТМЕНА</button>
              </div>
            </div>
          )}
        </nav>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col h-full bg-[#fafafa] relative">
        <header className="h-24 b-border-b flex items-center justify-between px-12 bg-white shrink-0 z-20">
          <div className="flex items-center gap-12 flex-1">
            <h2 className="text-4xl font-black tracking-tighter uppercase italic">
              {activeModule ? `/${activeModule.title}` : '/ОБЩИЙ_АРХИВ'}
            </h2>
            <div className="relative max-w-sm w-full">
              <input 
                placeholder="БЫСТРЫЙ ПОИСК..."
                className="w-full b-input py-2 text-xs uppercase"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <MagnifyingGlassIcon className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-20" />
            </div>
          </div>
          <div className="mono text-[10px] tracking-widest opacity-30">
            TOTAL_ITEMS: {filteredItems.length}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-12">
            
            {activeModuleId && (
              <div className="b-border bg-white p-10 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all">
                <textarea 
                  className="w-full min-h-[120px] border-none focus:ring-0 text-xl leading-relaxed resize-none placeholder:text-gray-200 font-bold"
                  placeholder="Вставьте учебный материал..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                />
                <div className="mt-8 pt-8 b-border-t flex justify-between items-center border-dashed">
                   <span className="text-[10px] font-black uppercase tracking-widest opacity-30">Режим: {activeModule?.title}</span>
                   <div className="flex gap-4">
                    <button 
                      onClick={handleAIAdd}
                      disabled={isProcessing || !newContent.trim()}
                      className={`b-btn flex items-center gap-2 ${isProcessing ? 'animate-pulse bg-[#00FF00]' : ''}`}
                    >
                      <SparklesIcon className="w-5 h-5" />
                      <span className="text-[10px]">AI ANALYZE</span>
                    </button>
                    <button 
                      onClick={handleQuickAdd}
                      disabled={!newContent.trim()}
                      className="b-btn bg-black text-white px-12 text-[10px]"
                    >
                      СОХРАНИТЬ В БАЗУ
                    </button>
                   </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-10 pb-40">
              {filteredItems.length === 0 ? (
                <div className="py-40 text-center opacity-5">
                  <h3 className="text-8xl font-black uppercase tracking-tighter">Empty</h3>
                </div>
              ) : (
                filteredItems.map(item => (
                  <article 
                    key={item.id} 
                    className="b-border bg-white cursor-pointer hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[10px_10px_0px_0px_#00FF00] transition-all overflow-hidden"
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="p-6 b-border-b flex justify-between items-center bg-white">
                       <h3 className="text-lg font-black tracking-tight uppercase group-hover:underline">
                         {item.title}
                       </h3>
                       <div className="flex items-center gap-6 relative z-50">
                         <span className="text-[9px] font-bold opacity-30 uppercase">{new Date(item.createdAt).toLocaleDateString()}</span>
                         <button 
                            onClick={(e) => deleteItem(item.id, e)}
                            className="p-1.5 hover:text-red-600 transition-colors b-border bg-white hover:bg-black"
                         >
                           <TrashIcon className="w-4 h-4" />
                         </button>
                       </div>
                    </div>

                    <div className="p-10 bg-[#fafafa]">
                      <div className="readable-text text-xl leading-relaxed text-black line-clamp-5 opacity-80">
                        {item.content}
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>

        {/* READER MODAL */}
        {selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12">
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => setSelectedItem(null)}
            />
            <div className="relative w-full max-w-5xl h-full bg-white b-border shadow-[30px_30px_0px_0px_rgba(0,255,0,0.3)] flex flex-col animate-in zoom-in-95 duration-300">
              <header className="p-8 b-border-b flex justify-between items-center bg-white shrink-0 sticky top-0 z-10">
                <div className="flex flex-col">
                  <div className="flex gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest bg-black text-[#00FF00] px-2 py-1">Document</span>
                    <span className="text-[9px] font-black uppercase tracking-widest bg-[#00FF00] text-black px-2 py-1">Verified</span>
                  </div>
                  <h2 className="text-3xl font-black tracking-tighter uppercase mt-4 leading-none">{selectedItem.title}</h2>
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={(e) => deleteItem(selectedItem.id, e)}
                    className="b-btn hover:bg-red-500 hover:text-white p-4"
                  >
                    <TrashIcon className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={() => setSelectedItem(null)}
                    className="b-btn bg-black text-white p-4"
                  >
                    <XMarkIcon className="w-6 h-6 stroke-[3px]" />
                  </button>
                </div>
              </header>
              
              <div className="flex-1 overflow-y-auto p-12 md:p-24 custom-scrollbar bg-white">
                <div className="max-w-3xl mx-auto">
                  <div className="readable-text text-3xl leading-[2.1] text-black whitespace-pre-wrap selection:bg-[#00FF00]">
                    {selectedItem.content}
                  </div>
                  
                  {selectedItem.tags && selectedItem.tags.length > 0 && (
                    <div className="mt-32 pt-12 b-border-t border-dashed flex gap-3 flex-wrap">
                      {selectedItem.tags.map(tag => (
                        <span key={tag} className="px-4 py-2 b-border bg-[#00FF00] text-black text-[12px] font-black uppercase tracking-widest">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <footer className="mt-40 py-12 b-border-t text-[10px] flex justify-between uppercase opacity-20 font-black tracking-[0.5em]">
                    <span>REF_ID: {selectedItem.id}</span>
                    <span>TIMESTAMP: {new Date(selectedItem.createdAt).toISOString()}</span>
                  </footer>
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
