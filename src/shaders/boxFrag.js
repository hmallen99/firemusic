export const boxFrag = `precision highp float;
precision highp sampler2D;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

in vec3 vOrigin;
in vec3 vDirection;

out vec4 color;

uniform sampler2D map;
uniform sampler2D reactionSampler;
uniform float threshold;
uniform float steps;
uniform vec3 colorMod;

vec2 hitBox( vec3 orig, vec3 dir ) {
		const vec3 box_min = vec3( - 0.5 );
		const vec3 box_max = vec3( 0.5 );
		vec3 inv_dir = 1.0 / dir;
		vec3 tmin_tmp = ( box_min - orig ) * inv_dir;
		vec3 tmax_tmp = ( box_max - orig ) * inv_dir;
		vec3 tmin = min( tmin_tmp, tmax_tmp );
		vec3 tmax = max( tmin_tmp, tmax_tmp );
		float t0 = max( tmin.x, max( tmin.y, tmin.z ) );
		float t1 = min( tmax.x, min( tmax.y, tmax.z ) );
		return vec2( t0, t1 );
}

vec4 getTex3D(sampler2D map, vec3 uvw) {
		vec3 blockRes = vec3(64.0, 64.0, 64.0);
		vec3 xyz = uvw * blockRes;
		vec2 invRes = vec2(1.0, 1.0) / vec2(4096.0, 64.0);
		float z_part = xyz.z - mod(xyz.z, 1.0);
		vec2 uv1 = vec2(xyz.x + z_part * blockRes.x , xyz.y) * invRes;
		vec4 color1 = texture(map, uv1);

		vec2 uv2 = vec2(xyz.x + (z_part + 1.0) * blockRes.x, xyz.y) * invRes;
		vec4 color2 = texture(map, uv2);

		float t = xyz.z - floor(xyz.z);
		return (1.0 - t) * color1 + t * color2;
}

vec4 sample4(vec3 p) {
		vec4 texColor = getTex3D( map, p );
		if (texColor.w > 0.0) {
				return vec4(0, 0, 0, 999.9);
		}
		return vec4(texColor.rgb * 0.002, 0.0);
}

float sampleReaction(vec3 p) {
		vec4 texColor = getTex3D( reactionSampler, p );
		return texColor.r;
}

void main(){
	vec3 rayDir = normalize( vDirection );
	vec2 bounds = hitBox( vOrigin, rayDir );
	if ( bounds.x > bounds.y ) discard;
	bounds.x = max( bounds.x, 0.0 );
	vec3 p = vOrigin + bounds.x * rayDir;
	vec3 inc = 1.0 / abs( rayDir );
	float delta = min( inc.x, min( inc.y, inc.z ) );
	delta /= steps;
	float count = 0.0;
	for ( float t = bounds.x; t < bounds.y; t += delta ) {
		vec3 hitPoint = p + 0.5;
		vec4 d = sample4(hitPoint);
		count += 1.0;
		float reaction = sampleReaction(hitPoint);
		if (d.w > 0.0) {
			color.rgb = max(color.rgb, vec3(0.4));
			color.a = 1.0;
			break;
		}
		float colorIntensity = length(d.rgb) * reaction;
		if (colorIntensity <= 0.0 && length(d.rgb) > 0.001) {
			color.rgb += vec3(length(d.rgb)) * hitPoint.y;
			color.a += length(d.rgb) * hitPoint.y;
		} else {
			color.rgb += colorIntensity * colorMod;
			color.a += reaction * 2.0;
		}

		if ( length(color.rgb) >  3.0) {
			break;
		}
		p += rayDir * delta;
	}
	color.a /= count;
	if ( color.a == 0.0 ) discard;
}`;