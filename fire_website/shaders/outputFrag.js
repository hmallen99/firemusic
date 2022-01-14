export const outputFrag = `uniform sampler2D velocitySampler;
uniform sampler2D pressureSampler;

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

void main() {
	vec2 invRes = vec2(1.0, 1.0) / resolution.xy;
	vec2 uv = gl_FragCoord.xy * invRes;

	vec3 invBlockRes = vec3(1.0, 1.0, 1.0) / blockRes;
	vec3 xyz = getXYZ(gl_FragCoord.xy);
	vec3 uvw = xyz * invBlockRes;

	float x0 = getTex3D(pressureSampler, uvw - vec3(invBlockRes.x, 0, 0)).x;
	float x1 = getTex3D(pressureSampler, uvw + vec3(invBlockRes.x, 0, 0)).x;
	float y0 = getTex3D(pressureSampler, uvw - vec3(0, invBlockRes.y, 0)).x;
	float y1 = getTex3D(pressureSampler, uvw + vec3(0, invBlockRes.y, 0)).x;
	float z0 = getTex3D(pressureSampler, uvw - vec3(0, 0, invBlockRes.z)).x;
	float z1 = getTex3D(pressureSampler, uvw + vec3(0, 0, invBlockRes.z)).x;

	vec3 pressureGradient = (vec3(x1, y1, z1) - vec3(x0, y0, z0)) * 0.5;
	vec3 oldV = texture2D(velocitySampler, uv).xyz;


	gl_FragColor = vec4(oldV - pressureGradient, 1.0);
	//gl_FragColor = vec4(oldV, 1.0);
}`;