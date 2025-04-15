uniform float alpha;

varying vec3 vNormal;
varying vec2 vUv;

void main() {
    vec3 pos = position;

    // pos.x -> [-0.5, 0.5], nx -> [-1, 1]
    float nx = pos.x / 0.5;
    // pos.y -> [0, 2], ny -> [0, 1]
    float ny = pos.y / 2.;

    float bend = -(smoothstep(0., 1., alpha) * 2. - 1.);
    float zBendY = bend * nx * nx * 0.4;
    float zBendX = bend * ny * ny * 1.;

    pos.z += zBendX + zBendY;

    vNormal = normalize(normalMatrix * normal);
    vUv = uv;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
