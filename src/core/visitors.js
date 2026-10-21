import { VISITORS } from '../data/level.js'

/*
  Contador de visitantes para site estático (GitHub Pages não tem servidor).

  Usa a API gratuita Abacus (sem cadastro, com CORS liberado):
    GET /hit/<namespace>/<chave>  → soma 1 e devolve { value }
    GET /get/<namespace>/<chave>  → só lê o valor atual (404 se ainda não existe)

  Duas contagens:
  - Visitantes únicos: soma 1 só na PRIMEIRA visita de cada aparelho/navegador
    (marcado no localStorage, que continua salvo entre visitas).
  - Visualizações: soma 1 a cada vez que o site é aberto, mesmo no mesmo aparelho.

  Em desenvolvimento (npm run dev) os números são só lidos, para os seus testes
  não inflarem a contagem real.
*/

const API = 'https://abacus.jasoncameron.dev'
const DEVICE_FLAG = 'mmj-portfolio:visitante-contado' // marca "este aparelho já foi contado"

// Lê/grava a marca do aparelho sem quebrar se o localStorage estiver bloqueado
const storage = {
  get: () => {
    try {
      return localStorage.getItem(DEVICE_FLAG) === '1'
    } catch {
      return false
    }
  },
  set: () => {
    try {
      localStorage.setItem(DEVICE_FLAG, '1')
    } catch {
      // sem storage: este aparelho pode ser contado de novo na próxima visita
    }
  },
}

/** Chama a API; `action` é 'hit' (soma 1) ou 'get' (só lê). Chave inexistente vale 0. */
async function call(action, key) {
  const res = await fetch(`${API}/${action}/${encodeURIComponent(VISITORS.namespace)}/${encodeURIComponent(key)}`, { cache: 'no-store' })
  if (action === 'get' && res.status === 404) return 0
  if (!res.ok) throw new Error(`contador respondeu ${res.status}`)
  const data = await res.json()
  return Number(data.value) || 0
}

/** Data de início no formato brasileiro (DD/MM/AAAA). */
export function visitorsSinceLabel() {
  const [y, m, d] = VISITORS.since.split('-')
  return `${d}/${m}/${y}`
}

/**
 * Registra esta visita (quando for o site publicado) e devolve os totais.
 * Resolve com { unique, views } ou lança erro se o serviço estiver fora do ar.
 */
export async function loadVisitors() {
  const count = !import.meta.env.DEV
  const newDevice = count && !storage.get()
  const [unique, views] = await Promise.all([
    call(newDevice ? 'hit' : 'get', VISITORS.keys.unique),
    call(count ? 'hit' : 'get', VISITORS.keys.views),
  ])
  if (newDevice) storage.set() // só marca depois que a contagem deu certo
  return { unique, views }
}
