import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { incrementReceptionNumber, fetchReceptionNumber } from './receptionNumber';
import './AdminChoice.css';

const AdminChoice = () => {
  const navigate = useNavigate();
  const [currentNumber, setCurrentNumber] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const getCurrentNumber = async () => {
      try {
        setIsLoading(true);
        const number = await fetchReceptionNumber();
        console.log('Received reception number:', number); // Debug log
        setCurrentNumber(number);
        setError(null);
      } catch (error) {
        console.error('Eroare la încărcarea numărului curent:', error);
        setError('Nu s-a putut încărca numărul de recepție');
      } finally {
        setIsLoading(false);
      }
    };

    getCurrentNumber();
  }, []);

  const handleIncrementNumber = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const newNumber = await incrementReceptionNumber();
      console.log('Incremented to new number:', newNumber); // Debug log
      setCurrentNumber(newNumber);
      alert(`Numărul de recepție a fost incrementat cu succes. Noul număr este: ${newNumber}`);
    } catch (error) {
      console.error('Eroare la incrementarea numărului:', error);
      setError('Nu s-a putut incrementa numărul de recepție');
      alert('A apărut o eroare la incrementarea numărului de recepție.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-choice">
      <h2>Alegeți o opțiune</h2>
      <div className="main-buttons">
        <button onClick={() => navigate('/admin/gestionare-clienti')}>
          Gestionare Clienți
        </button>
        <button onClick={() => navigate('/admin/gestionare-solutii')}>
          Gestionare Soluții
        </button>
        <button onClick={() => navigate('/admin/gestionare-angajati')}>
          Gestionare Angajați
        </button>
        <button onClick={() => navigate('/admin/gestionare-lucrari')}>
          Gestionare Lucrări
        </button>
        <button onClick={() => navigate('/admin/gestionare-suprafete')}>
          Gestionare Suprafete
        </button>
      </div>
      <div className="increment-button-container">
        {error && <div className="error-message">{error}</div>}
        <button 
          className="increment-button"
          onClick={handleIncrementNumber}
          disabled={isLoading}
        >
          {isLoading ? 'Se procesează...' : `Numar Receptie (${currentNumber ?? '...'})`}
        </button>
      </div>
    </div>
  );
};

export default AdminChoice;