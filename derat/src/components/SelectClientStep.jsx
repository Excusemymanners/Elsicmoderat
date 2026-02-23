import React, { useState, useEffect, useRef } from 'react';
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
  const navigationButtonsRef = useRef(null);

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

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    
    // Scroll to navigation buttons after a short delay
    setTimeout(() => {
      if (navigationButtonsRef.current) {
        navigationButtonsRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }, 100);
  };

  const handleNext = () => {
    updateFormData({ customer: selectedCustomer });
    navigate('/employee/step3');
  };

  const handleBack = () => {
    navigate('/employee/step1');
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.unitatea_de_lucru?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <>
            {/* Tabel desktop */}
            <table className="desktop-table">
              <thead>
                <tr>
                  <th>Nume</th>
                  <th>Email</th>
                  <th>Telefon</th>
                  <th>Numar Contract</th>
                  <th>Punct de lucru</th>
                  <th>Acțiune</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map(customer => (
                  <tr
                    key={customer.id}
                    onClick={() => handleSelectCustomer(customer)}
                    className={selectedCustomer.id === customer.id ? 'selected-row' : ''}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{customer.name}</td>
                    <td>{customer.email}</td>
                    <td>{customer.phone}</td>
                    <td>{customer.contract_number}</td>
                    <td>{customer.location}</td>
                    <td>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSelectCustomer(customer); }}
                        className={selectedCustomer.id === customer.id ? 'selected-button' : 'select-button'}
                      >
                        {selectedCustomer.id === customer.id ? 'Selectat ✓' : 'Selectează'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Carduri mobile */}
            <div className="mobile-cards">
              {filteredCustomers.map(customer => (
                <div
                  key={customer.id}
                  className={`client-card${selectedCustomer.id === customer.id ? ' client-card--selected' : ''}`}
                  onClick={() => handleSelectCustomer(customer)}
                >
                  <div className="client-card__name">{customer.name}</div>
                  <div className="client-card__details">
                    <span>📍 {customer.location}</span>
                    <span>📄 {customer.contract_number}</span>
                    <span>📞 {customer.phone}</span>
                  </div>
                  {selectedCustomer.id === customer.id && (
                    <div className="client-card__badge">✓ Selectat</div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="navigation-buttons" ref={navigationButtonsRef}>
        <button onClick={handleBack}>Back</button>
        <button onClick={handleNext} disabled={!selectedCustomer.id}>Next</button>
      </div>
    </div>
  );
};

export default SelectClientStep;