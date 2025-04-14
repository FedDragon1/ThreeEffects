precision highp float;

uniform float size;

float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    float r = rand(uv) * size;
    float t = rand(uv * 2. + 1.) * 2. * PI;

    float x = r * cos(t);
    float y = r * sin(t);
    vec2 uvp = uv + vec2(x, y);

    vec4 color = texture2D(inputBuffer, uvp);

    outputColor = color;
}
