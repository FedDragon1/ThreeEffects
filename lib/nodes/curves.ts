import * as THREE from 'three';
import { BufferGeometry, Vector3 } from 'three';
import { zip } from "@/lib/nodes/utils";

export abstract class Curve {
    abstract getLength(): number;

    abstract getPoint(t: number): THREE.Vector3;

    abstract getTangent(t: number): THREE.Vector3;

    abstract getNormal(t: number): THREE.Vector3;

    abstract toGeometry(): THREE.BufferGeometry

    abstract resample(count: number): Polyline;

    resampleByLength(length: number): Polyline {
        const count = Math.floor(this.getLength() / length);
        return this.resample(count);
    }
}

class Polyline extends Curve {
    prefixVertices: number[]

    constructor(public points: THREE.Vector3[], public enclose: boolean = false) {
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
    }

    get segments() {
        if (this.enclose) {
            return Array.from(zip(this.points, this.points.slice(1).concat(this.points[0])))
        }
        return Array.from(zip(this.points.slice(0, -1), this.points.slice(1)))
    }

    /**
     * Given 0 <= t <= 1, return the segment of the polyline that contains t,
     * and the t value of the segment.
     *
     * @param t
     */
    getSegmentByT(t: number): [THREE.Vector3, THREE.Vector3, number] {
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
        return [
            this.points[l],
            this.points[(l + 1) % this.points.length],  // mod should only trigger when the polyline is closed
            (t - this.prefixVertices[l]) / (this.prefixVertices[l + 1] - this.prefixVertices[l])
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
        for (let i = 0; i <= count; i++) {
            const t = i / count;
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
        for (let i = 0; i <= count; i++) {
            const t = i / count;
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
