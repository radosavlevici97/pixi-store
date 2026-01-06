/**
 * CosmicShader - Volumetric cosmic nebula with parallax stars
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
  
  // Optimized hash
  float hash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
  
  // Optimized 3D noise
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float n = i.x + i.y * 157.0 + 113.0 * i.z;
    
    vec4 h = vec4(n, n + 1.0, n + 157.0, n + 158.0);
    vec4 h2 = h + 113.0;
    
    h = fract(sin(h) * 43758.5453);
    h2 = fract(sin(h2) * 43758.5453);
    
    float a = mix(mix(h.x, h.y, f.x), mix(h.z, h.w, f.x), f.y);
    float b = mix(mix(h2.x, h2.y, f.x), mix(h2.z, h2.w, f.x), f.y);
    
    return mix(a, b, f.z);
  }
  
  // Simplified FBM - only 4 octaves
  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    
    value += amplitude * noise(p); p *= 2.0; amplitude *= 0.5;
    value += amplitude * noise(p); p *= 2.0; amplitude *= 0.5;
    value += amplitude * noise(p); p *= 2.0; amplitude *= 0.5;
    value += amplitude * noise(p);
    
    return value;
  }
  
  // Simplified warping - single layer
  float warpedFbm(vec3 p) {
    vec3 q = vec3(
      fbm(p),
      fbm(p + vec3(5.2, 1.3, 2.8)),
      fbm(p + vec3(2.1, 7.9, 4.6))
    );
    
    return fbm(p + 2.0 * q + vec3(0.0, 0.0, u_time * 0.08));
  }
  
  // Star field
  float stars(vec2 uv) {
    vec2 id = floor(uv * 100.0);
    vec2 gv = fract(uv * 100.0) - 0.5;
    
    float n = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
    float twinkle = sin(u_time * 2.0 + n * 6.28) * 0.5 + 0.5;
    
    float star = smoothstep(0.1, 0.0, length(gv)) * step(0.92, n) * twinkle;
    return star;
  }
  
  // Color palette
  vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.0, 0.33, 0.67);
    return a + b * cos(6.28318 * (c * t + d));
  }
  
  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
    vec2 mouse = (u_mouse - 0.5) * 2.0;
    
    // Camera rotation
    float angleY = mouse.x * PI * 0.5 + u_time * 0.08;
    float angleX = mouse.y * PI * 0.2;
    
    float cy = cos(angleY), sy = sin(angleY);
    float cx = cos(angleX), sx = sin(angleX);
    
    vec3 rd = normalize(vec3(uv, 1.2));
    rd = vec3(rd.x * cy + rd.z * sy, rd.y * cx - rd.z * sx, -rd.x * sy + rd.z * cy);
    rd.yz = vec2(rd.y * cx + rd.z * sx, -rd.y * sx + rd.z * cx);
    
    vec3 ro = vec3(0.0, 0.0, -4.0);
    
    // Background stars
    vec3 col = vec3(0.02, 0.01, 0.04);
    col += stars(uv + mouse * 0.1) * vec3(0.9, 0.95, 1.0);
    col += stars(uv * 1.3 + 0.5) * vec3(1.0, 0.85, 0.7) * 0.6;
    
    // Volumetric raymarching - optimized
    vec3 nebulaCol = vec3(0.0);
    float totalDensity = 0.0;
    
    vec3 p = ro + rd * 1.0;
    float stepSize = 0.25;
    
    for(int i = 0; i < 40; i++) {
      vec3 samplePos = p * 0.4;
      float n = warpedFbm(samplePos);
      float d = max(0.0, n - 0.35);
      
      // Distance falloff
      float dist = length(p);
      d *= smoothstep(12.0, 3.0, dist);
      
      if(d > 0.01) {
        vec3 localCol = palette(n * 0.8 + length(samplePos) * 0.1);
        localCol = mix(localCol, vec3(0.8, 0.3, 0.6), n * 0.5);
        
        float light = d * (1.0 - totalDensity) * 2.5;
        nebulaCol += localCol * light * stepSize;
        totalDensity += d * stepSize * 1.5;
        
        if(totalDensity > 0.9) break;
      }
      
      p += rd * stepSize;
      if(length(p) > 15.0) break;
    }
    
    // Combine
    col = mix(col, nebulaCol, smoothstep(0.0, 0.3, totalDensity));
    col += nebulaCol * 0.4;
    
    // Central glow
    col += vec3(0.3, 0.15, 0.5) * exp(-length(uv) * 2.5) * 0.4;
    
    // Simple tone mapping
    col = 1.0 - exp(-col * 1.5);
    
    // Vignette
    col *= 1.0 - length(uv) * 0.4;
    
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ============================================================================
// COSMIC SHADER CLASS
// ============================================================================

class CosmicShader {
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
      throw new Error('CosmicShader: options.ticker (PIXI.Ticker) is required');
    }
    if (!options.canvas && !options.container) {
      throw new Error('CosmicShader: options.canvas or options.container is required');
    }

    // Merge options
    this.options = { ...CosmicShader.defaults, ...options };
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
      throw new Error('CosmicShader: WebGL not supported');
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

    // Smooth mouse interpolation (original used 0.08)
    this._smoothMouse.x += (this._mouse.x - this._smoothMouse.x) * 0.08;
    this._smoothMouse.y += (this._mouse.y - this._smoothMouse.y) * 0.08;

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

export { CosmicShader, vertexShaderSource, fragmentShaderSource };
export default CosmicShader;
