precision highp float;

uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
uniform vec3 colorD;
uniform vec4 colorPosition;
uniform float lowCut;
uniform float highCut;

float smoothLerp(float edge0, float edge1, float x) {
    float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
}

vec3 interpolateColors(vec3 colorX, vec3 colorY, float x, float y, float target) {
    float alpha = clamp((target - x) / (y - x), 0.0, 1.0);
    alpha = smoothLerp(x, y, target);
    return colorX * (1. - alpha) + colorY * alpha;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    float darkness = 1. - (inputColor.r + inputColor.g + inputColor.b) / 3.;
    vec4 black = vec4(0., 0., 0., 1.);

    if (darkness < lowCut || darkness > highCut) {
        outputColor = black;
        return;
    }

    vec3 blended;
    if (darkness < colorPosition.x) {
        blended = interpolateColors(black.xyz, colorA, lowCut, colorPosition.x, darkness);
    } else if (darkness < colorPosition.y) {
        blended = interpolateColors(colorA, colorB, colorPosition.x, colorPosition.y, darkness);
    } else if (darkness < colorPosition.z) {
        blended = interpolateColors(colorB, colorC, colorPosition.y, colorPosition.z, darkness);
    } else if (darkness < colorPosition.w) {
        blended = interpolateColors(colorC, colorD, colorPosition.z, colorPosition.w, darkness);
    } else {
        blended = interpolateColors(colorD, black.rgb, colorPosition.w, highCut, darkness);
    }

    outputColor = vec4(blended, 1);
}
