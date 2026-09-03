import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { LinguaContext, rilevaLingua, salvaLingua } from './lingua'
import type { Lingua } from './lingua'

export function LinguaProvider({ children }: { children: ReactNode }) {
  const [lingua, setLinguaState] = useState<Lingua>(() => rilevaLingua())

  useEffect(() => {
    document.documentElement.lang = lingua
  }, [lingua])

  const setLingua = useCallback((l: Lingua) => {
    setLinguaState(l)
    salvaLingua(l)
  }, [])

  const value = useMemo(() => ({ lingua, setLingua }), [lingua, setLingua])
  return <LinguaContext.Provider value={value}>{children}</LinguaContext.Provider>
}
