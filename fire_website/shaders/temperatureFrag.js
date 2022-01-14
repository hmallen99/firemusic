export const temperatureFrag = `uniform float timestep;
uniform vec3 blockRes;

const vec3 HeatAreaMin = vec3(0.4, 0.0, 0.4);
const vec3 HeatAreaMax = vec3(0.6, 0.06, 0.6);
const vec3 HeatAreaCenter = vec3(0.5, 0.1, 0.5);
const float HeatRadiusSq = 0.01;

float HeatAreaTemp = 100.0;

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
	vec3 uvw = xyz / blockRes;

	vec3 oldVelocity = texture2D(velocityOutputSampler, uv).xyz;
	vec3 uvwOld = uvw - oldVelocity * timestep * invBlockRes;
	float temperature = getTex3D(temperatureSampler, uvwOld).x;

	vec3 toCenter = uvw.xyz - HeatAreaCenter;
	if (dot(toCenter, toCenter) < HeatRadiusSq)
	{
		temperature = HeatAreaTemp;
	}

	gl_FragColor = vec4(temperature);
}`;