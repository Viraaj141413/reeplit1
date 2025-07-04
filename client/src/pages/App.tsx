
```tsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './landing';
import IDE from './ide';
import ProfessionalChatInterface from '../components/professional-chat-interface';
import NotFound from './not-found';
import { useAuth } from '../hooks/useAuth';
import AuthModal from '../components/auth-modal';

function App() {
  const { user, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    // Auto-open auth modal if not authenticated
    if (!loading && !user) {
      setShowAuthModal(true);
    }
  }, [loading, user]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Enhanced AI AppBuilder Pro...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/" 
            element={user ? <Navigate to="/pro" replace /> : <Landing />} 
          />
          <Route 
            path="/ide" 
            element={user ? <IDE /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/pro" 
            element={user ? <ProfessionalChatInterface /> : <Navigate to="/" replace />} 
          />
          <Route path="*" element={<NotFound />} />
        </Routes>

        {/* Auth Modal */}
        <AuthModal 
          isOpen={showAuthModal && !user} 
          onClose={() => setShowAuthModal(false)} 
        />
      </div>
    </Router>
  );
}

export default App;
```
