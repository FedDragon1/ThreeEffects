import * as THREE from "three";
// @ts-ignore
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

import {
    BlendFunction,
    BloomEffect,
    EffectComposer,
    EffectPass,
    RenderPass,
} from "postprocessing";
import { registerCanvasResizeListener, registerMouseMoveListener } from "@/lib/threeHelper";
import { HalftoneEffect } from "@/lib/shaders/Halftone";
import gsap from "gsap";

const loadModel = async (): Promise<THREE.Mesh> => {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(
            '/cherry_blossom_petal/petal.glb',
            (gltf: any) => {
                // @ts-ignore
                resolve(gltf.scene.children[0].children[0]);
            },
            undefined,
            reject
        );
    });
};

class Petal extends THREE.Object3D {
    angularOffset: number
    alphaOffset: number
    mesh: THREE.Mesh | undefined = undefined
    material: THREE.Material | undefined = undefined

    constructor(angularOffset: number, alphaOffset: number) {
        super()

        this.angularOffset = angularOffset;
        this.alphaOffset = alphaOffset;

        loadModel().then((object) => {
            const geometry = object.geometry
            const originalMaterial = object.material as THREE.Material

            // @ts-ignore
            originalMaterial.uniforms = {
                alpha: { value: 0 }
            }

            originalMaterial.onBeforeCompile = (shader) => {
                shader.vertexShader = `
                uniform float alpha;
                varying vec3 vPosition;
            
                ${shader.vertexShader
                    .replace(
                        '#include <begin_vertex>',
                        `
                                    // 原顶点坐标计算代码
                                    #include <begin_vertex>
                                    
                                    // 自定义顶点变形：沿Y轴波浪运动
                                    vec3 pos = position;

                                    // pos.x -> [-0.5, 0.5], nx -> [-1, 1]
                                    float nx = pos.x / 0.5;
                                    // pos.y -> [0, 2], ny -> [0, 1]
                                    float ny = pos.y / 2.;
                                
                                    float bend = -(smoothstep(0., 1., alpha) * 2. - 1.);
                                    float zBendY = bend * nx * nx * 0.4;
                                    float zBendX = bend * ny * ny * 1.;
                                
                                    transformed.z += zBendX + zBendY;
                                
                                    vPosition = transformed;
                                `
                    )
                }
                `
            }

            geometry.center()
            geometry.translate(0, 1.4, -0.2)
            geometry.rotateY(Math.PI)
            geometry.scale(0.5, 0.5, 0.5)

            const mesh = new THREE.Mesh(geometry, originalMaterial)

            this.mesh = mesh
            this.material = originalMaterial
            this.update(0)
            this.add(mesh)
        })
    }

    interpolateAngle(alpha: number) {
        return Math.PI / 2 * Math.tanh(2 * (alpha - 0.5)) + Math.PI / 2 - 0.5
    }

    interpolateScale(alpha: number) {
        const f = (x: number) => -Math.pow(x, 4) + Math.pow(x, 2)
        const g = (x: number) => 4 * f(x - 1)
        const h = (x: number) => g(Math.pow(x, 1.5))
        const scale = h(alpha)
        return [scale, scale, scale] as const
    }

    interpolateTranslation(alpha: number) {
        if (alpha <= 0.5) {
            return 0
        }
        return -(Math.pow(5.8 * (alpha - 0.5), 1.5))
    }

    update(rawAlpha: number) {
        if (!this.mesh || !this.material) {
            return
        }

        const alpha = (this.alphaOffset + rawAlpha) % 1

        this.mesh.quaternion.identity()
        this.mesh.rotateY(this.angularOffset)
        this.mesh.rotateX(this.interpolateAngle(alpha))

        this.mesh.position.set(0, 0, 0)
        this.mesh.position.y = this.interpolateTranslation(alpha)

        const axis = new THREE.Vector3(Math.cos(this.angularOffset), 0, Math.sin(this.angularOffset))
        this.mesh.translateOnAxis(axis, this.interpolateTranslation(alpha))

        this.mesh.scale.set(...this.interpolateScale(alpha));

        // @ts-ignore
        this.material.uniforms.alpha.value = alpha
    }
}

class Flower extends THREE.Object3D {
    petals: Petal[]

    constructor(petals: Petal[]) {
        super()

        this.petals = petals
        this.petals.forEach((petal) => this.add(petal))
    }

    static generatePetals(num: number, petalPerLayer: number, alphaStagger: number) {
        const petals: Petal[] = []
        for (let layer = 0; layer < Math.ceil(num / petalPerLayer); layer++) {
            for (let p = 0; p < petalPerLayer && p + layer * petalPerLayer < num; p++) {
                const aOffset = layer % 2 ? Math.PI * 2 / petalPerLayer / 2 : 0
                const angularOffset = aOffset + Math.PI * 2 / petalPerLayer * p + Math.random() / 5
                petals.push(new Petal(angularOffset, layer * alphaStagger))
            }
        }
        return new Flower(petals)
    }

    update(t: number) {
        this.petals.forEach((petal) => petal.update(t))
    }
}

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

    const flower = Flower.generatePetals(50, 5, 0.1)
    flower.rotateZ(Math.PI / 4)
    flower.rotateX(Math.PI / 6)
    scene.add(flower)

    const pointLight = new THREE.PointLight(0xffffff, 30)
    pointLight.position.set(-2, 2, 2)
    scene.add(pointLight)

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5)
    scene.add(ambientLight)

    // COMPOSING & HOOKS

    const composer = new EffectComposer(renderer, {
        frameBufferType: THREE.FloatType,
    })
    const halftone = new HalftoneEffect({
        u_gridDensity: 0,
    })
    composer.addPass(new RenderPass(scene, camera))
    composer.addPass(new EffectPass(camera, halftone))
    composer.addPass(new EffectPass(camera, new BloomEffect({
        intensity: 20,
        luminanceThreshold: 0.2,
        luminanceSmoothing: 5,
        blendFunction: BlendFunction.AVERAGE
    })))

    // flower.rotation.order = "YZX"
    const resizeCleanUp = registerCanvasResizeListener({ canvas, renderer, composer, camera })
    const moveCleanUp = registerMouseMoveListener(canvas, (u, v) => {
        const up = (u - 0.5) / 2,
            vp = (v - 0.5) / 2

        gsap.to(flower.rotation, {
            x: up,
            y: Math.PI / 4,
            z: Math.PI / 6 + vp,
            duration: 0.5,
            ease: "power2.out",
            overwrite: true,
            onUpdate() {
                flower.quaternion.setFromEuler(flower.rotation)
            }
        })

        gsap.to(flower.position, {
            x: up,
            y: -vp,
            duration: 0.5,
            ease: "power2.out",
            overwrite: true
        })
    })

    // RENDER LOOP
    const clock = new THREE.Clock()

    const delay = 0.5
    const duration = 3
    const rate = (x: number) => 1 - (Math.sin(2 * Math.PI * x)) / (2 * Math.PI * x)

    let handle: number

    function render() {
        const delta = clock.getElapsedTime()
        flower.update(delta / 3)

        if (delay < delta && delta < delay + duration) {
            const alpha = rate((delta - delay) / duration)
            halftone.density = Math.floor(alpha * 100 + 50)
        }

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