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
  }

  update(dt, subject) {
    if (this.following) this.target.lerp(subject, 1 - Math.exp(-this.lag * dt))
    this.camera.position.copy(this.target).add(this.offset)
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
