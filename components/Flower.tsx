"use client"

import { FC, useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three"
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'dat.gui';
import { EffectComposer } from "postprocessing";

interface FlowerProps {
    className?: string
}

function registerCanvasResizeListener(obj: {
    canvas: HTMLCanvasElement,
    renderer: THREE.WebGLRenderer,
    composer: EffectComposer,
    camera: THREE.PerspectiveCamera
}) {
    const canvasResizeListener = () => {
        const {
            canvas,
            renderer,
            composer,
            camera
        } = obj

        canvas.style.width = ""
        canvas.style.height = ""
        const { width, height } = canvas.getBoundingClientRect()
        canvas.width = width
        canvas.height = height

        renderer.setSize(width, height)
        composer.setSize(width, height)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
    }
    canvasResizeListener()

    window.addEventListener("resize", canvasResizeListener)

    let pxRatio = window.devicePixelRatio || window.screen.availWidth / document.documentElement.clientWidth;

    function isZooming() {
        const newPxRatio = window.devicePixelRatio || window.screen.availWidth / document.documentElement.clientWidth;
        if (newPxRatio != pxRatio) {
            pxRatio = newPxRatio;
            return true
        }
        return false
    }

    let handle: number;

    function rafZoom() {
        if (isZooming()) {
            canvasResizeListener()
        }
        handle = requestAnimationFrame(rafZoom)
    }

    rafZoom()

    return () => {
        window.removeEventListener("resize", canvasResizeListener)
        cancelAnimationFrame(handle)
    }
}

const Flower: FC<FlowerProps> = ({ className }) => {
    function onCanvasLoad(canvas: HTMLCanvasElement) {
        // META INFO

        const aspRatio = canvas.clientWidth / canvas.clientHeight
        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(75, aspRatio, 0.1, 1000)
        const renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: true
        })
        camera.position.set(0, 0, 5);

        // 3D MODELS

        const quadGeometry = new THREE.BoxGeometry(2, 2, 2)
        const quadMaterial = new THREE.MeshPhongMaterial({
            color: new THREE.Color(0xffffff)
        })
        const quadMesh = new THREE.Mesh(quadGeometry, quadMaterial)
        scene.add(quadMesh)

        const pointLight = new THREE.PointLight(0xff8080, 10)
        pointLight.position.set(2, 2, -2)
        scene.add(pointLight)

        const ambientLight = new THREE.AmbientLight(0xffffff, 1)
        scene.add(ambientLight)

        const axesHelper = new THREE.AxesHelper(5);
        scene.add(axesHelper)

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.25

        // GUI

        const gui = new GUI()
        const cubeFolder = gui.addFolder("Cube Options")
        const cubeParams = {
            rotationSpeed: 0.01,
            color: quadMaterial.color.getHex()
        }

        cubeFolder.add(cubeParams, "rotationSpeed", 0, 0.1).name("Rotation Speed").onChange((value) => {
            cubeParams.rotationSpeed = value
        })
        cubeFolder.addColor(cubeParams, "color").name("Cube Color").onChange((color) => {
            quadMaterial.color.set(color)
        })
        cubeFolder.open()

        const lightFolder = gui.addFolder("Light Options")
        const lightParams = {
            intensity: pointLight.intensity,
            x: pointLight.position.x,
            y: pointLight.position.y,
            z: pointLight.position.z
        }

        lightFolder.add(lightParams, "intensity", 0, 20).name("Intensity").onChange((value) => {
            pointLight.intensity = value
        })
        lightFolder.add(lightParams, "x", -5, 5).name("x").onChange((value) => {
            pointLight.position.setX(value)
        })
        lightFolder.add(lightParams, "y", -5, 5).name("t").onChange((value) => {
            pointLight.position.setY(value)
        })
        lightFolder.add(lightParams, "z", -5, 5).name("z").onChange((value) => {
            pointLight.position.setZ(value)
        })
        lightFolder.open()

        // COMPOSING & HOOKS

        const composer = new EffectComposer(renderer, {
            frameBufferType: THREE.FloatType
        })

        const resizeCleanUp = registerCanvasResizeListener({ canvas, renderer, composer, camera })

        // RENDER LOOP
        const clock = new THREE.Clock()

        let handle: number
        function render() {
            const delta = clock.getDelta()
            quadMesh.rotateX(delta * cubeParams.rotationSpeed * Math.PI * 2)

            handle = requestAnimationFrame(render)
            renderer.render(scene, camera)
            controls.update()

            console.log(handle)
        }
        render()

        function getHandle() {
            return handle
        }

        // CLEAN UP
        return () => {
            cancelAnimationFrame(getHandle())
            resizeCleanUp()
            gui.destroy()
            controls.dispose()
            renderer.dispose()
        }
    }

    const [canvas, setCanvas] = useState<HTMLCanvasElement>()
    const canvasCallback = useCallback((node: HTMLCanvasElement | null) => {
        if (node) {
            setCanvas(node)
        }
    }, [])

    useEffect(() => {
        if (!canvas) {
            return
        }

        console.log("ThreeCanvas Loaded")
        const onUnload = onCanvasLoad(canvas)

        return () => {
            console.log("ThreeCanvas Unmounting...")
            onUnload()
        }
    }, [canvas]);

    return (
        <div className={className}>
            <canvas ref={canvasCallback} className={"w-full h-full"}></canvas>
        </div>
    )
}

export default Flower