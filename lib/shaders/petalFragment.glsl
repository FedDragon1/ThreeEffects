uniform sampler2D map;
uniform vec3 color;

varying vec3 vNormal;
varying vec2 vUv;

void main() {
    vec4 texColor = texture2D(map, vUv);

    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    vec3 N = normalize(vNormal);
    vec3 L = lightDir;
    float NdotL = max(dot(N, L), 0.0);

    vec3 finalColor = texColor.rgb * color * NdotL;

    gl_FragColor = vec4(finalColor, 1.0);
}
