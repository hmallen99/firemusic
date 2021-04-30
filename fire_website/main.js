import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';

import {GLTFLoader} from 'https://cdn.jsdelivr.net/npm/three@0.118.1/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/controls/OrbitControls.js';


const _VS = `
uniform float pointMultiplier;

attribute float size;
attribute float angle;
attribute vec4 colour;

varying vec4 vColour;
varying vec2 vAngle;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = size * pointMultiplier / gl_Position.w;

  vAngle = vec2(cos(angle), sin(angle));
  vColour = colour;
}`;


const _FS = [

"uniform sampler2D diffuseTexture;",
"varying vec4 vColour;",
"varying vec2 vAngle;",

"void main() {",
  "vec2 coords = (gl_PointCoord - 0.5) * mat2(vAngle.x, vAngle.y, -vAngle.y, vAngle.x) + 0.5;",
  "gl_FragColor = texture2D(diffuseTexture, coords) * vColour;",
"}",
].join("\n");

// Audio Analysis

function fractionate(val, minVal, maxVal) {
    return (val - minVal)/(maxVal - minVal);
}

function modulate(val, minVal, maxVal, outMin, outMax) {
    var fr = fractionate(val, minVal, maxVal);
    var delta = outMax - outMin;
    return outMin + (fr * delta);
}

function avg(arr){
    var total = arr.reduce(function(sum, b) { return sum + b; });
    return (total / arr.length);
}

function max(arr){
    return arr.reduce(function(a, b){ return Math.max(a, b); })
}


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
    //get audio Analysis
    //console.log(dataArray);
    //console.log(analyser);
    //analyser.getByteFrequencyData(dataArray);
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
    };}
    window.onload = vizInit();
    
// Particle Implementation
class LinearSpline {
  constructor(lerp) {
    this._points = [];
    this._lerp = lerp;
  }

  AddPoint(t, d) {
    this._points.push([t, d]);
  }

  Get(t) {
    let p1 = 0;

    for (let i = 0; i < this._points.length; i++) {
      if (this._points[i][0] >= t) {
        break;
      }
      p1 = i;
    }

    const p2 = Math.min(this._points.length - 1, p1 + 1);

    if (p1 == p2) {
      return this._points[p1][1];
    }

    return this._lerp(
        (t - this._points[p1][0]) / (
            this._points[p2][0] - this._points[p1][0]),
        this._points[p1][1], this._points[p2][1]);
  }
}



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
        vertexShader: _VS,
        fragmentShader: _FS,
        blending: THREE.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        transparent: true,
        vertexColors: true
    });

    this._camera = params.camera;
    this._particles = [];

    this._geometry = new THREE.BufferGeometry();
    this._geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    this._geometry.setAttribute('size', new THREE.Float32BufferAttribute([], 1));
    this._geometry.setAttribute('colour', new THREE.Float32BufferAttribute([], 4));
    this._geometry.setAttribute('angle', new THREE.Float32BufferAttribute([], 1));

    this._points = new THREE.Points(this._geometry, this._material);

    params.parent.add(this._points);

    this._z_spawn = params._z_spawn;

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
      case 32: // SPACE
      this._particles = [];
      this._stop = !this._stop;
        //this._AddParticles();
        break;
    }
  }

  _AddParticles(timeElapsed, rgbcolor, fire_height = 15) {
    if (this._stop) {
      return;
    }
    if (!this.gdfsghk) {
      this.gdfsghk = 0.0;
    }
    this.gdfsghk += timeElapsed;
    const n = Math.floor(this.gdfsghk * 75.0);
    this.gdfsghk -= n / 75.0;
    if (!audio.paused) {
        this._colourSpline._points.splice(0, 1, [0.0, rgbcolor]);
    }
    //this._colourSpline.AddPoint(0.0, new THREE.Color(0xFFFF80));
    for (let i = 0; i < n; i++) {
      const life = (Math.random() * 0.75 + 0.25);
      this._particles.push({
          position: new THREE.Vector3(
              (Math.random() * 2 - 1) * 1.0,
              (Math.random() * 2 - 6) * 1.0,
              (Math.random() * 2 - this._z_spawn) * 1.0),
          size: (Math.random() * 0.5 + 0.5) * 4.0,
          colour: new THREE.Color(),
          alpha: 1.0,
          life: life,
          maxLife: life,
          rotation: Math.random() * 2.0 * Math.PI,
          velocity: new THREE.Vector3(0, fire_height, 0),
      });
    }
  }

  _UpdateGeometry() {
    const positions = [];
    const sizes = [];
    const colours = [];
    const angles = [];

    for (let p of this._particles) {
      positions.push(p.position.x, p.position.y, p.position.z);
      colours.push(p.colour.r, p.colour.g, p.colour.b, p.alpha);
      sizes.push(p.currentSize);
      angles.push(p.rotation);
    }

    this._geometry.setAttribute(
        'position', new THREE.Float32BufferAttribute(positions, 3));
    this._geometry.setAttribute(
        'size', new THREE.Float32BufferAttribute(sizes, 1));
    this._geometry.setAttribute(
        'colour', new THREE.Float32BufferAttribute(colours, 4));
    this._geometry.setAttribute(
        'angle', new THREE.Float32BufferAttribute(angles, 1));
  
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

    for (let p of this._particles) {
      const t = 1.0 - p.life / p.maxLife;

      p.rotation += timeElapsed * 0.5;
      p.alpha = this._alphaSpline.Get(t);
      p.currentSize = p.size * this._sizeSpline.Get(t);
      p.colour.copy(this._colourSpline.Get(t));

      p.position.add(p.velocity.clone().multiplyScalar(timeElapsed));

      const drag = p.velocity.clone();
      drag.multiplyScalar(timeElapsed * 0.1);
      drag.x = Math.sign(p.velocity.x) * Math.min(Math.abs(drag.x), Math.abs(p.velocity.x));
      drag.y = Math.sign(p.velocity.y) * Math.min(Math.abs(drag.y), Math.abs(p.velocity.y));
      drag.z = Math.sign(p.velocity.z) * Math.min(Math.abs(drag.z), Math.abs(p.velocity.z));
      p.velocity.sub(drag);
    }

    this._particles.sort((a, b) => {
      const d1 = this._camera.position.distanceTo(a.position);
      const d2 = this._camera.position.distanceTo(b.position);

      if (d1 > d2) {
        return -1;
      }

      if (d1 < d2) {
        return 1;
      }

      return 0;
    });
  }

  Step(timeElapsed, fire_i = -1) {
    if (audio.paused || fire_i == -1) {
        this._AddParticles(timeElapsed, new THREE.Color(0x00FF00), 15);
    }
    else {
        var fireheight = dataArray[fire_i]/2;
        //var r = fireheight + (25 * (fire_i/dataArray.length));
        var r = Math.min(250, Math.max(0, fireheight*2 + Math.random() * 100));
        var g = Math.min(250, Math.max(0, 12 * (fire_i/dataArray.length) + Math.random() * 100));
        var b = 250;
        var str_color = "rgb(" + Math.round(r) + ", " + Math.round(g) + ", " + Math.round(b) + ")";
        var convcolor = new THREE.Color(str_color);
        //console.log(str_color);
        this._AddParticles(timeElapsed, convcolor, fireheight);
    }
    this._UpdateParticles(timeElapsed);
    this._UpdateGeometry();
  }
}

class EmberSystem {
  constructor(params) {
    const uniforms = {
        diffuseTexture: {
            value: new THREE.TextureLoader().load('./resources/spark.png')
        },
        pointMultiplier: {
            value: window.innerHeight / (2.0 * Math.tan(0.5 * 60.0 * Math.PI / 180.0))
        }
    };

    this._material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: _VS,
        fragmentShader: _FS,
        blending: THREE.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        transparent: true,
        vertexColors: true
    });

    this._camera = params.camera;
    this._particles = [];

    this._geometry = new THREE.BufferGeometry();
    this._geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    this._geometry.setAttribute('size', new THREE.Float32BufferAttribute([], 1));
    this._geometry.setAttribute('colour', new THREE.Float32BufferAttribute([], 4));
    this._geometry.setAttribute('angle', new THREE.Float32BufferAttribute([], 1));

    this._points = new THREE.Points(this._geometry, this._material);

    params.parent.add(this._points);

    this._z_spawn = params._z_spawn;

    this._alphaSpline = new LinearSpline((t, a, b) => {
      return a + t * (b - a);
    });
    //this._alphaSpline.AddPoint(0.0, 0.0);
    this._alphaSpline.AddPoint(0.1, 1.0);
    //this._alphaSpline.AddPoint(0.6, 1.0);
    //this._alphaSpline.AddPoint(1.0, 0.0);

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

    // this._sizeSpline = new LinearSpline((t, a, b) => {
    //   return a + t * (b - a);
    // });
    // this._sizeSpline.AddPoint(0.0, 1.0);
    // this._sizeSpline.AddPoint(0.5, 5.0);
    // this._sizeSpline.AddPoint(1.0, 1.0);

    document.addEventListener('keyup', (e) => this._onKeyUp(e), false);
  
    this._UpdateGeometry();

    this._stop = false;
  }

  _onKeyUp(event) {
    // TODO: switch this to the Demo class
    switch(event.keyCode) {
      case 32: // SPACE
      this._particles = [];
      this._stop = !this._stop;
        //this._AddParticles();
        break;
    }
  }

  _AddParticles(timeElapsed, rgbcolor, fire_height = 10) {
    if (this._stop) {
      return;
    }
    if (!this.gdfsghk) {
      this.gdfsghk = 0.0;
    }
    this.gdfsghk += timeElapsed;
    //const n = Math.floor(this.gdfsghk * 75.0);
    const n = 1;
    this.gdfsghk -= n / 75.0;
    if (!audio.paused) {
      this._colourSpline._points.splice(0, 1, [0.0, rgbcolor]);
    }
    //embers
    for (let i = 0; i < n; i++) {
      const life = (Math.random() + 0.5);
      //const life = 1.5;
      this._particles.push({
          position: new THREE.Vector3(
              (Math.random() * 2 - 1) * 1.0,
              (Math.random() * 2 - 6) * 1.0,
              (Math.random() * 2 - this._z_spawn) * 1.0),
          size: (Math.random() * 0.5 + 0.5) * 4.0,
          colour: new THREE.Color(),
          alpha: 1.0,
          life: life,
          maxLife: life,
          rotation: Math.random() * 2.0 * Math.PI,
          velocity: new THREE.Vector3(0, fire_height, 0),
      });
    }
  }

  _UpdateGeometry() {
    const positions = [];
    const sizes = [];
    const colours = [];
    const angles = [];

    for (let p of this._particles) {
      positions.push(p.position.x, p.position.y, p.position.z);
      colours.push(p.colour.r, p.colour.g, p.colour.b, p.alpha);
      sizes.push(p.currentSize);
      angles.push(p.rotation);
    }

    this._geometry.setAttribute(
        'position', new THREE.Float32BufferAttribute(positions, 3));
    this._geometry.setAttribute(
        'size', new THREE.Float32BufferAttribute(sizes, 1));
    this._geometry.setAttribute(
        'colour', new THREE.Float32BufferAttribute(colours, 4));
    this._geometry.setAttribute(
        'angle', new THREE.Float32BufferAttribute(angles, 1));
  
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

    for (let p of this._particles) {
      const t = 1.0 - p.life / p.maxLife;

      p.rotation += timeElapsed * 0.5;
      p.alpha = this._alphaSpline.Get(t);
      //p.currentSize = p.size * this._sizeSpline.Get(t);
      p.currentSize = p.size;
      p.colour.copy(this._colourSpline.Get(t));

      p.position.add(p.velocity.clone().multiplyScalar(timeElapsed));

      const drag = p.velocity.clone();
      drag.multiplyScalar(timeElapsed * 0.1);
      drag.x = Math.sign(p.velocity.x) * Math.min(Math.abs(drag.x), Math.abs(p.velocity.x));
      drag.y = Math.sign(p.velocity.y) * Math.min(Math.abs(drag.y), Math.abs(p.velocity.y));
      drag.z = Math.sign(p.velocity.z) * Math.min(Math.abs(drag.z), Math.abs(p.velocity.z));
      //drag.z += Math.random() * (.3 + .3) - .3;
      p.velocity.sub(drag);
    }

    this._particles.sort((a, b) => {
      const d1 = this._camera.position.distanceTo(a.position);
      const d2 = this._camera.position.distanceTo(b.position);

      if (d1 > d2) {
        return -1;
      }

      if (d1 < d2) {
        return 1;
      }

      return 0;
    });
  }
  //0.01666599999999994

  Step(timeElapsed, t, fire_i = -1) {
    if (audio.paused || fire_i == -1) {
      this._AddParticles(timeElapsed, new THREE.Color(0x00FF00), 10);
    } else {
      var fireheight = dataArray[fire_i]/4;
        //var r = fireheight + (25 * (fire_i/dataArray.length));
        var r = Math.min(250, Math.max(0, fireheight*2 + Math.random() * 100));
        var g = Math.min(250, Math.max(0, 12 * (fire_i/dataArray.length) + Math.random() * 100));
        var b = 250;
        var str_color = "rgb(" + Math.round(r) + ", " + Math.round(g) + ", " + Math.round(b) + ")";
        var convcolor = new THREE.Color(str_color);
        //console.log(str_color);
        this._AddParticles(timeElapsed, convcolor, fireheight);
    }
    this._UpdateParticles(timeElapsed);
    this._UpdateGeometry();
  }
}

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

    //const loader = new THREE.CubeTextureLoader();
    /*const texture = loader.load([
        './resources/posx.jpg',
        './resources/negx.jpg',
        './resources/posy.jpg',
        './resources/negy.jpg',
        './resources/posz.jpg',
        './resources/negz.jpg',
    ]);*/
    const texture = new THREE.TextureLoader().load( "./resources/disco.jpeg" );
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1,1);

    this._scene.background = texture;

    var num_fires = 5;
    this._fire_list = new Array(num_fires);
    var max_width = (num_fires-1) * 10;
    for (var i = 0; i < num_fires; i++) {
      this._fire_list[i] = new ParticleSystem({
          parent: this._scene,
          camera: this._camera,
          _z_spawn: i * 10 - max_width/2,
      });
    }

    this._ember_list = new Array(num_fires);
    for (var i = 0; i < num_fires; i++) {
      this._ember_list[i] = new EmberSystem({
          parent: this._scene,
          camera: this._camera,
          _z_spawn: i * 10 - max_width/2,
      });
    }

    this._previousRAF = null;
    this._RAF();
  }

  _onAudioChange() {
    // get audio analysis
    analyser.getByteFrequencyData(dataArray);
    //var num_fires = dataArray.length/4;
    var num_fires = 30;
    this._fire_list = new Array(num_fires);
    var max_width = (num_fires-1) * 10;
    this._camera.position.set(25+num_fires*5, 0, 0);

    while(this._scene.children.length > 0){ 
        this._scene.remove(this._scene.children[0]); 
    }

    for (var i = 0; i < num_fires; i++) {
      this._fire_list[i] = new ParticleSystem({
          parent: this._scene,
          camera: this._camera,
          _z_spawn: i * 10 - max_width/2,
      });
    }

    //add embers
    this._ember_list = new Array(num_fires);
    for (var i = 0; i < num_fires; i++) {
      this._ember_list[i] = new EmberSystem({
          parent: this._scene,
          camera: this._camera,
          _z_spawn: i * 10 - max_width/2,
      });
    }


  }

  _OnWindowResize() {
    this._camera.aspect = window.innerWidth / window.innerHeight;
    this._camera.updateProjectionMatrix();
    this._threejs.setSize(window.innerWidth, window.innerHeight);
  }

  _RAF() {
    requestAnimationFrame((t) => {
      if (this._previousRAF === null) {
        this._previousRAF = t;
      }

      this._RAF();

      this._threejs.render(this._scene, this._camera);
      this._Step(t - this._previousRAF, t);
      this._previousRAF = t;
    });
  }

  _Step(timeElapsed, t) {
    const timeElapsedS = timeElapsed * 0.001;
    if (!audio.paused) {
        analyser.getByteFrequencyData(dataArray);
        for (var i = 0; i < this._fire_list.length; i++) {
            this._fire_list[i].Step(timeElapsedS, i);
        }
        for (var i = 0; i < this._ember_list.length; i++) {
          this._ember_list[i].Step(timeElapsedS, t, i); 
        }
    }
    else {
        for (var i = 0; i < this._fire_list.length; i++) {
            this._fire_list[i].Step(timeElapsedS);
        }
        for (var i = 0; i < this._ember_list.length; i++) {
          this._ember_list[i].Step(timeElapsedS, t); 
        }
    }
  }
}


let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
  _APP = new ParticleSystemDemo();
});
