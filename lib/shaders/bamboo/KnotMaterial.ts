import * as THREE from 'three';
import { recordToUniformVariables } from "@/lib/shaders/utils";
import fragmentShader from "@/lib/shaders/bamboo/knotFragment.glsl";
import vertexShader from "@/lib/shaders/bamboo/knotVertex.glsl";

interface UniformVariable {
    uTime: number,
    uOrigin: THREE.Vector3,
    uZMin: number
    uZMax: number
    uKnotWindSpeed: number,
    uKnotWindScale: number,
    uKnotLength: number
}

const defaultUniforms: UniformVariable = {
    uTime: 0,
    uOrigin: new THREE.Vector3(0, 0, 0),
    uZMin: 7,
    uZMax: 10,
    uKnotWindSpeed: 0.1,
    uKnotWindScale: 4,
    uKnotLength: 0.2
}


export class KnotMaterial extends THREE.ShaderMaterial {
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