uniform float uTime;
uniform vec3 uOrigin;

varying float vZDepth;

void main() {
    vec4 localPos = vec4(uOrigin + position, 1.);
    vec4 myPos = modelViewMatrix * localPos;
    vZDepth = -myPos.z;

    gl_Position = projectionMatrix * myPos;
}