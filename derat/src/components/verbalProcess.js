// src/components/receptionNumber.js
import supabase from '../../supabaseClient';

// Incrementează numărul de recepție
export const addVerbalProcess = async (verbalProcess) => {
    const result = await supabase
        .from('lucrari')
        .insert([verbalProcess]);
    
    const { error } = result;
    if (error) {
        console.error('Error adding/updating solution:', error);
    }
    
    return result;
};