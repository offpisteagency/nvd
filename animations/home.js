import * as THREE from 'three';

export function initHomeAnimation(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container #${containerId} not found`);
        return;
    }

    // Configuration
    const config = {
        color: 0xadadad,
        particleCount: 25000,
        radius: 35,
        tubeRadius: 6, // Thickness of the ring
        activeSectorAngle: (Math.PI * 2) / 3, // 120 degrees (20 seconds out of 60)
        startAngle: Math.PI / 2, // Start at 12 o'clock
    };

    // Scene setup
    const scene = new THREE.Scene();
    
    // Camera setup
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 100;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Group to hold everything
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // Create particle system
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.particleCount * 3);
    const opacities = new Float32Array(config.particleCount);
    const sizes = new Float32Array(config.particleCount);
    
    const originalPositions = new Float32Array(config.particleCount * 3);
    const floatOffsets = new Float32Array(config.particleCount * 3);
    const floatSpeeds = new Float32Array(config.particleCount);

    // Distribution
    // 60% particles in the ring (evenly distributed)
    // 30% particles concentrated in the "20s" active sector for emphasis
    // 10% particles in the center core for volume
    
    const ringParticles = Math.floor(config.particleCount * 0.6);
    const activeSectorParticles = Math.floor(config.particleCount * 0.3);
    const coreParticles = config.particleCount - ringParticles - activeSectorParticles;

    for (let i = 0; i < config.particleCount; i++) {
        let x, y, z;
        let isHighlight = false;

        if (i < ringParticles) {
            // General Ring (Torus)
            const u = Math.random() * Math.PI * 2; // Angle around the ring
            const v = Math.random() * Math.PI * 2; // Angle inside the tube
            
            // Torus formula
            // x = (R + r * cos(v)) * cos(u)
            // y = (R + r * cos(v)) * sin(u)
            // z = r * sin(v)
            
            const r = config.tubeRadius * (0.5 + 0.5 * Math.random()); // Varying thickness
            
            x = (config.radius + r * Math.cos(v)) * Math.cos(u);
            y = (config.radius + r * Math.cos(v)) * Math.sin(u);
            z = r * Math.sin(v);
            
        } else if (i < ringParticles + activeSectorParticles) {
            // Active "20s" Sector (High Density)
            isHighlight = true;
            
            // Clockwise from top (PI/2)
            // Angle range: [startAngle - activeSectorAngle, startAngle]
            // Random angle within this range
            const angleOffset = Math.random() * config.activeSectorAngle;
            const u = config.startAngle - angleOffset;
            
            const v = Math.random() * Math.PI * 2;
            // Slightly thicker for emphasis
            const r = (config.tubeRadius + 2) * (0.3 + 0.7 * Math.random());
            
            x = (config.radius + r * Math.cos(v)) * Math.cos(u);
            y = (config.radius + r * Math.cos(v)) * Math.sin(u);
            z = r * Math.sin(v);

        } else {
            // Center Core (Sparse volume)
            // Random point inside sphere
            const u = Math.random() * Math.PI * 2;
            const v = Math.acos(2 * Math.random() - 1);
            const r = config.radius * 0.8 * Math.cbrt(Math.random()); // Inside the ring
            
            x = r * Math.sin(v) * Math.cos(u);
            y = r * Math.sin(v) * Math.sin(u);
            z = r * Math.cos(v);
        }

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        
        originalPositions[i * 3] = x;
        originalPositions[i * 3 + 1] = y;
        originalPositions[i * 3 + 2] = z;
        
        floatOffsets[i * 3] = Math.random() * Math.PI * 2;
        floatOffsets[i * 3 + 1] = Math.random() * Math.PI * 2;
        floatOffsets[i * 3 + 2] = Math.random() * Math.PI * 2;
        floatSpeeds[i] = 0.3 + Math.random() * 0.7;

        // Opacity & Size
        if (isHighlight) {
            // Brighter, slightly larger for the USP area
            opacities[i] = 0.6 + Math.random() * 0.4;
            sizes[i] = 1.2 + Math.random() * 0.8;
        } else {
            // Standard particles
            // Slight gradient based on Y to match other scenes
            const normalizedY = (y / config.radius + 1) / 2;
            opacities[i] = 0.1 + normalizedY * 0.4;
            sizes[i] = 0.8 + Math.random() * 0.5;
        }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Shader Material (Consistent with other files)
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
                
                // Size varies slightly with depth for 3D feel
                float depthScale = 250.0 / vDepth;
                gl_PointSize = size * pointSize * depthScale;
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform vec3 color;
            varying float vOpacity;
            
            void main() {
                // Circular point
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);
                if (dist > 0.5) discard;
                
                // Soft edge
                float alpha = smoothstep(0.5, 0.2, dist) * vOpacity;
                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const particles = new THREE.Points(geometry, material);
    mainGroup.add(particles);

    // Mouse interaction
    const targetRotation = { x: 0, y: 0 };
    const currentRotation = { x: 0, y: 0 };
    const maxRotation = 0.15; // Slightly more rotation to see the 3D ring structure
    const smoothing = 0.025;

    window.addEventListener('mousemove', (event) => {
        const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
        
        targetRotation.x = -mouseY * maxRotation;
        targetRotation.y = mouseX * maxRotation;
    });

    // Resize handling
    function updateCameraPosition() {
        const width = window.innerWidth;
        if (width < 600) {
            camera.position.z = 140;
        } else if (width < 900) {
            camera.position.z = 120;
        } else {
            camera.position.z = 100;
        }
    }
    updateCameraPosition();

    window.addEventListener('resize', () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        updateCameraPosition();
    });

    // Animation loop
    let time = 0;
    let autoRotation = 0;
    const positionAttribute = geometry.getAttribute('position');
    
    function animate() {
        requestAnimationFrame(animate);
        time += 0.008;
        autoRotation += 0.001; // Slow spin to show off the ring structure

        // Smooth rotation
        currentRotation.x += (targetRotation.x - currentRotation.x) * smoothing;
        currentRotation.y += (targetRotation.y - currentRotation.y) * smoothing;
        
        // Apply rotation
        // We add autoRotation to Z to make the ring spin like a wheel?
        // Or Y to spin it like a coin? 
        // Let's do a subtle Y spin + mouse influence
        mainGroup.rotation.x = currentRotation.x + 0.2; // Tilt it slightly towards camera
        mainGroup.rotation.y = currentRotation.y + autoRotation;

        // Particle Float Animation
        for (let i = 0; i < config.particleCount; i++) {
            const speed = floatSpeeds[i];
            const ox = floatOffsets[i * 3];
            const oy = floatOffsets[i * 3 + 1];
            const oz = floatOffsets[i * 3 + 2];
            
            // Organic float
            const dx = Math.sin(time * speed + ox) * 0.4;
            const dy = Math.sin(time * speed * 0.8 + oy) * 0.4;
            const dz = Math.sin(time * speed * 0.6 + oz) * 0.3;
            
            positionAttribute.array[i * 3] = originalPositions[i * 3] + dx;
            positionAttribute.array[i * 3 + 1] = originalPositions[i * 3 + 1] + dy;
            positionAttribute.array[i * 3 + 2] = originalPositions[i * 3 + 2] + dz;
        }
        positionAttribute.needsUpdate = true;

        renderer.render(scene, camera);
    }
    
    animate();

    return { scene, camera, renderer };
}

if (typeof window !== 'undefined') {
    const scriptTag = document.querySelector('script[src*="home.js"]');
    if (scriptTag) {
        window.addEventListener('DOMContentLoaded', () => {
            initHomeAnimation('hero-canvas');
        });
    }
}
