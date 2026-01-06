/**
 * JupiterImpactShader - Full-screen Jupiter impact with meteorite and moons
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
  uniform vec2 u_mouse;
  
  #define PI 3.14159265359
  #define TAU 6.28318530718
  
  // Noise functions
  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec3 hash3(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453123);
  }
  
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
  
  // Impact timing - VERY FAST
  float getCycleTime() { return 8.0; }
  float getApproachDuration() { return 0.7; } // Super fast - 0.7 seconds
  float getExplosionDuration() { return 5.0; }
  
  float getImpactCycle(float time) {
    return mod(time, getCycleTime());
  }
  
  float getApproachProgress(float time) {
    float cycle = getImpactCycle(time);
    return clamp(cycle / getApproachDuration(), 0.0, 1.0);
  }
  
  float getExplosionTime(float time) {
    float cycle = getImpactCycle(time);
    return cycle - getApproachDuration();
  }
  
  // Camera setup
  vec3 getCameraPos(float time, vec2 mouse) {
    float camDist = 4.0;
    float camAngle = time * 0.02 + mouse.x * 0.2;
    float camHeight = 0.2 + mouse.y * 0.2;
    return vec3(sin(camAngle) * camDist, camHeight, cos(camAngle) * camDist);
  }
  
  // Impact point on Jupiter's surface
  vec3 getImpactPoint(vec3 camPos) {
    vec3 toCamera = normalize(camPos);
    vec3 offset = normalize(cross(toCamera, vec3(0.0, 1.0, 0.0))) * 0.15;
    offset.y += 0.08;
    return normalize(toCamera * 0.9 + offset);
  }
  
  // Meteorite position - VERY FAST approach
  vec3 getMeteoritePos(float time, vec3 camPos, vec3 impactPoint) {
    float progress = getApproachProgress(time);
    if(progress >= 1.0) return impactPoint;
    
    // Start close to camera
    vec3 camDir = normalize(-camPos);
    vec3 startPos = camPos + camDir * 0.5;
    startPos += vec3(0.1, 0.25, 0.0);
    
    vec3 endPos = impactPoint;
    
    // Very fast acceleration
    float t = pow(progress, 0.5);
    
    return mix(startPos, endPos, t);
  }
  
  // 10x PARALLAX - huge when close, small at Jupiter
  float getMeteoriteRadius(vec3 meteorPos, vec3 camPos) {
    float dist = length(meteorPos - camPos);
    float baseRadius = 0.03;
    // 10x scale factor
    float scale = 10.0 / max(dist, 0.3);
    return baseRadius * min(scale, 12.0);
  }
  
  // Jupiter's turbulent bands
  float jupiterBands(vec3 p, float time) {
    float lat = p.y;
    float lon = atan(p.z, p.x);
    
    float bands = sin(lat * 18.0) * 0.5 + 0.5;
    bands = pow(bands, 0.7);
    
    float turb = fbm(vec3(lon * 3.0 + time * 0.02, lat * 8.0, time * 0.05)) * 0.3;
    float storm = fbm(vec3(p.x * 4.0 + time * 0.03, p.y * 10.0 + sin(lon * 2.0) * 0.5, p.z * 4.0));
    
    return bands + turb + storm * 0.2;
  }
  
  // Great Red Spot
  float greatRedSpot(vec3 p, float time) {
    float lon = atan(p.z, p.x) + time * 0.015;
    float lat = p.y;
    
    vec2 spotCenter = vec2(-0.3, -0.22);
    vec2 pos = vec2(mod(lon + PI, TAU) - PI, lat);
    
    float dist = length((pos - spotCenter) * vec2(1.0, 2.0));
    float spot = smoothstep(0.4, 0.1, dist);
    float swirl = fbm(vec3(pos * 10.0 + time * 0.1, time * 0.2)) * spot;
    
    return spot + swirl * 0.5;
  }
  
  // Jupiter color palette
  vec3 jupiterColor(float bands, float spot, vec3 p, float time) {
    vec3 cream = vec3(0.96, 0.91, 0.78);
    vec3 tan = vec3(0.85, 0.72, 0.55);
    vec3 brown = vec3(0.65, 0.45, 0.30);
    vec3 darkBrown = vec3(0.45, 0.30, 0.20);
    vec3 orange = vec3(0.90, 0.55, 0.30);
    vec3 red = vec3(0.85, 0.35, 0.25);
    
    vec3 col = mix(cream, tan, smoothstep(0.3, 0.5, bands));
    col = mix(col, brown, smoothstep(0.5, 0.7, bands));
    col = mix(col, darkBrown, smoothstep(0.7, 0.85, bands));
    
    float variation = fbm(vec3(p.x * 8.0 + time * 0.02, p.y * 15.0, p.z * 8.0));
    col = mix(col, orange, variation * 0.3 * (1.0 - bands));
    
    vec3 spotColor = mix(orange, red, spot * 0.5 + variation * 0.3);
    col = mix(col, spotColor, spot * 0.8);
    
    return col;
  }
  
  // Sphere ray intersection
  vec2 sphereIntersect(vec3 ro, vec3 rd, float r) {
    float b = dot(ro, rd);
    float c = dot(ro, ro) - r * r;
    float h = b * b - c;
    if(h < 0.0) return vec2(-1.0);
    h = sqrt(h);
    return vec2(-b - h, -b + h);
  }
  
  // FIRE TRAIL with parallax
  vec3 renderFireTrail(vec3 ro, vec3 rd, vec3 meteorPos, vec3 velocity, float time, float approachProgress, vec3 camPos) {
    if(approachProgress >= 1.0) return vec3(0.0);
    
    vec3 col = vec3(0.0);
    vec3 velDir = normalize(velocity);
    
    float distToCam = length(meteorPos - camPos);
    float trailLength = 0.2 + approachProgress * 0.4;
    trailLength *= min(distToCam * 1.2, 3.0);
    
    for(int i = 0; i < 50; i++) {
      float fi = float(i) / 50.0;
      
      float dist = fi * trailLength;
      vec3 trailPos = meteorPos - velDir * dist;
      
      // Very subtle wobble
      float wobbleAmt = fi * 0.015 * distToCam;
      float wobbleSpeed = 1.5;
      vec3 wobble = vec3(
        sin(fi * 6.0 + time * wobbleSpeed) * wobbleAmt,
        cos(fi * 5.0 + time * wobbleSpeed * 1.1) * wobbleAmt,
        sin(fi * 5.5 + time * wobbleSpeed * 0.9) * wobbleAmt
      );
      trailPos += wobble;
      
      vec3 toPoint = trailPos - ro;
      float t = dot(toPoint, rd);
      if(t < 0.0) continue;
      
      vec3 closest = ro + rd * t;
      float d = length(trailPos - closest);
      
      // Trail width with 10x parallax
      float trailDist = length(trailPos - camPos);
      float radius = (0.01 + fi * fi * 0.05) * min(10.0 / max(trailDist, 0.3), 10.0);
      
      if(d < radius) {
        float intensity = 1.0 - d / radius;
        intensity = pow(intensity, 1.2);
        intensity *= 1.0 - fi * 0.7;
        
        // Fire colors
        vec3 fireCol;
        float flameMix = fi;
        
        if(flameMix < 0.1) {
          fireCol = mix(vec3(1.0, 1.0, 0.95), vec3(1.0, 0.95, 0.6), flameMix / 0.1);
        } else if(flameMix < 0.3) {
          fireCol = mix(vec3(1.0, 0.95, 0.6), vec3(1.0, 0.7, 0.2), (flameMix - 0.1) / 0.2);
        } else if(flameMix < 0.55) {
          fireCol = mix(vec3(1.0, 0.7, 0.2), vec3(1.0, 0.45, 0.08), (flameMix - 0.3) / 0.25);
        } else if(flameMix < 0.8) {
          fireCol = mix(vec3(1.0, 0.45, 0.08), vec3(0.9, 0.2, 0.03), (flameMix - 0.55) / 0.25);
        } else {
          fireCol = mix(vec3(0.9, 0.2, 0.03), vec3(0.35, 0.08, 0.02), (flameMix - 0.8) / 0.2);
        }
        
        float flicker = 0.9 + 0.1 * noise(vec3(fi * 12.0, time * 6.0, 0.0));
        
        col += fireCol * intensity * flicker * 2.5;
      }
    }
    
    return col;
  }
  
  // TRUE FIREBALL METEORITE - not a white circle!
  vec4 renderMeteorite(vec3 ro, vec3 rd, vec3 meteorPos, vec3 velocity, float time, float approachProgress, vec3 camPos) {
    if(approachProgress >= 1.0) return vec4(0.0);
    
    // 10x PARALLAX radius
    float meteorRadius = getMeteoriteRadius(meteorPos, camPos);
    vec3 meteorRo = ro - meteorPos;
    
    vec3 col = vec3(0.0);
    float closestT = -1.0;
    
    // Calculate closest approach to ray
    float tClosest = -dot(meteorRo, rd);
    vec3 closestPoint = meteorRo + rd * tClosest;
    float distToRay = length(closestPoint);
    
    // OUTER FLAME CORONA - large fiery glow
    float coronaRadius = meteorRadius * 2.5;
    if(distToRay < coronaRadius && tClosest > 0.0) {
      float coronaDist = distToRay / coronaRadius;
      float corona = exp(-coronaDist * coronaDist * 2.0);
      
      // Turbulent flames
      vec3 sampleP = closestPoint * 5.0 / meteorRadius + time * 3.0;
      float flames = fbm(sampleP);
      
      vec3 coronaCol = mix(vec3(1.0, 0.4, 0.05), vec3(1.0, 0.7, 0.2), flames);
      coronaCol = mix(coronaCol, vec3(1.0, 0.25, 0.02), coronaDist);
      
      col += coronaCol * corona * 1.5;
    }
    
    // MID FLAME LAYER
    float midRadius = meteorRadius * 1.6;
    if(distToRay < midRadius && tClosest > 0.0) {
      float midDist = distToRay / midRadius;
      float midFlame = exp(-midDist * midDist * 3.0);
      
      vec3 sampleP = closestPoint * 8.0 / meteorRadius + time * 4.0;
      float flames = fbm(sampleP + vec3(100.0, 0.0, 0.0));
      
      vec3 midCol = mix(vec3(1.0, 0.6, 0.15), vec3(1.0, 0.85, 0.4), flames);
      midCol = mix(midCol, vec3(1.0, 0.5, 0.1), midDist * 0.5);
      
      col += midCol * midFlame * 2.0;
    }
    
    // INNER HOT CORE
    float coreRadius = meteorRadius * 1.1;
    if(distToRay < coreRadius && tClosest > 0.0) {
      float coreDist = distToRay / coreRadius;
      float core = exp(-coreDist * coreDist * 4.0);
      
      vec3 sampleP = closestPoint * 12.0 / meteorRadius + time * 5.0;
      float coreNoise = fbm(sampleP + vec3(200.0, 0.0, 0.0));
      
      vec3 coreCol = mix(vec3(1.0, 0.9, 0.6), vec3(1.0, 1.0, 0.9), coreNoise * 0.5 + 0.3);
      coreCol = mix(coreCol, vec3(1.0, 0.95, 0.8), core);
      
      col += coreCol * core * 2.5;
    }
    
    // BRIGHT CENTER - the actual solid core
    vec2 hit = sphereIntersect(meteorRo, rd, meteorRadius * 0.7);
    if(hit.x > 0.0) {
      vec3 pos = meteorRo + rd * hit.x;
      vec3 normal = normalize(pos);
      
      // Molten surface
      float surfaceNoise = fbm(pos * 10.0 / meteorRadius + time * 2.0);
      float surfaceNoise2 = fbm(pos * 20.0 / meteorRadius - time * 3.0);
      
      // Hot molten colors
      vec3 hotCol = vec3(1.0, 0.95, 0.85);
      vec3 moltenCol = vec3(1.0, 0.75, 0.35);
      vec3 darkMolten = vec3(0.95, 0.5, 0.15);
      
      vec3 surfaceCol = mix(moltenCol, hotCol, surfaceNoise * 0.6 + 0.2);
      surfaceCol = mix(surfaceCol, darkMolten, surfaceNoise2 * 0.3);
      
      // Leading edge is hotter
      vec3 velDir = normalize(velocity);
      float leading = max(dot(normal, velDir), 0.0);
      surfaceCol = mix(surfaceCol, vec3(1.0, 1.0, 0.95), leading * 0.4);
      
      // Fresnel rim fire
      float fresnel = pow(1.0 - max(dot(normal, -rd), 0.0), 2.5);
      surfaceCol += vec3(1.0, 0.6, 0.15) * fresnel;
      
      col = surfaceCol * 1.8;
      closestT = hit.x;
    }
    
    if(length(col) > 0.01) {
      return vec4(col, closestT > 0.0 ? closestT : tClosest);
    }
    
    return vec4(0.0);
  }
  
  // Explosion at impact point
  vec3 renderExplosion(vec3 ro, vec3 rd, vec3 impactPoint, float explosionTime, float time) {
    if(explosionTime < 0.0 || explosionTime > getExplosionDuration()) return vec3(0.0);
    
    vec3 col = vec3(0.0);
    
    // Fireball
    float fireballMaxRadius = 0.4;
    float fireballRadius = fireballMaxRadius * (1.0 - exp(-explosionTime * 5.0));
    float fireballIntensity = exp(-explosionTime * 0.5);
    
    vec3 fireballCenter = impactPoint * 1.02;
    vec3 fireballRo = ro - fireballCenter;
    
    float tNear = dot(-fireballRo, rd);
    vec3 nearPoint = fireballRo + rd * max(tNear, 0.0);
    float distToCenter = length(nearPoint);
    
    if(distToCenter < fireballRadius) {
      float density = 1.0 - distToCenter / fireballRadius;
      density = pow(density, 0.5);
      
      vec3 samplePos = nearPoint + fireballCenter;
      float turb = fbm(samplePos * 5.0 - time * 2.5);
      
      vec3 coreCol = vec3(1.0, 1.0, 0.95);
      vec3 midCol = vec3(1.0, 0.75, 0.3);
      vec3 outerCol = vec3(1.0, 0.4, 0.08);
      
      float coreMix = smoothstep(0.5, 1.0, density);
      float midMix = smoothstep(0.15, 0.5, density);
      
      vec3 fireCol = mix(outerCol, midCol, midMix);
      fireCol = mix(fireCol, coreCol, coreMix);
      fireCol = mix(fireCol, vec3(1.0, 0.55, 0.12), turb * 0.4);
      
      col += fireCol * density * fireballIntensity * 3.5;
    }
    
    // Debris particles
    for(int i = 0; i < 30; i++) {
      vec3 randDir = normalize(hash3(vec3(float(i) * 13.7, 27.3, 89.1)) * 2.0 - 1.0);
      randDir = normalize(randDir + impactPoint * 1.5);
      
      float speed = 0.25 + hash(float(i) * 7.3) * 0.35;
      float particleSize = 0.012 + hash(float(i) * 11.1) * 0.025;
      
      float t = explosionTime;
      vec3 particlePos = impactPoint * 1.01 + randDir * speed * t * exp(-t * 0.2);
      
      vec3 toParticle = particlePos - ro;
      float tProj = dot(toParticle, rd);
      if(tProj > 0.0) {
        vec3 closest = ro + rd * tProj;
        float d = length(particlePos - closest);
        
        if(d < particleSize) {
          float intensity = (1.0 - d / particleSize);
          intensity *= exp(-explosionTime * 0.35);
          
          float heat = exp(-explosionTime * 0.25);
          vec3 debrisCol = mix(vec3(1.0, 0.5, 0.1), vec3(1.0, 0.9, 0.6), heat);
          
          col += debrisCol * intensity * 1.5;
        }
      }
    }
    
    // Shockwave on surface
    float waveSpeed = 0.4;
    float waveRadius = explosionTime * waveSpeed;
    float waveWidth = 0.03 + explosionTime * 0.02;
    
    vec2 jupiterHit = sphereIntersect(ro, rd, 1.001);
    if(jupiterHit.x > 0.0) {
      vec3 surfacePos = ro + rd * jupiterHit.x;
      float distFromImpact = acos(clamp(dot(normalize(surfacePos), impactPoint), -1.0, 1.0));
      
      float wave = smoothstep(waveWidth, 0.0, abs(distFromImpact - waveRadius));
      wave *= exp(-explosionTime * 0.3);
      
      float wave2 = smoothstep(waveWidth * 0.5, 0.0, abs(distFromImpact - waveRadius * 0.5)) * 0.7;
      wave2 *= exp(-explosionTime * 0.35);
      
      col += vec3(1.0, 0.7, 0.3) * (wave + wave2) * 2.5;
    }
    
    return col;
  }
  
  // Impact glow on Jupiter surface
  float surfaceImpactGlow(vec3 surfacePos, vec3 impactPoint, float explosionTime) {
    if(explosionTime < 0.0) return 0.0;
    
    float dist = acos(clamp(dot(normalize(surfacePos), impactPoint), -1.0, 1.0));
    
    float crater = exp(-dist * 10.0) * exp(-explosionTime * 0.12);
    float heated = exp(-dist * 3.5) * exp(-explosionTime * 0.2) * 0.5;
    
    return crater + heated;
  }
  
  // Moon rendering
  vec3 renderMoon(vec3 ro, vec3 rd, vec3 moonPos, float moonRadius, vec3 moonColor, vec3 lightDir) {
    vec3 moonRo = ro - moonPos;
    vec2 moonHit = sphereIntersect(moonRo, rd, moonRadius);
    
    if(moonHit.x > 0.0) {
      vec3 pos = moonRo + rd * moonHit.x;
      vec3 normal = normalize(pos);
      
      float diff = max(dot(normal, lightDir), 0.0);
      float amb = 0.08;
      float detail = fbm(pos * 20.0) * 0.15;
      
      vec3 col = moonColor * (diff + amb) + detail * moonColor;
      
      float rim = pow(1.0 - max(dot(normal, -rd), 0.0), 3.0);
      col += vec3(0.9, 0.8, 0.6) * rim * 0.15;
      
      return col;
    }
    return vec3(-1.0);
  }
  
  // Starfield
  vec3 stars(vec3 rd) {
    vec3 col = vec3(0.0);
    
    for(int i = 0; i < 3; i++) {
      vec3 p = rd * (200.0 + float(i) * 100.0);
      vec3 id = floor(p);
      vec3 fd = fract(p) - 0.5;
      
      float star = hash2(id.xy + id.z * 100.0);
      if(star > 0.97) {
        float brightness = (star - 0.97) * 33.0;
        float size = hash2(id.xy * 2.0 + id.z) * 0.3 + 0.1;
        float d = length(fd);
        float glow = exp(-d * d * (20.0 / size));
        
        vec3 starCol = mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.9, 0.7), hash2(id.xy * 3.0));
        col += starCol * glow * brightness;
      }
    }
    
    return col;
  }
  
  // Nebula background
  vec3 nebula(vec3 rd) {
    float n1 = fbm(rd * 3.0);
    float n2 = fbm(rd * 5.0 + vec3(100.0, 0.0, 0.0));
    
    vec3 col = vec3(0.0);
    col += vec3(0.1, 0.05, 0.15) * n1 * n1;
    col += vec3(0.02, 0.05, 0.1) * n2;
    
    return col * 0.3;
  }
  
  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
    vec2 mouse = u_mouse / u_resolution - 0.5;
    
    vec3 ro = getCameraPos(u_time, mouse);
    vec3 ta = vec3(0.0, 0.0, 0.0);
    
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = normalize(cross(uu, ww));
    
    float fov = 1.8;
    vec3 rd = normalize(uv.x * uu + uv.y * vv + fov * ww);
    
    vec3 lightDir = normalize(vec3(1.0, 0.3, 0.5));
    
    vec3 impactPoint = getImpactPoint(ro);
    float approachProgress = getApproachProgress(u_time);
    float explosionTime = getExplosionTime(u_time);
    
    vec3 meteorPos = getMeteoritePos(u_time, ro, impactPoint);
    vec3 prevMeteorPos = getMeteoritePos(u_time - 0.005, ro, impactPoint);
    vec3 velocity = meteorPos - prevMeteorPos;
    
    // Background
    vec3 col = nebula(rd) + stars(rd);
    
    // Jupiter
    float jupiterRadius = 1.0;
    vec2 hit = sphereIntersect(ro, rd, jupiterRadius);
    
    // Moon positions
    float t = u_time * 0.3;
    
    vec3 ioPos = vec3(sin(t * 1.7) * 1.8, sin(t * 0.5) * 0.1, cos(t * 1.7) * 1.8);
    vec3 ioColor = vec3(0.95, 0.85, 0.4);
    
    vec3 europaPos = vec3(sin(t * 1.2 + 1.0) * 2.3, sin(t * 0.3 + 0.5) * 0.15, cos(t * 1.2 + 1.0) * 2.3);
    vec3 europaColor = vec3(0.85, 0.9, 0.95);
    
    vec3 ganymedePos = vec3(sin(t * 0.8 + 2.5) * 3.0, sin(t * 0.2 + 1.0) * 0.1, cos(t * 0.8 + 2.5) * 3.0);
    vec3 ganymedeColor = vec3(0.7, 0.65, 0.6);
    
    vec3 callistoPos = vec3(sin(t * 0.5 + 4.0) * 4.0, sin(t * 0.15 + 2.0) * 0.12, cos(t * 0.5 + 4.0) * 4.0);
    vec3 callistoColor = vec3(0.45, 0.42, 0.4);
    
    vec3 ioCol = renderMoon(ro, rd, ioPos, 0.08, ioColor, lightDir);
    vec3 europaCol = renderMoon(ro, rd, europaPos, 0.07, europaColor, lightDir);
    vec3 ganymedeCol = renderMoon(ro, rd, ganymedePos, 0.12, ganymedeColor, lightDir);
    vec3 callistoCol = renderMoon(ro, rd, callistoPos, 0.1, callistoColor, lightDir);
    
    float ioDepth = length(ioPos - ro);
    float europaDepth = length(europaPos - ro);
    float ganymedeDepth = length(ganymedePos - ro);
    float callistoDepth = length(callistoPos - ro);
    float jupiterDepth = hit.x > 0.0 ? hit.x : 1000.0;
    
    // Moons behind Jupiter
    if(callistoCol.x >= 0.0 && callistoDepth > jupiterDepth) col = callistoCol;
    if(ganymedeCol.x >= 0.0 && ganymedeDepth > jupiterDepth) col = ganymedeCol;
    if(europaCol.x >= 0.0 && europaDepth > jupiterDepth) col = europaCol;
    if(ioCol.x >= 0.0 && ioDepth > jupiterDepth) col = ioCol;
    
    // Fire trail with parallax
    vec3 trailCol = renderFireTrail(ro, rd, meteorPos, velocity, u_time, approachProgress, ro);
    
    // Render Jupiter
    if(hit.x > 0.0) {
      vec3 pos = ro + rd * hit.x;
      vec3 normal = normalize(pos);
      
      float rotSpeed = u_time * 0.1;
      vec3 rotatedPos = vec3(
        pos.x * cos(rotSpeed) - pos.z * sin(rotSpeed),
        pos.y,
        pos.x * sin(rotSpeed) + pos.z * cos(rotSpeed)
      );
      
      float bands = jupiterBands(rotatedPos, u_time);
      float spot = greatRedSpot(rotatedPos, u_time);
      vec3 jupiterCol = jupiterColor(bands, spot, rotatedPos, u_time);
      
      float diff = max(dot(normal, lightDir), 0.0);
      float amb = 0.12;
      float terminator = smoothstep(-0.1, 0.3, dot(normal, lightDir));
      
      float fresnel = pow(1.0 - max(dot(normal, -rd), 0.0), 4.0);
      vec3 rimColor = vec3(0.9, 0.75, 0.5);
      
      float sss = pow(max(dot(rd, lightDir), 0.0), 3.0) * fresnel;
      
      col = jupiterCol * (diff * 0.9 + amb) * terminator;
      col += rimColor * fresnel * 0.4;
      col += vec3(1.0, 0.8, 0.5) * sss * 0.15;
      col = mix(col, rimColor * 0.5, fresnel * 0.3);
      
      // Impact glow
      float impactGlow = surfaceImpactGlow(pos, impactPoint, explosionTime);
      vec3 glowCol = mix(vec3(1.0, 0.5, 0.1), vec3(1.0, 0.95, 0.75), impactGlow);
      col = mix(col, glowCol, impactGlow * 0.9);
    }
    
    // Explosion
    vec3 explosionCol = renderExplosion(ro, rd, impactPoint, explosionTime, u_time);
    col += explosionCol;
    
    // FIREBALL meteorite with 10x parallax
    vec4 meteorite = renderMeteorite(ro, rd, meteorPos, velocity, u_time, approachProgress, ro);
    if(meteorite.w > 0.0) {
      if(meteorite.w < jupiterDepth) {
        // Blend fireball with background
        col = mix(col, meteorite.rgb, min(length(meteorite.rgb) / 3.0, 1.0));
        col = max(col, meteorite.rgb * 0.8);
      } else {
        col += meteorite.rgb * 0.4;
      }
    }
    
    // Fire trail on top
    col += trailCol;
    
    // Moons in front
    if(ioCol.x >= 0.0 && ioDepth < jupiterDepth) col = ioCol;
    if(europaCol.x >= 0.0 && europaDepth < jupiterDepth) col = europaCol;
    if(ganymedeCol.x >= 0.0 && ganymedeDepth < jupiterDepth) col = ganymedeCol;
    if(callistoCol.x >= 0.0 && callistoDepth < jupiterDepth) col = callistoCol;
    
    // Impact flash
    float flash = exp(-abs(explosionTime) * 15.0) * step(0.0, explosionTime) * step(explosionTime, 0.15);
    col += vec3(1.0, 0.97, 0.9) * flash * 3.0;
    
    // Atmospheric glow
    if(hit.x < 0.0) {
      vec3 closest = ro + rd * max(-dot(ro, rd), 0.0);
      float d = length(closest);
      if(d < 1.5) {
        float glow = exp(-(d - 1.0) * 3.0) * 0.3;
        col += vec3(0.9, 0.7, 0.4) * glow;
      }
    }
    
    // Vignette
    vec2 vigUV = gl_FragCoord.xy / u_resolution.xy;
    float vig = 1.0 - dot(vigUV - 0.5, vigUV - 0.5) * 0.4;
    col *= vig;
    
    // Tone mapping
    col = col / (1.0 + col);
    col = pow(col, vec3(0.85));
    col = mix(col, col * vec3(1.05, 0.98, 0.95), 0.3);
    
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ============================================================================
// JUPITER IMPACT SHADER CLASS
// ============================================================================

class JupiterImpactShader {
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
      throw new Error('JupiterImpactShader: options.ticker (PIXI.Ticker) is required');
    }
    if (!options.canvas && !options.container) {
      throw new Error('JupiterImpactShader: options.canvas or options.container is required');
    }

    // Merge options
    this.options = { ...JupiterImpactShader.defaults, ...options };
    this.ticker = this.options.ticker;

    // Internal state
    this._destroyed = false;
    this._running = false;
    this._startTime = 0;
    this._time = 0;

    // Mouse position (pixel coordinates)
    this._mouse = { x: 0, y: 0 };

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
      throw new Error('JupiterImpactShader: WebGL not supported');
    }

    // Compile shaders and create program
    this._createProgram();

    // Create geometry
    this._createGeometry();

    // Get uniform locations
    this._getUniformLocations();

    // Initial resize
    this._resize();

    // Set initial mouse to center
    this._mouse.x = this._canvas.width / 2;
    this._mouse.y = this._canvas.height / 2;
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
    const width = this.options.width ?? this._canvas.clientWidth ?? window.innerWidth;
    const height = this.options.height ?? this._canvas.clientHeight ?? window.innerHeight;

    this._canvas.width = width * dpr;
    this._canvas.height = height * dpr;
    this._gl.viewport(0, 0, this._canvas.width, this._canvas.height);

    // Update mouse to center on resize
    this._mouse.x = this._canvas.width / 2;
    this._mouse.y = this._canvas.height / 2;
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
    gl.uniform2f(this._uniforms.mouse, this._mouse.x, this._mouse.y);

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
   * Set mouse position (pixel coordinates)
   * @param {number} x - X position in pixels
   * @param {number} y - Y position in pixels (0 = top, height = bottom)
   */
  setMouse(x, y) {
    // Convert to WebGL coordinates (flip Y)
    this._mouse.x = x;
    this._mouse.y = this._canvas.height - y;
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

export { JupiterImpactShader, vertexShaderSource, fragmentShaderSource };
export default JupiterImpactShader;
