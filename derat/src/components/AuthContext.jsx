import React, { createContext, useState, useContext } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return localStorage.getItem('adminAuth') === 'true';
    });
    const [isAdmin, setIsAdmin] = useState(() => {
        return localStorage.getItem('isAdmin') === 'true';
    });

    const handleLogout = (navigate) => {
        setIsAuthenticated(false);
        localStorage.removeItem('adminAuth');
        navigate('/employee', { replace: true }); // Navigare către pagina "employee"
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, setIsAuthenticated, isAdmin, setIsAdmin, handleLogout }}>
            {children}
        </AuthContext.Provider>
    );
};