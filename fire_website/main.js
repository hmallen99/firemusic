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

"vec3 mod289(vec3 x) {",
    "return x - floor(x * (1.0 / 289.0)) * 289.0;",
"}",

"vec4 mod289(vec4 x) {",
    "return x - floor(x * (1.0 / 289.0)) * 289.0;",
"}",

"vec4 permute(vec4 x) {",
    "return mod289(((x * 34.0) + 1.0) * x);",
"}",

"vec4 taylorInvSqrt(vec4 r) {",
    "return 1.79284291400159 - 0.85373472095314 * r;",
"}",

"float snoise(vec3 v) {",
    "const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);",
    "const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);",

    // First corner
    "vec3 i  = floor(v + dot(v, C.yyy));",
    "vec3 x0 = v - i + dot(i, C.xxx);",

    // Other corners
    "vec3 g = step(x0.yzx, x0.xyz);",
    "vec3 l = 1.0 - g;",
    "vec3 i1 = min(g.xyz, l.zxy);",
    "vec3 i2 = max(g.xyz, l.zxy);",

    "vec3 x1 = x0 - i1 + C.xxx;",
    "vec3 x2 = x0 - i2 + C.yyy;", // 2.0*C.x = 1/3 = C.y
    "vec3 x3 = x0 - D.yyy;",      // -1.0+3.0*C.x = -0.5 = -D.y

    // Permutations
    "i = mod289(i); ",
    "vec4 p = permute(permute(permute( ",
            "i.z + vec4(0.0, i1.z, i2.z, 1.0))",
            "+ i.y + vec4(0.0, i1.y, i2.y, 1.0)) ",
            "+ i.x + vec4(0.0, i1.x, i2.x, 1.0));",

    // Gradients: 7x7 points over a square, mapped onto an octahedron.
    // The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
    "float n_ = 0.142857142857;", // 1.0/7.0
    "vec3  ns = n_ * D.wyz - D.xzx;",

    "vec4 j = p - 49.0 * floor(p * ns.z * ns.z);", //  mod(p,7*7)

    "vec4 x_ = floor(j * ns.z);",
    "vec4 y_ = floor(j - 7.0 * x_);", // mod(j,N)

    "vec4 x = x_ * ns.x + ns.yyyy;",
    "vec4 y = y_ * ns.x + ns.yyyy;",
    "vec4 h = 1.0 - abs(x) - abs(y);",

    "vec4 b0 = vec4(x.xy, y.xy);",
    "vec4 b1 = vec4(x.zw, y.zw);",

    "vec4 s0 = floor(b0) * 2.0 + 1.0;",
    "vec4 s1 = floor(b1) * 2.0 + 1.0;",
    "vec4 sh = -step(h, vec4(0.0));",

    "vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;",
    "vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;",

    "vec3 p0 = vec3(a0.xy, h.x);",
    "vec3 p1 = vec3(a0.zw, h.y);",
    "vec3 p2 = vec3(a1.xy, h.z);",
    "vec3 p3 = vec3(a1.zw, h.w);",

    //Normalise gradients
    "vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));",
    "p0 *= norm.x;",
    "p1 *= norm.y;",
    "p2 *= norm.z;",
    "p3 *= norm.w;",

    // Mix final noise value
    "vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);",
    "m = m * m;",
    "return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));",
"}",


"void main() {",
  "vec2 coords = (gl_PointCoord - 0.5) * mat2(vAngle.x, vAngle.y, -vAngle.y, vAngle.x) + 0.5;",
  //"coords.x += snoise(vec3(0.25));",
  //"coords.y += snoise(vec3(0.25));",
  "gl_FragColor = texture2D(diffuseTexture, coords) * vColour;",
"}",
].join("\n");


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

  _AddParticles(timeElapsed) {
    if (this._stop) {
      return;
    }
    if (!this.gdfsghk) {
      this.gdfsghk = 0.0;
    }
    this.gdfsghk += timeElapsed;
    const n = Math.floor(this.gdfsghk * 75.0);
    this.gdfsghk -= n / 75.0;

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
          velocity: new THREE.Vector3(0, 15, 0),
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

  Step(timeElapsed) {
    this._AddParticles(timeElapsed);
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
    this._camera.position.set(25, 10, 0);

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

    

    this._previousRAF = null;
    this._RAF();
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
      this._Step(t - this._previousRAF);
      this._previousRAF = t;
    });
  }

  _Step(timeElapsed) {
    const timeElapsedS = timeElapsed * 0.001;

    for (var i = 0; i < this._fire_list.length; i++) {
      this._fire_list[i].Step(timeElapsedS); 
    }
  }
}


let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
  _APP = new ParticleSystemDemo();
});
