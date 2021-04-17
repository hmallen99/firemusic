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
    volconfig,
    cmtextures,
    object,
    container,
    fireMesh,
    textureShader,
    textureMapVariable,
    outputRenderTarget,
    velocityMap0,
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
    const sun = new THREE.DirectionalLight(0xFFFFFF, 1.0);
    sun.position.set(300, 400, 175);
    scene.add(sun)

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    window.addEventListener( 'resize', onWindowResize );

    init_fire();
}

function init_fire() {
    const geometry = new THREE.PlaneGeometry(WIDTH, WIDTH, WIDTH, WIDTH);
    const material = new THREE.ShaderMaterial({
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
    const texture0 = gpuCompute.createTexture();

    
    
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

    
    velocityMap0 = gpuCompute.createTexture();
    const pixels = velocityMap0.image.data;
    var p = 0;
    for (var i = 0; i < WIDTH; i++) {
        for (var j = 0; j < WIDTH; j++) {
            pixels[p] = i / WIDTH;
            pixels[p + 1] = j / WIDTH;
            pixels[p + 2] = 0.0;
            pixels[p + 3] = 1.0;
            p += 4;
        }
    }

    textureShader = gpuCompute.createShaderMaterial(document.getElementById('textureShader').textContent, {
        textureSampler: {value: null},
    });
    outputRenderTarget = gpuCompute.createRenderTarget();
    
    textureShader.uniforms.textureSampler.value = velocityMap0;
    
    material.uniforms.map.value = outputRenderTarget.texture;

    gpuCompute.doRenderTarget(textureShader, outputRenderTarget);

    

}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate() {
    requestAnimationFrame(animate);

    render();
}

function render () {
    

    gpuCompute.compute();
    renderer.render(scene, camera);
}

