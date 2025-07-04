import * as THREE from 'three';
import { BufferGeometry, Vector3 } from 'three';
import { enumerate, makeSpan, walkPoints, zip } from "@/lib/nodes/utils";

export abstract class Curve {
    abstract getLength(): number;

    abstract getPoint(t: number): THREE.Vector3;

    abstract getTangent(t: number): THREE.Vector3;

    abstract getNormal(t: number): THREE.Vector3;

    abstract toGeometry(): THREE.BufferGeometry

    abstract resample(count: number): Polyline;

    resampleByLength(length: number): Polyline {
        const count = Math.floor(this.getLength() / length);
        return this.resample(count + 1);
    }
}

export class Polyline extends Curve {
    prefixVertices: number[]
    radius: number[]

    constructor(public points: THREE.Vector3[], public enclose: boolean = false, radius: Span<number> = 1) {
        super()

        if (points.length < 2) {
            throw new Error("Polyline must have at least two points");
        }

        const segmentLengths = this.segments
            .map(([p1, p2]) => p1.distanceTo(p2));
        const totalLength = segmentLengths.reduce((a, b) => a + b, 0);
        const eachT = segmentLengths.map(length => length / totalLength);
        const prefixT = [0]
        for (let i = 0; i < eachT.length; i++) {
            prefixT.push(prefixT[i] + eachT[i])
        }
        this.prefixVertices = prefixT
        this.radius = Array.from(makeSpan(radius, this.points.length))
    }

    get segments() {
        if (this.enclose) {
            return Array.from(zip(this.points, this.points.slice(1).concat(this.points[0])))
        }
        return Array.from(zip(this.points.slice(0, -1), this.points.slice(1)))
    }

    /**
     * Given 0 <= t <= 1, return the segment of the polyline that contains t,
     * and the t value of the segment. Additionally, return the indices of the points.
     *
     * @param t
     */
    getSegmentByT(t: number): [THREE.Vector3, THREE.Vector3, number, number, number] {
        if (t < 0 || t > 1) {
            throw new Error("t must be between 0 and 1");
        }

        let l = 0;
        let u = this.prefixVertices.length - 1;
        while (l < u) {
            const m = Math.floor((l + u) / 2);
            if (this.prefixVertices[m] <= t) {
                l = m + 1;
            } else {
                u = m;
            }
        }

        l--;
        const r = (l + 1) % this.points.length;
        return [
            this.points[l],
            this.points[r],  // mod should only trigger when the polyline is closed
            (t - this.prefixVertices[l]) / (this.prefixVertices[l + 1] - this.prefixVertices[l]),
            l,
            r
        ]
    }

    getLength(): number {
        let length = 0;
        for (let i = 0; i < this.points.length - 1; i++) {
            length += this.points[i].distanceTo(this.points[i + 1]);
        }
        return length;
    }

    getPoint(t: number): THREE.Vector3 {
        const [p1, p2, t2] = this.getSegmentByT(t);
        return new THREE.Vector3().lerpVectors(p1, p2, t2);
    }

    getPointWithRadius(t: number): [THREE.Vector3, number] {
        const [p1, p2, t2, l, r] = this.getSegmentByT(t);
        const point = new THREE.Vector3().lerpVectors(p1, p2, t2);
        const radius = this.radius[l] * (1 - t2) + this.radius[r] * t2;
        return [point, radius];
    }

    getTangent(t: number): THREE.Vector3 {
        const [p1, p2] = this.getSegmentByT(t);
        return new THREE.Vector3().subVectors(p2, p1).normalize();
    }

    getNormal(t: number): THREE.Vector3 {
        const tangent = this.getTangent(t);
        return new THREE.Vector3(tangent.y, -tangent.x, tangent.z).normalize();
    }

    resample(count: number): Polyline {
        const points: THREE.Vector3[] = [];
        for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            points.push(this.getPoint(t));
        }
        return new Polyline(points, this.enclose);
    }

    toGeometry(): BufferGeometry {
        const geometry = new BufferGeometry();
        const indicesLength = this.enclose ? this.points.length * 2 : (this.points.length - 1) * 2;
        const vertices = new Float32Array(this.points.length * 3);
        const indices = new Uint16Array(indicesLength);

        for (let i = 0; i < this.points.length; i++) {
            const point = this.points[i];
            vertices.set([point.x, point.y, point.z], i * 3);
            if (i < this.points.length - 1) {
                indices.set([i, i + 1], i * 2);
            } else if (this.enclose) {
                indices.set([i, 0], i * 2);
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        return geometry;
    }

    toMeshGeometryWithRadius(profileCurve: (radius: number) => Curve,
                             curveResolution: number,
                             alignTangent: boolean = true,
                             withUvAttribute: boolean = false): BufferGeometry {
        // for each point in the polyline, create a profile curve with the radius at that point
        // and then create a tube geometry from the profile curves
        // for each two consecutive profile curves, create indices that connect them in triangles
        // connect a[i] to b[i], b[i] to a[(i + 1) % a.length], a[i] to a[(i + 1) % a.length]
        // then connect b[i] to b[(i + 1) % b.length], b[(i + 1) % b.length] to a[(i + 1) % a.length], a[(i + 1) % a.length] to b[i]

        const vertices = new Float32Array(this.points.length * curveResolution * 3);
        let uv: Float32Array | undefined
        if (withUvAttribute) {
            uv = new Float32Array(this.points.length * curveResolution * 2);
        }
        for (const [i, [point, radius]] of enumerate(zip(this.points, this.radius))) {
            const profileCurveInstance = profileCurve(radius).resample(curveResolution);
            const profileGeometry = profileCurveInstance.toGeometry();
            if (alignTangent) {
                const t = i / (this.points.length - 1),
                    tangent = this.getTangent(t).normalize(),
                    axis = new THREE.Vector3(0, 0, 1).cross(tangent).normalize(),
                    angle = Math.acos(new THREE.Vector3(0, 0, 1).dot(tangent)),
                    m = new THREE.Matrix4().makeRotationAxis(axis, angle)
                profileGeometry.applyMatrix4(m); // rotate the profile curve to align with the polyline
            }
            profileGeometry.translate(point.x, point.y, point.z);

            for (const [j, position] of enumerate(walkPoints(profileGeometry))) {
                vertices.set([position.x, position.y, position.z], (i * curveResolution + j) * 3);
                if (withUvAttribute) {
                    const u = j / (curveResolution - 1);
                    const v = i / (this.points.length - 1);
                    uv!.set([u, v], (i * curveResolution + j) * 2);
                }
            }
        }

        const consecutiveProfileCurves = this.points.length - (this.enclose ? 0 : 1);
        const indices = new Uint16Array(consecutiveProfileCurves * curveResolution * 6);
        for (let i = 0; i < consecutiveProfileCurves; i++) {
            for (let j = 0; j < curveResolution; j++) {
                const a1 = i * curveResolution + j;
                const a2 = ((i + 1) % this.points.length) * curveResolution + j;
                const b1 = i * curveResolution + (j + 1) % curveResolution;
                const b2 = ((i + 1) % this.points.length) * curveResolution + (j + 1) % curveResolution;

                indices.set([a1, b1, a2], (i * curveResolution + j) * 6);
                indices.set([b1, b2, a2], (i * curveResolution + j) * 6 + 3);
            }
        }

        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        if (withUvAttribute) {
            geometry.setAttribute('uv', new THREE.BufferAttribute(uv!, 2));
        }
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        return geometry
    }
}

export class CurveLine extends Curve {
    constructor(public start: THREE.Vector3, public end: THREE.Vector3) {
        super();
    }

    getLength(): number {
        return this.start.distanceTo(this.end);
    }

    getPoint(t: number): THREE.Vector3 {
        return new THREE.Vector3().lerpVectors(this.start, this.end, t);
    }

    getTangent(t: number): THREE.Vector3 {
        return new THREE.Vector3().subVectors(this.end, this.start).normalize();
    }

    getNormal(t: number): THREE.Vector3 {
        const tangent = this.getTangent(t);
        return new THREE.Vector3(tangent.y, -tangent.x, tangent.z).normalize();
    }

    toGeometry(): THREE.BufferGeometry {
        const geometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            this.start.x, this.start.y, this.start.z,
            this.end.x, this.end.y, this.end.z,
        ]);
        const edge = new Uint16Array([0, 1]);
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setIndex(new THREE.BufferAttribute(edge, 1));
        return geometry;
    }

    resample(count: number): Polyline {
        const points: THREE.Vector3[] = [];
        for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            points.push(this.getPoint(t));
        }
        return new Polyline(points);
    }

    static fromDirection(start: THREE.Vector3, direction: THREE.Vector3, length: number): CurveLine {
        const end = new THREE.Vector3().addVectors(start, direction.clone().normalize().multiplyScalar(length));
        return new CurveLine(start, end);
    }
}

export class CurveCircle extends Curve {
    constructor(public radius: number, public resolution: number = 32) {
        if (resolution < 3) {
            throw new Error("Resolution of a circle curve must be at least 3");
        }
        super();
    }

    getLength(): number {
        return 2 * Math.PI * this.radius;
    }

    getPoint(t: number): THREE.Vector3 {
        const angle = t * 2 * Math.PI;
        const x = this.radius * Math.cos(angle);
        const y = this.radius * Math.sin(angle);
        return new THREE.Vector3(x, y, 0);
    }

    getTangent(t: number): Vector3 {
        const angle = t * 2 * Math.PI;
        const x = -Math.sin(angle);
        const y = Math.cos(angle);
        const z = 0;
        return new THREE.Vector3(x, y, z).normalize();
    }

    getNormal(t: number): Vector3 {
        const angle = t * 2 * Math.PI;
        const x = Math.cos(angle);
        const y = Math.sin(angle);
        const z = 0;
        return new THREE.Vector3(x, y, z).normalize();
    }

    toGeometry(): BufferGeometry {
        const geometry = new BufferGeometry();
        const vertices = new Float32Array(this.resolution * 3);
        const indices = new Uint16Array(this.resolution * 2);

        for (let i = 0; i < this.resolution; i++) {
            const t = i / this.resolution;
            const point = this.getPoint(t);
            vertices.set([point.x, point.y, point.z], i * 3);
            indices.set([i, (i + 1) % this.resolution], i * 2);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        return geometry;
    }

    resample(count: number): Polyline {
        const points: THREE.Vector3[] = [];
        for (let i = 0; i < count; i++) {
            const t = i / count;
            points.push(this.getPoint(t));
        }
        return new Polyline(points, true);
    }
}
