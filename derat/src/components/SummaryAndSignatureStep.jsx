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
  // local state for client representative + signature (moved here from ClientRepresentativeStep)
  const [clientRepresentativeLocal, setClientRepresentativeLocal] = useState(formData.clientRepresentative || '');
  const clientSigCanvas = useRef(null);
  const [clientSignatureLocal, setClientSignatureLocal] = useState(formData.clientSignature || '');


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
    // require client signature/representative and employee signature before finishing
    if (!clientRepresentativeLocal && !formData.clientRepresentative) {
      alert('Vă rugăm să introduceți numele reprezentantului client.');
      return;
    }

    if (!clientSignatureLocal && !formData.clientSignature) {
      alert('Vă rugăm să adăugați semnătura clientului.');
      return;
    }

    if (!employeeSignature) {
      alert('Vă rugăm să adăugați semnătura angajatului.');
      return;
    }

    setIsFinalizeDisabled(true); // Disable finalize button after it's clicked

    try {
  const clientSignatureData = clientSignatureLocal || (clientSigCanvas.current ? clientSigCanvas.current.toDataURL() : formData.clientSignature || '');

      const finalData = {
        ...formData,
        // persist both client and employee signature + representative from this step
        clientRepresentative: clientRepresentativeLocal || formData.clientRepresentative || '',
        clientSignature: clientSignatureData || formData.clientSignature || '',
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

  console.log('finalData.operations BEFORE building verbalProcess:', finalData.operations);
  console.log('finalData.quantities BEFORE building verbalProcess:', finalData.quantities);

  const verbalProcess = {
        numar_ordine: receptionNumber,
        client_name: finalData.customer.name,
        client_contract: finalData.customer.contract_number,
        client_location: finalData.customer.location,
        employee_name: finalData.employeeName,
        procedure1: finalData.operations[0],
        product1_name: finalData.solutions[finalData.operations[0]]?.map(sol => sol.name).join(', '),
        product1_lot: finalData.solutions[finalData.operations[0]]?.map(sol => sol.lot).join(', '),
        product1_quantity: Number.parseFloat(finalData.quantities[finalData.operations[0]]) || 0,
        concentration1: finalData.solutions[finalData.operations[0]]?.map(sol => sol.concentration).join(', '), // Add concentration1
        procedure2: finalData.operations[1] || null,
        product2_name: finalData.operations[1] ? finalData.solutions[finalData.operations[1]]?.map(sol => sol.name).join(', ') : null,
        product2_lot: finalData.operations[1] ? finalData.solutions[finalData.operations[1]]?.map(sol => sol.lot).join(', ') : null,
        product2_quantity: finalData.operations[1] ? Number.parseFloat(finalData.quantities[finalData.operations[1]]) || 0 : null,
        concentration2: finalData.operations[1] ? finalData.solutions[finalData.operations[1]]?.map(sol => sol.concentration).join(', ') : null, // Add concentration2
        procedure3: finalData.operations[2] || null,
        product3_name: finalData.operations[2] ? finalData.solutions[finalData.operations[2]]?.map(sol => sol.name).join(', ') : null,
        product3_lot: finalData.operations[2] ? finalData.solutions[finalData.operations[2]]?.map(sol => sol.lot).join(', ') : null,
        product3_quantity: finalData.operations[2] ? Number.parseFloat(finalData.quantities[finalData.operations[2]]) || 0 : null,
        concentration3: finalData.operations[2] ? finalData.solutions[finalData.operations[2]]?.map(sol => sol.concentration).join(', ') : null, // Add concentration3
        procedure4: finalData.operations[3] || null,
        product4_name: finalData.operations[3] ? finalData.solutions[finalData.operations[2]]?.map(sol => sol.name).join(', ') : null,
        product4_lot: finalData.operations[3] ? finalData.solutions[finalData.operations[2]]?.map(sol => sol.lot).join(', ') : null,
        product4_quantity: finalData.operations[3] ? Number.parseFloat(finalData.quantities[finalData.operations[2]]) || 0 : null,
        concentration4: finalData.operations[3] ? finalData.solutions[finalData.operations[3]]?.map(sol => sol.concentration).join(', ') : null // Add concentration4
      };
      console.log('Verbal process:', verbalProcess);
      await addVerbalProcess(verbalProcess);
      // Build pdf request payload (same as generateAndSendPDF uses)
      const pdfRequest = {
        receptionNumber: receptionNumber,
        client: {
          name: finalData.customer.name,
          contract_number: finalData.customer.contract_number,
          location: finalData.customer.location,
          surface: finalData.clientSurface
        },
        clientRepresentative: finalData.clientRepresentative,
        clientSignature: finalData.clientSignature,
        employeeName: finalData.employeeName,
        employeeIDSeries: finalData.employeeIDSeries,
        employeeSignature: finalData.employeeSignature,
        operations: [],
        observations: finalData.observations,
        custodyItems: finalData.custodyItems || custodyItems
      };

  (finalData.operations || []).forEach(operation => {
        const jobInfo = finalData.customer.jobs.find(job => job.value === operation);
        const surface = jobInfo ? jobInfo.surface : null;

        pdfRequest.operations.push({
          name: operation,
          solution: finalData.solutions[operation][0].label,
          solutionId: finalData.solutions[operation][0].id,
          quantity: finalData.quantities[operation],
          concentration: finalData.solutions[operation][0].concentration,
          lot: finalData.solutions[operation][0].lot,
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
  console.log('receptionNumber (state):', receptionNumber, 'finalData.receptionNumber:', finalData.receptionNumber);
      let opsToUpdate = [];

      // Primary source: finalData.operations (selected in the flow)
      if (Array.isArray(finalData.operations) && finalData.operations.length > 0) {
          opsToUpdate = finalData.operations.map(operation => {
          const sol = finalData.solutions[operation] && finalData.solutions[operation][0];
          const rawQty = finalData.quantities ? finalData.quantities[operation] : undefined;
          const parsed = Number.parseFloat(rawQty);
          const qtyVal = Number.isFinite(parsed) ? parsed : 0;
          const solId = sol ? (sol.id ?? sol.value ?? null) : null;
          return {
            solutionId: solId,
            quantity: qtyVal,
            beneficiar: finalData.customer?.name || null,
            lot: sol ? (sol.lot || null) : null,
            // prefer the live receptionNumber state, fallback to finalData.receptionNumber
            numar_ordine: receptionNumber || finalData.receptionNumber || null,
            created_at: new Date().toISOString()
          };
        }).filter(op => op.solutionId !== null && op.solutionId !== undefined);
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
          if (name) {
            const parsed = Number.parseFloat(qty);
            const qtyVal = Number.isFinite(parsed) ? parsed : 0;
            fallback.push({ name, qty: qtyVal, lot });
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
                beneficiar: finalData.customer?.name || null,
                lot: item.lot || null,
                numar_ordine: receptionNumber || finalData.receptionNumber || null,
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

      // If still no opsToUpdate, try to derive from finalData.solutions (keys may exist even if finalData.operations is empty)
      if (opsToUpdate.length === 0 && finalData.solutions && Object.keys(finalData.solutions).length > 0) {
        for (const key of Object.keys(finalData.solutions)) {
          const arr = finalData.solutions[key];
          if (Array.isArray(arr) && arr.length > 0) {
            const sol = arr[0];
            // try quantity from finalData.quantities, else compute from customer job surface * quantity_per_sqm
            let qty = 0;
            if (finalData.quantities && finalData.quantities[key] !== undefined) {
              const p = Number.parseFloat(finalData.quantities[key]);
              qty = Number.isFinite(p) ? p : 0;
            } else {
              const job = finalData.customer?.jobs?.find(j => j.value === key);
              const surface = job ? job.surface : 0;
              const qps = sol.quantity_per_sqm || 0;
              const computed = Number.parseFloat(surface || 0) * Number.parseFloat(qps || 0);
              qty = Number.isFinite(computed) ? computed : 0;
            }

            opsToUpdate.push({
              solutionId: sol.id,
              quantity: qty,
              beneficiar: finalData.customer?.name || null,
              lot: sol.lot || null,
              numar_ordine: receptionNumber || finalData.receptionNumber || null,
              created_at: new Date().toISOString()
            });
          }
        }
      }

  console.log('opsToUpdate to send to updateRemainingQuantities:', opsToUpdate);
      if (opsToUpdate.length > 0) await updateRemainingQuantities(opsToUpdate);
      
      // persist clientRepresentative and clientSignature into the shared form context
      try {
        updateFormData({
          clientRepresentative: finalData.clientRepresentative,
          clientSignature: finalData.clientSignature
        });
      } catch (e) {
        console.warn('Could not persist client signature to context:', e);
      }

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
    // step4 was removed; go back to operations selection
    navigate('/employee/step3');
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
            <h4>Reprezentant Client și Semnătură</h4>
            <div className="details-grid">
              <div className="detail-item">
                <label className="label">Nume reprezentant:</label>
                <input
                  type="text"
                  value={clientRepresentativeLocal}
                  onChange={(e) => setClientRepresentativeLocal(e.target.value)}
                  placeholder="Introduceți numele reprezentantului"
                />
              </div>
              <div className="detail-item signature-box client-signature-inline">
                <span className="signature-label">Semnătură Client:</span>
                <div className="signature-pad-container">
                  <SignatureCanvas
                    ref={clientSigCanvas}
                    onEnd={() => setClientSignatureLocal(clientSigCanvas.current.toDataURL())}
                    canvasProps={{
                      className: 'signature-canvas',
                      width: window.innerWidth < 768 ? 300 : 400,
                      height: window.innerWidth < 768 ? 100 : 150,
                      style: { cursor: 'crosshair', touchAction: 'none', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }
                    }}
                  />
                  <button className="clear-button" onClick={() => { clientSigCanvas.current.clear(); setClientSignatureLocal(''); }}>Șterge semnătura</button>
                </div>
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
            {/* Client signature display intentionally removed from here per UX request.
                Client signature is still captured earlier in the form (Reprezentant Client și Semnătură)
                and persisted, but we don't show the image above the employee signature. */}


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