import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Dashboard from './pages/Dashboard';
import Timeline from './pages/Timeline';
import Assets from './pages/Assets';
import Liabilities from './pages/Liabilities';
import Login from './pages/Login';
import Register from './pages/Register';
import Settings from './pages/Settings';
import Layout from './components/Layout';
import './styles/global.css';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading NeTempo…</div>;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return !user ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route
            path="/"
            element={<PrivateRoute><Layout /></PrivateRoute>}
          >
            <Route index element={<Dashboard />} />
            <Route path="timeline" element={<Timeline />} />
            <Route path="assets" element={<Assets />} />
            <Route path="liabilities" element={<Liabilities />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
