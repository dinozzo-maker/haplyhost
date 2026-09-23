import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Gauge, Puzzle, UserPlus } from 'lucide-react'

// Home dell'area piattaforma (22/09/2026) — su desktop la barra laterale di
// PiattaformaShell.tsx copre già la navigazione; questa pagina serve soprattutto
// su mobile (la shell lì non aggiunge nulla, stesso principio di AdminShell/Admin.tsx)
// e come punto d'arrivo coerente quando si clicca "Vai alla piattaforma".
function Scorciatoia({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 bg-white border border-violet-200 shadow-sm rounded-xl p-3 text-sm font-medium text-violet-950 hover:border-violet-300 transition"
    >
      {children}
    </Link>
  )
}

export default function PiattaformaHome() {
  return (
    <div className="max-w-sm mx-auto px-5 py-6 lg:max-w-3xl lg:px-8 lg:py-10">
      <Link
        to="/admin"
        className="lg:hidden inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-900 transition mb-5"
      >
        <ArrowLeft className="w-4 h-4" /> Torna al pannello
      </Link>
      <h1 className="text-2xl font-bold text-violet-950 tracking-tight text-balance">Piattaforma</h1>
      <p className="text-sm text-violet-700 mt-1.5 leading-relaxed">
        Strumenti che riguardano tutti gli host, non una singola struttura.
      </p>
      <div className="flex flex-col gap-2 mt-7">
        <Scorciatoia to="/admin/piattaforma/consumi-ai">
          <Gauge className="w-4 h-4 text-violet-400 shrink-0" /> Consumi AI
        </Scorciatoia>
        <Scorciatoia to="/admin/piattaforma/invita-host">
          <UserPlus className="w-4 h-4 text-violet-400 shrink-0" /> Invita un nuovo host
        </Scorciatoia>
        <Scorciatoia to="/admin/piattaforma/sezioni-extra">
          <Puzzle className="w-4 h-4 text-violet-400 shrink-0" /> Sezioni della piattaforma
        </Scorciatoia>
      </div>
    </div>
  )
}
