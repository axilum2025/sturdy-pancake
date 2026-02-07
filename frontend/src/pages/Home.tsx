import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import AuthModal from '../components/AuthModal';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const [showAuth, setShowAuth] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <Sparkles className="w-16 h-16 text-blue-600" />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            AI App Builder
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Construisez des applications complètes avec l'IA - inspiré par Lovable
          </p>
          <button
            onClick={() => setShowAuth(true)}
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-colors"
          >
            Commencer à construire
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">
              🤖 Agent Intelligent
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Utilise le Copilot SDK pour planifier et exécuter des tâches complexes
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">
              👁️ Aperçu en Direct
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Visualisez vos applications en temps réel pendant leur construction
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">
              🚀 Déploiement Azure
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Déployez automatiquement sur Azure avec CI/CD intégré
            </p>
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={() => navigate('/dashboard')}
      />
    </div>
  );
}
