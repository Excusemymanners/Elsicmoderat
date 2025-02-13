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
  const navigate = useNavigate();

  const operations = [
    { value: 'Dezinfectare', label: 'Dezinsectie' },
    { value: 'Dezinsectare', label: 'Dezinsectie' },
    { value: 'Deratizare', label: 'Dezinfectie' },
  ];

  useEffect(() => {
    fetchSolutions();
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
        remaining_quantity: solution.remaining_quantity,
        ...solution,
      })));
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
    console.log('Selected solutions for', operation, ':', selectedOption);
    setSelectedSolutions(prevSelectedSolutions => ({
      ...prevSelectedSolutions,
      [operation]: selectedOption
    }));
    updateQuantities(operation, selectedOption);
  };

  const updateQuantities = (operation, selected) => {
    const surface = formData.customer?.surface || 0;
    console.log('Surface:', surface);
    let totalQuantity = 0;

    if (selected && Array.isArray(selected)) {
      selected.forEach(solution => {
        if (solution && solution.quantity_per_sqm) {
          const quantityForSolution = surface * solution.quantity_per_sqm;
          console.log(`Calculating for ${solution.label}:`, quantityForSolution);
          totalQuantity += quantityForSolution;
        }
      });
    }

    console.log(`Total quantity for ${operation}:`, totalQuantity);

    setQuantities(prevQuantities => ({
      ...prevQuantities,
      [operation]: totalQuantity
    }));
  };

  const updateSolutionStock = async () => {
    try {
      // Iterăm prin toate operațiunile selectate
      for (const operation of selectedOperations) {
        const operationSolutions = selectedSolutions[operation] || [];
        
        // Iterăm prin toate soluțiile selectate pentru operațiunea curentă
        for (const solution of operationSolutions) {
          const quantityUsed = formData.customer.surface * solution.quantity_per_sqm;
          
          // Verificăm dacă există suficient stoc
          if (solution.stock < quantityUsed) {
            throw new Error(`Stoc insuficient pentru soluția ${solution.label}`);
          }

          // Actualizăm stocul în baza de date
          const { error } = await supabase
            .from('solutions')
            .update({ 
              stock: solution.stock - quantityUsed,
              remaining_quantity: solution.remaining_quantity - quantityUsed,
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
      // Verificăm și actualizăm stocul
      const stockUpdateSuccess = await updateSolutionStock();
      
      if (!stockUpdateSuccess) {
        return; // Oprim procesul dacă actualizarea stocului a eșuat
      }

      // Actualizăm datele formularului și navigăm la următorul pas
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

  return (
    <div className="select-operation-step">
      <h2>Selectează operația și soluția</h2>
      
      <div className="operations-list">
        {operations.map(operation => (
          <div key={operation.value} className="operation-item">
            <button
              className={`operation-button ${selectedOperations.includes(operation.value) ? 'selected' : ''}`}
              onClick={() => handleOperationSelect(operation.value)}
            >
              {operation.label}
            </button>
            
            {selectedOperations.includes(operation.value) && (
              <div className="solution-select-wrapper">
                <Select
                  className="solution-select"
                  options={solutions}
                  isMulti
                  value={selectedSolutions[operation.value] || []}
                  onChange={(selectedOption) => handleSolutionChange(operation.value, selectedOption)}
                  placeholder={`Selectează soluții pentru ${operation.label}...`}
                />
                <div className="quantity-display">
                  <label>Cantitate necesară: </label>
                  <span>{quantities[operation.value]?.toFixed(2) || 0}</span>
                  {selectedSolutions[operation.value] && selectedSolutions[operation.value].length > 0 && (
                    <span> {selectedSolutions[operation.value][0].unit_of_measure}</span>
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

      <div className="navigation-buttons">
        <button onClick={handleBack}>Back</button>
        <button 
          onClick={handleNext} 
          disabled={selectedOperations.length === 0}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default SelectOperationStep;