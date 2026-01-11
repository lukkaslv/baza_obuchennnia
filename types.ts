
export interface Module {
  id: string;
  title: string;
  description: string;
  createdAt: number;
}

export interface ContentItem {
  id: string;
  moduleId: string;
  title: string;
  content: string;
  tags: string[];
  type: 'text' | 'summary' | 'qa' | 'guide';
  createdAt: number;
}

export interface AppState {
  modules: Module[];
  items: ContentItem[];
  activeModuleId: string | null;
}
