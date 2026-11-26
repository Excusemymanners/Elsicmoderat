// src/components/customers.js
import supabase from '../../supabaseClient';

// Supabase/PostgREST returns at most 1000 rows per request, so once the
// customers table grew past that, newly added clients silently fell off the
// lists. Page through every row, ordered by id so pages don't overlap.
export const fetchAllCustomers = async () => {
  const pageSize = 1000;
  let data = [];
  let from = 0;

  while (true) {
    const { data: pageData, error } = await supabase
      .from('customers')
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      return { data: null, error };
    }

    data = data.concat(pageData || []);

    if (!pageData || pageData.length < pageSize) break;
    from += pageSize;
  }

  return { data, error: null };
};
