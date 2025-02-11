import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { useEmployeeForm } from './EmployeeFormProvider'; // Importă hook-ul pentru context
import supabase from '../../supabaseClient'; // Importă clientul Supabase

const SelectOperationStep = () => {
  const { formData, updateFormData } = useEmployeeForm(); // Folosește contextul
  const [selectedOperations, setSelectedOperations] = useState(formData.operations || []);
  const [selectedSolutions, setSelectedSolutions] = useState(formData.solutions || {});
  const [solutions, setSolutions] = useState([]);
  const [quantities, setQuantities] = useState(formData.quantities || {});
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  const operations = [
    { value: 'Dezinfectare', label: 'Dezinsectare' },
    { value: 'Dezinsectare', label: 'Dezinsectare' },
    { value: 'Deratizare', label: 'Deratizare' },
  ];

  useEffect(() => {
    const fetchSolutions = async () => {
      const { data, error } = await supabase
        .from('solutions') // Înlocuiește 'solutions' cu numele tabelului tău
        .select('*');

      if (error) {
        setErrorMessage('Failed to fetch solutions from database');
        console.error(error);
      } else {
        setSolutions(data.map(solution => ({
          value: solution.id,
          label: solution.name,
          ...solution,
        })));
      }
    };

    fetchSolutions();
  }, []);

  const handleCheckboxChange = (operation) => {
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
      [operation]: selectedOption
    }));
    updateQuantities(operation, selectedOption);
  };

  const updateQuantities = (operation, selected) => {
    const surface = formData.customer?.surface || 0;
    let totalQuantity = 0;

    if (selected) {
      selected.forEach(solution => {
        totalQuantity += surface * solution.quantity_per_sqm;
      });
    }

    setQuantities(prevQuantities => ({
      ...prevQuantities,
      [operation]: totalQuantity
    }));
  };

  const handleNext = () => {
    const newFormData = { ...formData, operations: selectedOperations, solutions: selectedSolutions, quantities: quantities };
    updateFormData(newFormData);
    console.log('Navigating to client-representative with formData:', newFormData);
    navigate('/employee/step4'); // Navighează la următorul pas
  };

  const handleBack = () => {
    navigate('/employee/step2'); // Revine la SelectClientStep
  };

  return (
    <div className="select-operation-step">
      <h2>Selecteaza operatia si solutia</h2>
      <div className="operations-checkboxes">
        {operations.map(operation => (
          <div key={operation.value} className="checkbox-container">
            <input
              type="checkbox"
              id={`operation-${operation.value}`}
              name={`operation-${operation.value}`}
              value={operation.value}
              checked={selectedOperations.includes(operation.value)}
              onChange={() => handleCheckboxChange(operation.value)}
            />
            <label htmlFor={`operation-${operation.value}`}>{operation.label}</label>
          </div>
        ))}
      </div>

      {selectedOperations.map(operation => (
        <div key={operation} className="solution-select-container">
          <h3>{operation}</h3>
          <Select
            className="solution-select"
            options={solutions}
            isMulti
            value={selectedSolutions[operation] || []}
            onChange={(selectedOption) => handleSolutionChange(operation, selectedOption)}
            placeholder={`Select solutions for ${operation}...`}
          />
          <div className="quantity-display">
            <label>Cantitate necesara: </label>
            <span>{quantities[operation] || 0}</span>
            {selectedSolutions[operation] && selectedSolutions[operation].length > 0 && (
              <span> {selectedSolutions[operation][0].unit_of_measure}</span>
            )}
          </div>
        </div>
      ))}

      {errorMessage && (
        <div className="error-message">
          <p>{errorMessage}</p>
        </div>
      )}

      <div className="navigation-buttons">
        <button onClick={handleBack}>Back</button>
        <button onClick={handleNext} disabled={selectedOperations.length === 0}>Next</button>
      </div>
    </div>
  );
};

export default SelectOperationStep;