import React, { useState, useEffect } from 'react';
import supabase from '../../supabaseClient';
import './SolutionManagement.css';

export const updateRemainingQuantities = async (operations) => {
  console.log('updateRemainingQuantities called with operations:', operations);
  try {
    for (const operation of operations) {
      const { solutionId, quantity, beneficiar, lot, created_at } = operation;
      const { data, error } = await supabase
        .from('solutions')
        .select('remaining_quantity, minimum_reserve, name')
        .eq('id', solutionId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch remaining quantity: ${error.message}`);
      }

      const newRemainingQuantity = (data.remaining_quantity || 0) - quantity;
      const minimumReserve = data.minimum_reserve || 0;

      const shouldDeactivate = newRemainingQuantity <= minimumReserve;

      const updateData = {
        remaining_quantity: newRemainingQuantity
      };

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

      // Record the exit (ieșire) in intrari_solutie so we have a movement history
      try {
        const intrareRecord = {
          solution_id: solutionId,
          quantity: quantity,
          previous_stock: data.remaining_quantity || 0,
          post_stock: newRemainingQuantity,
          tip: 'Ieșire',
          beneficiar: beneficiar || null,
          lot: lot || null,
          created_at: created_at || new Date().toISOString()
        };

        // Try inserting with post_stock first. If the column doesn't exist, retry without it
        console.log('Inserting intrari_solutie record:', intrareRecord);
        const res = await supabase.from('intrari_solutie').insert([intrareRecord]);
        console.log('Supabase insert result:', res);
        if (res.error) {
          const msg = String(res.error.message || res.error);
          // detect missing column error (Postgres error text may vary)
          if (msg.toLowerCase().includes('column "post_stock"') || msg.toLowerCase().includes('column post_stock')) {
            // remove post_stock and retry
            const { post_stock, ...withoutPost } = intrareRecord;
            console.log('Retrying insert without post_stock:', withoutPost);
            const retry = await supabase.from('intrari_solutie').insert([withoutPost]);
            console.log('Supabase retry result:', retry);
            if (retry.error) {
              console.error('Retry insert without post_stock failed:', retry.error);
            } else {
              console.log('Inserted intrari_solutie record (without post_stock) successfully:', retry.data);
            }
          } else {
            console.error('Failed to insert intrari_solutie record for ieșire:', res.error);
          }
        } else {
          console.log('Inserted intrari_solutie record successfully:', res.data);
        }
      } catch (e) {
        console.error('Failed to insert intrari_solutie record for ieșire (exception):', e);
        // don't throw — we already updated the solution stock; just log the issue
      }

      console.log(`Updated remaining quantity for solution ${solutionId}: ${newRemainingQuantity}`);

      if (shouldDeactivate) {
        // notify user once; in UI contexts you might prefer non-blocking notifications
        alert(`⚠️ ATENȚIE: Soluția "${data.name}" a atins rezerva minimă (${minimumReserve}) și a fost dezactivată automat!`);
      }
    }
  } catch (error) {
    console.error('Error updating remaining quantities:', error);
    throw error;
  }
};

const calculateRemainingPercentage = (initial, remaining) => {
  const init = parseFloat(initial) || 0;
  const rem = parseFloat(remaining) || 0;
  if (init <= 0) return 0;
  const pct = Math.round((rem / init) * 100);
  return Math.max(0, Math.min(100, pct));
};

const SolutionManagement = () => {
  const [solutions, setSolutions] = useState([]);
  const [intrariHistory, setIntrariHistory] = useState({}); // { solutionId: [intrari] }
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
      setLoading(false);
      return;
    }

    // Deactivate low stock if needed
    await checkAndDeactivateLowStock(data || []);

    // reload after potential updates
    const { data: updatedData, error: err2 } = await supabase
      .from('solutions')
      .select('*');
    if (err2) {
      console.error('Error reloading solutions:', err2);
      setSolutions(data || []);
    } else {
      setSolutions(updatedData || []);
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

        if (isActive && remainingQuantity <= minimumReserve) {
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

  useEffect(() => {
    const fetchAllIntrari = async () => {
      const history = {};
      for (const sol of solutions) {
        try {
          history[sol.id] = await fetchIntrariForSolution(sol.id);
        } catch (e) {
          history[sol.id] = [];
        }
      }
      setIntrariHistory(history);
    };
    if (solutions.length > 0) fetchAllIntrari();
  }, [solutions]);

  const handleToggleForm = () => {
    setShowForm(!showForm);
  };

  const handleAddSolution = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const stock = parseFloat(newSolution.stock);
      const quantityPerSqm = parseFloat(newSolution.quantity_per_sqm);

      if (isNaN(stock) || isNaN(quantityPerSqm)) {
        console.error('Invalid numeric values for stock or quantity per sqm');
        setLoading(false);
        return;
      }

      const minimumReserve = parseFloat(newSolution.minimum_reserve) || 0;
      const shouldBeActive = stock > minimumReserve;

      if (!shouldBeActive && !editingSolution) {
        const confirmAdd = window.confirm(
          `⚠️ ATENȚIE!\n\nStocul introdus (${stock} ${newSolution.unit_of_measure}) este mai mic sau egal cu rezerva minimă (${minimumReserve} ${newSolution.unit_of_measure}).\n\nSoluția va fi adăugată ca INACTIVĂ.\n\nDoriți să continuați?`
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
        // update existing
        const { data: prevData } = await supabase
          .from('solutions')
          .select('total_quantity, total_intrari')
          .eq('id', editingSolution)
          .single();
        const previousStock = prevData ? parseFloat(prevData.total_quantity || 0) : 0;
        const previousIntrari = prevData ? parseFloat(prevData.total_intrari || 0) : 0;

        await supabase
          .from('solutions')
          .update(solutionToSave)
          .eq('id', editingSolution);

        if (stock > previousStock) {
          const intrareAmount = stock - previousStock;
          const createdAt = new Date().toISOString();
          // Insert intrare record including post/edit stock (post_stock) and tip
          await supabase
            .from('intrari_solutie')
            .insert([{ 
              solution_id: editingSolution,
              quantity: intrareAmount,
              previous_stock: previousStock,
              post_stock: stock,
              tip: 'Intrare',
              lot: newSolution.lot || null,
              created_at: createdAt
            }]);
          await supabase
            .from('solutions')
            .update({ total_intrari: previousIntrari + intrareAmount })
            .eq('id', editingSolution);
        }
      } else {
        const result = await supabase
          .from('solutions')
          .insert([solutionToSave]);

        const inserted = result.data && result.data[0];
        if (inserted && inserted.id) {
          const newId = inserted.id;
          const createdAt = new Date().toISOString();
          await supabase
            .from('intrari_solutie')
            .insert([{ 
              solution_id: newId,
              quantity: stock,
              previous_stock: 0,
              post_stock: stock,
              tip: 'Intrare',
              lot: newSolution.lot || null,
              created_at: createdAt
            }]);
          await supabase
            .from('solutions')
            .update({ total_intrari: stock })
            .eq('id', newId);
        }
      }

      // refresh
      await fetchSolutions();
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
    } catch (err) {
      console.error('Error saving solution:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportSingleSolutionCSV = async (solution) => {
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const s = String(value);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const headers = ['Felul', 'Nr', 'Data', 'Intrari', 'Iesiri', 'Stoc', 'Beneficiar', 'Lot produs / Data expirare'];
    const rows = [headers];

    try {
      // fetch all movements (intrari + iesiri) for this solution
      const { data: intrari, error } = await supabase
        .from('intrari_solutie')
        .select('quantity, previous_stock, post_stock, created_at, tip, beneficiar, lot')
        .eq('solution_id', solution.id)
        .order('created_at', { ascending: true });

      if (intrari && !error) {
        intrari.forEach((intrare, i) => {
          const tip = (intrare.tip || '').toLowerCase();
          const isIntrare = tip === 'intrare';
          const intrariVal = isIntrare ? `${intrare.quantity} ${solution.unit_of_measure}` : '';
          const iesiriVal = !isIntrare ? `${intrare.quantity} ${solution.unit_of_measure}` : '';
          // prefer post_stock if available, else compute fallback
          let stocVal = '';
          if (intrare.post_stock !== undefined && intrare.post_stock !== null) {
            stocVal = `${intrare.post_stock} ${solution.unit_of_measure}`;
          } else {
            const prev = parseFloat(intrare.previous_stock || 0);
            const q = parseFloat(intrare.quantity || 0);
            stocVal = isIntrare ? `${(prev + q)} ${solution.unit_of_measure}` : `${Math.max(0, prev - q)} ${solution.unit_of_measure}`;
          }

          rows.push([
            isIntrare ? 'Intrare' : 'Ieșire',
            i + 1,
            new Date(intrare.created_at).toLocaleDateString('ro-RO'),
            intrariVal,
            iesiriVal,
            stocVal,
            // only populate beneficiar for iesire
            (!isIntrare && intrare.beneficiar) ? intrare.beneficiar : '',
            intrare.lot || solution.lot || ''
          ]);
        });
      }
    } catch (e) {
      console.error('Error fetching intrari for single solution:', e);
    }

    const csv = rows.map(r => r.map(escapeCSV).join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Fisa_Magazie_${(solution.name || 'solutie').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToCSV = async () => {
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const s = String(value);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const now = new Date();
    const currentDate = now.toLocaleString('ro-RO');

    const headers = [
      'Nr. Crt.',
      'Status',
      'Nume Substanță',
      'Aviz/Lot',
      'Concentrație',
      'Stoc Inițial',
      'Cantitate Totală',
      'Cantitate Rămasă',
      'Cantitate Disponibilă',
      'Rezervă Minimă',
      'Procentaj Rămas',
      'Cantitate/mp',
      'Unitate Măsură'
    ];

    const infoLines = [
      ['FIȘĂ DE MAGAZIE - GESTIONARE SOLUȚII'],
      [`Data generării: ${currentDate}`],
      [`Total soluții: ${solutions.length}`],
      [`Soluții active: ${solutions.filter(s => s.is_active !== false).length}`],
      [`Soluții inactive: ${solutions.filter(s => s.is_active === false).length}`],
      [''],
      headers
    ];

    const dataRows = solutions.map((solution, idx) => {
      const percentage = calculateRemainingPercentage(solution.initial_stock, solution.remaining_quantity);
      const isActive = solution.is_active !== false;
      const minimumReserve = solution.minimum_reserve || 0;
      const remainingQuantity = solution.remaining_quantity || 0;
      const availableQuantity = remainingQuantity - minimumReserve;
      return [
        idx + 1,
        isActive ? 'Activ' : 'Inactiv',
        solution.name,
        solution.lot,
        solution.concentration,
        `${solution.initial_stock} ${solution.unit_of_measure}`,
        `${solution.total_quantity} ${solution.unit_of_measure}`,
        `${remainingQuantity} ${solution.unit_of_measure}`,
        `${availableQuantity.toFixed(2)} ${solution.unit_of_measure}`,
        `${minimumReserve} ${solution.unit_of_measure}`,
        `${percentage}%`,
        `${solution.quantity_per_sqm} ${solution.unit_of_measure}`,
        solution.unit_of_measure
      ];
    });

    let allRows = [...infoLines, ...dataRows];

    // add magazie details per solution
    const magazieHeader = ['Felul', 'Nr', 'Data', 'Intrari', 'Iesiri', 'Stoc', 'Beneficiar', 'Lot produs / Data expirare'];
    allRows.push(magazieHeader);

    for (const solution of solutions) {
      try {
        const { data: intrari, error } = await supabase
          .from('intrari_solutie')
          .select('quantity, previous_stock, post_stock, created_at, tip, beneficiar, lot')
          .eq('solution_id', solution.id)
          .order('created_at', { ascending: true });
        if (error) continue;
        (intrari || []).forEach((intrare, i) => {
          const tip = (intrare.tip || '').toLowerCase();
          const isIntrare = tip === 'intrare';
          const intrariVal = isIntrare ? `${intrare.quantity} ${solution.unit_of_measure}` : '';
          const iesiriVal = !isIntrare ? `${intrare.quantity} ${solution.unit_of_measure}` : '';
          let stocVal = '';
          if (intrare.post_stock !== undefined && intrare.post_stock !== null) {
            stocVal = `${intrare.post_stock} ${solution.unit_of_measure}`;
          } else {
            const prev = parseFloat(intrare.previous_stock || 0);
            const q = parseFloat(intrare.quantity || 0);
            stocVal = isIntrare ? `${(prev + q)} ${solution.unit_of_measure}` : `${Math.max(0, prev - q)} ${solution.unit_of_measure}`;
          }

          allRows.push([
            isIntrare ? 'Intrare' : 'Ieșire',
            i + 1,
            new Date(intrare.created_at).toLocaleDateString('ro-RO'),
            intrariVal,
            iesiriVal,
            stocVal,
            (!isIntrare && intrare.beneficiar) ? intrare.beneficiar : '',
            intrare.lot || solution.lot || ''
          ]);
        });
      } catch (e) {
        console.error('Error fetching intrari for export:', e);
      }
    }

    const csv = allRows.map(row => Array.isArray(row) ? row.map(escapeCSV).join(',') : escapeCSV(row)).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Fisa_Magazie_${new Date().toISOString().split('T')[0]}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    alert(`Fișa de magazie a fost exportată cu succes!`);
  };

  const handleToggleActive = async (id, currentlyActive) => {
    try {
      await supabase
        .from('solutions')
        .update({ is_active: !currentlyActive })
        .eq('id', id);
      await fetchSolutions();
    } catch (e) {
      console.error('Error toggling active state:', e);
    }
  };

  const handleEditSolution = (solution) => {
    setEditingSolution(solution.id);
    setNewSolution({
      name: solution.name || '',
      lot: solution.lot || '',
      concentration: solution.concentration || '',
      stock: solution.total_quantity ? String(solution.total_quantity) : '',
      initial_stock: solution.initial_stock || '',
      total_quantity: solution.total_quantity || '',
      remaining_quantity: solution.remaining_quantity || '',
      quantity_per_sqm: solution.quantity_per_sqm ? String(solution.quantity_per_sqm) : '',
      unit_of_measure: solution.unit_of_measure || 'ml',
      minimum_reserve: solution.minimum_reserve ? String(solution.minimum_reserve) : ''
    });
    setShowForm(true);
  };

  const handleDeleteSolution = async (id) => {
    const ok = window.confirm('Sigur doriți să ștergeți această soluție? Această acțiune este ireversibilă.');
    if (!ok) return;
    try {
      await supabase.from('solutions').delete().eq('id', id);
      await fetchSolutions();
    } catch (e) {
      console.error('Error deleting solution:', e);
    }
  };

  const filteredSolutions = solutions.filter(solution =>
    (solution.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (solution.lot || '').toLowerCase().includes(searchTerm.toLowerCase())
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
          onClick={exportToCSV}
          disabled={loading || solutions.length === 0}
          title="Exportă fișa de magazie în format CSV"
        >
          📊 Exportă Fișă de Magazie (CSV)
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
                const isActive = solution.is_active !== false;
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
                      <button
                        className="btn-export-single"
                        onClick={() => exportSingleSolutionCSV(solution)}
                        title="Exportă fișa de magazie pentru această soluție"
                      >
                        📄 Exportă fișa de magazie
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