<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { useRaceStore } from '../stores/race'
import {
  COURSE_FINISH,
  COURSE_START,
  COURSE_FLOODLIGHTS,
  applyCourseTheme,
  createCourse,
  disposeObject,
  laneZ,
} from '../scene/course'
import type { Horse } from '../domain/race'
import { normalizeHorse } from '../scene/model'

const props = withDefaults(
  defineProps<{
    selectedHorseId?: string | null
    cameraMode?: 'overview' | 'follow' | 'finish'
    theme?: 'light' | 'dark'
  }>(),
  { selectedHorseId: null, cameraMode: 'overview', theme: 'light' },
)
const emit = defineEmits<{
  select: [horseId: string]
  ready: []
  fallback: [reason: string]
}>()
const race = useRaceStore()
const host = ref<HTMLElement>()
const loaded = ref(false)
const hoveredHorseId = ref<string | null>(null)
const displayedHorses = computed(() =>
  race.currentHorses.length ? race.currentHorses : race.horses.slice(0, 10),
)
const labelElements = new Map<string, HTMLElement>()
const runners = new Map<string, SceneRunner>()
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const cameraPosition = new THREE.Vector3()
const cameraTarget = new THREE.Vector3()
const targetPosition = new THREE.Vector3()
const targetLookAt = new THREE.Vector3()
const projected = new THREE.Vector3()
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

interface SceneRunner {
  root: THREE.Group
  model: THREE.Object3D
  mixer: THREE.AnimationMixer
  gallop: THREE.AnimationAction
  idle: THREE.AnimationAction
  jockey: THREE.Group
  halo: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  phase: number
  galloping: boolean
  animationTime: number
}

let scene: THREE.Scene | undefined
let renderer: THREE.WebGLRenderer | undefined
let camera: THREE.PerspectiveCamera | undefined
let modelTemplate: THREE.Object3D | undefined
let course: THREE.Group | undefined
let hemisphere: THREE.HemisphereLight | undefined
let keyLight: THREE.DirectionalLight | undefined
let fillLight: THREE.DirectionalLight | undefined
let floorMaterial: THREE.MeshStandardMaterial | undefined
const floodLights: THREE.SpotLight[] = []
let nightBlend = props.theme === 'dark' ? 1 : 0
let appliedNightBlend = -1
const lightingPalette = {
  background: [new THREE.Color('#e9e8df'), new THREE.Color('#101c18')],
  floor: [new THREE.Color('#e9e8df'), new THREE.Color('#15251e')],
  sky: [new THREE.Color('#fff9e7'), new THREE.Color('#a0bdc4')],
  ground: [new THREE.Color('#718271'), new THREE.Color('#263c31')],
  key: [new THREE.Color('#fff3da'), new THREE.Color('#b9cde0')],
  fill: [new THREE.Color('#e0e9ed'), new THREE.Color('#dfc293')],
}
let resizeObserver: ResizeObserver | undefined
let intersectionObserver: IntersectionObserver | undefined
let frameId = 0
let disposed = false
let failed = false
let inView = true
let previousFrame = 0
let width = 1
let height = 1
let orbitX = 0
let orbitY = 0
let lastCameraMode = props.cameraMode
let lastAnimationStamp = ''
let drag: { x: number; y: number; startX: number; startY: number; moved: boolean } | null = null

function labelRef(id: string, element: unknown) {
  if (element instanceof HTMLElement) labelElements.set(id, element)
  else labelElements.delete(id)
}

function makeJockey(color: string) {
  const group = new THREE.Group()
  const silks = new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
  const ivory = new THREE.MeshStandardMaterial({ color: '#f1ead6', roughness: 0.9 })
  const leather = new THREE.MeshStandardMaterial({ color: '#342c25', roughness: 0.9 })
  const skin = new THREE.MeshStandardMaterial({ color: '#d6b38b', roughness: 1 })
  function ellipsoid(
    radius: number,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    mat: THREE.Material,
  ) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), mat)
    mesh.position.set(x, y, z)
    mesh.scale.set(sx, sy, sz)
    mesh.castShadow = true
    group.add(mesh)
    return mesh
  }
  function limb(from: THREE.Vector3, to: THREE.Vector3, radius: number, mat: THREE.Material) {
    const direction = to.clone().sub(from)
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 0.9, direction.length(), 6),
      mat,
    )
    mesh.position.copy(from).add(to).multiplyScalar(0.5)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
    mesh.castShadow = true
    group.add(mesh)
  }
  // A small crouched rider makes each horse's unique racing silk readable in 3D.
  ellipsoid(0.5, -0.4, 1.86, 0, 1.1, 0.3, 1.13, silks)
  const torso = ellipsoid(0.28, -0.2, 2.26, 0, 1.28, 0.62, 0.75, silks)
  torso.rotation.z = -0.35
  ellipsoid(0.16, 0.14, 2.44, 0, 0.9, 1, 0.9, skin)
  ellipsoid(0.18, 0.14, 2.52, 0, 1.1, 0.78, 1.1, silks)
  for (const side of [-1, 1]) {
    limb(
      new THREE.Vector3(-0.47, 2.05, side * 0.16),
      new THREE.Vector3(-0.1, 1.83, side * 0.44),
      0.105,
      ivory,
    )
    limb(
      new THREE.Vector3(-0.1, 1.83, side * 0.44),
      new THREE.Vector3(-0.55, 1.57, side * 0.44),
      0.075,
      leather,
    )
    limb(
      new THREE.Vector3(-0.05, 2.28, side * 0.18),
      new THREE.Vector3(0.36, 2.06, side * 0.23),
      0.065,
      ivory,
    )
  }
  return group
}

function buildRunner(
  horse: Horse,
  index: number,
  template: THREE.Object3D,
  animations: THREE.AnimationClip[],
) {
  const root = new THREE.Group()
  root.userData.horseId = horse.id
  const model = clone(template)
  normalizeHorse(model)
  model.traverse((object) => {
    object.userData.horseId = horse.id
    if (object instanceof THREE.Mesh) {
      object.castShadow = true
      object.receiveShadow = true
      // Animated legs can leave the rest-pose bounds; only ten runners are visible.
      if (object instanceof THREE.SkinnedMesh) object.frustumCulled = false
      // Share geometry, but keep material changes independent for every runner.
      object.material = Array.isArray(object.material)
        ? object.material.map((material) => material.clone())
        : object.material.clone()
    }
  })
  root.add(model)
  const jockey = makeJockey(horse.color)
  root.add(jockey)
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.66, 0.76, 48),
    new THREE.MeshBasicMaterial({
      color: horse.color,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  halo.rotation.x = -Math.PI / 2
  halo.scale.set(2.8, 1.25, 1)
  halo.position.y = 0.055
  halo.visible = false
  root.add(halo)
  const mixer = new THREE.AnimationMixer(model)
  const gallopClip =
    animations.find((clip) => clip.name === 'Gallop') ??
    animations.find((clip) => /gallop|run/i.test(clip.name)) ??
    animations[0]
  const idleClip = animations.find((clip) => clip.name === 'Idle') ?? gallopClip
  if (!gallopClip || !idleClip) throw new Error('The horse model has no animation clips.')
  const gallop = mixer.clipAction(gallopClip)
  const idle = mixer.clipAction(idleClip)
  idle.play()
  const phase = index * 0.079
  mixer.setTime(phase)
  root.visible = false
  scene!.add(root)
  runners.set(horse.id, {
    root,
    model,
    mixer,
    gallop,
    idle,
    jockey,
    halo,
    phase,
    galloping: false,
    animationTime: 0,
  })
}

function resize() {
  if (!host.value || !renderer || !camera) return
  width = Math.max(1, host.value.clientWidth)
  height = Math.max(1, host.value.clientHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, width < 650 ? 1.5 : 2))
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  resumeRendering()
}

function updateRunners() {
  const activeIds = new Set(displayedHorses.value.map((horse) => horse.id))
  for (const [id, runner] of runners) runner.root.visible = activeIds.has(id)
  const positions = race.positions
  const stamp = `${race.currentRound?.id}-${race.elapsedSeconds}-${race.status}-${reducedMotion.matches}`
  const updateAnimation = stamp !== lastAnimationStamp
  displayedHorses.value.forEach((horse, index) => {
    const runner = runners.get(horse.id)
    if (!runner) return
    const progress = positions[horse.id] ?? 0
    runner.root.position.set(
      COURSE_START + (progress / 100) * (COURSE_FINISH - COURSE_START),
      0.025,
      laneZ(index),
    )
    const selected = props.selectedHorseId === horse.id
    runner.halo.visible = selected || hoveredHorseId.value === horse.id
    runner.halo.material.opacity = selected ? 0.85 : 0.42
    if (updateAnimation) {
      const galloping = race.elapsedSeconds > 0 && progress < 100 && !reducedMotion.matches
      if (galloping !== runner.galloping) {
        runner.idle.stop()
        runner.gallop.stop()
        ;(galloping ? runner.gallop : runner.idle).reset().play()
        runner.galloping = galloping
      }
      // Derive the animation time from the simulation; pause freezes every hoof.
      runner.animationTime = galloping ? race.elapsedSeconds / 8 + runner.phase : runner.phase
      runner.mixer.setTime(runner.animationTime)
      runner.jockey.position.y =
        0.24 + (galloping ? Math.sin((runner.animationTime * Math.PI * 2) / 0.583333) * 0.045 : 0)
    }
  })
  lastAnimationStamp = stamp
}

function chooseCamera(delta: number, immediate = false) {
  if (!camera) return false
  const horseId = props.selectedHorseId ?? race.leader?.id ?? displayedHorses.value[0]?.id
  const focused = horseId ? runners.get(horseId) : undefined
  const focusX = focused?.root.position.x ?? COURSE_START
  const focusZ = focused?.root.position.z ?? 0
  if (lastCameraMode !== props.cameraMode) {
    orbitX = 0
    orbitY = 0
    lastCameraMode = props.cameraMode
  }
  if (props.cameraMode === 'follow') {
    targetLookAt.set(focusX + 1.5, 0.8, focusZ * 0.3)
    targetPosition.set(focusX + 8, width < 600 ? 17 : 13, focusZ * 0.3 + (width < 600 ? 31 : 22))
  } else if (props.cameraMode === 'finish') {
    targetLookAt.set(26, 0.7, 0)
    targetPosition.set(45, width < 600 ? 27 : 22, width < 600 ? 39 : 31)
  } else {
    targetLookAt.set(0, 0.1, -0.5)
    if (width / height < 1.15) targetPosition.set(89, 66, 36)
    else targetPosition.set(10, 64, 55)
  }
  const offset = targetPosition.clone().sub(targetLookAt)
  offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), orbitX)
  offset.y *= 1 + orbitY
  targetPosition.copy(targetLookAt).add(offset)
  const smoothing = immediate || reducedMotion.matches ? 1 : 1 - Math.exp(-delta * 5)
  cameraPosition.lerp(targetPosition, smoothing)
  cameraTarget.lerp(targetLookAt, smoothing)
  camera.position.copy(cameraPosition)
  camera.lookAt(cameraTarget)
  return (
    cameraPosition.distanceToSquared(targetPosition) > 0.0001 ||
    cameraTarget.distanceToSquared(targetLookAt) > 0.0001
  )
}

function updateLabels() {
  if (!camera) return
  displayedHorses.value.forEach((horse) => {
    const runner = runners.get(horse.id)
    const label = labelElements.get(horse.id)
    if (!runner || !label) return
    projected.copy(runner.root.position)
    projected.y += 3.2
    projected.project(camera!)
    const visible =
      projected.z >= -1 &&
      projected.z <= 1 &&
      Math.abs(projected.x) < 0.97 &&
      Math.abs(projected.y) < 0.98
    label.style.visibility = visible ? 'visible' : 'hidden'
    label.style.transform = `translate(-50%, -100%) translate(${(projected.x * 0.5 + 0.5) * width}px, ${(-projected.y * 0.5 + 0.5) * height}px)`
    label.style.zIndex = String(Math.round((1 - projected.z) * 1000))
  })
}

function updateLighting(delta: number, immediate = false) {
  if (!scene || !renderer || !course || !hemisphere || !keyLight || !fillLight || !floorMaterial)
    return false
  const target = props.theme === 'dark' ? 1 : 0
  const blend = immediate || reducedMotion.matches ? 1 : 1 - Math.exp(-delta * 6)
  nightBlend = THREE.MathUtils.lerp(nightBlend, target, blend)
  const changing = Math.abs(nightBlend - target) > 0.002
  if (!changing) nightBlend = target
  if (appliedNightBlend === nightBlend) return false
  const color = (destination: THREE.Color, values: THREE.Color[]) =>
    destination.copy(values[0]!).lerp(values[1]!, nightBlend)
  color(scene.background as THREE.Color, lightingPalette.background)
  color((scene.fog as THREE.Fog).color, lightingPalette.background)
  color(floorMaterial.color, lightingPalette.floor)
  color(hemisphere.color, lightingPalette.sky)
  color(hemisphere.groundColor, lightingPalette.ground)
  color(keyLight.color, lightingPalette.key)
  color(fillLight.color, lightingPalette.fill)
  hemisphere.intensity = THREE.MathUtils.lerp(2.8, 1.65, nightBlend)
  keyLight.intensity = THREE.MathUtils.lerp(3.1, 1.45, nightBlend)
  fillLight.intensity = THREE.MathUtils.lerp(0.7, 0.65, nightBlend)
  floodLights.forEach((light) => {
    light.intensity = 650 * nightBlend
  })
  renderer.toneMappingExposure = THREE.MathUtils.lerp(1.05, 0.96, nightBlend)
  applyCourseTheme(course, nightBlend)
  appliedNightBlend = nightBlend
  return changing
}

function renderFrame(time: number) {
  frameId = 0
  if (disposed || failed || !renderer || !scene || !camera || !inView || document.hidden) return
  const delta = Math.min((time - previousFrame) / 1000 || 0.016, 0.1)
  previousFrame = time
  updateRunners()
  const lightingChanging = updateLighting(delta)
  const cameraMoving = chooseCamera(delta)
  renderer.render(scene, camera)
  updateLabels()
  // A stopped race is a still image once its camera settles. UI and resize events
  // request the next frame instead of leaving an unnecessary WebGL loop running.
  if (race.status === 'running' || cameraMoving || lightingChanging)
    frameId = requestAnimationFrame(renderFrame)
}

function resumeRendering() {
  if (
    !frameId &&
    renderer &&
    scene &&
    camera &&
    !disposed &&
    !failed &&
    inView &&
    !document.hidden
  ) {
    previousFrame = performance.now()
    frameId = requestAnimationFrame(renderFrame)
  }
}

const stopSceneWatch = watch(
  [
    () => props.cameraMode,
    () => props.selectedHorseId,
    () => props.theme,
    () => race.status,
    () => race.elapsedSeconds,
    () => race.currentRoundIndex,
    () => displayedHorses.value.map((horse) => horse.id).join(','),
    hoveredHorseId,
  ],
  resumeRendering,
  { flush: 'post' },
)

function visibilityChanged() {
  if (document.hidden) {
    cancelAnimationFrame(frameId)
    frameId = 0
  } else resumeRendering()
}

function pickHorse(event: PointerEvent) {
  if (!renderer || !camera) return undefined
  const rect = renderer.domElement.getBoundingClientRect()
  pointer.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    (-(event.clientY - rect.top) / rect.height) * 2 + 1,
  )
  raycaster.setFromCamera(pointer, camera)
  const objects = [...runners.values()]
    .filter((runner) => runner.root.visible)
    .map((runner) => runner.model)
  return raycaster.intersectObjects(objects, true)[0]?.object.userData.horseId as string | undefined
}

function pointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  drag = {
    x: event.clientX,
    y: event.clientY,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
  }
  renderer?.domElement.setPointerCapture(event.pointerId)
}
function pointerMove(event: PointerEvent) {
  if (drag) {
    const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6
    drag.moved ||= moved
    if (drag.moved) {
      orbitX = THREE.MathUtils.clamp(orbitX - (event.clientX - drag.x) * 0.005, -0.6, 0.6)
      orbitY = THREE.MathUtils.clamp(orbitY + (event.clientY - drag.y) * 0.004, -0.18, 0.35)
      if (renderer) renderer.domElement.style.cursor = 'grabbing'
      resumeRendering()
    }
    drag.x = event.clientX
    drag.y = event.clientY
  } else {
    hoveredHorseId.value = pickHorse(event) ?? null
    if (renderer) renderer.domElement.style.cursor = hoveredHorseId.value ? 'pointer' : 'grab'
  }
}
function pointerUp(event: PointerEvent) {
  if (drag && !drag.moved) {
    const horseId = pickHorse(event)
    if (horseId) emit('select', horseId)
  }
  drag = null
  if (renderer) {
    if (renderer.domElement.hasPointerCapture(event.pointerId))
      renderer.domElement.releasePointerCapture(event.pointerId)
    renderer.domElement.style.cursor = 'grab'
  }
}
function pointerCancel() {
  drag = null
}
function pointerLeave() {
  if (!drag) hoveredHorseId.value = null
}
function contextLost(event: Event) {
  event.preventDefault()
  fail('The 3D view is unavailable on this device.')
}
function fail(reason: string) {
  if (disposed || failed) return
  failed = true
  cancelAnimationFrame(frameId)
  frameId = 0
  emit('fallback', reason)
}

onMounted(async () => {
  try {
    if (!host.value) return
    scene = new THREE.Scene()
    scene.background = new THREE.Color('#e9e8df')
    scene.fog = new THREE.Fog('#e9e8df', 105, 200)
    camera = new THREE.PerspectiveCamera(37, 1, 0.1, 300)
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.domElement.setAttribute('aria-hidden', 'true')
    renderer.domElement.className = 'race-scene-canvas'
    host.value.prepend(renderer.domElement)
    renderer.domElement.addEventListener('pointerdown', pointerDown)
    renderer.domElement.addEventListener('pointermove', pointerMove)
    renderer.domElement.addEventListener('pointerup', pointerUp)
    renderer.domElement.addEventListener('pointercancel', pointerCancel)
    renderer.domElement.addEventListener('pointerleave', pointerLeave)
    renderer.domElement.addEventListener('webglcontextlost', contextLost)

    hemisphere = new THREE.HemisphereLight('#fff9e7', '#718271', 2.8)
    scene.add(hemisphere)
    const sunlight = new THREE.DirectionalLight('#fff3da', 3.1)
    keyLight = sunlight
    sunlight.position.set(-25, 55, 30)
    sunlight.castShadow = true
    sunlight.shadow.mapSize.set(2048, 2048)
    sunlight.shadow.camera.left = -55
    sunlight.shadow.camera.right = 55
    sunlight.shadow.camera.top = 40
    sunlight.shadow.camera.bottom = -40
    sunlight.shadow.camera.near = 1
    sunlight.shadow.camera.far = 160
    sunlight.shadow.normalBias = 0.035
    sunlight.shadow.bias = -0.0001
    sunlight.shadow.radius = 3
    scene.add(sunlight)
    const fill = new THREE.DirectionalLight('#e0e9ed', 0.7)
    fillLight = fill
    fill.position.set(20, 15, -35)
    scene.add(fill)
    floorMaterial = new THREE.MeshStandardMaterial({ color: '#e9e8df', roughness: 1 })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -1.95
    floor.receiveShadow = true
    scene.add(floor)
    course = createCourse()
    scene.add(course)
    for (const fixture of COURSE_FLOODLIGHTS) {
      const light = new THREE.SpotLight('#ffd09a', 0, 110, Math.PI / 3.1, 0.85, 2)
      light.position.set(fixture.x, 12.6, fixture.z)
      light.target.position.set(fixture.targetX, 0, 0)
      // Keep one shadow-casting key light; these two warm fills are inexpensive.
      light.castShadow = false
      floodLights.push(light)
      scene.add(light, light.target)
    }
    updateLighting(1, true)
    resize()
    chooseCamera(1, true)
    renderer.render(scene, camera)
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(host.value)
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        inView = entries.some((entry) => entry.isIntersecting)
        if (inView) resumeRendering()
        else {
          cancelAnimationFrame(frameId)
          frameId = 0
        }
      },
      { rootMargin: '150px' },
    )
    intersectionObserver.observe(host.value)
    document.addEventListener('visibilitychange', visibilityChanged)
    reducedMotion.addEventListener('change', resumeRendering)

    const modelUrl = new URL(`${import.meta.env.BASE_URL}assets/horse.glb`, document.baseURI).href
    const model = await new GLTFLoader().loadAsync(modelUrl)
    if (disposed) {
      disposeObject(model.scene)
      return
    }
    modelTemplate = model.scene
    race.horses.forEach((horse, index) => buildRunner(horse, index, model.scene, model.animations))
    loaded.value = true
    updateRunners()
    chooseCamera(1, true)
    renderer.render(scene, camera)
    resumeRendering()
    emit('ready')
  } catch (error) {
    console.warn('The 3D racecourse could not be opened.', error)
    fail('The 3D view could not be loaded. The standard race view is available.')
  }
})

onBeforeUnmount(() => {
  disposed = true
  stopSceneWatch()
  cancelAnimationFrame(frameId)
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
  document.removeEventListener('visibilitychange', visibilityChanged)
  reducedMotion.removeEventListener('change', resumeRendering)
  if (renderer) {
    const canvas = renderer.domElement
    canvas.removeEventListener('pointerdown', pointerDown)
    canvas.removeEventListener('pointermove', pointerMove)
    canvas.removeEventListener('pointerup', pointerUp)
    canvas.removeEventListener('pointercancel', pointerCancel)
    canvas.removeEventListener('pointerleave', pointerLeave)
    canvas.removeEventListener('webglcontextlost', contextLost)
  }
  runners.forEach((runner) => {
    runner.mixer.stopAllAction()
    runner.mixer.uncacheRoot(runner.model)
  })
  runners.clear()
  floodLights.length = 0
  labelElements.clear()
  if (scene) disposeObject(scene)
  if (modelTemplate) disposeObject(modelTemplate)
  renderer?.dispose()
  renderer?.domElement.remove()
})
</script>

<template>
  <div
    ref="host"
    class="race-scene"
    :class="{ 'is-night': theme === 'dark' }"
    role="group"
    aria-label="Interactive three-dimensional racecourse"
  >
    <div v-if="!loaded" class="scene-loading" aria-live="polite">
      <span class="scene-loading-ring"></span><span>Preparing your front-row seat</span>
    </div>
    <div v-else class="scene-labels">
      <button
        v-for="(horse, index) in displayedHorses"
        :key="horse.id"
        :ref="(element) => labelRef(horse.id, element)"
        class="scene-runner-label"
        :class="{ selected: selectedHorseId === horse.id, hovered: hoveredHorseId === horse.id }"
        :style="{ '--runner-color': horse.color }"
        :aria-label="`Follow ${horse.name}, starting lane ${index + 1}`"
        :aria-pressed="selectedHorseId === horse.id"
        @click="emit('select', horse.id)"
        @mouseenter="hoveredHorseId = horse.id"
        @mouseleave="hoveredHorseId = null"
      >
        <span>{{ String(index + 1).padStart(2, '0') }}</span
        ><span class="scene-runner-name">{{ horse.name }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.race-scene {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 430px;
  overflow: hidden;
  background: #e9e8df;
}
.race-scene :deep(.race-scene-canvas) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  touch-action: pan-y;
  cursor: grab;
  outline: none;
}
.scene-labels {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.scene-runner-label {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 0;
  min-width: 23px;
  height: 22px;
  border: 1px solid #ffffffa8;
  border-radius: 6px;
  background: #faf9f1ed;
  color: #213e30;
  padding: 0;
  box-shadow: 0 2px 8px #18301f15;
  cursor: pointer;
  font:
    600 9px/1 'Manrope',
    sans-serif;
  transition:
    background 0.18s,
    box-shadow 0.18s;
  will-change: transform;
}
.scene-runner-label > span:first-child {
  display: grid;
  place-items: center;
  min-width: 22px;
  height: 20px;
  border-bottom: 2px solid var(--runner-color);
  border-radius: 5px;
}
.scene-runner-label::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 8px;
  border-width: 4px 3px 0;
  border-style: solid;
  border-color: #faf9f1ed transparent transparent;
}
.scene-runner-name {
  overflow: hidden;
  max-width: 0;
  white-space: nowrap;
  opacity: 0;
  transition:
    max-width 0.2s,
    opacity 0.2s,
    padding 0.2s;
}
.scene-runner-label.selected,
.scene-runner-label.hovered,
.scene-runner-label:focus-visible {
  background: #ffffff;
  box-shadow: 0 2px 14px #17342325;
  z-index: 1000 !important;
}
.scene-runner-label.selected .scene-runner-name,
.scene-runner-label.hovered .scene-runner-name,
.scene-runner-label:focus-visible .scene-runner-name {
  max-width: 130px;
  padding: 0 9px 0 3px;
  opacity: 1;
}
.scene-runner-label:focus-visible {
  outline: 2px solid #a8774d;
  outline-offset: 3px;
}
.scene-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  z-index: 5;
  background: #e9e8dfc9;
  color: #526451;
  font-size: 11px;
  letter-spacing: 0.03em;
}
.scene-loading-ring {
  width: 27px;
  height: 27px;
  border: 1px solid #a7b09d66;
  border-top-color: #56705b;
  border-radius: 50%;
  animation: scene-spin 1s linear infinite;
}
.race-scene.is-night {
  background: #101c18;
}
.is-night .scene-loading {
  background: #101c18d9;
  color: #c7cebb;
}
.is-night .scene-loading-ring {
  border-color: #93a78c33;
  border-top-color: #d6b377;
}
.is-night .scene-runner-label {
  background: #22392fed;
  color: #eeeedf;
  border-color: #9bb49c75;
  box-shadow: 0 2px 10px #020a0638;
}
.is-night .scene-runner-label::after {
  border-top-color: #22392fed;
}
.is-night .scene-runner-label.selected,
.is-night .scene-runner-label.hovered,
.is-night .scene-runner-label:focus-visible {
  background: #34513f;
  border-color: #d6bb82;
  box-shadow: 0 2px 14px #030b0740;
}
@keyframes scene-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 600px) {
  .race-scene {
    min-height: 420px;
  }
  .scene-runner-label {
    min-width: 21px;
    height: 21px;
  }
  .scene-runner-label > span:first-child {
    min-width: 20px;
    height: 19px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .scene-loading-ring {
    animation: none;
  }
  .scene-runner-label,
  .scene-runner-name {
    transition: none;
  }
}
</style>
