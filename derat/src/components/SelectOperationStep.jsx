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
            setSolutions(data.map(solution => ({
                value: solution.id,
                label: solution.name,
                quantity_per_sqm: solution.quantity_per_sqm,
                unit_of_measure: solution.unit_of_measure,
                stock: solution.stock,
                total_quantity: solution.total_quantity,
                ...solution,
            })));
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
                    
                    if (solution.total_quantity < quantityUsed) {
                        throw new Error(`Stoc insuficient pentru soluția ${solution.label}. Cantitatea totală ar deveni negativă.`);
                    }

                    const { error } = await supabase
                        .from('solutions')
                        .update({ 
                            total_quantity: solution.total_quantity - quantityUsed
                        })
                        .eq('id', solution.value);

                    if (error) {
                        throw new Error(`Eroare la actualizarea stocului pentru ${solution.label}: ${error.message}`);
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
            navigate('/employee/step4');
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
                
                if (solution.total_quantity < quantityUsed) {
                    errors.push(`Stoc insuficient pentru soluția ${solution.label}.`);
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
                                    placeholder={`Selectează o soluție pentru ${job.label}...`}
                                />
                                <div className="quantity-display">
                                    <label>Cantitate necesară: </label>
                                    <span>{quantities[job.value]?.toFixed(2) || 0}</span>
                                    {selectedSolutions[job.value] && selectedSolutions[job.value].length > 0 && (
                                        <span> {selectedSolutions[job.value][0].unit_of_measure}</span>
                                    )}
                                </div>
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