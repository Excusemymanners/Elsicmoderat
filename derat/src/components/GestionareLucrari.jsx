import React, { useState, useEffect } from 'react';
import supabase from '../../supabaseClient';
import './GestionareLucrari.css';

const GestionareLucrari = () => {
    const [lucrari, setLucrari] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showForm, setShowForm] = useState(true);
    const [newLucrare, setNewLucrare] = useState({
        numar_ordine: '',
        client_name: '',
        client_contract: '',
        client_location: '',
        client_surface: '',
        employee_name: '',
        procedure1: '',
        product1_name: '',
        product1_lot: '',
        product1_quantity: '',
        procedure2: '',
        product2_name: '',
        product2_lot: '',
        product2_quantity: '',
        procedure3: '',
        product3_name: '',
        product3_lot: '',
        product3_quantity: ''
    });
    const [editingLucrare, setEditingLucrare] = useState(null);

    useEffect(() => {
        fetchLucrari();
    }, []);

    const fetchLucrari = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('lucrari')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching lucrari:', error);
        } else {
            setLucrari(data || []);
        }
        setLoading(false);
    };

    const handleAddLucrare = async (e) => {
        e.preventDefault();
        setLoading(true);
        let result;

        if (editingLucrare) {
            result = await supabase
                .from('lucrari')
                .update(newLucrare)
                .eq('id', editingLucrare);
        } else {
            result = await supabase
                .from('lucrari')
                .insert([newLucrare]);
        }

        const { error } = result;
        if (error) {
            console.error('Error adding/updating lucrare:', error);
            alert('Eroare la salvarea lucrării!');
        } else {
            setNewLucrare({
                numar_ordine: '',
                client_name: '',
                client_contract: '',
                client_location: '',
                client_surface: '',
                employee_name: '',
                procedure1: '',
                product1_name: '',
                product1_lot: '',
                product1_quantity: '',
                procedure2: '',
                product2_name: '',
                product2_lot: '',
                product2_quantity: '',
                procedure3: '',
                product3_name: '',
                product3_lot: '',
                product3_quantity: ''
            });
            setEditingLucrare(null);
            await fetchLucrari();
        }
        setLoading(false);
    };

    const handleDeleteLucrare = async (id) => {
        if (window.confirm('Ești sigur că vrei să ștergi această lucrare?')) {
            setLoading(true);
            const { error } = await supabase
                .from('lucrari')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Error deleting lucrare:', error);
                alert('Eroare la ștergerea lucrării!');
            } else {
                await fetchLucrari();
            }
            setLoading(false);
        }
    };

    const handleEditLucrare = (lucrare) => {
        setNewLucrare(lucrare);
        setEditingLucrare(lucrare.id);
        setShowForm(true);
    };

    const handleToggleForm = () => {
        setShowForm(!showForm);
        if (editingLucrare) {
            setEditingLucrare(null);
            setNewLucrare({
                numar_ordine: '',
                client_name: '',
                client_contract: '',
                client_location: '',
                client_surface: '',
                employee_name: '',
                procedure1: '',
                product1_name: '',
                product1_lot: '',
                product1_quantity: '',
                procedure2: '',
                product2_name: '',
                product2_lot: '',
                product2_quantity: '',
                procedure3: '',
                product3_name: '',
                product3_lot: '',
                product3_quantity: ''
            });
        }
    };

    const filteredLucrari = lucrari.filter(lucrare =>
        lucrare.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lucrare.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lucrare.numar_ordine?.toString().includes(searchTerm)
    );

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString('ro-RO', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const exportExcel = async () => {
    const { data, error } = await supabase
        .from('lucrari')
        .select('*');

    if (error) {
        console.error('Error fetching lucrari:', error);
        alert('Eroare la exportul fișierului Excel!');
    } else {
        // Helper function to escape CSV values
        const escapeCSV = (value) => {
            if (value === null || value === undefined) return '';
            return `"${value.toString().replace(/"/g, '""')}"`;
        };

        const headers = [
            'Nr. Proces Verbal',
            'Data',
            'Beneficiar',
            'Locatie',
            'Suprafata',
            'Nume Angajat',
            'Proceduri (Deratizare, Dezinfectie, Dezinsectie)',
            'Denumire Produs',
            'Lot si cantitate'
        ];

        const processRow = (lucrare) => {
            const procedures = [
                lucrare.procedure1,
                lucrare.procedure2,
                lucrare.procedure3
            ].filter(Boolean).join('; ');

            const products = [
                lucrare.product1_name,
                lucrare.product2_name,
                lucrare.product3_name
            ].filter(Boolean).join('; ');

            const lotsAndQuantities = [
                lucrare.product1_lot && lucrare.product1_quantity ? 
                    `${lucrare.product1_name}: ${lucrare.product1_lot} - ${lucrare.product1_quantity}` : null,
                lucrare.product2_lot && lucrare.product2_quantity ? 
                    `${lucrare.product2_name}: ${lucrare.product2_lot} - ${lucrare.product2_quantity}` : null,
                lucrare.product3_lot && lucrare.product3_quantity ? 
                    `${lucrare.product3_name}: ${lucrare.product3_lot} - ${lucrare.product3_quantity}` : null
            ].filter(Boolean).join('; ');

            const row = [
                lucrare.numar_ordine,
                new Date(lucrare.created_at).toLocaleString('ro-RO'),
                lucrare.client_name,
                lucrare.client_location,
                lucrare.client_surface,
                lucrare.employee_name,
                procedures,
                products,
                lotsAndQuantities
            ];

            return row.map(escapeCSV).join(',');
        };

        const csv = [
            headers.map(escapeCSV).join(','),
            ...data.map(processRow)
        ].join('\n');

        // Add BOM for Excel to properly detect UTF-8
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lucrari.csv';
        a.click();
        URL.revokeObjectURL(url);
    }
};

    return (
        <div className="lucrari-management">
            <h2>Gestionare Lucrări</h2>

            <div className="action-buttons">
                <button onClick={handleToggleForm} disabled={loading}>
                    {showForm ? 'Caută Lucrări' : 'Adaugă Lucrare'}
                </button>
                <button onClick={exportExcel}>Exporta fisier Excel</button>
            </div>

            {showForm ? (
                <form onSubmit={handleAddLucrare} className="lucrare-form">
                    <input
                        type="text"
                        placeholder="Număr Ordin"
                        value={newLucrare.numar_ordine}
                        onChange={(e) => setNewLucrare({ ...newLucrare, numar_ordine: e.target.value })}
                        required
                    />
                    <input
                        type="text"
                        placeholder="Nume Client"
                        value={newLucrare.client_name}
                        onChange={(e) => setNewLucrare({ ...newLucrare, client_name: e.target.value })}
                        required
                    />
                    <input
                        type="text"
                        placeholder="Contract Client"
                        value={newLucrare.client_contract}
                        onChange={(e) => setNewLucrare({ ...newLucrare, client_contract: e.target.value })}
                    />
                    <input
                        type="text"
                        placeholder="Locație"
                        value={newLucrare.client_location}
                        onChange={(e) => setNewLucrare({ ...newLucrare, client_location: e.target.value })}
                    />
                    <input
                        type="number"
                        placeholder="Suprafață (mp)"
                        value={newLucrare.client_surface}
                        onChange={(e) => setNewLucrare({ ...newLucrare, client_surface: e.target.value })}
                    />
                    <input
                        type="text"
                        placeholder="Nume Angajat"
                        value={newLucrare.employee_name}
                        onChange={(e) => setNewLucrare({ ...newLucrare, employee_name: e.target.value })}
                        required
                    />
                    {/* Procedura 1 */}
                    <select
                        value={newLucrare.procedure1}
                        onChange={(e) => setNewLucrare({ ...newLucrare, procedure1: e.target.value })}
                    >
                        <option value="">Selectează Procedura 1</option>
                        <option value="Dezinfectie">Dezinfecție</option>
                        <option value="Dezinsectie">Dezinsecție</option>
                        <option value="Deratizare">Deratizare</option>
                    </select>
                    <input
                        type="text"
                        placeholder="Produs 1"
                        value={newLucrare.product1_name}
                        onChange={(e) => setNewLucrare({ ...newLucrare, product1_name: e.target.value })}
                    />
                    <input
                        type="text"
                        placeholder="Lot Produs 1"
                        value={newLucrare.product1_lot}
                        onChange={(e) => setNewLucrare({ ...newLucrare, product1_lot: e.target.value })}
                    />
                    <input
                        type="number"
                        placeholder="Cantitate Produs 1"
                        value={newLucrare.product1_quantity}
                        onChange={(e) => setNewLucrare({ ...newLucrare, product1_quantity: e.target.value })}
                    />
                    {/* Procedurile 2 și 3 similar */}
                    <button type="submit" disabled={loading}>
                        {editingLucrare ? 'Actualizează Lucrare' : 'Adaugă Lucrare'}
                    </button>
                </form>
            ) : (
                <div className="search-container">
                    <input
                        type="text"
                        placeholder="Caută lucrare..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            )}

            <div className="lucrari-list">
                {loading ? (
                    <p>Se încarcă...</p>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Nr. Ordin</th>
                                <th>Data</th>
                                <th>Client</th>
                                <th>Contract</th>
                                <th>Locație</th>
                                <th>Suprafață</th>
                                <th>Angajat</th>
                                <th>Proceduri și Produse</th>
                                <th>Acțiuni</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLucrari.map(lucrare => (
                                <tr key={lucrare.id}>
                                    <td>{lucrare.numar_ordine}</td>
                                    <td>{formatDate(lucrare.created_at)}</td>
                                    <td>{lucrare.client_name}</td>
                                    <td>{lucrare.client_contract}</td>
                                    <td>{lucrare.client_location}</td>
                                    <td>{lucrare.client_surface} mp</td>
                                    <td>{lucrare.employee_name}</td>
                                    <td>
                                        <div className="procedures">
                                            {lucrare.procedure1 && (
                                                <div className="procedure">
                                                    <strong>{lucrare.procedure1}:</strong>
                                                    <span>{lucrare.product1_name} (Lot: {lucrare.product1_lot}) - {lucrare.product1_quantity}</span>
                                                </div>
                                            )}
                                            {lucrare.procedure2 && (
                                                <div className="procedure">
                                                    <strong>{lucrare.procedure2}:</strong>
                                                    <span>{lucrare.product2_name} (Lot: {lucrare.product2_lot}) - {lucrare.product2_quantity}</span>
                                                </div>
                                            )}
                                            {lucrare.procedure3 && (
                                                <div className="procedure">
                                                    <strong>{lucrare.procedure3}:</strong>
                                                    <span>{lucrare.product3_name} (Lot: {lucrare.product3_lot}) - {lucrare.product3_quantity}</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <button onClick={() => handleEditLucrare(lucrare)}>
                                            Editează
                                        </button>
                                        <button onClick={() => handleDeleteLucrare(lucrare.id)}>
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

export default GestionareLucrari;