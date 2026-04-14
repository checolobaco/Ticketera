import React, { useMemo, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { toPng } from 'html-to-image'

export default function ShareQrCard({
  shareSlug,
  eventName,
  startDate,
  logoUrl
}) {
  const cardRef = useRef(null)

  const shareUrl = useMemo(() => {
    if (!shareSlug) return ''
    return `${window.location.origin}/e/${shareSlug}`
  }, [shareSlug])

  const formattedDate = useMemo(() => {
    if (!startDate) return ''
    const d = new Date(startDate)
    return d.toLocaleDateString('es-CO', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }, [startDate])

  const handleDownload = async () => {
    if (!cardRef.current) return

    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 3
      })

      const link = document.createElement('a')
      link.download = `qr-evento-${shareSlug}.png`
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.error('Error generando imagen QR:', error)
      alert('No se pudo descargar la imagen')
    }
  }

  const handlePrint = async () => {
    if (!cardRef.current) return

    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 3
      })

      const printWindow = window.open('', '_blank')
      if (!printWindow) return

      printWindow.document.write(`
        <html>
          <head>
            <title>Imprimir QR</title>
            <style>
              body {
                margin: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                background: white;
              }
              img {
                width: 320px;
                max-width: 90vw;
              }
            </style>
          </head>
          <body>
            <img src="${dataUrl}" />
          </body>
        </html>
      `)

      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    } catch (error) {
      console.error('Error imprimiendo QR:', error)
      alert('No se pudo imprimir la imagen')
    }
  }

  if (!shareSlug) return null

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div
        ref={cardRef}
        style={{
          width: 250,
          minHeight: 520,
          borderRadius: 28,
          padding: '22px 20px',
          background: 'linear-gradient(180deg, #0f3b8f 0%, #10131d 55%, #b4874b 100%)',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 20px 45px rgba(0,0,0,0.25)',
          fontFamily: 'Arial, sans-serif'
        }}
      >
        <div
          style={{
            width: 90,
            height: 8,
            borderRadius: 999,
            background: '#35d4c1',
            margin: '0 auto 22px auto'
          }}
        />

        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <img
            src={logoUrl}
            alt="Logo"
            style={{
              width: 82,
              height: 82,
              objectFit: 'contain',
              borderRadius: 18
            }}
          />
        </div>

        <div
          style={{
            textAlign: 'center',
            fontSize: 18,
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: 6
          }}
        >
          {eventName || 'Evento'}
        </div>

        <div
          style={{
            textAlign: 'center',
            fontSize: 13,
            opacity: 0.9,
            marginBottom: 24
          }}
        >
          {formattedDate || 'Escanea para comprar'}
        </div>

        <div
          style={{
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 24,
            padding: 18,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 18
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: 14,
              borderRadius: 18,
              position: 'relative'
            }}
          >
            <QRCodeCanvas
              value={shareUrl}
              size={180}
              bgColor="#ffffff"
              fgColor="#111111"
              level="H"
              includeMargin={false}
            />

            <img
              src={logoUrl}
              alt="Logo centro"
              style={{
                width: 38,
                height: 38,
                objectFit: 'cover',
                borderRadius: 10,
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: '#fff',
                padding: 4
              }}
            />
          </div>
        </div>

        <div
          style={{
            textAlign: 'center',
            fontSize: 13,
            lineHeight: 1.4,
            opacity: 0.95
          }}
        >
          Escanea este código
          <br />
          para comprar entradas
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: 'center',
            fontSize: 10,
            opacity: 0.75,
            wordBreak: 'break-all'
          }}
        >
          {shareUrl}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn-outline" onClick={handleDownload}>
          Descargar QR
        </button>

        <button type="button" className="btn-outline" onClick={handlePrint}>
          Imprimir QR
        </button>
      </div>
    </div>
  )
}