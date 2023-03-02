import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.127/build/three.module.js';

import {OrbitControls} from 'https://cdn.jsdelivr.net/npm/three@0.127/examples/jsm/controls/OrbitControls.js';
import FluidFireSystem from './FluidFireSystem.js';

class ParticleSystemDemo {
  constructor() {
    this._Initialize();
  }

  _Initialize() {
    this._threejs = new THREE.WebGLRenderer({
      antialias: true,
    });
    this._threejs.shadowMap.enabled = true;
    this._threejs.shadowMap.type = THREE.PCFSoftShadowMap;
    this._threejs.setPixelRatio(window.devicePixelRatio);
    this._threejs.setSize(window.innerWidth, window.innerHeight);

    document.body.appendChild(this._threejs.domElement);

    window.addEventListener('resize', () => {
      this._OnWindowResize();
    }, false);

    const fov = 60;
    const aspect = 1920 / 1080;
    const near = 1.0;
    const far = 1000.0;
    this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this._camera.position.set(25, 0, 0);

    this._scene = new THREE.Scene();

    let light = new THREE.DirectionalLight(0xFFFFFF, 1.0);
    light.position.set(20, 100, 10);
    light.target.position.set(0, 0, 0);
    light.castShadow = true;
    light.shadow.bias = -0.001;
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.left = 100;
    light.shadow.camera.right = -100;
    light.shadow.camera.top = 100;
    light.shadow.camera.bottom = -100;
    this._scene.add(light);

    light = new THREE.AmbientLight(0x101010);
    this._scene.add(light);

    const controls = new OrbitControls(
      this._camera, this._threejs.domElement);
    controls.target.set(0, 0, 0);
    controls.update();

    this.num_fires = 1;
    this._fire_list = new Array(this.num_fires);
    var max_width = (this.num_fires-1) * 10;

    this._realistic_fire_list = new Array(this.num_fires);
    for (var i = 0; i < this.num_fires; i++) {
        this._realistic_fire_list[i] = new FluidFireSystem({
            scene: this._scene,
            camera: this._camera,
            renderer: this._threejs,
            _z_spawn: i * 10 - max_width/2,
        });
    }

    this._previousRAF = null;
    this._simulate();
  }

  _OnWindowResize() {
    this._camera.aspect = window.innerWidth / window.innerHeight;
    this._camera.updateProjectionMatrix();
    this._threejs.setSize(window.innerWidth, window.innerHeight);
  }

  _simulate() {
    if (this._fire_list > 0) {
        while(this._scene.children.length > 0){
            this._scene.remove(this._scene.children[0]);
        }
        this._fire_list = [];

        this.num_fires = 22;
        var max_width = (this.num_fires-1) * 10;
        this._realistic_fire_list = new Array(this.num_fires);
        for (var i = 0; i < this.num_fires; i++) {
            this._realistic_fire_list[i] = new FluidFireSystem({
                scene: this._scene,
                camera: this._camera,
                renderer: this._threejs,
                _z_spawn: i * 10 - max_width/2,
            });
        }
    }
    this._RAF_realistic();
  }

  _RAF_realistic() {
    requestAnimationFrame((t) => {
      if (this._previousRAF === null) {
        this._previousRAF = t;
      }

      this._simulate();
      this._UpdateRealisticFires();
      this._threejs.render(this._scene, this._camera);
      this._previousRAF = t;
    });
  }

  _UpdateRealisticFires(){
    for (var i = 0; i < this._realistic_fire_list.length; i++) {
        this._realistic_fire_list[i].update();
    }
  }
}

let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
  _APP = new ParticleSystemDemo();
});
