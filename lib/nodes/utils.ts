import * as THREE from 'three';
import { Face } from "@/lib/nodes/structure";
import { Curve } from "@/lib/nodes/curves";

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

export function* cycle<T>(value: Iterable<T>): Generator<T> {
    while (true) {
        yield *value
    }
}

export function* chain<E>(...values: Iterable<E>[]): Generator<E> {
    for (const value of values) {
        yield *value;
    }
}

export function* makeSpan<T>(value: Span<T>, length: number): Generator<T> {
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

export function makeSpanEager<T>(value: Span<T>, length: number): T[] {
    return Array.from(makeSpan(value, length));
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

export function roundProbabilistic(rng: () => number, value: number): number {
    const floor = Math.floor(value)
    const ceil = Math.ceil(value)
    if (floor === ceil) {
        return floor
    }
    const ceilProb = value - floor
    return rng() > ceilProb ? ceil : floor
}

export function randomBarycentricCoordinates(rng: () => number): THREE.Vector3 {
    let u = rng()
    let v = rng()
    if (u + v > 1) {
        u = 1 - u
        v = 1 - v
    }
    return new THREE.Vector3(u, v, 1 - u - v)
}

export function drawGeometry(geometry: THREE.BufferGeometry, scene: THREE.Scene) {
    for (const [p1, p2, p3] of walkFaces(geometry)) {
        // construct a mesh for points p1 p2 p3
        const geometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            p1.x, p1.y, p1.z,
            p2.x, p2.y, p2.z,
            p3.x, p3.y, p3.z,
        ]);
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        const [h, s, l] = randomColorHsl()
        const color = hslToHex(h, s, l * 0.1)
        const material = new THREE.MeshBasicMaterial({ color });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh)
    }
}

export function drawPoints(points: THREE.Vector3[], scene: THREE.Scene, radius: number = 0.01) {
    for (const point of points) {
        const geometry = new THREE.SphereGeometry(radius, 32, 32);
        const material = new THREE.MeshBasicMaterial({ color: randomColor() });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(point.x, point.y, point.z);
        scene.add(mesh);
    }
}

export function drawCurves(curves: Curve[], scene: THREE.Scene) {
    drawLines(curves.map((curve) => curve.toGeometry()), scene)
}

export function drawLines(lines: THREE.BufferGeometry[], scene: THREE.Scene) {
    for (const geometry of lines) {
        const material = new THREE.LineBasicMaterial({ color: randomColor() });
        const line = new THREE.Line(geometry, material);
        scene.add(line);
    }
}

export function randomColorHsl(): [number, number, number] {
    const h = Math.floor(Math.random() * 360);
    const s = Math.floor(Math.random() * 100);
    const l = Math.floor(Math.random() * 100);
    return [h, s, l];
}

export function hslToHex(h: number, s: number, l: number) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');   // convert to Hex and prefix "0" if needed
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

export function createDistributorFor<T extends ImplRegistry>(registry: T): ImplDispatcher<T> {
    return (method, ...args) => {
        const fn = registry[method] as FunctionFor<typeof registry, typeof method>
        return fn(...args) as ResultFor<typeof registry, typeof method>;
    }
}

// PROXY FOR ATTRIBUTES

const proxyRegistry = new WeakMap<object, Map<string, any>>()
const attributeTarget = Symbol("[[AttributeTarget]]")

export function withAttribute<T extends object, V extends Record<string, any>>(object: T, attrs: V): Attributed<T, V> {
    const existingMeta = proxyRegistry.get(object)
    const target = existingMeta ? (object as any)[attributeTarget] : object
    const attributes = new Map<string, any>(existingMeta?.entries())
    for (const [key, value] of Object.entries(attrs)) {
        if (attributes.has(key)) {
            throw new Error(`Attribute ${key} already exists on the target object`);
        }
        attributes.set(key, value);
    }

    const proxy = new Proxy(target, {
        get(t, prop, receiver) {
            if (typeof prop === "string" && attributes.has(prop)) {
                return attributes.get(prop);
            }
            return Reflect.get(t, prop, receiver);
        },
        set(t, prop, newValue, receiver) {
            if (typeof prop === "string" && attributes.has(prop)) {
                attributes.set(prop, newValue);
                return true;
            }
            return Reflect.set(t, prop, newValue, receiver);
        }
    })

    proxyRegistry.set(proxy, attributes)
    Object.defineProperty(proxy, attributeTarget, {
        value: target,
        enumerable: false,
        configurable: false
    })

    return proxy
}

export function add(x: THREE.Vector3, y: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(x.x + y.x, x.y + y.y, x.z + y.z);
}

export function sub(x: THREE.Vector3, y: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(x.x - y.x, x.y - y.y, x.z - y.z);
}

export function mul(x: THREE.Vector3, y: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(x.x * y.x, x.y * y.y, x.z * y.z);
}

export function div(x: THREE.Vector3, y: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(x.x / y.x, x.y / y.y, x.z / y.z);
}

export function mulScalar(x: THREE.Vector3, scalar: number): THREE.Vector3 {
    return new THREE.Vector3(x.x * scalar, x.y * scalar, x.z * scalar);
}