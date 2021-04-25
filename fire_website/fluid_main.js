import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.127/build/three.module.js';

import { GUI } from 'https://cdn.jsdelivr.net/npm/three@0.127/examples/jsm/libs/dat.gui.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.127/examples/jsm/controls/OrbitControls.js';
import { NRRDLoader } from 'https://cdn.jsdelivr.net/npm/three@0.127/examples/jsm/loaders/NRRDLoader.js';
import { VolumeRenderShader1 } from 'https://cdn.jsdelivr.net/npm/three@0.127/examples/jsm/shaders/VolumeShader.js';
import { WEBGL } from 'https://cdn.jsdelivr.net/npm/three@0.127/examples/jsm/WebGL.js';
import { GPUComputationRenderer } from 'https://cdn.jsdelivr.net/npm/three@0.127/examples/jsm/misc/GPUComputationRenderer.js';
import { ImprovedNoise } from 'https://cdn.jsdelivr.net/npm/three@0.127/examples/jsm/math/ImprovedNoise.js';

if ( WEBGL.isWebGL2Available() === false ) {

    document.body.appendChild( WEBGL.getWebGL2ErrorMessage() );

}

const WIDTH = 512;

let renderer,
    scene,
    camera,
    material,
    alternateMaterial,
    container,
    fireMesh,
    alternateFireMesh,
    boxMesh,
    advectVariable,
    advectUniforms,
    divergenceVariable,
    divergenceUniforms,
    jacobiVariable,
    jacobiUniforms,
    temperatureUniforms,
    temperatureVariable,
    outputVariable,
    outputUniforms,
    gpuCompute;

init();
animate();

function init() {


    container = document.createElement( 'div' );
    document.body.appendChild(container);

    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 2);
    //camera.lookAt(0, 0, 0);

    

    scene = new THREE.Scene();

    // Probably don't need this

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    new OrbitControls(camera, renderer.domElement);

    window.addEventListener( 'resize', onWindowResize );

    init_fire();
    //init_box();
}

function fillTexture3D(texture, value) {
    // create a 2d texture that encodes 3d data, e.g. the texture below is a 3 x 2 x 6 cube
    /*
    1 1 1 2 2 2
    1 1 1 2 2 2
    3 3 3 4 4 4
    3 3 3 4 4 4
    5 5 5 6 6 6
    5 5 5 6 6 6
    */
    // Texture size: 512 x 512 = 8 x 8 x 64 x 64 = 64 x 64 x 64
    // sample 2d texture like it is 3d 
    //const velocityMap0 = gpuCompute.createTexture();
    //const pressureMap0 = gpuCompute.createTexture();
    //const divergenceMap0 = gpuCompute.createTexture();
    const pixels = texture.image.data;

    var p = 0;
    for (var j = 0; j < 8; j++) {
        for (var i = 0; i < 8; i++) {
            for (var y = 0; y < 64; y++) {
                for (var x = 0; x < 64; x++) {
                    p = (j * 64 + y) * 512 + (i * 64 + x);
                    p *= 4;
                    pixels[p] = (8 - i) / 8;
                    pixels[p + 1] = (8 - j) / 8;
                    pixels[p + 2] = 0.0;
                    pixels[p + 3] = 1.0;
                    //p += 4;
                }
            }
        }
    }
}

function fillTexture(texture, texValue) {
    const pixels = texture.image.data;
    var p = 0;
    for (var i = 0; i < WIDTH; i++) {
        for (var j = 0; j < WIDTH; j++) {
            pixels[p] = texValue;
            pixels[p + 1] = texValue;
            pixels[p + 2] = texValue;
            pixels[p + 3] = texValue;
            p += 4;
        }
    }
}

function perlinTexture() {
    const size = 128;
    const data = new Uint8Array( size * size * size );

    let i = 0;
    const perlin = new ImprovedNoise();
    const vector = new THREE.Vector3();

    for ( let z = 0; z < size; z ++ ) {

        for ( let y = 0; y < size; y ++ ) {

            for ( let x = 0; x < size; x ++ ) {

                vector.set( x, y, z ).divideScalar( size );

                const d = perlin.noise( vector.x * 6.5, vector.y * 6.5, vector.z * 6.5 );

                data[ i ++ ] = d * 128 + 128;

            }

        }

    }

    const texture = new THREE.DataTexture3D( data, size, size, size );
    texture.format = THREE.RedFormat;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.unpackAlignment = 1;
    return texture;
}

function init_box() {
    const texture = perlinTexture();

    const boxGeometry = new THREE.BoxGeometry(2, 2, 2);

    const boxMaterial = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: {
            map: {value: texture},
            cameraPos: {value: new THREE.Vector3()},
            threshold: {value: 0.6},
            steps: {value: 200}
        },
        vertexShader: document.getElementById('boxVertexShader').textContent,
        fragmentShader: document.getElementById('boxFragmentShader').textContent
    });

    boxMesh = new THREE.Mesh(boxGeometry, boxMaterial)
    scene.add(boxMesh);
}

function init_fire() {
    const geometry = new THREE.PlaneGeometry(WIDTH, WIDTH);
    material = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge( [
            THREE.ShaderLib['phong'].uniforms, 
            {
                textureMap: {value: null},
            }
        ]),
        vertexShader: THREE.ShaderLib["phong"].vertexShader,
        fragmentShader: document.getElementById('fragmentShader').textContent
    });

    alternateMaterial = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge( [
            THREE.ShaderLib['phong'].uniforms, 
            {
                textureMap: {value: null},
            }
        ]),
        vertexShader: THREE.ShaderLib["phong"].vertexShader,
        fragmentShader: document.getElementById('fragmentShader').textContent
    });

    fireMesh = new THREE.Mesh(geometry, material);
    alternateFireMesh = new THREE.Mesh(geometry, alternateMaterial);
    scene.add(fireMesh);
    scene.add(alternateFireMesh);

    gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, renderer);
    

    var divergenceMap = gpuCompute.createTexture();
    var pressureMap = gpuCompute.createTexture();
    var velocityMap = gpuCompute.createTexture();
    var outputMap = gpuCompute.createTexture();
    var temperatureMap = gpuCompute.createTexture();

    fillTexture(divergenceMap, 0.0);
    fillTexture(pressureMap, 0.0);
    fillTexture(velocityMap, 0.0);
    fillTexture(outputMap, 0.0);
    fillTexture(temperatureMap, 60.0);
    

    temperatureVariable = gpuCompute.addVariable("temperatureSampler", document.getElementById("temperatureShader").textContent, temperatureMap);
    temperatureUniforms = temperatureVariable.material.uniforms;
    temperatureUniforms["timestep"] = {value: 0.03};
    temperatureVariable.minFilter = THREE.LinearFilter;
    temperatureVariable.magFilter = THREE.LinearFilter;
    gpuCompute.addResolutionDefine(temperatureVariable.material);

    advectVariable = gpuCompute.addVariable("velocitySampler", document.getElementById("advectShader").textContent, velocityMap);
    advectUniforms = advectVariable.material.uniforms;
    advectUniforms["timestep"] = {value: 0.03};
    advectUniforms["b"] = {value: 0.5};
    advectUniforms["inv_T_zero"] = {value: 1.0 / 60.0};
    advectUniforms["temperatureSampler"] = {value: null};
    gpuCompute.addResolutionDefine(advectVariable.material);
    advectVariable.minFilter = THREE.LinearFilter;
    advectVariable.magFilter = THREE.LinearFilter;


    divergenceVariable = gpuCompute.addVariable("divergenceSampler", document.getElementById("divergenceShader").textContent, divergenceMap);
    gpuCompute.setVariableDependencies(divergenceVariable, [divergenceVariable]);
    divergenceUniforms = divergenceVariable.material.uniforms;
    divergenceUniforms["velocitySampler"] = {value: null};
    gpuCompute.addResolutionDefine(divergenceVariable.material);
    divergenceVariable.minFilter = THREE.LinearFilter;
    divergenceVariable.magFilter = THREE.LinearFilter;

    jacobiVariable = gpuCompute.addVariable("pressureSampler", document.getElementById("jacobiShader").textContent, pressureMap);
    gpuCompute.setVariableDependencies(jacobiVariable, [jacobiVariable]);
    jacobiUniforms = jacobiVariable.material.uniforms;
    jacobiUniforms["velocitySampler"] = {value: null};
    jacobiUniforms["divergenceSampler"] = {value: null};
    gpuCompute.addResolutionDefine(jacobiVariable.material);
    jacobiVariable.minFilter = THREE.LinearFilter;
    jacobiVariable.magFilter = THREE.LinearFilter;

    outputVariable = gpuCompute.addVariable("velocityOutputSampler", document.getElementById("outputShader").textContent, outputMap);
    gpuCompute.setVariableDependencies(outputVariable, [outputVariable]);
    outputUniforms = outputVariable.material.uniforms;
    outputUniforms["velocitySampler"] = {value: null};
    outputUniforms["pressureSampler"] = {value: null};
    gpuCompute.addResolutionDefine(outputVariable.material);
    outputVariable.minFilter = THREE.LinearFilter;
    outputVariable.magFilter = THREE.LinearFilter;


    gpuCompute.setVariableDependencies(temperatureVariable, [temperatureVariable, outputVariable]);
    gpuCompute.setVariableDependencies(advectVariable, [advectVariable, outputVariable]);


    const error = gpuCompute.init();
    if (error != null) {
        console.log(error);
    }
}



function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate() {
    requestAnimationFrame(animate);
    update();
    render();
}

function update() {
    advectUniforms["temperatureSampler"].value = gpuCompute.getAlternateRenderTarget(temperatureVariable).texture;
  
    divergenceUniforms["velocitySampler"].value = gpuCompute.getAlternateRenderTarget(advectVariable).texture;

    jacobiUniforms["velocitySampler"].value = gpuCompute.getAlternateRenderTarget(advectVariable).texture;
    jacobiUniforms["divergenceSampler"].value = gpuCompute.getAlternateRenderTarget(divergenceVariable).texture;

    outputUniforms["velocitySampler"].value = gpuCompute.getAlternateRenderTarget(advectVariable).texture;
    outputUniforms["pressureSampler"].value = gpuCompute.getAlternateRenderTarget(jacobiVariable).texture;

    
    gpuCompute.compute();
    material.uniforms.textureMap.value = gpuCompute.getCurrentRenderTarget(advectVariable).texture;
    alternateMaterial.uniforms.textureMap.value = gpuCompute.getAlternateRenderTarget(advectVariable).texture;
}


function render () {
    
    //boxMesh.material.uniforms.cameraPos.value.copy(camera.position);
    renderer.render(scene, camera);
}

