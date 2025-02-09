import React, { useState } from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import { useAuth } from './AuthContext';
import AdminChoice from './AdminChoice';
import './AdminView.css';

const AdminView = () => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { setIsAuthenticated, setIsAdmin } = useAuth();

    const handleLogin = (e) => {
        e.preventDefault();
        if (password === 'admin123') { // Înlocuiește cu parola ta reală
            setIsAuthenticated(true);
            setIsAdmin(true);
            localStorage.setItem('adminAuth', 'true'); // Salvează starea în localStorage
            navigate('/admin/choose', { replace: true }); // Navighează imediat după autentificare
        } else {
            setError('Parolă incorectă');
        }
    };

    return (
        <div className="admin-view">
            <form onSubmit={handleLogin}>
                <h2>Autentificare Admin</h2>
                <div>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Introduceți parola"
                    />
                </div>
                {error && <div className="error">{error}</div>}
                <button type="submit">Autentificare</button>
            </form>
        </div>
    );
};

export default AdminView;