import * as THREE from 'three'
import { ROADS } from '../data/level.js'

/* ==========================================================================
   FUNÇÕES AUXILIARES (helpers)

   Papel deste arquivo: pequenas funções matemáticas e de texto usadas por
   vários módulos (bike, totens, cenário, janelas, efeitos). Nenhuma delas
   mexe na cena, no DOM ou no estado do jogo: recebem valores e devolvem
   valores.

   Depende de: three (só para o clamp) e ROADS de data/level.js (nearRoad).
   Quem usa: praticamente todos os módulos de src/.

   Onde mexer:
   - REDUCED_MOTION: é lido uma vez ao carregar; se quiser forçar o modo
     "menos animação" nos testes, troque por `true` temporariamente.
   - nearRoad(x, z, margin): a margem (metros) define o quanto os enfeites e
     prismas ficam afastados das ruas; o valor é passado por quem chama.
   ========================================================================== */

/**
 * Número aleatório entre `a` e `b` (pode ser decimal; `b` nunca é atingido).
 * Usado para espalhar enfeites, girar fragmentos, variar tamanhos, etc.
 * @param {number} a limite inferior
 * @param {number} b limite superior
 * @returns {number}
 */
export const rand = (a, b) => a + Math.random() * (b - a)

/**
 * Limita um valor entre mínimo e máximo: clamp(15, 0, 10) devolve 10.
 * É a mesma função do Three.js (THREE.MathUtils.clamp), só com nome curto.
 */
export const clamp = THREE.MathUtils.clamp

/**
 * true se o visitante marcou "reduzir movimento/animações" nas configurações do
 * sistema operacional (acessibilidade). Os módulos usam isso para encurtar ou
 * pular animações (câmera lenta, rebobinar, papeizinhos). Lido uma única vez
 * ao carregar a página.
 */
export const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Distância (em metros) de um ponto (px, pz) do chão até o segmento de reta
 * que vai de A até B, também no chão.
 *
 * Como funciona: projeta o ponto sobre a reta A→B (o `t` é a posição ao longo
 * do segmento, 0 = em A, 1 = em B), limita `t` entre 0 e 1 para não sair das
 * pontas do segmento e mede a distância até esse ponto projetado.
 * Usada para saber se algo está perto de uma rua (nearRoad) e para detectar
 * atropelo em arrastes rápidos (totems.js testa o trajeto da bike no frame).
 * @param {number} px x do ponto
 * @param {number} pz z do ponto
 * @param {[number, number]} A início do segmento [x, z]
 * @param {[number, number]} B fim do segmento [x, z]
 * @returns {number} distância em metros
 */
export function distToSegment(px, pz, [ax, az], [bx, bz]) {
  const dx = bx - ax
  const dz = bz - az
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1)
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t))
}

/**
 * true se o ponto (x, z) está a menos de `margin` metros de alguma rua de
 * ROADS (data/level.js). Usada pelo cenário para não colocar enfeites e
 * prismas em cima das ruas. Margem maior = mais espaço livre ao redor da rua.
 * @param {number} x
 * @param {number} z
 * @param {number} margin metros
 * @returns {boolean}
 */
export const nearRoad = (x, z, margin) => ROADS.some(([a, b]) => distToSegment(x, z, a, b) < margin)

/**
 * Menor diferença entre dois ângulos (radianos), sempre no intervalo [-PI, PI].
 * Exemplo: de 350° para 10° a resposta é +20°, não -340°. A bike usa isso para
 * saber para qual lado virar quando uma placa magnética a atrai.
 * @param {number} from ângulo atual
 * @param {number} to ângulo desejado
 * @returns {number} quanto somar em `from` para chegar em `to`
 */
export function angleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

// Tabela de troca: cada caractere perigoso em HTML → sua entidade segura
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/**
 * Escapa caracteres especiais para inserir texto com segurança dentro de HTML
 * (innerHTML). Sem isso, um título como "<b>Oi</b>" viraria uma tag de verdade.
 * Use sempre que um texto de level.js for colocado dentro de uma janela.
 * @param {string} s texto cru
 * @returns {string} texto seguro para HTML
 */
export const escapeHTML = (s) => s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c])
