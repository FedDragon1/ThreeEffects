uniform float u_gridDensity;     // 网点密度控制

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    if (u_gridDensity == 0.) {
        outputColor = vec4(0.0);
        return;
    }

    // 网格参数计算
    vec2 gridUV = uv * u_gridDensity;
    vec2 cell = floor(gridUV);
    vec2 centerUV = (cell + 0.5) / u_gridDensity;

    // 获取中心点颜色
    vec4 centerColor = texture2D(inputBuffer, centerUV);

    // 计算感知亮度
    float brightness = pow(dot(centerColor.rgb, vec3(0.299, 0.587, 0.114)), 1.5);

    // 计算动态半径（亮度越高、透明度越低半径越小）
    float radius = 0.5 * (1.0 - brightness) * centerColor.a;

    // 当前像素在网格内的相对位置
    vec2 localPos = fract(gridUV) - 0.5;
    float dist = length(localPos);

    // 抗锯齿处理
    float alpha = dist > radius ? 0. : 1.;

    outputColor = vec4(vec3(centerColor) * alpha, alpha);
}