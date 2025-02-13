import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployeeForm } from './EmployeeFormProvider';
import supabase from '../../supabaseClient';
import './CustomerManagement.css';

const SelectClientStep = () => {
  const { formData, updateFormData } = useEmployeeForm();
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(formData.customer || {});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

  const handleNext = () => {
    updateFormData({ customer: selectedCustomer });
    navigate('/employee/step3');
  };

  const handleBack = () => {
    navigate('/employee/step1');
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="customer-management">
      <h2>Selecteaza Client</h2>
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
                <th>Acțiune</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map(customer => (
                <tr key={customer.id}>
                  <td>{customer.name}</td>
                  <td>{customer.email}</td>
                  <td>{customer.phone}</td>
                  <td>{customer.contract_number}</td>
                  <td>{customer.location}</td>
                  <td>
                    <button 
                      onClick={() => setSelectedCustomer(customer)}
                      className={selectedCustomer.id === customer.id ? 'selected-button' : ''}
                    >
                      {selectedCustomer.id === customer.id ? 'Selectat' : 'Selectează'}
                    </button>
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