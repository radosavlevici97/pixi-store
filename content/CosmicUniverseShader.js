/**
 * CosmicUniverseShader - Full-screen cosmic scene with galaxies, planets, and sun
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
  precision highp float;
  
  uniform vec2 u_resolution;
  uniform float u_time;
  
  #define PI 3.14159265359
  #define TAU 6.28318530718
  
  // ============================================
  // NOISE FUNCTIONS
  // ============================================
  
  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  
  float noise(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float n = p.x + p.y * 157.0 + 113.0 * p.z;
    return mix(
      mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
          mix(hash(n + 157.0), hash(n + 158.0), f.x), f.y),
      mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
          mix(hash(n + 270.0), hash(n + 271.0), f.x), f.y),
      f.z
    );
  }
  
  float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
               mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  
  float fbm(vec3 p) {
    float f = 0.0;
    float amp = 0.5;
    for(int i = 0; i < 5; i++) {
      f += amp * noise(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return f;
  }
  
  float fbm2D(vec2 p) {
    float f = 0.0;
    float amp = 0.5;
    for(int i = 0; i < 6; i++) {
      f += amp * noise2D(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return f;
  }
  
  // ============================================
  // SPHERE INTERSECTION
  // ============================================
  
  vec2 sphereIntersect(vec3 ro, vec3 rd, float r) {
    float b = dot(ro, rd);
    float c = dot(ro, ro) - r * r;
    float h = b * b - c;
    if(h < 0.0) return vec2(-1.0);
    h = sqrt(h);
    return vec2(-b - h, -b + h);
  }
  
  // ============================================
  // REALISTIC SPIRAL GALAXY
  // ============================================
  
  vec3 renderGalaxy(vec2 uv, vec2 center, float size, float rotation, float tilt, float time, vec3 coreColor, vec3 armColor) {
    vec2 p = (uv - center) / size;
    p.y /= mix(0.25, 1.0, tilt);
    
    float r = length(p);
    float angle = atan(p.y, p.x);
    
    if(r > 1.8) return vec3(0.0);
    
    vec3 col = vec3(0.0);
    
    float core = exp(-r * r * 15.0);
    col += coreColor * core * 2.0;
    
    float coreGlow = exp(-r * r * 5.0);
    col += coreColor * 0.6 * coreGlow * 0.7;
    
    for(float arm = 0.0; arm < 2.0; arm++) {
      float armOffset = arm * PI;
      float spiralAngle = angle + rotation + armOffset;
      
      for(float wrap = -2.0; wrap <= 2.0; wrap++) {
        float wrapAngle = spiralAngle + wrap * TAU;
        float expR = 0.08 * exp(wrapAngle / 3.0);
        
        if(expR > 0.01 && expR < 1.6) {
          float dist = abs(r - expR);
          float armWidth = 0.35;
          float armFalloff = exp(-dist * dist / (armWidth * armWidth * expR * 0.5));
          float armIntensity = exp(-expR * 1.0) * armFalloff;
          
          float clumps = noise2D(vec2(wrapAngle * 5.0, expR * 20.0) + time * 0.03);
          clumps = pow(clumps, 2.0);
          
          float dust = noise2D(vec2(wrapAngle * 8.0, expR * 30.0));
          dust = smoothstep(0.4, 0.6, dust) * 0.4;
          
          vec3 armCol = mix(armColor, coreColor, exp(-expR * 2.0));
          armCol *= (1.0 - dust * 0.5);
          
          float knots = pow(clumps, 3.0) * 2.5;
          armCol += vec3(0.8, 0.85, 1.0) * knots * armIntensity;
          
          col += armCol * armIntensity * (0.5 + clumps * 0.5);
        }
      }
    }
    
    float halo = exp(-r * 2.5) * 0.12;
    col += coreColor * 0.35 * halo;
    
    vec2 starUV = p * 60.0;
    vec2 starId = floor(starUV);
    vec2 starF = fract(starUV) - 0.5;
    float starRand = hash2(starId + center * 100.0);
    if(starRand > 0.9 && r < 1.3) {
      float starD = length(starF);
      float star = exp(-starD * starD * 25.0) * (starRand - 0.9) * 10.0;
      star *= exp(-r * 1.2);
      col += vec3(1.0, 0.95, 0.9) * star;
    }
    
    return col;
  }
  
  // ============================================
  // NEBULA
  // ============================================
  
  vec3 renderNebula(vec2 uv, float time) {
    vec3 col = vec3(0.008, 0.004, 0.015);
    
    float n1 = fbm2D(uv * 1.2 + time * 0.003);
    float n2 = fbm2D(uv * 2.0 + vec2(50.0, 0.0) + time * 0.002);
    float n3 = fbm2D(uv * 0.8 + vec2(0.0, 80.0) + time * 0.004);
    float n4 = fbm2D(uv * 3.0 + vec2(30.0, 60.0) + time * 0.002);
    
    col += vec3(0.08, 0.02, 0.12) * n1 * n1 * 1.5;
    col += vec3(0.02, 0.05, 0.1) * n2 * n2;
    col += vec3(0.1, 0.03, 0.06) * n3 * n3;
    col += vec3(0.03, 0.06, 0.12) * n4 * n4 * 0.8;
    
    float emission = fbm2D(uv * 1.5 + time * 0.001);
    emission = smoothstep(0.5, 0.8, emission);
    col += vec3(0.15, 0.05, 0.08) * emission * 0.4;
    
    return col;
  }
  
  // ============================================
  // STARS
  // ============================================
  
  vec3 renderStars(vec2 uv, float time) {
    vec3 col = vec3(0.0);
    vec2 center = vec2(0.5, 0.5);
    
    // Warp speed stars
    for(int layer = 0; layer < 4; layer++) {
      float layerSpeed = 0.2 + float(layer) * 0.1;
      float layerDepth = float(layer) + 1.0;
      
      for(int i = 0; i < 50; i++) {
        float idx = float(i) + float(layer) * 50.0;
        
        vec2 starOrigin = vec2(
          hash(idx * 13.7),
          hash(idx * 29.3 + 100.0)
        );
        
        float starTime = fract(time * layerSpeed * 0.2 + hash(idx * 7.1));
        
        vec2 dir = normalize(starOrigin - center);
        float dist = starTime * starTime * 1.2;
        vec2 starPos = center + dir * dist;
        
        if(starPos.x < -0.1 || starPos.x > 1.1 || starPos.y < -0.1 || starPos.y > 1.1) continue;
        
        float d = length(uv - starPos);
        float size = 0.0006 + starTime * 0.004 / layerDepth;
        float brightness = starTime * starTime * 1.5;
        
        if(d < size * 5.0) {
          float glow = exp(-d * d / (size * size) * 1.2);
          vec3 starCol = mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.95, 0.9), hash(idx * 3.3));
          col += starCol * glow * brightness / layerDepth;
        }
        
        if(starTime > 0.5) {
          vec2 trailDir = normalize(starPos - center);
          float trailLen = starTime * 0.03;
          for(int t = 0; t < 3; t++) {
            vec2 trailPos = starPos - trailDir * float(t) * trailLen * 0.3;
            float td = length(uv - trailPos);
            float trailGlow = exp(-td * td / (size * size * 0.3)) * (1.0 - float(t) / 3.0);
            col += vec3(0.7, 0.8, 1.0) * trailGlow * brightness * 0.2 / layerDepth;
          }
        }
      }
    }
    
    // Static stars
    for(int layer = 0; layer < 5; layer++) {
      float layerScale = 80.0 + float(layer) * 60.0;
      float layerBright = 1.0 - float(layer) * 0.15;
      
      vec2 starUV = uv * layerScale;
      vec2 id = floor(starUV);
      vec2 fd = fract(starUV) - 0.5;
      
      float star = hash2(id + float(layer) * 100.0);
      float threshold = 0.9 - float(layer) * 0.03;
      
      if(star > threshold) {
        float brightness = (star - threshold) * (1.0 / (1.0 - threshold)) * 12.0 * layerBright;
        float d = length(fd);
        float glow = exp(-d * d * 30.0);
        float twinkle = 0.6 + 0.4 * sin(time * (1.0 + hash2(id) * 2.0) + hash2(id) * TAU);
        
        vec3 starCol = mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.9, 0.8), hash2(id * 2.0));
        if(hash2(id * 5.0) > 0.95) starCol = vec3(1.0, 0.6, 0.4);
        if(hash2(id * 7.0) > 0.97) starCol = vec3(0.6, 0.7, 1.0);
        
        col += starCol * glow * brightness * twinkle * 0.5;
      }
    }
    
    return col;
  }
  
  // ============================================
  // THE SUN - FULL DETAIL
  // ============================================
  
  vec3 renderSun(vec3 ro, vec3 rd, vec3 center, float radius, float time) {
    vec3 sRo = ro - center;
    vec3 col = vec3(0.0);
    
    vec2 hit = sphereIntersect(sRo, rd, radius);
    
    float tClosest = -dot(sRo, rd);
    vec3 closest = sRo + rd * max(tClosest, 0.0);
    float d = length(closest);
    
    // MASSIVE CORONA
    float corona1 = exp(-d / radius * 0.4) * 0.5;
    col += vec3(1.0, 0.5, 0.15) * corona1;
    
    float corona2 = exp(-d / radius * 0.7) * 0.7;
    col += vec3(1.0, 0.65, 0.25) * corona2;
    
    float corona3 = exp(-d / radius * 1.2) * 1.0;
    col += vec3(1.0, 0.8, 0.4) * corona3;
    
    float innerGlow = exp(-d / radius * 2.5) * 2.0;
    col += vec3(1.0, 0.92, 0.7) * innerGlow;
    
    float coreGlow = exp(-d / radius * 5.0) * 3.0;
    col += vec3(1.0, 0.98, 0.9) * coreGlow;
    
    // Solar flares
    if(d > radius * 0.8 && d < radius * 3.0) {
      float flareAngle = atan(closest.y, closest.x);
      
      for(int i = 0; i < 5; i++) {
        float flareOffset = float(i) * 1.3 + time * 0.1;
        float flareNoise = noise(vec3(flareAngle * 2.0 + flareOffset, d * 2.0, time * 0.3 + float(i)));
        
        if(flareNoise > 0.55) {
          float flare = (flareNoise - 0.55) * 2.2;
          flare *= exp(-(d - radius) / radius * 1.5);
          flare *= smoothstep(radius * 3.0, radius * 1.5, d);
          col += vec3(1.0, 0.6, 0.2) * flare * 0.6;
        }
      }
    }
    
    // Coronal streamers
    float streamerAngle = atan(closest.y, closest.x);
    float streamers = sin(streamerAngle * 8.0 + time * 0.2) * 0.5 + 0.5;
    streamers *= exp(-d / radius * 0.8) * 0.3;
    col += vec3(1.0, 0.7, 0.3) * streamers;
    
    // Surface
    if(hit.x > 0.0) {
      vec3 pos = sRo + rd * hit.x;
      vec3 normal = normalize(pos);
      
      float granules1 = fbm(pos / radius * 15.0 + time * 0.5);
      float granules2 = fbm(pos / radius * 30.0 - time * 0.3);
      float granules3 = fbm(pos / radius * 8.0 + time * 0.2);
      
      vec3 surfaceCol = vec3(1.0, 0.97, 0.8);
      surfaceCol = mix(surfaceCol, vec3(1.0, 0.85, 0.5), granules1 * 0.4);
      surfaceCol = mix(surfaceCol, vec3(1.0, 0.7, 0.3), granules2 * 0.25);
      surfaceCol = mix(surfaceCol, vec3(1.0, 0.6, 0.2), granules3 * 0.15);
      
      float spots = fbm(pos / radius * 4.0 + time * 0.015);
      float spots2 = fbm(pos / radius * 6.0 - time * 0.02);
      spots = smoothstep(0.58, 0.75, spots) * smoothstep(0.5, 0.65, spots2);
      surfaceCol = mix(surfaceCol, vec3(0.4, 0.2, 0.05), spots * 0.7);
      
      float faculae = fbm(pos / radius * 12.0 + time * 0.1);
      faculae = smoothstep(0.6, 0.8, faculae) * (1.0 - spots);
      surfaceCol = mix(surfaceCol, vec3(1.0, 1.0, 0.95), faculae * 0.3);
      
      float limb = dot(normal, -rd);
      float limbDarkening = 0.4 + 0.6 * pow(limb, 0.6);
      surfaceCol *= limbDarkening;
      
      surfaceCol = mix(surfaceCol, surfaceCol * vec3(1.0, 0.7, 0.4), (1.0 - limb) * 0.4);
      
      col = surfaceCol * 3.0;
    }
    
    return col;
  }
  
  // ============================================
  // SATURN
  // ============================================
  
  vec3 renderSaturn(vec3 ro, vec3 rd, vec3 center, float radius, float time, vec3 lightDir) {
    vec3 sRo = ro - center;
    vec3 col = vec3(-1.0);
    
    float ringTilt = 0.4;
    vec3 ringNormal = normalize(vec3(0.0, 1.0, ringTilt));
    float denom = dot(rd, ringNormal);
    
    float ringT = -1.0;
    
    if(abs(denom) > 0.001) {
      float t = -dot(sRo, ringNormal) / denom;
      if(t > 0.0) {
        vec3 ringPos = sRo + rd * t;
        float ringR = length(vec2(ringPos.x, ringPos.z));
        
        float ringInner = radius * 1.25;
        float ringOuter = radius * 2.4;
        
        if(ringR > ringInner && ringR < ringOuter) {
          ringT = t;
          float ringU = (ringR - ringInner) / (ringOuter - ringInner);
          
          float ringBands = sin(ringU * 90.0) * 0.5 + 0.5;
          ringBands *= sin(ringU * 40.0 + 0.3) * 0.5 + 0.5;
          
          float cassini = smoothstep(0.48, 0.5, ringU) * smoothstep(0.55, 0.53, ringU);
          ringBands *= (1.0 - cassini * 0.8);
          
          vec3 ringCol = mix(vec3(0.85, 0.78, 0.68), vec3(0.65, 0.58, 0.52), ringU);
          ringCol = mix(ringCol, vec3(0.75, 0.68, 0.6), ringBands);
          
          float ringLight = 0.4 + 0.6 * max(dot(ringNormal, lightDir), 0.0);
          
          col = ringCol * ringLight * (0.5 + ringBands * 0.5);
        }
      }
    }
    
    vec2 hit = sphereIntersect(sRo, rd, radius);
    
    if(hit.x > 0.0 && (ringT < 0.0 || hit.x < ringT)) {
      vec3 pos = sRo + rd * hit.x;
      vec3 normal = normalize(pos);
      
      float rot = time * 0.04;
      vec3 rotPos = vec3(pos.x * cos(rot) - pos.z * sin(rot), pos.y, pos.x * sin(rot) + pos.z * cos(rot));
      vec3 nPos = rotPos / radius;
      
      float bands = sin(nPos.y * 25.0) * 0.5 + 0.5;
      float n = noise(nPos * 8.0 + time * 0.02);
      bands = bands * 0.7 + n * 0.3;
      
      vec3 saturnCol = mix(vec3(0.95, 0.9, 0.75), vec3(0.85, 0.75, 0.55), bands);
      
      float diff = max(dot(normal, lightDir), 0.0);
      saturnCol *= diff * 0.8 + 0.15;
      
      col = saturnCol;
    }
    
    return col;
  }
  
  // ============================================
  // SMALL PLANET
  // ============================================
  
  vec3 renderPlanet(vec3 ro, vec3 rd, vec3 center, float radius, vec3 baseColor, vec3 lightDir, float time) {
    vec3 pRo = ro - center;
    vec2 hit = sphereIntersect(pRo, rd, radius);
    
    if(hit.x < 0.0) return vec3(-1.0);
    
    vec3 pos = pRo + rd * hit.x;
    vec3 normal = normalize(pos);
    
    float n = noise(pos / radius * 5.0 + time * 0.01);
    vec3 col = mix(baseColor * 0.8, baseColor * 1.2, n);
    
    float diff = max(dot(normal, lightDir), 0.0);
    col *= diff * 0.8 + 0.15;
    
    return col;
  }
  
  // ============================================
  // MAIN
  // ============================================
  
  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
    
    float time = u_time;
    
    // AUTO-ANIMATED CAMERA - no mouse control
    float camDist = 14.0;
    float camAngle = time * 0.08; // Smooth rotation around scene
    float camHeight = sin(time * 0.05) * 2.0 + 1.5; // Gentle up/down motion
    
    vec3 ro = vec3(sin(camAngle) * camDist, camHeight, cos(camAngle) * camDist);
    vec3 ta = vec3(0.0, 0.0, 0.0); // Look at center
    
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = normalize(cross(uu, ww));
    vec3 rd = normalize(p.x * uu + p.y * vv + 1.3 * ww);
    
    // Sun positioned so it's visible during orbit
    vec3 sunPos = vec3(8.0, 2.0, 0.0);
    vec3 lightDir = normalize(sunPos);
    
    // Background
    vec3 col = renderNebula(uv, time);
    col += renderStars(uv, time);
    
    // Galaxies
    col += renderGalaxy(uv, vec2(0.12, 0.78), 0.14, time * 0.015, 0.45, time,
      vec3(1.0, 0.9, 0.7), vec3(0.6, 0.7, 1.0));
    
    col += renderGalaxy(uv, vec2(0.85, 0.15), 0.1, time * 0.012 + 1.0, 0.12, time,
      vec3(1.0, 0.85, 0.6), vec3(0.5, 0.6, 0.9));
    
    col += renderGalaxy(uv, vec2(0.78, 0.82), 0.08, time * 0.02 + 2.5, 0.9, time,
      vec3(1.0, 0.95, 0.8), vec3(0.7, 0.75, 1.0));
    
    col += renderGalaxy(uv, vec2(0.25, 0.2), 0.07, time * 0.018 + 4.0, 0.55, time,
      vec3(0.95, 0.85, 0.65), vec3(0.55, 0.6, 0.85));
    
    col += renderGalaxy(uv, vec2(0.92, 0.5), 0.045, time * 0.01 + 3.0, 0.5, time,
      vec3(1.0, 0.88, 0.65), vec3(0.55, 0.6, 0.85)) * 0.7;
    
    col += renderGalaxy(uv, vec2(0.5, 0.92), 0.05, time * 0.022 + 5.0, 0.7, time,
      vec3(0.95, 0.9, 0.75), vec3(0.6, 0.65, 0.9)) * 0.7;
    
    col += renderGalaxy(uv, vec2(0.08, 0.45), 0.04, time * 0.014 + 6.0, 0.3, time,
      vec3(1.0, 0.9, 0.7), vec3(0.5, 0.55, 0.8)) * 0.6;
    
    col += renderGalaxy(uv, vec2(0.4, 0.08), 0.035, time * 0.016 + 7.0, 0.65, time,
      vec3(0.9, 0.85, 0.7), vec3(0.6, 0.65, 0.9)) * 0.5;
    
    // THE SUN
    col += renderSun(ro, rd, sunPos, 2.0, time);
    
    // Saturn at center
    vec3 saturnPos = vec3(0.0, 0.0, 0.0);
    float saturnRadius = 1.0;
    
    // Other planets orbiting
    float orbitTime = time * 0.15;
    vec3 planet1Pos = vec3(sin(orbitTime * 0.7) * 5.0, 0.3, cos(orbitTime * 0.7) * 5.0);
    vec3 planet2Pos = vec3(sin(orbitTime * 0.5 + 2.0) * 6.5, -0.2, cos(orbitTime * 0.5 + 2.0) * 6.5);
    vec3 planet3Pos = vec3(sin(orbitTime * 0.3 + 4.0) * 8.0, 0.1, cos(orbitTime * 0.3 + 4.0) * 8.0);
    
    vec3 planet1Col = renderPlanet(ro, rd, planet1Pos, 0.4, vec3(0.3, 0.5, 0.9), lightDir, time);
    vec3 planet2Col = renderPlanet(ro, rd, planet2Pos, 0.35, vec3(0.5, 0.8, 0.85), lightDir, time);
    vec3 planet3Col = renderPlanet(ro, rd, planet3Pos, 0.45, vec3(0.7, 0.5, 0.4), lightDir, time);
    
    if(planet1Col.x >= 0.0) col = planet1Col;
    if(planet2Col.x >= 0.0) col = planet2Col;
    if(planet3Col.x >= 0.0) col = planet3Col;
    
    // Saturn
    vec3 saturnCol = renderSaturn(ro, rd, saturnPos, saturnRadius, time, lightDir);
    if(saturnCol.x >= 0.0) col = saturnCol;
    
    // Vignette
    float vig = 1.0 - dot(uv - 0.5, uv - 0.5) * 0.3;
    col *= vig;
    
    // Tone mapping
    col = col / (1.0 + col);
    col = pow(col, vec3(0.9));
    
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ============================================================================
// COSMIC UNIVERSE SHADER CLASS
// ============================================================================

class CosmicUniverseShader {
  /**
   * Default configuration
   */
  static defaults = {
    width: null,
    height: null,
    autoStart: true,
  };

  /**
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    // Validate
    if (!options.ticker) {
      throw new Error('CosmicUniverseShader: options.ticker (PIXI.Ticker) is required');
    }
    if (!options.canvas && !options.container) {
      throw new Error('CosmicUniverseShader: options.canvas or options.container is required');
    }

    // Merge options
    this.options = { ...CosmicUniverseShader.defaults, ...options };
    this.ticker = this.options.ticker;

    // Internal state
    this._destroyed = false;
    this._running = false;
    this._startTime = 0;
    this._time = 0;

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
    this._gl = this._canvas.getContext('webgl');

    if (!this._gl) {
      throw new Error('CosmicUniverseShader: WebGL not supported');
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
    };
  }

  /**
   * Resize canvas
   */
  _resize() {
    const width = this.options.width ?? this._canvas.clientWidth ?? window.innerWidth;
    const height = this.options.height ?? this._canvas.clientHeight ?? window.innerHeight;

    this._canvas.width = width;
    this._canvas.height = height;
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

    // Update uniforms
    gl.uniform2f(this._uniforms.resolution, this._canvas.width, this._canvas.height);
    gl.uniform1f(this._uniforms.time, this._time);

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

export { CosmicUniverseShader, vertexShaderSource, fragmentShaderSource };
export default CosmicUniverseShader;
