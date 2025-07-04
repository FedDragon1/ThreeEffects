uniform float uTime;
uniform vec3 uOrigin;
uniform float uZMin;
uniform float uZMax;

varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vIncoming;
varying float vZDepth;

void main() {
    vPosition = uOrigin + position;
    vUv = uv;

    vec4 localPos = vec4(vPosition, 1.);
    vec4 mvPos = modelViewMatrix * localPos;
    vNormal = normalize(normalMatrix * normal);
    vIncoming = normalize(-mvPos.xyz);
    vZDepth = -mvPos.z;

    gl_Position = projectionMatrix * modelViewMatrix * localPos;
}