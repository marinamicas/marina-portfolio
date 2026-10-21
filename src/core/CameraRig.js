import * as THREE from 'three'
import gsap from 'gsap'

/**
 * Câmera que segue um alvo com atraso suave. Todos os parâmetros (target,
 * offset, look) são Vector3 públicos, então qualquer tween GSAP pode animá-los.
 */
export class CameraRig {
  constructor(camera, defaultView) {
    this.camera = camera
    this.defaultView = defaultView
    this.target = new THREE.Vector3() // ponto seguido
    this.offset = new THREE.Vector3().copy(defaultView.offset)
    this.look = new THREE.Vector3().copy(defaultView.look)
    this.lookAtPoint = new THREE.Vector3()
    this.shakeOffset = new THREE.Vector3()
    this.following = true
    this.lag = 5
    this.yaw = 0 // usado pelos billboards

    // Zoom do jogador: multiplica a distância da câmera (offset).
    // `zoomTarget` muda na hora com o gesto; `zoom` persegue o alvo suavemente a cada frame.
    this.zoom = 1
    this.zoomTarget = 1
    this.zoomLimits = { min: 0.45, max: 1.9 } // 0.45 = bem perto da bike; 1.9 = quase o dobro da distância
    this.zoomSmoothing = 14 // maior = segue o gesto mais rápido (14 ≈ 90% do caminho em 0,16 s)

    // Pan (arrastar a tela): deslocamento da câmera em relação à bike, no chão (x, z).
    // Enquanto `hold` é true (dedo/mouse arrastando), a câmera fica parada onde o
    // jogador deixou, sem perseguir a bike — isso evita que o chão "fuja" do dedo.
    this.pan = new THREE.Vector3()
    this.hold = false
    this.recentering = false // true = o pan volta suavemente a zero (câmera recentraliza na bike)
    this.panBounds = null // { minX, maxX, minZ, maxZ }: até onde a câmera pode ir

    // "Punch" cinematográfico: aproximação extra e passageira (atropelos)
    this.punch = 1

    this._desired = new THREE.Vector3() // vetor reaproveitado (evita criar objetos a cada frame)
  }

  /** Move a câmera no chão por (dx, dz) metros, na hora (pan do jogador e borda da tela). */
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

  /** Começa um arraste: a câmera para de seguir a bike até `release()`. */
  grab() {
    this.hold = true
    this.recentering = false
  }

  /** Fim do arraste: guarda onde a câmera ficou em relação à bike e volta a acompanhá-la. */
  release(subject) {
    this.hold = false
    this.pan.set(this.target.x - subject.x, 0, this.target.z - subject.z)
  }

  /** Volta a câmera para a bike suavemente (teclado, rebobinar, toque duplo). */
  recenter() {
    if (this.hold || (!this.recentering && this.pan.lengthSq() === 0)) return
    this.recentering = true
  }

  /** Efeito de câmera do atropelo: aproxima rápido e volta devagar. */
  cinematicPunch(strength = 0.72, duration = 1.1) {
    gsap.timeline({ overwrite: true })
      .to(this, { punch: strength, duration: duration * 0.18, ease: 'power3.out' })
      .to(this, { punch: 1, duration: duration * 0.82, ease: 'power2.inOut' })
  }

  /** Aplica um zoom relativo em escala logarítmica (positivo afasta, negativo aproxima). */
  zoomBy(logDelta) {
    if (!logDelta) return
    const { min, max } = this.zoomLimits
    this.zoomTarget = THREE.MathUtils.clamp(this.zoomTarget * Math.exp(logDelta), min, max)
  }

  /** Volta suavemente ao zoom padrão. */
  resetZoom() {
    this.zoomTarget = 1
  }

  /** Atualiza a câmera; chamado uma vez por frame com o tempo do frame e o ponto seguido. */
  update(dt, subject) {
    if (this.recentering) {
      this.pan.multiplyScalar(Math.exp(-5 * dt)) // decaimento suave até a bike
      if (this.pan.lengthSq() < 0.0004) {
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

  /** Muda o enquadramento continuando a seguir o alvo. */
  frame(view = this.defaultView, duration = 1.4, ease = 'power2.inOut') {
    gsap.to(this.offset, { ...view.offset, duration, ease, overwrite: 'auto' })
    return gsap.to(this.look, { ...view.look, duration, ease, overwrite: 'auto' })
  }

  /** Plano cinematográfico livre: desliga o follow durante a timeline. */
  cinematic({ target, offset, look, duration = 2, ease = 'power3.inOut' }) {
    this.following = false
    const tl = gsap.timeline({ onComplete: () => (this.following = true) })
    if (target) tl.to(this.target, { ...target, duration, ease }, 0)
    if (offset) tl.to(this.offset, { ...offset, duration, ease }, 0)
    if (look) tl.to(this.look, { ...look, duration, ease }, 0)
    return tl
  }

  /** Tremida rápida (impacto). Usa um vetor próprio para não brigar com frame(). */
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
