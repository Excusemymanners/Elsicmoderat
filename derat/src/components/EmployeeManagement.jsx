import React, { useState, useEffect } from 'react';
import supabase from '../../supabaseClient'; // Asigură-te că calea este corectă
import './EmployeeManagement.css'; // Asigură-te că fișierul CSS există în calea corectă

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [newEmployee, setNewEmployee] = useState({ name: '', id_series_number: '' });
  const [editingEmployee, setEditingEmployee] = useState(null); // Stare pentru angajatul în curs de editare
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(true);
  const [loading, setLoading] = useState(false);

  // Funcție pentru a încărca angajații din baza de date
  const fetchEmployees = async () => {
    setLoading(true);
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

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setLoading(true);
    let result;
    if (editingEmployee) {
      // Actualizare angajat existent
      result = await supabase
        .from('employees')
        .update(newEmployee)
        .eq('id', editingEmployee);
    } else {
      // Adăugare angajat nou
      result = await supabase
        .from('employees')
        .insert([newEmployee]);
    }

    const { error } = result;
    if (error) {
      console.error('Error adding/updating employee:', error);
    } else {
      setNewEmployee({ name: '', id_series_number: '' });
      setEditingEmployee(null);
      await fetchEmployees(); // Reîmprospătează lista de angajați după adăugare/actualizare
    }
    setLoading(false);
  };

  const handleDeleteEmployee = async (id) => {
    setLoading(true);
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting employee:', error);
    } else {
      await fetchEmployees(); // Reîmprospătează lista de angajați după ștergere
    }
    setLoading(false);
  };

  const handleEditEmployee = (employee) => {
    setNewEmployee(employee);
    setEditingEmployee(employee.id);
    setShowForm(true);
  };

  const handleToggleForm = () => {
    setShowForm(!showForm);
  };

  const filteredEmployees = employees.filter(employee =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.id_series_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="employee-management">
      <h2>Gestionare Angajați</h2>

      <div className="action-buttons">
        <button onClick={handleToggleForm} disabled={loading}>
          {showForm ? 'Caută Angajați' : 'Adaugă Angajat'}
        </button>
      </div>

      {showForm ? (
        <form onSubmit={handleAddEmployee} className="employee-form">
          <input
            type="text"
            placeholder="Nume"
            value={newEmployee.name}
            onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Seria și numărul de buletin"
            value={newEmployee.id_series_number}
            onChange={(e) => setNewEmployee({ ...newEmployee, id_series_number: e.target.value })}
            required
          />
          <button type="submit" disabled={loading}>
            {editingEmployee !== null ? 'Actualizează Angajat' : 'Adaugă Angajat'}
          </button>
        </form>
      ) : (
        <div className="search-container">
          <input
            type="text"
            placeholder="Caută angajat..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      <div className="employees-list">
        {loading ? (
          <p>Se încarcă...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nume</th>
                
                <th>Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map(employee => (
                <tr key={employee.id}>
                  <td>{employee.name}</td>
                  <td>{employee.id_series_number}</td>
                  <td>
                    <button onClick={() => handleEditEmployee(employee)}>
                      Editează
                    </button>
                    <button onClick={() => handleDeleteEmployee(employee.id)}>
                      Șterge
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default EmployeeManagement;