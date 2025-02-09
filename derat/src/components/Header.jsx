import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Header.css';

const Header = ({ isAuthenticated, isAdmin, handleLogout, handleToggle }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // Extindem condiția pentru a include și ruta /admin/gestionare-angajati
    const showBackButton = [
        '/admin/gestionare-clienti',
        '/admin/gestionare-solutii',
        '/admin/gestionare-angajati'
    ].includes(location.pathname);

    const onLogout = () => {
        handleLogout(navigate); // Transmite navigate ca parametru
    };

    return (
        <header className="header">
            <div className="header-content">
                <h1>ElsiCom</h1>
                <div className="header-buttons">
                    {isAuthenticated && (
                        <>
                            {showBackButton && (
                                <button onClick={() => navigate('/admin/choose')}>Back</button>
                            )}
                            <button onClick={onLogout}>Logout</button>
                        </>
                    )}
                    {!isAuthenticated && (
                        <label className="switch">
                            <input 
                                type="checkbox" 
                                checked={isAdmin} 
                                onChange={handleToggle}
                            />
                            <span className="slider"></span>
                        </label>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;