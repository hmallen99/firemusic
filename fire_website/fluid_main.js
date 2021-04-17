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
    volconfig,
    cmtextures,
    object,
    container,
    fireMesh,
    alternateFireMesh,
    textureShader,
    outputRenderTarget,
    alternateRenderTarget,
    velocityMap0,
    texture0,
    advectVariable,
    advectUniforms,
    gpuCompute;

init();
animate();

function init() {

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

function init_fire() {
    const geometry = new THREE.PlaneGeometry(WIDTH, WIDTH, WIDTH, WIDTH);
    material = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge( [
            THREE.ShaderLib['phong'].uniforms, 
            {
                map: {value: null},
            }
        ]),
        vertexShader: document.getElementById('vertexShader').textContent,
        fragmentShader: document.getElementById('fragmentShader').textContent
    });

    alternateMaterial = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge( [
            THREE.ShaderLib['phong'].uniforms, 
            {
                map: {value: null},
            }
        ]),
        vertexShader: document.getElementById('vertexShader').textContent,
        fragmentShader: document.getElementById('fragmentShader').textContent
    });

    fireMesh = new THREE.Mesh(geometry, material);
    alternateFireMesh = new THREE.Mesh(geometry, alternateMaterial);
    scene.add(fireMesh);

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

    gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, renderer);
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

    
    var velocityMap = gpuCompute.createTexture();
    const pixels = velocityMap.image.data;
    var p = 0;
    for (var i = 0; i < WIDTH; i++) {
        for (var j = 0; j < WIDTH; j++) {
            pixels[p] = 0.0;
            pixels[p + 1] = 0.0;
            pixels[p + 2] = 0.0;
            pixels[p + 3] = 1.0;
            p += 4;
        }
    }


    /*texture0 = gpuCompute.createTexture();
    const pixels2 = velocityMap0.image.data;
    p = 0;
    for (var i = 0; i < WIDTH; i++) {
        for (var j = 0; j < WIDTH; j++) {
            pixels2[p] = 0.0;
            pixels2[p + 1] = 0.0;
            pixels2[p + 2] = 0.0;
            pixels2[p + 3] = 1.0;
            p += 4;
        }
    }*/

    advectVariable = gpuCompute.addVariable("advectVariable", document.getElementById("advectShader").textContent, velocityMap);
    gpuCompute.setVariableDependencies(advectVariable, [advectVariable]);
    advectUniforms = advectVariable.material.uniforms;
    advectUniforms['timestep'] = {value: 0.01};
    advectUniforms['velocitySampler'] = {value: null};

    advectVariable.wrapS = THREE.RepeatWrapping;
    advectVariable.wrapT = THREE.RepeatWrapping;

    //gpuCompute.setVariableDependencies(advectVariable, [advectVariable]);

    const error = gpuCompute.init();
    if (error != null) {
        console.log(error);
    }

    /*textureShader = gpuCompute.createShaderMaterial(document.getElementById('advectShader').textContent, {
        textureSampler: {value: null},
        timestep: {value: 0.5},
    });*/
    
    //outputRenderTarget = gpuCompute.createRenderTarget();

    //textureShader.uniforms.textureSampler.value = texture0;
    //textureShader.uniforms.textureSampler.value = outputRenderTarget.texture;
    //gpuCompute.doRenderTarget(textureShader, outputRenderTarget);   
    //material.uniforms.map.value = gpuCompute.getCurrentRenderTarget(advectVariable).texture;
    //material.uniforms.map.value = outputRenderTarget.texture;
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
    let advectTexture = gpuCompute.getCurrentRenderTarget(advectVariable).texture;
    material.uniforms.map.value = advectTexture;

    let advectAltTexture = gpuCompute.getAlternateRenderTarget(advectVariable).texture;
    alternateMaterial.uniforms.map.value = advectAltTexture;

    //advectUniforms['timestep'].value = ((advectUniforms['timestep'].value * 100) % 100) / 100 + 0.01;
    advectUniforms['velocitySampler'].value = advectTexture;

    gpuCompute.compute();
}


function render () {
    
    renderer.render(scene, camera);
}

