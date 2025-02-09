import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployeeForm } from './EmployeeFormProvider';
import supabase from '../../supabaseClient';
import './CustomerManagement.css'; // Asigură-te că acest fișier CSS există

const SelectClientStep = () => {
  const { formData, updateFormData } = useEmployeeForm();
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(formData.customer || {});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Funcția pentru a prelua lista de clienți din baza de date
  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customers') 
      .select('*');
    if (error) {
      console.error('Error fetching customers:', error);
    } else {
      setCustomers(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Funcția pentru a naviga la pasul următor și a actualiza datele formularului
  const handleNext = () => {
    updateFormData({ customer: selectedCustomer });
    navigate('/employee/step3'); // Navighează la pasul ClientRepresentativeStep
  };

  // Funcția pentru a naviga înapoi la pasul anterior
  const handleBack = () => {
    navigate('/employee/step1');
  };

  // Filtrarea clienților pe baza termenului de căutare
  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="customer-management">
      <h2>Select Customer</h2>
      <div className="search-container">
        <input
          type="text"
          placeholder="Caută client..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="customers-list">
        {loading ? (
          <p>Se încarcă...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nume</th>
                <th>Email</th>
                <th>Telefon</th>
                <th>Punct de lucru</th>
                <th>Suprafață</th>
                <th>Selectează</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map(customer => (
                <tr key={customer.id}>
                  <td>{customer.name}</td>
                  <td>{customer.email}</td>
                  <td>{customer.phone}</td>
                  <td>{customer.location}</td>
                  <td>{customer.surface}</td>
                  <td>
                    <input
                      type="radio"
                      name="selectedCustomer"
                      value={customer.id}
                      checked={selectedCustomer.id === customer.id}
                      onChange={() => setSelectedCustomer(customer)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="navigation-buttons">
        <button onClick={handleBack}>Back</button>
        <button onClick={handleNext} disabled={!selectedCustomer.id}>Next</button>
      </div>
    </div>
  );
};

export default SelectClientStep;