import React, { useState, useEffect } from 'react';
import supabase from '../../supabaseClient';
import './GestionareSuprafete.css';

const GestionareSuprafete = () => {
  const [clients, setClients] = useState(new Map());
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [clientSurfaces, setClientSurfaces] = useState([]);
  const [loadingSelectedClient, setLoadingSelectedClient] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*');
    if (error) {
      console.error('Eroare la încărcarea clienților:', error);
      setError('Nu s-au putut încărca clienții');
    } else {
      const clientMap = new Map();
      data.forEach(client => {
        const existingEntry = Array.from(clientMap.entries()).find(
          ([existingClient]) => existingClient.name === client.name
        );
        
        if (existingEntry) {
          clientMap.set(existingEntry[0], clientMap.get(existingEntry[0]) + 1);
        } else {
          clientMap.set(client, 1);
        }
      });
      setClients(clientMap);
      setError(null);
    }
    setLoading(false);
  };

  const handleClientSelect = async (client) => {
    setSelectedClient(client);
    setLoadingSelectedClient(true);
    const { data, error } = await supabase
      .from('customers')
      .select('jobs')
      .eq('id', client.id);
    if (error) {
      console.error('Eroare la încărcarea suprafețelor clientului:', error);
      setError('Nu s-au putut încărca suprafețele clientului');
    } else {
      setClientSurfaces(data[0]?.jobs || []);
      console.log(clientSurfaces)
    }
    setLoadingSelectedClient(false);
  };

  const handleSaveChanges = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('customers')
        .update({ jobs: clientSurfaces })
        .eq('name', selectedClient.name);

      if (error) {
        throw new Error('Eroare la actualizarea suprafețelor');
      }

      alert('Suprafețele au fost actualizate cu succes');
      handleClientSelect(selectedClient); // Reîmprospătează suprafețele după actualizare
    } catch (error) {
      console.error(error);
      setError(error.message);
      alert('A apărut o eroare la actualizarea suprafețelor');
    }
    setLoading(false);
  };

  const filteredClients = () => {
      const filteredMap = new Map();

      for (const [client, count] of clients.entries()) {
        if (client.name.toLowerCase().includes(searchTerm.toLowerCase())) {
            filteredMap.set(client, count);
        }
      }
      
      return filteredMap;
  };

  return (
    <div>
      <h2>Gestionare Suprafete</h2>
      <div className="search-container">
        <input
          type="text"
          placeholder="Caută client..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="gestionare-suprafete">
        

        {error && <div className="error-message">{error}</div>}

        <div className="clients-list">
          {loading ? (
            <p>Se încarcă...</p>
          ) : (
            <div className='clients'>
              {Array.from(filteredClients().keys()).map(client => (
                <div className='client' key={client.id} onClick={() => handleClientSelect(client)}>
                  {client.name} - ({filteredClients().get(client)})
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedClient && !loadingSelectedClient && (
          <div className="client-details">
            <h3>Suprafete pentru {selectedClient.name}</h3>
            <table>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Suprafață</th>
                </tr>
              </thead>
              <tbody>
                {clientSurfaces.map(job => (
                  <tr key={job.value}>
                    <td>{job.label}</td>
                    <td>
                      <input
                        type="number"
                        value={job.surface}
                        onChange={(event) => {setClientSurfaces(clientSurfaces.map(j => j.value === job.value ? { ...j, surface: event.target.value } : j))}}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={handleSaveChanges} disabled={loading}>
              {loading ? 'Se salvează...' : 'Salvează modificările'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GestionareSuprafete;