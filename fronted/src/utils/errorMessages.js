/**
 * errorMessages.js - UX3: Mapeo de códigos de error técnicos a mensajes amigables en Español
 */

export const ERROR_MESSAGES = {
  // Códigos de error de Código Promocional
  PROMO_CODE_NOT_FOUND: 'El código promocional ingresado no existe.',
  PROMO_CODE_INACTIVE: 'Este código promocional no se encuentra activo.',
  PROMO_CODE_NOT_STARTED: 'Este código promocional aún no está disponible.',
  PROMO_CODE_EXPIRED: 'Este código promocional ya ha caducado.',
  PROMO_CODE_MIN_ORDER_NOT_MET: 'Tu pedido no alcanza el monto mínimo requerido para usar este código.',
  PROMO_CODE_EXHAUSTED: 'Este código promocional ha alcanzado el límite máximo de usos.',
  PROMO_CODE_INVALID_CONFIG: 'Configuración inválida del código promocional.',

  // Autenticación y Usuarios
  INVALID_CREDENTIALS: 'Correo electrónico o contraseña incorrectos.',
  RATE_LIMIT_LOGIN: 'Demasiados intentos de inicio de sesión. Por favor espera 15 minutos.',
  RATE_LIMIT_REGISTER: 'Ha alcanzado el límite de cuentas creadas por hora.',
  RATE_LIMIT_CHECKOUT: 'Demasiadas solicitudes de pago en poco tiempo. Intenta en un momento.',
  RATE_LIMIT_VALIDATE: 'Límite de validaciones alcanzado.',
  USER_NOT_FOUND: 'Usuario no encontrado.',
  NO_TOKEN: 'Sesión no válida o expirada. Por favor inicia sesión.',
  FORBIDDEN: 'No tienes permisos para realizar esta acción.',

  // Órdenes y Compras
  TICKET_TYPE_NOT_FOUND: 'Uno de los tipos de entrada ya no está disponible.',
  INVALID_QUANTITY: 'Por favor selecciona una cantidad válida de entradas.',
  MULTI_EVENT_CHECKOUT_NOT_ALLOWED: 'No es posible comprar entradas de múltiples eventos en una sola orden.',
  COMPROBANTE_YA_ENVIADO: 'El comprobante ya fue subido y se encuentra en proceso de revisión.',
  ORDEN_NO_ENCONTRADA: 'La orden consultada no existe.',
  SERVER_ERROR: 'Ocurrió un error inesperado en el servidor. Por favor intenta más tarde.',
};

/**
 * Convierte un código o mensaje de error de la API en una descripción legible para el usuario.
 * @param {string|object} error - Código de error o respuesta de error
 * @param {string} [fallback] - Mensaje alternativo si el código no está mapeado
 * @returns {string}
 */
export function getErrorMessage(error, fallback = 'Ocurrió un error. Inténtalo de nuevo.') {
  if (!error) return fallback;

  const code = typeof error === 'string'
    ? error
    : error?.error || error?.message || error?.code;

  if (typeof code === 'string' && ERROR_MESSAGES[code]) {
    return ERROR_MESSAGES[code];
  }

  return typeof error === 'string' ? error : fallback;
}
