import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { useEmployeeForm } from './EmployeeFormProvider';
import { fillTemplate } from './fillTemplate';
import { fetchReceptionNumber, incrementReceptionNumber } from './receptionNumber';
import './SummaryAndSignatureStep.css';
import { addVerbalProcess } from './verbalProcess';
import { updateRemainingQuantities } from './SolutionManagement';
import supabase from '../../supabaseClient';

const SummaryAndSignatureStep = () => {
  const { formData, updateFormData } = useEmployeeForm();
  const sigCanvas = useRef(null);
  const navigate = useNavigate();
  const [employeeSignature, setEmployeeSignature] = useState('');
  const [receptionNumber, setReceptionNumber] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [observations, setObservations] = useState('');
  const [isFinalizeDisabled, setIsFinalizeDisabled] = useState(false); // State to disable finalize button
  const [showPopup, setShowPopup] = useState(false);

  const [custodyItems, setCustodyItems] = useState({
    ultrasuneteRozatoare: 0,
    ultrasunetePasari: 0,
    antiinsecte: 0,
    capturareRozatoare: 0,
    statieIntoxicare: 0
  });

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

    setIsFinalizeDisabled(true); // Disable finalize button after it's clicked

    try {
      const finalData = {
        ...formData,
        employeeSignature,
        signatureDateTime: new Date().toLocaleString('ro-RO'),
        userLogin: 'Excusemymanners',
        receptionNumber,
        observations,
        clientSurface: formData.customer.surface, // Add client surface to final data
        custodyItems // Add custody items to final data
      };

        // persist finalData to the form context so it's stored
        try {
          updateFormData(finalData);
        } catch (e) {
          console.warn('Could not persist finalData to context:', e);
        }

  console.log('formData.operations BEFORE building verbalProcess:', formData.operations);
  console.log('formData.quantities BEFORE building verbalProcess:', formData.quantities);

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
        concentration1: formData.solutions[formData.operations[0]]?.map(sol => sol.concentration).join(', '), // Add concentration1
        procedure2: formData.operations[1] || null,
        product2_name: formData.operations[1] ? formData.solutions[formData.operations[1]]?.map(sol => sol.name).join(', ') : null,
        product2_lot: formData.operations[1] ? formData.solutions[formData.operations[1]]?.map(sol => sol.lot).join(', ') : null,
        product2_quantity: formData.operations[1] ? Number.parseFloat(formData.quantities[formData.operations[1]]) || 0 : null,
        concentration2: formData.operations[1] ? formData.solutions[formData.operations[1]]?.map(sol => sol.concentration).join(', ') : null, // Add concentration2
        procedure3: formData.operations[2] || null,
        product3_name: formData.operations[2] ? formData.solutions[formData.operations[2]]?.map(sol => sol.name).join(', ') : null,
        product3_lot: formData.operations[2] ? formData.solutions[formData.operations[2]]?.map(sol => sol.lot).join(', ') : null,
        product3_quantity: formData.operations[2] ? Number.parseFloat(formData.quantities[formData.operations[2]]) || 0 : null,
        concentration3: formData.operations[2] ? formData.solutions[formData.operations[2]]?.map(sol => sol.concentration).join(', ') : null, // Add concentration3
        procedure4: formData.operations[3] || null,
        product4_name: formData.operations[3] ? formData.solutions[formData.operations[2]]?.map(sol => sol.name).join(', ') : null,
        product4_lot: formData.operations[3] ? formData.solutions[formData.operations[2]]?.map(sol => sol.lot).join(', ') : null,
        product4_quantity: formData.operations[3] ? Number.parseFloat(formData.quantities[formData.operations[2]]) || 0 : null,
        concentration4: formData.operations[3] ? formData.solutions[formData.operations[3]]?.map(sol => sol.concentration).join(', ') : null // Add concentration4
      };
      console.log('Verbal process:', verbalProcess);
      await addVerbalProcess(verbalProcess);
      // Build pdf request payload (same as generateAndSendPDF uses)
      const pdfRequest = {
        receptionNumber: receptionNumber,
        client: {
          name: formData.customer.name,
          contract_number: formData.customer.contract_number,
          location: formData.customer.location,
          surface: formData.clientSurface
        },
        clientRepresentative: formData.clientRepresentative,
        clientSignature: formData.clientSignature,
        employeeName: formData.employeeName,
        employeeIDSeries: formData.employeeIDSeries,
        employeeSignature: formData.employeeSignature,
        operations: [],
        observations: formData.observations,
        custodyItems: formData.custodyItems
      };

      (formData.operations || []).forEach(operation => {
        const jobInfo = formData.customer.jobs.find(job => job.value === operation);
        const surface = jobInfo ? jobInfo.surface : null;

        pdfRequest.operations.push({
          name: operation,
          solution: formData.solutions[operation][0].label,
          solutionId: formData.solutions[operation][0].id,
          quantity: formData.quantities[operation],
          concentration: formData.solutions[operation][0].concentration,
          lot: formData.solutions[operation][0].lot,
          surface: surface
        });
      });

      // Generate PDF always; if simulateSend is true, skip sending the email but still generate PDF
      try {
        const pdfBytes = await fillTemplate('/assets/template.pdf', pdfRequest);
        try {
          const response = await fetch('/derat/api/send-email.js', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              pdfBytes,
              customerEmail: finalData.customer.email
            })
          });

          const responseData = await response.json();
          if (!responseData.success) {
            console.error('Email send failed:', responseData.error);
          } else {
            console.log('Email sent successfully');
          }
        } catch (err) {
          console.error('Error sending email:', err);
        }
      } catch (e) {
        console.error('Error generating PDF (continuing with DB updates):', e);
      }

      // increment reception number now that PDF was generated/sent (or skipped)
      await incrementReceptionNumber();
      // Prepare operations with extra context so we can record intrari_solutie (ieșiri)
      let opsToUpdate = [];

      // Primary source: formData.operations (selected in the flow)
      if (Array.isArray(formData.operations) && formData.operations.length > 0) {
        opsToUpdate = formData.operations.map(operation => {
          const sol = formData.solutions[operation] && formData.solutions[operation][0];
          return {
            solutionId: sol ? sol.id : null,
            quantity: Number.parseFloat(formData.quantities[operation]) || 0,
            beneficiar: formData.customer?.name || null,
            lot: sol ? sol.lot : null,
            created_at: new Date().toISOString()
          };
        }).filter(op => op.solutionId !== null && op.quantity > 0);
      }

      // Fallback: parse the verbalProcess product fields (product1..product4) if no ops were selected
      if (opsToUpdate.length === 0) {
        // build from verbalProcess fields we already prepared above
        const vp = verbalProcess;
        const fallback = [];
        for (let i = 1; i <= 4; i++) {
          const name = vp[`product${i}_name`];
          const qty = vp[`product${i}_quantity`];
          const lot = vp[`product${i}_lot`];
          if (name && qty && Number.parseFloat(qty) > 0) {
            fallback.push({ name, qty: Number.parseFloat(qty), lot });
          }
        }

        // Resolve solution IDs for each fallback item by querying DB (match by name and lot when possible)
        for (const item of fallback) {
          try {
            // Try exact match by name and lot first
            let query = supabase.from('solutions').select('id, remaining_quantity').ilike('name', item.name);
            if (item.lot) query = query.eq('lot', item.lot);
            const { data: sols, error: solsErr } = await query.limit(1).maybeSingle();
            if (solsErr) {
              console.error('Error finding solution for fallback exit:', solsErr);
              continue;
            }
            const solId = sols && sols.id ? sols.id : null;
            if (solId) {
              opsToUpdate.push({
                solutionId: solId,
                quantity: item.qty,
                beneficiar: formData.customer?.name || null,
                lot: item.lot || null,
                created_at: new Date().toISOString()
              });
            } else {
              console.warn('No matching solution found for exit fallback:', item.name, item.lot);
            }
          } catch (e) {
            console.error('Error resolving solution for fallback exit:', e);
          }
        }
      }

  console.log('opsToUpdate to send to updateRemainingQuantities:', opsToUpdate);
      if (opsToUpdate.length > 0) await updateRemainingQuantities(opsToUpdate);
      
      // Show the success popup
      setShowPopup(true);

      // Hide the popup after 3 seconds
      setTimeout(() => {
        setShowPopup(false);
        navigate('/employee/completed');
      }, 3000);
    } catch (error) {
      console.error('Error in handleFinish:', error);
      alert('A apărut o eroare la finalizarea procesului. Vă rugăm să încercați din nou.');
      setIsFinalizeDisabled(false); // Re-enable finalize button if there is an error
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

  

  const incrementItem = (item) => {
    setCustodyItems(prev => ({
      ...prev,
      [item]: prev[item] + 1
    }));
  };

  const decrementItem = (item) => {
    setCustodyItems(prev => ({
      ...prev,
      [item]: Math.max(prev[item] - 1, 0)
    }));
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
        surface: data.clientSurface // Include client surface in request
      },
      clientRepresentative: data.clientRepresentative,
      clientSignature: data.clientSignature,
      employeeName: data.employeeName,
      employeeIDSeries: data.employeeIDSeries,
      employeeSignature: data.employeeSignature,
      operations: [],
      observations: data.observations,
      custodyItems: data.custodyItems // Add custody items to PDF request
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

  let customerEmail = data.customer.email;

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
            <div className="detail-item">
              <span className="label">Suprafat client:</span>
              <span className="value">{formData.customer.surface}</span>
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
          <h4>Am predat în custodie:</h4>
          <div className="custody-items">
            <div className="custody-item">
              <span>dispozitive profesionale ultrasunete rozătoare</span>
              <button onClick={() => incrementItem('ultrasuneteRozatoare')}>+</button>
              <span>{custodyItems.ultrasuneteRozatoare}</span>
              <button onClick={() => decrementItem('ultrasuneteRozatoare')}>-</button>
            </div>
            <div className="custody-item">
              <span>dispozitive profesionale ultrasunete păsări</span>
              <button onClick={() => incrementItem('ultrasunetePasari')}>+</button>
              <span>{custodyItems.ultrasunetePasari}</span>
              <button onClick={() => decrementItem('ultrasunetePasari')}>-</button>
            </div>
            <div className="custody-item">
              <span>dispozitive profesionale antiinsecte</span>
              <button onClick={() => incrementItem('antiinsecte')}>+</button>
              <span>{custodyItems.antiinsecte}</span>
              <button onClick={() => decrementItem('antiinsecte')}>-</button>
            </div>
            <div className="custody-item">
              <span>dispozitiv mecanic capturare rozătoare</span>
              <button onClick={() => incrementItem('capturareRozatoare')}>+</button>
              <span>{custodyItems.capturareRozatoare}</span>
              <button onClick={() => decrementItem('capturareRozatoare')}>-</button>
            </div>
            <div className="custody-item">
              <span>stație de intoxicare exterior</span>
              <button onClick={() => incrementItem('statieIntoxicare')}>+</button>
              <span>{custodyItems.statieIntoxicare}</span>
              <button onClick={() => decrementItem('statieIntoxicare')}>-</button>
            </div>
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
            <div className="observations-container">
              <label htmlFor="observations">Observații:</label>
              <textarea
                id="observations"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows="4"
                cols="50"
                placeholder="Introduceți observațiile aici..."
              />
            </div>
          </div>
        </div>
      </div>

      <div className="navigation-buttons">
        <button onClick={handleBack}>Înapoi</button>
        <button
          onClick={handleFinish}
          disabled={!employeeSignature || !receptionNumber || isFinalizeDisabled} // Disable button if already clicked
        >
          Finalizează
        </button>
      </div>

      {/* Popup notification */}
      {showPopup && (
        <div className="popup-success">
          <p>Proces trimis!</p>
        </div>
      )}
    </div>
  );
};

export default SummaryAndSignatureStep;