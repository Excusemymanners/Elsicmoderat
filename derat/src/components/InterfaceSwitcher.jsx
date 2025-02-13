import React, { useEffect } from 'react';
import { Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import AdminView from './AdminView';
import EmployeeView from './EmployeeView';
import CustomerManagement from './CustomerManagement';
import SolutionManagement from './SolutionManagement';
import EmployeeManagement from './EmployeeManagement';
import GestionareLucrari from './GestionareLucrari';
import AdminChoice from './AdminChoice';
import Header from './Header';
import { AuthProvider, useAuth } from './AuthContext';
import './InterfaceSwitcher.css';

const InterfaceSwitcher = () => {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
};

const AppRoutes = () => {
  const { isAuthenticated, isAdmin, setIsAdmin, handleLogout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated && window.location.pathname.startsWith('/admin')) {
      navigate('/admin');
    }
  }, [isAuthenticated, navigate]);

  const handleToggle = () => {
    setIsAdmin(prev => {
      const newIsAdmin = !prev;
      localStorage.setItem('isAdmin', newIsAdmin);
      if (newIsAdmin) {
        navigate('/admin');
      } else {
        navigate('/employee');
      }
      return newIsAdmin;
    });
  };

  return (
    <div className="container">
      <Header
        isAuthenticated={isAuthenticated}
        isAdmin={isAdmin}
        handleLogout={handleLogout}
        handleToggle={handleToggle}
      />
      <div className="content">
        <Routes>
          <Route path="/" element={<Navigate to={isAdmin ? "/admin/choose" : "/employee"} />} />
          <Route path="/employee/*" element={<EmployeeView />} />
          <Route path="/admin" element={isAuthenticated ? <Navigate to="/admin/choose" /> : <AdminView />} />
          <Route path="/admin/choose" element={isAuthenticated ? <AdminChoice /> : <Navigate to="/admin" />} />
          <Route path="/admin/gestionare-clienti" element={isAuthenticated ? <CustomerManagement /> : <Navigate to="/admin" />} />
          <Route path="/admin/gestionare-solutii" element={isAuthenticated ? <SolutionManagement /> : <Navigate to="/admin" />} />
          <Route path="/admin/gestionare-angajati" element={isAuthenticated ? <EmployeeManagement /> : <Navigate to="/admin" />} />
          <Route path="/admin/gestionare-lucrari" element={isAuthenticated ? <GestionareLucrari /> : <Navigate to="/admin" />} />
        </Routes>
      </div>
    </div>
  );
};

export default InterfaceSwitcher;