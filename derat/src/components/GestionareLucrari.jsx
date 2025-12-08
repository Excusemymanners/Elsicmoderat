import { useState, useEffect } from 'react';
import supabase from '../../supabaseClient';
import './GestionareLucrari.css';

const GestionareLucrari = () => {
    const [lucrari, setLucrari] = useState([]);
    const [loading, setLoading] = useState(false);
    const [surfacesLoading, setSurfacesLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [surfaces, setSurfaces] = useState({});
    const [clientsCache, setClientsCache] = useState({});
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const itemsPerPage = 50;

    // Detect mobile/tablet size
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (showConfirmModal) {
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }
    }, [showConfirmModal]);

    useEffect(() => {
        fetchLucrari(currentPage);
    }, [currentPage]);

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

    const getSurface = (client, jobValue) => {
        console.log('Surface calculation details:', {
            clientName: client?.name,
            jobValue,
            clientJobs: client?.jobs,
            foundJob: client?.jobs?.find(job => job.value === jobValue),
            surface: client?.jobs?.find(job => job.value === jobValue)?.surface || '0'
        });
        const job = client?.jobs?.find(job => job.value === jobValue);
        if (!job || !job.surface) return '0';
        return Number(job.surface);
    };

    const getCombinedSurfaces = async (lucrare) => {
        if (!lucrare.client_name) return '0';

        // Check cache first
        if (!clientsCache[lucrare.client_name]) {
            const client = await fetchClient(lucrare.client_name);
            console.log('Fetched client data:', {
                clientName: lucrare.client_name,
                clientData: client,
                clientJobs: client?.jobs,
                procedures: [lucrare.procedure1, lucrare.procedure2, lucrare.procedure3, lucrare.procedure4]
            });
            // Update cache and wait for it to be available
            setClientsCache(prev => ({ ...prev, [lucrare.client_name]: client }));
            // Use the client data directly instead of from cache
            const surfaces = [];
            if (lucrare.procedure1) surfaces.push(getSurface(client, lucrare.procedure1));
            if (lucrare.procedure2) surfaces.push(getSurface(client, lucrare.procedure2));
            if (lucrare.procedure3) surfaces.push(getSurface(client, lucrare.procedure3));
            if (lucrare.procedure4) surfaces.push(getSurface(client, lucrare.procedure4));

            const combinedSurfaces = surfaces.join('; ');
            console.log('Combined surfaces for lucrare:', {
                lucrareId: lucrare.id,
                clientName: lucrare.client_name,
                procedures: [lucrare.procedure1, lucrare.procedure2, lucrare.procedure3, lucrare.procedure4],
                surfaces,
                combinedSurfaces,
                clientJobs: client?.jobs
            });
            return combinedSurfaces;
        }

        // If we have cached data, use it
        const client = clientsCache[lucrare.client_name];
        console.log('Using cached client data:', {
            clientName: client?.name,
            clientJobs: client?.jobs,
            procedures: [lucrare.procedure1, lucrare.procedure2, lucrare.procedure3, lucrare.procedure4]
        });
        const surfaces = [];

        if (lucrare.procedure1) surfaces.push(getSurface(client, lucrare.procedure1));
        if (lucrare.procedure2) surfaces.push(getSurface(client, lucrare.procedure2));
        if (lucrare.procedure3) surfaces.push(getSurface(client, lucrare.procedure3));
        if (lucrare.procedure4) surfaces.push(getSurface(client, lucrare.procedure4));

        const combinedSurfaces = surfaces.join('; ');
        console.log('Combined surfaces for lucrare:', {
            lucrareId: lucrare.id,
            clientName: lucrare.client_name,
            procedures: [lucrare.procedure1, lucrare.procedure2, lucrare.procedure3, lucrare.procedure4],
            surfaces,
            combinedSurfaces,
            clientJobs: client?.jobs
        });
        return combinedSurfaces;
    };

    const fetchLucrari = async (page = 1) => {
        setLoading(true);
        setSurfacesLoading(true);
        
        const from = (page - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;

        // Get total count for pagination
        const { count } = await supabase
            .from('lucrari')
            .select('*', { count: 'exact', head: true });

        setTotalCount(count || 0);

        // Fetch paginated data
        const { data, error } = await supabase
            .from('lucrari')
            .select('*')
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('Error fetching lucrari:', error);
        } else {
            console.log('Fetched lucrari:', data);
            setLucrari(data || []);

            // Pre-calculate all surfaces for current page only
            const surfacesData = {};
            for (const lucrare of data || []) {
                surfacesData[lucrare.id] = await getCombinedSurfaces(lucrare);
            }
            console.log('Final surfaces data:', surfacesData);
            setSurfaces(surfacesData);
        }
        setLoading(false);
        setSurfacesLoading(false);
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
            'Lot si cantitate',
            'Concentratii'
        ];

        const processRow = async (lucrare) => {
            const client = await fetchClient(lucrare.client_name);

            const procedures = [];
            const products = [];
            const surfaces = [];
            const lotsAndQuantities = [];
            const concentrations = [];

            if (lucrare.procedure1 !== null) {
                procedures.push(lucrare.procedure1);
                products.push(lucrare.product1_name);
                surfaces.push(getSurface(client, lucrare.procedure1));
                lotsAndQuantities.push(`${lucrare.product1_lot} - ${lucrare.product1_quantity}`);
                concentrations.push(lucrare.concentration1 ?? 'null');
            }

            if (lucrare.procedure2 !== null) {
                procedures.push(lucrare.procedure2);
                products.push(lucrare.product2_name);
                surfaces.push(getSurface(client, lucrare.procedure2));
                lotsAndQuantities.push(`${lucrare.product2_lot} - ${lucrare.product2_quantity}`);
                concentrations.push(lucrare.concentration2 ?? 'null');
            }

            if (lucrare.procedure3 !== null) {
                procedures.push(lucrare.procedure3);
                products.push(lucrare.product3_name);
                surfaces.push(getSurface(client, lucrare.procedure3));
                lotsAndQuantities.push(`${lucrare.product3_lot} - ${lucrare.product3_quantity}`);
                concentrations.push(lucrare.concentration3 ?? 'null');
            }

            if (lucrare.procedure4 !== null) {
                procedures.push(lucrare.procedure4);
                products.push(lucrare.product4_name);
                surfaces.push(getSurface(client, lucrare.procedure4));
                lotsAndQuantities.push(`${lucrare.product4_lot} - ${lucrare.product4_quantity}`);
                concentrations.push(lucrare.concentration4 ?? 'null');
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
                lotsAndQuantities.join('; '),
                concentrations.join('; ')
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
        a.download = `lucrari_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        alert('✅ Lucrările au fost exportate cu succes!');
    };

    const clearDatabase = () => {
        setShowConfirmModal(true);
    };

    const handleConfirmClear = async () => {
        if (confirmText !== 'Confirm') {
            alert('Ștergerea a fost anulată.');
            setShowConfirmModal(false);
            setConfirmText('');
            return;
        }

        try {
            // First: Export CSV
            await exportExcel();

            // Then: Delete all records
            const { error } = await supabase
                .from('lucrari')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');

            if (error) {
                console.error('Error deleting lucrari:', error);
                alert('Eroare la ștergerea lucrărilor din baza de date!');
            } else {
                setLucrari([]);
                alert('✅ Backup-ul a fost descărcat și toate lucrările au fost șterse din baza de date.');
                await fetchLucrari(1); // Reset to first page
            }
        } catch (error) {
            console.error('Error in clear process:', error);
            alert('Eroare la procesul de ștergere!');
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

    const totalPages = Math.ceil(totalCount / itemsPerPage);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

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
                <button onClick={exportExcel}>📄 Export</button>
                {!isMobile && (
                    <button onClick={clearDatabase} className="danger-button">
                        🔑 Eliberare
                    </button>
                )}
            </div>

            <div className="search-container">
                <input
                    type="text"
                    placeholder="Caută lucrare..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Pagination Info */}
            <div className="pagination-info">
                <p>Total lucrări: <strong>{totalCount}</strong> | Pagina <strong>{currentPage}</strong> din <strong>{totalPages}</strong></p>
                <p>Afișare lucrări {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalCount)}</p>
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
                                <th>Unitate de lucru </th>
                                <th>Suprafață</th>
                                <th>Angajat</th>
                                <th>Proceduri și Produse</th>
                                <th>Concentrații</th>
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
                                    <td>{surfacesLoading ? 'Se încarcă...' : (surfaces[lucrare.id] || '0')}</td>
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
                                    <td>
                                        <div className="procedure">
                                            {(
                                                <div className="concentration">
                                                    <span>{lucrare.concentration1 ?? 'null'}; {lucrare.concentration2 ?? 'null'}; {lucrare.concentration3 ?? 'null'}; {lucrare.concentration4 ?? 'null'}</span>
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

            {/* Pagination Controls */}
            {!loading && totalPages > 1 && (
                <div className="pagination-controls">
                    <button 
                        onClick={() => handlePageChange(1)} 
                        disabled={currentPage === 1}
                        title="Prima pagină"
                    >
                        ⏮️ Prima
                    </button>
                    <button 
                        onClick={() => handlePageChange(currentPage - 1)} 
                        disabled={currentPage === 1}
                        title="Pagina anterioară"
                    >
                        ◀️ Anterior
                    </button>
                    
                    <div className="page-numbers">
                        {[...Array(totalPages)].map((_, index) => {
                            const pageNum = index + 1;
                            // Show only nearby pages to avoid too many buttons
                            if (
                                pageNum === 1 || 
                                pageNum === totalPages || 
                                (pageNum >= currentPage - 2 && pageNum <= currentPage + 2)
                            ) {
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => handlePageChange(pageNum)}
                                        className={currentPage === pageNum ? 'active' : ''}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            } else if (
                                pageNum === currentPage - 3 || 
                                pageNum === currentPage + 3
                            ) {
                                return <span key={pageNum}>...</span>;
                            }
                            return null;
                        })}
                    </div>

                    <button 
                        onClick={() => handlePageChange(currentPage + 1)} 
                        disabled={currentPage === totalPages}
                        title="Pagina următoare"
                    >
                        Următor ▶️
                    </button>
                    <button 
                        onClick={() => handlePageChange(totalPages)} 
                        disabled={currentPage === totalPages}
                        title="Ultima pagină"
                    >
                        Ultima ⏭️
                    </button>
                </div>
            )}
        </div>
    );
};

export default GestionareLucrari;