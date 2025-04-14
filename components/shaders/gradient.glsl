varying vec2 vUv;

void main() {
    float intensity = 1. - ((1. - vUv.x) + vUv.y) / 2.;
    gl_FragColor = vec4(intensity, intensity, intensity, 1.);
}
