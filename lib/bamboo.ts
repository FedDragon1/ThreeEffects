import * as THREE from "three";

import {
    BlendFunction,
    BloomEffect,
    EffectComposer,
    EffectPass,
    RenderPass,
} from "postprocessing";
import { registerCanvasResizeListener, registerMouseMoveListener } from "@/lib/threeHelper";
import gsap from "gsap";
import {
    drawCurves,
    drawGeometry, drawLines, drawPoints, mulberry32,
    randomColor,
    walkFaces, walkPoints, withAttribute,
} from "@/lib/nodes/utils";
// @ts-ignore
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { distributePointsOnFaces, instanceOnPoints } from "@/lib/nodes/point";
import { CurveCircle, CurveLine, Polyline } from "@/lib/nodes/curves";
import { randomValue } from "@/lib/nodes/operations";
import { geometryToCurve, splitEdges } from "@/lib/nodes/mesh";
import { CircleGeometry } from "three";

export function onCanvasLoad(canvas: HTMLCanvasElement, properties: BambooProps) {
    // META INFO

    const aspRatio = canvas.clientWidth / canvas.clientHeight
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, aspRatio, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false
    })
    camera.position.set(0, 0, 4);

    // 3D MODELS

    const axesHelper = new THREE.AxesHelper();
    scene.add(axesHelper)

    // const circle = new CurveCircle(1, 100).resample(101)
    // // const circle = new CurveLine(new THREE.Vector3(1, 1, 1), new THREE.Vector3(-1, -1, -1)).resample(2)
    // const geometry = circle.toGeometry()
    // const material = new THREE.LineBasicMaterial({ color: 0x0000ff })
    // const line = new THREE.LineSegments(geometry, material)
    // scene.add(line)
    //
    // // for t in [0, 1], sample on the polyline and render a dot
    // for (let t = 0; t <= 0.1; t += 0.01) {
    //     const point = circle.getPoint(t)
    //     const geometry = new THREE.SphereGeometry(0.01, 32, 32);
    //     const material = new THREE.MeshBasicMaterial({ color: randomColor() });
    //     const mesh = new THREE.Mesh(geometry, material);
    //     mesh.position.set(point.x, point.y, point.z);
    //
    //     // also draw the tangent and normal lines, use red and green colors
    //     const tangent = circle.getTangent(t)
    //     const normal = circle.getNormal(t)
    //     const tangentGeometry = new THREE.BufferGeometry().setFromPoints([point, point.clone().add(tangent)]);
    //     const tangentMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
    //     const tangentLine = new THREE.Line(tangentGeometry, tangentMaterial);
    //     scene.add(tangentLine)
    //
    //     const normalGeometry = new THREE.BufferGeometry().setFromPoints([point, point.clone().add(normal)]);
    //     const normalMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    //     const normalLine = new THREE.Line(normalGeometry, normalMaterial);
    //     scene.add(normalLine)
    //
    //     scene.add(mesh);
    // }

    const rng = mulberry32()
    const knotVaryingWidthFn = (x: number) => -((12 * x) ** 4) + 0.5
    const knotConstantWidth = knotVaryingWidthFn(-0.05)
    const knotWidthFn = (x: number) => {
        if (x < 0 || x > 1) {
            throw new Error("knotWidthFn expects x to be in [0, 1]");
        }
        if (x < 0.1) {
            return knotVaryingWidthFn(x - 0.05)
        }
        if (x < 0.9) {
            return knotConstantWidth
        }
        return knotVaryingWidthFn(x - 0.95)
    }

    const basePlane = new THREE.PlaneGeometry(3, 3);
    basePlane.rotateX(-Math.PI / 2)

    const seeds = distributePointsOnFaces("poisson disk", {
        geometry: basePlane, selection: true, densityMax: 10, densityFactor: 1, distanceMin: 0.2
    })

    const bambooStemSeeds = seeds
        .map((point) => CurveLine.fromDirection(point, new THREE.Vector3(0, 1, 0),
            randomValue("float", rng, properties.bamboo.minHeight, properties.bamboo.maxHeight)))
        .map((curve) => curve.resampleByLength(
            randomValue("float", rng, properties.knot.minHeight, properties.knot.maxHeight)))
        .map((curve) => curve.toGeometry()) // TODO wind
        .map((geometry) => splitEdges("scale", geometry, "line", 0.05))

    const bambooStems = bambooStemSeeds.map((stem) => stem.flatMap(geometryToCurve))
    const resampledStems = bambooStems
        .map((stem) => stem.map((curve, knotIndex, knots) => {
            const n = 10

            // sample more on the endpoints
            const resampledPoints = []
            const radii = []
            for (let i = 0; i <= n; i++) {
                const alpha = i / n
                const t = alpha < 0.45 ? 0.3 * alpha : alpha < 0.55 ? 7.3 * (alpha - 0.45) + 0.135 : 0.3 * (alpha - 1) + 1
                const h = (knotIndex + alpha) / knots.length
                const r = knotWidthFn(t) * 0.1 * (1 - 0.5 * h)
                resampledPoints.push(curve.getPoint(t))
                radii.push(r)
            }
            return new Polyline(resampledPoints, false, radii)
        }))

    const stemCircles = resampledStems.map((stem) =>
        stem.flatMap((geometry) => {
            return Array.from(walkPoints(geometry.toGeometry()).map((point, i) => {
                return new CurveCircle(geometry.radius[i], 12).toGeometry().rotateX(-Math.PI / 2).translate(point.x, point.y, point.z)
            }))
        }))

    const stemMeshes = resampledStems.map((stem) =>
        stem.map((curve) => curve.toMeshGeometryWithRadius((r) => new CurveCircle(r, 8), 8)))

    // drawGeometry(basePlane, scene)
    // drawPoints(seeds, scene)
    // drawLines(bambooStemSeeds.flat(), scene)
    // drawCurves(resampledStems.flat(), scene)
    // drawLines(stemCircles.flat(), scene)

    stemMeshes.flat(2).map((geometry) => {
        const material = new THREE.MeshStandardMaterial({
            color: 0x666666, // brown color
            side: THREE.DoubleSide,
            opacity: 0.5,
            transparent: true
        })
        const mesh = new THREE.Mesh(geometry, material)
        scene.add(mesh)
    })

    // leaf stems
    // give some extra spots for potential stems
    const leafSeeds = resampledStems.flat().flatMap((knotCurve) => {
        const n = 5
        const points = []
        for (let i = 0; i <= n; i++) {
            // allow 0.1 to 0.3
            const t = 0.2 * i / n + 0.1
            points.push(knotCurve.getPoint(t))
        }
        return points
    })

    const leafStems = instanceOnPoints(leafSeeds, (point) => {
        const line = CurveLine.fromDirection(point, new THREE.Vector3(0, 1, 0),
            randomValue("float", rng, 0.1, 0.3))
        const n = 10
        const locals = []
        const radii = []
        const basePoint = line.getPoint(0)
        for (let i = 0; i <= n; i++) {
            // sample more on the root because of greater curvature
            const t = (4 ** (i / n) - 1) / 3;
            const point = line.getPoint(t)
            const offsetX = (5 ** t - 1) / 20;
            locals.push(new THREE.Vector3(point.x - basePoint.x + offsetX, point.y - basePoint.y, point.z - basePoint.z))
            radii.push(((t - 0.75) ** 2 + 0.4375) * 0.01)
        }
        const geometry = new Polyline(locals, false, radii)
            .toMeshGeometryWithRadius((radius) => new CurveCircle(radius), 5)
        const yRotation = new THREE.Matrix4().makeRotationY(randomValue("float", rng, -Math.PI, Math.PI))
        const zRotation = new THREE.Matrix4().makeRotationZ(randomValue("float", rng, -0.5, 0))
        geometry.applyMatrix4(yRotation.multiply(zRotation)).translate(basePoint.x, basePoint.y, basePoint.z)
        return geometry
    }, leafSeeds.map(() => rng() < 0.268))

    leafStems.forEach((geometry) => {
        const material = new THREE.MeshStandardMaterial({
            color: 0x228B22, // green color
            side: THREE.DoubleSide,
            opacity: 0.5,
            transparent: true
        })
        const mesh = new THREE.Mesh(geometry, material)
        scene.add(mesh)
    })

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