import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.127/build/three.module.js';

import {OrbitControls} from 'https://cdn.jsdelivr.net/npm/three@0.127/examples/jsm/controls/OrbitControls.js';
import {GUI} from 'https://cdn.jsdelivr.net/npm/three@0.127/examples/jsm/libs/dat.gui.module.js';
import FluidFireSystem from './FluidFireSystem.js';

import {
	particleVertexShader,
	particleFragmentShader
} from './shaders/particleShaders.js';

import { search } from './spotifyAPI.js';

var dataArray;
var analyser;
var audio;
// the main visualiser function
var vizInit = function (){
  var file = document.getElementById("thefile");
  audio = document.getElementById("audio");
  var fileLabel = document.querySelector("label.file");

  document.onload = function(e){
    console.log(e);
    audio.play();
    play();
  }

  file.onchange = function(){
    fileLabel.classList.add('normal');
    audio.classList.add('active');
    var files = this.files;

    audio.src = URL.createObjectURL(files[0]);
    audio.load();
    audio.play();
    play();
    _APP._onAudioChange();
    // add to number of fires here and start audio analysis
  }

	function play() {
    var context = new AudioContext();
    var src = context.createMediaElementSource(audio);
    analyser = context.createAnalyser();
    src.connect(analyser);
    analyser.connect(context.destination);
    analyser.fftSize = 256;
    var bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    audio.play();
	};
}

window.onload = vizInit();

// Particle Implementation
import LinearSpline from './LinearSpline.js';

class ParticleSystem {
  constructor(params) {
    const uniforms = {
        diffuseTexture: {
            value: new THREE.TextureLoader().load('./resources/fire.png')
        },
        pointMultiplier: {
            value: window.innerHeight / (3.0 * Math.tan(0.5 * 60.0 * Math.PI / 180.0)) //change size
        }
    };

    this._material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        depthTest: true,
        depthWrite: false,
        transparent: true,
        vertexColors: true
    });

    this.immersive = params.immersive;
    this.danceability = params.danceability;
    this.energy = params.energy;

    this._camera = params.camera;
    this._particles = [];

    this._geometry = new THREE.BufferGeometry();
    this._geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    this._geometry.setAttribute('size', new THREE.Float32BufferAttribute([], 1));
    this._geometry.setAttribute('colour', new THREE.Float32BufferAttribute([], 4));
    this._geometry.setAttribute('angle', new THREE.Float32BufferAttribute([], 1));
    this._geometry.setAttribute('blend', new THREE.Float32BufferAttribute([], 1));

    this._points = new THREE.Points(this._geometry, this._material);

    params.parent.add(this._points);

    this._z_spawn = params._z_spawn;

    var num_pressure_points = 5;
    this._pressure_points = new Array(num_pressure_points);
    this._pressure_life = 2;
    for (var i = 0; i < num_pressure_points; i++) {
      this._pressure_points[i] = {
          position: new THREE.Vector3(
                    (Math.random() * 2 - 1)*1.0 ,
                    (Math.random() *1),
                    (Math.random() * 2 - 1 - this._z_spawn)),
          size: (Math.random() * 0.5 + 0.5) * 4.0,
          colour: new THREE.Color(),
          alpha: 1.0,
          life: this._pressure_life,
          maxLife: this._pressure_life,
          rotation: Math.random() * 2.0 * Math.PI,
          velocity: new THREE.Vector3(0, 0, 0),
      }
    }

    this._alphaSpline = new LinearSpline((t, a, b) => {
      return a + t * (b - a);
    });
    this._alphaSpline.AddPoint(0.0, 0.0);
    this._alphaSpline.AddPoint(0.1, 1.0);
    this._alphaSpline.AddPoint(0.6, 1.0);
    this._alphaSpline.AddPoint(1.0, 0.0);

    this._colourSpline = new LinearSpline((t, a, b) => {
      const c = a.clone();
      return c.lerp(b, t);
    });

    // 0.0->0xFFFF80
    // 1.0 -> 0xFF8080
    if (this._x_spawn == -1) {
      this._colourSpline.AddPoint(0.0, new THREE.Color(0x80FF80));
    } else {
      this._colourSpline.AddPoint(0.0, new THREE.Color(0xFFFF80));
    }

    this._colourSpline.AddPoint(1.0, new THREE.Color(0xFF8080));

    this._colourSplineS = new LinearSpline((t, a, b) => {
        const c = a.clone();
      return c.lerp(b, t);
    })

    this._colourSplineS.AddPoint(0.0, new THREE.Color(0x404040));
    this._colourSplineS.AddPoint(1.0, new THREE.Color(0x000000));

    this._sizeSpline = new LinearSpline((t, a, b) => {
      return a + t * (b - a);
    });
    this._sizeSpline.AddPoint(0.0, 1.0);
    this._sizeSpline.AddPoint(0.5, 5.0);
    this._sizeSpline.AddPoint(1.0, 1.0);

    document.addEventListener('keyup', (e) => this._onKeyUp(e), false);

    this._UpdateGeometry();

    this._stop = false;
  }

  _onKeyUp(event) {
    // TODO: switch this to the Demo class
    switch(event.keyCode) {
    /*
      case 32: // SPACE
      this._particles = [];
      this._stop = !this._stop;
        //this._AddParticles();
        break;
    */
    }
  }

  _AddParticles(timeElapsed, fire_color, smoke_color, fire_height = 15) {
    if (this._stop) {
      return;
    }
    if (!this.gdfsghk) {
      this.gdfsghk = 0.0;
    }
    this.gdfsghk += timeElapsed;
    const n = Math.floor(this.gdfsghk * 65.0) * 2;
    this.gdfsghk -= n / 75.0;
    if (!audio.paused) {
        this._colourSpline._points.splice(0, 1, [0.0, fire_color]);
        this._colourSplineS._points.splice(0, 1, [0.0, smoke_color]);
    }
    //this._colourSpline.AddPoint(0.0, new THREE.Color(0xFFFF80));
    for (let i = 0; i < n; i++) {
      //const life = (Math.random() * 0.75 + 0.25);
      // fire_height between 0, 127
      // for 15, this is what is optimal
      const life = fire_height / 20 ;//- Math.random() * 0.5;
      this._particles.push({
          position: new THREE.Vector3(
              (Math.random() * 2 - 1) * 1.0,
              (Math.random() * 2 * Math.max(1, this.immersive*15) - 6) * 1.0,
              (Math.random() * 2 - 1 - this._z_spawn) * 1.0),
          size: (Math.random() * 0.5 + 0.5) * 2.0,
          colour: new THREE.Color(),
          alpha: 1.0,
          life: life,
          maxLife: life,
          rotation: Math.random() * 2.0 * Math.PI,
          velocity: new THREE.Vector3(0, fire_height, 0),
          blend: 0.0,
      });
    }

    for (let i = 0; i < n; i++) {
        const life = (fire_height + 10) / 20;//- Math.random() * 0.5;
        this._particles.push({
            position: new THREE.Vector3(
                (Math.random() * 2 - 1) * 1.0,
                (Math.random() * 2 - 6) * 1.0,
                (Math.random() * 2 - 1 - this._z_spawn) * 1.0),
            size: (Math.random() * 0.5 + 0.5) * 2.0,
            colour: new THREE.Color(),
            alpha: 1.0,
            life: life,
            maxLife: life,
            rotation: Math.random() * 2.0 * Math.PI,
            velocity: new THREE.Vector3(0, fire_height, 0),
            blend: 1.0,
        });
    }

    for (let i = 0; i < (n); i++) {
      //const life = (Math.random() * 0.75 + 0.25);
      // fire_height between 0, 127
      // for 15, this is what is optimal
      const life = fire_height / 40 ;//- Math.random() * 0.5;
      this._particles.push({
          position: new THREE.Vector3(
              (Math.random() * 2 - 1) * 1.0,
              (Math.random() * 2 - 6) * 1.0,
              (Math.random() * 2 - 1 - this._z_spawn) * 1.0),
          size: (Math.random() * 0.5 + 0.5) * 2.0,
          colour: new THREE.Color(),
          alpha: 1.0,
          life: life,
          maxLife: life,
          rotation: Math.random() * 2.0 * Math.PI,
          velocity: new THREE.Vector3(0, fire_height, 0),
          blend: 0.0,
      });
    }
  }

  _UpdateGeometry() {
    const positions = [];
    const sizes = [];
    const colours = [];
    const angles = [];
    const blends = [];

    for (let p of this._particles) {
      positions.push(p.position.x, p.position.y, p.position.z);
      colours.push(p.colour.r, p.colour.g, p.colour.b, p.alpha);
      sizes.push(p.currentSize);
      angles.push(p.rotation);
      blends.push(p.blend);
    }

    this._geometry.setAttribute(
        'position', new THREE.Float32BufferAttribute(positions, 3));
    this._geometry.setAttribute(
        'size', new THREE.Float32BufferAttribute(sizes, 1));
    this._geometry.setAttribute(
        'colour', new THREE.Float32BufferAttribute(colours, 4));
    this._geometry.setAttribute(
        'angle', new THREE.Float32BufferAttribute(angles, 1));
    this._geometry.setAttribute(
        'blend', new THREE.Float32BufferAttribute(blends, 1));

    this._geometry.attributes.position.needsUpdate = true;
    this._geometry.attributes.size.needsUpdate = true;
    this._geometry.attributes.colour.needsUpdate = true;
    this._geometry.attributes.angle.needsUpdate = true;
  }

  _UpdateParticles(timeElapsed) {
    for (let p of this._particles) {
      p.life -= timeElapsed;
    }

    this._particles = this._particles.filter(p => {
      return p.life > 0.0;
    });

    for (let pressure of this._pressure_points) {
      pressure.life -= timeElapsed;
      if (pressure.life < 0.0) {
        pressure.life = this._pressure_life;
        pressure.position = new THREE.Vector3(
                            (Math.random() * 2 - 1) ,
                            (Math.random() *1),
                            (Math.random() * 2 - 1 -this._z_spawn));
      }
    }

    for (let p of this._particles) {
      const t = 1.0 - p.life / p.maxLife;

      p.rotation += timeElapsed * 0.5;
      if (p.blend == 0.0) {
        p.alpha = this._alphaSpline.Get(t);
        p.currentSize = p.size * this._sizeSpline.Get(t);
        p.colour.copy(this._colourSpline.Get(t));
      } else {
        p.alpha = this._alphaSpline.Get(t);
        p.currentSize = p.size * this._sizeSpline.Get(t);
        p.colour.copy(this._colourSplineS.Get(t));
      }


      p.position.add(p.velocity.clone().multiplyScalar(timeElapsed));

      const drag = p.velocity.clone();
      drag.multiplyScalar(timeElapsed * 0.3);
      drag.x = Math.sign(p.velocity.x) * Math.min(Math.abs(drag.x), Math.abs(p.velocity.x));
      //drag.y = Math.sign(p.velocity.y) * Math.min(Math.abs(drag.y), Math.abs(p.velocity.y));
      drag.z = Math.sign(p.velocity.z) * Math.min(Math.abs(drag.z), Math.abs(p.velocity.z));

      //const gravity = new THREE.Vector3(0, 0.1, 0);
      p.velocity.sub(drag);
      //p.velocity.sub(gravity);

      // Evaluate Pressure points
      var closest_pressure;
      var closest_dist = Infinity;
      for (let pressure of this._pressure_points) {
        var dist = p.position.distanceTo(pressure.position);
        if (dist < closest_dist && pressure.position.y > p.position.y) {
          closest_pressure = pressure;
          closest_dist = dist;
        }
      }

      if (closest_dist < Infinity) {
        var pointToPressure = new THREE.Vector3(
                              closest_pressure.position.x-p.position.x,
                              closest_pressure.position.y-p.position.y,
                              closest_pressure.position.z-p.position.z)
        pointToPressure.normalize();
        pointToPressure.multiplyScalar(0.5);
        p.velocity.add(pointToPressure);
      }
    }
  }

  Step(timeElapsed, fire_i = -1) {
    if (audio.paused || fire_i == -1) {
        this._AddParticles(timeElapsed, new THREE.Color(0x00FF00), 15);
    }
    else {
        // Currently, there are 30 fires and len dataArray = 128
        // Used an exponential equation so we reach all frequencies
        // while concentrating on lower ones (higher ones aren't all that exciting)
        var buffer_index = Math.round(Math.exp(2.8*fire_i/22));
        var freq_value = dataArray[buffer_index];
        // Range of fireheight is from 0 to 255
        var fireheight = Math.max(Math.exp(0.0162 * dataArray[buffer_index])*4 + Math.random() * 5, 15);

        var r;
        var g;
        var b;
        if (this.danceability < 0.4) {
          // Low danceability -> more blue
          r = Math.random() * 50 + 20;
          g = Math.random() * 50 + 60;
          b = Math.random() * 5 + 250;
          r=0;
        } else if (this.danceability > 0.8) {
          // High danceability -> red
          r = Math.random() * 15 + 240;
          g = Math.random() * 180 + 60;
          b = Math.random() * 180 + 60;
        } else {
          // Medium danceability -> green
          r = Math.random() * 200 + 20;
          g = Math.random() * 15 + 240;
          b = Math.random() * 150 + 100;
        }
        var str_color = "rgb(" + Math.round(r) + ", " + Math.round(g) + ", " + Math.round(b) + ")";
        var fire_color = new THREE.Color(str_color);

        if (this.energy < 0.4) {
          // Low energy -> lighter smoke
          r = Math.random() * 30 + 100;
          b = Math.random() * 30 + 100;
          g = Math.random() * 30 + 100;
        } else if (this.energy > 0.8) {
          // High energy -> darker smoke
          r = Math.random() * 25 + 25;
          b = Math.random() * 25 + 25;
          g = Math.random() * 25 + 25;
        } else {
          // Medium energy -> medium smoke
          r = Math.random() * 30 + 60;
          b = Math.random() * 30 + 60;
          g = Math.random() * 30 + 60;
        }
        str_color = "rgb(" + Math.round(r) + ", " + Math.round(g) + ", " + Math.round(b) + ")";
        var smoke_color = new THREE.Color(str_color);


        this._AddParticles(timeElapsed, fire_color, smoke_color, fireheight/8);
    }
    this._UpdateParticles(timeElapsed);
    this._UpdateGeometry();
  }
}

class ParticleSystemDemo {
  constructor() {
    this.params= {
        particleFire: true,
        immersive: false,
        danceability: 1,
        energy: 1,
    }
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

    const gui = new GUI();
    gui.add(this.params, "particleFire").name("Use Particle Fire");
    gui.add(this.params, "immersive").name("Dance Mode");

    //default song
    var title = {title: 'funky galileo'};
    var t_control = gui.add(title, 'title');

    var artist = {artist: 'sure sure'};
    var a_control = gui.add(artist, 'artist');
    var d_control;
    var e_control;

    // Initial Search
    search(encodeURIComponent(t_control.object.title.trim()), encodeURIComponent(a_control.object.artist.trim())).then(feats => {
        // got value here
        this.params.danceability = feats.danceability;
        this.params.energy = feats.energy;
        d_control = gui.add(this.params, "danceability", 0, 1).name("Danceability");
        e_control = gui.add(this.params, "energy", 0, 1).name("Energy");

    }).catch(e => {
        // error
        console.log(e);
    });

    function updatefeats(demo) {
        search(encodeURIComponent(t_control.object.title.trim()), encodeURIComponent(a_control.object.artist.trim())).then(feats => {
            // got value here
            demo.params.danceability = feats.danceability;
            d_control.setValue(demo.params.danceability);
            demo.params.energy = feats.energy;
            e_control.setValue(demo.params.energy);

        }).catch(e => {
            // error
            console.log(e);
        });
    }

    var demo = this;
    var submit = { submit:function(){
        updatefeats(demo);
    }};
    gui.add(submit,'submit').name("Search Spotify");


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

    const texture = new THREE.TextureLoader().load( "./resources/disco.jpeg" );
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1,1);

    this._scene.background = texture;

    this.num_fires = 5;
    this._fire_list = new Array(this.num_fires);
    var max_width = (this.num_fires-1) * 10;
    for (var i = 0; i < this.num_fires; i++) {
      this._fire_list[i] = new ParticleSystem({
          parent: this._scene,
          camera: this._camera,
          _z_spawn: i * 10 - max_width/2,
          immersive: this.params.immersive,
          danceability: this.params.danceability,
          energy: this.params.energy,
      });
    }

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

  _onAudioChange() {
    // get audio analysis
    analyser.getByteFrequencyData(dataArray);

    this.num_fires = 22;
    this._fire_list = new Array(this.num_fires);
    var max_width = (this.num_fires-1) * 10;
    if (!this.params.immersive) {
        this._camera.position.set(25+this.num_fires*5, 0, 0);
    }
    else {
        this._camera.position.set(25, 0, 0);
    }

    while(this._scene.children.length > 0){
        this._scene.remove(this._scene.children[0]);
    }

    for (var i = 0; i < this.num_fires; i++) {
      this._fire_list[i] = new ParticleSystem({
          parent: this._scene,
          camera: this._camera,
          immersive: this.params.immersive,
          danceability: this.params.danceability,
          energy: this.params.energy,
          _z_spawn: i * 10 - max_width/2,
      });
    }

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

  _OnWindowResize() {
    this._camera.aspect = window.innerWidth / window.innerHeight;
    this._camera.updateProjectionMatrix();
    this._threejs.setSize(window.innerWidth, window.innerHeight);
  }

  _simulate() {
    if (!audio.paused && !this.params.immersive) {
        this._camera.position.set(5+22*2.5, 0, 0);
    } else if (!audio.paused) {
        this._camera.position.set(25, 0, 0);
    }
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
        if (!audio.paused) {
            analyser.getByteFrequencyData(dataArray);
        }
        this._realistic_fire_list[i].update(this._realistic_fire_list.length - i - 1, audio.paused, dataArray, this.params.danceability, this.params.energy);
    }
  }

  _Step(timeElapsed, t) {
    const timeElapsedS = timeElapsed * 0.001;
    if (!audio.paused) {
        analyser.getByteFrequencyData(dataArray);
        for (var i = 0; i < this._fire_list.length; i++) {
            this._fire_list[i].immersive = this.params.immersive;
            this._fire_list[i].danceability = this.params.danceability;
            this._fire_list[i].energy = this.params.energy;
            this._fire_list[i].Step(timeElapsedS, i);
        }
    }
    else {
        for (var i = 0; i < this._fire_list.length; i++) {
          this._fire_list[i].immersive = this.params.immersive;
          this._fire_list[i].danceability = this.params.danceability;
          this._fire_list[i].energy = this.params.energy;
          this._fire_list[i].Step(timeElapsedS);
        }
    }
  }
}

let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
  _APP = new ParticleSystemDemo();
});
