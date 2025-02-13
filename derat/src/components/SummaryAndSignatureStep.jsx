import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { useEmployeeForm } from './EmployeeFormProvider';
import { PDFDocument, rgb } from 'pdf-lib';
import { fetchReceptionNumber, incrementReceptionNumber } from './receptionNumber';
import './SummaryAndSignatureStep.css';

const SummaryAndSignatureStep = () => {
  const { formData, updateFormData } = useEmployeeForm();
  const sigCanvas = useRef(null);
  const navigate = useNavigate();
  const [employeeSignature, setEmployeeSignature] = useState('');
  const [receptionNumber, setReceptionNumber] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeData = async () => {
      try {
        if (!formData || !formData.customer) {
          navigate('/employee/step1');
          return;
        }
        const number = await fetchReceptionNumber();
        setReceptionNumber(number);
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing data:', error);
        setIsLoading(false);
      }
    };

    initializeData();
  }, [formData, navigate]);

  const handleFinish = async () => {
    if (!employeeSignature) {
      alert('Vă rugăm să adăugați semnătura.');
      return;
    }

    try {
      const finalData = {
        ...formData,
        employeeSignature,
        signatureDateTime: '2025-02-12 19:25:23',
        userLogin: 'Excusemymanners',
        receptionNumber
      };

      await generateAndSendPDF(finalData);
      await incrementReceptionNumber();
      navigate('/employee/completed');
    } catch (error) {
      console.error('Error in handleFinish:', error);
      alert('A apărut o eroare la finalizarea procesului. Vă rugăm să încercați din nou.');
    }
  };

  const handleBack = () => {
    navigate('/employee/step4');
  };

  const handleClear = () => {
    sigCanvas.current.clear();
    setEmployeeSignature('');
  };

  const handleSignatureEnd = () => {
    setEmployeeSignature(sigCanvas.current.toDataURL());
  };

  if (isLoading) {
    return <div className="loading">Se încarcă...</div>;
  }

    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    const { width, height } = firstPage.getSize();

    firstPage.drawText(`Name: ${data.employeeName}`, {
      x: 20,
      y: height - 50,
      size: 12,
      color: rgb(0, 0, 0),
    });
    firstPage.drawText(`ID Series: ${data.employeeIDSeries}`, {
      x: 20,
      y: height - 70,
      size: 12,
      color: rgb(0, 0, 0),
    });
    firstPage.drawText(`ID Number: ${data.employeeIDNumber}`, {
      x: 20,
      y: height - 90,
      size: 12,
      color: rgb(0, 0, 0),
    });

    firstPage.drawText(`Client Name: ${data.customer.name}`, {
      x: 20,
      y: height - 110,
      size: 12,
      color: rgb(0, 0, 0),
    });
    firstPage.drawText(`Email: ${data.customer.email}`, {
      x: 20,
      y: height - 130,
      size: 12,
      color: rgb(0, 0, 0),
    });
    firstPage.drawText(`Phone: ${data.customer.phone}`, {
      x: 20,
      y: height - 150,
      size: 12,
      color: rgb(0, 0, 0),
    });
    firstPage.drawText(`Contract Number: ${data.customer.contract_number}`, {
      x: 20,
      y: height - 170,
      size: 12,
      color: rgb(0, 0, 0),
    });
    firstPage.drawText(`Location: ${data.customer.location}`, {
      x: 20,
      y: height - 190,
      size: 12,
      color: rgb(0, 0, 0),
    });
    firstPage.drawText(`Surface: ${data.customer.surface}`, {
      x: 20,
      y: height - 210,
      size: 12,
      color: rgb(0, 0, 0),
    });

    let yOffset = height - 230;
    data.operations.forEach((operation, index) => {
      firstPage.drawText(`Operation: ${operation}`, {
        x: 20,
        y: yOffset,
        size: 12,
        color: rgb(0, 0, 0),
      });
      yOffset -= 20;
      firstPage.drawText(`Solutions: ${data.solutions[operation]?.map(sol => sol.label).join(', ')}`, {
        x: 20,
        y: yOffset,
        size: 12,
        color: rgb(0, 0, 0),
      });
      yOffset -= 20;
      firstPage.drawText(`Quantity: ${data.quantities[operation]}`, {
        x: 20,
        y: yOffset,
        size: 12,
        color: rgb(0, 0, 0),
      });
      yOffset -= 20;
    });

    firstPage.drawText(`Representative Name: ${data.clientRepresentative}`, {
      x: 20,
      y: yOffset,
      size: 12,
      color: rgb(0, 0, 0),
    });
    yOffset -= 40;

    const clientSigImage = await pdfDoc.embedPng(data.clientSignature);
    firstPage.drawImage(clientSigImage, {
      x: 20,
      y: yOffset,
      width: 100,
      height: 50,
    });
    yOffset -= 60;

    firstPage.drawText('Employee Signature:', {
      x: 20,
      y: yOffset,
      size: 12,
      color: rgb(0, 0, 0),
    });
    yOffset -= 40;

    const empSigImage = await pdfDoc.embedPng(data.employeeSignature);
    firstPage.drawImage(empSigImage, {
      x: 20,
      y: yOffset,
      width: 100,
      height: 50,
    });

    const pdfBytes = await pdfDoc.save();

    let customerEmail = formData.customer.email;

    try {
      const response = await fetch('/derat/api/send-email.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdfBytes,
          customerEmail
        })
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
      console.log('Email sent successfully');
      return data;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }

    // const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    // const link = document.createElement('a');
    // link.href = URL.createObjectURL(blob);
    // link.download = "dog.pdf";
    // document.body.appendChild(link);
    // link.click();
    // document.body.removeChild(link);
  };

  return (
    <div className="summary-step">
      <h3>Pasul 5: Sumarul Procesului Verbal</h3>
      <div className="form-content">
        <div className="summary-section">
          <h4>Informații Generale</h4>
          <div className="details-grid">
            
            <div className="detail-item">
              <span className="label">Număr Recepție:</span>
              <span className="value">{receptionNumber || 'Se încarcă...'}</span>
            </div>
          </div>
        </div>

        <div className="summary-section">
          <h4>Detalii Angajat</h4>
          <div className="details-grid">
            <div className="detail-item">
              <span className="label">Nume:</span>
              <span className="value">{formData.employeeName}</span>
            </div>
            <div className="detail-item">
              <span className="label">Serie CI:</span>
              <span className="value">{formData.employeeIDSeries}</span>
            </div>
          </div>
        </div>

        <div className="summary-section">
          <h4>Detalii Client</h4>
          <div className="details-grid">
            <div className="detail-item">
              <span className="label">Nume:</span>
              <span className="value">{formData.customer.name}</span>
            </div>
            <div className="detail-item">
              <span className="label">Email:</span>
              <span className="value">{formData.customer.email}</span>
            </div>
            <div className="detail-item">
              <span className="label">Telefon:</span>
              <span className="value">{formData.customer.phone}</span>
            </div>
            <div className="detail-item">
              <span className="label">Nr. Contract:</span>
              <span className="value">{formData.customer.contract_number}</span>
            </div>
            <div className="detail-item">
              <span className="label">Locație:</span>
              <span className="value">{formData.customer.location}</span>
            </div>
            <div className="detail-item">
              <span className="label">Suprafață:</span>
              <span className="value">{formData.customer.surface} mp</span>
            </div>
          </div>
        </div>

        <div className="summary-section">
          <h4>Operațiuni Efectuate</h4>
          <div className="operations-list">
            {formData.operations?.map((operation, index) => (
              <div key={index} className="operation-summary">
                <div className="detail-item">
                  <span className="label">Operațiune:</span>
                  <span className="value">{operation}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Soluții:</span>
                  <span className="value">
                    {formData.solutions[operation]?.map(sol => sol.label).join(', ')}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="label">Cantitate:</span>
                  <span className="value">
                    {formData.quantities[operation]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="summary-section">
          <h4>Semnături</h4>
          <div className="signatures-container">
            <div className="signature-box client-signature">
              <span className="signature-label">Semnătură Client:</span>
              <div className="signature-display">
                <img 
                  src={formData.clientSignature} 
                  alt="Semnătură Client" 
                  className="signature-image"
                />
                <span className="signature-name">
                  {formData.clientRepresentative}
                </span>
              </div>
            </div>

            <div className="signature-box employee-signature">
              <span className="signature-label">Semnătura Dvs:</span>
              <div className="signature-pad-container">
                <SignatureCanvas 
                  ref={sigCanvas} 
                  onEnd={handleSignatureEnd}
                  canvasProps={{
                    className: 'signature-canvas',
                    width: window.innerWidth < 768 ? 300 : 500,
                    height: window.innerWidth < 768 ? 150 : 200,
                    style: {
                      cursor: 'crosshair',
                      touchAction: 'none',
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px'
                    }
                  }}
                />
                <button className="clear-button" onClick={handleClear}>
                  Șterge semnătura
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="navigation-buttons">
        <button onClick={handleBack}>Înapoi</button>
        <button 
          onClick={handleFinish}
          disabled={!employeeSignature || !receptionNumber}
        >
          Finalizează
        </button>
      </div>
    </div>
  );
};

export default SummaryAndSignatureStep;