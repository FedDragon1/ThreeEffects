import * as THREE from "three";

export function recordToUniformVariables(uniformVariables: Record<string, any>) {
    const transformed = new Map<string, THREE.Uniform>
    Object.entries(uniformVariables).forEach(([key, value]) => transformed.set(key, new THREE.Uniform(value)))
    return transformed
}

export function filterUndefined(uniformVariables: Record<string, any>) {
    const t: Record<string, any> = {}
    for (const [key, value] of Object.entries(uniformVariables)) {
        if (value !== undefined) {
            t[key] = value
        }
    }
    return t;
}