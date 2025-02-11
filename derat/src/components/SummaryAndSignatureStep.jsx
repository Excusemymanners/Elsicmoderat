import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { useEmployeeForm } from './EmployeeFormProvider';
import { fillTemplate } from './fillTemplate';
import { sendEmail } from './sendEmail';
import { fetchReceptionNumber, incrementReceptionNumber } from './receptionNumber';
import './SummaryAndSignatureStep.css';

const SummaryAndSignatureStep = () => {
  const { formData } = useEmployeeForm();
  const navigate = useNavigate();
  const sigCanvas = useRef(null);
  const [receptionNumber, setReceptionNumber] = useState(null);
  const [employeeSignature, setEmployeeSignature] = useState(null);

  useEffect(() => {
    const loadReceptionNumber = async () => {
      const number = await fetchReceptionNumber();
      setReceptionNumber(number);
    };
    loadReceptionNumber();
  }, []);

  useEffect(() => {
    console.log('formData:', formData);
  }, [formData]);

  const handleSend = async () => {
    try {
      const signature = sigCanvas.current.toDataURL();
      setEmployeeSignature(signature);

      const now = new Date();
      const date = now.toLocaleDateString();
      const time = now.toLocaleTimeString();

      const updatedFormData = {
        ...formData,
        employeeSignature: signature,
        receptionNumber,
        date,
        time,
      };

      const templateUrl = '/assets/template.pdf';
      const pdfBytes = await fillTemplate(templateUrl, updatedFormData);

      console.log('PDF Base64 Length:', pdfBytes.length);

      const clientEmail = formData.customer.email;
      await sendEmail(pdfBytes, clientEmail);

      await incrementReceptionNumber();

      navigate('/employee/confirmation');
    } catch (error) {
      console.error('Eroare la completarea template-ului:', error);
    }
  };

  const handleBack = () => {
    navigate('/employee/step5');
  };

  const handleClear = () => {
    sigCanvas.current.clear();
    setEmployeeSignature(null);
  };

  if (!formData.customer) {
    return (
      <div className="summary-signature-step">
        <h2>Eroare: Datele clientului lipsesc</h2>
        <button onClick={handleBack}>Înapoi</button>
      </div>
    );
  }

  const isSendDisabled =
    !receptionNumber ||
    !formData.customer ||
    Object.keys(formData.solutions).length === 0 ||
    formData.operations.length === 0 ||
    !employeeSignature;

  return (
    <div className="summary-signature-step">
      <h2>Sumar și Semnătură</h2>
      <div className="summary">
        <p>
          <strong>Client:</strong> {formData.customer.name}
        </p>
        <p>
          <strong>Suprafață:</strong> {formData.customer.surface} mp
        </p>
        <div>
          <strong>Soluții:</strong>
          <ul>
            {Object.entries(formData.solutions).map(([operation, solutions]) =>
              solutions.map((solution, index) => (
                <li key={`${operation}-${solution.value}`}>{solution.label}</li>
              ))
            )}
          </ul>
        </div>
        <div>
          <strong>Operațiuni:</strong>
          <ul>
            {Array.isArray(formData.operations) &&
              formData.operations.map((operation, index) => (
                <li key={index}>{operation}</li>
              ))}
          </ul>
        </div>
        <p>
          <strong>Email:</strong> {formData.customer.email}
        </p>
        <p>
          <strong>Număr Recepție:</strong> {receptionNumber}
        </p>
        <p>
          <strong>Reprezentant Client:</strong> {formData.clientRepresentative}
        </p>
        <p>
          <strong>Data:</strong> {new Date().toLocaleDateString()}
        </p>
        <p>
          <strong>Ora:</strong> {new Date().toLocaleTimeString()}
        </p>
      </div>
      <div className="signature">
        <h3>Semnătura Angajatului</h3>
        <div className="sigCanvas-container">
          <SignatureCanvas
            ref={sigCanvas}
            canvasProps={{ className: 'sigCanvas' }}
            onEnd={() => setEmployeeSignature(sigCanvas.current.toDataURL())}
          />
        </div>
        <button className="clear-signature-button" onClick={handleClear}>Șterge Semnătura</button>
      </div>
      <div className="navigation-buttons">
        <button onClick={handleBack}>Înapoi</button>
        <button onClick={handleSend} disabled={isSendDisabled}>
          Trimite
        </button>
      </div>
    </div>
  );
};

export default SummaryAndSignatureStep;