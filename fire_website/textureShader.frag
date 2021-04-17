uniform sampler2D textureSampler;

void main() {
    vec2 cellSize = 1.0 / resolution.xy;

    vec2 uv = gl_FragCoord.xy * cellSize;

    vec4 textureValue = texture2D(textureSampler, uv);
    gl_FragColor = textureValue;
}