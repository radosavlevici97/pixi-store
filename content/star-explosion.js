/**
 * StarExplosionShader - Full-screen supernova effect with parallax stars
 * 
 * Uses raw WebGL for rendering (original shader logic preserved exactly)
 * Uses PixiJS ticker for animation loop
 * 
 * @param {Object} options - Configuration options
 * @param {HTMLCanvasElement} [options.canvas] - Existing canvas element (optional)
 * @param {HTMLElement} [options.container] - Container to append canvas to (if no canvas provided)
 * @param {PIXI.Ticker} options.ticker - PixiJS ticker for animation
 * @param {number} [options.width] - Width (defaults to container/window width)
 * @param {number} [options.height] - Height (defaults to container/window height)
 * @param {boolean} [options.autoStart=true] - Start animation immediately
 */

// ============================================================================
// VERTEX SHADER (WebGL 1.0 - original)
// ============================================================================
const vertexShaderSource = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// ============================================================================
// FRAGMENT SHADER (WebGL 1.0 - original logic preserved exactly)
// ============================================================================
const fragmentShaderSource = `
  precision mediump float;
  
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec2 u_mouse;
  
  #define PI 3.14159265359
  #define TAU 6.28318530718
  
  // Hash functions
  float hash(float n) {
    return fract(sin(n) * 43758.5453);
  }
  
  float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  
  // 2D noise
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float a = hash2(i);
    float b = hash2(i + vec2(1.0, 0.0));
    float c = hash2(i + vec2(0.0, 1.0));
    float d = hash2(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  
  // FBM
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for(int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }
  
  // Star layer with parallax - returns color and brightness
  vec3 starLayer(vec2 uv, float scale, float brightness, float seed) {
    vec2 scaledUV = uv * scale;
    vec2 id = floor(scaledUV);
    vec2 gv = fract(scaledUV) - 0.5;
    
    vec3 col = vec3(0.0);
    
    // Check current cell and neighbors
    for(float y = -1.0; y <= 1.0; y++) {
      for(float x = -1.0; x <= 1.0; x++) {
        vec2 neighborOffset = vec2(x, y);
        vec2 neighborId = id + neighborOffset;
        
        float n = hash2(neighborId + seed);
        
        // Skip non-stars (lower threshold = more stars)
        if(n < 0.92) continue;
        
        // Star position offset within its cell
        vec2 starOffset = vec2(hash2(neighborId + seed + 10.0), hash2(neighborId + seed + 20.0)) - 0.5;
        starOffset *= 0.7;
        
        // Vector from current pixel to star center
        vec2 toStar = gv - neighborOffset - starOffset;
        float dist = length(toStar);
        
        // Star properties
        float starSize = smoothstep(0.92, 1.0, n) * 0.08 + 0.02;
        float twinkle = sin(u_time * (2.0 + n * 3.0) + n * 100.0) * 0.3 + 0.7;
        
        // Smooth Gaussian-like falloff - naturally fades to zero, no hard edges
        float star = exp(-dist * dist / (starSize * starSize)) * twinkle;
        
        // Star color
        vec3 starCol = mix(vec3(0.8, 0.85, 1.0), vec3(1.0, 0.9, 0.7), hash2(neighborId + seed + 50.0));
        
        col += starCol * star;
      }
    }
    
    return col * brightness;
  }
  
  // Shockwave ring
  float shockwave(vec2 uv, float time, float speed, float width) {
    float dist = length(uv);
    float radius = time * speed;
    float ring = smoothstep(radius - width, radius, dist) - smoothstep(radius, radius + width * 0.5, dist);
    ring *= smoothstep(3.0, 0.5, radius);
    return ring;
  }
  
  // Debris particles
  float particles(vec2 uv, float time) {
    float brightness = 0.0;
    
    for(int i = 0; i < 30; i++) {
      float fi = float(i);
      float angle = hash(fi) * TAU;
      float speed = 0.3 + hash(fi + 10.0) * 0.7;
      float size = 0.005 + hash(fi + 20.0) * 0.015;
      float startTime = hash(fi + 30.0) * 0.3;
      
      float t = max(0.0, time - startTime);
      float dist = t * speed;
      
      vec2 dir = vec2(cos(angle), sin(angle));
      vec2 pos = dir * dist;
      pos += dir.yx * vec2(1.0, -1.0) * sin(t * 3.0 + fi) * 0.05;
      
      float d = length(uv - pos);
      float particle = size / (d + 0.001);
      particle *= smoothstep(4.0, 0.0, dist);
      particle *= smoothstep(0.0, 0.1, t);
      
      brightness += particle * (0.5 + 0.5 * hash(fi + 50.0));
    }
    
    return brightness;
  }
  
  // Core glow
  vec3 coreGlow(vec2 uv, float time, float explosionT) {
    float dist = length(uv);
    
    float pulse = sin(time * 8.0) * 0.5 + 0.5;
    float preExplosion = (1.0 - smoothstep(0.0, 0.5, explosionT));
    float coreSize = 0.05 + pulse * 0.02 * preExplosion;
    
    coreSize += explosionT * 0.3;
    
    float intensity = coreSize / (dist + 0.01);
    intensity = pow(intensity, 1.5);
    intensity *= smoothstep(2.0, 0.0, explosionT);
    
    vec3 col = vec3(1.0);
    col = mix(col, vec3(1.0, 0.9, 0.5), smoothstep(0.0, 0.5, explosionT));
    col = mix(col, vec3(1.0, 0.5, 0.2), smoothstep(0.5, 2.0, explosionT));
    
    return col * intensity;
  }
  
  // Expanding nebula
  vec3 nebula(vec2 uv, float time) {
    float dist = length(uv);
    float angle = atan(uv.y, uv.x);
    
    float radius = time * 0.4;
    
    vec2 noiseCoord = uv * 2.0 - vec2(time * 0.1, 0.0);
    float n = fbm(noiseCoord + angle);
    n += fbm(noiseCoord * 2.0 - time * 0.05) * 0.5;
    
    float shell = smoothstep(radius - 0.3, radius, dist) - smoothstep(radius, radius + 0.5, dist);
    shell *= n;
    shell *= smoothstep(5.0, 1.0, radius);
    
    float inner = smoothstep(radius, 0.0, dist) * 0.3;
    inner *= smoothstep(3.0, 0.5, radius);
    
    float density = shell + inner;
    
    vec3 col = vec3(1.0, 0.4, 0.1);
    col = mix(col, vec3(0.9, 0.2, 0.3), smoothstep(0.0, 0.5, dist / max(radius, 0.1)));
    col = mix(col, vec3(0.5, 0.2, 0.8), smoothstep(0.3, 0.8, dist / max(radius, 0.1)));
    col = mix(col, vec3(0.2, 0.3, 0.9), smoothstep(0.7, 1.2, dist / max(radius, 0.1)));
    
    return col * density;
  }
  
  // Lens flare
  float flare(vec2 uv, float intensity) {
    float dist = length(uv);
    float f = 0.0;
    
    f += 0.1 / (dist + 0.1) * intensity;
    f += 0.05 / (abs(uv.y) * 10.0 + 0.1) * smoothstep(0.5, 0.0, abs(uv.x)) * intensity;
    
    for(int i = 0; i < 4; i++) {
      float fi = float(i);
      vec2 offset = uv * (1.5 + fi * 0.5);
      float d = length(offset);
      f += 0.02 / (d + 0.05) * intensity * (0.5 - fi * 0.1);
    }
    
    return f;
  }
  
  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
    vec2 mouse = (u_mouse - 0.5) * 0.3;
    
    // Cycle timing: 4s approach + 4s explosion = 8s total
    float cycle = mod(u_time, 8.0);
    float approachT = clamp(cycle / 4.0, 0.0, 1.0); // 0 to 1 during approach
    float explosionT = max(0.0, cycle - 4.0); // 0 to 4 during explosion
    float preExplosion = step(cycle, 4.0);
    
    // Zoom factor: starts far (0.3), zooms to close (1.0)
    float zoom = mix(0.2, 1.0, smoothstep(0.0, 1.0, approachT));
    
    // Apply zoom to UV
    vec2 zoomedUV = uv / zoom;
    
    // Background
    vec3 col = vec3(0.01, 0.005, 0.02);
    
    // Parallax star layers (different depths)
    // Far stars - move slower, smaller
    float starDim = mix(1.0, 0.3, smoothstep(0.0, 0.5, explosionT)); // Dim during explosion
    
    // Layer 1: Very far stars (barely move during zoom)
    vec2 layer1UV = uv / mix(0.5, 1.0, approachT * 0.2);
    col += starLayer(layer1UV + mouse * 0.1, 35.0, 0.3, 0.0) * starDim;
    
    // Layer 2: Far stars
    vec2 layer2UV = uv / mix(0.4, 1.0, approachT * 0.4);
    col += starLayer(layer2UV + mouse * 0.2, 28.0, 0.5, 100.0) * starDim;
    
    // Layer 3: Mid stars
    vec2 layer3UV = uv / mix(0.3, 1.0, approachT * 0.6);
    col += starLayer(layer3UV + mouse * 0.4, 22.0, 0.7, 200.0) * starDim;
    
    // Layer 4: Close stars (most parallax)
    vec2 layer4UV = uv / mix(0.25, 1.0, approachT * 0.9);
    col += starLayer(layer4UV + mouse * 0.6, 16.0, 0.9, 300.0) * starDim;
    
    // Layer 5: Closest stars (fly past during zoom)
    vec2 layer5UV = uv / mix(0.15, 1.0, approachT);
    col += starLayer(layer5UV + mouse * 0.8, 10.0, 1.0, 400.0) * starDim * smoothstep(1.0, 0.3, approachT);
    
    // Target star in distance (grows as we approach)
    float targetDist = length(zoomedUV - mouse);
    float targetSize = mix(0.003, 0.04, approachT);
    
    // Pulsing intensifies as we get closer
    float pulseSpeed = mix(2.0, 12.0, approachT);
    float pulse = sin(u_time * pulseSpeed) * 0.5 + 0.5;
    
    if(preExplosion > 0.5) {
      // Target star glow
      float targetGlow = targetSize / (targetDist + 0.005);
      targetGlow = pow(targetGlow, 1.3);
      
      // Base color shifts from blue-white to orange-white as we approach (heating up)
      vec3 starCol = mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.9, 0.7), approachT);
      col += starCol * targetGlow * (0.8 + pulse * 0.5);
      
      // Warning pulses in final approach
      float warningIntensity = smoothstep(0.5, 1.0, approachT);
      float warningPulse = sin(u_time * 25.0) * 0.5 + 0.5;
      col += vec3(1.0, 0.4, 0.2) * warningPulse * warningIntensity * targetGlow * 0.5;
      
      // Slight lens flare on approach
      col += vec3(0.9, 0.95, 1.0) * flare(zoomedUV - mouse, approachT * 0.3);
    }
    
    // Apply mouse offset to explosion center
    vec2 explosionUV = zoomedUV - mouse;
    
    // Explosion effects (after approach completes)
    if(explosionT > 0.0) {
      // Multiple shockwaves
      float shock1 = shockwave(explosionUV, explosionT, 0.8, 0.08);
      float shock2 = shockwave(explosionUV, explosionT - 0.2, 0.6, 0.05);
      float shock3 = shockwave(explosionUV, explosionT - 0.5, 0.4, 0.03);
      
      vec3 shockCol = vec3(0.5, 0.7, 1.0) * shock1;
      shockCol += vec3(0.8, 0.5, 1.0) * shock2;
      shockCol += vec3(1.0, 0.4, 0.6) * shock3;
      col += shockCol * 2.0;
      
      // Core glow
      col += coreGlow(explosionUV, u_time, explosionT);
      
      // Debris particles
      float debris = particles(explosionUV, explosionT);
      vec3 debrisCol = mix(vec3(1.0, 0.8, 0.4), vec3(1.0, 0.4, 0.2), smoothstep(0.0, 2.0, explosionT));
      col += debrisCol * debris * 0.5;
      
      // Expanding nebula
      col += nebula(explosionUV, explosionT) * smoothstep(0.0, 0.3, explosionT);
      
      // Lens flare during bright phase
      float flareIntensity = smoothstep(0.0, 0.2, explosionT) * smoothstep(2.0, 0.5, explosionT);
      col += vec3(1.0, 0.9, 0.8) * flare(explosionUV, flareIntensity) * 0.5;
      
      // Screen flash at explosion moment
      float flash = smoothstep(0.3, 0.0, explosionT);
      col += vec3(1.0, 0.95, 0.9) * flash * 2.0;
    }
    
    // Tone mapping
    col = 1.0 - exp(-col * 1.2);
    
    // Vignette
    float vig = 1.0 - length(uv) * 0.3;
    col *= vig;
    
    // Chromatic aberration during explosion
    if(explosionT > 0.0 && explosionT < 2.0) {
      float ca = smoothstep(2.0, 0.0, explosionT) * 0.02;
      col.r *= 1.0 + ca;
      col.b *= 1.0 - ca;
    }
    
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ============================================================================
// STAR EXPLOSION SHADER CLASS
// ============================================================================

class StarExplosionShader {
  /**
   * Default configuration
   */
  static defaults = {
    width: null,
    height: null,
    autoStart: true,
    dpr: 1.5, // Max device pixel ratio
  };

  /**
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    // Validate
    if (!options.ticker) {
      throw new Error('StarExplosionShader: options.ticker (PIXI.Ticker) is required');
    }
    if (!options.canvas && !options.container) {
      throw new Error('StarExplosionShader: options.canvas or options.container is required');
    }

    // Merge options
    this.options = { ...StarExplosionShader.defaults, ...options };
    this.ticker = this.options.ticker;

    // Internal state
    this._destroyed = false;
    this._running = false;
    this._startTime = 0;
    this._time = 0;

    // Mouse position (normalized 0-1)
    this._mouse = { x: 0.5, y: 0.5 };
    this._smoothMouse = { x: 0.5, y: 0.5 };

    // Bind update method
    this._boundUpdate = this._update.bind(this);

    // Setup
    this._setup();

    // Auto-start if configured
    if (this.options.autoStart) {
      this.start();
    }
  }

  /**
   * Setup canvas and WebGL context
   */
  _setup() {
    // Create or use existing canvas
    if (this.options.canvas) {
      this._canvas = this.options.canvas;
    } else {
      this._canvas = document.createElement('canvas');
      this._canvas.style.display = 'block';
      this.options.container.appendChild(this._canvas);
    }

    // Get WebGL context
    this._gl = this._canvas.getContext('webgl', {
      antialias: false,
      powerPreference: 'high-performance'
    });

    if (!this._gl) {
      throw new Error('StarExplosionShader: WebGL not supported');
    }

    // Compile shaders and create program
    this._createProgram();

    // Create geometry
    this._createGeometry();

    // Get uniform locations
    this._getUniformLocations();

    // Initial resize
    this._resize();
  }

  /**
   * Create shader program
   */
  _createProgram() {
    const gl = this._gl;

    // Vertex shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      throw new Error('Vertex shader error: ' + gl.getShaderInfoLog(vertexShader));
    }

    // Fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      throw new Error('Fragment shader error: ' + gl.getShaderInfoLog(fragmentShader));
    }

    // Program
    this._program = gl.createProgram();
    gl.attachShader(this._program, vertexShader);
    gl.attachShader(this._program, fragmentShader);
    gl.linkProgram(this._program);

    if (!gl.getProgramParameter(this._program, gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + gl.getProgramInfoLog(this._program));
    }

    gl.useProgram(this._program);

    // Store shader references for cleanup
    this._vertexShader = vertexShader;
    this._fragmentShader = fragmentShader;
  }

  /**
   * Create fullscreen quad geometry
   */
  _createGeometry() {
    const gl = this._gl;

    this._positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(this._program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  }

  /**
   * Get uniform locations
   */
  _getUniformLocations() {
    const gl = this._gl;
    this._uniforms = {
      resolution: gl.getUniformLocation(this._program, 'u_resolution'),
      time: gl.getUniformLocation(this._program, 'u_time'),
      mouse: gl.getUniformLocation(this._program, 'u_mouse'),
    };
  }

  /**
   * Resize canvas
   */
  _resize() {
    const dpr = Math.min(window.devicePixelRatio, this.options.dpr);
    const width = this.options.width ?? this._canvas.clientWidth;
    const height = this.options.height ?? this._canvas.clientHeight;

    this._canvas.width = width * dpr;
    this._canvas.height = height * dpr;
    this._gl.viewport(0, 0, this._canvas.width, this._canvas.height);
  }

  /**
   * Update loop - called by ticker
   */
  _update() {
    if (this._destroyed || !this._running) return;

    const gl = this._gl;

    // Update time
    this._time = (performance.now() - this._startTime) * 0.001;

    // Smooth mouse interpolation
    this._smoothMouse.x += (this._mouse.x - this._smoothMouse.x) * 0.05;
    this._smoothMouse.y += (this._mouse.y - this._smoothMouse.y) * 0.05;

    // Update uniforms
    gl.uniform2f(this._uniforms.resolution, this._canvas.width, this._canvas.height);
    gl.uniform1f(this._uniforms.time, this._time);
    gl.uniform2f(this._uniforms.mouse, this._smoothMouse.x, this._smoothMouse.y);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /**
   * Start animation
   */
  start() {
    if (this._destroyed || this._running) return this;

    this._running = true;
    this._startTime = performance.now();
    this.ticker.add(this._boundUpdate);

    return this;
  }

  /**
   * Stop animation
   */
  stop() {
    if (!this._running) return this;

    this._running = false;
    this.ticker.remove(this._boundUpdate);

    return this;
  }

  /**
   * Set mouse position (normalized 0-1)
   * @param {number} x - X position (0 = left, 1 = right)
   * @param {number} y - Y position (0 = bottom, 1 = top)
   */
  setMouse(x, y) {
    this._mouse.x = x;
    this._mouse.y = y;
    return this;
  }

  /**
   * Resize the effect
   * @param {number} [width] - New width (optional)
   * @param {number} [height] - New height (optional)
   */
  resize(width, height) {
    if (width !== undefined) this.options.width = width;
    if (height !== undefined) this.options.height = height;
    this._resize();
    return this;
  }

  /**
   * Get canvas element
   */
  get canvas() {
    return this._canvas;
  }

  /**
   * Get current time
   */
  get time() {
    return this._time;
  }

  /**
   * Get running state
   */
  get isRunning() {
    return this._running;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    // Stop animation
    this.stop();

    const gl = this._gl;

    // Delete WebGL resources
    if (this._positionBuffer) {
      gl.deleteBuffer(this._positionBuffer);
    }
    if (this._program) {
      gl.deleteProgram(this._program);
    }
    if (this._vertexShader) {
      gl.deleteShader(this._vertexShader);
    }
    if (this._fragmentShader) {
      gl.deleteShader(this._fragmentShader);
    }

    // Remove canvas if we created it
    if (!this.options.canvas && this._canvas.parentNode) {
      this._canvas.parentNode.removeChild(this._canvas);
    }

    // Nullify references
    this._canvas = null;
    this._gl = null;
    this._program = null;
    this._uniforms = null;
    this._boundUpdate = null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { StarExplosionShader, vertexShaderSource, fragmentShaderSource };
export default StarExplosionShader;