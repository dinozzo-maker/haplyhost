// Ridimensiona un'immagine lato client prima di caricarla: un JPEG da telefono può
// pesare 8-15 MB, qui si porta al lato massimo indicato e si ricomprime in JPEG.
// `imageOrientation: 'from-image'` rispetta la rotazione EXIF (altrimenti una foto
// verticale può uscire ruotata). Se fallisce (formato non supportato, browser vecchio),
// chi chiama deve ricadere sul file originale — non deve mai bloccare il caricamento.
// Condivisa da ModificaCasa.tsx (foto di copertina) e GestisciSezione.tsx (foto di un luogo).
export async function ridimensionaImmagine(file: File, latoMassimo = 1920, qualita = 0.85): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scala = Math.min(1, latoMassimo / Math.max(bitmap.width, bitmap.height))
  const larghezza = Math.round(bitmap.width * scala)
  const altezza = Math.round(bitmap.height * scala)

  const canvas = document.createElement('canvas')
  canvas.width = larghezza
  canvas.height = altezza
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas non disponibile')
  ctx.drawImage(bitmap, 0, 0, larghezza, altezza)
  bitmap.close()

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', qualita))
  if (!blob) throw new Error('Conversione immagine non riuscita')

  const nome = file.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg'
  return new File([blob], nome, { type: 'image/jpeg' })
}
