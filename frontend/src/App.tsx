import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Studio from './pages/Studio';
import Home from './pages/Home';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Documentation from './pages/Documentation';
import Dashboard from './pages/Dashboard';
import AgentStore from './pages/AgentStore';
import AgentStorePage from './pages/AgentStorePage';
import AgentChat from './pages/AgentChat';
import Analytics from './pages/Analytics';
import Billing from './pages/Billing';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/docs" element={<Documentation />} />
            {/* Agent Store — public, no auth required */}
            <Route path="/store" element={<AgentStore />} />
            <Route path="/store/:agentId" element={<AgentStorePage />} />
            <Route path="/store/:agentId/chat" element={<AgentChat />} />
            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/studio/:projectId?" element={<Studio />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
