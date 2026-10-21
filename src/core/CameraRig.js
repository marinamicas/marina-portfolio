import * as THREE from 'three'
import gsap from 'gsap'

/* ==========================================================================
   CÂMERA QUE SEGUE A BIKE (CameraRig)

   Papel deste arquivo:
   - Define a classe CameraRig, que posiciona a câmera do Three.js a cada
     frame em relação a um "alvo" (a bike) e cuida de: atraso suave ao seguir,
     zoom do jogador, pan (arrastar o cenário), tremida de impacto e
     aproximação cinematográfica do atropelo.
   - Todos os parâmetros importantes (target, offset, look, pan, zoom, punch)
     são propriedades públicas e numéricas. Isso é de propósito: qualquer
     tween do GSAP pode animá-los diretamente (ex.: rig.frame() e
     rig.cinematic()).

   Dependências: three (Vector3, MathUtils) e gsap (animações).
   Quem usa: src/main.js cria `new CameraRig(camera, DEFAULT_VIEW)` e chama
   `rig.update(dt, bike.body.position)` uma vez por frame. Os controles de
   ponteiro (pointerControls.js) chamam panBy/grab/release, e o loop chama
   zoomBy/resetZoom/recenter/frame/shake/cinematicPunch.

   Como a posição final da câmera é calculada (ver update()):
     posição = target + offset * zoom * punch
     olhar   = target + look (+ tremida)

   Onde mexer:
   - zoomLimits (constructor): quão perto/longe o jogador pode dar zoom.
   - zoomSmoothing (constructor): suavidade do zoom (maior = mais imediato).
   - lag (constructor; main.js altera por frame): atraso com que a câmera
     persegue a bike (maior = cola mais rápido).
   - cinematicPunch(strength, duration): intensidade da aproximação no atropelo.
   - shake(strength, duration): força e duração da tremida.
   - Os enquadramentos em si (offset/look) ficam em src/data/level.js
     (DEFAULT_VIEW e ZONES), não aqui.
   ========================================================================== */

/**
 * Câmera que segue um alvo com atraso suave. Todos os parâmetros (target,
 * offset, look) são Vector3 públicos, então qualquer tween GSAP pode animá-los.
 */
export class CameraRig {
  /**
   * Cria o rig e guarda o enquadramento padrão.
   * @param {THREE.PerspectiveCamera} camera - a câmera real do Three.js que será movida
   * @param {{offset:{x,y,z}, look:{x,y,z}}} defaultView - enquadramento padrão (DEFAULT_VIEW do level.js)
   */
  constructor(camera, defaultView) {
    this.camera = camera
    this.defaultView = defaultView
    this.target = new THREE.Vector3() // ponto seguido (em metros, no mundo). Normalmente = bike + pan
    this.offset = new THREE.Vector3().copy(defaultView.offset) // onde a câmera fica EM RELAÇÃO ao target (x, altura, z)
    this.look = new THREE.Vector3().copy(defaultView.look) // para onde a câmera olha, EM RELAÇÃO ao target
    this.lookAtPoint = new THREE.Vector3() // ponto absoluto para o qual a câmera olha (recalculado a cada frame)
    this.shakeOffset = new THREE.Vector3() // deslocamento aleatório da tremida (zero quando não está tremendo)
    this.following = true // false só durante um plano cinematográfico livre (cinematic())
    this.lag = 5 // "preguiça" ao seguir a bike: maior = cola mais rápido; menor = câmera mais flutuante
    this.yaw = 0 // ângulo horizontal da câmera (radianos); usado pelos billboards para encararem a câmera

    // Zoom do jogador: multiplica a distância da câmera (offset).
    // `zoomTarget` muda na hora com o gesto; `zoom` persegue o alvo suavemente a cada frame.
    this.zoom = 1 // zoom atual (1 = distância normal; <1 mais perto; >1 mais longe)
    this.zoomTarget = 1 // zoom pedido pelo jogador (roda, pinça, teclas); `zoom` vai até ele suavemente
    this.zoomLimits = { min: 0.45, max: 1.9 } // 0.45 = bem perto da bike; 1.9 = quase o dobro da distância
    this.zoomSmoothing = 14 // maior = segue o gesto mais rápido (14 ≈ 90% do caminho em 0,16 s)

    // Pan (arrastar a tela): deslocamento da câmera em relação à bike, no chão (x, z).
    // Enquanto `hold` é true (dedo/mouse arrastando), a câmera fica parada onde o
    // jogador deixou, sem perseguir a bike — isso evita que o chão "fuja" do dedo.
    this.pan = new THREE.Vector3() // quanto a câmera está deslocada da bike (metros, só x e z)
    this.hold = false // true = um arraste está em andamento; a câmera NÃO persegue a bike
    this.recentering = false // true = o pan volta suavemente a zero (câmera recentraliza na bike)
    this.panBounds = null // { minX, maxX, minZ, maxZ }: até onde a câmera pode ir (main.js define = BOUNDS)

    // "Punch" cinematográfico: aproximação extra e passageira (atropelos)
    this.punch = 1 // multiplicador momentâneo da distância (1 = normal; 0.72 = 28% mais perto)

    this._desired = new THREE.Vector3() // vetor reaproveitado (evita criar objetos a cada frame)
  }

  /**
   * Move a câmera no chão por (dx, dz) metros, na hora (pan do jogador e borda da tela).
   * Como funciona: soma direto no `target` (sem suavização), limita aos panBounds
   * para a câmera não sair do mapa e cancela qualquer recentralização em andamento.
   * Chamada por pointerControls.js a cada frame de arraste do cenário/pinça e
   * quando a bike é arrastada até a borda da tela.
   * @param {number} dx - deslocamento em x (metros)
   * @param {number} dz - deslocamento em z (metros)
   */
  panBy(dx, dz) {
    this.target.x += dx
    this.target.z += dz
    if (this.panBounds) {
      const b = this.panBounds
      this.target.x = THREE.MathUtils.clamp(this.target.x, b.minX, b.maxX)
      this.target.z = THREE.MathUtils.clamp(this.target.z, b.minZ, b.maxZ)
    }
    this.recentering = false
  }

  /**
   * Começa um arraste: a câmera para de seguir a bike até `release()`.
   * Enquanto `hold` for true, update() não mexe no target (só panBy mexe).
   */
  grab() {
    this.hold = true
    this.recentering = false
  }

  /**
   * Fim do arraste: guarda onde a câmera ficou em relação à bike e volta a acompanhá-la.
   * O `pan` passa a ser a diferença (target − bike), então a câmera continua
   * deslocada do mesmo jeito enquanto segue a bike, até alguém chamar recenter().
   * @param {{x:number, z:number}} subject - posição atual da bike
   */
  release(subject) {
    this.hold = false
    this.pan.set(this.target.x - subject.x, 0, this.target.z - subject.z)
  }

  /**
   * Volta a câmera para a bike suavemente (teclado, rebobinar, toque duplo).
   * Não faz nada durante um arraste (hold) nem se já está centralizada e sem
   * recentralização pendente. O decaimento real acontece em update().
   */
  recenter() {
    if (this.hold || (!this.recentering && this.pan.lengthSq() === 0)) return
    this.recentering = true
  }

  /**
   * Efeito de câmera do atropelo: aproxima rápido e volta devagar.
   * Anima `punch` com GSAP: 18% do tempo indo até `strength` e 82% voltando a 1.
   * `overwrite: true` cancela um punch anterior se dois atropelos forem seguidos.
   * @param {number} strength - distância relativa no auge (0.72 = câmera a 72% da distância normal)
   * @param {number} duration - duração total em segundos
   */
  cinematicPunch(strength = 0.72, duration = 1.1) {
    gsap.timeline({ overwrite: true })
      .to(this, { punch: strength, duration: duration * 0.18, ease: 'power3.out' })
      .to(this, { punch: 1, duration: duration * 0.82, ease: 'power2.inOut' })
  }

  /**
   * Aplica um zoom relativo em escala logarítmica (positivo afasta, negativo aproxima).
   * Escala logarítmica: somar deltas = multiplicar fatores, então o gesto é
   * simétrico (afastar X e aproximar X volta ao mesmo lugar). O resultado é
   * limitado por zoomLimits. Chamada pelo loop (main.js) com o acumulado de consumeZoom().
   * @param {number} logDelta - ex.: 0.1 afasta ~10%, −0.1 aproxima ~10%
   */
  zoomBy(logDelta) {
    if (!logDelta) return
    const { min, max } = this.zoomLimits
    this.zoomTarget = THREE.MathUtils.clamp(this.zoomTarget * Math.exp(logDelta), min, max)
  }

  /** Volta suavemente ao zoom padrão (toque duplo, duplo clique, tecla 0). */
  resetZoom() {
    this.zoomTarget = 1
  }

  /**
   * Atualiza a câmera; chamado uma vez por frame com o tempo do frame e o ponto seguido.
   * Passo a passo:
   * 1. Se está recentralizando, o pan decai exponencialmente até zero.
   * 2. Se está seguindo (e não há arraste), o target vai suavemente até bike + pan
   *    (atraso controlado por `lag`).
   * 3. O zoom atual persegue o zoomTarget (damp, independente da taxa de quadros).
   * 4. posição = target + offset × zoom × punch; olhar = target + look + tremida.
   * 5. Calcula `yaw` (ângulo horizontal) para os billboards encararem a câmera.
   * @param {number} dt - tempo do frame em segundos
   * @param {{x,y,z}} subject - posição da bike (CANNON.Vec3 ou Vector3)
   */
  update(dt, subject) {
    if (this.recentering) {
      this.pan.multiplyScalar(Math.exp(-5 * dt)) // decaimento suave até a bike (5 = velocidade; maior = volta mais rápido)
      if (this.pan.lengthSq() < 0.0004) { // menos de 2 cm: considera centralizado
        this.pan.set(0, 0, 0)
        this.recentering = false
      }
    }
    // Segue "bike + pan" com atraso suave; durante um arraste (hold) fica parada
    if (this.following && !this.hold) this.target.lerp(this._desired.copy(subject).add(this.pan), 1 - Math.exp(-this.lag * dt))
    // Amortecimento exponencial: independe da taxa de quadros (60 Hz, 120 Hz…)
    this.zoom = THREE.MathUtils.damp(this.zoom, this.zoomTarget, this.zoomSmoothing, dt)
    this.camera.position.copy(this.target).addScaledVector(this.offset, this.zoom * this.punch)
    this.lookAtPoint.copy(this.target).add(this.look)
    this.camera.lookAt(this.lookAtPoint.add(this.shakeOffset))
    this.yaw = Math.atan2(this.camera.position.x - this.lookAtPoint.x, this.camera.position.z - this.lookAtPoint.z)
  }

  /**
   * Muda o enquadramento continuando a seguir o alvo.
   * Anima offset e look até os valores de `view` (DEFAULT_VIEW ou ZONES[n].view).
   * `overwrite: 'auto'` cancela só as partes conflitantes de tweens anteriores.
   * @param {{offset, look}} view - enquadramento de destino
   * @param {number} duration - segundos
   * @param {string} ease - easing do GSAP
   * @returns {gsap.core.Tween} tween do `look` (dá para usar .then() ao terminar)
   */
  frame(view = this.defaultView, duration = 1.4, ease = 'power2.inOut') {
    gsap.to(this.offset, { ...view.offset, duration, ease, overwrite: 'auto' })
    return gsap.to(this.look, { ...view.look, duration, ease, overwrite: 'auto' })
  }

  /**
   * Plano cinematográfico livre: desliga o follow durante a timeline.
   * Permite animar o próprio target (a câmera "passeia" sem a bike) além de
   * offset e look. Ao terminar, volta a seguir a bike. Não é usado hoje pelo
   * jogo, mas está pronto para cenas futuras.
   * @returns {gsap.core.Timeline}
   */
  cinematic({ target, offset, look, duration = 2, ease = 'power3.inOut' }) {
    this.following = false
    const tl = gsap.timeline({ onComplete: () => (this.following = true) })
    if (target) tl.to(this.target, { ...target, duration, ease }, 0)
    if (offset) tl.to(this.offset, { ...offset, duration, ease }, 0)
    if (look) tl.to(this.look, { ...look, duration, ease }, 0)
    return tl
  }

  /**
   * Tremida rápida (impacto). Usa um vetor próprio para não brigar com frame().
   * A cada atualização do tween, sorteia um deslocamento aleatório no ponto de
   * olhar, com intensidade que diminui linearmente até zero.
   * @param {number} strength - amplitude máxima em metros (0.35 = leve; 0.5 = forte)
   * @param {number} duration - segundos
   */
  shake(strength = 0.35, duration = 0.35) {
    const o = { t: 0 }
    gsap.to(o, {
      t: 1,
      duration,
      ease: 'none',
      overwrite: true,
      onUpdate: () => {
        const k = (1 - o.t) * strength
        this.shakeOffset.set((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, 0)
      },
      onComplete: () => this.shakeOffset.set(0, 0, 0),
    })
  }
}
