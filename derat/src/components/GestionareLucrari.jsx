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

    const fetchClient = async (clientName) => {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('name', clientName);
      
        if (error) {
          console.error('Error fetching reception number:', error);
          return null;
        }
        
        return data[0];
    };

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

        console.log(data);  

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

        const processRow = async (lucrare) => {
            const client = await fetchClient(lucrare.client_name);
            
            const procedures = [];
            const products = [];
            const surfaces = [];
            const lotsAndQuantities = [];
        
            const getSurface = (jobLabel) => {
                const job = client?.jobs?.find(job => job.value === jobLabel);
                if (!job || !job.surface) return '0';
                // Convert to number and back to string to handle both number and string inputs
                return String(Number(job.surface) || 0);
            };
        
            if(lucrare.procedure1 !== null) {
                procedures.push(lucrare.procedure1);
                products.push(lucrare.product1_name);
                surfaces.push(getSurface(lucrare.procedure1));
                lotsAndQuantities.push(`${lucrare.product1_lot} - ${lucrare.product1_quantity}`);
            }
        
            if(lucrare.procedure2 !== null) {
                procedures.push(lucrare.procedure2);
                products.push(lucrare.product2_name);
                surfaces.push(getSurface(lucrare.procedure2));
                lotsAndQuantities.push(`${lucrare.product2_lot} - ${lucrare.product2_quantity}`);
            }
        
            if(lucrare.procedure3 !== null) {
                procedures.push(lucrare.procedure3);
                products.push(lucrare.product3_name);
                surfaces.push(getSurface(lucrare.procedure3));
                lotsAndQuantities.push(`${lucrare.product3_lot} - ${lucrare.product3_quantity}`);
            }
        
            if(lucrare.procedure4 !== null) {
                procedures.push(lucrare.procedure4);
                products.push(lucrare.product4_name);
                surfaces.push(getSurface(lucrare.procedure4));
                lotsAndQuantities.push(`${lucrare.product4_lot} - ${lucrare.product4_quantity}`);
            }

            const row = [
                lucrare.numar_ordine - 1, // Decrement numar_ordine by 1
                new Date(lucrare.created_at).toLocaleString('ro-RO'),
                lucrare.client_name,
                lucrare.client_location,
                surfaces.join('; '),
                lucrare.employee_name,
                procedures.join('; '),
                products.join('; '),
                lotsAndQuantities.join('; ')
            ];

            return row.map(escapeCSV).join(',');
        };

        const processedRows = await Promise.all(data.map(processRow));

        const csv = [
            headers.map(escapeCSV).join(','),
            ...processedRows
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