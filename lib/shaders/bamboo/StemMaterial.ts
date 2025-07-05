import * as THREE from 'three';
import { recordToUniformVariables } from "@/lib/shaders/utils";
import fragmentShader from "@/lib/shaders/bamboo/stemFragment.glsl";
import vertexShader from "@/lib/shaders/bamboo/stemVertex.glsl";

interface UniformVariable {
    uTime: number,
    uOrigin: THREE.Vector3,
    uZMin: number
    uZMax: number
    uKnotWindSpeed: number,
    uKnotWindScale: number,
    uKnotLength: number,
    uKnotOrigin: THREE.Vector3
    uStemWindSpeed: number,
    uStemWindScale: number,
}

const defaultUniforms: UniformVariable = {
    uTime: 0,
    uOrigin: new THREE.Vector3(0, 0, 0),
    uZMin: 7,
    uZMax: 10,
    uKnotWindSpeed: 0.1,
    uKnotWindScale: 4,
    uKnotLength: 0.2,
    uKnotOrigin: new THREE.Vector3(0, 0, 0),
    uStemWindSpeed: 0.1,
    uStemWindScale: 5,
}


export class StemMaterial extends THREE.ShaderMaterial {
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