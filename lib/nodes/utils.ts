import * as THREE from 'three';

export class Face {
    constructor(public a: THREE.Vector3, public b: THREE.Vector3, public c: THREE.Vector3) {}

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

    *[Symbol.iterator](): Generator<THREE.Vector3> {
        yield this.a;
        yield this.b;
        yield this.c;
    }
}

export function getPoint(geometry: THREE.BufferGeometry, index: number): THREE.Vector3 {
    const positionAttribute = geometry.getAttribute('position');
    if (!positionAttribute) {
        throw new Error('Geometry does not have a position attribute');
    }
    const x = positionAttribute.getX(index);
    const y = positionAttribute.getY(index);
    const z = positionAttribute.getZ(index);
    return new THREE.Vector3(x, y, z);
}

export function* walkPoints(geometry: THREE.BufferGeometry): Generator<THREE.Vector3> {
    const positionAttribute = geometry.getAttribute('position');
    const count = positionAttribute.count;

    for (let i = 0; i < count; i++) {
        const x = positionAttribute.getX(i);
        const y = positionAttribute.getY(i);
        const z = positionAttribute.getZ(i);
        yield new THREE.Vector3(x, y, z);
    }
}

export function* walkEdges(geometry: THREE.BufferGeometry, mode: "mesh" | "line"): Generator<[THREE.Vector3, THREE.Vector3]> {
    const indexAttribute = geometry.getIndex();
    if (!indexAttribute) {
        throw new Error('Geometry does not have an index attribute');
    }

    const idx = indexAttribute.array;

    if (mode === "line") {
        for (let i = 0; i < idx.length; i += 2) {
            const p1 = getPoint(geometry, idx[i]);
            const p2 = getPoint(geometry, idx[i + 1]);
            yield [p1, p2];
        }
        return;
    }

    // For mesh mode, we need to create edges from the triangles
    const edgeSet = new Set<string>();
    for (let i = 0; i < idx.length; i += 3) {
        const [a, b, c] = [idx[i], idx[i + 1], idx[i + 2]];
        [[a, b], [b, c], [c, a]].forEach(([x, y]) => {
            const edge = x < y ? `${x}-${y}` : `${y}-${x}`;
            edgeSet.add(edge);
        })
    }

    for (const edge of edgeSet) {
        const [x, y] = edge.split('-').map(Number);
        const pointA = getPoint(geometry, x);
        const pointB = getPoint(geometry, y);
        yield [pointA, pointB];
    }
}

export function* walkFaces(geometry: THREE.BufferGeometry): Generator<Face> {
    const indexAttribute = geometry.getIndex();
    if (!indexAttribute) {
        throw new Error('Geometry does not have an index attribute');
    }

    const idx = indexAttribute.array;
    for (let i = 0; i < idx.length; i += 3) {
        const p1 = getPoint(geometry, idx[i]);
        const p2 = getPoint(geometry, idx[i + 1]);
        const p3 = getPoint(geometry, idx[i + 2]);
        yield new Face(p1, p2, p3);
    }
}

export function mapPoints(geometry: THREE.BufferGeometry, fn: (point: THREE.Vector3) => THREE.Vector3): THREE.BufferGeometry {
    const newGeometry = geometry.clone()
    const posAttr = newGeometry.getAttribute('position');

    for (const [i, point] of enumerate(walkPoints(geometry))) {
        const newPoint = fn(point);
        posAttr.setXYZ(i, newPoint.x, newPoint.y, newPoint.z);
    }

    return newGeometry;
}

export function mapPointInPlace(geometry: THREE.BufferGeometry, fn: (point: THREE.Vector3) => THREE.Vector3): THREE.BufferGeometry {
    const posAttr = geometry.getAttribute('position');

    for (const [i, point] of enumerate(walkPoints(geometry))) {
        const newPoint = fn(point);
        posAttr.setXYZ(i, newPoint.x, newPoint.y, newPoint.z);
    }

    return geometry;
}

export function* enumerate<T>(it: Iterable<T>, start: number = 0): Generator<[number, T]> {
    let i = start;
    for (const item of it) {
        yield [i++, item];
    }
}

export function* zip<Arrays extends readonly Iterable<any>[]>(...args: [...Arrays]): Generator<ZipResult<Arrays>> {
    const iterators = args.map(arg => arg[Symbol.iterator]());

    while (true) {
        const result: any[] = [];
        for (let i = 0; i < iterators.length; i++) {
            const { value, done } = iterators[i].next();
            result.push(value);
            if (done) {
                return
            }
        }
        yield result as ZipResult<Arrays>;
    }
}

export function* repeat<T>(value: T, count: number = Infinity): Generator<T> {
    for (let i = 0; i < count; i++) {
        yield value;
    }
}

export function* cycle<T>(value: Iterable<T>): Generator<T> {while (true) {
        yield *value
    }
}

/**
 * Accepts an arbitrary input, if the input is iterable, it returns the iterable,
 * otherwise it returns a generator that yields the value.
 *
 * @param value
 */
export function* makeIterable<T>(value: T): Iterable<T> {
    // @ts-ignore
    if (typeof value === 'string' || typeof value[Symbol.iterator] === 'function') {
        yield* value as Iterable<T>;
    } else {
        yield value;
    }
}

export function* makeVariable<T>(value: Variable<T>, length: number): Generator<T> {
    if (Array.isArray(value)) {
        if (value.length !== length) {
            throw new Error(`Expected array of length ${length}, but got ${value.length}`);
        }
        yield* value;
    } else {
        for (let i = 0; i < length; i++) {
            yield value
        }
    }
}

export function randomColor() {
    return Math.floor(Math.random() * 16777215);
}

export function mulberry32(seed?: number) {
    let s = seed ?? (Math.random() * 2 ** 32) >>> 0
    return () => {
        let t = (s += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}