import * as THREE from 'three';

export function initSurveillanceAnimation(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container #${containerId} not found`);
        return;
    }

    // Configuration
    const config = {
        color: 0xadadad,
        particleCount: 25000, // Dense for 3D surface
        sphereRadius: 50, // Eyeball sphere radius
        pupilAngle: 0.35, // Pupil size (in radians from center)
        irisAngle: 1.2, // Iris coverage (in radians from center)
        edgeFade: 8,
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

    // Create particle system for the iris
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.particleCount * 3);
    const opacities = new Float32Array(config.particleCount);
    const sizes = new Float32Array(config.particleCount);
    
    // Store original positions and random offsets for floating animation
    const originalPositions = new Float32Array(config.particleCount * 3);
    const floatOffsets = new Float32Array(config.particleCount * 3); // Random phase offsets
    const floatSpeeds = new Float32Array(config.particleCount); // Random speeds

    for (let i = 0; i < config.particleCount; i++) {
        // Distribute on hemisphere surface (3D eyeball shape)
        // Using spherical coordinates: theta (around), phi (from pole)
        const theta = Math.random() * Math.PI * 2; // Full rotation
        
        // Phi from 0 (front center) to irisAngle (edge of visible iris)
        // Use sqrt for uniform distribution on sphere surface
        const phi = Math.acos(1 - Math.random() * (1 - Math.cos(config.irisAngle)));
        
        // Convert to Cartesian (z pointing toward viewer)
        const x = config.sphereRadius * Math.sin(phi) * Math.cos(theta);
        const y = config.sphereRadius * Math.sin(phi) * Math.sin(theta);
        const z = config.sphereRadius * Math.cos(phi); // Front of sphere

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        
        // Store original positions
        originalPositions[i * 3] = x;
        originalPositions[i * 3 + 1] = y;
        originalPositions[i * 3 + 2] = z;
        
        // Random offsets for organic floating
        floatOffsets[i * 3] = Math.random() * Math.PI * 2;
        floatOffsets[i * 3 + 1] = Math.random() * Math.PI * 2;
        floatOffsets[i * 3 + 2] = Math.random() * Math.PI * 2;
        floatSpeeds[i] = 0.3 + Math.random() * 0.7;

        // Calculate base opacity based on Y position (gradient: bright top, dark bottom)
        const normalizedY = y / (config.sphereRadius * Math.sin(config.irisAngle));
        const gradientOpacity = 0.2 + (normalizedY + 1) * 0.4; // Range: 0.2 to 1.0
        
        // Fade outer edge (particles near iris edge)
        const edgeFadeStart = config.irisAngle - 0.3;
        let edgeFade = 1.0;
        if (phi > edgeFadeStart) {
            edgeFade = 1.0 - (phi - edgeFadeStart) / (config.irisAngle - edgeFadeStart);
        }
        edgeFade = Math.max(0, Math.min(1, edgeFade));
        
        opacities[i] = gradientOpacity * edgeFade;
        sizes[i] = 1.0 + Math.random() * 0.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Custom shader material for per-particle opacity and dynamic pupil masking
    const material = new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(config.color) },
            pointSize: { value: 2.0 },
            pupilPos: { value: new THREE.Vector3(0, 0, config.sphereRadius) },
            pupilAngle: { value: config.pupilAngle },
            sphereRadius: { value: config.sphereRadius }
        },
        vertexShader: `
            attribute float opacity;
            attribute float size;
            varying float vOpacity;
            varying float vDepth;
            uniform float pointSize;
            uniform vec3 pupilPos;
            uniform float pupilAngle;
            uniform float sphereRadius;
            
            void main() {
                // Calculate angle from pupil center (in 3D)
                vec3 particleDir = normalize(position);
                vec3 pupilDir = normalize(pupilPos);
                float angleToPupil = acos(clamp(dot(particleDir, pupilDir), -1.0, 1.0));
                
                // Create dynamic hole (pupil) based on angular distance
                float pupilMask = smoothstep(pupilAngle, pupilAngle + 0.15, angleToPupil);
                
                // Combine static opacity with dynamic pupil mask
                vOpacity = opacity * pupilMask;
                
                // Pass depth for size attenuation
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

    const irisParticles = new THREE.Points(geometry, material);
    mainGroup.add(irisParticles);

    // Mouse interaction
    const targetLook = { x: 0, y: 0 };
    const currentLook = { x: 0, y: 0 };
    const targetRotation = { x: 0, y: 0 };
    const currentRotation = { x: 0, y: 0 };
    
    const maxLookAngle = 0.25; // How far the pupil can move (radians)
    const maxRotation = 0.08; // Subtle rotation of entire eye
    const smoothing = 0.025; // Smooth and organic

    window.addEventListener('mousemove', (event) => {
        // Normalize mouse position to -1 to 1
        const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Target for pupil look direction
        targetLook.x = mouseX * maxLookAngle;
        targetLook.y = mouseY * maxLookAngle;
        
        // Target for subtle eye rotation (adds 3D depth feel)
        targetRotation.x = -mouseY * maxRotation;
        targetRotation.y = mouseX * maxRotation;
    });

    // Handle resize
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
    const positionAttribute = geometry.getAttribute('position');
    
    function animate() {
        requestAnimationFrame(animate);
        time += 0.008;

        // Smooth movement for pupil look direction
        currentLook.x += (targetLook.x - currentLook.x) * smoothing;
        currentLook.y += (targetLook.y - currentLook.y) * smoothing;
        
        // Smooth rotation for 3D effect
        currentRotation.x += (targetRotation.x - currentRotation.x) * smoothing;
        currentRotation.y += (targetRotation.y - currentRotation.y) * smoothing;
        
        // Calculate pupil position on sphere surface based on look direction
        const pupilX = config.sphereRadius * Math.sin(currentLook.x);
        const pupilY = config.sphereRadius * Math.sin(currentLook.y);
        const pupilZ = config.sphereRadius * Math.cos(Math.sqrt(currentLook.x * currentLook.x + currentLook.y * currentLook.y));
        material.uniforms.pupilPos.value.set(pupilX, pupilY, pupilZ);
        
        // Apply subtle rotation to the whole eye (3D depth feel)
        mainGroup.rotation.x = currentRotation.x;
        mainGroup.rotation.y = currentRotation.y;

        // Subtle organic floating movement for each particle
        for (let i = 0; i < config.particleCount; i++) {
            const speed = floatSpeeds[i];
            const ox = floatOffsets[i * 3];
            const oy = floatOffsets[i * 3 + 1];
            const oz = floatOffsets[i * 3 + 2];
            
            // Visible floating displacement - organic drifting motion
            const dx = Math.sin(time * speed + ox) * 0.5;
            const dy = Math.sin(time * speed * 0.8 + oy) * 0.5;
            const dz = Math.sin(time * speed * 0.6 + oz) * 0.3;
            
            // Apply floating
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
    const scriptTag = document.querySelector('script[src*="surveillance.js"]');
    if (scriptTag) {
        window.addEventListener('DOMContentLoaded', () => {
            initSurveillanceAnimation('hero-canvas');
        });
    }
}

