import * as THREE from "three";
import { zip } from "@/lib/nodes/utils";

export class Face {
    constructor(public a: THREE.Vector3, public b: THREE.Vector3, public c: THREE.Vector3) {
    }

    get normal(): THREE.Vector3 {
        const ab = new THREE.Vector3().subVectors(this.b, this.a);
        const ac = new THREE.Vector3().subVectors(this.c, this.a);
        return new THREE.Vector3().crossVectors(ab, ac).normalize();
    }

    get centroid(): THREE.Vector3 {
        return new THREE.Vector3(
            (this.a.x + this.b.x + this.c.x) / 3,
            (this.a.y + this.b.y + this.c.y) / 3,
            (this.a.z + this.b.z + this.c.z) / 3
        );
    }

    get area(): number {
        const ab = new THREE.Vector3().subVectors(this.b, this.a);
        const ac = new THREE.Vector3().subVectors(this.c, this.a);
        return 0.5 * ab.cross(ac).length();
    }

    * [Symbol.iterator](): Generator<THREE.Vector3> {
        yield this.a;
        yield this.b;
        yield this.c;
    }
}

const toAxis = ["x", "y", "z"] as const;

export class KDTree3D {
    constructor(public value: THREE.Vector3,
                public left: KDTree3D | null,
                public right: KDTree3D | null,
                public index: number,
                public axis: number) {
    }

    static constructFrom(points: THREE.Vector3[], axis: number = 0, indices: number[] | null = null): KDTree3D | null {
        if (points.length === 0) {
            return null
        }

        const normIndices = indices ?? points.map((_, i) => i)
        if (normIndices.length !== points.length) {
            throw new Error("Indices length must match points length")
        }

        if (points.length === 1) {
            return new KDTree3D(points[0], null, null, normIndices[0], axis)
        }

        const sorted = Array.from(zip(points, normIndices))
            .toSorted(([a], [b]) => {
                const priDiff = a[toAxis[axis]] - b[toAxis[axis]]
                if (priDiff !== 0) {
                    return priDiff
                }
                const secDiff = a[toAxis[(axis + 1) % 3]] - b[toAxis[(axis + 1) % 3]]
                if (secDiff !== 0) {
                    return secDiff
                }
                return a[toAxis[(axis + 2) % 3]] - b[toAxis[(axis + 2) % 3]]
            })
        const [sortedPoints, sortedIndices] = Array.from(zip(...sorted)) as [THREE.Vector3[], number[]]

        const median = Math.floor((sorted.length - 1) / 2)
        const nextAxis = (axis + 1) % 3
        const leftTree = KDTree3D.constructFrom(sortedPoints.slice(0, median), nextAxis, sortedIndices.slice(0, median))
        const rightTree = KDTree3D.constructFrom(sortedPoints.slice(median + 1), nextAxis, sortedIndices.slice(median + 1))

        return new KDTree3D(sortedPoints[median], leftTree, rightTree, sortedIndices[median], axis)
    }

    * pointsWithinRadius(point: THREE.Vector3, radius: number): Generator<[number, THREE.Vector3, number]> {
        const searchStack: KDTree3D[] = [this]
        const radiusSquared = radius * radius

        while (searchStack.length) {
            const node = searchStack.pop()!
            const distanceSquared = point.distanceToSquared(node.value)

            if (point[toAxis[node.axis]] + radius < node.value[toAxis[node.axis]]) {
                if (node.left) {
                    searchStack.push(node.left)
                }
            } else if (point[toAxis[node.axis]] - radius > node.value[toAxis[node.axis]]) {
                if (node.right) {
                    searchStack.push(node.right)
                }
            } else {
                if (distanceSquared <= radiusSquared) {
                    yield [node.index, node.value, distanceSquared]
                }
                if (node.left) {
                    searchStack.push(node.left)
                }
                if (node.right) {
                    searchStack.push(node.right)
                }
            }
        }
    }
}
