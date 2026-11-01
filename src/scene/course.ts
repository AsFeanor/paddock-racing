import * as THREE from 'three'

export const COURSE_START = -32
export const COURSE_FINISH = 32
export const LANE_GAP = 2.25
export const COURSE_FLOODLIGHTS = [
  { x: -28, z: -15.5, targetX: -17 },
  { x: 28, z: -15.5, targetX: 17 },
] as const

interface ThemedMaterial {
  material: THREE.MeshStandardMaterial
  day: THREE.Color
  night: THREE.Color
  glow?: THREE.Color
}
const coursePalettes = new WeakMap<THREE.Group, ThemedMaterial[]>()

/** Blend existing materials in place so changing theme never recreates the course. */
export function applyCourseTheme(course: THREE.Group, night: number) {
  for (const entry of coursePalettes.get(course) ?? []) {
    entry.material.color.copy(entry.day).lerp(entry.night, night)
    if (entry.glow) {
      entry.material.emissive.copy(entry.glow)
      entry.material.emissiveIntensity = night * 1.5
    }
  }
}

export function laneZ(index: number) {
  return (index - 4.5) * LANE_GAP
}

function roundedRectangle(width: number, depth: number, radius: number) {
  const shape = new THREE.Shape()
  const x = -width / 2
  const y = -depth / 2
  shape.moveTo(x + radius, y)
  shape.lineTo(x + width - radius, y)
  shape.quadraticCurveTo(x + width, y, x + width, y + radius)
  shape.lineTo(x + width, y + depth - radius)
  shape.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth)
  shape.lineTo(x + radius, y + depth)
  shape.quadraticCurveTo(x, y + depth, x, y + depth - radius)
  shape.lineTo(x, y + radius)
  shape.quadraticCurveTo(x, y, x + radius, y)
  return shape
}

export function makeTextTexture(text: string, ink = '#f2efda', background?: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const context = canvas.getContext('2d')!
  if (background) {
    context.fillStyle = background
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  context.fillStyle = ink
  context.font = '500 55px Georgia, serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, 256, 68)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** A miniature racecourse, deliberately built from reusable low-cost geometry. */
export function createCourse() {
  const group = new THREE.Group()
  const palette: ThemedMaterial[] = []
  coursePalettes.set(group, palette)
  function themed(day: string, night: string, roughness = 0.9, metalness = 0, glow?: string) {
    const mat = new THREE.MeshStandardMaterial({ color: day, roughness, metalness })
    palette.push({
      material: mat,
      day: new THREE.Color(day),
      night: new THREE.Color(night),
      glow: glow ? new THREE.Color(glow) : undefined,
    })
    return mat
  }
  const turf = themed('#54775d', '#315443')
  const paleTurf = themed('#5d8066', '#385e49')
  const moss = themed('#405f4a', '#263e32')
  const ivory = themed('#eae6d4', '#cecbb4')
  const chalk = themed('#d8dfbd', '#9fae95')
  const stone = themed('#a9af9d', '#293d33')
  const dark = themed('#254336', '#1b3027')
  const gold = themed('#b49c65', '#bb9b64', 0.6, 0.35)
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1)

  function box(
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
  ) {
    const mesh = new THREE.Mesh(boxGeometry, mat)
    mesh.scale.set(width, height, depth)
    mesh.position.set(x, y, z)
    mesh.castShadow = height > 0.2
    mesh.receiveShadow = true
    group.add(mesh)
    return mesh
  }

  const baseGeometry = new THREE.ExtrudeGeometry(roundedRectangle(85, 39, 3.5), {
    depth: 1.05,
    bevelEnabled: true,
    bevelThickness: 0.35,
    bevelSize: 0.35,
    bevelSegments: 3,
    steps: 1,
  })
  baseGeometry.rotateX(-Math.PI / 2)
  const base = new THREE.Mesh(baseGeometry, stone)
  base.position.y = -1.5
  base.castShadow = true
  base.receiveShadow = true
  group.add(base)

  const lawnGeometry = new THREE.ShapeGeometry(roundedRectangle(84.6, 38.6, 3.4))
  lawnGeometry.rotateX(-Math.PI / 2)
  const lawn = new THREE.Mesh(lawnGeometry, turf)
  lawn.position.y = -0.05
  lawn.receiveShadow = true
  group.add(lawn)

  // Alternating mowing bands add depth without a texture download.
  for (let index = 0; index < 10; index++) {
    box(6.4, 0.012, 22.8, -28.8 + index * 6.4, 0, 0, index % 2 ? turf : paleTurf)
  }
  for (let index = 0; index < 11; index++) {
    const z = -11.25 + index * LANE_GAP
    for (let segment = 0; segment < 24; segment++) {
      box(1.1, 0.018, 0.022, -31 + segment * 2.7, 0.015, z, chalk)
    }
  }

  // Finish paint stays flush to the turf; horses finish at exactly x = 32.
  for (let row = 0; row < 30; row++) {
    for (let col = 0; col < 2; col++) {
      box(
        0.48,
        0.026,
        0.75,
        COURSE_FINISH + (col - 0.5) * 0.48,
        0.035,
        -10.875 + row * 0.75,
        (row + col) % 2 ? dark : ivory,
      )
    }
  }

  // Ivory rails and brass post caps give the diorama its racing-club character.
  for (const side of [-1, 1]) {
    const z = side * 12.3
    for (let x = -37; x <= 37; x += 4) {
      box(0.16, 1.45, 0.16, x, 0.72, z, ivory)
      box(0.23, 0.08, 0.23, x, 1.49, z, gold)
    }
    box(75, 0.13, 0.13, 0, 1.3, z, ivory)
    box(75, 0.1, 0.1, 0, 0.72, z, ivory)
    box(76, 0.05, 0.6, 0, 0.03, side * 13, moss)
  }

  // A simple open starting gate leaves the runners visible from every camera.
  for (let index = 0; index <= 10; index++) {
    const z = -11.25 + index * LANE_GAP
    box(0.13, 2.85, 0.13, -34.7, 1.425, z, dark)
  }
  box(0.18, 0.24, 22.75, -34.7, 2.85, 0, dark)
  box(0.3, 0.11, 23.3, -34.7, 3.02, 0, gold)

  for (const z of [-12.25, 12.25]) {
    box(0.28, 4.2, 0.28, COURSE_FINISH, 2.1, z, ivory)
    box(0.48, 0.25, 0.48, COURSE_FINISH, 4.3, z, gold)
    box(0.75, 0.2, 0.75, COURSE_FINISH, 0.12, z, stone)
  }

  // The same small fixtures become warm floodlights in the night presentation.
  const lampFace = themed('#e6dfc9', '#f5d8a1', 0.55, 0, '#ffc77e')
  for (const light of COURSE_FLOODLIGHTS) {
    box(0.22, 12.8, 0.22, light.x, 6.4, light.z, dark)
    box(0.7, 0.2, 0.7, light.x, 0.1, light.z, stone)
    const head = box(2.2, 0.28, 0.68, light.x, 12.85, light.z, gold)
    head.rotation.x = Math.sign(light.z) * -0.35
    const lens = box(1.95, 0.06, 0.51, light.x, 12.65, light.z, lampFace)
    lens.rotation.x = head.rotation.x
  }

  // Sculpted trees, subtly varied but deterministic across visits.
  const trunkGeometry = new THREE.CylinderGeometry(0.12, 0.18, 1.8, 6)
  const crownGeometry = new THREE.IcosahedronGeometry(1, 1)
  const trunkMaterial = themed('#77664f', '#4e4939')
  const foliage = [
    themed('#355b45', '#254336'),
    themed('#537252', '#35523d'),
    themed('#6f8056', '#465b3e'),
  ]
  for (let index = 0; index < 15; index++) {
    const x = -38 + index * 5.4
    const z = index % 2 ? -16.9 : -17.6
    const height = 2.8 + (index % 4) * 0.32
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial)
    trunk.position.set(x, 0.9, z)
    trunk.castShadow = true
    group.add(trunk)
    const crown = new THREE.Mesh(crownGeometry, foliage[index % 3])
    crown.position.set(x, height, z)
    crown.scale.set(1.15, height * 0.66, 1.2)
    crown.rotation.y = index * 1.7
    crown.castShadow = true
    group.add(crown)
  }

  // Trackside pavilion: low, architectural, and clear of the view of the horses.
  box(13, 0.35, 3.2, 10, 0.2, -16.2, stone)
  for (const x of [4.5, 8.1, 11.9, 15.5]) {
    box(0.16, 2.75, 0.16, x, 1.55, -15.2, ivory)
    box(0.16, 2.75, 0.16, x, 1.55, -17.3, ivory)
  }
  const roof = box(13.5, 0.25, 3.6, 10, 3.1, -16.2, dark)
  roof.rotation.x = 0.06
  box(13.7, 0.055, 0.08, 10, 3.27, -14.4, gold)
  box(11.4, 0.45, 0.75, 10, 0.7, -16.6, ivory)
  box(11.4, 0.8, 0.13, 10, 1.2, -17, dark)

  const nameTexture = makeTextTexture('P A D D O C K', '#e8e7d6', '#294936')
  const nameplate = new THREE.Mesh(
    new THREE.PlaneGeometry(10.2, 2.55),
    new THREE.MeshBasicMaterial({ map: nameTexture }),
  )
  nameplate.position.set(0, 0.04, 16)
  nameplate.rotation.x = -Math.PI / 2
  group.add(nameplate)

  return group
}

export function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  root.traverse((object) => {
    if (object instanceof THREE.DirectionalLight || object instanceof THREE.SpotLight)
      object.shadow.dispose()
    if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose()
    if (!(object instanceof THREE.Mesh)) return
    geometries.add(object.geometry)
    for (const mat of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(mat)
      for (const value of Object.values(mat)) {
        if (value instanceof THREE.Texture) textures.add(value)
      }
    }
  })
  textures.forEach((texture) => texture.dispose())
  materials.forEach((mat) => mat.dispose())
  geometries.forEach((geometry) => geometry.dispose())
}
