import { Effect, EffectAttribute } from 'postprocessing'
import fragmentShader from "@/lib/shaders/halftone.glsl"
import { recordToUniformVariables } from "@/lib/shaders/utils";

interface UniformVariable {
    u_gridDensity: number
}

const defaultUniforms: UniformVariable = {
    u_gridDensity: 150,
}

export class HalftoneEffect extends Effect {
    constructor(uniforms?: Partial<UniformVariable>) {
        const uniformVariables = recordToUniformVariables({
            ...defaultUniforms,
            ...uniforms ?? {},
        })

        super(
            "HalftoneEffect",
            fragmentShader,
            {
                uniforms: uniformVariables,
                attributes: EffectAttribute.NONE
            }
        );
    }

    get density() {
        return this.uniforms.get('u_gridDensity')!.value;
    }

    set density(value) {
        this.uniforms.get('u_gridDensity')!.value = value;
    }
}