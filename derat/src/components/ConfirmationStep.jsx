import React from 'react';
import { useNavigate } from 'react-router-dom';
import './ConfirmationStep.css'; // Asigură-te că ai creat acest fișier CSS pentru stiluri personalizate

const ConfirmationStep = () => {
  const navigate = useNavigate();

  const handleHome = () => {
    navigate('/employee/step1'); // Navighează înapoi la primul pas
  };

  return (
    <div className="confirmation-step">
      <h2>Email Sent Successfully</h2>
      <p>Your email has been sent successfully to the client and 1285849adm@gmail.com.</p>
      <button onClick={handleHome}>Go Home</button>
    </div>
  );
};

export default ConfirmationStep;