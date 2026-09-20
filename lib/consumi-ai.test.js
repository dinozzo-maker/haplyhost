import test from 'node:test'
import assert from 'node:assert/strict'
import { usoGeminiGenerateContent, usoGeminiInteractions, usoAnthropic, tipoErroreAI } from './consumi-ai.js'

test('normalizza i conteggi Gemini generateContent', () => {
  assert.deepEqual(usoGeminiGenerateContent({ usageMetadata: {
    promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 2,
    cachedContentTokenCount: 3, toolUsePromptTokenCount: 4, totalTokenCount: 21,
  }}), { token_input: 10, token_output: 5, token_ragionamento: 2, token_cache: 3, token_strumenti: 4, token_totali: 21 })
})

test('normalizza Interactions e Anthropic nello stesso formato', () => {
  assert.equal(usoGeminiInteractions({ usage: { total_tokens: 18 } }).token_totali, 18)
  assert.deepEqual(usoAnthropic({ usage: { input_tokens: 7, output_tokens: 3, cache_read_input_tokens: 2 } }), {
    token_input: 7, token_output: 3, token_ragionamento: 0, token_cache: 2, token_strumenti: 0, token_totali: 10,
  })
})

test('classifica gli errori senza conservarne il testo', () => {
  assert.equal(tipoErroreAI(new Error('RESOURCE_EXHAUSTED quota')), 'quota')
  assert.equal(tipoErroreAI(new Error('HTTP 403 API key')), 'autenticazione')
  assert.equal(tipoErroreAI(new Error('errore casuale')), 'fornitore')
})

