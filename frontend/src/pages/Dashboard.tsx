import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LogOut, Zap, Cloud } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { listProjects, createProject, Project, TechStack } from '../services/api';
import AuthModal from '../components/AuthModal';
import ProjectCard from '../components/ProjectCard';

export default function Dashboard() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchProjects();
    }
  }, [isAuthenticated, user]);

  const fetchProjects = async () => {
    try {
      const data = await listProjects();
      setProjects(data.projects);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    
    try {
      const project = await createProject(newProjectName, 'Created with AI App Builder');
      setProjects([project, ...projects]);
      setShowCreateModal(false);
      setNewProjectName('');
      navigate(`/builder/${project.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-8">
            <Zap className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-white mb-4">AI App Builder</h1>
            <p className="text-gray-400 text-xl">Sign in to access your projects</p>
          </div>
          <button
            onClick={() => setShowAuth(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg"
          >
            Sign In
          </button>
          <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Zap className="w-8 h-8 text-blue-500" />
            <h1 className="text-xl font-bold text-white">AI App Builder</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-white font-medium">{user?.email}</p>
              <p className="text-gray-400 text-sm capitalize">{user?.tier} Plan</p>
            </div>
            <button
              onClick={logout}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
            >
              <LogOut className="w-5 h-5 text-gray-300" />
            </button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="bg-gray-800 border-b border-gray-700 py-6">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-gray-700/50 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Projects</p>
              <p className="text-2xl font-bold text-white">
                {projects.length} <span className="text-gray-500 text-base">/ {user?.quotas.projectsMax}</span>
              </p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Storage Used</p>
              <p className="text-2xl font-bold text-white">
                {user ? Math.round(user.usage.storageUsed / 1024 / 1024) : 0} MB
              </p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Deployments</p>
              <p className="text-2xl font-bold text-white">
                {user?.usage.deploymentsThisMonth} <span className="text-gray-500 text-base">/ {user?.quotas.deploymentsPerMonth}</span>
              </p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Tier</p>
              <p className="text-2xl font-bold text-white capitalize">{user?.tier}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Projects */}
      <main className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white">Your Projects</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={projects.length >= (user?.quotas.projectsMax || 0)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
          >
            <Plus className="w-5 h-5" />
            New Project
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-400">Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12 bg-gray-800 rounded-lg">
            <Cloud className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">No projects yet</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
            >
              Create Your First Project
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => navigate(`/builder/${project.id}`)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Create New Project</h2>
            
            <div className="mb-6">
              <label className="block text-gray-300 mb-2">Project Name</label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="My Awesome App"
                className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
