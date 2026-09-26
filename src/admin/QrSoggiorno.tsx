import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

// Finestra a tutto schermo con il codice QR del link personale di un soggiorno: l'host accoglie
// l'ospite di persona e gli dice «inquadri qui». Il telefono dell'ospite apre la guida col suo
// link (Wi-Fi e benvenuto compresi) e l'apertura viene subito contata. La libreria dei QR si
// scarica solo qui, alla prima apertura: il resto del pannello non si appesantisce.
export default function QrSoggiorno({
  link,
  nomeOspite,
  nomeCasa,
  onChiudi,
}: {
  link: string
  nomeOspite: string
  nomeCasa: string
  onChiudi: () => void
}) {
  const [immagine, setImmagine] = useState('')
  const [errore, setErrore] = useState(false)

  useEffect(() => {
    let vivo = true
    import('qrcode')
      .then((QR) =>
        // Sfondo bianco e margine ampio (la "quiet zone"): senza, molti telefoni faticano a leggerlo,
        // soprattutto se il pannello è in modalità scura.
        QR.toDataURL(link, { errorCorrectionLevel: 'M', margin: 2, width: 720, color: { dark: '#0f172a', light: '#ffffff' } })
      )
      .then((url) => vivo && setImmagine(url))
      .catch(() => vivo && setErrore(true))
    return () => {
      vivo = false
    }
  }, [link])

  // Esc chiude; mentre è aperta la pagina sotto non scorre.
  useEffect(() => {
    const suTasto = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChiudi()
    }
    document.addEventListener('keydown', suTasto)
    const overflowPrecedente = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', suTasto)
      document.body.style.overflow = overflowPrecedente
    }
  }, [onChiudi])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Codice QR del soggiorno di ${nomeOspite}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/85 p-4"
      onClick={onChiudi}
    >
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onChiudi}
          aria-label="Chiudi"
          autoFocus
          className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <X className="h-5 w-5" />
        </button>
        <p className="pr-6 text-xs font-bold uppercase tracking-wide text-slate-500">{nomeCasa}</p>
        <h2 className="mt-1 text-xl font-extrabold text-slate-900 text-balance">{nomeOspite}</h2>
        <p className="mt-1 text-sm text-slate-600">Inquadra il codice con la fotocamera per aprire la guida.</p>

        <div className="mx-auto mt-4 aspect-square w-full max-w-[320px]">
          {immagine ? (
            <img src={immagine} alt="Codice QR per aprire la guida" className="h-full w-full rounded-xl border border-slate-200" />
          ) : errore ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-slate-200 p-4 text-sm text-red-600">
              Non riesco a creare il codice. Copia il link e mandalo all&apos;ospite.
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-slate-200 text-sm text-slate-400">
              Preparo il codice…
            </div>
          )}
        </div>

        <p className="mt-3 text-xs text-slate-400">Alza la luminosità dello schermo, così si legge meglio.</p>
        <p className="mt-2 break-all text-[11px] text-slate-300">{link}</p>
      </div>
    </div>
  )
}
