import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function initAboutAnimation(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container #${containerId} not found`);
        return;
    }

    // Get dimensions - fallback to window size if container has no dimensions
    const getWidth = () => container.clientWidth || window.innerWidth;
    const getHeight = () => container.clientHeight || window.innerHeight;

    // Configuration
    const config = {
        color: 0xadadad,
        particleCount: 20000,
        logoScale: 0.8, // Scale factor for the logo points to fit view
        logoDepth: 10,  // Z-depth range for 3D volume
    };

    // Scene setup
    const scene = new THREE.Scene();
    
    // Camera setup
    const camera = new THREE.PerspectiveCamera(50, getWidth() / getHeight(), 0.1, 1000);
    camera.position.z = 100;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(getWidth(), getHeight());
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Group to hold everything
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // --- LOGO PARTICLE GENERATION ---
    // The logo is "NVD". We will sample points from the vector paths provided.
    // SVG viewBox="0 0 152 48"
    // We need to map these to 3D coordinates, centered.
    // Center X approx 76, Center Y approx 24.
    
    // Simplified path data points (approximation of the letters)
    // We'll generate points along these lines/shapes
    
    // To do this robustly without a heavy SVG parser, we define the key vertices of the NVD shapes
    // and interpolate points between them (filling the shapes).
    
    // N:
    // Left vertical bar: (0, 48) -> (0, 19.7)
    // Diagonal: (0, 19.7) -> (39.4, 48)
    // Right vertical bar: (39.4, 48) -> (39.4, 19.7)
    // ... wait, the SVG has specific complex shapes.
    
    // Let's use a rejection sampling approach with defined bounding boxes for the letters,
    // combined with simple geometric approximations for the N, V, D shapes.
    // Or better: Define the letters as sets of line segments and fill areas.
    
    const particles = [];
    
    // Helper to add particles in a rectangular volume (for vertical bars)
    function addBar(x, y, w, h, density = 1) {
        const count = w * h * density;
        for (let i = 0; i < count; i++) {
            particles.push({
                x: x + Math.random() * w,
                y: y + Math.random() * h,
                z: (Math.random() - 0.5) * config.logoDepth
            });
        }
    }
    
    // Helper to add particles in a polygon (for diagonals/triangles)
    // Triangle: p1, p2, p3
    function addTriangle(x1, y1, x2, y2, x3, y3, density = 1) {
        // Area approx for count
        const area = Math.abs((x1*(y2-y3) + x2*(y3-y1) + x3*(y1-y2))/2);
        const count = area * density * 10; // *10 scaling factor
        
        for (let i = 0; i < count; i++) {
            // Random point in triangle using barycentric coordinates
            let r1 = Math.random();
            let r2 = Math.random();
            if (r1 + r2 > 1) {
                r1 = 1 - r1;
                r2 = 1 - r2;
            }
            const r3 = 1 - r1 - r2;
            
            particles.push({
                x: r1 * x1 + r2 * x2 + r3 * x3,
                y: r1 * y1 + r2 * y2 + r3 * y3,
                z: (Math.random() - 0.5) * config.logoDepth
            });
        }
    }

    // --- GENERATING THE "NVD" SHAPES ---
    // Coordinate system: SVG has (0,0) at top-left. Three.js has (0,0) at center.
    // We'll generate in SVG coords then flip Y and center.
    // N: ~0 to 40 width
    // V: ~56 to 96 width
    // D: ~100 to 152 width
    // Height: ~48
    
    // N
    // Left Leg
    addBar(0, 19, 18, 29, 2.5); // (x, y, w, h)
    // Right Leg
    addBar(44, 0, 18, 29, 2.5); // Using approximate visual width from SVG paths
    // Diagonal
    addTriangle(18, 19, 18, 48, 44, 48, 3.0);
    addTriangle(18, 19, 44, 19, 44, 48, 3.0);
    // Upper serifs/curve parts of N (simplified)
    addBar(7, 4, 11, 15, 2.5);
    addBar(28, 0, 10, 8, 2.5);

    // V
    // Left diagonal-ish block
    addBar(56, 0, 19, 29, 2.5); 
    // Right diagonal-ish block
    addBar(79, 19, 17, 29, 2.5); 
    // Connecting diagonal
    addTriangle(75, 0, 56, 48, 96, 48, 2.0); // Rough fill for V center

    // D
    // Left vertical bar
    addBar(100, 0, 18, 48, 2.5);
    // Top bar
    addBar(118, 0, 22, 8, 2.5);
    // Bottom bar
    addBar(118, 40, 22, 8, 2.5);
    // Curved Right Side (Approximated by rects/triangles)
    addBar(140, 8, 12, 32, 2.5);
    // Corner fillers
    addTriangle(140, 0, 140, 8, 152, 8, 2.5);
    addTriangle(140, 48, 140, 40, 152, 40, 2.5);
    
    // --- PARTICLE SYSTEM SETUP ---
    // If we generated fewer than config.particleCount, we fill the rest randomly in the bounding box
    // or just use what we have.
    // Let's create the arrays based on actual count
    
    const actualCount = particles.length;
    
    const geometry = new THREE.BufferGeometry();
    const posArray = new Float32Array(actualCount * 3);
    const opacityArray = new Float32Array(actualCount);
    const sizeArray = new Float32Array(actualCount);
    
    const originalPosArray = new Float32Array(actualCount * 3);
    const floatOffsets = new Float32Array(actualCount * 3);
    const floatSpeeds = new Float32Array(actualCount);

    // Centering offsets
    // Total width ~152, Height ~48
    const cx = 152 / 2;
    const cy = 48 / 2;

    for (let i = 0; i < actualCount; i++) {
        const p = particles[i];
        
        // Transform coordinates:
        // 1. Center them (subtract cx, cy)
        // 2. Flip Y (SVG y goes down, 3D y goes up)
        // 3. Apply scale
        
        const x = (p.x - cx) * config.logoScale;
        const y = -(p.y - cy) * config.logoScale; // Flip Y
        const z = p.z; // Depth
        
        posArray[i * 3] = x;
        posArray[i * 3 + 1] = y;
        posArray[i * 3 + 2] = z;
        
        originalPosArray[i * 3] = x;
        originalPosArray[i * 3 + 1] = y;
        originalPosArray[i * 3 + 2] = z;
        
        floatOffsets[i * 3] = Math.random() * Math.PI * 2;
        floatOffsets[i * 3 + 1] = Math.random() * Math.PI * 2;
        floatOffsets[i * 3 + 2] = Math.random() * Math.PI * 2;
        floatSpeeds[i] = 0.3 + Math.random() * 0.7;
        
        // Opacity gradient (brighter at top)
        const normalizedY = (y + 20) / 40; // Approx range -20 to 20
        opacityArray[i] = 0.2 + normalizedY * 0.6;
        sizeArray[i] = 0.8 + Math.random() * 0.6;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geometry.setAttribute('opacity', new THREE.BufferAttribute(opacityArray, 1));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizeArray, 1));

    // Shader Material (Same as others)
    const material = new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(config.color) },
            pointSize: { value: 2.0 }
        },
        vertexShader: `
            attribute float opacity;
            attribute float size;
            varying float vOpacity;
            varying float vDepth;
            uniform float pointSize;
            
            void main() {
                vOpacity = opacity;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vDepth = -mvPosition.z;
                float depthScale = 250.0 / vDepth;
                gl_PointSize = size * pointSize * depthScale;
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform vec3 color;
            varying float vOpacity;
            void main() {
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);
                if (dist > 0.5) discard;
                float alpha = smoothstep(0.5, 0.2, dist) * vOpacity;
                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const particleSystem = new THREE.Points(geometry, material);
    mainGroup.add(particleSystem);

    // Mouse Interaction
    const targetRotation = { x: 0, y: 0 };
    const currentRotation = { x: 0, y: 0 };
    const maxRotation = 0.2; // Allow more rotation to see the 3D depth of the logo
    const smoothing = 0.05;

    window.addEventListener('mousemove', (event) => {
        const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
        targetRotation.x = -mouseY * maxRotation;
        targetRotation.y = mouseX * maxRotation;
    });

    // Resize
    window.addEventListener('resize', () => {
        const width = getWidth();
        const height = getHeight();
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    });

    // Animate
    let time = 0;
    const posAttr = geometry.getAttribute('position');
    
    function animate() {
        requestAnimationFrame(animate);
        time += 0.01;

        currentRotation.x += (targetRotation.x - currentRotation.x) * smoothing;
        currentRotation.y += (targetRotation.y - currentRotation.y) * smoothing;
        
        mainGroup.rotation.x = currentRotation.x;
        mainGroup.rotation.y = currentRotation.y;

        // Float animation
        for (let i = 0; i < actualCount; i++) {
            const speed = floatSpeeds[i];
            const ox = floatOffsets[i * 3];
            const oy = floatOffsets[i * 3 + 1];
            const oz = floatOffsets[i * 3 + 2];
            
            const dx = Math.sin(time * speed + ox) * 0.3;
            const dy = Math.sin(time * speed * 0.8 + oy) * 0.3;
            const dz = Math.sin(time * speed * 0.6 + oz) * 0.3;
            
            posAttr.array[i * 3] = originalPosArray[i * 3] + dx;
            posAttr.array[i * 3 + 1] = originalPosArray[i * 3 + 1] + dy;
            posAttr.array[i * 3 + 2] = originalPosArray[i * 3 + 2] + dz;
        }
        posAttr.needsUpdate = true;
        
        renderer.render(scene, camera);
    }
    
    animate();
    
    return { scene, camera, renderer };
}

if (typeof window !== 'undefined') {
    const scriptTag = document.querySelector('script[src*="about.js"]');
    if (scriptTag) {
        window.addEventListener('DOMContentLoaded', () => {
            initAboutAnimation('hero-canvas');
        });
    }
}
