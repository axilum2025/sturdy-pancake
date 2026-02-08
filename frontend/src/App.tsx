import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Builder from './pages/Builder';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import AgentStore from './pages/AgentStore';
import AgentStorePage from './pages/AgentStorePage';
import AgentChat from './pages/AgentChat';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            {/* Agent Store — public, no auth required */}
            <Route path="/store" element={<AgentStore />} />
            <Route path="/store/:agentId" element={<AgentStorePage />} />
            <Route path="/store/:agentId/chat" element={<AgentChat />} />
            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/builder/:projectId?" element={<Builder />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
