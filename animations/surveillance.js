import * as THREE from 'three';

export function initSurveillanceAnimation(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container #${containerId} not found`);
        return;
    }

    // Configuration
    const config = {
        color: 0xffffff,
        particleCount: 25000, // High count for grainy look
        eyeballRadius: 45,
        pupilRadius: 10,
        irisRadius: 28,
        depthFuzz: 2, // Randomness in depth (layers)
    };

    // Scene setup
    const scene = new THREE.Scene();
    
    // Camera setup
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 120;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Group to hold everything - acts as the "Eyeball" center of rotation
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // 1. Particle Iris
    // We distribute particles on the surface of a sphere (the eyeball), within a specific band (the iris).
    
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.particleCount * 3);
    
    // Calculate angles for pupil and iris limits
    const phiMin = Math.asin(config.pupilRadius / config.eyeballRadius);
    const phiMax = Math.asin(config.irisRadius / config.eyeballRadius);

    for (let i = 0; i < config.particleCount; i++) {
        // Random spherical coordinates
        // To get uniform distribution on surface: cos(phi) should be uniform? 
        // Or just random phi in range is fine for this effect (might be denser near pupil, which is cool).
        // Let's use simple random for phi to get a bit of gradient density if it happens, or linear interpolation.
        
        const r = config.eyeballRadius + (Math.random() - 0.5) * config.depthFuzz;
        const theta = Math.random() * Math.PI * 2;
        
        // Random phi between min and max
        // Squaring random can bias distribution if needed, but linear is fine for noise
        const phi = phiMin + Math.random() * (phiMax - phiMin);
        
        // Convert to Cartesian
        // Orient so the eye looks along positive Z axis initially
        // Standard sphere: z is up? No, usually y is up.
        // Let's say looking down Z axis:
        // x = r * sin(phi) * cos(theta)
        // y = r * sin(phi) * sin(theta)
        // z = r * cos(phi)
        
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: config.color,
        size: 0.3, // Small grainy dots
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
        // Blending?
        blending: THREE.AdditiveBlending
    });

    const irisParticles = new THREE.Points(geometry, material);
    mainGroup.add(irisParticles);

    // Offset the camera so we see the front of the eye (which is at z ~ eyeballRadius)
    // The eye center is at 0,0,0. The surface is at z=45.
    // Camera at 120 means distance is 75.
    
    // Handle resize
    function updateCameraPosition() {
        const width = window.innerWidth;
        if (width < 600) {
            camera.position.z = 160; // Mobile needs to be further back
        } else {
            camera.position.z = 120;
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
    // Perlin-like noise or just smooth sine sums for natural movement
    function animate() {
        requestAnimationFrame(animate);
        time += 0.005;

        // Subtle "looking around"
        // Rotate the entire eyeball group around (0,0,0)
        // Since particles are on the surface at Z+, rotating X and Y moves the "pupil"
        
        const lookX = Math.sin(time * 0.7) * 0.3 + Math.cos(time * 0.3) * 0.1; // Left/Right
        const lookY = Math.cos(time * 0.5) * 0.3 + Math.sin(time * 0.2) * 0.1; // Up/Down
        
        // Smoothly interpolate or just apply
        // We want very subtle movement. 0.3 radians is ~17 degrees, might be too much?
        // "Very subtle" -> scale down.
        
        mainGroup.rotation.y = lookX * 0.5; 
        mainGroup.rotation.x = lookY * 0.3;

        // Add some internal rotation to the iris particles to make it feel dynamic/scanning?
        // Or just static noise structure? 
        // "Eye made out of particles" usually implies some energy.
        // Let's rotate the iris slightly around the Z axis (spin)
        irisParticles.rotation.z -= 0.002;

        renderer.render(scene, camera);
    }
    
    animate();

    return { scene, camera, renderer };
}

if (typeof window !== 'undefined') {
    const scriptTag = document.querySelector('script[src*="surveillance.js"]');
    if (scriptTag) {
        window.addEventListener('DOMContentLoaded', () => {
            initSurveillanceAnimation('hero-canvas');
        });
    }
}
