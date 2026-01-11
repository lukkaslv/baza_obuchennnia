
import React, { useState, useEffect, useMemo } from 'react';
import { Module, ContentItem } from './types';
import { analyzeContent } from './geminiService';
import { 
  PlusIcon, 
  TrashIcon, 
  SparklesIcon, 
  MagnifyingGlassIcon, 
  XMarkIcon,
  ArchiveBoxIcon,
  Squares2X2Icon
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
    e.stopPropagation(); // Важно: чтобы не открывался попап при клике на корзину
    if (window.confirm('УДАЛИТЬ ЗАПИСЬ НАВСЕГДА?')) {
      setItems(prev => prev.filter(item => item.id !== id));
      if (selectedItem?.id === id) setSelectedItem(null);
    }
  };

  const deleteModule = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Важно: чтобы не выбирался модуль при клике на корзину
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
    <div className="flex h-screen overflow-hidden font-bold">
      {/* SIDEBAR */}
      <aside className="w-80 b-border-r flex flex-col z-30 shrink-0 bg-white">
        <div className="p-8 b-border-b bg-black text-white">
          <div className="flex items-center gap-3">
            <ArchiveBoxIcon className="w-8 h-8 text-[#00FF00]" />
            <h1 className="text-3xl font-black tracking-tighter">БАЗА.</h1>
          </div>
          <p className="text-[10px] mt-2 opacity-60">EDU_VAULT V3.0 // RAW_BRUTALISM</p>
        </div>

        <nav className="flex-1 overflow-y-auto custom-scrollbar">
          <button
            onClick={() => setActiveModuleId(null)}
            className={`w-full text-left px-8 py-5 text-sm b-border-b transition-colors ${!activeModuleId ? 'bg-[#00FF00] text-black' : 'hover:bg-gray-100'}`}
          >
            [ ВСЕ_МАТЕРИАЛЫ ]
          </button>

          <div className="px-8 py-3 bg-gray-100 b-border-b flex items-center justify-between">
            <span className="text-[10px] tracking-widest uppercase">Модули</span>
            <button onClick={() => setIsAddingModule(true)} className="hover:scale-125 transition-transform p-1">
              <PlusIcon className="w-5 h-5 stroke-[3px]" />
            </button>
          </div>

          <div className="flex flex-col">
            {modules.map(module => (
              <div key={module.id} className="group relative b-border-b">
                <button
                  onClick={() => setActiveModuleId(module.id)}
                  className={`w-full text-left px-8 py-5 text-sm transition-colors pr-16 ${activeModuleId === module.id ? 'bg-black text-white' : 'hover:bg-gray-50'}`}
                >
                  <span className="opacity-30 mr-2">/</span>
                  {module.title}
                </button>
                <button 
                  onClick={(e) => deleteModule(module.id, e)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white text-black b-border opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all z-40"
                  aria-label="Удалить модуль"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {isAddingModule && (
            <div className="p-8 b-border-b bg-gray-50">
              <input 
                autoFocus
                placeholder="ИМЯ_МОДУЛЯ"
                className="w-full b-border px-4 py-3 text-sm outline-none mb-4"
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addModule()}
              />
              <div className="flex gap-2">
                <button onClick={addModule} className="b-btn flex-1 bg-black text-white">ОК</button>
                <button onClick={() => setIsAddingModule(false)} className="b-btn flex-1">ОТМЕНА</button>
              </div>
            </div>
          )}
        </nav>

        <div className="p-8 b-border-t flex flex-col gap-4">
          <div className="flex gap-2">
            <button className="flex-1 b-btn text-[10px]">ЭКСПОРТ</button>
            <button className="flex-1 b-btn text-[10px]">ИМПОРТ</button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full bg-white relative">
        <header className="h-24 b-border-b flex items-center justify-between px-12 shrink-0">
          <div className="flex items-center gap-12 flex-1">
            <h2 className="text-4xl font-black tracking-tighter uppercase">
              {activeModule ? `${activeModule.title}` : 'ОБЩИЙ_АРХИВ'}
            </h2>
            <div className="relative max-w-sm w-full">
              <input 
                placeholder="ПОИСК..."
                className="w-full b-input py-2 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <MagnifyingGlassIcon className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Squares2X2Icon className="w-6 h-6" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-[#f5f5f5]">
          <div className="max-w-5xl mx-auto space-y-16">
            
            {activeModuleId && (
              <div className="b-border bg-white p-10">
                <textarea 
                  className="w-full min-h-[120px] border-none focus:ring-0 text-2xl leading-relaxed resize-none placeholder:text-gray-200"
                  placeholder="Вставьте текст материала..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                />
                <div className="mt-8 pt-8 b-border-t flex justify-between items-center">
                   <span className="text-[10px] bg-black text-white px-3 py-1">МОДУЛЬ: {activeModule?.title}</span>
                   <div className="flex gap-4">
                    <button 
                      onClick={handleAIAdd}
                      disabled={isProcessing || !newContent.trim()}
                      className={`b-btn ${isProcessing ? 'animate-pulse' : ''}`}
                    >
                      <SparklesIcon className="w-6 h-6" />
                    </button>
                    <button 
                      onClick={handleQuickAdd}
                      disabled={!newContent.trim()}
                      className="b-btn bg-black text-white px-12"
                    >
                      СОХРАНИТЬ_В_БАЗУ
                    </button>
                   </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-12 pb-32">
              {filteredItems.length === 0 ? (
                <div className="py-40 text-center opacity-20">
                  <h3 className="text-6xl font-black uppercase tracking-tighter">Пусто_в_архиве</h3>
                </div>
              ) : (
                filteredItems.map(item => (
                  <article 
                    key={item.id} 
                    className="b-border bg-white group cursor-pointer hover:bg-[#fafafa] transition-colors overflow-hidden"
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="p-6 b-border-b flex justify-between items-center bg-gray-50">
                       <h3 className="text-xl font-black tracking-tighter group-hover:underline">
                         {item.title}
                       </h3>
                       <div className="flex items-center gap-4 relative z-50">
                         <span className="text-[10px] text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</span>
                         <button 
                            onClick={(e) => deleteItem(item.id, e)}
                            className="p-2 b-border bg-white hover:bg-red-500 hover:text-white transition-all"
                            aria-label="Удалить запись"
                         >
                           <TrashIcon className="w-5 h-5" />
                         </button>
                       </div>
                    </div>

                    <div className="p-10">
                      <div className="readable-text text-xl leading-relaxed text-black line-clamp-5">
                        {item.content}
                      </div>
                      {item.tags && item.tags.length > 0 && (
                        <div className="mt-8 pt-6 b-border-t flex gap-2 flex-wrap border-dashed">
                          {item.tags.map(tag => (
                            <span key={tag} className="px-2 py-1 bg-black text-white text-[9px] uppercase">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>

        {/* FULLSCREEN POPUP */}
        {selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-stretch">
            <div 
              className="w-1/4 bg-black/40 cursor-pointer hidden md:block"
              onClick={() => setSelectedItem(null)}
            />
            <div className="flex-1 bg-white b-border-l flex flex-col animate-in slide-in-from-right duration-300">
              <header className="p-10 b-border-b flex justify-between items-center bg-[#00FF00]">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-black">РЕЖИМ_ЧТЕНИЯ</span>
                  <h2 className="text-4xl font-black tracking-tighter uppercase leading-none mt-2 text-black">{selectedItem.title}</h2>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={(e) => deleteItem(selectedItem.id, e)}
                    className="b-btn bg-white hover:bg-red-500 hover:text-white"
                  >
                    <TrashIcon className="w-8 h-8" />
                  </button>
                  <button 
                    onClick={() => setSelectedItem(null)}
                    className="b-btn bg-white"
                  >
                    <XMarkIcon className="w-10 h-10 stroke-2" />
                  </button>
                </div>
              </header>
              <div className="flex-1 overflow-y-auto p-12 md:p-24 custom-scrollbar">
                <div className="max-w-4xl mx-auto">
                  <p className="readable-text text-3xl leading-[1.8] text-black whitespace-pre-wrap">
                    {selectedItem.content}
                  </p>
                  {selectedItem.tags && selectedItem.tags.length > 0 && (
                    <div className="mt-20 pt-10 b-border-t flex gap-3 flex-wrap">
                      {selectedItem.tags.map(tag => (
                        <span key={tag} className="px-4 py-2 b-border bg-black text-white text-[12px]">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <footer className="mt-32 py-10 b-border-t text-[11px] flex justify-between uppercase opacity-40">
                    <span>ID_{selectedItem.id}</span>
                    <span>Записано: {new Date(selectedItem.createdAt).toLocaleString()}</span>
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
