uniform float uZMin;
uniform float uZMax;

varying float vZDepth;

void main() {
    if (vZDepth > uZMax) {
        discard;
    }

    float t = (vZDepth - uZMin) / (uZMax - uZMin);
    float opacity = clamp(t, 0.0, 1.0);
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1. - opacity);
}