import React, { useState, useEffect } from 'react';
import supabase from '../../supabaseClient';
import './GestionareSuprafete.css';

const GestionareSuprafete = () => {
  const [clients, setClients] = useState(new Map());
  const [selectedClients, setSelectedClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [clientSurfaces, setClientSurfaces] = useState([]);
  const [loadingSelectedClients, setLoadingSelectedClients] = useState(false);

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
        const firstWord = client.name.split(' ')[0];
        if (clientMap.has(firstWord)) {
          clientMap.get(firstWord).push(client);
        } else {
          clientMap.set(firstWord, [client]);
        }
      });
      setClients(clientMap);
      setError(null);
    }
    setLoading(false);
  };

  const handleClientSelect = async (client) => {
    const alreadySelected = selectedClients.find(c => c.id === client.id);
    const newSelectedClients = alreadySelected
      ? selectedClients.filter(c => c.id !== client.id)
      : [...selectedClients, client];

    setSelectedClients(newSelectedClients);

    if (newSelectedClients.length === 0) {
      setClientSurfaces([]);
      return;
    }

    setLoadingSelectedClients(true);
    const { data, error } = await supabase
      .from('customers')
      .select('jobs')
      .in('id', newSelectedClients.map(c => c.id));
    if (error) {
      console.error('Eroare la încărcarea suprafețelor clientului:', error);
      setError('Nu s-au putut încărca suprafețele clientului');
    } else {
      const commonJobs = data.length > 0 ? data[0].jobs.map(job => ({ ...job })) : [];
      newSelectedClients.forEach(client => {
        data.forEach(d => {
          d.jobs.forEach(job => {
            const commonJob = commonJobs.find(j => j.value === job.value);
            if (commonJob && commonJob.surface !== job.surface) {
              commonJob.surface = '';
            }
          });
        });
      });
      setClientSurfaces(commonJobs);
    }
    setLoadingSelectedClients(false);
  };

  const handleGroupSelect = async (clientGroup) => {
    const clientsInGroup = clients.get(clientGroup);
    const allSelected = clientsInGroup.every(client => selectedClients.some(c => c.id === client.id));
    const newSelectedClients = allSelected
      ? selectedClients.filter(c => !clientsInGroup.some(client => client.id === c.id))
      : [...selectedClients, ...clientsInGroup.filter(client => !selectedClients.some(c => c.id === client.id))];

    setSelectedClients(newSelectedClients);

    if (newSelectedClients.length === 0) {
      setClientSurfaces([]);
      return;
    }

    setLoadingSelectedClients(true);
    const { data, error } = await supabase
      .from('customers')
      .select('jobs')
      .in('id', newSelectedClients.map(c => c.id));
    if (error) {
      console.error('Eroare la încărcarea suprafețelor clientului:', error);
      setError('Nu s-au putut încărca suprafețele clientului');
    } else {
      const commonJobs = data.length > 0 ? data[0].jobs.map(job => ({ ...job })) : [];
      newSelectedClients.forEach(client => {
        data.forEach(d => {
          d.jobs.forEach(job => {
            const commonJob = commonJobs.find(j => j.value === job.value);
            if (commonJob && commonJob.surface !== job.surface) {
              commonJob.surface = '';
            }
          });
        });
      });
      setClientSurfaces(commonJobs);
    }
    setLoadingSelectedClients(false);
  };

  const handleSaveChanges = async () => {
    setLoading(true);
    try {
      for (const client of selectedClients) {
        const { error } = await supabase
          .from('customers')
          .update({ jobs: clientSurfaces })
          .eq('id', client.id);

        if (error) {
          throw new Error('Eroare la actualizarea suprafețelor');
        }
      }

      alert('Suprafețele au fost actualizate cu succes');
      setSelectedClients([]);
      setClientSurfaces([]);
      fetchClients(); // Reîmprospătează lista de clienți după actualizare
    } catch (error) {
      console.error(error);
      setError(error.message);
      alert('A apărut o eroare la actualizarea suprafețelor');
    }
    setLoading(false);
  };

  const filteredClients = () => {
    const filteredMap = new Map();

    for (const [clientGroup, clientList] of clients.entries()) {
      if (clientGroup.toLowerCase().includes(searchTerm.toLowerCase())) {
        filteredMap.set(clientGroup, clientList);
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
              {Array.from(filteredClients().entries()).map(([clientGroup, clientList]) => (
                <div key={clientGroup} className='client-group'>
                  <h3 onClick={() => handleGroupSelect(clientGroup)}>{clientGroup}</h3>
                  {clientList.map(client => (
                    <div
                      className={`client ${selectedClients.some(c => c.id === client.id) ? 'selected' : ''}`}
                      key={client.id}
                      onClick={() => handleClientSelect(client)}
                    >
                      {client.name}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedClients.length > 0 && !loadingSelectedClients && (
          <div className="client-details">
            <h3>Suprafete pentru clienții selectați</h3>
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
                        onChange={(event) => { setClientSurfaces(clientSurfaces.map(j => j.value === job.value ? { ...j, surface: parseFloat(event.target.value) } : j)) }}
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