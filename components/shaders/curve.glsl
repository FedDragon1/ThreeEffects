precision highp float;

uniform vec3 controls;

highp float lagrangePoly(float x) {
    float l1 = (x / 0.25) * (x - 0.5) / (-0.25) * (x - 0.75) / (-0.5) * (x - 1.) / (-0.75);
    float l2 = (x / 0.5) * (x - 0.25) / (0.25) * (x - 0.75) / (-0.25) * (x - 1.) / (-0.5);
    float l3 = (x / 0.75) * (x - 0.25) / (0.5) * (x - 0.5) / (0.25) * (x - 1.) / (-0.25);
    float l4 = (x) * (x - 0.25) / (0.75) * (x - 0.5) / (0.5) * (x - 0.75) / (0.25);

    float res = l1 * controls.x + l2 * controls.y + l3 * controls.z + l4;

    return clamp(res, 0., 1.);
}

vec3 lagrange(vec3 tar) {
    return vec3(lagrangePoly(tar.x), lagrangePoly(tar.y), lagrangePoly(tar.z));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 interp = lagrange(inputColor.rgb);
    outputColor = vec4(interp, inputColor.a);
}
