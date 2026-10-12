import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { useTheme } from './context/useTheme';
import Chat from './pages/Chat';
import Login from './pages/Login';
import Register from './pages/Register';

export default function App() {
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (loading) {
    return (
      <div className="splash">
        <div className="spinner" aria-label="Loading" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
      <Route
        path="/"
        element={
          user ? (
            <ChatProvider>
              <Chat theme={theme} onToggleTheme={toggleTheme} />
            </ChatProvider>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
