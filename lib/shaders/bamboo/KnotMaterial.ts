import * as THREE from 'three';
import { recordToUniformVariables } from "@/lib/shaders/utils";

interface UniformVariable {
    uTime: number,
    uOrigin: THREE.Vector3,
}

const defaultUniforms: UniformVariable = {
    uTime: 0,
    uOrigin: new THREE.Vector3(0, 0, 0),
}


export class KnotMaterial extends THREE.ShaderMaterial {
    constructor(uniforms: Partial<UniformVariable>) {
        super({
            uniforms: Object.fromEntries(recordToUniformVariables({
                ...defaultUniforms,
                ...uniforms,
            }).entries()),
            vertexShader: `
                uniform float uTime;
                uniform vec3 uOrigin;
                
                void main() {
                    vec4 localPos = vec4(uOrigin + position, 1.);
                    gl_Position = projectionMatrix * modelViewMatrix * localPos;
                }
            `,
            fragmentShader: `
                void main() {
                    gl_FragColor = vec4(1.0, 0., 0., 1.0);
                }
            `,
        });
    }
}