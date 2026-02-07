import { useState, useEffect } from 'react';
import { Code, Save, X, FileText, Folder, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { listFiles, getFile, saveFile, deleteFile } from '../services/api';
import { useBuilderStore } from '../store/builderStore';

interface FileEditorProps {
  projectId: string;
}

interface FileTreeItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeItem[];
}

export default function FileEditor({ projectId }: FileEditorProps) {
  const { setSelectedFile } = useBuilderStore();
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
  }, [projectId]);

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

  const renderTreeItem = (item: FileTreeItem, depth: number = 0) => {
    const isExpanded = expandedDirs.has(item.path);
    const hasChildren = item.type === 'directory' && item.children && item.children.length > 0;

    return (
      <div key={item.path}>
        <div
          className={`flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-gray-700 ${
            selectedFilePath === item.path ? 'bg-blue-600' : ''
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
            <ChevronDown className={`w-4 h-4 ${!isExpanded ? 'transform rotate-180' : ''}`} />
          )}
          {!hasChildren && <span className="w-4" />}
          {item.type === 'directory' ? (
            <Folder className="w-4 h-4 text-yellow-500" />
          ) : (
            <FileText className="w-4 h-4 text-blue-400" />
          )}
          <span className="text-sm text-gray-300 truncate">{item.name}</span>
        </div>
        {item.type === 'directory' && isExpanded && item.children && (
          <div>
            {item.children.map((child) => renderTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Code className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-white">Fichiers</span>
        </div>
        <button
          onClick={() => setShowNewFileModal(true)}
          className="p-1 bg-gray-700 hover:bg-gray-600 rounded"
          title="Nouveau fichier"
        >
          <Plus className="w-4 h-4 text-gray-300" />
        </button>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-auto py-2">
        {isLoading ? (
          <div className="text-gray-400 text-sm px-4">Chargement...</div>
        ) : fileTree.length === 0 ? (
          <div className="text-gray-400 text-sm px-4">Aucun fichier</div>
        ) : (
          fileTree.map((item) => renderTreeItem(item))
        )}
      </div>

      {/* Editor Panel */}
      {selectedFilePath && (
        <div className="border-t border-gray-700 flex flex-col h-1/2">
          {/* Editor Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700">
            <span className="text-sm text-gray-300">{selectedFilePath}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDeleteFile(selectedFilePath)}
                className="p-1 bg-red-600 hover:bg-red-700 rounded"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setFileContent('');
                }}
                className="p-1 bg-gray-700 hover:bg-gray-600 rounded"
              >
                <X className="w-4 h-4 text-gray-300" />
              </button>
            </div>
          </div>

          {/* Editor */}
          <textarea
            value={fileContent}
            onChange={(e) => setFileContent(e.target.value)}
            className="flex-1 bg-gray-900 text-gray-100 p-4 font-mono text-sm resize-none focus:outline-none"
            spellCheck={false}
          />
        </div>
      )}

      {/* New File Modal */}
      {showNewFileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-white mb-4">Nouveau Fichier</h3>
            <input
              type="text"
              value={newFilePath}
              onChange={(e) => setNewFilePath(e.target.value)}
              placeholder="src/App.tsx"
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex gap-4">
              <button
                onClick={() => setShowNewFileModal(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateFile}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg"
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
