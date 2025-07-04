import * as THREE from 'three';
import { recordToUniformVariables } from "@/lib/shaders/utils";
import fragmentShader from "@/lib/shaders/bamboo/leafFragment.glsl";
import vertexShader from "@/lib/shaders/bamboo/leafVertex.glsl";

interface UniformVariable {
    uTime: number,
    uOrigin: THREE.Vector3,
    uZMin: number
    uZMax: number
}

const defaultUniforms: UniformVariable = {
    uTime: 0,
    uOrigin: new THREE.Vector3(0, 0, 0),
    uZMin: 7,
    uZMax: 10,
}


export class LeafMaterial extends THREE.ShaderMaterial {
    constructor(uniforms: Partial<UniformVariable>) {
        super({
            side: THREE.DoubleSide,
            transparent: true,
            uniforms: Object.fromEntries(recordToUniformVariables({
                ...defaultUniforms,
                ...uniforms,
            }).entries()),
            vertexShader,
            fragmentShader,
        });
    }
}