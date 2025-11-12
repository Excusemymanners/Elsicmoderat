import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { useEmployeeForm } from './EmployeeFormProvider';
import supabase from '../../supabaseClient';
import './SelectOperationStep.css';

const SelectOperationStep = () => {
    const { formData, updateFormData } = useEmployeeForm();
    const [selectedOperations, setSelectedOperations] = useState(formData.operations || []);
    const [selectedSolutions, setSelectedSolutions] = useState(formData.solutions || {});
    const [solutions, setSolutions] = useState([]);
    const [quantities, setQuantities] = useState(formData.quantities || {});
    const [errorMessage, setErrorMessage] = useState('');
    const [customerJobs, setCustomerJobs] = useState([]);
    const [stockErrors, setStockErrors] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetchSolutions();
        fetchCustomerData();
    }, []);

    const fetchSolutions = async () => {
        const { data, error } = await supabase
            .from('solutions')
            .select('*');
        
        if (error) {
            setErrorMessage('Failed to fetch solutions from database');
            console.error(error);
        } else {
            // Filtrează doar soluțiile active și cu stoc disponibil peste rezerva minimă
            const activeSolutions = data
                .filter(solution => {
                    const isActive = solution.is_active !== false; // Default true dacă nu există câmpul
                    const remainingQuantity = solution.remaining_quantity || solution.total_quantity || 0;
                    const minimumReserve = solution.minimum_reserve || 0;
                    const hasAvailableStock = remainingQuantity > minimumReserve;
                    
                    return isActive && hasAvailableStock;
                })
                .map(solution => {
                    const remainingQuantity = solution.remaining_quantity || solution.total_quantity || 0;
                    const minimumReserve = solution.minimum_reserve || 0;
                    const availableQuantity = remainingQuantity - minimumReserve;
                    
                    return {
                        value: solution.id,
                        label: `${solution.name} (Disponibil: ${availableQuantity.toFixed(2)} ${solution.unit_of_measure || 'ml'})`,
                        quantity_per_sqm: solution.quantity_per_sqm,
                        unit_of_measure: solution.unit_of_measure,
                        stock: solution.stock,
                        total_quantity: solution.total_quantity,
                        remaining_quantity: remainingQuantity,
                        minimum_reserve: minimumReserve,
                        available_quantity: availableQuantity,
                        ...solution,
                    };
                });
            
            setSolutions(activeSolutions);
            
            // Dacă nu există soluții active, afișează un mesaj
            if (activeSolutions.length === 0) {
                setErrorMessage('Nu există soluții active disponibile. Vă rugăm să contactați administratorul.');
            }
        }
    };

    const fetchCustomerData = async () => {
        const customerId = formData.customer?.id;
        if (customerId) {
            const { data, error } = await supabase
                .from('customers')
                .select('jobs')
                .eq('id', customerId)
                .single();

            if (error) {
                setErrorMessage('Failed to fetch customer data');
                console.error(error);
            } else {
                setCustomerJobs(data.jobs || []);
                updateFormData({ customer: { ...formData.customer, jobs: data.jobs } });
            }
        }
    };

    const handleOperationSelect = (operation) => {
        setSelectedOperations(prevSelectedOperations => {
            if (prevSelectedOperations.includes(operation)) {
                const updatedSelectedOperations = prevSelectedOperations.filter(op => op !== operation);
                setSelectedSolutions(prevSelectedSolutions => {
                    const { [operation]: _, ...rest } = prevSelectedSolutions;
                    return rest;
                });
                setQuantities(prevQuantities => {
                    const { [operation]: _, ...rest } = prevQuantities;
                    return rest;
                });
                return updatedSelectedOperations;
            } else {
                return [...prevSelectedOperations, operation];
            }
        });
    };

    const handleSolutionChange = (operation, selectedOption) => {
        setSelectedSolutions(prevSelectedSolutions => ({
            ...prevSelectedSolutions,
            [operation]: selectedOption ? [selectedOption] : []
        }));
        updateQuantities(operation, selectedOption ? [selectedOption] : []);
    };

    const updateQuantities = (operation, selected) => {
        const job = customerJobs.find(job => job.value === operation && job.active);
        const surface = job ? job.surface : 0;
        let totalQuantity = 0;

        if (selected && Array.isArray(selected) && selected.length > 0) {
            const solution = selected[0];
            if (solution && solution.quantity_per_sqm) {
                totalQuantity = surface * solution.quantity_per_sqm;
            }
        }

        setQuantities(prevQuantities => ({
            ...prevQuantities,
            [operation]: totalQuantity
        }));
    };

    const updateSolutionStock = async () => {
        try {
            for (const operation of selectedOperations) {
                const operationSolutions = selectedSolutions[operation] || [];
                
                if (operationSolutions.length > 0) {
                    const solution = operationSolutions[0];
                    const job = customerJobs.find(job => job.value === operation && job.active);
                    const quantityUsed = job ? job.surface * solution.quantity_per_sqm : 0;
                    
                    const remainingQuantity = solution.remaining_quantity || solution.total_quantity || 0;
                    const minimumReserve = solution.minimum_reserve || 0;
                    const availableQuantity = remainingQuantity - minimumReserve;
                    
                    // Verifică dacă există suficient stoc disponibil (peste rezerva minimă)
                    if (availableQuantity < quantityUsed) {
                        throw new Error(
                            `Stoc insuficient pentru "${solution.name}". ` +
                            `Necesită ${quantityUsed.toFixed(2)} ${solution.unit_of_measure}, ` +
                            `dar sunt disponibile doar ${availableQuantity.toFixed(2)} ${solution.unit_of_measure}. ` +
                            `(Rezerva minimă de ${minimumReserve.toFixed(2)} ${solution.unit_of_measure} trebuie păstrată)`
                        );
                    }

                    const newRemainingQuantity = remainingQuantity - quantityUsed;
                    const newTotalQuantity = solution.total_quantity - quantityUsed;
                    
                    // Verifică dacă noua cantitate rămasă va atinge rezerva minimă
                    const shouldDeactivate = newRemainingQuantity <= minimumReserve;
                    
                    const updateData = {
                        total_quantity: newTotalQuantity,
                        remaining_quantity: newRemainingQuantity
                    };
                    
                    // Dacă atinge rezerva minimă, dezactivează automat
                    if (shouldDeactivate) {
                        updateData.is_active = false;
                    }

                    const { error } = await supabase
                        .from('solutions')
                        .update(updateData)
                        .eq('id', solution.value);

                    if (error) {
                        throw new Error(`Eroare la actualizarea stocului pentru "${solution.name}": ${error.message}`);
                    }
                    
                    // Notifică utilizatorul dacă soluția a fost dezactivată
                    if (shouldDeactivate) {
                        console.warn(`⚠️ Soluția "${solution.name}" a fost dezactivată automat deoarece a atins rezerva minimă!`);
                        alert(
                            `⚠️ ATENȚIE: Soluția "${solution.name}" a atins rezerva minimă ` +
                            `(${minimumReserve.toFixed(2)} ${solution.unit_of_measure}) ` +
                            `și a fost dezactivată automat!`
                        );
                    }
                }
            }
            
            return true;
        } catch (error) {
            console.error('Error updating stock:', error);
            setErrorMessage(error.message);
            return false;
        }
    };

    const handleNext = async () => {
        try {
            const stockUpdateSuccess = await updateSolutionStock();
            
            if (!stockUpdateSuccess) {
                return;
            }

            const newFormData = {
                ...formData,
                operations: selectedOperations,
                solutions: selectedSolutions,
                quantities: quantities,
                updateDateTime: new Date().toISOString(),
                userLogin: 'Excusemymanners'
            };
            
            updateFormData(newFormData);
            // Skip the separate client representative step and go directly to the summary
            navigate('/employee/step5');
        } catch (error) {
            console.error('Error in handleNext:', error);
            setErrorMessage('A apărut o eroare la salvarea datelor. Vă rugăm să încercați din nou.');
        }
    };

    const handleBack = () => {
        navigate('/employee/step2');
    };

    useEffect(() => {
        const errors = [];
        for (const operation of selectedOperations) {
            const operationSolutions = selectedSolutions[operation] || [];
            
            if (operationSolutions.length > 0) {
                const solution = operationSolutions[0];
                const job = customerJobs.find(job => job.value === operation && job.active);
                const quantityUsed = job ? job.surface * solution.quantity_per_sqm : 0;
                
                const remainingQuantity = solution.remaining_quantity || solution.total_quantity || 0;
                const minimumReserve = solution.minimum_reserve || 0;
                const availableQuantity = remainingQuantity - minimumReserve;
                
                // Verifică dacă cantitatea necesară depășește cantitatea disponibilă (peste rezerva minimă)
                if (availableQuantity < quantityUsed) {
                    errors.push(
                        `⚠️ Stoc insuficient pentru "${solution.name}": ` +
                        `Necesită ${quantityUsed.toFixed(2)} ${solution.unit_of_measure}, ` +
                        `dar sunt disponibile doar ${availableQuantity.toFixed(2)} ${solution.unit_of_measure} ` +
                        `(Rezervă minimă: ${minimumReserve.toFixed(2)} ${solution.unit_of_measure})`
                    );
                }
                
                // Avertisment dacă folosirea ar lăsa foarte puțin stoc disponibil
                const remainingAfterUse = availableQuantity - quantityUsed;
                if (remainingAfterUse > 0 && remainingAfterUse < availableQuantity * 0.2) {
                    errors.push(
                        `⚡ Atenție: După utilizare, "${solution.name}" va avea doar ${remainingAfterUse.toFixed(2)} ${solution.unit_of_measure} disponibili.`
                    );
                }
            }
        }
        setStockErrors(errors);
    }, [selectedOperations, selectedSolutions, customerJobs]);

    return (
        <div className="select-operation-step">
            <h2>Selectează operația și soluția</h2>
            
            <div className="operations-list">
                {customerJobs.map(job => (
                    <div key={job.value} className="operation-item">
                        <button
                            className={`operation-button ${selectedOperations.includes(job.value) ? 'selected' : ''}`}
                            onClick={() => handleOperationSelect(job.value)}
                            disabled={!job.active}
                        >
                            {job.label}
                        </button>
                        
                        {selectedOperations.includes(job.value) && job.active && (
                            <div className="solution-select-wrapper">
                                <Select
                                    className="solution-select"
                                    options={solutions}
                                    isMulti={false}
                                    value={selectedSolutions[job.value]?.[0] || null}
                                    onChange={(selectedOption) => handleSolutionChange(job.value, selectedOption)}
                                    placeholder={
                                        solutions.length === 0 
                                            ? "Nu există soluții active disponibile" 
                                            : `Selectează o soluție pentru ${job.label}...`
                                    }
                                    isDisabled={solutions.length === 0}
                                    noOptionsMessage={() => "Nu există soluții disponibile"}
                                />
                                <div className="quantity-display">
                                    <label>Cantitate necesară: </label>
                                    <span className="quantity-value">{quantities[job.value]?.toFixed(2) || 0}</span>
                                    {selectedSolutions[job.value] && selectedSolutions[job.value].length > 0 && (
                                        <span> {selectedSolutions[job.value][0].unit_of_measure}</span>
                                    )}
                                </div>
                                {selectedSolutions[job.value] && selectedSolutions[job.value].length > 0 && (
                                    <div className="stock-info">
                                        <div className="stock-detail">
                                            <span className="stock-label">Stoc disponibil:</span>
                                            <span className="stock-value">{selectedSolutions[job.value][0].available_quantity?.toFixed(2) || 0} {selectedSolutions[job.value][0].unit_of_measure}</span>
                                        </div>
                                        <div className="stock-detail">
                                            <span className="stock-label">Rezervă minimă:</span>
                                            <span className="stock-value reserve">{selectedSolutions[job.value][0].minimum_reserve?.toFixed(2) || 0} {selectedSolutions[job.value][0].unit_of_measure}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {errorMessage && (
                <div className="error-message">
                    <p>{errorMessage}</p>
                </div>
            )}

            {stockErrors.length > 0 && (
                <div className="stock-errors">
                    {stockErrors.map((error, index) => (
                        <p key={index}>{error}</p>
                    ))}
                </div>
            )}

            <div className="navigation-buttons">
                <button onClick={handleBack}>Back</button>
                <button 
                    onClick={handleNext} 
                    disabled={selectedOperations.length === 0 || stockErrors.length > 0}
                >
                    Next
                </button>
            </div>
        </div>
    );
};

export default SelectOperationStep;