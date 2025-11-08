import React, { useState, useEffect } from 'react';
import supabase from '../../supabaseClient';
import * as XLSX from 'xlsx';
import './SolutionManagement.css';

export const updateRemainingQuantities = async (operations) => {
  try {
    for (const operation of operations) {
      const { solutionId, quantity } = operation;
      const { data, error } = await supabase
        .from('solutions')
        .select('remaining_quantity, minimum_reserve, name')
        .eq('id', solutionId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch remaining quantity: ${error.message}`);
      }

      const newRemainingQuantity = data.remaining_quantity - quantity;
      const minimumReserve = data.minimum_reserve || 0;

      // Verifică dacă cantitatea rămasă atinge rezerva minimă
      const shouldDeactivate = newRemainingQuantity <= minimumReserve;

      const updateData = { 
        remaining_quantity: newRemainingQuantity
      };

      // Dacă atinge rezerva minimă, dezactivează automat soluția
      if (shouldDeactivate) {
        updateData.is_active = false;
        console.warn(`⚠️ Soluția "${data.name}" a atins rezerva minimă și a fost dezactivată automat!`);
      }

      const { error: updateError } = await supabase
        .from('solutions')
        .update(updateData)
        .eq('id', solutionId);

      if (updateError) {
        throw new Error(`Failed to update remaining quantity: ${updateError.message}`);
      }

      console.log(`Updated remaining quantity for solution ${solutionId}: ${newRemainingQuantity}`);
      
      if (shouldDeactivate) {
        alert(`⚠️ ATENȚIE: Soluția "${data.name}" a atins rezerva minimă (${minimumReserve}) și a fost dezactivată automat!`);
      }
    }
  } catch (error) {
    console.error('Error updating remaining quantities:', error);
    throw error;
  }
};

const SolutionManagement = () => {
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
    unit_of_measure: 'ml',
    minimum_reserve: ''
  });
  const [editingSolution, setEditingSolution] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchSolutions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('solutions')
      .select('*');
    if (error) {
      console.error('Error fetching solutions:', error);
    } else {
      // Verifică și dezactivează automat soluțiile care au atins rezerva minimă
      await checkAndDeactivateLowStock(data);
      
      // Reîncarcă datele după verificare
      const { data: updatedData } = await supabase
        .from('solutions')
        .select('*');
      setSolutions(updatedData || data);
    }
    setLoading(false);
  };

  const checkAndDeactivateLowStock = async (solutionsData) => {
    try {
      const deactivatePromises = [];
      
      for (const solution of solutionsData) {
        const remainingQuantity = solution.remaining_quantity || solution.total_quantity || 0;
        const minimumReserve = solution.minimum_reserve || 0;
        const isActive = solution.is_active !== false;
        
        // Dacă soluția este activă dar cantitatea rămasă este <= rezerva minimă
        if (isActive && remainingQuantity <= minimumReserve) {
          console.warn(`🔴 Dezactivare automată: "${solution.name}" - Rămas: ${remainingQuantity}, Rezervă: ${minimumReserve}`);
          
          deactivatePromises.push(
            supabase
              .from('solutions')
              .update({ is_active: false })
              .eq('id', solution.id)
          );
        }
      }
      
      if (deactivatePromises.length > 0) {
        await Promise.all(deactivatePromises);
        console.log(`✅ ${deactivatePromises.length} soluții au fost dezactivate automat.`);
      }
    } catch (error) {
      console.error('Error checking and deactivating low stock:', error);
    }
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

    const minimumReserve = parseFloat(newSolution.minimum_reserve) || 0;

    // Verifică dacă stocul este sub rezerva minimă
    const shouldBeActive = stock > minimumReserve;
    
    if (!shouldBeActive && !editingSolution) {
      const confirmAdd = window.confirm(
        `⚠️ ATENȚIE!\n\n` +
        `Stocul introdus (${stock} ${newSolution.unit_of_measure}) este mai mic sau egal cu rezerva minimă (${minimumReserve} ${newSolution.unit_of_measure}).\n\n` +
        `Soluția va fi adăugată ca INACTIVĂ.\n\n` +
        `Doriți să continuați?`
      );
      
      if (!confirmAdd) {
        setLoading(false);
        return;
      }
    }

    const solutionToSave = {
      ...newSolution,
      initial_stock: stock,
      total_quantity: stock,
      remaining_quantity: stock,
      quantity_per_sqm: quantityPerSqm,
      minimum_reserve: minimumReserve,
      is_active: shouldBeActive
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
        unit_of_measure: 'ml',
        minimum_reserve: ''
      });
      setEditingSolution(null);
      await fetchSolutions();
    }
    setLoading(false);
  };

  const handleToggleActive = async (id, currentStatus) => {
    setLoading(true);
    
    // Dacă încercăm să activăm soluția, verificăm mai întâi stocul
    if (!currentStatus) {
      const { data: solution } = await supabase
        .from('solutions')
        .select('*')
        .eq('id', id)
        .single();
      
      if (solution) {
        const remainingQuantity = solution.remaining_quantity || solution.total_quantity || 0;
        const minimumReserve = solution.minimum_reserve || 0;
        
        if (remainingQuantity <= minimumReserve) {
          alert(
            `❌ Nu se poate activa soluția "${solution.name}"!\n\n` +
            `Cantitatea rămasă (${remainingQuantity} ${solution.unit_of_measure}) ` +
            `este sub sau egală cu rezerva minimă (${minimumReserve} ${solution.unit_of_measure}).\n\n` +
            `Vă rugăm să adăugați mai mult stoc înainte de a activa soluția.`
          );
          setLoading(false);
          return;
        }
      }
    }
    
    const { error } = await supabase
      .from('solutions')
      .update({ is_active: !currentStatus })
      .eq('id', id);
    
    if (error) {
      console.error('Error toggling solution status:', error);
      alert('Eroare la schimbarea stării substanței!');
    } else {
      await fetchSolutions();
      alert(`Substanța a fost ${!currentStatus ? 'activată' : 'dezactivată'} cu succes!`);
    }
    setLoading(false);
  };

  const handleDeleteSolution = async (id) => {
    if (!window.confirm('Ești sigur că vrei să ștergi această substanță?')) {
      return;
    }
    
    setLoading(true);
    const { error } = await supabase
      .from('solutions')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting solution:', error);
      alert('Eroare la ștergerea substanței!');
    } else {
      await fetchSolutions();
      alert('Substanța a fost ștearsă cu succes!');
    }
    setLoading(false);
  };

  const handleEditSolution = (solution) => {
    setNewSolution({
      ...solution,
      stock: solution.total_quantity, // Setăm cantitatea totală actuală în câmpul 'stock'
      minimum_reserve: solution.minimum_reserve || ''
    });
    setEditingSolution(solution.id);
    setShowForm(true);
  };

  const calculateRemainingPercentage = (initialStock, remainingQuantity) => {
    return ((remainingQuantity / initialStock) * 100).toFixed(2);
  };

  const exportToExcel = () => {
    // Pregătește datele pentru export
    const exportData = solutions.map((solution, index) => {
      const percentage = calculateRemainingPercentage(solution.initial_stock, solution.remaining_quantity);
      const isActive = solution.is_active !== false;
      const minimumReserve = solution.minimum_reserve || 0;
      const remainingQuantity = solution.remaining_quantity || 0;
      const availableQuantity = remainingQuantity - minimumReserve;
      
      return {
        'Nr. Crt.': index + 1,
        'Status': isActive ? 'Activ' : 'Inactiv',
        'Nume Substanță': solution.name,
        'Aviz/Lot': solution.lot,
        'Concentrație': solution.concentration,
        'Stoc Inițial': `${solution.initial_stock} ${solution.unit_of_measure}`,
        'Cantitate Totală': `${solution.total_quantity} ${solution.unit_of_measure}`,
        'Cantitate Rămasă': `${remainingQuantity} ${solution.unit_of_measure}`,
        'Cantitate Disponibilă': `${availableQuantity.toFixed(2)} ${solution.unit_of_measure}`,
        'Rezervă Minimă': `${minimumReserve} ${solution.unit_of_measure}`,
        'Procentaj Rămas': `${percentage}%`,
        'Cantitate/mp': `${solution.quantity_per_sqm} ${solution.unit_of_measure}`,
        'Unitate Măsură': solution.unit_of_measure,
      };
    });

    // Adaugă informații suplimentare în header
    const currentDate = new Date().toLocaleString('ro-RO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // Creează un workbook
    const wb = XLSX.utils.book_new();

    // Adaugă informații generale
    const headerInfo = [
      ['FIȘĂ DE MAGAZIE - GESTIONARE SOLUȚII'],
      ['Data generării:', currentDate],
      ['Total soluții:', solutions.length],
      ['Soluții active:', solutions.filter(s => s.is_active !== false).length],
      ['Soluții inactive:', solutions.filter(s => s.is_active === false).length],
      [''],
    ];

    // Convertește datele în sheet
    const ws = XLSX.utils.aoa_to_sheet(headerInfo);
    XLSX.utils.sheet_add_json(ws, exportData, { origin: -1 });

    // Setează lățimea coloanelor
    const columnWidths = [
      { wch: 8 },  // Nr. Crt.
      { wch: 10 }, // Status
      { wch: 25 }, // Nume Substanță
      { wch: 35 }, // Aviz/Lot
      { wch: 12 }, // Concentrație
      { wch: 18 }, // Stoc Inițial
      { wch: 18 }, // Cantitate Totală
      { wch: 18 }, // Cantitate Rămasă
      { wch: 20 }, // Cantitate Disponibilă
      { wch: 18 }, // Rezervă Minimă
      { wch: 15 }, // Procentaj Rămas
      { wch: 15 }, // Cantitate/mp
      { wch: 15 }, // Unitate Măsură
    ];
    ws['!cols'] = columnWidths;

    // Adaugă worksheet la workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Fișa de Magazie');

    // Generează numele fișierului cu data curentă
    const fileName = `Fisa_Magazie_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`;

    // Salvează fișierul
    XLSX.writeFile(wb, fileName);

    alert(`Fișa de magazie a fost exportată cu succes!\nFișier: ${fileName}`);
  };

  const filteredSolutions = solutions.filter(solution =>
    solution.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    solution.lot.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatistics = () => {
    const totalSolutions = solutions.length;
    const activeSolutions = solutions.filter(s => s.is_active !== false).length;
    const inactiveSolutions = totalSolutions - activeSolutions;
    const lowStock = solutions.filter(s => {
      const remainingQuantity = s.remaining_quantity || 0;
      const minimumReserve = s.minimum_reserve || 0;
      const availableQuantity = remainingQuantity - minimumReserve;
      return availableQuantity < minimumReserve * 0.5 && s.is_active !== false;
    }).length;
    const criticalStock = solutions.filter(s => {
      const remainingQuantity = s.remaining_quantity || 0;
      const minimumReserve = s.minimum_reserve || 0;
      return remainingQuantity <= minimumReserve && s.is_active !== false;
    }).length;

    return { totalSolutions, activeSolutions, inactiveSolutions, lowStock, criticalStock };
  };

  const stats = getStatistics();

  return (
    <div className="solution-management">
      <h2>Gestionare Soluții</h2>

      {/* Statistics Dashboard */}
      <div className="statistics-dashboard">
        <div className="stat-card total">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalSolutions}</div>
            <div className="stat-label">Total Soluții</div>
          </div>
        </div>
        <div className="stat-card active">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-value">{stats.activeSolutions}</div>
            <div className="stat-label">Active</div>
          </div>
        </div>
        <div className="stat-card inactive">
          <div className="stat-icon">❌</div>
          <div className="stat-content">
            <div className="stat-value">{stats.inactiveSolutions}</div>
            <div className="stat-label">Inactive</div>
          </div>
        </div>
        <div className="stat-card low">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <div className="stat-value">{stats.lowStock}</div>
            <div className="stat-label">Stoc Scăzut</div>
          </div>
        </div>
        <div className="stat-card critical">
          <div className="stat-icon">🚨</div>
          <div className="stat-content">
            <div className="stat-value">{stats.criticalStock}</div>
            <div className="stat-label">Stoc Critic</div>
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <button onClick={handleToggleForm} disabled={loading}>
          {showForm ? 'Caută Soluții' : 'Adaugă Soluție'}
        </button>
        <button 
          className="export-button"
          onClick={exportToExcel} 
          disabled={loading || solutions.length === 0}
          title="Exportă fișa de magazie în format Excel"
        >
          📊 Exportă Fișă de Magazie (Excel)
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
            placeholder={`Cantitate totală (${newSolution.unit_of_measure})`}
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
          <input
            type="number"
            placeholder={`Rezervă minimă (${newSolution.unit_of_measure})`}
            value={newSolution.minimum_reserve}
            onChange={(e) => setNewSolution({ ...newSolution, minimum_reserve: e.target.value })}
            min="0"
            step="0.01"
            title="Cantitatea minimă care trebuie să rămână ca rezervă. Soluția se va dezactiva automat când ajunge la această limită."
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
                <th>Status</th>
                <th>Nume</th>
                <th>Aviz/Lot</th>
                <th>Concentrație</th>
                <th>Ultima inregistrare</th>
                <th>Solutie </th>
                <th>Rezervă minimă</th>
                <th>Procentaj rămas</th>
                <th>Cantitate pe metru pătrat</th>
                <th>Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {filteredSolutions.map(solution => {
                const percentage = calculateRemainingPercentage(solution.initial_stock, solution.remaining_quantity);
                const isActive = solution.is_active !== false; // Default to true if undefined
                const minimumReserve = solution.minimum_reserve || 0;
                const remainingQuantity = solution.remaining_quantity || 0;
                const isNearReserve = remainingQuantity <= minimumReserve * 1.2 && remainingQuantity > minimumReserve;
                const isAtReserve = remainingQuantity <= minimumReserve;
                
                return (
                  <tr key={solution.id} className={`${!isActive ? 'inactive-row' : ''} ${isAtReserve ? 'at-reserve-row' : isNearReserve ? 'near-reserve-row' : ''}`}>
                    <td>
                      <span className={`status-badge ${isActive ? 'active' : 'inactive'}`}>
                        {isActive ? '✓ Activ' : '✗ Inactiv'}
                      </span>
                    </td>
                    <td>{solution.name}</td>
                    <td>{solution.lot}</td>
                    <td>{solution.concentration}</td>
                    <td>{solution.initial_stock} {solution.unit_of_measure}</td>
                    <td>
                     {solution.total_quantity} {solution.unit_of_measure}
                    </td>
                    <td>
                      <span className={`reserve-indicator ${isAtReserve ? 'at-reserve' : isNearReserve ? 'near-reserve' : ''}`}>
                        {minimumReserve} {solution.unit_of_measure}
                        {isAtReserve && ' ⚠️'}
                        {isNearReserve && ' ⚡'}
                      </span>
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
                      <button 
                        className={isActive ? 'btn-deactivate' : 'btn-activate'}
                        onClick={() => handleToggleActive(solution.id, isActive)}
                        title={isActive ? 'Dezactivează substanța' : 'Activează substanța'}
                      >
                        {isActive ? '🔴 Dezactivează' : '🟢 Activează'}
                      </button>
                      <button onClick={() => handleEditSolution(solution)}>
                        ✏️ Editează
                      </button>
                      <button 
                        className="btn-delete"
                        onClick={() => handleDeleteSolution(solution.id)}
                      >
                        🗑️ Șterge
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