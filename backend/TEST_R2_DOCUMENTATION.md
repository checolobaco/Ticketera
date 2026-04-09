# Test R2 - Cloudflare Workers Storage

Endpoints para probar la subida de archivos a Cloudflare R2.

## Requisitos previos

Asegúrate de tener las siguientes variables de entorno configuradas en tu `.env`:

```bash
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET=your_bucket_name
R2_PUBLIC_BASE_URL=https://your-public-url.example.com
```

## Endpoints

### POST `/api/test-r2/upload`

Sube un archivo (imagen, PDF, doc, etc) a Cloudflare R2.

**Content-Type**: `multipart/form-data`

**Body** (form-data):
- `file` (type: file) - el archivo a subir

**Respuesta exitosa (201)**:
```json
{
  "ok": true,
  "file": {
    "originalName": "my-image.jpg",
    "size": 245632,
    "key": "test/1708884000000-my-image.jpg",
    "url": "https://your-public-url.example.com/test/1708884000000-my-image.jpg"
  }
}
```

**Ejemplo en Postman**:
1. Abre la request "Upload File"
2. En el body, selecciona "form-data"
3. Añade un campo con clave `file` y tipo `file`
4. Selecciona una imagen de tu computadora
5. Haz clic en "Send"

---

### POST `/api/test-r2/upload-text`

Sube contenido de texto plano a R2.

**Content-Type**: `application/json`

**Body**:
```json
{
  "text": "Este es el contenido de prueba\nCon múltiples líneas",
  "filename": "mi-archivo.txt"
}
```

**Respuesta exitosa (201)**:
```json
{
  "ok": true,
  "key": "test/1708884000000-mi-archivo.txt",
  "url": "https://your-public-url.example.com/test/1708884000000-mi-archivo.txt"
}
```

---

## Cómo importar en Postman

1. Abre Postman
2. Haz clic en **Import** → **File**
3. Selecciona `backend/postman_r2_collection.json`
4. Ajusta la variable `baseUrl` si es necesario
5. ¡Listo! Usa los endpoints para probar R2

---

## Respuestas de error

- **400 Bad Request**: Falta el archivo o texto requerido
- **500 Server Error**: Variables R2 no configuradas o error de conexión

```json
{ "error": "Variables R2 no configuradas" }
```

---

## Flujo típico de uso

1. **Subir archivo**: `POST /api/test-r2/upload` → obtienes la URL
2. **Usar en otra parte**: Puedes guardar esa URL en BD (por ejemplo, en `orders.payment_receipt_url`)
3. **Acceder públicamente**: La URL devuelta es directamente accesible desde el navegador
