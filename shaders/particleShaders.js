export const particleVertexShader = `
uniform float pointMultiplier;

attribute float size;
attribute float angle;
attribute float blend;
attribute vec4 colour;

varying vec4 vColour;
varying vec2 vAngle;
varying float vBlend;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = size * pointMultiplier / gl_Position.w;

  vAngle = vec2(cos(angle), sin(angle));
  vColour = colour;
  vBlend = blend;
}`;

export const particleFragmentShader = `
uniform sampler2D diffuseTexture;
varying vec4 vColour;
varying vec2 vAngle;
varying float vBlend;

void main() {
	vec2 coords = (gl_PointCoord - 0.5) * mat2(vAngle.x, vAngle.y, -vAngle.y, vAngle.x) + 0.5;
	gl_FragColor = texture2D(diffuseTexture, coords) * vColour;
	gl_FragColor *= gl_FragColor.w;
	gl_FragColor.w *= vBlend;
}`;

export const emberFragmentShader =`
uniform sampler2D diffuseTexture;
varying vec4 vColour;
varying vec2 vAngle;
varying float vBlend;

void main() {
	vec2 coords = (gl_PointCoord - 0.5) * mat2(vAngle.x, vAngle.y, -vAngle.y, vAngle.x) + 0.5;
	gl_FragColor = texture2D(diffuseTexture, coords) * vColour;
}`;