uniform float uTime;
uniform vec3 uOrigin;

varying vec2 vUv;
varying vec3 vPosition;
varying float vZDepth;

void main() {
    vUv = uv;
    vPosition = uOrigin + position;
    vec4 localPos = vec4(vPosition, 1.);
    vec4 myPos = modelViewMatrix * localPos;
    vZDepth = -myPos.z;

    gl_Position = projectionMatrix * myPos;
}