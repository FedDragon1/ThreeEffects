import { Effect, EffectAttribute } from 'postprocessing'
import fragmentShader from "@/components/shaders/turbulence.glsl"
import { recordToUniformVariables } from "@/components/shaders/utils";

interface UniformVariable {
    size: number
    amount: number
    complexity: number
    evolution: number
}

const defaultUniforms: UniformVariable = {
    size: 1,
    amount: 5,
    complexity: 1,
    evolution: 0
}

export class TurbulenceEffect extends Effect {
    constructor(uniforms?: Partial<UniformVariable>) {
        const uniformVariables = recordToUniformVariables({
            ...defaultUniforms,
            ...uniforms ?? {},
        })

        super(
            "TurbulenceEffect",
            fragmentShader,
            {
                uniforms: uniformVariables,
                attributes: EffectAttribute.NONE
            }
        );
    }

    get evolution() {
        return this.uniforms.get('evolution')!.value;
    }

    set evolution(value) {
        this.uniforms.get('evolution')!.value = value;
    }
}