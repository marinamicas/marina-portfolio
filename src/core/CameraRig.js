import * as THREE from 'three'
import gsap from 'gsap'

/* ==========================================================================
   CÂMERA QUE SEGUE A BIKE (CameraRig)

   Papel deste arquivo:
   - Define a classe CameraRig, que posiciona a câmera do Three.js a cada frame
     em relação a um "alvo" (a bike). A câmera SEGUE A BIKE O TEMPO TODO: não há
     mais pan (arrastar o cenário). O que muda a distância é só:
       • o zoom do jogador (roda, pinça, teclas + / −; toque duplo volta ao normal);
       • eventos programados: aproximação do atropelo (cinematicPunch), tremida
         (shake), enquadramentos das zonas (frame) e a abertura (intro.js).
   - Todos os parâmetros importantes (target, offset, look, zoom, punch) são
     propriedades públicas e numéricas, então qualquer tween do GSAP pode animá-los.

   Dependências: three (Vector3, MathUtils) e gsap (animações).
   Quem usa: src/main.js cria `new CameraRig(camera, DEFAULT_VIEW)` e chama
   `rig.update(dt, bike.body.position)` uma vez por frame; src/world/intro.js
   anima offset/look durante a abertura.

   Como a posição final da câmera é calculada (ver update()):
     posição = target + offset × zoom × punch
     olhar   = target + look (+ tremida)

   Onde mexer:
   - zoomLimits (constructor): quão perto/longe o jogador pode dar zoom.
   - zoomSmoothing (constructor): suavidade do zoom (maior = mais imediato).
   - lag (constructor; main.js altera por frame): quão rápido a câmera alcança
     a bike (maior = cola mais; menor = mais "flutuante").
   - cinematicPunch(strength, duration): intensidade da aproximação no atropelo.
   - shake(strength, duration): força e duração da tremida.
   - Os enquadramentos (offset/look) ficam em src/data/level.js (DEFAULT_VIEW e ZONES).
   ========================================================================== */

export class CameraRig {
  /**
   * Cria o rig e guarda o enquadramento padrão.
   * @param {THREE.PerspectiveCamera} camera - a câmera real do Three.js que será movida
   * @param {{offset:{x,y,z}, look:{x,y,z}}} defaultView - enquadramento padrão (DEFAULT_VIEW do level.js)
   */
  constructor(camera, defaultView) {
    this.camera = camera
    this.defaultView = defaultView
    this.target = new THREE.Vector3() // ponto seguido (em metros, no mundo): a bike
    this.offset = new THREE.Vector3().copy(defaultView.offset) // onde a câmera fica EM RELAÇÃO ao target (x, altura, z)
    this.look = new THREE.Vector3().copy(defaultView.look) // para onde a câmera olha, EM RELAÇÃO ao target
    this.lookAtPoint = new THREE.Vector3() // ponto absoluto para o qual a câmera olha (recalculado a cada frame)
    this.shakeOffset = new THREE.Vector3() // deslocamento aleatório da tremida (zero quando não está tremendo)
    this.following = true // false só durante um plano cinematográfico livre (cinematic())
    this.lag = 8 // quão rápido alcança a bike: maior = cola mais rápido
    this.yaw = 0 // ângulo horizontal da câmera (radianos); usado pelos billboards para encararem a câmera

    // Zoom do jogador: multiplica a distância da câmera (offset).
    // `zoomTarget` muda na hora com o gesto; `zoom` persegue o alvo suavemente a cada frame.
    this.zoom = 1 // zoom atual (1 = distância normal; <1 mais perto; >1 mais longe)
    this.zoomTarget = 1 // zoom pedido pelo jogador; `zoom` vai até ele suavemente
    this.zoomLimits = { min: 0.45, max: 1.9 } // 0.45 = bem perto da bike; 1.9 = quase o dobro da distância
    this.zoomSmoothing = 14 // maior = segue o gesto mais rápido (14 ≈ 90% do caminho em 0,16 s)

    // "Punch" cinematográfico: aproximação extra e passageira (atropelos)
    this.punch = 1 // multiplicador momentâneo da distância (1 = normal; 0.72 = 28% mais perto)

    this._desired = new THREE.Vector3() // vetor reaproveitado (evita criar objetos a cada frame)
  }

  /**
   * Efeito de câmera do atropelo: aproxima rápido e volta devagar.
   * Anima `punch` com GSAP: 18% do tempo indo até `strength` e 82% voltando a 1.
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
   * Somar deltas = multiplicar fatores, então afastar X e aproximar X volta ao mesmo lugar.
   * O resultado é limitado por zoomLimits.
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
   * Coloca a câmera exatamente sobre o alvo, sem atraso (usado na abertura e em teleportes).
   * @param {{x,y,z}} subject
   */
  snapTo(subject) {
    this.target.set(subject.x, subject.y, subject.z)
  }

  /**
   * Atualiza a câmera; chamado uma vez por frame com o tempo do frame e o ponto seguido.
   * 1. O target vai suavemente até a bike (atraso controlado por `lag`, independente da taxa de quadros).
   * 2. O zoom atual persegue o zoomTarget.
   * 3. posição = target + offset × zoom × punch; olhar = target + look + tremida.
   * 4. Calcula `yaw` (ângulo horizontal) para os billboards encararem a câmera.
   * @param {number} dt - tempo do frame em segundos
   * @param {{x,y,z}} subject - posição da bike (CANNON.Vec3 ou Vector3)
   */
  update(dt, subject) {
    if (this.following) this.target.lerp(this._desired.set(subject.x, subject.y, subject.z), 1 - Math.exp(-this.lag * dt))
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
   * Plano cinematográfico livre: desliga o follow durante a timeline (a câmera
   * "passeia" sem a bike). Ao terminar, volta a seguir a bike. Pronto para cenas futuras.
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
