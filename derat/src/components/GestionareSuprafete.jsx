import React, { useState, useEffect } from 'react';
import supabase from '../../supabaseClient';
import './GestionareSuprafete.css';

const GestionareSuprafete = () => {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [clientSurfaces, setClientSurfaces] = useState([]);
  const [surfaceChanges, setSurfaceChanges] = useState({});

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
      setClients(data);
      setError(null);
    }
    setLoading(false);
  };

  const handleClientSelect = async (client) => {
    setSelectedClient(client);
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('jobs')
      .eq('id', client.id);
    if (error) {
      console.error('Eroare la încărcarea suprafețelor clientului:', error);
      setError('Nu s-au putut încărca suprafețele clientului');
    } else {
      setClientSurfaces(data[0]?.jobs || []);
    }
    setLoading(false);
  };

  const handleSurfaceChange = (job, newSurface) => {
    setSurfaceChanges({
      ...surfaceChanges,
      [job.value]: newSurface
    });
  };

  const handleSaveChanges = async () => {
    setLoading(true);
    try {
      const updatedJobs = clientSurfaces.map(job => ({
        ...job,
        surface: surfaceChanges[job.value] || job.surface
      }));

      const { error } = await supabase
        .from('customers')
        .update({ jobs: updatedJobs })
        .eq('id', selectedClient.id);

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

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="gestionare-suprafete">
      <h2>Gestionare Suprafete</h2>
      <div className="search-container">
        <input
          type="text"
          placeholder="Caută client..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="clients-list">
        {loading ? (
          <p>Se încarcă...</p>
        ) : (
          <ul>
            {filteredClients.map(client => (
              <li key={client.id} onClick={() => handleClientSelect(client)}>
                {client.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedClient && (
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
                      value={surfaceChanges[job.value] || job.surface}
                      onChange={(e) => handleSurfaceChange(job, e.target.value)}
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
  );
};

export default GestionareSuprafete;