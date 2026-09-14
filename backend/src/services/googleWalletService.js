const jwt = require('jsonwebtoken');

/**
 * Genera la URL de Google Wallet (JWT) para un ticket.
 * Crea el EventTicketClass dinámicamente si no existe,
 * insertándolo en el mismo JWT junto con el EventTicketObject.
 */
async function generateWalletJwtUrl(ticket, event, venue) {
  // 1. Obtener variables de entorno
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  const credentialsJson = process.env.GOOGLE_WALLET_CREDENTIALS;

  if (!issuerId || !credentialsJson) {
    throw new Error('Las credenciales de Google Wallet no están configuradas en el entorno (.env)');
  }

  // 2. Parsear el JSON de la cuenta de servicio
  let credentials;
  try {
    credentials = JSON.parse(credentialsJson);
  } catch (error) {
    throw new Error('GOOGLE_WALLET_CREDENTIALS no es un JSON válido');
  }

  // 3. Crear IDs únicos basados en tu Issuer ID
  const classId = `${issuerId}.evento-${event.id}`;
  const objectId = `${issuerId}.ticket-${ticket.id}-${ticket.unique_code.split('-')[0]}`;

  // 4. Definir la Clase (El Evento)
  const eventTicketClass = {
    id: classId,
    issuerName: 'CloudTickets',
    eventName: {
      defaultValue: {
        language: 'es',
        value: event.name || 'Evento Especial'
      }
    },
    reviewStatus: 'UNDER_REVIEW', 
    logo: {
      sourceUri: {
        uri: 'https://cdn.cloud-tickets.com/CT_simbolo_G.jpg'
      },
      contentDescription: {
        defaultValue: {
          language: 'es',
          value: 'Logo de CloudTickets'
        }
      }
    }
  };

  // Usar ticket_image_url preferiblemente (la del PDF) o image_url como respaldo
  const heroImageUrl = event.ticket_image_url || event.image_url;

  if (heroImageUrl) {
    eventTicketClass.heroImage = {
      sourceUri: {
        uri: heroImageUrl
      },
      contentDescription: {
        defaultValue: {
          language: 'es',
          value: 'Imagen principal del evento'
        }
      }
    };
  }

  if (venue && venue.name) {
    eventTicketClass.venue = {
      name: {
        defaultValue: {
          language: 'es',
          value: venue.name
        }
      },
      address: {
        defaultValue: {
          language: 'es',
          value: venue.address || ''
        }
      }
    };
  }

  // 5. Definir el Objeto (El Ticket Individual)
  const eventTicketObject = {
    id: objectId,
    classId: classId,
    state: 'ACTIVE',
    barcode: {
      type: 'QR_CODE',
      value: typeof ticket.qr_payload === 'string' && ticket.qr_payload.trim()
        ? ticket.qr_payload.trim()
        : JSON.stringify({ t: 'TICKET', tid: ticket.unique_code, eid: event.id }),
      alternateText: (ticket.unique_code || '').split('-')[0]
    },
    ticketHolderName: ticket.holder_name || 'Cliente',
    ticketNumber: String(ticket.id)
  };

  if (ticket.entry_deadline_time) {
    eventTicketObject.textModulesData = [
      {
        header: 'Límite de Ingreso',
        body: `Ingreso válido solo hasta las ${ticket.entry_deadline_time}`,
        id: 'entry_limit'
      }
    ];
  }

  // 6. Construir el Payload del JWT
  const claims = {
    iss: credentials.client_email,
    aud: 'google',
    typ: 'savetowallet',
    origins: [],
    payload: {
      eventTicketClasses: [eventTicketClass],
      eventTicketObjects: [eventTicketObject]
    }
  };

  // 7. Firmar el JWT usando jsonwebtoken
  const signedJwt = jwt.sign(claims, credentials.private_key, {
    algorithm: 'RS256',
    keyid: credentials.private_key_id
  });

  // 8. Retornar la URL final
  return `https://pay.google.com/gp/v/save/${signedJwt}`;
}

module.exports = {
  generateWalletJwtUrl
};
