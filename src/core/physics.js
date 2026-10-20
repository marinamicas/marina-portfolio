import * as CANNON from 'cannon-es'

export const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) })
world.broadphase = new CANNON.SAPBroadphase(world)
world.allowSleep = true
world.defaultContactMaterial.friction = 0.15
world.defaultContactMaterial.restitution = 0.2

export const materials = {
  ground: new CANNON.Material('ground'),
  bike: new CANNON.Material('bike'),
}

// A velocidade da bike é controlada pelo código (estilo arcade): sem atrito com o chão
world.addContactMaterial(new CANNON.ContactMaterial(materials.ground, materials.bike, { friction: 0, restitution: 0 }))

const groundBody = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane(), material: materials.ground })
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
world.addBody(groundBody)
