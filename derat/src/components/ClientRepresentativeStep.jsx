import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { useEmployeeForm } from './EmployeeFormProvider';
import './ClientRepresentativeStep.css';

const ClientRepresentativeStep = () => {
  const { formData, updateFormData } = useEmployeeForm();
  const [representative, setRepresentative] = useState(formData.clientRepresentative || '');
  const sigCanvas = useRef(null);
  const navigate = useNavigate();

  const handleNext = async () => {
    if (representative.trim() === '') {
      alert('Vă rugăm să introduceți numele reprezentantului.');
      return;
    }

    try {
      let clientSignature = '';
      if (sigCanvas.current && typeof sigCanvas.current.toDataURL === 'function' && !sigCanvas.current.isEmpty()) {
        clientSignature = sigCanvas.current.toDataURL();
      }

      const newFormData = {
        ...formData,
        clientRepresentative: representative,
        clientSignature: clientSignature,
        signatureDateTime: new Date().toISOString(),
        userLogin: 'Excusemymanners'
      };
      
      await updateFormData(newFormData);
      navigate('/employee/step5');
    } catch (error) {
      console.error('Error in handleNext:', error);
      alert('A apărut o eroare la salvarea datelor. Vă rugăm să încercați din nou.');
    }
  };

  const handleBack = () => {
    let clientSignature = '';
    if (sigCanvas.current && typeof sigCanvas.current.toDataURL === 'function' && !sigCanvas.current.isEmpty()) {
      clientSignature = sigCanvas.current.toDataURL();
    }

    const newFormData = {
      ...formData,
      clientRepresentative: representative,
      clientSignature: clientSignature,
      signatureDateTime: new Date().toISOString(),
      userLogin: 'Excusemymanners'
    };

    updateFormData(newFormData);
    navigate('/employee/step3');
  };

  const handleClear = () => {
    sigCanvas.current.clear();
  };

  return (
    <div className="client-representative-step">
      <h3>Pasul 4: Reprezentant Client și Semnătură</h3>
      <div className="form-content">
        <div className="input-container">
          <input
            type="text"
            value={representative}
            onChange={(e) => setRepresentative(e.target.value)}
            placeholder="Introduceți numele reprezentantului"
            required
          />
        </div>
        
        <div className="signature-container">
          <div className="signature-box">
            <SignatureCanvas 
              ref={sigCanvas} 
              canvasProps={{
                className: 'signature-canvas',
                width: window.innerWidth < 768 ? 300 : 500,
                height: window.innerWidth < 768 ? 150 : 200,
                style: {
                  cursor: 'crosshair',
                  touchAction: 'none'
                }
              }}
              penColor={'#000000'}
              velocityFilterWeight={0.7}
            />
          </div>
          <button className="clear-button" onClick={handleClear}>
            Șterge semnătura
          </button>
        </div>
      </div>

      <div className="navigation-buttons">
        <button onClick={handleBack}>Back</button>
        <button 
          onClick={handleNext} 
          disabled={!representative.trim()}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default ClientRepresentativeStep;