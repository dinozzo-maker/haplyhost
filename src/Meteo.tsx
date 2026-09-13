import { useEffect, useState } from 'react'
import {
  Sun, Moon, CloudSun, CloudMoon, CloudFog, CloudDrizzle, CloudRain,
  CloudRainWind, CloudSnow, CloudLightning, type LucideIcon,
} from 'lucide-react'

type Previsione = { temperatura: number; Icona: LucideIcon }

// Codici meteo WMO (open-meteo.com), raggruppati nelle famiglie che ci servono.
function iconaPer(codice: number, giorno: boolean): LucideIcon {
  if (codice === 0) return giorno ? Sun : Moon
  if (codice <= 3) return giorno ? CloudSun : CloudMoon
  if (codice <= 48) return CloudFog
  if (codice <= 57) return CloudDrizzle
  if (codice <= 67) return CloudRain
  if (codice <= 77) return CloudSnow
  if (codice <= 82) return CloudRainWind
  if (codice <= 86) return CloudSnow
  return CloudLightning
}

// Pallino meteo nell'hero della home: Open-Meteo, gratuito e senza chiave,
// chiamato direttamente dal browser. Se mancano le coordinate o la richiesta
// fallisce non mostra nulla (nessun testo di errore, non è un dato essenziale).
export default function Meteo({ lat, lng }: { lat: number | null; lng: number | null }) {
  const [dati, setDati] = useState<Previsione | null>(null)

  useEffect(() => {
    if (lat == null || lng == null) return
    let vivo = true
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
        '&current=temperature_2m,weather_code,is_day&timezone=auto'
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!vivo || !j?.current) return
        setDati({
          temperatura: Math.round(j.current.temperature_2m),
          Icona: iconaPer(j.current.weather_code, j.current.is_day === 1),
        })
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [lat, lng])

  if (!dati) return null
  const { Icona, temperatura } = dati
  return (
    <div className="g-weather">
      <Icona className="w-4 h-4" />
      {temperatura}°
    </div>
  )
}
