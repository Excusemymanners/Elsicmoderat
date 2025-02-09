import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployeeForm } from './EmployeeFormProvider';
import supabase from '../../supabaseClient'; // Asigură-te că calea este corectă
import './EmployeeNameStep.css'; // Asigură-te că ai un fișier CSS pentru stilizare

const EmployeeNameStep = () => {
  const { formData, updateFormData } = useEmployeeForm();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(formData.id || null);

  // Funcție pentru a obține lista de angajați din baza de date
  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('*');

    if (error) {
      console.error('Error fetching employees:', error);
    } else {
      setEmployees(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleEmployeeSelect = (employee) => {
    setSelectedEmployeeId(employee.id);
    updateFormData({
      ...formData,
      employeeName: employee.name,
      employeeIDSeries: employee.id_series, // Adaugă seria buletinului
      employeeIDNumber: employee.id_number // Adaugă numărul buletinului
    });
    setSearchTerm(employee.name); // Setează numele angajatului selectat în câmpul de căutare
  };

  const handleNext = () => {
    navigate('/employee/step2');
  };

  const handleBack = () => {
    navigate('/employee');
  };

  const filteredEmployees = employees.filter(employee =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <h3>Step 1: Select or Search Employee</h3>
      <input
        type="text"
        placeholder="Search employee..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <div className="employees-list">
        {employees.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(employee => (
                <tr key={employee.id}>
                  <td>{employee.name}</td>
                  <td>
                    <button 
                      onClick={() => handleEmployeeSelect(employee)}
                      className={selectedEmployeeId === employee.id ? 'selected-button' : ''}
                    >
                      {selectedEmployeeId === employee.id ? 'Selected' : 'Select'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No employees found.</p>
        )}
      </div>
      <div className="navigation-buttons">
        <button onClick={handleBack}>Back</button>
        <button onClick={handleNext} disabled={!selectedEmployeeId}>Next</button>
      </div>
    </div>
  );
};

export default EmployeeNameStep;