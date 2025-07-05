import * as THREE from "three";
import gsap from "gsap"

import { EffectComposer, RenderPass, } from "postprocessing";
import { registerCanvasResizeListener, registerMouseMoveListener } from "@/lib/threeHelper";
import { add, enumerate, mulberry32, mulScalar, sub, zip, } from "@/lib/nodes/utils";
import { CurveCircle, CurveLine, Polyline } from "@/lib/nodes/curves";
// @ts-ignore
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils";
import { KnotMaterial } from "@/lib/shaders/bamboo/KnotMaterial";
import { StemMaterial } from "@/lib/shaders/bamboo/StemMaterial";
import { LeafMaterial } from "@/lib/shaders/bamboo/LeafMaterial";
import { distributePointsOnFaces } from "@/lib/nodes/point";


class Bamboo {
    knots: BambooKnot[]

    constructor(public origin: THREE.Vector3,
                public height: number,
                public knotHeight: number,
                public props: BambooSpec,
                public splitScale: number = 0.05) {
        this.height = height;
        this.knots = this.spawnKnots()
    }

    toMesh(): THREE.Mesh[] {
        return this.knots.flatMap((knot) => knot.toMesh())
    }

    spawnKnots(): BambooKnot[] {
        const stem = CurveLine.fromDirection(this.origin, new THREE.Vector3(0, 1, 0), this.height)
        const resampled = stem.resampleByLength(this.knotHeight)
        const knotsN = resampled.points.length - 1
        const knots = []
        for (const [i, [p1, p2]] of
            enumerate(zip(resampled.points.slice(0, -1), resampled.points.slice(1)))) {
            const length = p1.distanceTo(p2)
            const targetLength = length * (1 - this.splitScale)
            const tangent = sub(p2, p1).normalize()
            const offset = sub(p2, p1).multiplyScalar(this.splitScale)
            const knot = new BambooKnot(p1.add(offset), targetLength, tangent, i, knotsN, this.props)
            knots.push(knot)
        }
        return knots
    }
}

class BambooKnot {
    leafStems: BambooLeafStem[]

    constructor(public origin: THREE.Vector3,
                public length: number,
                public tangent: THREE.Vector3,
                public index: number,
                public maxIndex: number,
                public props: BambooSpec) {

        this.leafStems = this.spawnLeafStems()
    }

    static knotVaryingWidthFn = (x: number) => -((12 * x) ** 4) + 0.5
    static knotConstantWidth = BambooKnot.knotVaryingWidthFn(-0.05)
    static getWidth = (x: number) => {
        if (x < 0 || x > 1) {
            throw new Error("knotWidthFn expects x to be in [0, 1]");
        }
        if (x < 0.1) {
            return BambooKnot.knotVaryingWidthFn(x - 0.05)
        }
        if (x < 0.9) {
            return BambooKnot.knotConstantWidth
        }
        return BambooKnot.knotVaryingWidthFn(x - 0.95)
    }

    unitCurve(): Polyline {
        const curve = new CurveLine(new THREE.Vector3(0, 0, 0), mulScalar(this.tangent, this.length));

        // sample more on the endpoints
        const resampledPoints = []
        const radii = []
        const n = this.props.knots.uResolution;
        for (let i = 0; i <= n; i++) {
            const alpha = i / n
            const t = alpha < 0.45 ? 0.3 * alpha : alpha < 0.55 ? 7.3 * (alpha - 0.45) + 0.135 : 0.3 * (alpha - 1) + 1
            const h = (this.index + alpha) / this.maxIndex
            const r = BambooKnot.getWidth(t) * 0.1 * (1 - 0.5 * h)
            resampledPoints.push(curve.getPoint(t))
            radii.push(r)
        }

        return new Polyline(resampledPoints, false, radii)
    }

    unitGeometry(): THREE.BufferGeometry {
        const polyline = this.unitCurve()
        const normalBufferAttributesBufferGeometry = polyline.toMeshGeometryWithRadius(
            (r) => new CurveCircle(r, 3),
            this.props.knots.vResolution,
            true,
            true
        );
        normalBufferAttributesBufferGeometry.computeVertexNormals()
        return normalBufferAttributesBufferGeometry
    }

    toMesh(): THREE.Mesh[] {
        const stemMeshes = this.leafStems.flatMap((leafStem) => leafStem.toMesh())
        const knotGeometry = this.unitGeometry()
        const knotMaterial = new KnotMaterial({
            uOrigin: this.origin,
            uZMin: this.props.shader.near,
            uZMax: this.props.shader.far,
            uKnotWindScale: this.props.bamboo.windScale,
            uKnotWindSpeed: this.props.bamboo.windSpeed,
            uKnotLength: this.length
        })

        const knotMesh = new THREE.Mesh(knotGeometry, knotMaterial)
        knotMesh.frustumCulled = false;
        return [knotMesh, ...stemMeshes]
    }

    spawnLeafStems(): BambooLeafStem[] {
        const knotCurve = this.unitCurve()
        const seeds = []
        const n = this.props.knots.stemCount;
        for (let i = 0; i <= n; i++) {
            // allow 0.1 to 0.3
            if (this.props.rng() < this.props.stems.primaryStemChance) {
                const t = 0.2 * i / n + 0.1
                seeds.push(knotCurve.getPoint(t))
            }
        }

        return seeds.map((point) => {
            const scale = this.props.rng() * 0.13 + 0.05; // random scale between 0.05 and 0.15
            return new BambooLeafStem(
                add(point, this.origin),
                scale,
                {
                    knotOrigin: this.origin,
                    knotLength: this.length
                },
                this.props
            )
        })
    }
}

class BambooLeafStem {
    leaves: BambooLeaf[]
    children: BambooLeafStemSecondary[] = []
    rotationY: number

    constructor(public origin: THREE.Vector3,
                public scale: number,
                public knotInfo: { knotOrigin: THREE.Vector3, knotLength: number },
                public props: BambooSpec) {
        this.rotationY = this.props.rng() * Math.PI * 2; // random rotation around Y axis
        this.leaves = this.spawnLeaves();

        // spawn children
        this.children = this.spawnSecondaryStems()
        this.leaves = this.leaves.concat(
            this.children.flatMap((child) => child.leaves)
        )
    }

    unitCurve(): Polyline {
        const line = CurveLine.fromDirection(
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 1, 0),
            this.scale
        )
        const n = this.props.stems.uResolution
        const locals = []
        const radii = []
        for (let i = 0; i <= n; i++) {
            // sample more on the root because of greater curvature
            const t = (4 ** (i / n) - 1) / 3,
                point = line.getPoint(t)
            const offset = (5 ** t - 1) * this.scale * 0.2,
                offsetX = offset * Math.cos(this.rotationY),
                offsetZ = offset * Math.sin(this.rotationY);
            const relativePoint = new THREE.Vector3(point.x + offsetX, point.y, point.z + offsetZ);
            locals.push(relativePoint)
            radii.push(((t - 0.75) ** 2 + 0.4375) * 0.01)
        }
        return new Polyline(locals, false, radii)
    }

    unitGeometry(): THREE.BufferGeometry {
        const polyline = this.unitCurve()
        return polyline.toMeshGeometryWithRadius(
            (r) => new CurveCircle(r, 3), this.props.stems.vResolution
        )
    }

    toMesh(): THREE.Mesh[] {
        const stemGeometry = mergeGeometries([
            this.unitGeometry(),
            ...this.children.map((child) => child.unitGeometry())
        ])
        const stemMaterial = new StemMaterial({
            uOrigin: this.origin,
            uZMin: this.props.shader.near,
            uZMax: this.props.shader.far,
            uKnotWindScale: this.props.bamboo.windScale,
            uKnotWindSpeed: this.props.bamboo.windSpeed,
            uKnotLength: this.knotInfo.knotLength,
            uKnotOrigin: this.knotInfo.knotOrigin,
            uStemWindScale: this.props.stems.windScale,
            uStemWindSpeed: this.props.stems.windSpeed,
        })
        const stemMesh = new THREE.Mesh(stemGeometry, stemMaterial)
        stemMesh.frustumCulled = false;

        const retMesh = [stemMesh]

        const leafGeometries = this.leaves.map((leaf) => leaf.unitGeometry())
        if (leafGeometries.length) {
            const leafGeometry = mergeGeometries(leafGeometries)
            const leafMaterial = new LeafMaterial({
                uZMin: this.props.shader.near,
                uZMax: this.props.shader.far,
                uKnotWindScale: this.props.bamboo.windScale,
                uKnotWindSpeed: this.props.bamboo.windSpeed,
                uKnotLength: this.knotInfo.knotLength,
                uKnotOrigin: this.knotInfo.knotOrigin,
                uStemWindScale: this.props.stems.windScale,
                uStemWindSpeed: this.props.stems.windSpeed,
                uStemOrigin: this.origin
            })
            const leafMesh = new THREE.Mesh(leafGeometry, leafMaterial)
            leafMesh.frustumCulled = false;

            retMesh.push(leafMesh)
        }

        return retMesh
    }

    spawnLeaves(): BambooLeaf[] {
        const stemCurve = this.unitCurve()
        const leaves = []
        const n = this.props.stems.leafCount;
        for (let i = 0; i <= n; i++) {
            if (this.props.rng() < 0.382) {
                // t in [0.4, 1] to prevent leaves from spawning too close to the root
                const t = (i / n) * 0.6 + 0.4
                // after rotation the getNormal of a polyline becomes ambiguous,
                // so we use the projection method instead to obtain the normal that descends the fastest.
                const tangent = stemCurve.getTangent(t),
                    down = new THREE.Vector3(0, -1, 0),
                    normal = sub(down, mulScalar(tangent, tangent.dot(down)))

                leaves.push(new BambooLeaf(
                    add(stemCurve.getPoint(t), this.origin),
                    normal,
                    this.props.rng() * 0.04 + 0.01,
                    this.rotationY,
                    this.knotInfo,
                    { stemOrigin: this.origin },
                    this.props
                ))
            }
        }
        return leaves
    }

    spawnSecondaryStems(): BambooLeafStemSecondary[] {
        const n = 5
        const stems = []
        const curve = this.unitCurve()
        for (let i = 0; i <= n; i++) {
            if (this.props.rng() >= this.props.stems.secondaryStemChance) {
                continue
            }
            const t = 0.7 + 0.3 * i / n;
            const point = curve.getPoint(t)
            // introduce some variation, take the point and sample point on a disk
            // that is perpendicular to the tangent point
            const tangent = curve.getTangent(t),
                n1 = curve.getNormal(t).normalize(),
                n2 = new THREE.Vector3().crossVectors(tangent, n1).normalize(),
                r = this.props.rng() * 0.01,
                theta = this.props.rng() * Math.PI * 2,
                offsetU = r * Math.cos(theta),
                offsetV = r * Math.sin(theta),
                offset = add(mulScalar(n1, offsetU), mulScalar(n2, offsetV));

            const scale = this.props.rng() * 0.1 + 0.02;
            const relativeOrigin = add(point, offset)
            stems.push(
                new BambooLeafStemSecondary(
                    relativeOrigin,
                    this.origin,
                    scale,
                    tangent,
                    this.rotationY,
                    this.knotInfo,
                    this.props,
                )
            )
        }

        return stems
    }
}

/**
 * Note this class does not have "toMesh" method, because it relies on BambooLeafStem
 */
class BambooLeafStemSecondary {
    leaves: BambooLeaf[]
    rotation: [number, number, number]

    constructor(public origin: THREE.Vector3,
                public absOrigin: THREE.Vector3,
                public scale: number,
                public tangent: THREE.Vector3,
                public rotationY: number,
                public knotInfo: { knotOrigin: THREE.Vector3, knotLength: number },
                public props: BambooSpec) {
        this.rotation = [this.props.rng() - 0.5, this.props.rng() - 0.5, this.props.rng() - 0.5]
        this.leaves = this.spawnLeaves();
    }

    unitCurve(): Polyline {
        const e = new THREE.Euler(...this.rotation)
        const line = CurveLine.fromDirection(
            new THREE.Vector3(0, 0, 0),
            this.tangent.clone().applyEuler(e),
            this.scale
        )
        const n = this.props.stems.uResolution
        const locals = []
        const radii = []
        for (let i = 0; i <= n; i++) {
            // sample more on the root because of greater curvature
            const t = (4 ** (i / n) - 1) / 3,
                point = line.getPoint(t)
            const offset = (5 ** t - 1) * this.scale * 0.1,
                offsetX = offset * Math.cos(this.rotationY),
                offsetZ = offset * Math.sin(this.rotationY);
            const relativePoint = new THREE.Vector3(point.x + offsetX, point.y, point.z + offsetZ);
            // the geometry of secondary stems needs to be translated
            // with respect to the origin of primary stem
            locals.push(relativePoint.add(this.origin))
            radii.push(((t - 0.75) ** 2 + 0.4375) * 0.005)
        }
        return new Polyline(locals, false, radii)
    }

    unitGeometry(): THREE.BufferGeometry {
        const polyline = this.unitCurve()
        return polyline.toMeshGeometryWithRadius(
            (r) => new CurveCircle(r, 3), this.props.stems.vResolution
        )
    }

    spawnLeaves(): BambooLeaf[] {
        const stemCurve = this.unitCurve()
        const leaves = []
        const n = this.props.stems.leafCount;
        for (let i = 0; i <= n; i++) {
            if (this.props.rng() < 0.382) {
                const t = i / n
                // after rotation the getNormal of a polyline becomes ambiguous,
                // so we use the projection method instead to obtain the normal that descends the fastest.
                const tangent = stemCurve.getTangent(t),
                    down = new THREE.Vector3(0, -1, 0),
                    normal = sub(down, mulScalar(tangent, tangent.dot(down)))

                // we want the leaves sometimes to point not straight down,
                // so we apply an average between this normal and the tangent
                const alpha = this.props.rng(),
                    leafTangent = add(mulScalar(normal, alpha), mulScalar(tangent, 1 - alpha))

                leaves.push(new BambooLeaf(
                    add(stemCurve.getPoint(t), this.absOrigin),
                    leafTangent,
                    this.props.rng() * 0.08 + 0.01,
                    this.rotationY,
                    this.knotInfo,
                    { stemOrigin: this.absOrigin },
                    this.props
                ))
            }
        }
        return leaves
    }
}

/**
 * This class only takes care of the leaf geometry, the mesh is created in BambooLeafStem.
 * This is done to avoid creating a mesh for each leaf, which would be too expensive.
 */
class BambooLeaf {
    rotation: [number, number, number]

    constructor(public origin: THREE.Vector3,
                public tangent: THREE.Vector3,
                public scale: number,
                public rotationY: number,
                public knotInfo: { knotOrigin: THREE.Vector3, knotLength: number },
                public stemInfo: { stemOrigin: THREE.Vector3 },
                public props: BambooSpec) {
        this.rotation = [(this.props.rng() - 0.5), (this.props.rng() - 0.5) * 2, (this.props.rng() - 0.5)]
    }

    static leafRadius(t: number) {
        const a = 0.26794919,
            b = 3.7320508,
            h = (b - a) * 0.5 * (t * t + t) + a
        return -0.5 * (h + 1 / h) + 2
    }

    unitCurve(): Polyline {
        const e = new THREE.Euler(...this.rotation)
        const line = CurveLine.fromDirection(
            sub(this.origin, this.stemInfo.stemOrigin),
            this.tangent.clone().applyEuler(e),
            this.scale
        )
        // sample more on the root because of greater curvature
        const n = 5
        const points = []
        const radii = []
        for (let i = 0; i <= n; i++) {
            const t = (i / n) ** 2
            points.push(line.getPoint(t))
            radii.push(BambooLeaf.leafRadius(t) * 0.01)
        }
        return new Polyline(points, false, radii)
    }

    unitGeometry(): THREE.BufferGeometry {
        const polyline = this.unitCurve()
        const totalRot = this.rotationY + this.rotation[1]
        return polyline.toMeshGeometryWithRadius(
            (r) => new CurveLine(
                new THREE.Vector3(-r * Math.sin(totalRot), 0, r * Math.cos(totalRot)),
                new THREE.Vector3(r * Math.sin(totalRot), 0, -r * Math.cos(totalRot))),
            5,
            false,
            true
        )
    }
}

export function onCanvasLoad(canvas: HTMLCanvasElement, properties: Omit<BambooSpec, "rng">) {
    // META INFO

    const aspRatio = canvas.clientWidth / canvas.clientHeight
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, aspRatio, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true
    })
    const targetY = 1.3
    camera.position.set(0, 2, 10);
    camera.lookAt(0, targetY, 0)

    // 3D MODELS

    const basePlane = new THREE.PlaneGeometry(2, 2);
    basePlane.rotateX(-Math.PI / 2)

    const seeds = distributePointsOnFaces("poisson disk", {
        geometry: basePlane, selection: true, densityMax: 10, densityFactor: 0.8, distanceMin: 0.4
    })

    const bamboos = seeds.map((seed) => {
        const height = properties.bamboo.minHeight + Math.random() * (properties.bamboo.maxHeight - properties.bamboo.minHeight);
        const knotHeight = Math.min(
            properties.knots.minHeight + Math.random() * (properties.knots.maxHeight - properties.knots.minHeight),
            height * 0.4
        );
        return new Bamboo(seed, height, knotHeight, {
            ...properties,
            rng: mulberry32()
        });
    })
    const bambooMesh = bamboos.flatMap((bamboo) => bamboo.toMesh())
    bambooMesh.forEach((m) => scene.add(m))

    const pointLight = new THREE.PointLight(0xffffff, 5)
    pointLight.position.set(-2, 2, 2)
    scene.add(pointLight)

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5)
    scene.add(ambientLight)

    // COMPOSING & HOOKS

    const composer = new EffectComposer(renderer, {
        frameBufferType: THREE.FloatType,
    })
    composer.addPass(new RenderPass(scene, camera))

    const resizeCleanUp = registerCanvasResizeListener({ canvas, renderer, composer, camera })
    const moveCleanUp = registerMouseMoveListener(canvas, (u, v) => {
        if (delta <= duration) {
            return  // first few seconds wait for animation
        }

        // delay for 1s before full wiggle
        const factor = Math.min(delta - duration, 1)

        const up = (u - 0.5) / 2 * factor,
            vp = (v - 0.5) / 2 * factor

        const target = new THREE.Vector3(0, targetY, 0);
        const offset = new THREE.Vector3()
            .copy(camPos)
            .sub(target);

        // 2. convert that vector to spherical coords
        const r     = offset.length();
        const theta = Math.atan2(offset.z, offset.x);        // horizontal angle
        const phi   = Math.asin(offset.y / r);                // vertical angle

        // 3. add your wiggle deltas
        const newTheta = theta + up;
        const newPhi   = phi   + vp;

        // 4. back to Cartesian, offset from the same target
        const x = target.x + r * Math.cos(newPhi) * Math.cos(newTheta);
        const y = target.y + r * Math.sin(newPhi);
        const z = target.z + r * Math.cos(newPhi) * Math.sin(newTheta);

        gsap.to(camera.position, {
            x, y, z,
            duration: 0.5,
            ease: "power2.out",
            overwrite: true,
            onUpdate() {
                camera.lookAt(target);
            }
        });
    })

    // RENDER LOOP
    const clock = new THREE.Clock()
    let delta: number = 0;
    let camPos: THREE.Vector3;

    const duration = 3
    let handle: number

    function initialCameraAnimation(alpha: number) {
        const t = alpha * 2;
        const z = 15 * 10 ** (-t)
        const x = -2 * Math.exp(-1 * (t - 2) ** 2)
        const y = -1 / 3 * t + 2;
        camPos = new THREE.Vector3(x, y, z);
        camera.position.set(x, y, z);
        camera.lookAt(0, targetY, 0);
    }

    function render() {
        delta = clock.getElapsedTime()

        if (delta <= duration) {
            initialCameraAnimation(delta / duration)
        }

        bambooMesh.forEach((mesh) => {
            (mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = delta
        })

        handle = requestAnimationFrame(render)
        composer.render()
    }

    render()

    function getHandle() {
        return handle
    }

    // CLEAN UP
    return () => {
        cancelAnimationFrame(getHandle())
        resizeCleanUp()
        moveCleanUp()
        renderer.dispose()
    }
}