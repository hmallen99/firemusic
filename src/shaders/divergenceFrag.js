export const divergenceFrag =  `uniform sampler2D velocitySampler;

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

	if (texture2D(velocitySampler, uv).w > 0.0) {
		gl_FragColor = vec4(0.0);
		return;
	}

	vec3 invBlockRes = vec3(1.0, 1.0, 1.0) / blockRes;
	vec3 xyz = getXYZ(gl_FragCoord.xy);
	vec3 uvw = xyz * invBlockRes;

	float x0 = getTex3D(velocitySampler, uvw - vec3(invBlockRes.x, 0, 0)).x;
	float x1 = getTex3D(velocitySampler, uvw + vec3(invBlockRes.x, 0, 0)).x;
	float y0 = getTex3D(velocitySampler, uvw - vec3(0, invBlockRes.y, 0)).y;
	float y1 = getTex3D(velocitySampler, uvw + vec3(0, invBlockRes.y, 0)).y;
	float z0 = getTex3D(velocitySampler, uvw - vec3(0, 0, invBlockRes.z)).z;
	float z1 = getTex3D(velocitySampler, uvw + vec3(0, 0, invBlockRes.z)).z;

	float divergence = ((x1 - x0) + (y1 - y0) + (z1 - z0)) * 0.5;
	gl_FragColor = vec4(divergence);
}`;