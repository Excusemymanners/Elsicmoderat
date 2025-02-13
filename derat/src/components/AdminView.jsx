import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
        if (password === 'admin123') {
            setIsAuthenticated(true);
            setIsAdmin(true);
            localStorage.setItem('adminAuth', 'true');
            navigate('/admin/choose', { replace: true });
        } else {
            setError('Parolă incorectă');
        }
    };

    return (
        <div className="admin-view">
            <div className="admin-container">
                <form onSubmit={handleLogin} className="auth-form">
                    <h2>Autentificare Admin</h2>
                    <div className="form-group">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Introduceți parola"
                            className="auth-input"
                        />
                    </div>
                    {error && <div className="error-message">{error}</div>}
                    <button type="submit" className="auth-button">
                        Autentificare
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AdminView;