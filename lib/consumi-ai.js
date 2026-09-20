import { createClient } from '@supabase/supabase-js'

let clientSupabase
function database() {
  if (!clientSupabase) clientSupabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  return clientSupabase
}

function intero(valore) {
  const numero = Number(valore)
  return Number.isFinite(numero) && numero >= 0 ? Math.round(numero) : 0
}

export function usoGeminiGenerateContent(dati) {
  const uso = dati?.usageMetadata || {}
  return {
    token_input: intero(uso.promptTokenCount),
    token_output: intero(uso.candidatesTokenCount),
    token_ragionamento: intero(uso.thoughtsTokenCount),
    token_cache: intero(uso.cachedContentTokenCount),
    token_strumenti: intero(uso.toolUsePromptTokenCount),
    token_totali: intero(uso.totalTokenCount),
  }
}

export function usoGeminiInteractions(dati) {
  const uso = dati?.usage || {}
  return {
    token_input: intero(uso.total_input_tokens),
    token_output: intero(uso.total_output_tokens),
    token_ragionamento: intero(uso.total_thought_tokens),
    token_cache: intero(uso.total_cached_tokens),
    token_strumenti: intero(uso.total_tool_use_tokens),
    token_totali: intero(uso.total_tokens),
  }
}

export function usoAnthropic(dati) {
  const uso = dati?.usage || {}
  const input = intero(uso.input_tokens)
  const output = intero(uso.output_tokens)
  const cache = intero(uso.cache_read_input_tokens) + intero(uso.cache_creation_input_tokens)
  return {
    token_input: input,
    token_output: output,
    token_ragionamento: 0,
    token_cache: cache,
    token_strumenti: 0,
    token_totali: input + output,
  }
}

export function usoOpenAICompatibile(dati) {
  const uso = dati?.usage || {}
  const input = intero(uso.prompt_tokens ?? uso.input_tokens)
  const output = intero(uso.completion_tokens ?? uso.output_tokens)
  const ragionamento = intero(uso.completion_tokens_details?.reasoning_tokens ?? uso.reasoning_tokens)
  const cache = intero(uso.prompt_tokens_details?.cached_tokens ?? uso.cached_tokens)
  const strumenti = intero(uso.server_tool_use?.web_search_requests)
  return {
    token_input: input,
    token_output: output,
    token_ragionamento: ragionamento,
    token_cache: cache,
    token_strumenti: strumenti,
    token_totali: intero(uso.total_tokens) || input + output,
  }
}

export function tipoErroreAI(errore) {
  const testo = `${errore?.message || errore || ''} ${errore?.codice || ''} ${errore?.httpStatus || ''}`.toLowerCase()
  if (testo.includes('quota') || testo.includes('credit') || testo.includes('payment') || testo.includes('insufficient')
    || testo.includes('rate limit') || testo.includes('resource_exhausted') || testo.includes('429') || testo.includes('402')) return 'credito o limite'
  if (testo.includes('timeout') || errore?.name === 'TimeoutError') return 'timeout'
  if (testo.includes('401') || testo.includes('403') || testo.includes('api key') || testo.includes('invalid_api_key')) return 'chiave o permessi'
  if (testo.includes('400') || testo.includes('invalid_request') || testo.includes('invalid request')) return 'richiesta non valida'
  if (testo.includes('500') || testo.includes('502') || testo.includes('503') || testo.includes('overloaded')) return 'servizio non disponibile'
  return 'fornitore'
}

// Nessun prompt o risposta viene salvato. Se il registro non è disponibile,
// l'operazione AI continua: il monitoraggio non deve interrompere il prodotto.
export async function registraConsumoAI({
  struttura_id = null, servizio, operazione, fornitore, modello,
  esito = 'ok', durata_ms = 0, utilizzo = {}, errore_tipo = null,
}) {
  try {
    const { error } = await database().from('consumi_ai').insert({
      struttura_id, servizio, operazione, fornitore, modello, esito,
      durata_ms: intero(durata_ms), errore_tipo,
      token_input: intero(utilizzo.token_input),
      token_output: intero(utilizzo.token_output),
      token_ragionamento: intero(utilizzo.token_ragionamento),
      token_cache: intero(utilizzo.token_cache),
      token_strumenti: intero(utilizzo.token_strumenti),
      token_totali: intero(utilizzo.token_totali),
    })
    if (error) console.warn('consumi-ai: registrazione non riuscita:', error.message)
  } catch (errore) {
    console.warn('consumi-ai: registro non disponibile:', errore?.message)
  }
}
