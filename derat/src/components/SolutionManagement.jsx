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
          numar_ordine: operation?.numar_ordine || null,
          created_at: created_at || new Date().toISOString()
        };

        // Attempt insert. If DB doesn't have some optional columns, retry removing them.
        console.log('Inserting intrari_solutie record:', intrareRecord);
        let res = await supabase.from('intrari_solutie').insert([intrareRecord]);
        console.log('Supabase insert result:', res);

        if (res.error) {
          const msg = String(res.error.message || res.error).toLowerCase();

          // If numar_ordine column is missing, remove it and retry
          if (msg.includes('column "numar_ordine"') || msg.includes('column numar_ordine') || msg.includes('numar_ordine')) {
            const { numar_ordine, ...withoutNumar } = intrareRecord;
            console.log('Retrying insert without numar_ordine:', withoutNumar);
            res = await supabase.from('intrari_solutie').insert([withoutNumar]);
            console.log('Supabase retry result (without numar_ordine):', res);
          }

          // If still error and mentions post_stock, remove post_stock and retry
          if (res.error) {
            const msg2 = String(res.error.message || res.error).toLowerCase();
            if (msg2.includes('column "post_stock"') || msg2.includes('column post_stock') || msg2.includes('post_stock')) {
              const { post_stock, ...withoutPost } = intrareRecord;
              // also remove numar_ordine if it exists (in case first retry didn't run)
              delete withoutPost.numar_ordine;
              console.log('Retrying insert without post_stock (and numar_ordine):', withoutPost);
              const retry2 = await supabase.from('intrari_solutie').insert([withoutPost]);
              console.log('Supabase retry result (without post_stock):', retry2);
              if (retry2.error) {
                console.error('Retry insert without post_stock failed:', retry2.error);
              } else {
                console.log('Inserted intrari_solutie record (without post_stock) successfully:', retry2.data);
                res = retry2;
              }
            }
          }

          if (res.error) {
            console.error('Failed to insert intrari_solutie record for ieșire:', res.error);
          } else {
            console.log('Inserted intrari_solutie record successfully after retry:', res.data);
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
  const MAX_QTY = 1e9; // safety cap for stock/quantities to prevent constraint violations
  const [solutions, setSolutions] = useState([]);
  const [intrariHistory, setIntrariHistory] = useState({}); // { solutionId: [intrari] }
  const todayISO = new Date().toISOString().split('T')[0];
  const [newSolution, setNewSolution] = useState({
    name: '',
    lot: '',
    numar_factura: '',
    expiration_date: todayISO,
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

      // Basic validation to avoid inserting absurd values that violate DB constraints
      if (!Number.isFinite(stock) || stock < 0 || stock > MAX_QTY) {
        alert('Valoare cantitate invalidă. Introdu o valoare între 0 și ' + MAX_QTY + '.');
        setLoading(false);
        return;
      }
      if (!Number.isFinite(quantityPerSqm) || quantityPerSqm < 0 || quantityPerSqm > MAX_QTY) {
        alert('Valoare cantitate/mp invalidă. Introdu o valoare între 0 și ' + MAX_QTY + '.');
        setLoading(false);
        return;
      }

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
      ,
        expiration_date: newSolution.expiration_date ? new Date(newSolution.expiration_date).toISOString() : null
      };

      // Do not persist invoice number as a column on `solutions` table
      // (it belongs to `intrari_solutie`). Remove if present to avoid 400 errors.
      if (solutionToSave.numar_factura !== undefined) delete solutionToSave.numar_factura;

      if (editingSolution) {
        // update existing
        const { data: prevData } = await supabase
          .from('solutions')
          .select('total_quantity, total_intrari')
          .eq('id', editingSolution)
          .single();
        const previousStock = prevData ? parseFloat(prevData.total_quantity || 0) : 0;
        const previousIntrari = prevData ? parseFloat(prevData.total_intrari || 0) : 0;

        const updateRes = await supabase
          .from('solutions')
          .update(solutionToSave)
          .eq('id', editingSolution);
        console.log('Supabase update solutions result:', updateRes);
        if (updateRes.error) {
          console.error('Error updating solution:', updateRes.error);
          alert('Eroare la actualizarea soluției: ' + (updateRes.error.message || updateRes.error));
        }

        if (stock > previousStock) {
          const intrareAmount = stock - previousStock;
          const createdAt = new Date().toISOString();
          // Insert intrare record including post/edit stock (post_stock) and tip
          const intrarePayload = {
            solution_id: editingSolution,
            quantity: intrareAmount,
            previous_stock: previousStock,
            post_stock: stock,
            tip: 'Intrare',
            lot: newSolution.lot || null,
            numar_factura: newSolution.numar_factura || null,
            expiration_date: newSolution.expiration_date ? new Date(newSolution.expiration_date).toISOString() : null,
            created_at: createdAt
          };
          console.log('Preparing intrari_solutie (edit) payload:', intrarePayload);
          // sanitize numeric inputs (strip thousand separators/spaces) before calculating totals
          const sanitizeNumber = (v) => {
            if (v === null || v === undefined) return 0;
            try {
              const s = String(v).replace(/[,\s]/g, '');
              return parseFloat(s) || 0;
            } catch (e) {
              return 0;
            }
          };

          const prevIntrSan = sanitizeNumber(previousIntrari);
          const intrareAmtSan = sanitizeNumber(intrareAmount);
          const precomputedNewTotal = prevIntrSan + intrareAmtSan;
          console.log('Pre-insert total_intrari check (edit):', { previousIntrari, intrareAmount, prevIntrSan, intrareAmtSan, precomputedNewTotal, MAX_QTY });

          // Validate before performing the insert to avoid needless partial writes and rollbacks
          if (!Number.isFinite(precomputedNewTotal) || precomputedNewTotal < 0) {
            alert('Eroare: total_intrari calculat este invalid. Verifică valorile introduse.');
            setLoading(false);
            return;
          }
          if (precomputedNewTotal > MAX_QTY) {
            alert(`Eroare: total_intrari calculat (${precomputedNewTotal}) depășește limita permisă (${MAX_QTY}). Operațiunea a fost anulată.`);
            setLoading(false);
            return;
          }

          // request returning representation to obtain inserted id for rollback if needed
          console.log('Inserting intrari_solutie (edit) payload now that pre-check passed');
          const intrareRes = await supabase.from('intrari_solutie').insert([intrarePayload]).select('*');
          console.log('Supabase insert intrari_solutie result (edit):', intrareRes);
          if (intrareRes.error) {
            console.error('Error inserting intrari_solutie (edit):', intrareRes.error);
            alert('Eroare la înregistrarea intrării (edit): ' + (intrareRes.error.message || intrareRes.error));
          } else {
            const insertedIntrare = intrareRes.data && intrareRes.data[0];
            // now update total_intrari; if that update fails, rollback the intrare we just created
            try {
              const newTotalIntrari = (parseFloat(previousIntrari) || 0) + (parseFloat(intrareAmount) || 0);
              console.log('total_intrari calculation:', { previousIntrari, intrareAmount, newTotalIntrari, MAX_QTY });

              // validate before attempting DB update
              if (!Number.isFinite(newTotalIntrari) || newTotalIntrari < 0) {
                console.error('Calculated total_intrari invalid (NaN or negative):', newTotalIntrari);
                throw new Error('Calculated total_intrari invalid: ' + newTotalIntrari);
              }

              if (newTotalIntrari > MAX_QTY) {
                console.warn('Calculated total_intrari exceeds MAX_QTY; aborting update to avoid DB constraint violation.', { newTotalIntrari, MAX_QTY });
                // attempt rollback of the inserted intrare
                if (insertedIntrare && insertedIntrare.id) {
                  try {
                    await supabase.from('intrari_solutie').delete().eq('id', insertedIntrare.id);
                    console.log('Rolled back inserted intrare id=', insertedIntrare.id);
                  } catch (delErr) {
                    console.error('Rollback delete failed:', delErr);
                  }
                }
                alert(`Eroare: total_intrari calculat (${newTotalIntrari}) depășește limita permisă (${MAX_QTY}). Operațiunea a fost anulată.`);
                setLoading(false);
                return;
              }

              const totRes = await supabase.from('solutions').update({ total_intrari: newTotalIntrari }).eq('id', editingSolution);
              console.log('Supabase update total_intrari result:', totRes);
              if (totRes.error) throw totRes.error;
            } catch (totErr) {
              console.error('Failed to update total_intrari after intrare insert:', totErr);
              // attempt rollback of the inserted intrare
              if (insertedIntrare && insertedIntrare.id) {
                try {
                  await supabase.from('intrari_solutie').delete().eq('id', insertedIntrare.id);
                  console.log('Rolled back inserted intrare id=', insertedIntrare.id);
                } catch (delErr) {
                  console.error('Rollback delete failed:', delErr);
                }
              }
              alert('Eroare la actualizarea total_intrari. Operațiunea a fost anulată.');
              setLoading(false);
              return;
            }
          }
        }
      } else {
        const result = await supabase
          .from('solutions')
          .insert([solutionToSave]).select('*');
        console.log('Supabase insert solutions result:', result);
        if (result.error) {
          console.error('Error inserting solution:', result.error);
          alert('Eroare la inserarea soluției: ' + (result.error.message || result.error));
          setLoading(false);
          return;
        }

        const inserted = result.data && result.data[0];
        if (inserted && inserted.id) {
          const newId = inserted.id;
          const createdAt = new Date().toISOString();
          const intrarePayload = {
            solution_id: newId,
            quantity: stock,
            previous_stock: 0,
            post_stock: stock,
            tip: 'Intrare',
            lot: newSolution.lot || null,
            numar_factura: newSolution.numar_factura || null,
            expiration_date: newSolution.expiration_date ? new Date(newSolution.expiration_date).toISOString() : null,
            created_at: createdAt
          };
          console.log('Preparing intrari_solutie (new) payload:', intrarePayload);
          // sanitize numeric inputs before calculating totals
          const sanitizeNumber = (v) => {
            if (v === null || v === undefined) return 0;
            try {
              const s = String(v).replace(/[,\s]/g, '');
              return parseFloat(s) || 0;
            } catch (e) {
              return 0;
            }
          };

          const stockSan = sanitizeNumber(stock);
          const precomputedNewTotalNew = stockSan;
          console.log('Pre-insert total_intrari check (new):', { stock, stockSan, precomputedNewTotalNew, MAX_QTY });
          if (!Number.isFinite(precomputedNewTotalNew) || precomputedNewTotalNew < 0) {
            alert('Eroare: total_intrari calculat este invalid pentru soluția nouă. Verifică valoarea stoc.');
            setLoading(false);
            return;
          }
          if (precomputedNewTotalNew > MAX_QTY) {
            alert(`Eroare: total_intrari calculat (${precomputedNewTotalNew}) depășește limita permisă (${MAX_QTY}). Operațiunea a fost anulată.`);
            setLoading(false);
            return;
          }

          console.log('Inserting intrari_solutie (new) payload now that pre-check passed');
          const intrareRes = await supabase.from('intrari_solutie').insert([intrarePayload]).select('*');
          console.log('Supabase insert intrari_solutie result (new):', intrareRes);
          if (intrareRes.error) {
            console.error('Error inserting intrari_solutie (new):', intrareRes.error);
            alert('Eroare la înregistrarea intrării (new): ' + (intrareRes.error.message || intrareRes.error));
          } else {
            const insertedIntrare = intrareRes.data && intrareRes.data[0];
            try {
              const newTotalIntrari = parseFloat(stock) || 0;
              console.log('total_intrari (new solution):', { stock, newTotalIntrari, MAX_QTY });
              if (!Number.isFinite(newTotalIntrari) || newTotalIntrari < 0) {
                throw new Error('Calculated total_intrari invalid: ' + newTotalIntrari);
              }
              if (newTotalIntrari > MAX_QTY) {
                console.warn('total_intrari for new solution exceeds MAX_QTY; aborting.', { newTotalIntrari, MAX_QTY });
                if (insertedIntrare && insertedIntrare.id) {
                  try {
                    await supabase.from('intrari_solutie').delete().eq('id', insertedIntrare.id);
                    console.log('Rolled back inserted intrare id=', insertedIntrare.id);
                  } catch (delErr) {
                    console.error('Rollback delete failed:', delErr);
                  }
                }
                alert(`Eroare: total_intrari calculat (${newTotalIntrari}) depășește limita permisă (${MAX_QTY}). Operațiunea a fost anulată.`);
                setLoading(false);
                return;
              }

              const totRes = await supabase.from('solutions').update({ total_intrari: newTotalIntrari }).eq('id', newId);
              console.log('Supabase update total_intrari result (new):', totRes);
              if (totRes.error) throw totRes.error;
            } catch (totErr) {
              console.error('Failed to update total_intrari after new intrare insert:', totErr);
              if (insertedIntrare && insertedIntrare.id) {
                try {
                  await supabase.from('intrari_solutie').delete().eq('id', insertedIntrare.id);
                  console.log('Rolled back inserted intrare id=', insertedIntrare.id);
                } catch (delErr) {
                  console.error('Rollback delete failed:', delErr);
                }
              }
              alert('Eroare la actualizarea total_intrari. Operațiunea a fost anulată.');
              setLoading(false);
              return;
            }
          }
        }
      }

      // refresh
      await fetchSolutions();
      setNewSolution({
        name: '',
        lot: '',
        numar_factura: '',
        expiration_date: todayISO,
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

     const headers = ['Data', 'Nr', 'Fel', 'Intrari', 'Iesiri', 'Stoc', 'Beneficiar', 'Lot produs / Data expirare'];
     const rows = [];
     // Insert solution name line + two blank lines at top as requested
     rows.push([`Nume substanta : ${solution.name || ''}`, '', '', '', '', '', '', '']);
     rows.push(['', '', '', '', '', '', '', '']);
     rows.push(['', '', '', '', '', '', '', '']);
    rows.push(headers);

    try {
      // fetch all movements (intrari + iesiri) for this solution
      let { data: intrari, error } = await supabase
        .from('intrari_solutie')
        .select('quantity, previous_stock, post_stock, created_at, tip, beneficiar, lot, numar_ordine, numar_factura, expiration_date')
        .eq('solution_id', solution.id)
        .order('created_at', { ascending: true });

      // If the DB doesn't have numar_ordine column, retry without it
      if (error) {
        console.warn('Select with numar_ordine failed, retrying without it:', error.message || error);
        const retry = await supabase
          .from('intrari_solutie')
          .select('quantity, previous_stock, post_stock, created_at, tip, beneficiar, lot')
          .eq('solution_id', solution.id)
          .order('created_at', { ascending: true });
        intrari = retry.data;
        error = retry.error;
      }

      if (intrari && !error) {
        let intrareCounter = 0;
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

          const invoiceNumber = intrare.numar_factura || '';
          const processNumber = intrare.numar_ordine || '';
          // For Intrare (Fact) show Nr = invoiceNumber; for Ieșire show Nr = processNumber
          const felVal = isIntrare ? 'Fact' : 'PV';
          const nrVal = isIntrare ? (invoiceNumber || '') : (processNumber || '');

          // For Intrare show "lot / data expirare" in the last column
          const expirationDisplay = intrare.expiration_date ? new Date(intrare.expiration_date).toLocaleDateString('ro-RO') : '';
          const lotDisplay = intrare.lot || solution.lot || '';
          const lastCol = isIntrare ? `${lotDisplay}${expirationDisplay ? ' / ' + expirationDisplay : ''}` : (intrare.lot || solution.lot || '');

          rows.push([
            new Date(intrare.created_at).toLocaleDateString('ro-RO'),
            nrVal,
            felVal,
            intrariVal,
            iesiriVal,
            stocVal,
            (!isIntrare && intrare.beneficiar) ? intrare.beneficiar : '',
            lastCol
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

    // add magazie details per solution (header declared once; we'll insert it per-solution)
    const magazieHeader = ['Data', 'Nr', 'Fel', 'Intrari', 'Iesiri', 'Stoc', 'Beneficiar', 'Lot produs / Data expirare'];

    // For each solution block, add solution name row + two blank rows before movements
    for (const solution of solutions) {
      // add solution label row + two blank rows before this solution's movements, then the magazie header
      allRows.push([`Nume substanta : ${solution.name || ''}`, '', '', '', '', '', '', '']);
      allRows.push(['', '', '', '', '', '', '', '']);
      allRows.push(['', '', '', '', '', '', '', '']);
      allRows.push(magazieHeader);
      try {
        const { data: intrari, error } = await supabase
          .from('intrari_solutie')
          .select('quantity, previous_stock, post_stock, created_at, tip, beneficiar, lot, numar_ordine, numar_factura, expiration_date')
          .eq('solution_id', solution.id)
          .order('created_at', { ascending: true });
        if (error) continue;
        let intrareCounter = 0;
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

          const invoiceNumber = intrare.numar_factura || '';
          const processNumber = intrare.numar_ordine || '';
          const felVal = isIntrare ? 'Fact' : 'PV';
          const nrVal = isIntrare ? (invoiceNumber || '') : (processNumber || '');

          const expirationDisplay = intrare.expiration_date ? new Date(intrare.expiration_date).toLocaleDateString('ro-RO') : '';
          const lotDisplay = intrare.lot || solution.lot || '';
          const lastCol = isIntrare ? `${lotDisplay}${expirationDisplay ? ' / ' + expirationDisplay : ''}` : (intrare.lot || solution.lot || '');

          allRows.push([
            new Date(intrare.created_at).toLocaleDateString('ro-RO'),
            nrVal,
            felVal,
            intrariVal,
            iesiriVal,
            stocVal,
            (!isIntrare && intrare.beneficiar) ? intrare.beneficiar : '',
            lastCol
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
      numar_factura: '',
      expiration_date: solution.expiration_date ? new Date(solution.expiration_date).toISOString().split('T')[0] : '',
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
            placeholder="Număr factură (opțional)"
            value={newSolution.numar_factura}
            onChange={(e) => setNewSolution({ ...newSolution, numar_factura: e.target.value })}
          />
          <input
            type="date"
            placeholder="Data expirare (opțional)"
            value={newSolution.expiration_date}
            onChange={(e) => setNewSolution({ ...newSolution, expiration_date: e.target.value })}
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
                    <td data-label="Status">
                      <span className={`status-badge ${isActive ? 'active' : 'inactive'}`}>
                        {isActive ? '✓ Activ' : '✗ Inactiv'}
                      </span>
                    </td>
                    <td data-label="Nume">{solution.name}</td>
                    <td data-label="Aviz/Lot">{solution.lot}</td>
                    <td data-label="Concentrație">{solution.concentration}</td>
                    <td data-label="Ultima înregistrare">{solution.initial_stock} {solution.unit_of_measure}</td>
                    <td data-label="Solutie">
                      {solution.total_quantity} {solution.unit_of_measure}
                    </td>
                    <td data-label="Rezervă minimă">
                      <span className={`reserve-indicator ${isAtReserve ? 'at-reserve' : isNearReserve ? 'near-reserve' : ''}`}>
                        {minimumReserve} {solution.unit_of_measure}
                        {isAtReserve && ' ⚠️'}
                        {isNearReserve && ' ⚡'}
                      </span>
                    </td>
                    <td data-label="Procentaj rămas">
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
                    <td data-label="Cantitate pe metru pătrat">{solution.quantity_per_sqm} {solution.unit_of_measure}</td>
                    <td data-label="Acțiuni">
                      <div className="action-buttons-cell">
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
                      </div>
                    </td>

                    {/* Mobile-only two-column card: labels left, values+buttons right */}
                    <td className="mobile-card" aria-hidden="true">
                      <div className="mobile-grid">
                        <div className="mobile-left">
                          <div>Status</div>
                          <div>Nume</div>
                          <div>Aviz/Lot</div>
                          <div>Concentrație</div>
                          <div>Ultima înregistrare</div>
                          <div>Soluție</div>
                          <div>Rezervă minimă</div>
                          <div>Procentaj rămas</div>
                          <div>Cantitate/mp</div>
                        </div>
                        <div className="mobile-right">
                          <div><span className={`status-badge ${isActive ? 'active' : 'inactive'}`}>{isActive ? '✓ Activ' : '✗ Inactiv'}</span></div>
                          <div>{solution.name}</div>
                          <div>{solution.lot}</div>
                          <div>{solution.concentration}</div>
                          <div>{solution.initial_stock} {solution.unit_of_measure}</div>
                          <div>{solution.total_quantity} {solution.unit_of_measure}</div>
                          <div><span className={`reserve-indicator ${isAtReserve ? 'at-reserve' : isNearReserve ? 'near-reserve' : ''}`}>{minimumReserve} {solution.unit_of_measure}</span></div>
                          <div>
                            <div className="progress-bar-container">
                              <div className="progress-bar" style={{width: `${percentage}%`, backgroundColor: percentage > 50 ? '#4CAF50' : percentage > 20 ? '#FFA500' : '#FF0000'}}>{percentage}%</div>
                            </div>
                          </div>
                          <div>{solution.quantity_per_sqm} {solution.unit_of_measure}</div>
                          <div className="mobile-actions">
                            <button tabIndex={-1} className={isActive ? 'btn-deactivate' : 'btn-activate'} onClick={() => handleToggleActive(solution.id, isActive)}>{isActive ? '🔴 Dezactivează' : '🟢 Activează'}</button>
                            <button tabIndex={-1} onClick={() => handleEditSolution(solution)}>✏️ Editează</button>
                            <button tabIndex={-1} className="btn-delete" onClick={() => handleDeleteSolution(solution.id)}>🗑️ Șterge</button>
                            <button tabIndex={-1} className="btn-export-single" onClick={() => exportSingleSolutionCSV(solution)}>📄 Exportă</button>
                          </div>
                        </div>
                      </div>
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