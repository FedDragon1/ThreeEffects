import * as THREE from "three";
import { createDistributorFor } from "@/lib/nodes/utils";

export function floatCurve(handles: Handle[], clipping: Clipping): (value: number, fac: number) => number {
    const sortedHandles = handles.toSorted((a, b) => a.x - b.x)

    return (value, fac = 1) => {
        const interpolated = 0
        return interpolated * fac + value * (1 - fac)
    }
}

function randomMinMaxFloat(rng: () => number, min: number, max: number) {
    const range = max - min;
    return min + rng() * range;
}

function randomMinMaxInt(rng: () => number, min: number, max: number) {
    const range = max - min + 1;
    return Math.floor(min + rng() * range);
}

function randomMinMaxBoolean(rng: () => number, probability: number) {
    return rng() < probability;

}

function randomMinMaxVector(rng: () => number, min: number, max: number) {
    const range = max - min;
    return new THREE.Vector3(
        min + rng() * range,
        min + rng() * range,
        min + rng() * range
    );
}

export const randomValue = createDistributorFor({
    "float": randomMinMaxFloat,
    "int": randomMinMaxInt,
    "boolean": randomMinMaxBoolean,
    "vector": randomMinMaxVector,
})