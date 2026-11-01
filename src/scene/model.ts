import * as THREE from 'three'

function skinBounds(model: THREE.Object3D) {
  // Box3's updateWorldMatrix does not update a SkinnedMesh's inverse bind matrix.
  // A cloned rig must update its full world and bone matrices before measuring it.
  model.updateMatrixWorld(true)
  model.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) {
      object.skeleton.update()
      object.computeBoundingBox()
      object.computeBoundingSphere()
    }
  })
  return new THREE.Box3().setFromObject(model)
}

/** Orient the complete animated rig, size it to the course, and put its feet on turf. */
export function normalizeHorse(model: THREE.Object3D) {
  model.rotation.y = Math.PI / 2
  const original = skinBounds(model)
  const length = original.getSize(new THREE.Vector3()).x
  if (!Number.isFinite(length) || length <= 0) throw new Error('Invalid horse model bounds.')
  model.scale.multiplyScalar(3.4 / length)
  const bounds = skinBounds(model)
  const center = bounds.getCenter(new THREE.Vector3())
  model.position.set(-center.x, -bounds.min.y, -center.z)
  model.updateMatrixWorld(true)
}
