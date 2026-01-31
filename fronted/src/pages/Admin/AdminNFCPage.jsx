import React, { useState } from 'react'
import api from '../../api'

export default function AdminNFCPage({ user }) {
  const [ticketId, setTicketId] = useState('')
  const [nfcUid, setNfcUid] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
    return <div>No tienes permisos para esta sección.</div>
  }

  const handleAssign = async () => {
    setError(null)
    setResult(null)
    if (!ticketId || !nfcUid) {
      setError('Completa ticketId y nfcUid')
      return
    }

    try {
      const res = await api.patch(`/api/tickets/${ticketId}/assign-nfc`, {
        nfc_uid: nfcUid
      })
      setResult(res.data)
    } catch (err) {
      console.error(err)
      setError('Error asignando NFC al ticket')
    }
  }

  return (
    <div>
      <h2>Asignar NFC a ticket</h2>
      <p>
        Esta pantalla sirve como puente con el hardware NFC. La app/lector puede leer el UID
        del tag físico y tú lo pegas aquí para asociarlo a un ticket.
      </p>
      <div style={{ marginBottom: '10px' }}>
        <label>ID de ticket</label><br />
        <input
          type="number"
          value={ticketId}
          onChange={e => setTicketId(e.target.value)}
        />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label>NFC UID (leído por la app/dispositivo)</label><br />
        <input
          type="text"
          value={nfcUid}
          onChange={e => setNfcUid(e.target.value)}
        />
      </div>
      {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
      <button onClick={handleAssign}>Asignar NFC</button>

      {result && (
        <div style={{ marginTop: '20px', border: '1px solid #ccc', padding: '10px' }}>
          <h4>Ticket actualizado</h4>
          <p><strong>ID:</strong> {result.id}</p>
          <p><strong>NFC UID:</strong> {result.nfc_uid}</p>
          <p><strong>Estado:</strong> {result.status}</p>
        </div>
      )}
    </div>
  )
}
