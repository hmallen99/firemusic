import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.127/build/three.module.js';

import { GPUComputationRenderer } from 'https://cdn.jsdelivr.net/npm/three@0.127/examples/jsm/misc/GPUComputationRenderer.js';

const WIDTH = 64;

class FluidFireSystem {
    constructor(params) {
        this.scene = params.scene;
        this.camera = params.camera;
        this.renderer = params.renderer;
        this._z_spawn = params._z_spawn;
        
        this._init_box();
        this._init_fluid_shader();
    }

    _fillTexture(texture, texValue, random_offset) {
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
        // Initialize the fire box
        const boxGeometry = new THREE.BoxGeometry(2, 2, 2);
        
    
        this.boxMaterial = new THREE.RawShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                map: {value: null},
                cameraPos: {value: new THREE.Vector3()},
                threshold: {value: 0.6},
                steps: {value: 200},
                reactionSampler: {value: null},
                colorMod: {value: new THREE.Vector3(1.0, 0.5, 0.25)},
            },
            vertexShader: document.getElementById('boxVertexShader').textContent,
            fragmentShader: document.getElementById('boxFragmentShader').textContent,
            blending: THREE.AdditiveBlending,
        });
    
        this.altBoxMaterial = new THREE.RawShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                map: {value: null},
                cameraPos: {value: new THREE.Vector3()},
                threshold: {value: 0.6},
                steps: {value: 200},
                reactionSampler: {value: null},
                colorMod: {value: new THREE.Vector3(1.0, 0.5, 0.25)},
            },
            vertexShader: document.getElementById('boxVertexShader').textContent,
            fragmentShader: document.getElementById('boxFragmentShader').textContent,
            blending: THREE.AdditiveBlending,
        });
    
        this.boxMesh = new THREE.Mesh(boxGeometry, this.boxMaterial);
        this.altBoxMesh = new THREE.Mesh(boxGeometry, this.altBoxMaterial);

        this.boxMesh.position.x = 0;
        this.boxMesh.position.y = 0;
        this.boxMesh.position.z = this._z_spawn * 0.25;

        this.boxMesh.scale.x = 5.0;
        this.boxMesh.scale.y = 5.0;
        this.boxMesh.scale.z = 5.0;

        this.altBoxMesh.position.x = 0;
        this.altBoxMesh.position.y = 0;
        this.altBoxMesh.position.z = this._z_spawn * 0.25;

        this.altBoxMesh.scale.x = 5.0;
        this.altBoxMesh.scale.y = 5.0;
        this.altBoxMesh.scale.z = 5.0;

        this.scene.add(this.boxMesh);
        this.scene.add(this.altBoxMesh);
    }

    _init_fluid_shader() {
        // Initialize the fire GLSL shaders
        this.gpuCompute = new GPUComputationRenderer(WIDTH * WIDTH, WIDTH, this.renderer);
        
        // Initialize Textures
        var divergenceMap = this.gpuCompute.createTexture();
        var pressureMap = this.gpuCompute.createTexture();
        var velocityMap = this.gpuCompute.createTexture();
        var outputMap = this.gpuCompute.createTexture();
        var temperatureMap = this.gpuCompute.createTexture();
        var reactionMap = this.gpuCompute.createTexture();
    
        this._fillTexture(divergenceMap, 0.0);
        this._fillTexture(pressureMap, 0.0);
        this._fillTexture(velocityMap, 0.0);
        this._fillTexture(outputMap, 0.0);
        this._fillTexture(temperatureMap, 60.0);
        this._fillTexture(reactionMap, 0.0);
        
        var blockRes = new THREE.Vector3(WIDTH, WIDTH, WIDTH);
    
        // Initialize Temperature Advection Shader
        this.temperatureVariable = this.gpuCompute.addVariable("temperatureSampler", document.getElementById("temperatureShader").textContent, temperatureMap);
        this.temperatureUniforms = this.temperatureVariable.material.uniforms;
        this.temperatureUniforms["timestep"] = {value: 0.1};
        this.temperatureUniforms["blockRes"] = {value: blockRes};
        this.temperatureVariable.minFilter = THREE.LinearFilter;
        this.temperatureVariable.magFilter = THREE.LinearFilter;
        this.gpuCompute.addResolutionDefine(this.temperatureVariable.material);
    

        // Initialize Reaction Advection Shader
        this.reactionVariable = this.gpuCompute.addVariable("reactionSampler", document.getElementById("reactionShader").textContent, reactionMap);
        this.reactionUniforms = this.reactionVariable.material.uniforms;
        this.reactionUniforms["timestep"] = {value: 0.1};
        this.reactionUniforms["blockRes"] = {value: blockRes};
        this.reactionUniforms["k"] = {value: 0.05};
        this.reactionVariable.minFilter = THREE.LinearFilter;
        this.reactionVariable.magFilter = THREE.LinearFilter;
        this.gpuCompute.addResolutionDefine(this.reactionVariable.material);

        // Initialize Velocity Advection Shader
        this.advectVariable = this.gpuCompute.addVariable("velocitySampler", document.getElementById("advectShader").textContent, velocityMap);
        this.advectUniforms = this.advectVariable.material.uniforms;
        this.advectUniforms["timestep"] = {value: 0.1};
        this.advectUniforms["b"] = {value: -10};
        this.advectUniforms["inv_T_zero"] = {value: 1.0 / 60.0};
        this.advectUniforms["temperatureSampler"] = {value: null};
        this.advectUniforms["blockRes"] = {value: blockRes};
        this.advectUniforms["velocityOffset"] = {value: new THREE.Vector3(0.0, 0.0, 0.0)};
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
        this.jacobiVariable = this.gpuCompute.addVariable("pressureSampler", document.getElementById("jacobiShader").textContent, pressureMap);
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
        this.gpuCompute.setVariableDependencies(this.reactionVariable, [this.reactionVariable, this.outputVariable]);
    
    
        // Initialize the gpu shader thingy
        const error = this.gpuCompute.init();
        if (error != null) {
            console.log(error);
        }
    }

    update(fireIdx, isPaused, dataArray) {
        // Updates the shaders
        // Call this in _RAF

        // Set render targets to outputs of dependencies
        this.advectUniforms["temperatureSampler"].value = this.gpuCompute.getAlternateRenderTarget(this.temperatureVariable).texture;
        this.advectUniforms["velocityOffset"].value = new THREE.Vector3(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5);
        this.divergenceUniforms["velocitySampler"].value = this.gpuCompute.getAlternateRenderTarget(this.advectVariable).texture;
        this.jacobiUniforms["velocitySampler"].value = this.gpuCompute.getAlternateRenderTarget(this.advectVariable).texture;
        this.jacobiUniforms["divergenceSampler"].value = this.gpuCompute.getAlternateRenderTarget(this.divergenceVariable).texture;
        this.outputUniforms["velocitySampler"].value = this.gpuCompute.getAlternateRenderTarget(this.advectVariable).texture;
        this.outputUniforms["pressureSampler"].value = this.gpuCompute.getAlternateRenderTarget(this.jacobiVariable).texture;
    
        // Do computation
        this.gpuCompute.compute();

        // Update Material Parameters
        this.boxMaterial.uniforms.map.value = this.gpuCompute.getCurrentRenderTarget(this.advectVariable).texture;
        this.altBoxMaterial.uniforms.map.value = this.gpuCompute.getAlternateRenderTarget(this.advectVariable).texture;
        this.boxMaterial.uniforms.reactionSampler.value = this.gpuCompute.getCurrentRenderTarget(this.reactionVariable).texture;
        this.altBoxMaterial.uniforms.reactionSampler.value = this.gpuCompute.getAlternateRenderTarget(this.reactionVariable).texture;
        this.boxMesh.material.uniforms.cameraPos.value.copy(this.camera.position);
        this.altBoxMesh.material.uniforms.cameraPos.value.copy(this.camera.position);

        // modulate colors based on music
        if (isPaused) {
            this.boxMaterial.uniforms.colorMod.value = new THREE.Vector3(1.0, 0.5, 0.25);
            this.altBoxMaterial.uniforms.colorMod.value = new THREE.Vector3(1.0, 0.5, 0.25);
        } else {
            var buffer_index = Math.round(Math.exp(2.8*fireIdx/22));
            var colorModifier = Math.max(Math.exp(0.0162 * dataArray[buffer_index])*4 + Math.random() * 5, 15);
            var r = 1 - (Math.min(128, colorModifier) / 128);
            var g = 1 - (Math.abs(colorModifier - 127.5) / 127.5);
            var b = Math.max(colorModifier - 128, 0) / 128;
            
            this.boxMaterial.uniforms.colorMod.value = new THREE.Vector3(r, g, b);
            this.altBoxMaterial.uniforms.colorMod.value = new THREE.Vector3(r, g, b);
        }
    }
}


export {FluidFireSystem as default};