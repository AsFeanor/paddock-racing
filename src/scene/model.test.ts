import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { normalizeHorse } from './model'

describe('the bundled animated horse', () => {
  it('keeps cloned skin geometry at course scale after its first animation frame', async () => {
    const bytes = await readFile(new URL('../../public/assets/horse.glb', import.meta.url))
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    const gltf = await new GLTFLoader().parseAsync(data, '')
    const model = clone(gltf.scene)
    normalizeHorse(model)
    const mixer = new THREE.AnimationMixer(model)
    mixer.clipAction(gltf.animations.find((clip) => clip.name === 'Idle')!).play()
    mixer.setTime(0.2)
    model.updateMatrixWorld(true)
    model.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh) {
        object.skeleton.update()
        object.computeBoundingBox()
      }
    })
    const bounds = new THREE.Box3().setFromObject(model)
    const size = bounds.getSize(new THREE.Vector3())
    // The former stale bind-matrix bug silently reduced the horse to ~0.04 units.
    expect(size.x).toBeGreaterThan(3)
    expect(size.x).toBeLessThan(3.6)
    expect(size.y).toBeGreaterThan(2.5)
    expect(size.y).toBeLessThan(3.1)
    expect(Math.abs(bounds.min.y)).toBeLessThan(0.1)
    const gallop = gltf.animations.find((clip) => clip.name === 'Gallop')!
    expect(gallop).toBeDefined()
    mixer.stopAllAction()
    mixer.clipAction(gallop).play()
    for (const time of [0, 0.2, 0.5]) {
      mixer.setTime(time)
      model.updateMatrixWorld(true)
      model.traverse((object) => {
        if (object instanceof THREE.SkinnedMesh) {
          object.skeleton.update()
          object.computeBoundingBox()
        }
      })
      bounds.setFromObject(model)
      bounds.getSize(size)
      // Extended gallop legs change total length, but the rig must remain on-course.
      expect(size.x).toBeGreaterThan(3)
      expect(size.x).toBeLessThan(5)
      expect(size.y).toBeGreaterThan(2)
      expect(size.y).toBeLessThan(3.2)
      expect(bounds.min.y).toBeGreaterThan(-0.1)
      expect(bounds.min.y).toBeLessThan(0.5)
    }
  })
})
