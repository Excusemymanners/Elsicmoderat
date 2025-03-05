import { useState, useEffect } from 'react';
import supabase from '../../supabaseClient';
import './GestionareLucrari.css';

const GestionareLucrari = () => {
    const [lucrari, setLucrari] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [surfaces, setSurfaces] = useState({});
    const [clientsCache, setClientsCache] = useState({});
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmText, setConfirmText] = useState('');

    useEffect(() => {
        if (showConfirmModal) {
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }
    }, [showConfirmModal]);

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

    const getCombinedSurfaces = async (lucrare) => {
        if (!lucrare.client_name) return '0';

        // Check cache first
        if (!clientsCache[lucrare.client_name]) {
            const client = await fetchClient(lucrare.client_name);
            setClientsCache(prev => ({ ...prev, [lucrare.client_name]: client }));
        }

        const client = clientsCache[lucrare.client_name];
        const surfaces = [];

        if (lucrare.procedure1) surfaces.push(getSurface(client, lucrare.procedure1));
        if (lucrare.procedure2) surfaces.push(getSurface(client, lucrare.procedure2));
        if (lucrare.procedure3) surfaces.push(getSurface(client, lucrare.procedure3));
        if (lucrare.procedure4) surfaces.push(getSurface(client, lucrare.procedure4));

        return surfaces.join('; ');
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

            // Pre-calculate all surfaces
            const surfacesData = {};
            for (const lucrare of data || []) {
                surfacesData[lucrare.id] = await getCombinedSurfaces(lucrare);
            }
            setSurfaces(surfacesData);
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

    const getSurface = (client, jobValue) => {
        const job = client?.jobs?.find(job => job.value === jobValue);
        if (!job || !job.surface) return '0';
        return Number(job.surface);
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

        const processRow = async (lucrare) => {
            const client = await fetchClient(lucrare.client_name);

            const procedures = [];
            const products = [];
            const surfaces = [];
            const lotsAndQuantities = [];

            if (lucrare.procedure1 !== null) {
                procedures.push(lucrare.procedure1);
                products.push(lucrare.product1_name);
                surfaces.push(getSurface(client, lucrare.procedure1));
                lotsAndQuantities.push(`${lucrare.product1_lot} - ${lucrare.product1_quantity}`);
            }

            if (lucrare.procedure2 !== null) {
                procedures.push(lucrare.procedure2);
                products.push(lucrare.product2_name);
                surfaces.push(getSurface(client, lucrare.procedure2));
                lotsAndQuantities.push(`${lucrare.product2_lot} - ${lucrare.product2_quantity}`);
            }

            if (lucrare.procedure3 !== null) {
                procedures.push(lucrare.procedure3);
                products.push(lucrare.product3_name);
                surfaces.push(getSurface(client, lucrare.procedure3));
                lotsAndQuantities.push(`${lucrare.product3_lot} - ${lucrare.product3_quantity}`);
            }

            if (lucrare.procedure4 !== null) {
                procedures.push(lucrare.procedure4);
                products.push(lucrare.product4_name);
                surfaces.push(getSurface(client, lucrare.procedure4));
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

        processedRows.sort((a, b) => {
            const numA = parseInt(a.split(',')[0].replace(/"/g, ''));
            const numB = parseInt(b.split(',')[0].replace(/"/g, ''));
            return numA - numB;
        });

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
        setShowConfirmModal(true);
    };

    const handleConfirmClear = async () => {
        if (confirmText !== 'Confirm') {
            alert('Ștergerea a fost anulată.');
            setShowConfirmModal(false);
            setConfirmText('');
            return;
        }

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
        setShowConfirmModal(false);
        setConfirmText('');
    };

    const handleCancelClear = () => {
        setShowConfirmModal(false);
        setConfirmText('');
    };

    const filteredLucrari = lucrari.filter(lucrare =>
        lucrare.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lucrare.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lucrare.numar_ordine?.toString().includes(searchTerm)
    );

    return (
        <div className="lucrari-management">
            {showConfirmModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Confirmare ștergere</h3>
                        <p>Pentru a confirma ștergerea, scrieți "Confirm":</p>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="Scrieți 'Confirm'"
                        />
                        <div className="modal-buttons">
                            <button onClick={handleCancelClear}>Anulează</button>
                            <button onClick={handleConfirmClear}>Confirmă</button>
                        </div>
                    </div>
                </div>
            )}
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
                                    <td>{surfaces[lucrare.id] || '...'}</td>
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
                                            {lucrare.procedure4 && (
                                                <div className="procedure">
                                                    <strong>{lucrare.procedure4}:</strong>
                                                    <span>{lucrare.product4_name} (Lot: {lucrare.product4_lot}) - {lucrare.product4_quantity}</span>
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