import * as THREE from "three";
import { createDistributorFor, makeSpan, makeSpanEager, walkEdges, zip } from "@/lib/nodes/utils";
import { CurveLine } from "@/lib/nodes/curves";

function splitEdgesImpl(edges: [THREE.Vector3, THREE.Vector3][], scales: number[]) {
    if (edges.length !== scales.length) {
        throw new Error("Edges and scale arrays must have the same length");
    }

    const newEdges: THREE.BufferGeometry[] = [];
    for (const [[p1, p2], scale] of zip(edges, scales)) {
        const distance = p1.distanceTo(p2);
        if (distance === 0) continue; // Skip zero-length edges

        const dp1 = new THREE.Vector3().subVectors(p2, p1).multiplyScalar(scale).add(p1);
        const dp2 = new THREE.Vector3().subVectors(p1, p2).multiplyScalar(scale).add(p2);

        const edgeGeometry = new THREE.BufferGeometry();
        edgeGeometry.setFromPoints([dp1, dp2]);
        edgeGeometry.setIndex([0, 1]);
        newEdges.push(edgeGeometry);
    }

    return newEdges;
}

function splitEdgesByScale(geometry: THREE.BufferGeometry, meshType: "line" | "mesh", scale: Span<number>) {
    const edges = Array.from(walkEdges(geometry, meshType))
    const scaleG = makeSpanEager(scale, edges.length)

    return splitEdgesImpl(edges, scaleG)
}

function splitEdgesByOffset(geometry: THREE.BufferGeometry, meshType: "line" | "mesh", offset: Span<number>) {
    const edges = Array.from(walkEdges(geometry, meshType))
    const offsetG = makeSpan(offset, edges.length)
    const scales = zip(edges, offsetG).map(([[p1, p2], offset]) => {
        const distance = p1.distanceTo(p2);
        return (distance - offset) / distance
    })

    return splitEdgesImpl(edges, Array.from(scales))
}

export const splitEdges = createDistributorFor({
    "scale": splitEdgesByScale,
    "offset": splitEdgesByOffset,
});

export function geometryToCurve(geometry: THREE.BufferGeometry): CurveLine[] {
    const edges = Array.from(walkEdges(geometry, "line"));
    return edges.map(([p1, p2]) => new CurveLine(p1, p2));
}
