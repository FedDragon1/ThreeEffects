import * as THREE from "three";
import { Effect, EffectAttribute } from 'postprocessing'
import fragmentShader from "@/components/shaders/curve.glsl"
import { recordToUniformVariables } from "@/components/shaders/utils";

interface UniformVariable {
    // y-value of 25%, 50%, and 75% lightness mark.
    // 0% is set to black and 100% is set to white
    controls: THREE.Vector3
}

const defaultUniforms: UniformVariable = {
    controls: new THREE.Vector3(0.88, 0.5, 0.06)
}

export class CurveEffect extends Effect {
    constructor(uniforms?: Partial<UniformVariable>) {
        const uniformVariables = recordToUniformVariables({
            ...defaultUniforms,
            ...uniforms ?? {},
        })

        super(
            "CurveEffect",
            fragmentShader,
            {
                uniforms: uniformVariables,
                attributes: EffectAttribute.NONE
            }
        );
    }
}