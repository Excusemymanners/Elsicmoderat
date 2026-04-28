// src/components/receptionNumber.js
import supabase from '../../supabaseClient';

// Incrementează numărul de recepție
export const addVerbalProcess = async (verbalProcess) => {
    // Try inserting the verbal process. If the DB schema doesn't include
    // `custody_items` (or other unexpected columns), catch that specific
    // error, remove the field and retry so the rest of the data is saved.
    let { data, error } = await supabase
        .from('lucrari')
        .insert([verbalProcess], { returning: 'representation' });

    if (error) {
        console.error('Error inserting verbal process:', error);

        const message = String(error.message || '').toLowerCase();
        // Detect missing column in PostgREST schema cache (PGRST204)
        if (message.includes("could not find the 'custody_items' column") || message.includes('pgrst204')) {
            console.warn('Removing `custody_items` from payload and retrying insert.');
            const sanitized = { ...verbalProcess };
            delete sanitized.custody_items;

            const retry = await supabase
                .from('lucrari')
                .insert([sanitized], { returning: 'representation' });

            if (retry.error) {
                console.error('Retry insert without custody_items failed:', retry.error);
                return retry;
            }

            console.log('Inserted verbal process (without custody_items):', retry.data);
            return retry;
        }
    }

    if (!error) console.log('Inserted verbal process into `lucrari`:', data);
    return { data, error };
};