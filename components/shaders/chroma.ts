import * as THREE from "three";
import { Effect, EffectAttribute } from 'postprocessing'
import fragmentShader from "@/components/shaders/chroma.glsl"
import { filterUndefined, recordToUniformVariables } from "@/components/shaders/utils";

interface UniformVariable {
    colorA: THREE.Color
    colorB: THREE.Color
    colorC: THREE.Color
    colorD: THREE.Color
    lowCut: number
    highCut: number
    colorPosition: THREE.Vector4
}

const defaultUniforms: UniformVariable = {
    lowCut: 0.1,
    highCut: 0.9,
    colorPosition: new THREE.Vector4(0.3, 0.55, 0.65, 0.85),
    colorA: new THREE.Color(0xE64F0F),
    colorB: new THREE.Color(0xAADFD9),
    colorC: new THREE.Color(0x23418A),
    colorD: new THREE.Color(0x16254B),
}

export class ChromaEffect extends Effect {
    constructor(uniforms?: Partial<UniformVariable>) {
        const uniformVariables = recordToUniformVariables({
            ...defaultUniforms,
            ...filterUndefined(uniforms ?? {}),
        })

        super(
            "ChromaEffect",
            fragmentShader,
            {
                uniforms: uniformVariables,
                attributes: EffectAttribute.NONE
            }
        );
    }
}