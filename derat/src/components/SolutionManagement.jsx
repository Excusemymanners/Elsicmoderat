import React, { useState, useEffect } from 'react';
import supabase from '../../supabaseClient';
import './SolutionManagement.css';

export const updateRemainingQuantities = async (operations) => {
  console.log('updateRemainingQuantities called with operations:', operations);
  try {
    for (const op of operations) {
      let { solutionId, quantity, beneficiar, lot, created_at, numar_ordine, solutionLabel, name } = op;

      // If solutionId is missing, try to resolve it by matching name/label and lot
      if (!solutionId) {
        try {
          const searchNameRaw = (solutionLabel || name || '').trim();
          const searchName = searchNameRaw.replace(/\s*\(.*$/,'').trim(); // strip parentheses and trailing notes

          // 1) Try exact lot match first (lot is usually unique)
          if (lot) {
            const { data: byLot, error: byLotErr } = await supabase.from('solutions').select('id, remaining_quantity, minimum_reserve, name, lot').eq('lot', lot).limit(1).maybeSingle();
            if (!byLotErr && byLot && byLot.id) {
              solutionId = byLot.id;
              console.log(`Resolved solutionId by lot: ${solutionId} (lot='${lot}')`);
            } else {
              console.log(`No exact lot match for lot='${lot}'`);
            }
          }

          // 2) Try cleaned name match (ilike)
          if (!solutionId && searchName) {
            const { data: byName, error: byNameErr } = await supabase.from('solutions').select('id, remaining_quantity, minimum_reserve, name, lot').ilike('name', `%${searchName}%`).limit(1).maybeSingle();
            if (!byNameErr && byName && byName.id) {
              solutionId = byName.id;
              console.log(`Resolved solutionId by name ilike: ${solutionId} (searched '${searchNameRaw}' -> '${searchName}')`);
            } else {
              console.log(`No name ilike match for '${searchNameRaw}' (cleaned '${searchName}')`);
            }
          }

          // 3) Fallback: try lot-less search by partial label
          if (!solutionId && searchNameRaw) {
            const { data: byLabel, error: byLabelErr } = await supabase.from('solutions').select('id, remaining_quantity, minimum_reserve, name, lot').ilike('name', `%${searchNameRaw}%`).limit(1).maybeSingle();
            if (!byLabelErr && byLabel && byLabel.id) {
              solutionId = byLabel.id;
              console.log(`Resolved solutionId by raw label ilike: ${solutionId} (label='${searchNameRaw}')`);
            } else {
              console.log(`No raw label ilike match for '${searchNameRaw}'`);
            }
          }

          if (!solutionId) console.warn(`Could not resolve solutionId for '${searchNameRaw}' (lot='${lot}').`);
        } catch (e) {
          console.warn('Error resolving solutionId by name/lot:', e);
        }
      }

      // If still no solutionId, skip this operation (cannot update stock without linking to a solution)
      if (!solutionId) {
        console.warn('Skipping updateRemainingQuantities: no solutionId for operation', op);
        continue;
      }
      // If caller provided a process number (`numar_ordine`), skip any exit
      // that was already recorded for this solution and process to make this
      // operation idempotent per process.
      if (numar_ordine) {
        try {
          const { data: existing, error: existingErr } = await supabase
            .from('intrari_solutie')
            .select('id')
            .eq('solution_id', solutionId)
            .eq('numar_ordine', numar_ordine)
            .eq('tip', 'Ieșire')
            .limit(1);

          if (!existingErr && existing && existing.length > 0) {
            console.log(`Skipping duplicate exit: solution ${solutionId} already has an Ieșire for numar_ordine=${numar_ordine}`);
            continue; // skip this operation
          }
        } catch (e) {
          console.warn('Could not verify existing intrare for idempotency, proceeding:', e);
        }
      }
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
          numar_ordine: numar_ordine || null,
          created_at: created_at || new Date().toISOString()
        };
        
        // If this is an exit (Ieșire), attempt to populate expiration_date
        try {
          const { data: latestIntrare, error: latestErr } = await supabase
            .from('intrari_solutie')
            .select('expiration_date')
            .eq('solution_id', solutionId)
            .eq('tip', 'Intrare')
            .not('expiration_date', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          if (!latestErr && latestIntrare && latestIntrare.expiration_date) {
            intrareRecord.expiration_date = latestIntrare.expiration_date;
          }
        } catch (e) {
          // ignore failure to lookup latest expiration; continue without it
          console.warn('Could not fetch latest intrare expiration for exit:', e);
        }
        // Also attempt to populate supplier (furnizor) for exits from latest intrare
        try {
          const { data: latestIntrareSupplier, error: latestSupplierErr } = await supabase
            .from('intrari_solutie')
            .select('furnizor')
            .eq('solution_id', solutionId)
            .eq('tip', 'Intrare')
            .not('furnizor', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          if (!latestSupplierErr && latestIntrareSupplier && latestIntrareSupplier.furnizor) {
            intrareRecord.furnizor = latestIntrareSupplier.furnizor;
          }
        } catch (e) {
          console.warn('Could not fetch latest intrare supplier for exit:', e);
        }

        console.log('Inserting intrari_solutie record:', intrareRecord);
        let res = await supabase.from('intrari_solutie').insert([intrareRecord]).select('*');
        console.log('Supabase insert result:', res);

        if (res.error) {
          const msg = String(res.error.message || res.error).toLowerCase();

          // If numar_ordine column is missing, remove it and retry
          if (msg.includes('numar_ordine') ) {
            const { numar_ordine, ...withoutNumar } = intrareRecord;
            console.log('Retrying insert without numar_ordine:', withoutNumar);
            res = await supabase.from('intrari_solutie').insert([withoutNumar]).select('*');
            console.log('Supabase retry result (without numar_ordine):', res);
          }

          // If still error and mentions post_stock, remove post_stock and retry
          if (res.error) {
            const msg2 = String(res.error.message || res.error).toLowerCase();
            if (msg2.includes('post_stock')) {
              const { post_stock, ...withoutPost } = intrareRecord;
              delete withoutPost.numar_ordine;
              console.log('Retrying insert without post_stock (and numar_ordine):', withoutPost);
              const retry2 = await supabase.from('intrari_solutie').insert([withoutPost]).select('*');
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

const compareMovementsByProcessNumber = (left, right) => {
  const leftOrder = Number.parseInt(left?.numar_ordine ?? '', 10);
  const rightOrder = Number.parseInt(right?.numar_ordine ?? '', 10);

  if (Number.isFinite(leftOrder) && Number.isFinite(rightOrder) && leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  if (Number.isFinite(leftOrder)) return -1;
  if (Number.isFinite(rightOrder)) return 1;

  const leftTime = left?.created_at ? new Date(left.created_at).getTime() : 0;
  const rightTime = right?.created_at ? new Date(right.created_at).getTime() : 0;
  return leftTime - rightTime;
};

// Sort intrari_solutie movements by created_at (chronological order)
const compareIntrariByDate = (left, right) => {
  const leftTime = left?.created_at ? new Date(left.created_at).getTime() : 0;
  const rightTime = right?.created_at ? new Date(right.created_at).getTime() : 0;
  return leftTime - rightTime;
};

const SolutionManagement = () => {
  const MAX_QTY = 1e9; // safety cap for stock/quantities to prevent constraint violations
  const [solutions, setSolutions] = useState([]);
  const [intrariHistory, setIntrariHistory] = useState({}); // { solutionId: [intrari] }
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const todayISO = new Date().toISOString().split('T')[0];
  const [newSolution, setNewSolution] = useState({
    name: '',
    lot: '',
    furnizor: '',
    numar_factura: '',
    expiration_date: todayISO,
    concentration: '',
    stock: '',
    initial_stock: '',
    total_quantity: '',
    remaining_quantity: '',
    quantity_per_sqm: '',
    unit_of_measure: 'ml',
    minimum_reserve: '',
    // When editing an existing solution, decide whether `stock` input
    // should replace current remaining stock ('set') or add to it ('add')
    adjustmentType: 'set'
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
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
      const formData = new FormData(e.currentTarget);
      const submittedSolution = {
        name: String(formData.get('name') || '').trim(),
        lot: String(formData.get('lot') || '').trim(),
        furnizor: String(formData.get('furnizor') || '').trim(),
        numar_factura: String(formData.get('numar_factura') || '').trim(),
        expiration_date: String(formData.get('expiration_date') || '').trim(),
        concentration: String(formData.get('concentration') || '').trim(),
        stock: String(formData.get('stock') || '').trim(),
        adjustmentType: String(formData.get('adjustmentType') || 'set'),
        quantity_per_sqm: String(formData.get('quantity_per_sqm') || '').trim(),
        minimum_reserve: String(formData.get('minimum_reserve') || '').trim(),
        unit_of_measure: String(formData.get('unit_of_measure') || 'ml')
      };

      const stock = parseFloat(submittedSolution.stock);
      const quantityPerSqm = parseFloat(submittedSolution.quantity_per_sqm);

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

      const minimumReserve = parseFloat(submittedSolution.minimum_reserve) || 0;
      const shouldBeActive = stock > minimumReserve;

      if (!shouldBeActive && !editingSolution) {
        const confirmAdd = window.confirm(
          `⚠️ ATENȚIE!\n\nStocul introdus (${stock} ${submittedSolution.unit_of_measure}) este mai mic sau egal cu rezerva minimă (${minimumReserve} ${submittedSolution.unit_of_measure}).\n\nSoluția va fi adăugată ca INACTIVĂ.\n\nDoriți să continuați?`
        );
        if (!confirmAdd) {
          setLoading(false);
          return;
        }
      }

      const solutionToSave = {
        ...submittedSolution,
        initial_stock: stock,
        total_quantity: stock,
        remaining_quantity: stock,
        quantity_per_sqm: quantityPerSqm,
        minimum_reserve: minimumReserve,
        is_active: shouldBeActive
      ,
        expiration_date: submittedSolution.expiration_date ? new Date(submittedSolution.expiration_date).toISOString() : null
      };

      // Do not persist invoice number as a column on `solutions` table
      // (it belongs to `intrari_solutie`). Remove if present to avoid 400 errors.
      if (solutionToSave.numar_factura !== undefined) delete solutionToSave.numar_factura;
      // adjustmentType is UI-only, not a DB column
      if (solutionToSave.adjustmentType !== undefined) delete solutionToSave.adjustmentType;

      if (editingSolution) {
        // update existing
        const { data: prevData } = await supabase
          .from('solutions')
          .select('total_quantity, total_intrari, remaining_quantity')
          .eq('id', editingSolution)
          .single();
        const previousStock = prevData ? parseFloat(prevData.total_quantity || 0) : 0;
        const previousIntrari = prevData ? parseFloat(prevData.total_intrari || 0) : 0;
        const previousRemainingQty = prevData ? parseFloat(prevData.remaining_quantity || 0) : 0;

        // Special signal: if the form was submitted with `lot` === '0' or stock === 0,
        // treat this as a request to update only the latest `intrari_solutie` record
        // for this solution: update `furnizor`, `expiration_date` and `lot` if they differ.
        // If none of these three values changed, do nothing.
        try {
          const submittedStockNum = parseFloat(submittedSolution.stock || '0');
          const shouldPatchLastIntrare = String(submittedSolution.lot) === '0' || Number.isFinite(submittedStockNum) && submittedStockNum === 0;
          if (shouldPatchLastIntrare) {
            const { data: lastIntrare, error: lastErr } = await supabase
              .from('intrari_solutie')
              .select('*')
              .eq('solution_id', editingSolution)
              .eq('tip', 'Intrare')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (!lastErr && lastIntrare && lastIntrare.id) {
              const newFurnizor = (submittedSolution.furnizor || '').trim() || null;
              const newExpiration = submittedSolution.expiration_date ? new Date(submittedSolution.expiration_date).toISOString() : null;
              const newLot = (submittedSolution.lot && String(submittedSolution.lot) !== '0') ? String(submittedSolution.lot).trim() : (lastIntrare.lot || null);
              const newInvoice = (submittedSolution.numar_factura || '').trim() || null;

              // Determine if any of the three target fields actually changed compared to lastIntrare
              const furnizorChanged = (lastIntrare.furnizor || null) !== newFurnizor;
              const expirationChanged = (lastIntrare.expiration_date ? new Date(lastIntrare.expiration_date).toISOString() : null) !== newExpiration;
              const lotChanged = (lastIntrare.lot || null) !== newLot;
              const invoiceChanged = (lastIntrare.numar_factura || null) !== newInvoice;

              if (furnizorChanged || expirationChanged || lotChanged) {
                const patch = {};
                if (furnizorChanged) patch.furnizor = newFurnizor;
                if (expirationChanged) patch.expiration_date = newExpiration;
                if (lotChanged) patch.lot = newLot;
                if (invoiceChanged) patch.numar_factura = newInvoice;

                // 1) Update the last intrare (most recent Intrare)
                const upd = await supabase.from('intrari_solutie').update(patch).eq('id', lastIntrare.id);
                if (upd.error) {
                  console.error('Eroare la actualizarea ultimei intrări (patch):', upd.error);
                  alert('Eroare la actualizarea ultimei înregistrări: ' + (upd.error.message || upd.error));
                } else {
                  console.log('Ultima intrare actualizată cu:', patch);
                }

                // 2) Update `solutions` row so the main record shows the new values
                try {
                  const solPatch = {};
                  if (furnizorChanged) solPatch.furnizor = newFurnizor;
                  if (expirationChanged) solPatch.expiration_date = newExpiration;
                  if (lotChanged) solPatch.lot = newLot;
                  if (Object.keys(solPatch).length > 0) {
                    const solUpd = await supabase.from('solutions').update(solPatch).eq('id', editingSolution);
                    if (solUpd.error) {
                      console.error('Eroare la actualizarea solutions:', solUpd.error);
                      alert('Eroare la actualizarea înregistrării soluției: ' + (solUpd.error.message || solUpd.error));
                    } else {
                      console.log('Înregistrare solutions actualizată cu:', solPatch);
                    }
                  }
                } catch (solErr) {
                  console.error('Eroare la patch solutions:', solErr);
                }

                // 3) Update all previous exits (`Ieșire`) so CSV shows new supplier/expiration/lot
                try {
                  const exitsPatch = {};
                  if (furnizorChanged) exitsPatch.furnizor = newFurnizor;
                  if (expirationChanged) exitsPatch.expiration_date = newExpiration;
                  if (lotChanged) exitsPatch.lot = newLot;
                  if (invoiceChanged) exitsPatch.numar_factura = newInvoice;
                  if (Object.keys(exitsPatch).length > 0) {
                    const exitsUpd = await supabase
                      .from('intrari_solutie')
                      .update(exitsPatch)
                      .eq('solution_id', editingSolution)
                      .eq('tip', 'Ieșire')
                      .gte('created_at', lastIntrare.created_at);
                    if (exitsUpd.error) {
                      console.error('Eroare la actualizarea iesirilor:', exitsUpd.error);
                      alert('Eroare la actualizarea ieșirilor: ' + (exitsUpd.error.message || exitsUpd.error));
                    } else {
                      console.log(`Actualizate ${exitsUpd.data ? exitsUpd.data.length : 'n'} iesiri cu:`, exitsPatch);
                    }
                  }
                } catch (exErr) {
                  console.error('Eroare la patch iesiri:', exErr);
                }
              } else {
                console.log('Nicio modificare a furnizorului/expirării/lot; nu se face nimic.');
              }

              // Refresh data and exit early — this operation was intended only to patch last intrare + related records
              await fetchSolutions();
              setNewSolution({
                name: '',
                lot: '',
                furnizor: '',
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
              setLoading(false);
              return;
            }
          }
        } catch (patchErr) {
          console.error('Eroare în fluxul de patch pentru ultima intrare:', patchErr);
          // fallthrough to normal edit behaviour if patch fails
        }

        // Respectăm alegerea utilizatorului pentru tipul de actualizare
        let newRemainingQty;
        let stockDifference;
        
        if (submittedSolution.adjustmentType === 'add') {
          // Adăugare: cantitatea introdusă se adaugă la stocul actual
          newRemainingQty = previousRemainingQty + stock;
          stockDifference = stock;
          // Actualizăm și total_quantity când adăugăm
          solutionToSave.total_quantity = previousStock + stock;
        } else {
          // Setare (implicit): cantitatea introdusă înlocuiește stocul actual
          newRemainingQty = stock;
          stockDifference = stock - previousRemainingQty;
          // La setare, total_quantity devine valoarea nouă
          solutionToSave.total_quantity = stock;
        }
        
        // Actualizăm solutionToSave cu valorile corecte
        solutionToSave.remaining_quantity = Math.max(0, newRemainingQty);
        // initial_stock rămâne neschimbat la editare - nu îl suprascriu
        delete solutionToSave.initial_stock;
        if (editingSolution) {
          solutionToSave.is_active = prevData?.is_active !== false;
        }

        const updateRes = await supabase
          .from('solutions')
          .update(solutionToSave)
          .eq('id', editingSolution);
        console.log('Supabase update solutions result:', updateRes);
        if (updateRes.error) {
          console.error('Error updating solution:', updateRes.error);
          alert('Eroare la actualizarea soluției: ' + (updateRes.error.message || updateRes.error));
        }

        if (stockDifference > 0) {
          const intrareAmount = stockDifference;
          const createdAt = new Date().toISOString();
          // Insert intrare record including post/edit stock (post_stock) and tip
          const intrarePayload = {
            solution_id: editingSolution,
            quantity: intrareAmount,
            previous_stock: previousRemainingQty,
            post_stock: newRemainingQty,
            tip: 'Intrare',
            lot: submittedSolution.lot || null,
            furnizor: submittedSolution.furnizor || null,
            numar_factura: submittedSolution.numar_factura || null,
            expiration_date: submittedSolution.expiration_date ? new Date(submittedSolution.expiration_date).toISOString() : null,
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
              alert('Eroare la actualizarea total_intrari. Operațiunea a fost anulizată.');
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
            lot: submittedSolution.lot || null,
            furnizor: submittedSolution.furnizor || null,
            numar_factura: submittedSolution.numar_factura || null,
            expiration_date: submittedSolution.expiration_date ? new Date(submittedSolution.expiration_date).toISOString() : null,
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
        furnizor: '',
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
      // Use semicolon as delimiter for locales like ro-RO (Excel expects ';')
      if (s.includes(';') || s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const headers = ['Data', 'Nr', 'Fel', 'Intrari', 'Iesiri', 'Stoc', 'Beneficiar', 'Aviz/Lot', 'Furnizor', 'Data expirare'];
     const rows = [];
     // Insert solution name line + two blank lines at top as requested
     rows.push([`Nume substanta : ${solution.name || ''}`, '', '', '', '', '', '', '']);
     rows.push(['', '', '', '', '', '', '', '']);
     rows.push(['', '', '', '', '', '', '', '']);
    rows.push(headers);

    try {
      // Fetch movements primarily by solution_id to avoid omitting rows when lot/furnizor change.
      let intrari = null;
      try {
        if (solution.id) {
          console.log(`[exportSingleSolutionCSV] Fetching intrari for solution_id=${solution.id}`);
          const { data: bySolId, error: errSol } = await supabase
            .from('intrari_solutie')
            .select('quantity, previous_stock, post_stock, created_at, tip, beneficiar, lot, numar_ordine, numar_factura, expiration_date, furnizor')
            .eq('solution_id', solution.id)
            .order('created_at', { ascending: true });
          console.log(`[exportSingleSolutionCSV] solution_id query result: ${bySolId?.length || 0} rows, error: ${errSol?.message || 'none'}`);
          if (!errSol && bySolId && bySolId.length > 0) {
            intrari = bySolId;
          }
        }
      } catch (e) {
        console.warn('Error fetching by solution_id for export:', e);
      }

      // If no results by solution_id, fall back to lot -> furnizor as before
      if ((!intrari || intrari.length === 0) && solution.lot) {
        console.log(`[exportSingleSolutionCSV] No results for solution_id; trying lot='${solution.lot}'`);
        const { data: byLot, error: errLot } = await supabase
          .from('intrari_solutie')
          .select('quantity, previous_stock, post_stock, created_at, tip, beneficiar, lot, numar_ordine, numar_factura, expiration_date, furnizor')
          .eq('lot', solution.lot)
          .order('created_at', { ascending: true });
        console.log(`[exportSingleSolutionCSV] Lot query result: ${byLot?.length || 0} rows, error: ${errLot?.message || 'none'}`);
        if (!errLot && byLot && byLot.length > 0) intrari = byLot;
      }

      if ((!intrari || intrari.length === 0) && solution.furnizor) {
        console.log(`[exportSingleSolutionCSV] No results for solution_id/lot; trying furnizor='${solution.furnizor}'`);
        const { data: byFurn, error: errFurn } = await supabase
          .from('intrari_solutie')
          .select('quantity, previous_stock, post_stock, created_at, tip, beneficiar, lot, numar_ordine, numar_factura, expiration_date, furnizor')
          .ilike('furnizor', `%${solution.furnizor}%`)
          .order('created_at', { ascending: true });
        console.log(`[exportSingleSolutionCSV] Furnizor query result: ${byFurn?.length || 0} rows`);
        if (byFurn && byFurn.length > 0) intrari = byFurn;
      }

      if (intrari && intrari.length > 0) {
        console.log(`[exportSingleSolutionCSV] Found ${intrari.length} intrari for solution ${solution.id}, building CSV rows...`);
        const orderedIntrari = [...intrari].sort(compareIntrariByDate);

        // Carry-forward supplier and expiration_date: start from no supplier so we don't retroactively overwrite
        // past exits if `solutions.furnizor` is updated later. We only set supplier when an Intrare provides it.
        let currentSupplier = null;
        let currentExp = null;

        orderedIntrari.forEach((intrare, idx) => {
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

          // Update carried-forward values when a new one appears
          if (intrare.furnizor) currentSupplier = intrare.furnizor;
          if (intrare.expiration_date) currentExp = new Date(intrare.expiration_date);

          const lotDisplay = intrare.lot || solution.lot || '';
          const supplierDisplay = currentSupplier || intrare.furnizor || '';
          const expirationDisplay = currentExp ? currentExp.toLocaleDateString('ro-RO') : '';

          if (idx === 0) {
            console.log(`First row for solution ${solution.id}: tip=${tip}, qty=${intrare.quantity}, lot=${lotDisplay}`);
          }

          rows.push([
            new Date(intrare.created_at).toLocaleDateString('ro-RO'),
            nrVal,
            felVal,
            intrariVal,
            iesiriVal,
            stocVal,
            (!isIntrare && intrare.beneficiar) ? intrare.beneficiar : '',
            lotDisplay,
            supplierDisplay,
            expirationDisplay
          ]);
        });
        console.log(`Pushed ${orderedIntrari.length} rows to CSV for solution ${solution.id}`);
      } else {
        console.log(`[exportSingleSolutionCSV] No intrari found for solution ${solution.id} (lot='${solution.lot}', furnizor='${solution.furnizor}')`);
      }
    } catch (e) {
      console.error('Error fetching intrari for single solution:', e);
    }

    const csv = rows.map(r => r.map(escapeCSV).join(';')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + 'sep=;\n' + csv], { type: 'text/csv;charset=utf-8' });
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
      // consider semicolon and comma when deciding to quote
      if (s.includes(';') || s.includes(',') || s.includes('"') || s.includes('\n')) {
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
      'Lot produs',
      'Data expirare',
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

    const dataRows = [];
    for (let idx = 0; idx < solutions.length; idx++) {
      const solution = solutions[idx];
      const percentage = calculateRemainingPercentage(solution.initial_stock, solution.remaining_quantity);
      const isActive = solution.is_active !== false;
      const minimumReserve = solution.minimum_reserve || 0;
      const remainingQuantity = solution.remaining_quantity || 0;
      const availableQuantity = remainingQuantity - minimumReserve;

      // fetch latest expiration_date from intrari_solutie (prefer intrari values)
      let expirationDisplay = '';
      try {
        const { data: intrariDates, error: intrErr } = await supabase
          .from('intrari_solutie')
          .select('expiration_date')
          .eq('solution_id', solution.id)
          .not('expiration_date', 'is', null)
          .order('expiration_date', { ascending: false })
          .limit(1);
        if (!intrErr && intrariDates && intrariDates.length > 0) {
          expirationDisplay = new Date(intrariDates[0].expiration_date).toLocaleDateString('ro-RO');
        } else if (solution.expiration_date) {
          expirationDisplay = new Date(solution.expiration_date).toLocaleDateString('ro-RO');
        }
      } catch (e) {
        console.error('Error fetching latest expiration for solution summary:', solution.id, e);
        if (solution.expiration_date) expirationDisplay = new Date(solution.expiration_date).toLocaleDateString('ro-RO');
      }

      dataRows.push([
        idx + 1,
        isActive ? 'Activ' : 'Inactiv',
        solution.name,
        solution.lot,
        expirationDisplay,
        solution.concentration,
        `${solution.initial_stock} ${solution.unit_of_measure}`,
        `${solution.total_quantity} ${solution.unit_of_measure}`,
        `${remainingQuantity} ${solution.unit_of_measure}`,
        `${availableQuantity.toFixed(2)} ${solution.unit_of_measure}`,
        `${minimumReserve} ${solution.unit_of_measure}`,
        `${percentage}%`,
        `${solution.quantity_per_sqm} ${solution.unit_of_measure}`,
        solution.unit_of_measure
      ]);
    }

    let allRows = [...infoLines, ...dataRows];

    // add magazie details per solution (header declared once; we'll insert it per-solution)
    const magazieHeader = ['Data', 'Nr', 'Fel', 'Intrari', 'Iesiri', 'Stoc', 'Beneficiar', 'Aviz/Lot', 'Furnizor', 'Data expirare'];

    // For each solution block, add solution name row + two blank rows before movements
    for (const solution of solutions) {
      console.log(`[exportToCSV LOOP] Processing solution: id=${solution.id}, name='${solution.name}', lot='${solution.lot}', furnizor='${solution.furnizor}'`);
      
      // add solution label row + two blank rows before this solution's movements, then the magazie header
      allRows.push([`Nume substanta : ${solution.name || ''}`, '', '', '', '', '', '', '']);
      allRows.push(['', '', '', '', '', '', '', '']);
      allRows.push(['', '', '', '', '', '', '', '']);
      allRows.push(magazieHeader);
      try {
        // Primary: fetch by LOT (most reliable key for intrari_solutie)
        let intrari = null;
        
        if (solution.lot) {
          console.log(`[exportToCSV] Fetching intrari for solution ${solution.id} by lot='${solution.lot}'`);
          const { data: byLot, error: errLot } = await supabase
            .from('intrari_solutie')
            .select('quantity, previous_stock, post_stock, created_at, tip, beneficiar, lot, numar_ordine, numar_factura, expiration_date, furnizor')
            .eq('lot', solution.lot)
            .order('created_at', { ascending: true });
          console.log(`[exportToCSV] Lot result: ${byLot?.length || 0} rows`);
          if (byLot && byLot.length > 0) {
            intrari = byLot;
          }
        }

        // Fallback 1: try by furnizor
        if ((!intrari || intrari.length === 0) && solution.furnizor) {
          console.log(`[exportToCSV] No lot match; trying furnizor='${solution.furnizor}'`);
          const { data: byFurn, error: errFurn } = await supabase
            .from('intrari_solutie')
            .select('quantity, previous_stock, post_stock, created_at, tip, beneficiar, lot, numar_ordine, numar_factura, expiration_date, furnizor')
            .ilike('furnizor', `%${solution.furnizor}%`)
            .order('created_at', { ascending: true });
          console.log(`[exportToCSV] Furnizor query result: ${byFurn?.length || 0} rows, error: ${errFurn?.message || 'none'}`);
          if (byFurn && byFurn.length > 0) {
            intrari = byFurn;
          }
        }

        // Fallback 2: try by solution_id
        if ((!intrari || intrari.length === 0)) {
          console.log(`[exportToCSV] No lot/furnizor match; trying solution_id=${solution.id}`);
          const { data: bySolId, error: errSol } = await supabase
            .from('intrari_solutie')
            .select('quantity, previous_stock, post_stock, created_at, tip, beneficiar, lot, numar_ordine, numar_factura, expiration_date, furnizor')
            .eq('solution_id', solution.id)
            .order('created_at', { ascending: true });
          console.log(`[exportToCSV] solution_id query result: ${bySolId?.length || 0} rows, error: ${errSol?.message || 'none'}`);
          if (bySolId && bySolId.length > 0) {
            intrari = bySolId;
          }
        }

        if (!intrari || intrari.length === 0) {
          console.log(`[exportToCSV] ⚠️ No intrari found for solution ${solution.id} after all lookups (lot='${solution.lot}', furnizor='${solution.furnizor}')`);
          continue;
        }

        const orderedIntrari = [...intrari].sort(compareIntrariByDate);
        // Carry-forward supplier and expiration_date within each solution block
        // Start from null so we don't retroactively apply solution-level supplier to past movements
        let currentSupplier = null;
        let currentExp = null;

        orderedIntrari.forEach((intrare, i) => {
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

          // Update carried-forward values when a new one appears
          if (intrare.furnizor) currentSupplier = intrare.furnizor;
          if (intrare.expiration_date) currentExp = new Date(intrare.expiration_date);

          const lotDisplay = intrare.lot || solution.lot || '';
          const supplierDisplay = currentSupplier || intrare.furnizor || '';
          const expirationDisplay = currentExp ? currentExp.toLocaleDateString('ro-RO') : '';

          allRows.push([
            new Date(intrare.created_at).toLocaleDateString('ro-RO'),
            nrVal,
            felVal,
            intrariVal,
            iesiriVal,
            stocVal,
            (!isIntrare && intrare.beneficiar) ? intrare.beneficiar : '',
            lotDisplay,
            supplierDisplay,
            expirationDisplay
          ]);
        });
      } catch (e) {
        console.error('Error fetching intrari for export:', e);
      }
    }

  const csv = allRows.map(row => Array.isArray(row) ? row.map(escapeCSV).join(';') : escapeCSV(row)).join('\n');
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + 'sep=;\n' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Fisa_Magazie_${new Date().toISOString().split('T')[0]}_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  alert(`Fișa de magazie a fost exportată cu succes!`);
  };

  const releaseSolution = async (solution) => {
    if (!window.confirm(`Ești sigur că vrei să eliberezi soluția "${solution.name}"? Aceasta va șterge toate mișcările de stoc pentru această soluție.`)) {
      return;
    }

    setLoading(true);
    try {
      const { data: deletedRows, error: deleteError } = await supabase
        .from('intrari_solutie')
        .delete()
        .eq('solution_id', solution.id)
        .select('id');

      if (deleteError) {
        console.error('Error deleting intrari:', deleteError);
        alert('Eroare la ștergerea mișcărilor de stoc.');
        return;
      }

      const deletedCount = deletedRows?.length || 0;
      console.log(`✅ ${deletedCount} mișcări de stoc au fost șterse pentru soluția "${solution.name}".`);

      alert(`✅ Soluția "${solution.name}" a fost eliberată. Au fost șterse ${deletedCount} mișcări de stoc.`);
      await fetchSolutions(); // Reload to reflect changes
    } catch (error) {
      console.error('Error releasing solution:', error);
      alert('Eroare la eliberarea soluției: ' + error.message);
    } finally {
      setLoading(false);
    }
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
      furnizor: solution.furnizor || '',
      expiration_date: solution.expiration_date ? new Date(solution.expiration_date).toISOString().split('T')[0] : '',
      concentration: solution.concentration || '',
      stock: solution.remaining_quantity ? String(solution.remaining_quantity) : '',
      initial_stock: solution.initial_stock || '',
      total_quantity: solution.total_quantity || '',
      remaining_quantity: solution.remaining_quantity || '',
      quantity_per_sqm: solution.quantity_per_sqm ? String(solution.quantity_per_sqm) : '',
      unit_of_measure: solution.unit_of_measure || 'ml',
      minimum_reserve: solution.minimum_reserve ? String(solution.minimum_reserve) : '',
      adjustmentType: 'set'
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
          <div className="form-group">
            <label>Nume substanță *</label>
            <input
                name="name"
              type="text"
              placeholder="ex. Spinosad, Neem, etc."
              value={newSolution.name}
              onChange={(e) => setNewSolution({ ...newSolution, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Aviz/Lot *</label>
            <input
                name="lot"
              type="text"
              placeholder="ex. AVIZ-2024-001, LOT-12345"
              value={newSolution.lot}
              onChange={(e) => setNewSolution({ ...newSolution, lot: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Furnizor *</label>
            <input
                name="furnizor"
              type="text"
              placeholder="ex. BASF, Syngenta, etc."
              value={newSolution.furnizor}
              onChange={(e) => setNewSolution({ ...newSolution, furnizor: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Număr factură *</label>
            <input
                name="numar_factura"
              type="text"
              placeholder="ex. FAC-2024-001"
              value={newSolution.numar_factura}
              onChange={(e) => setNewSolution({ ...newSolution, numar_factura: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Data expirare *</label>
            <input
                name="expiration_date"
              type="date"
              value={newSolution.expiration_date}
              onChange={(e) => setNewSolution({ ...newSolution, expiration_date: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Concentrație *</label>
            <input
                name="concentration"
              type="text"
              placeholder="ex. 5%, 10 g/L, etc."
              value={newSolution.concentration}
              onChange={(e) => setNewSolution({ ...newSolution, concentration: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Cantitate rămasă ({newSolution.unit_of_measure}) *</label>
            <input
                name="stock"
              type="text"
              placeholder="ex. 1000, 500.5, etc."
              value={newSolution.stock}
              onChange={(e) => setNewSolution({ ...newSolution, stock: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Tip actualizare</label>
            <select
                name="adjustmentType"
              value={newSolution.adjustmentType}
              onChange={(e) => setNewSolution({ ...newSolution, adjustmentType: e.target.value })}
            >
              <option value="set">Setează cantitate (înlocuiește stocul)</option>
              <option value="add">Adaugă la cantitate (crește stocul)</option>
            </select>
            <small>La edit: alege dacă valoarea introdusă în "Cantitate rămasă" înlocuiește stocul sau reprezintă o cantitate adăugată.</small>
          </div>
          <div className="form-group">
            <label>Cantitate pe metru pătrat ({newSolution.unit_of_measure}) *</label>
            <input
                name="quantity_per_sqm"
              type="text"
              placeholder="ex. 10, 5.5, etc."
              value={newSolution.quantity_per_sqm}
              onChange={(e) => setNewSolution({ ...newSolution, quantity_per_sqm: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Rezervă minimă ({newSolution.unit_of_measure}) *</label>
            <input
                name="minimum_reserve"
              type="number"
              placeholder="ex. 100"
              value={newSolution.minimum_reserve}
              onChange={(e) => setNewSolution({ ...newSolution, minimum_reserve: e.target.value })}
              min="0"
              step="0.01"
              title="Cantitatea minimă care trebuie să rămână ca rezervă. Soluția se va dezactiva automat când ajunge la această limită."
              required
            />
          </div>
          <div className="form-group">
            <label>Unitate de măsură *</label>
            <select
                name="unit_of_measure"
              value={newSolution.unit_of_measure}
              onChange={(e) => setNewSolution({ ...newSolution, unit_of_measure: e.target.value })}
              required
            >
              <option value="ml">Mililitri (ml)</option>
              <option value="g">Grame (g)</option>
            </select>
          </div>
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
                      {solution.remaining_quantity} {solution.unit_of_measure}
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
                        {!isMobile && (
                          <button
                            className="btn-danger"
                            onClick={() => releaseSolution(solution)}
                            title="Eliberează soluția - descarcă CSV și șterge mișcări"
                          >
                            🔑 Eliberare
                          </button>
                        )}
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
                          <div>{solution.remaining_quantity} {solution.unit_of_measure}</div>
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
                            {isMobile && (
                              <button tabIndex={-1} className="btn-danger" onClick={() => releaseSolution(solution)}>🔑 Eliberare</button>
                            )}
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