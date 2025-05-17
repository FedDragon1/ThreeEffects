import { makeVariable, mulberry32, walkFaces, zip } from "@/lib/nodes/utils";
import * as THREE from "three";
import { Vector3 } from "three";

type PointDistributionMethod = keyof typeof pointDistrubutors;
type DistributorFn<M extends PointDistributionMethod> = typeof pointDistrubutors[M]
type ArgsFor<M extends PointDistributionMethod> = Parameters<DistributorFn<M>>
type ResultFor<M extends PointDistributionMethod> = ReturnType<DistributorFn<M>>


function distributePointsOnFacesPoissonDisk(params: {
    geometry: THREE.BufferGeometry,
    selection: Variable<boolean>,
    distanceMin: number,
    densityMax: number,
    densityFactor: Variable<number>,
    seed?: number
}): Vector3[] {
    const { geometry, selection, distanceMin, densityMax, densityFactor, seed } = params
    const rng = mulberry32(seed)

    // write the poisson disk algorithm here
    const index = geometry.getIndex()
    if (!index) {
        throw new Error("Geometry does not have an index attribute")
    }
    const faceCount = index.count / 3

    const selectionG = makeVariable(selection, faceCount)
    const densityFactorG = makeVariable(densityFactor, faceCount)
    const points: THREE.Vector3[] = []

    return [new Vector3(0, 0, 0)]
}

function distributePointsOnFacesRandom(params: {
    geometry: THREE.BufferGeometry,
    selection: Variable<boolean>,
    density: Variable<number>,
    seed?: number
}): Vector3[] {
    const { geometry, selection, density, seed } = params
    const rng = mulberry32(seed)

    const index = geometry.getIndex()
    if (!index) {
        throw new Error("Geometry does not have an index attribute")
    }
    const faceCount = index.count / 3

    const selectionG = makeVariable(selection, faceCount)
    const densityG = makeVariable(density, faceCount)
    const points: THREE.Vector3[] = []

    for (const [face, selection, density] of zip(walkFaces(geometry), selectionG, densityG)) {
        if (!selection) {
            continue
        }

        const ideal = face.area * density
        const target = rng() > 0.5 ? Math.floor(ideal) : Math.ceil(ideal)

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

const pointDistrubutors = {
    "Poisson Disk": distributePointsOnFacesPoissonDisk,
    "Random": distributePointsOnFacesRandom,
} as const

export function distributePointsOnFaces<M extends PointDistributionMethod>(method: M, ...args: [...ArgsFor<M>]): ResultFor<M> {
    const fn = pointDistrubutors[method] as unknown as (...a: ArgsFor<M>) => ResultFor<M>;
    return fn(...args) as ResultFor<M>;
}


