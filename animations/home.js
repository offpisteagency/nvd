import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export function initHomeAnimation(containerId) {
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
        particleCount: 25000,
        radius: 35,
        tubeRadius: 6,
        animationDuration: 20000, // 20 seconds in milliseconds
        startAngle: Math.PI / 2, // Start at 12 o'clock (top)
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

    // Create particle system
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.particleCount * 3);
    const opacities = new Float32Array(config.particleCount);
    const baseOpacities = new Float32Array(config.particleCount); // Store base opacity for non-ring particles
    const sizes = new Float32Array(config.particleCount);
    
    const originalPositions = new Float32Array(config.particleCount * 3);
    const floatOffsets = new Float32Array(config.particleCount * 3);
    const floatSpeeds = new Float32Array(config.particleCount);
    
    // Store angle for each particle (for ring particles, used for dynamic highlighting)
    const particleAngles = new Float32Array(config.particleCount);
    const isRingParticle = new Uint8Array(config.particleCount); // 1 if ring particle, 0 otherwise

    // Distribution - all ring particles now, no static highlight
    const ringParticles = Math.floor(config.particleCount * 0.85);
    const coreParticles = config.particleCount - ringParticles;

    for (let i = 0; i < config.particleCount; i++) {
        let x, y, z;
        let angle = 0;

        if (i < ringParticles) {
            // Ring particles (Torus) - evenly distributed
            isRingParticle[i] = 1;
            
            const u = Math.random() * Math.PI * 2; // Angle around the ring
            angle = u;
            
            const v = Math.random() * Math.PI * 2; // Angle inside the tube
            const r = config.tubeRadius * (0.5 + 0.5 * Math.random());
            
            x = (config.radius + r * Math.cos(v)) * Math.cos(u);
            y = (config.radius + r * Math.cos(v)) * Math.sin(u);
            z = r * Math.sin(v);
            
        } else {
            // Center Core (Sparse volume)
            isRingParticle[i] = 0;
            
            const u = Math.random() * Math.PI * 2;
            const v = Math.acos(2 * Math.random() - 1);
            const r = config.radius * 0.7 * Math.cbrt(Math.random());
            
            x = r * Math.sin(v) * Math.cos(u);
            y = r * Math.sin(v) * Math.sin(u);
            z = r * Math.cos(v);
        }

        particleAngles[i] = angle;

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

        // Initial opacity & size (ring particles will be updated dynamically)
        if (isRingParticle[i]) {
            opacities[i] = 0.15; // Dim by default
            sizes[i] = 0.9 + Math.random() * 0.4;
        } else {
            // Core particles - slight gradient based on Y
            const normalizedY = (y / config.radius + 1) / 2;
            opacities[i] = 0.08 + normalizedY * 0.2;
            baseOpacities[i] = opacities[i];
            sizes[i] = 0.7 + Math.random() * 0.4;
        }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Shader Material
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

    const particles = new THREE.Points(geometry, material);
    mainGroup.add(particles);

    // Mouse interaction (same as surveillance/familyoffice)
    const targetRotation = { x: 0, y: 0 };
    const currentRotation = { x: 0, y: 0 };
    const maxRotation = 0.12;
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
        const width = getWidth();
        const height = getHeight();
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        updateCameraPosition();
    });

    // Animation loop
    let time = 0;
    const startTime = performance.now();
    const positionAttribute = geometry.getAttribute('position');
    const opacityAttribute = geometry.getAttribute('opacity');
    
    function animate() {
        requestAnimationFrame(animate);
        time += 0.008;

        // Smooth mouse rotation (no auto-rotation)
        currentRotation.x += (targetRotation.x - currentRotation.x) * smoothing;
        currentRotation.y += (targetRotation.y - currentRotation.y) * smoothing;
        
        mainGroup.rotation.x = currentRotation.x;
        mainGroup.rotation.y = currentRotation.y;

        // Calculate progress through 20-second cycle (0 to 1)
        const elapsed = performance.now() - startTime;
        const cycleProgress = (elapsed % config.animationDuration) / config.animationDuration;
        
        // Convert progress to angle swept (clockwise from top)
        // At progress=0, sweep=0. At progress=1, sweep=2*PI (full circle)
        const sweepAngle = cycleProgress * Math.PI * 2;

        // Update particles
        for (let i = 0; i < config.particleCount; i++) {
            const speed = floatSpeeds[i];
            const ox = floatOffsets[i * 3];
            const oy = floatOffsets[i * 3 + 1];
            const oz = floatOffsets[i * 3 + 2];
            
            // Organic float
            const dx = Math.sin(time * speed + ox) * 0.5;
            const dy = Math.sin(time * speed * 0.8 + oy) * 0.5;
            const dz = Math.sin(time * speed * 0.6 + oz) * 0.3;
            
            positionAttribute.array[i * 3] = originalPositions[i * 3] + dx;
            positionAttribute.array[i * 3 + 1] = originalPositions[i * 3 + 1] + dy;
            positionAttribute.array[i * 3 + 2] = originalPositions[i * 3 + 2] + dz;

            // Update opacity for ring particles based on sweep progress
            if (isRingParticle[i]) {
                const particleAngle = particleAngles[i];
                
                // Normalize angle relative to start (12 o'clock = PI/2)
                // We go clockwise, so we subtract from startAngle
                // Angle difference: how far clockwise from 12 o'clock
                let angleDiff = config.startAngle - particleAngle;
                
                // Normalize to 0 to 2*PI range
                while (angleDiff < 0) angleDiff += Math.PI * 2;
                while (angleDiff >= Math.PI * 2) angleDiff -= Math.PI * 2;
                
                // Check if this particle is within the swept area
                if (angleDiff <= sweepAngle) {
                    // Highlighted - bright
                    opacityAttribute.array[i] = 0.7 + Math.random() * 0.3;
                } else {
                    // Not yet reached - dim
                    opacityAttribute.array[i] = 0.15;
                }
            }
        }
        
        positionAttribute.needsUpdate = true;
        opacityAttribute.needsUpdate = true;

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
