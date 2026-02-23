import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployeeForm } from './EmployeeFormProvider';
import supabase from '../../supabaseClient';
import './SelectClientStep.css';

const SelectClientStep = () => {
  const { formData, updateFormData } = useEmployeeForm();
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(formData.customer || {});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const navigate = useNavigate();
  const navigationButtonsRef = useRef(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
    setTimeout(() => {
      if (navigationButtonsRef.current) {
        navigationButtonsRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    <div className="sc-wrapper">
      <h2 className="sc-title">Selecteaza Client</h2>
      <div className="sc-search">
        <input
          type="text"
          placeholder="Caut\u0103 client..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="sc-loading">Se \u00eencarc\u0103...</p>
      ) : isMobile ? (
        /* ---- MOBILE: lista simpla fara tabel ---- */
        <div className="sc-list">
          {filteredCustomers.map(customer => (
            <div key={customer.id} className={`sc-item${selectedCustomer.id === customer.id ? ' sc-item--selected' : ''}`}>
              <div className="sc-item__info">
                <span className="sc-item__name">{customer.name}</span>
                <span className="sc-item__detail">{customer.location}</span>
                <span className="sc-item__detail">{customer.contract_number}</span>
              </div>
              <button
                className={`sc-item__btn${selectedCustomer.id === customer.id ? ' sc-item__btn--selected' : ''}`}
                onClick={() => handleSelectCustomer(customer)}
              >
                {selectedCustomer.id === customer.id ? '\u2713' : 'Select'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* ---- DESKTOP: tabel normal ---- */
        <div className="sc-table-wrap">
          <table className="sc-table">
            <thead>
              <tr>
                <th>Nume</th>
                <th>Email</th>
                <th>Telefon</th>
                <th>Numar Contract</th>
                <th>Punct de lucru</th>
                <th>Ac\u021biune</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map(customer => (
                <tr key={customer.id} className={selectedCustomer.id === customer.id ? 'sc-row--selected' : ''}>
                  <td>{customer.name}</td>
                  <td>{customer.email}</td>
                  <td>{customer.phone}</td>
                  <td>{customer.contract_number}</td>
                  <td>{customer.location}</td>
                  <td>
                    <button
                      onClick={() => handleSelectCustomer(customer)}
                      className={selectedCustomer.id === customer.id ? 'sc-btn--selected' : 'sc-btn'}
                    >
                      {selectedCustomer.id === customer.id ? 'Selectat' : 'Selecteaz\u0103'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="sc-nav" ref={navigationButtonsRef}>
        <button onClick={handleBack}>Back</button>
        <button onClick={handleNext} disabled={!selectedCustomer.id}>Next</button>
      </div>
    </div>
  );
};

export default SelectClientStep;

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
          <table>
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
                <tr key={customer.id}>
                  <td>{customer.name}</td>
                  <td>{customer.email}</td>
                  <td>{customer.phone}</td>
                  <td>{customer.contract_number}</td>
                  <td>{customer.location}</td>
                  <td>
                    <button
                      onClick={() => handleSelectCustomer(customer)}
                      className={selectedCustomer.id === customer.id ? 'selected-button' : 'select-button'}
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
      <div className="navigation-buttons" ref={navigationButtonsRef}>
        <button onClick={handleBack}>Back</button>
        <button onClick={handleNext} disabled={!selectedCustomer.id}>Next</button>
      </div>
    </div>
  );
};

export default SelectClientStep;