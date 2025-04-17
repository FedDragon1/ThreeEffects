import * as THREE from "three";
import { EffectComposer } from "postprocessing";

export function registerCanvasResizeListener(obj: {
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

export function registerMouseMoveListener(canvas: HTMLCanvasElement, callback: (u: number, v: number) => void) {
    const listener = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect()

        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top
        const u = mouseX / rect.width
        const v = mouseY / rect.height

        callback(u, v)
    }

    document.addEventListener("mousemove", listener)

    return () => document.removeEventListener("mousemove", listener)
}