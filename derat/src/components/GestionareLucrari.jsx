import React, { useState, useEffect } from 'react';
import supabase from '../../supabaseClient';
import './GestionareLucrari.css';

const GestionareLucrari = () => {
    const [lucrari, setLucrari] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

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
            return;
        }

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
                lucrare.numar_ordine - 1, // Decrement numar_ordine by 1
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
    };

    const clearDatabase = async () => {
        // Șterge toate lucrările din baza de date
        const { error } = await supabase
            .from('lucrari')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Elimină toate înregistrările

        if (error) {
            console.error('Error deleting lucrari:', error);
            alert('Eroare la ștergerea lucrărilor din baza de date!');
        } else {
            setLucrari([]);
            alert('Toate lucrările au fost șterse din baza de date.');
        }
    };

    const filteredLucrari = lucrari.filter(lucrare =>
        lucrare.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lucrare.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lucrare.numar_ordine?.toString().includes(searchTerm)
    );

    return (
        <div className="lucrari-management">
            <h2>Gestionare Lucrări</h2>

            <div className="action-buttons">
                <button onClick={exportExcel}>Export Excel</button>
                <button onClick={clearDatabase}>Eliberează Baza de Date</button>
            </div>

            <div className="search-container">
                <input
                    type="text"
                    placeholder="Caută lucrare..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

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
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLucrari.map(lucrare => (
                                <tr key={lucrare.id}>
                                    <td>{lucrare.numar_ordine - 1}</td>
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