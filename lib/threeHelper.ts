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