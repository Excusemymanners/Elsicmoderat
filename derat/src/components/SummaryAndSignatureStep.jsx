import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { useEmployeeForm } from './EmployeeFormProvider';
import { fillTemplate } from './fillTemplate';
import { fetchReceptionNumber, incrementReceptionNumber } from './receptionNumber';
import './SummaryAndSignatureStep.css';
import { addVerbalProcess } from './verbalProcess';
import { updateRemainingQuantities } from './SolutionManagement'; // Importăm funcția

const SummaryAndSignatureStep = () => {
  const { formData } = useEmployeeForm();
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
        signatureDateTime: new Date().toLocaleString('ro-RO'),
        userLogin: 'Excusemymanners',
        receptionNumber
      };

      await generateAndSendPDF(finalData);
      await incrementReceptionNumber();

      const verbalProcess = {
        numar_ordine: receptionNumber,
        client_name: formData.customer.name,
        client_contract: formData.customer.contract_number,
        client_location: formData.customer.location,
        employee_name: formData.employeeName,
        procedure1: formData.operations[0],
        product1_name: formData.solutions[formData.operations[0]]?.map(sol => sol.name).join(', '),
        product1_lot: formData.solutions[formData.operations[0]]?.map(sol => sol.lot).join(', '),
        product1_quantity: Number.parseFloat(formData.quantities[formData.operations[0]]) || 0,
        procedure2: formData.operations[1] || null,
        product2_name: formData.operations[1] ? formData.solutions[formData.operations[1]]?.map(sol => sol.name).join(', ') : null,
        product2_lot: formData.operations[1] ? formData.solutions[formData.operations[1]]?.map(sol => sol.lot).join(', ') : null,
        product2_quantity: formData.operations[1] ? Number.parseFloat(formData.quantities[formData.operations[1]]) || 0 : null,
        procedure3: formData.operations[2] || null,
        product3_name: formData.operations[2] ? formData.solutions[formData.operations[2]]?.map(sol => sol.name).join(', ') : null,
        product3_lot: formData.operations[2] ? formData.solutions[formData.operations[2]]?.map(sol => sol.lot).join(', ') : null,
        product3_quantity: formData.operations[2] ? Number.parseFloat(formData.quantities[formData.operations[2]]) || 0 : null,
        procedure4: formData.operations[3] || null,
        product4_name: formData.operations[3] ? formData.solutions[formData.operations[2]]?.map(sol => sol.name).join(', ') : null,
        product4_lot: formData.operations[3] ? formData.solutions[formData.operations[2]]?.map(sol => sol.lot).join(', ') : null,
        product4_quantity: formData.operations[3] ? Number.parseFloat(formData.quantities[formData.operations[2]]) || 0 : null
      };
      console.log('Verbal process:', verbalProcess);
      await addVerbalProcess(verbalProcess);
      await updateRemainingQuantities(formData.operations.map(operation => ({
        solutionId: formData.solutions[operation][0].id,
        quantity: Number.parseFloat(formData.quantities[operation]) || 0
      })));
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

  const generateAndSendPDF = async (data) => {
    const request = {
      receptionNumber: data.receptionNumber,
      client: {
        name: data.customer.name,
        contract_number: data.customer.contract_number,
        location: data.customer.location,
      },
      clientRepresentative: data.clientRepresentative,
      clientSignature: data.clientSignature,
      employeeName: data.employeeName,
      employeeIDSeries: data.employeeIDSeries,
      employeeSignature: data.employeeSignature,
      operations: []
    }
    
    data.operations.forEach(operation => {
      const jobInfo = data.customer.jobs.find(job => job.value === operation);
      const surface = jobInfo ? jobInfo.surface : null;
      
      request.operations.push({
        name: operation,
        solution: data.solutions[operation][0].label,
        solutionId: data.solutions[operation][0].id, // Include solution ID
        quantity: data.quantities[operation],
        concentration: data.solutions[operation][0].concentration,
        lot: data.solutions[operation][0].lot,
        surface: surface
      });
    })
    
    const pdfBytes = await fillTemplate('/assets/template.pdf', request);

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
      
      const responseData = await response.json();
      if (!responseData.success) {
        throw new Error(responseData.error);
      }
      
      console.log('Email sent successfully');
      return responseData;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
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
                    {Number.parseFloat(formData.quantities[operation]).toFixed(4)}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="label">Suprafață:</span>
                  <span className="value">
                    {formData.customer.jobs.find(job => job.value === operation)?.surface || '0'} mp
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
          let a=1;
          Finalizează
        </button>
      </div>
    </div>
  );
};

export default SummaryAndSignatureStep;