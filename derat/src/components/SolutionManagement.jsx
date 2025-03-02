import React, { useState, useEffect } from 'react';
import supabase from '../../supabaseClient';
import './SolutionManagement.css';

const SolutionManagement = () => {
    // State-uri
    const [solutions, setSolutions] = useState([]);
    const [newSolution, setNewSolution] = useState({
        name: '',
        lot: '',
        concentration: '',
        stock: '',
        initial_stock: '',
        total_quantity: '',
        remaining_quantity: '',
        quantity_per_sqm: '',
        unit_of_measure: 'ml'
    });
    const [editingSolution, setEditingSolution] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showForm, setShowForm] = useState(true);
    const [loading, setLoading] = useState(false);

    // Funcții
    const fetchSolutions = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('solutions')
            .select('*');
        if (error) {
            console.error('Error fetching solutions:', error);
        } else {
            setSolutions(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSolutions();
    }, []);

    const handleToggleForm = () => {
        setShowForm(!showForm);
    };

    const handleAddSolution = async (e) => {
        e.preventDefault();
        setLoading(true);
        let result;

        const stock = parseFloat(newSolution.stock);
        const quantityPerSqm = parseFloat(newSolution.quantity_per_sqm);

        if (isNaN(stock) || isNaN(quantityPerSqm)) {
            console.error('Invalid numeric values for stock or quantity per sqm');
            setLoading(false);
            return;
        }

        const solutionToSave = {
            ...newSolution,
            initial_stock: stock,
            total_quantity: stock,
            remaining_quantity: stock,
            quantity_per_sqm: quantityPerSqm
        };

        if (editingSolution) {
            result = await supabase
                .from('solutions')
                .update(solutionToSave)
                .eq('id', editingSolution);
        } else {
            result = await supabase
                .from('solutions')
                .insert([solutionToSave]);
        }

        const { error } = result;
        if (error) {
            console.error('Error adding/updating solution:', error);
        } else {
            setNewSolution({
                name: '',
                lot: '',
                concentration: '',
                stock: '',
                initial_stock: '',
                total_quantity: '',
                remaining_quantity: '',
                quantity_per_sqm: '',
                unit_of_measure: 'ml'
            });
            setEditingSolution(null);
            await fetchSolutions();
        }
        setLoading(false);
    };

    const handleDeleteSolution = async (id) => {
        setLoading(true);
        const { error } = await supabase
            .from('solutions')
            .delete()
            .eq('id', id);
        if (error) {
            console.error('Error deleting solution:', error);
        } else {
            await fetchSolutions();
        }
        setLoading(false);
    };

    const handleEditSolution = (solution) => {
        setNewSolution(solution);
        setEditingSolution(solution.id);
        setShowForm(true);
    };

    const calculateRemainingPercentage = (initialStock, remainingQuantity) => {
        return ((remainingQuantity / initialStock) * 100).toFixed(2);
    };

    const filteredSolutions = solutions.filter(solution =>
        solution.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        solution.lot.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Render
    return (
        <div className="solution-management">
            

            <h2>Gestionare Soluții</h2>

            <div className="action-buttons">
                <button onClick={handleToggleForm} disabled={loading}>
                    {showForm ? 'Caută Soluții' : 'Adaugă Soluție'}
                </button>
            </div>

            {showForm ? (
                <form onSubmit={handleAddSolution} className="solution-form">
                    <input
                        type="text"
                        placeholder="Nume substanță"
                        value={newSolution.name}
                        onChange={(e) => setNewSolution({ ...newSolution, name: e.target.value })}
                        required
                    />
                    <input
                        type="text"
                        placeholder="Aviz/Lot"
                        value={newSolution.lot}
                        onChange={(e) => setNewSolution({ ...newSolution, lot: e.target.value })}
                        required
                    />
                    <input
                        type="text"
                        placeholder="Concentrație"
                        value={newSolution.concentration}
                        onChange={(e) => setNewSolution({ ...newSolution, concentration: e.target.value })}
                        required
                    />
                    <input
                        type="text"
                        placeholder={`Cantitate stoc (${newSolution.unit_of_measure})`}
                        value={newSolution.stock}
                        onChange={(e) => setNewSolution({ ...newSolution, stock: e.target.value })}
                        required
                    />
                    <input
                        type="text"
                        placeholder={`Cantitate pe metru pătrat (${newSolution.unit_of_measure})`}
                        value={newSolution.quantity_per_sqm}
                        onChange={(e) => setNewSolution({ ...newSolution, quantity_per_sqm: e.target.value })}
                        required
                    />
                    <select
                        value={newSolution.unit_of_measure}
                        onChange={(e) => setNewSolution({ ...newSolution, unit_of_measure: e.target.value })}
                        required
                    >
                        <option value="ml">Mililitri (ml)</option>
                        <option value="g">Grame (g)</option>
                    </select>
                    <button type="submit" disabled={loading}>
                        {editingSolution !== null ? 'Actualizează Soluție' : 'Adaugă Soluție'}
                    </button>
                </form>
            ) : (
                <div className="search-container">
                    <input
                        type="text"
                        placeholder="Caută soluție..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            )}

            <div className="solutions-list">
                {loading ? (
                    <p>Se încarcă...</p>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Nume</th>
                                <th>Aviz/Lot</th>
                                <th>Concentrație</th>
                                <th>Stoc inițial</th>
                                <th>Cantitate Rămasă / Totală</th>
                                <th>Procentaj rămas</th>
                                <th>Cantitate pe metru pătrat</th>
                                <th>Acțiuni</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSolutions.map(solution => {
                                const percentage = calculateRemainingPercentage(solution.initial_stock, solution.remaining_quantity);
                                return (
                                    <tr key={solution.id}>
                                        <td>{solution.name}</td>
                                        <td>{solution.lot}</td>
                                        <td>{solution.concentration}</td>
                                        <td>{solution.initial_stock} {solution.unit_of_measure}</td>
                                        <td>
                                            {solution.remaining_quantity} {solution.unit_of_measure} / {solution.total_quantity} {solution.unit_of_measure}
                                        </td>
                                        <td>
                                            <div className="progress-bar-container">
                                                <div 
                                                    className="progress-bar" 
                                                    style={{ 
                                                        width: `${percentage}%`,
                                                        backgroundColor: percentage > 50 ? '#4CAF50' : percentage > 20 ? '#FFA500' : '#FF0000'
                                                    }}
                                                >
                                                    {percentage}%
                                                </div>
                                            </div>
                                        </td>
                                        <td>{solution.quantity_per_sqm} {solution.unit_of_measure}</td>
                                        <td>
                                            <button onClick={() => handleEditSolution(solution)}>
                                                Editează
                                            </button>
                                            <button onClick={() => handleDeleteSolution(solution.id)}>
                                                Șterge
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default SolutionManagement;