import { VISITORS } from '../data/level.js'

/* ==========================================================================
   CONTADOR DE VISITANTES (site estático, sem servidor próprio)

   Papel deste arquivo:
   - Conversar com a API gratuita Abacus para somar e ler visitas. O GitHub
     Pages não tem servidor, então a contagem fica num serviço externo.
   - Expor loadVisitors() (registra a visita e devolve os totais) e
     visitorsSinceLabel() (data de início formatada). Quem mostra o texto na
     tela é initVisitorCounter() em src/ui/screens.js.

   Como a API funciona (sem cadastro, com CORS liberado):
     GET /hit/<namespace>/<chave>  → soma 1 e devolve { value }
     GET /get/<namespace>/<chave>  → só lê o valor atual (404 se ainda não existe)

   Duas contagens:
   - Visitantes únicos: soma 1 só na PRIMEIRA visita de cada aparelho/navegador
     (marcado no localStorage, que continua salvo entre visitas).
   - Visualizações: soma 1 a cada vez que o site é aberto, mesmo no mesmo aparelho.

   Em desenvolvimento (npm run dev) os números são só lidos, para os seus testes
   não inflarem a contagem real.

   Dependências: VISITORS de src/data/level.js (namespace, chaves e data de início).
   Quem usa: src/ui/screens.js.

   Onde mexer:
   - Namespace, nomes das chaves e data "desde": objeto VISITORS em level.js.
   - Trocar de serviço de contagem: só a função call() precisa mudar.
   - DEVICE_FLAG: nome da marca "já contado" no localStorage (trocar faz todo
     mundo contar como novo visitante uma vez).
   ========================================================================== */

const API = 'https://abacus.jasoncameron.dev' // endereço base do serviço de contagem
// Marca "este aparelho já foi contado" no localStorage. Inclui o namespace: ao zerar a contagem
// (namespace novo em VISITORS), todos os aparelhos voltam a ser contados como visitantes únicos.
const DEVICE_FLAG = `mmj-portfolio:visitante-contado:${VISITORS.namespace}`

// Lê/grava a marca do aparelho sem quebrar se o localStorage estiver bloqueado
// (modo privado de alguns navegadores lança erro ao acessar localStorage).
const storage = {
  /** @returns {boolean} true se este aparelho já foi contado como visitante único */
  get: () => {
    try {
      return localStorage.getItem(DEVICE_FLAG) === '1'
    } catch {
      return false
    }
  },
  /** Marca este aparelho como já contado. */
  set: () => {
    try {
      localStorage.setItem(DEVICE_FLAG, '1')
    } catch {
      // sem storage: este aparelho pode ser contado de novo na próxima visita
    }
  },
}

/**
 * Chama a API; `action` é 'hit' (soma 1) ou 'get' (só lê). Chave inexistente vale 0.
 * `cache: 'no-store'` garante que o navegador não devolva um número velho do cache.
 * Lança erro se o serviço responder com falha (quem chama trata e mostra "indisponível").
 * @param {'hit'|'get'} action
 * @param {string} key - nome da chave (VISITORS.keys.unique ou .views)
 * @returns {Promise<number>}
 */
async function call(action, key) {
  const res = await fetch(`${API}/${action}/${encodeURIComponent(VISITORS.namespace)}/${encodeURIComponent(key)}`, { cache: 'no-store' })
  if (action === 'get' && res.status === 404) return 0
  if (!res.ok) throw new Error(`contador respondeu ${res.status}`)
  const data = await res.json()
  return Number(data.value) || 0
}

/**
 * Data de início no formato brasileiro (DD/MM/AAAA).
 * Converte VISITORS.since ('AAAA-MM-DD') invertendo as partes.
 * @returns {string}
 */
export function visitorsSinceLabel() {
  const [y, m, d] = VISITORS.since.split('-')
  return `${d}/${m}/${y}`
}

/**
 * Registra esta visita (quando for o site publicado) e devolve os totais.
 * Resolve com { unique, views } ou lança erro se o serviço estiver fora do ar.
 * Como decide o que somar:
 * - count = false em desenvolvimento (import.meta.env.DEV): só lê ('get').
 * - newDevice = site publicado E aparelho ainda sem a marca: soma 1 em únicos.
 * - visualizações somam 1 sempre que count for true.
 * As duas chamadas rodam em paralelo (Promise.all). A marca do aparelho só é
 * gravada DEPOIS que a contagem deu certo, para não perder a visita se a rede falhar.
 * @returns {Promise<{unique: number, views: number}>}
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
