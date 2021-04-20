import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';

import { GUI } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/libs/dat.gui.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/controls/OrbitControls.js';
import { NRRDLoader } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/loaders/NRRDLoader.js';
import { VolumeRenderShader1 } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/shaders/VolumeShader.js';
import { WEBGL } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/WebGL.js';
import { GPUComputationRenderer } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/misc/GPUComputationRenderer.js';

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
    advectVariable,
    advectUniforms,
    divergenceVariable,
    divergenceUniforms,
    jacobiVariable,
    jacobiUniforms,
    windowSize,
    outputShader,
    outputVariable,
    outputUniforms,
    gpuCompute;

init();
animate();

function init() {

    windowSize = new THREE.Vector2(window.innerWidth, window.innerHeight);

    container = document.createElement( 'div' );
    document.body.appendChild(container);

    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 3000);
    camera.position.set(0, 0, 1);
    camera.lookAt(0, 0, 0);

    scene = new THREE.Scene();

    // Probably don't need this

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    window.addEventListener( 'resize', onWindowResize );

    init_fire();
}

function create_3d_tex() {
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

    /*var p = 0;
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
    }*/
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

    fillTexture(divergenceMap);
    fillTexture(pressureMap);
    fillTexture(velocityMap);
    fillTexture(outputMap);
    

    advectVariable = gpuCompute.addVariable("velocitySampler", document.getElementById("advectShader").textContent, velocityMap);
    advectUniforms = advectVariable.material.uniforms;
    advectUniforms['timestep'] = {value: 0.03};
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


    gpuCompute.setVariableDependencies(advectVariable, [advectVariable, outputVariable]);


    const error = gpuCompute.init();
    if (error != null) {
        console.log(error);
    }
}

function fillTexture(texture) {
    const pixels = texture.image.data;
    var p = 0;
    for (var i = 0; i < WIDTH; i++) {
        for (var j = 0; j < WIDTH; j++) {
            pixels[p] = 0.0;
            pixels[p + 1] = 0.0;
            pixels[p + 2] = 0.0;
            pixels[p + 3] = 0.0;
            p += 4;
        }
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
    
    renderer.render(scene, camera);
}

