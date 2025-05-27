import {
    createDistributorFor,
    enumerate,
    makeSpan,
    mulberry32,
    randomBarycentricCoordinates,
    roundProbabilistic,
    walkFaces,
    zip
} from "@/lib/nodes/utils";
import * as THREE from "three";
import { Vector3 } from "three";
import { Face, KDTree3D } from "@/lib/nodes/structure";

function sampleOnFace(face: Face, calculatedDensity: number, rng: () => number): [THREE.Vector3[], THREE.Vector3[]] {
    const pointAmount = roundProbabilistic(rng, calculatedDensity * face.area)
    const resultPoints: THREE.Vector3[] = []
    const resultBaryCoordinates: THREE.Vector3[] = []

    for (let i = 0; i < pointAmount; i++) {
        const baryCoordinates = randomBarycentricCoordinates(rng)
        const pt1 = face.a.clone().multiplyScalar(baryCoordinates.x)
        const pt2 = face.b.clone().multiplyScalar(baryCoordinates.y)
        const pt3 = face.c.clone().multiplyScalar(baryCoordinates.z)
        const point = pt1.add(pt2).add(pt3)
        resultPoints.push(point)
        resultBaryCoordinates.push(baryCoordinates)
    }

    return [resultPoints, resultBaryCoordinates]
}

function filterClosePoints<T>(positions: THREE.Vector3[], distanceMin: number, ...syncArrays: T[][]): [THREE.Vector3[], ...T[][]] {
    if (distanceMin <= 0) {
        return [positions, ...syncArrays]
    }

    const eliminationMask = new Array(positions.length).fill(false)
    const kdTree = KDTree3D.constructFrom(positions)!

    for (const [i, point] of enumerate(positions)) {
        if (eliminationMask[i]) {
            continue
        }

        for (const [index] of kdTree.pointsWithinRadius(point, distanceMin)) {
            if (index !== i) {
                eliminationMask[index] = true
            }
        }
    }

    return [
        positions.filter((_, i) => !eliminationMask[i]),
        ...syncArrays.map(arr => arr.filter((_, i) => !eliminationMask[i]))
    ]

}

function filterByDensity(positions: THREE.Vector3[], densityFactors: number[], rng: () => number): THREE.Vector3[]{
    if (positions.length !== densityFactors.length) {
        throw new Error("positions and densityFactors must have the same length")
    }

    return positions.filter((_, i) => rng() <= densityFactors[i])
}

/**
 * Distribute points on faces of a geometry using Poisson Disk sampling.
 * Notice that for Blender, densityFactor is a vertex field; in here it is per face.
 *
 * @param params The parameters for the distribution.
 */
function distributePointsOnFacesPoissonDisk(params: {
    geometry: THREE.BufferGeometry,
    selection: Span<boolean>,
    distanceMin: number,
    densityMax: number,
    densityFactor: Span<number>,
    seed?: number
}): Vector3[] {
    const { geometry, selection, distanceMin, densityMax, densityFactor, seed } = params
    const rng = mulberry32(seed)

    const index = geometry.getIndex()
    if (!index) {
        throw new Error("Geometry does not have an index attribute")
    }
    const faceCount = index.count / 3

    const selectionG = makeSpan(selection, faceCount)
    const densityFactorG = makeSpan(densityFactor, faceCount)
    const points: THREE.Vector3[] = []
    const densities: number[] = []

    for (const [face, selection, densityFactor] of zip(walkFaces(geometry), selectionG, densityFactorG)) {
        if (!selection) {
            continue
        }

        // over sample mesh surface
        const [resultPoints] = sampleOnFace(face, densityMax, rng)
        points.push(...resultPoints)
        densities.push(...Array(resultPoints.length).fill(densityFactor))
    }

    // eliminate points that are too close to each other
    const [poissonDiskSamples, filteredDensities] = filterClosePoints(points, distanceMin, densities)

    // eliminate base on density factor
    return filterByDensity(poissonDiskSamples, filteredDensities, rng)
}

function distributePointsOnFacesRandom(params: {
    geometry: THREE.BufferGeometry,
    selection: Span<boolean>,
    density: Span<number>,
    seed?: number
}): Vector3[] {
    const { geometry, selection, density, seed } = params
    const rng = mulberry32(seed)

    const index = geometry.getIndex()
    if (!index) {
        throw new Error("Geometry does not have an index attribute")
    }
    const faceCount = index.count / 3

    const selectionG = makeSpan(selection, faceCount)
    const densityG = makeSpan(density, faceCount)
    const points: THREE.Vector3[] = []

    for (const [face, selection, density] of zip(walkFaces(geometry), selectionG, densityG)) {
        if (!selection) {
            continue
        }

        const ideal = face.area * density
        const target = roundProbabilistic(rng, ideal)

        for (let i = 0; i < target; i++) {
            // {u, v | u + v <= 1}
            // transformation to triangle = u * v1 + v * v2,
            // where v1 and v2 are random edges of the face
            const u = rng()
            const v = rng() * (1 - u)
            const v1 = new THREE.Vector3().subVectors(face.b, face.a)
            const v2 = new THREE.Vector3().subVectors(face.c, face.a)
            const point = new THREE.Vector3().addVectors(
                face.a,
                v1.multiplyScalar(u).add(v2.multiplyScalar(v))
            )
            points.push(point)
        }
    }

    return points
}

export const distributePointsOnFaces = createDistributorFor({
    "poisson disk": distributePointsOnFacesPoissonDisk,
    "random": distributePointsOnFacesRandom,
})

export function instanceOnPoints<P extends THREE.Vector3, T>(points: P[],
                                 instanceFactory: (point: P) => T,
                                 selection: Span<boolean> = true): T[] {
    const selectionG = makeSpan(selection, points.length);
    const geometries: T[] = [];
    for (const [point, select] of zip(points, selectionG)) {
        if (select) {
            geometries.push(instanceFactory(point))
        }
    }
    return geometries
}