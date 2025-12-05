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
        particleCount: 20000, // Increased slightly to fill the center
        innerRadius: 15, // Pupil size
        outerRadius: 45, // Outer edge of iris
        edgeFade: 8, // How much the edges fade out
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
        // Distribute in a full disc (flat on XY plane)
        const angle = Math.random() * Math.PI * 2;
        
        // Use sqrt for uniform distribution in disc (0 to outerRadius)
        const r = Math.sqrt(Math.random()) * config.outerRadius;
        
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        const z = (Math.random() - 0.5) * 3; // Slight depth variation

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
        // Normalize y to -1 to 1 range
        const normalizedY = y / config.outerRadius;
        // Map to opacity: top (y=1) = bright, bottom (y=-1) = dark
        const gradientOpacity = 0.15 + (normalizedY + 1) * 0.425; // Range: 0.15 to 1.0
        
        // Fade outer edge only (static)
        const distFromCenter = r;
        let edgeFade = 1.0;
        
        if (distFromCenter > config.outerRadius - config.edgeFade) {
            edgeFade *= (config.outerRadius - distFromCenter) / config.edgeFade;
        }
        edgeFade = Math.max(0, Math.min(1, edgeFade));
        
        opacities[i] = gradientOpacity * edgeFade;
        sizes[i] = 1.0 + Math.random() * 0.5; // Slightly larger particles
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Custom shader material for per-particle opacity and dynamic pupil masking
    const material = new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(config.color) },
            pointSize: { value: 2.0 },
            pupilPos: { value: new THREE.Vector2(0, 0) },
            pupilRadius: { value: config.innerRadius },
            edgeFade: { value: config.edgeFade }
        },
        vertexShader: `
            attribute float opacity;
            attribute float size;
            varying float vOpacity;
            uniform float pointSize;
            uniform vec2 pupilPos;
            uniform float pupilRadius;
            uniform float edgeFade;
            
            void main() {
                // Calculate distance from particle to dynamic pupil position
                float distToPupil = distance(position.xy, pupilPos);
                
                // Create dynamic hole (pupil)
                float pupilMask = smoothstep(pupilRadius, pupilRadius + edgeFade, distToPupil);
                
                // Combine static opacity with dynamic pupil mask
                vOpacity = opacity * pupilMask;
                
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * pointSize * (300.0 / -mvPosition.z);
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
    const targetPupilPos = { x: 0, y: 0 };
    const currentPupilPos = { x: 0, y: 0 };
    const targetEyeShift = { x: 0, y: 0 };
    const currentEyeShift = { x: 0, y: 0 };
    
    const maxLookDistance = 6; // Pupil moving inside eye
    const maxEyeShift = 4; // Entire eye shifting slightly
    const smoothing = 0.03;

    window.addEventListener('mousemove', (event) => {
        // Normalize mouse position to -1 to 1
        const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Set targets
        targetPupilPos.x = mouseX * maxLookDistance;
        targetPupilPos.y = mouseY * maxLookDistance;
        
        targetEyeShift.x = mouseX * maxEyeShift;
        targetEyeShift.y = mouseY * maxEyeShift;
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

        // Smooth movement for pupil and eye
        currentPupilPos.x += (targetPupilPos.x - currentPupilPos.x) * smoothing;
        currentPupilPos.y += (targetPupilPos.y - currentPupilPos.y) * smoothing;
        
        currentEyeShift.x += (targetEyeShift.x - currentEyeShift.x) * smoothing;
        currentEyeShift.y += (targetEyeShift.y - currentEyeShift.y) * smoothing;
        
        // Update uniform - pupil position needs to include the eye shift so it stays with the eye
        material.uniforms.pupilPos.value.set(
            currentPupilPos.x + currentEyeShift.x, 
            currentPupilPos.y + currentEyeShift.y
        );

        // Subtle organic floating movement for each particle
        for (let i = 0; i < config.particleCount; i++) {
            const speed = floatSpeeds[i];
            const ox = floatOffsets[i * 3];
            const oy = floatOffsets[i * 3 + 1];
            const oz = floatOffsets[i * 3 + 2];
            
            // Visible floating displacement - organic drifting motion
            const dx = Math.sin(time * speed + ox) * 0.6;
            const dy = Math.sin(time * speed * 0.8 + oy) * 0.6;
            const dz = Math.sin(time * speed * 0.6 + oz) * 0.3;
            
            // Apply floating + eye shift (entire eye moves)
            positionAttribute.array[i * 3] = originalPositions[i * 3] + dx + currentEyeShift.x;
            positionAttribute.array[i * 3 + 1] = originalPositions[i * 3 + 1] + dy + currentEyeShift.y;
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
