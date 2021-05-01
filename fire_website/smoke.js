import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.127/build/three.module.js';

import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.127/examples/jsm/controls/OrbitControls.js';
import { WEBGL } from 'https://cdn.jsdelivr.net/npm/three@0.127/examples/jsm/WebGL.js';
import { GPUComputationRenderer } from 'https://cdn.jsdelivr.net/npm/three@0.127/examples/jsm/misc/GPUComputationRenderer.js';
import { ImprovedNoise } from 'https://cdn.jsdelivr.net/npm/three@0.127/examples/jsm/math/ImprovedNoise.js';

const WIDTH = 64;

class SmokeSystem {
    cosntructor(params) {
        this.scene = params.scene;
        this.camera = params.camera;
        this.renderer = params.renderer;
        
        this._init();
    }

    _init() {
        this._init_box();
        this._init_smoke_shader();
    }

    _fillTexture(texture, texValue) {
        // Fills a texture with texValue
        const pixels = texture.image.data;
        var p = 0;
        for (var i = 0; i < WIDTH; i++) {
            for (var j = 0; j < WIDTH * WIDTH; j++) {
                pixels[p] = texValue;
                pixels[p + 1] = texValue;
                pixels[p + 2] = texValue;
                pixels[p + 3] = texValue;
                p += 4;
            }
        }
    }

    _init_box() {
        // Initialize the smoke box
        const boxGeometry = new THREE.BoxGeometry(2, 2, 2);
    
        this.boxMaterial = new THREE.RawShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                map: {value: null},
                cameraPos: {value: new THREE.Vector3()},
                threshold: {value: 0.6},
                steps: {value: 200}
            },
            vertexShader: document.getElementById('boxVertexShader').textContent,
            fragmentShader: document.getElementById('boxFragmentShader').textContent
        });
    
        this.altBoxMaterial = new THREE.RawShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                map: {value: null},
                cameraPos: {value: new THREE.Vector3()},
                threshold: {value: 0.6},
                steps: {value: 200}
            },
            vertexShader: document.getElementById('boxVertexShader').textContent,
            fragmentShader: document.getElementById('boxFragmentShader').textContent
        });
    
        this.boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
        this.altBoxMesh = new THREE.Mesh(boxGeometry, altBoxMaterial);
        this.scene.add(boxMesh);
        this.scene.add(altBoxMesh);
    }

    _init_smoke_shader() {
        // Initialize the smoke GLSL shaders
        this.gpuCompute = new GPUComputationRenderer(WIDTH * WIDTH, WIDTH, this.renderer);
        
    
        var divergenceMap = this.gpuCompute.createTexture();
        var pressureMap = this.gpuCompute.createTexture();
        var velocityMap = this.gpuCompute.createTexture();
        var outputMap = this.gpuCompute.createTexture();
        var temperatureMap = this.gpuCompute.createTexture();
    
        this._fillTexture(divergenceMap, 0.0);
        this._fillTexture(pressureMap, 0.0);
        this._fillTexture(velocityMap, 0.0);
        this._fillTexture(outputMap, 0.0);
        this._fillTexture(temperatureMap, 60.0);
        
        var blockRes = new THREE.Vector3(WIDTH, WIDTH, WIDTH);
    
        // Initialize Temperature Advection Shader
        this.temperatureVariable = gpuCompute.addVariable("temperatureSampler", document.getElementById("temperatureShader").textContent, temperatureMap);
        this.temperatureUniforms = this.temperatureVariable.material.uniforms;
        this.temperatureUniforms["timestep"] = {value: 0.03};
        this.temperatureUniforms["blockRes"] = {value: blockRes};
        this.temperatureVariable.minFilter = THREE.LinearFilter;
        this.temperatureVariable.magFilter = THREE.LinearFilter;
        this.gpuCompute.addResolutionDefine(this.temperatureVariable.material);
    
        // Initialize Velocity Advection Shader
        this.advectVariable = this.gpuCompute.addVariable("velocitySampler", document.getElementById("advectShader").textContent, velocityMap);
        this.advectUniforms = this.advectVariable.material.uniforms;
        this.advectUniforms["timestep"] = {value: 0.03};
        this.advectUniforms["b"] = {value: 0.5};
        this.advectUniforms["inv_T_zero"] = {value: 1.0 / 60.0};
        this.advectUniforms["temperatureSampler"] = {value: null};
        this.advectUniforms["blockRes"] = {value: blockRes};
        this.gpuCompute.addResolutionDefine(this.advectVariable.material);
        this.advectVariable.minFilter = THREE.LinearFilter;
        this.advectVariable.magFilter = THREE.LinearFilter;
    
        // Initialize Divergence Shader
        this.divergenceVariable = this.gpuCompute.addVariable("divergenceSampler", document.getElementById("divergenceShader").textContent, divergenceMap);
        this.gpuCompute.setVariableDependencies(this.divergenceVariable, [this.divergenceVariable]);
        this.divergenceUniforms = this.divergenceVariable.material.uniforms;
        this.divergenceUniforms["velocitySampler"] = {value: null};
        this.divergenceUniforms["blockRes"] = {value: blockRes};
        this.gpuCompute.addResolutionDefine(this.divergenceVariable.material);
        this.divergenceVariable.minFilter = THREE.LinearFilter;
        this.divergenceVariable.magFilter = THREE.LinearFilter;
    
        // Initialize Jacobi Pressure Shader
        this.jacobiVariable = gpuCompute.addVariable("pressureSampler", document.getElementById("jacobiShader").textContent, pressureMap);
        this.gpuCompute.setVariableDependencies(this.jacobiVariable, [this.jacobiVariable]);
        this.jacobiUniforms = this.jacobiVariable.material.uniforms;
        this.jacobiUniforms["velocitySampler"] = {value: null};
        this.jacobiUniforms["divergenceSampler"] = {value: null};
        this.jacobiUniforms["blockRes"] = {value: blockRes};
        this.gpuCompute.addResolutionDefine(this.jacobiVariable.material);
        this.jacobiVariable.minFilter = THREE.LinearFilter;
        this.jacobiVariable.magFilter = THREE.LinearFilter;
    
        // Initialize Velocity Output Sampler. This is the input for the next shader iteration
        this.outputVariable = this.gpuCompute.addVariable("velocityOutputSampler", document.getElementById("outputShader").textContent, outputMap);
        this.gpuCompute.setVariableDependencies(this.outputVariable, [this.outputVariable]);
        this.outputUniforms = this.outputVariable.material.uniforms;
        this.outputUniforms["velocitySampler"] = {value: null};
        this.outputUniforms["pressureSampler"] = {value: null};
        this.outputUniforms["blockRes"] = {value: blockRes};
        this.gpuCompute.addResolutionDefine(this.outputVariable.material);
        this.outputVariable.minFilter = THREE.LinearFilter;
        this.outputVariable.magFilter = THREE.LinearFilter;
    
        this.gpuCompute.setVariableDependencies(this.temperatureVariable, [this.temperatureVariable, this.outputVariable]);
        this.gpuCompute.setVariableDependencies(this.advectVariable, [this.advectVariable, this.outputVariable]);
    
    
        // Initialize the gpu shader thingy
        const error = this.gpuCompute.init();
        if (error != null) {
            console.log(error);
        }
    }

    update() {
        // Updates the shaders
        // Call this in _RAF
        this.advectUniforms["temperatureSampler"].value = this.gpuCompute.getAlternateRenderTarget(this.temperatureVariable).texture;
      
        this.divergenceUniforms["velocitySampler"].value = this.gpuCompute.getAlternateRenderTarget(this.advectVariable).texture;
    
        this.jacobiUniforms["velocitySampler"].value = this.gpuCompute.getAlternateRenderTarget(this.advectVariable).texture;
        this.jacobiUniforms["divergenceSampler"].value = this.gpuCompute.getAlternateRenderTarget(this.divergenceVariable).texture;
    
        this.outputUniforms["velocitySampler"].value = this.gpuCompute.getAlternateRenderTarget(this.advectVariable).texture;
        this.outputUniforms["pressureSampler"].value = this.gpuCompute.getAlternateRenderTarget(this.jacobiVariable).texture;
    
        
        this.gpuCompute.compute();
        this.boxMaterial.uniforms.map.value = this.gpuCompute.getCurrentRenderTarget(this.advectVariable).texture;
        this.altBoxMaterial.uniforms.map.value = this.gpuCompute.getAlternateRenderTarget(this.advectVariable).texture;
    
        this.boxMesh.material.uniforms.cameraPos.value.copy(this.camera.position);
        this.altBoxMesh.material.uniforms.cameraPos.value.copy(this.camera.position);
    }
}


