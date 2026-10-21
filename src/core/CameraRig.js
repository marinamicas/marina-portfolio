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
    if (this.following) this.target.lerp(subject, 1 - Math.exp(-this.lag * dt))
    // Amortecimento exponencial: independe da taxa de quadros (60 Hz, 120 Hz…)
    this.zoom = THREE.MathUtils.damp(this.zoom, this.zoomTarget, this.zoomSmoothing, dt)
    this.camera.position.copy(this.target).addScaledVector(this.offset, this.zoom)
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
