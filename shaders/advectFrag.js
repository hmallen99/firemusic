export const advectFrag = `uniform float timestep;
uniform sampler2D temperatureSampler;
uniform vec3 velocityOffset;

uniform float b; // represents the buoyancy constant
uniform float inv_T_zero; // inverse of T_0, the ambient room temperature.
uniform vec3 blockRes;

const vec3 Force = vec3(0.0, 100.0, 0.0);
const vec3 ForceAreaMin = vec3(0.4, 0.0, 0.4);
const vec3 ForceAreaMax = vec3(0.6, 0.06, 0.6);
const vec3 ForceAreaCenter = vec3(0.5, 0.1, 0.5);
const float ForceRadiusSq = 0.01;

const vec3 BarrierPosition = vec3(1.5, 0.2, 1.5);
const float BarrierRadiusSq = 0.01;

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

vec3 buoyancyForce(vec3 pos) {
	float temperature = getTex3D(temperatureSampler, pos).x;
	if (temperature == 0.0) {
		return vec3(0.0);
	}
	return b * (inv_T_zero - (1.0 / temperature)) * vec3(0.0, 1.0, 0.0);
}

void main() {
	vec2 invRes = vec2(1.0, 1.0) / resolution.xy;
	vec2 uv = gl_FragCoord.xy * invRes;

	vec3 invBlockRes = vec3(1.0, 1.0, 1.0) / blockRes;
	vec3 xyz = getXYZ(gl_FragCoord.xy);
	vec3 uvw = xyz * invBlockRes;

	vec3 oldVelocity = texture2D(velocityOutputSampler, uv).xyz;
	vec3 uvwOld = uvw - oldVelocity * timestep * invBlockRes;
	vec3 outputVelocity = getTex3D(velocityOutputSampler, uvwOld).xyz;

	vec3 toCenter = ForceAreaCenter - uvw;

	if (dot(toCenter, toCenter) < ForceRadiusSq)
	{
		outputVelocity += (Force + velocityOffset) * timestep;
	}

	outputVelocity += buoyancyForce(uvw);

	if (uvw.x > 1.0 - invBlockRes.x || uvw.x < invBlockRes.x ||
			uvw.y > 1.0 - invBlockRes.y || uvw.y < invBlockRes.y ||
			uvw.z > 1.0 - invBlockRes.z || uvw.z < invBlockRes.z
	)
	{
		outputVelocity = vec3(0.0, 0.0, 0.0);
	}

	vec3 toBarrier = BarrierPosition - uvw;
	//toBarrier.x *= invRes.y / invRes.x;

	if (dot(toBarrier, toBarrier) < BarrierRadiusSq) {
		gl_FragColor = vec4(0.0, 0.0, 0.0, 999.0);
	}
	else {
		gl_FragColor = vec4(outputVelocity, 0.0);
	}
}`;