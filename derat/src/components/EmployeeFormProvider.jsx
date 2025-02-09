import React, { createContext, useContext, useState } from 'react';

// Creează contextul
const EmployeeFormContext = createContext();

// Hook pentru folosirea contextului
export const useEmployeeForm = () => {
  return useContext(EmployeeFormContext);
};

// Furnizorul de context
export const EmployeeFormProvider = ({ children }) => {
  const [formData, setFormData] = useState({
    customer: null,
    clientRepresentative: '',
    operations: [],
    solutions: [], // Modificat pentru a fi un array
    quantities: {},
  });

  // Funcție pentru actualizarea datelor formularului
  const updateFormData = (newData) => {
    setFormData((prevData) => ({
      ...prevData,
      ...newData,
    }));
  };

  return (
    <EmployeeFormContext.Provider value={{ formData, updateFormData }}>
      {children}
    </EmployeeFormContext.Provider>
  );
};

export default EmployeeFormProvider;