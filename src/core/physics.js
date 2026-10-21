import * as CANNON from 'cannon-es'

/* ==========================================================================
   MUNDO FÍSICO (cannon-es)

   Papel deste arquivo:
   - Cria o único mundo físico do jogo: gravidade, colisões da bike com os
     prismas do cenário, placas e pedaços de papel, e o chão infinito.
   - Define os "materiais de contato" (atrito e quique entre superfícies).
   - O passo da simulação NÃO é dado aqui: é o loop principal (src/main.js)
     que chama `world.step()` uma vez por frame.

   Dependências: cannon-es.
   Quem usa: bike.js (corpo da bike), environment.js (prismas e placas),
   totems.js (pedaços de papel), timeMachine.js, main.js (step).

   Onde mexer:
   - gravity: força da gravidade (−9.82 = Terra). Mais negativo = pedaços de papel caem mais rápido.
   - defaultContactMaterial.friction / restitution: atrito e quique padrão de tudo que não tem material próprio.
   - ContactMaterial(ground, bike): atrito da bike com o chão (hoje zero, porque a velocidade é controlada por código).
   ========================================================================== */

// SAPBroadphase: acelera a busca de colisões quando há muitos corpos espalhados no mapa.
// allowSleep: corpos parados "dormem" e deixam de gastar processamento.
// `world` é o mundo físico único e global; todos os corpos (bike, prismas, papéis) são adicionados nele.
export const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) }) // gravidade em m/s² apontando para baixo (y negativo)
world.broadphase = new CANNON.SAPBroadphase(world)
world.allowSleep = true
world.defaultContactMaterial.friction = 0.15 // atrito padrão entre corpos sem material próprio (0 = escorrega; 1 = agarra)
world.defaultContactMaterial.restitution = 0.2 // quique padrão (0 = não quica; 1 = quica com toda a energia)

// Materiais de contato: definem atrito/quique entre pares de superfícies.
// `ground` é usado pelo chão; `bike` pela caixa de colisão da bike (bike.js).
export const materials = {
  ground: new CANNON.Material('ground'),
  bike: new CANNON.Material('bike'),
}

// A velocidade da bike é controlada pelo código (estilo arcade): sem atrito com o chão.
// friction 0 = o chão não freia a bike; restitution 0 = a bike não quica ao tocar o chão.
world.addContactMaterial(new CANNON.ContactMaterial(materials.ground, materials.bike, { friction: 0, restitution: 0 }))

// Chão infinito: um plano estático girado para ficar deitado (normal apontando para cima).
// STATIC = nunca se move; Plane = superfície infinita. O plano nasce "em pé" (normal em +Z),
// por isso a rotação de −90° em X para deitá-lo (normal em +Y).
const groundBody =new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane(), material: materials.ground })
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
world.addBody(groundBody)
