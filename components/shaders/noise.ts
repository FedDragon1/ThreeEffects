import { Effect, EffectAttribute } from 'postprocessing'
import fragmentShader from "@/components/shaders/noise.glsl"
import { recordToUniformVariables } from "@/components/shaders/utils";

interface UniformVariable {
    size: number
}

const defaultUniforms: UniformVariable = {
    size: 0.04,
}

export class NoiseEffect extends Effect {
    constructor(uniforms?: Partial<UniformVariable>) {
        const uniformVariables = recordToUniformVariables({
            ...defaultUniforms,
            ...uniforms ?? {},
        })

        super(
            "NoiseEffect",
            fragmentShader,
            {
                uniforms: uniformVariables,
                attributes: EffectAttribute.NONE
            }
        );
    }
}