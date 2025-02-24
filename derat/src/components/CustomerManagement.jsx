import React, { useState, useEffect } from 'react';
import supabase from '../../supabaseClient';
import './CustomerManagement.css';

const CustomerManagement = () => {
    const [customers, setCustomers] = useState([]);
    const [newCustomer, setNewCustomer] = useState({
        name: '',
        email: '',
        phone: '',
        contract_number: '',
        location: '',
        jobs: [
            { label: 'Dezinfectie', value: 'dezinfectie', active: false, surface: '' },
            { label: 'Dezinsectie', value: 'dezinsectie', active: false, surface: '' },
            { label: 'Dezinsectie2', value: 'dezinsectie2', active: false, surface: '' },
            { label: 'Deratizare', value: 'deratizare', active: false, surface: '' }
        ]
    });
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showForm, setShowForm] = useState(true);
    const [loading, setLoading] = useState(false);

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

    const handleAddCustomer = async (e) => {
        e.preventDefault();
        setLoading(true);
        let result;
        if (editingCustomer) {
            result = await supabase
                .from('customers')
                .update(newCustomer)
                .eq('id', editingCustomer);
        } else {
            result = await supabase
                .from('customers')
                .insert([newCustomer]);
        }

        const { error } = result;
        if (error) {
            console.error('Error adding/updating customer:', error);
        } else {
            setNewCustomer({
                name: '',
                email: '',
                phone: '',
                contract_number: '',
                location: '',
                jobs: [
                    { label: 'Dezinfectie', value: 'dezinfectie', active: false, surface: '' },
                    { label: 'Dezinsectie', value: 'dezinsectie', active: false, surface: '' },
                    { label: 'Dezinsectie2', value: 'dezinsectie2', active: false, surface: '' },
                    { label: 'Deratizare', value: 'deratizare', active: false, surface: '' }
                ]
            });
            setEditingCustomer(null);
            await fetchCustomers();
        }
        setLoading(false);
    };

    const handleDeleteCustomer = async (id) => {
        setLoading(true);
        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', id);
        if (error) {
            console.error('Error deleting customer:', error);
        } else {
            await fetchCustomers();
        }
        setLoading(false);
    };

    const handleEditCustomer = (customer) => {
        setNewCustomer(customer);
        setEditingCustomer(customer.id);
        setShowForm(true);
    };

    const handleToggleForm = () => {
        setShowForm(!showForm);
    };

    const handleToggleJob = (index) => {
        const updatedJobs = [...newCustomer.jobs];
        updatedJobs[index].active = !updatedJobs[index].active;
        setNewCustomer({
            ...newCustomer,
            jobs: updatedJobs
        });
    };

    const handleSurfaceChange = (index, surface) => {
        const updatedJobs = [...newCustomer.jobs];
        updatedJobs[index].surface = surface;
        setNewCustomer({
            ...newCustomer,
            jobs: updatedJobs
        });
    };

    const filteredCustomers = customers.filter(customer =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="customer-management">
            <h2>Gestionare Clienți</h2>

            <div className="action-buttons">
                <button onClick={handleToggleForm} disabled={loading}>
                    {showForm ? 'Caută Clienți' : 'Adaugă Client'}
                </button>
            </div>

            {showForm ? (
                <form onSubmit={handleAddCustomer} className="customer-form">
                    <input
                        type="text"
                        placeholder="Nume client"
                        value={newCustomer.name}
                        onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                        required
                    />
                    <input
                        type="email"
                        placeholder="Email"
                        value={newCustomer.email}
                        onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                        required
                    />
                    <input
                        type="tel"
                        placeholder="Telefon"
                        value={newCustomer.phone}
                        onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                        required
                    />
                    <input
                        type="text"
                        placeholder="Număr de contract"
                        value={newCustomer.contract_number}
                        onChange={(e) => setNewCustomer({ ...newCustomer, contract_number: e.target.value })}
                        required
                    />
                    <input
                        type="text"
                        placeholder="Punct de lucru"
                        value={newCustomer.location}
                        onChange={(e) => setNewCustomer({ ...newCustomer, location: e.target.value })}
                    />
                    <div className="job-container">
                        {newCustomer.jobs.map((job, index) => (
                            <div key={index} className="job-item">
                                <button
                                    type="button"
                                    className={job.active ? 'active' : ''}
                                    onClick={() => handleToggleJob(index)}
                                >
                                    {job.label}
                                </button>
                                {job.active && (
                                    <input
                                        type="text"
                                        placeholder="Suprafață"
                                        value={job.surface}
                                        onChange={(e) => handleSurfaceChange(index, e.target.value)}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                    <button type="submit" disabled={loading}>
                        {editingCustomer !== null ? 'Actualizează Client' : 'Adaugă Client'}
                    </button>
                </form>
            ) : (
                <div className="search-container">
                    <input
                        type="text"
                        placeholder="Caută client..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            )}

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
                                <th>Număr de contract</th>
                                <th>Punct de lucru</th>
                                <th>Joburi</th>
                                <th>Acțiuni</th>
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
                                        {customer.jobs && customer.jobs
                                            .filter(job => job.active)
                                            .map((job, index) => (
                                                <div key={index}>
                                                    {job.label}: {job.surface}
                                                </div>
                                            ))}
                                    </td>
                                    <td>
                                        <button onClick={() => handleEditCustomer(customer)}>
                                            Editează
                                        </button>
                                        <button onClick={() => handleDeleteCustomer(customer.id)}>
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

export default CustomerManagement;