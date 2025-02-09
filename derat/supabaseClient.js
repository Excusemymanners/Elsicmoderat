import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vxuixeuswbeoukfocliu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4dWl4ZXVzd2Jlb3VrZm9jbGl1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDE3OTczMCwiZXhwIjoyMDQ5NzU1NzMwfQ.hwl4baUuSBw4W0pUIHzxL1MBlg6RFeHECiCcNGuysuY';

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;