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

  const handleNext = () => {
    if (representative.trim() === '') {
      alert('Please enter the client representative name.');
      return;
    }

    const clientSignature = sigCanvas.current.toDataURL();

    updateFormData({ clientRepresentative: representative, clientSignature });
    navigate('/employee/step5');
  };

  const handleBack = () => {
    navigate('/employee/step3');
  };

  const handleClear = () => {
    sigCanvas.current.clear();
  };

  return (
    <div className="client-representative-step">
      <h2>Client Representative</h2>
      <label htmlFor="representative-name">Representative Name:</label>
      <input
        type="text"
        id="representative-name"
        name="representative-name"
        value={representative}
        onChange={(e) => setRepresentative(e.target.value)}
        placeholder="Enter client representative name"
      />
      <div className="signature">
        <h3>Client Signature</h3>
        <div className="sigCanvas-container">
          <SignatureCanvas 
            ref={sigCanvas} 
            canvasProps={{ className: 'sigCanvas' }} 
          />
        </div>
        <button className="clear-signature-button" onClick={handleClear}>Clear Signature</button>
      </div>
      <div className="navigation-buttons">
        <button onClick={handleBack}>Back</button>
        <button onClick={handleNext}>Next</button>
      </div>
    </div>
  );
};

export default ClientRepresentativeStep;