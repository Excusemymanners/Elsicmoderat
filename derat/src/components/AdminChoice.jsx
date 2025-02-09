import React from 'react';
import { useNavigate } from 'react-router-dom';

const AdminChoice = () => {
  const navigate = useNavigate();

  return (
    <div className="admin-choice">
      <h2>Alegeți o opțiune</h2>
      <button onClick={() => navigate('/admin/gestionare-clienti')}>Gestionare Clienți</button>
      <button onClick={() => navigate('/admin/gestionare-solutii')}>Gestionare Soluții</button>
      <button onClick={() => navigate('/admin/gestionare-angajati')}>Gestionare Angajați</button> {/* Adaugă butonul */}
    </div>
  );
};

export default AdminChoice;