import { useState, useEffect } from 'react';
import { Code, Save, X, FileText, Folder, ChevronDown, Plus, Trash2, FileCode, FileJson, FileImage, File, Copy } from 'lucide-react';
import { listFiles, getFile, saveFile, deleteFile } from '../services/api';
import { useBuilderStore } from '../store/builderStore';

interface FileEditorProps {
  projectId: string;
  onClose?: () => void;
}

interface FileTreeItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeItem[];
}

export default function FileEditor({ projectId, onClose }: FileEditorProps) {
  const { setSelectedFile } = useBuilderStore();
  const fileRefreshCounter = useBuilderStore((s) => s.fileRefreshCounter);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [fileTree, setFileTree] = useState<FileTreeItem[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');

  useEffect(() => {
    loadFiles();
  }, [projectId, fileRefreshCounter]);

  const loadFiles = async () => {
    try {
      const data = await listFiles(projectId);
      setFiles(data.files);
      setFileTree(buildFileTree(data.files));
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const buildFileTree = (files: Record<string, string>): FileTreeItem[] => {
    const tree: FileTreeItem[] = [];
    const dirs: Map<string, FileTreeItem & { children: FileTreeItem[] }> = new Map();

    Object.keys(files).forEach((path) => {
      const parts = path.split('/');
      let currentPath = '';

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (index === parts.length - 1) {
          // It's a file
          const dirPath = parts.slice(0, -1).join('/');
          const parent = dirs.get(dirPath) || { children: tree };
          const newFile: FileTreeItem = {
            name: part,
            path: currentPath,
            type: 'file',
          };
          (parent.children as FileTreeItem[]).push(newFile);
        } else {
          // It's a directory
          if (!dirs.has(currentPath)) {
            const dirPath = parts.slice(0, -1).join('/');
            const parent = dirs.get(dirPath) || { children: tree };
            const newDir: FileTreeItem & { children: FileTreeItem[] } = {
              name: part,
              path: currentPath,
              type: 'directory',
              children: [],
            };
            (parent.children as FileTreeItem[]).push(newDir);
            dirs.set(currentPath, newDir);
          }
        }
      });
    });

    return tree;
  };

  const toggleDir = (path: string) => {
    const newExpanded = new Set(expandedDirs);
    if (expandedDirs.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedDirs(newExpanded);
  };

  const handleFileSelect = async (path: string) => {
    setSelectedFilePath(path);
    try {
      const file = await getFile(projectId, path);
      setFileContent(file.content);
      setSelectedFile(path, file.content);
    } catch (error) {
      console.error('Error loading file:', error);
    }
  };

  const handleSave = async () => {
    if (!selectedFilePath) return;
    setIsSaving(true);
    try {
      await saveFile(projectId, selectedFilePath, fileContent);
    } catch (error) {
      console.error('Error saving file:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFile = async (path: string) => {
    if (!confirm(`Supprimer ${path} ?`)) return;
    try {
      await deleteFile(projectId, path);
      loadFiles();
      if (selectedFilePath === path) {
        setSelectedFilePath(null);
        setFileContent('');
        setSelectedFile(null, undefined);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  const handleDuplicateFile = async (path: string) => {
    const parts = path.split('/');
    const fileName = parts.pop();
    const newFileName = fileName?.replace(/(\.[^.]+)$/, '-copy$1') || `${fileName}-copy`;
    const newPath = [...parts, newFileName].join('/');
    
    try {
      const content = files[path];
      await saveFile(projectId, newPath, content);
      loadFiles();
      handleFileSelect(newPath);
    } catch (error) {
      console.error('Error duplicating file:', error);
    }
  };

  const handleCreateFile = async () => {
    if (!newFilePath.trim()) return;
    try {
      await saveFile(projectId, newFilePath, '');
      loadFiles();
      setShowNewFileModal(false);
      setNewFilePath('');
      handleFileSelect(newFilePath);
    } catch (error) {
      console.error('Error creating file:', error);
    }
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'tsx':
      case 'jsx':
        return <FileCode className="w-4 h-4 text-blue-400 glow-icon" />;
      case 'ts':
      case 'js':
        return <FileCode className="w-4 h-4 text-yellow-400 glow-icon" />;
      case 'json':
        return <FileJson className="w-4 h-4 text-green-400 glow-icon" />;
      case 'css':
        return <FileText className="w-4 h-4 text-purple-400 glow-icon" />;
      case 'html':
        return <FileText className="w-4 h-4 text-orange-400 glow-icon" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return <FileImage className="w-4 h-4 text-pink-400 glow-icon" />;
      default:
        return <File className="w-4 h-4 text-gray-400" />;
    }
  };

  const renderTreeItem = (item: FileTreeItem, depth: number = 0) => {
    const isExpanded = expandedDirs.has(item.path);
    const hasChildren = item.type === 'directory' && item.children && item.children.length > 0;

    return (
      <div key={item.path}>
        <div
          className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-all duration-200 rounded-lg group ${
            selectedFilePath === item.path 
              ? 'bg-blue-500/20 border border-blue-500/30' 
              : 'hover:bg-t-overlay/5'
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (item.type === 'directory') {
              toggleDir(item.path);
            } else {
              handleFileSelect(item.path);
            }
          }}
        >
          {hasChildren && (
            <ChevronDown className={`w-4 h-4 text-t-text/50 transition-transform ${!isExpanded ? 'transform -rotate-90' : ''}`} />
          )}
          {!hasChildren && <span className="w-4" />}
          {item.type === 'directory' ? (
            <Folder className="w-4 h-4 text-yellow-400 glow-icon" />
          ) : (
            getFileIcon(item.name)
          )}
          <span className="text-sm text-t-text/80 truncate flex-1">{item.name}</span>
          {item.type === 'file' && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicateFile(item.path);
                }}
                className="p-1 rounded hover:bg-t-overlay/10 text-t-text/50 hover:text-blue-400"
                title="Dupliquer"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteFile(item.path);
                }}
                className="p-1 rounded hover:bg-t-overlay/10 text-t-text/50 hover:text-red-400"
                title="Supprimer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        {item.type === 'directory' && isExpanded && item.children && (
          <div className="animate-fade-in-up">
            {item.children.map((child) => renderTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-t-overlay/10">
        <div className="flex items-center gap-2">
          <Code className="w-5 h-5 text-blue-400 glow-icon" />
          <span className="font-semibold gradient-text">Fichiers</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowNewFileModal(true)}
            className="btn-outline-glow p-2 rounded-lg"
            title="Nouveau fichier"
          >
            <Plus className="w-4 h-4 text-t-text/70" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-t-text/50 hover:text-t-text hover:bg-t-overlay/10 transition-colors"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-auto py-2">
        {isLoading ? (
          <div className="text-t-text/40 text-sm px-4 animate-pulse">Chargement...</div>
        ) : fileTree.length === 0 ? (
          <div className="text-center py-8 animate-fade-in-up">
            <FileText className="w-12 h-12 mx-auto mb-3 text-t-text/20" />
            <p className="text-t-text/40 text-sm">Aucun fichier</p>
          </div>
        ) : (
          fileTree.map((item) => renderTreeItem(item))
        )}
      </div>

      {/* Editor Panel */}
      {selectedFilePath && (
        <div className="border-t border-t-overlay/10 flex flex-col h-1/2 animate-fade-in-up">
          {/* Editor Header */}
          <div className="flex items-center justify-between px-4 py-2 glass-card border-b border-t-overlay/10">
            <span className="text-sm text-t-text/80 truncate">{selectedFilePath}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDeleteFile(selectedFilePath)}
                className="btn-outline-glow p-2 rounded-lg text-red-400 hover:text-red-300"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="btn-gradient px-3 py-2 rounded-lg text-sm flex items-center gap-1"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setFileContent('');
                }}
                className="btn-outline-glow p-2 rounded-lg"
              >
                <X className="w-4 h-4 text-t-text/70" />
              </button>
            </div>
          </div>

          {/* Editor */}
          <textarea
            value={fileContent}
            onChange={(e) => setFileContent(e.target.value)}
            className="flex-1 bg-black/30 text-t-text/90 p-4 font-mono text-sm resize-none focus:outline-none border-none"
            spellCheck={false}
          />
        </div>
      )}

      {/* New File Modal */}
      {showNewFileModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="glass-card rounded-xl shadow-2xl w-full max-w-md p-6 border border-t-overlay/10 animate-fade-in-scale">
            <h3 className="text-lg font-bold gradient-text mb-4">Nouveau Fichier</h3>
            <input
              type="text"
              value={newFilePath}
              onChange={(e) => setNewFilePath(e.target.value)}
              placeholder="src/App.tsx"
              className="w-full input-futuristic text-t-text px-4 py-3 rounded-lg mb-4"
            />
            <div className="flex gap-4">
              <button
                onClick={() => setShowNewFileModal(false)}
                className="flex-1 btn-outline-glow text-t-text font-medium py-2 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateFile}
                className="flex-1 btn-gradient text-white font-medium py-2 rounded-lg"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
