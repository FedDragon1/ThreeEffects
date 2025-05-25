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
    walkFaces,
} from "@/lib/nodes/utils";
// @ts-ignore
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { distributePointsOnFaces } from "@/lib/nodes/point";
import { CurveLine } from "@/lib/nodes/curves";
import { randomValue } from "@/lib/nodes/operations";

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

    const basePlane = new THREE.PlaneGeometry(3, 3);
    basePlane.rotateX(-Math.PI / 2)

    const seeds = distributePointsOnFaces("Poisson Disk", {
        geometry: basePlane, selection: true, densityMax: 10, densityFactor: 1, distanceMin: 0.2
    })

    const bambooStems = seeds
        .map((point) => CurveLine.fromDirection(point, new THREE.Vector3(0, 1, 0),
            randomValue("Float", rng, properties.bamboo.minHeight, properties.bamboo.maxHeight)))
        .map((curve) => curve.resampleByLength(
            randomValue("Float", rng, properties.knot.minHeight, properties.knot.maxHeight)))
        .map((curve) => curve.toGeometry())

    drawGeometry(basePlane, scene)
    drawPoints(seeds, scene)
    drawLines(bambooStems, scene)
    // drawCurves(bambooStems, scene)

    const pointLight = new THREE.PointLight(0xffffff, 30)
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