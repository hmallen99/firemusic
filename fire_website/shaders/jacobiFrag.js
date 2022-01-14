export const jacobiFrag = `uniform sampler2D velocitySampler;
uniform sampler2D divergenceSampler;

uniform vec3 blockRes;

vec4 getTex3D(sampler2D map, vec3 uvw) {
	vec3 xyz = uvw * blockRes;
	vec2 invRes = vec2(1.0, 1.0) / resolution.xy;
	float z_part = xyz.z - mod(xyz.z, 1.0);
	vec2 uv1 = vec2(xyz.x + z_part * blockRes.x , xyz.y) * invRes;
	vec4 color1 = texture2D(map, uv1);

	vec2 uv2 = vec2(xyz.x + (z_part + 1.0) * blockRes.x, xyz.y) * invRes;
	vec4 color2 = texture2D(map, uv2);

	float t = xyz.z - floor(xyz.z);
	return (1.0 - t) * color1 + t * color2;
}

vec3 getXYZ(vec2 xy) {
	float x_coord = xy.x - floor(xy.x / blockRes.x) * blockRes.x;
	return vec3(x_coord, xy.y, floor(xy.x / blockRes.x));
}


float samplePressure(vec3 pos, vec2 uv) {
	vec3 border = 2.0 * vec3(1.0, 1.0, 1.0) / blockRes;

	if (texture2D(velocitySampler, uv).z > 0.0) {
		return 0.0;
	}

	if (pos.x > 1.0 - border.x || pos.y > 1.0 - border.y || pos.z > 1.0 - border.z ||
			pos.x < border.x || pos.y < border.y || pos.z < border.z)
	{
		return 0.0;
	}
	else {
		return getTex3D(pressureSampler, pos).x;
	}
}

void main() {
	vec2 invRes = vec2(1.0, 1.0) / resolution.xy;
	vec2 uv = gl_FragCoord.xy * invRes;

	vec3 invBlockRes = vec3(1.0, 1.0, 1.0) / blockRes;
	vec3 xyz = getXYZ(gl_FragCoord.xy);
	vec3 uvw = xyz * invBlockRes;

	float div = getTex3D(divergenceSampler, uvw).x;
	float x0 = samplePressure(uvw - vec3(invBlockRes.x, 0, 0), uv);
	float x1 = samplePressure(uvw + vec3(invBlockRes.x, 0, 0), uv);
	float y0 = samplePressure(uvw - vec3(0, invBlockRes.y, 0), uv);
	float y1 = samplePressure(uvw + vec3(0, invBlockRes.y, 0), uv);
	float z0 = samplePressure(uvw - vec3(0, 0, invBlockRes.z), uv);
	float z1 = samplePressure(uvw + vec3(0, 0, invBlockRes.z), uv);

	float jacobiOutput = (x0 + x1 + y0 + y1 + z0 + z1 - div) / 6.0;
	gl_FragColor = vec4(jacobiOutput);
}`;