import * as THREE from "three";

import { EffectComposer, RenderPass, } from "postprocessing";
import { registerCanvasResizeListener } from "@/lib/threeHelper";
import { add, enumerate, mulberry32, mulScalar, sub, zip, } from "@/lib/nodes/utils";
// @ts-ignore
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { CurveCircle, CurveLine, Polyline } from "@/lib/nodes/curves";
// @ts-ignore
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils";
import { KnotMaterial } from "@/lib/shaders/bamboo/KnotMaterial";
import { StemMaterial } from "@/lib/shaders/bamboo/StemMaterial";
import { LeafMaterial } from "@/lib/shaders/bamboo/LeafMaterial";


class Bamboo {
    knots: BambooKnot[]

    constructor(public origin: THREE.Vector3,
                public height: number,
                public knotHeight: number,
                public props: BambooSpecFull,
                public splitScale: number = 0.05) {
        const { bamboo: { windScale, windSpeed } } = props;
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
                public props: BambooSpecFull) {

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
            if (this.props.rng() < 0.268) {
                const t = 0.2 * i / n + 0.1
                seeds.push(knotCurve.getPoint(t))
            }
        }

        return seeds.map((point) => {
            const scale = this.props.rng() * 0.13 + 0.05; // random scale between 0.05 and 0.15
            return new BambooLeafStem(add(point, this.origin), scale, this.props)
        })
    }
}

class BambooLeafStem {
    leaves: BambooLeaf[]
    children: BambooLeafStemSecondary[] = []
    rotationY: number

    /**
     * A stem with leaves attached on it.
     *
     * @param origin
     * @param scale
     * @param props
     */
    constructor(public origin: THREE.Vector3,
                public scale: number,
                public props: BambooSpecFull) {
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
        const leafMeshes = this.leaves.map((leaf) => leaf.toMesh())
        const stemGeometry = mergeGeometries([
            this.unitGeometry(),
            ...this.children.map((child) => child.unitGeometry())
        ])
        const stemMaterial = new StemMaterial({
            uOrigin: this.origin,
            uZMin: this.props.shader.near,
            uZMax: this.props.shader.far,
        })
        const stemMesh = new THREE.Mesh(stemGeometry, stemMaterial)
        stemMesh.frustumCulled = false;
        return [stemMesh, ...leafMeshes]
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
                new BambooLeafStemSecondary(relativeOrigin, this.origin, scale, this.props, tangent, this.rotationY)
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
                public props: BambooSpecFull,
                public tangent: THREE.Vector3,
                public rotationY: number) {
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
                    this.props
                ))
            }
        }
        return leaves
    }
}

class BambooLeaf {
    rotation: [number, number, number]

    constructor(public origin: THREE.Vector3,
                public tangent: THREE.Vector3,
                public scale: number,
                public rotationY: number,
                public props: BambooSpecFull) {
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
            new THREE.Vector3(0, 0, 0),
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

    toMesh(): THREE.Mesh {
        const geometry = this.unitGeometry()
        const material = new LeafMaterial({
            uOrigin: this.origin,
            uZMin: this.props.shader.near,
            uZMax: this.props.shader.far,
        })
        const mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false
        return mesh
    }
}

let scene: THREE.Scene;

export function onCanvasLoad(canvas: HTMLCanvasElement, properties: BambooProps) {
    // META INFO

    const aspRatio = canvas.clientWidth / canvas.clientHeight
    scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, aspRatio, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true
    })
    camera.position.set(0, 0, 4);

    // 3D MODELS

    const axesHelper = new THREE.AxesHelper();
    scene.add(axesHelper)

    // const rng = mulberry32()
    // const knotVaryingWidthFn = (x: number) => -((12 * x) ** 4) + 0.5
    // const knotConstantWidth = knotVaryingWidthFn(-0.05)
    // const knotWidthFn = (x: number) => {
    //     if (x < 0 || x > 1) {
    //         throw new Error("knotWidthFn expects x to be in [0, 1]");
    //     }
    //     if (x < 0.1) {
    //         return knotVaryingWidthFn(x - 0.05)
    //     }
    //     if (x < 0.9) {
    //         return knotConstantWidth
    //     }
    //     return knotVaryingWidthFn(x - 0.95)
    // }
    //
    // const basePlane = new THREE.PlaneGeometry(1, 1);
    // basePlane.rotateX(-Math.PI / 2)
    //
    // const seeds = distributePointsOnFaces("poisson disk", {
    //     geometry: basePlane, selection: true, densityMax: 10, densityFactor: 1, distanceMin: 0.2
    // })
    //
    // const bambooStemSeeds = seeds
    //     .map((point) => CurveLine.fromDirection(point, new THREE.Vector3(0, 1, 0),
    //         randomValue("float", rng, properties.bamboo.minHeight, properties.bamboo.maxHeight)))
    //     .map((curve) => curve.resampleByLength(
    //         randomValue("float", rng, properties.knot.minHeight, properties.knot.maxHeight)))
    //     .map((curve) => curve.toGeometry()) // TODO wind
    //     .map((geometry) => splitEdges("scale", geometry, "line", 0.05))
    //
    // const bambooStems = bambooStemSeeds.map((stem) => stem.flatMap(geometryToCurve))
    // const resampledStems = bambooStems
    //     .map((stem) => stem.map((curve, knotIndex, knots) => {
    //         const n = 10
    //
    //         // sample more on the endpoints
    //         const resampledPoints = []
    //         const radii = []
    //         for (let i = 0; i <= n; i++) {
    //             const alpha = i / n
    //             const t = alpha < 0.45 ? 0.3 * alpha : alpha < 0.55 ? 7.3 * (alpha - 0.45) + 0.135 : 0.3 * (alpha - 1) + 1
    //             const h = (knotIndex + alpha) / knots.length
    //             const r = knotWidthFn(t) * 0.1 * (1 - 0.5 * h)
    //             resampledPoints.push(curve.getPoint(t))
    //             radii.push(r)
    //         }
    //         return new Polyline(resampledPoints, false, radii)
    //     }))
    //
    // const stemCircles = resampledStems.map((stem) =>
    //     stem.flatMap((geometry) => {
    //         return Array.from(walkPoints(geometry.toGeometry()).map((point, i) => {
    //             return new CurveCircle(geometry.radius[i], 12).toGeometry().rotateX(-Math.PI / 2).translate(point.x, point.y, point.z)
    //         }))
    //     }))
    //
    // const stemMeshes = resampledStems.map((stem) =>
    //     stem.map((curve) => curve.toMeshGeometryWithRadius((r) => new CurveCircle(r, 8), 8)))
    //
    // // drawGeometry(basePlane, scene)
    // // drawPoints(seeds, scene)
    // // drawLines(bambooStemSeeds.flat(), scene)
    // // drawCurves(resampledStems.flat(), scene)
    // // drawLines(stemCircles.flat(), scene)
    //
    // stemMeshes.flat(2).map((geometry) => {
    //     const material = new THREE.MeshStandardMaterial({
    //         color: 0x666666, // brown color
    //         side: THREE.DoubleSide,
    //         opacity: 0.5,
    //         transparent: true
    //     })
    //     const mesh = new THREE.Mesh(geometry, material)
    //     scene.add(mesh)
    // })
    //
    // // leaf stems
    // // give some extra spots for potential stems
    // const leafStemSeeds = resampledStems.flat().flatMap((knotCurve) => {
    //     const n = 5
    //     const points = []
    //     for (let i = 0; i <= n; i++) {
    //         // allow 0.1 to 0.3
    //         if (rng() < 0.268) {
    //             const t = 0.2 * i / n + 0.1
    //             points.push(knotCurve.getPoint(t))
    //         }
    //     }
    //     return points
    // })
    //
    // const leafStems: Attributed<Polyline, { origin: THREE.Vector3 }>[] = leafStemSeeds.map((basePoint) => {
    //     const length = randomValue("float", rng, 0.05, 0.15)
    //     const line = new CurveLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, length, 0))
    //     const n = 10
    //     const locals = []
    //     const radii = []
    //     for (let i = 0; i <= n; i++) {
    //         // sample more on the root because of greater curvature
    //         const t = (4 ** (i / n) - 1) / 3;
    //         const point = line.getPoint(t)
    //         const offsetX = (5 ** t - 1) * length / 5;
    //         locals.push(new THREE.Vector3(point.x + offsetX, point.y, point.z))
    //         radii.push(((t - 0.75) ** 2 + 0.4375) * 0.01)
    //     }
    //     const polyline = new Polyline(locals, false, radii)
    //     // const geometry = polyline
    //     //     .toMeshGeometryWithRadius((radius) => new CurveCircle(radius), 5)
    //     //     .translate(basePoint.x, basePoint.y, basePoint.z)
    //     // TODO: rotation in the end should make the job easier
    //     // const yRotation = new THREE.Matrix4().makeRotationY(randomValue("float", rng, -Math.PI, Math.PI))
    //     // const zRotation = new THREE.Matrix4().makeRotationZ(randomValue("float", rng, -0.5, 0))
    //     // geometry.applyMatrix4(yRotation.multiply(zRotation)).translate(basePoint.x, basePoint.y, basePoint.z)
    //     return withAttribute(polyline, { origin: basePoint })
    // })
    //
    // leafStems.forEach((curve) => {
    //     const geometry = curve.toMeshGeometryWithRadius((r) => new CurveCircle(r, 8), 8)
    //     const material = new THREE.MeshStandardMaterial({
    //         color: 0x228B22, // green color
    //         side: THREE.DoubleSide,
    //         opacity: 0.5,
    //         transparent: true
    //     })
    //     const mesh = new THREE.Mesh(geometry, material)
    //     mesh.position.copy(curve.origin)
    //     scene.add(mesh)
    // })
    //
    // const leafStemSecondarySeeds: Attributed<THREE.Vector3, {
    //     tangent: THREE.Vector3,
    //     origin: THREE.Vector3
    // }>[] = leafStems.flatMap((leafStem) => {
    //     const n = 5
    //     const points = []
    //     for (let i = 0; i <= n; i++) {
    //         // allow 0.7 to 1, 26.8%
    //         if (rng() >= 0.268) {
    //             continue
    //         }
    //         const t = 0.7 + 0.3 * i / n;
    //         const point = withAttribute(leafStem.getPoint(t), {
    //             tangent: leafStem.getTangent(t),
    //             origin: leafStem.origin
    //         })
    //         points.push(point)
    //     }
    //     return points
    // })
    //
    // const leafStemSecondary = leafStemSecondarySeeds.map((basePoint) => {
    //     const length = randomValue("float", rng, 0.02, 0.08)
    //     const line = CurveLine.fromDirection(new THREE.Vector3(0, 0, 0), basePoint.tangent, length)
    //     const n = 8
    //     const locals = []
    //     const radii = []
    //     for (let i = 0; i <= n; i++) {
    //         // sample more on the root because of greater curvature
    //         const t = (4 ** (i / n) - 1) / 3;
    //         const point = line.getPoint(t)
    //         const offsetX = (5 ** t - 1) * length / 5;
    //         locals.push(new THREE.Vector3(point.x + offsetX, point.y, point.z))
    //         radii.push(((t - 0.75) ** 2 + 0.4375) * 0.005)
    //     }
    //     const polyline = new Polyline(locals, false, radii)
    //     return withAttribute(polyline, { origin: new THREE.Vector3().addVectors(basePoint, basePoint.origin) })
    // })
    //
    // leafStemSecondary.forEach((curve) => {
    //     const geometry = curve.toMeshGeometryWithRadius(
    //         (r) => new CurveCircle(r, 5), 5)
    //     // geometry.rotateY(rng() - 0.5)
    //     const material = new THREE.MeshStandardMaterial({
    //         color: 0x00ff00, // green color
    //         side: THREE.DoubleSide,
    //         opacity: 0.5,
    //         transparent: true
    //     })
    //     const mesh = new THREE.Mesh(geometry, material)
    //     mesh.position.copy(curve.origin)
    //     scene.add(mesh)
    // })
    //
    // // leaves can grow on both primary and secondary stems
    // const leafSeeds = Array.from(chain(leafStems, leafStemSecondary)
    //     .flatMap((stem) => {
    //         const points = []
    //         for (let i = 0; i <= properties.leaves.count; i++) {
    //             if (rng() >= 0.382) {
    //                 continue
    //             }
    //             const t = i / properties.leaves.count
    //             const point = withAttribute(stem.getPoint(t), {
    //                 tangent: stem.getNormal(t),
    //                 origin: stem.origin
    //             })
    //             points.push(point)
    //         }
    //         return points
    //     }))
    //
    // drawPoints(leafSeeds.map((point) => point.clone().add(point.origin)), scene, 0.001)
    //
    // const leafRadius = (t: number) => {
    //     const a = 0.26794919,
    //         b = 3.7320508,
    //         h = (b - a) * 0.5 * (t * t + t) + a
    //     return -0.25 * (h + 1 / h) + 1
    // }
    // const leaves = leafSeeds.map((basePoint) => {
    //     const length = randomValue("float", rng, 0.01, 0.05)
    //     const line = CurveLine.fromDirection(new THREE.Vector3(0, 0, 0), basePoint.tangent, length)
    //     // sample more on the root because of greater curvature
    //     const n = 5
    //     const points = []
    //     const radii = []
    //     for (let i = 0; i <= n; i++) {
    //         const t = (i / n) ** 2
    //         points.push(line.getPoint(t))
    //         radii.push(leafRadius(t) * 0.01)
    //     }
    //     const polyline = new Polyline(points, false, radii)
    //     return withAttribute(polyline, { origin: new THREE.Vector3().addVectors(basePoint, basePoint.origin) })
    // })
    //
    // drawCurves(leaves.map((curve) => {
    //     // convert conrve to polyline at origin
    //     const points = curve.points.map((point) => point.clone().add(curve.origin))
    //     return new Polyline(points)
    // }), scene)
    //
    // drawLines(leaves.map((curve) => {
    //     const geometry = curve.toMeshGeometryWithRadius(
    //         (r) => new CurveLine(new THREE.Vector3(-r, 0, 0), new THREE.Vector3(r, 0, 0)), 5)
    //     geometry.translate(curve.origin.x, curve.origin.y, curve.origin.z)
    //     return geometry
    // }), scene)
    //
    // leaves.forEach((curve) => {
    //     const geometry = curve.toMeshGeometryWithRadius(
    //         (r) => new CurveLine(new THREE.Vector3(-r, 0, 0), new THREE.Vector3(r, 0, 0)), 5)
    //     const material = new THREE.MeshStandardMaterial({
    //         color: 0x0000ff, // green color
    //         opacity: 0.5,
    //         transparent: true
    //     })
    //     const mesh = new THREE.Mesh(geometry, material)
    //     mesh.position.copy(curve.origin)
    //     scene.add(mesh)
    // })

    const spec: BambooSpecFull = {
        rng: mulberry32(),
        bamboo: {
            windScale: properties.bamboo.windScale,
            windSpeed: properties.bamboo.windSpeed
        },
        knots: {
            uResolution: 10,
            vResolution: 8,
            stemCount: 20
        },
        stems: {
            windSpeed: properties.leaves.windSpeed,
            windScale: properties.leaves.windScale,
            uResolution: 10,
            vResolution: 8,
            leafCount: 10,
            secondaryStemChance: 0.8
        },
        shader: {
            near: 5,
            far: 10
        }
    }
    const bamboo = new Bamboo(new THREE.Vector3(0.2, 0, 0.2), 1.5, 0.3, spec)
    const mesh = bamboo.toMesh()
    mesh.forEach((m) => scene.add(m))

    // const knotGeometries = bamboo.knots.map((knot) => knot.unitGeometry())
    // const stemGeometries = bamboo.knots.flatMap((knot) =>
    //     knot.leafStems.map((stem) => stem.unitGeometry()))
    // const stemGeometries1 = bamboo.knots.flatMap((knot) =>
    //     knot.leafStems.flatMap((stem) => stem.children.map((child) => child.unitGeometry())))
    // const leafGeometries = bamboo.knots.flatMap((knot) =>
    //     knot.leafStems.flatMap((stem) => stem.leaves.map((leaf) => leaf.unitGeometry().translate(leaf.origin.x, leaf.origin.y, leaf.origin.z))))
    //
    // const knotMeshes = knotGeometries.map((geometry) => {
    //     const material = new THREE.MeshStandardMaterial({
    //         color: 0x666666, // brown color
    //         side: THREE.DoubleSide,
    //         opacity: 0.5,
    //         transparent: true
    //     })
    //     return new THREE.Mesh(geometry, material)
    // })
    // const stemMeshes1 = stemGeometries.map((geometry) => {
    //     const material = new THREE.MeshStandardMaterial({
    //         color: 0x228B22, // green color
    //         side: THREE.DoubleSide,
    //         opacity: 0.5,
    //         transparent: true
    //     })
    //     return new THREE.Mesh(geometry, material)
    // })
    // const stemMeshes2 = stemGeometries1.map((geometry) => {
    //     const material = new THREE.MeshStandardMaterial({
    //         color: 0xff0000, // green color
    //         side: THREE.DoubleSide,
    //         opacity: 0.5,
    //         transparent: true
    //     })
    //     return new THREE.Mesh(geometry, material)
    // })
    // const leafMeshes = leafGeometries.map((geometry) => {
    //     const material = new THREE.MeshStandardMaterial({
    //         color: 0x00ff00, // green color
    //         side: THREE.DoubleSide,
    //         opacity: 0.5,
    //         transparent: true
    //     })
    //     return new THREE.Mesh(geometry, material)
    // })
    // knotMeshes.forEach((mesh) => scene.add(mesh))
    // stemMeshes1.forEach((mesh) => scene.add(mesh))
    // stemMeshes2.forEach((mesh) => scene.add(mesh))
    // leafMeshes.forEach((mesh) => {
    //     scene.add(mesh)
    // })

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

    // flower.rotation.order = "YZX"
    const resizeCleanUp = registerCanvasResizeListener({ canvas, renderer, composer, camera })
    // const moveCleanUp = registerMouseMoveListener(canvas, (u, v) => {
    //     const up = (u - 0.5) / 2,
    //         vp = (v - 0.5) / 2
    //
    //     gsap.to(flower.rotation, {
    //         x: up,
    //         y: Math.PI / 4,
    //         z: Math.PI / 6 + vp,
    //         duration: 0.5,
    //         ease: "power2.out",
    //         overwrite: true,
    //         onUpdate() {
    //             flower.quaternion.setFromEuler(flower.rotation)
    //         }
    //     })
    //
    //     gsap.to(flower.position, {
    //         x: up,
    //         y: -vp,
    //         duration: 0.5,
    //         ease: "power2.out",
    //         overwrite: true
    //     })
    // })

    // add orbital control
    const controls = new OrbitControls(camera, renderer.domElement)

    // RENDER LOOP
    const clock = new THREE.Clock()

    const delay = 0.5
    const duration = 3
    const rate = (x: number) => 1 - (Math.sin(2 * Math.PI * x)) / (2 * Math.PI * x)

    let handle: number

    function render() {
        const delta = clock.getElapsedTime()

        // if (delay < delta && delta < delay + duration) {
        //     const alpha = rate((delta - delay) / duration)
        // }

        controls.update()

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
        // moveCleanUp()
        renderer.dispose()
    }
}