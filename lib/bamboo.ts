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
    randomColor,
    walkFaces,
} from "@/lib/nodes/utils";
// @ts-ignore
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { distributePointsOnFaces } from "@/lib/nodes/point";

export function onCanvasLoad(canvas: HTMLCanvasElement) {
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

    const boxGeometry = new THREE.TorusKnotGeometry(1);
    // const distributed = distributePointsOnFaces("Random", { geometry: boxGeometry, selection: true, density: 10 });
    const distributed = distributePointsOnFaces("Poisson Disk", {
        geometry: boxGeometry, selection: true, densityMax: 1000, densityFactor: 1, distanceMin: 0.1
    });

    for (const [p1, p2, p3] of walkFaces(boxGeometry)) {
        // construct a mesh for points p1 p2 p3
        const geometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            p1.x, p1.y, p1.z,
            p2.x, p2.y, p2.z,
            p3.x, p3.y, p3.z,
        ]);
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        const material = new THREE.MeshBasicMaterial({ color: randomColor() * 0.001 });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh)
    }

    for (const point of distributed) {
        const geometry = new THREE.SphereGeometry(0.05, 32, 32);
        const material = new THREE.MeshBasicMaterial({ color: randomColor() });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(point.x, point.y, point.z);
        scene.add(mesh);
    }


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