// src/components/receptionNumber.js
import supabase from '../../supabaseClient';

// Obține numărul curent de recepție
export const fetchReceptionNumber = async () => {
  const { data, error } = await supabase
    .from('reception_number')
    .select('current_number')
    .single();

  if (error) {
    console.error('Error fetching reception number:', error);
    return null;
  }
  
  return data.current_number;
};

// Incrementează numărul de recepție
export const incrementReceptionNumber = async () => {
  const { error } = await supabase
    .rpc('increment_reception_number');

  if (error) {
    console.error('Error updating reception number:', error);
  }
};