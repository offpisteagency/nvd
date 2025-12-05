import * as THREE from 'three';

export function initFamilyOfficeAnimation(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container #${containerId} not found`);
        return;
    }

    // Configuration
    const config = {
        color: 0xadadad,
        particleCount: 25000,
        // Lock dimensions (bigger)
        bodyWidth: 44,
        bodyHeight: 38,
        bodyDepth: 16,
        shackleRadius: 16,
        shackleThickness: 5,
        shackleLegsHeight: 8, // Height of vertical legs connecting to body
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

    // Create particle system for the lock
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.particleCount * 3);
    const opacities = new Float32Array(config.particleCount);
    const sizes = new Float32Array(config.particleCount);
    
    // Store original positions and random offsets for floating animation
    const originalPositions = new Float32Array(config.particleCount * 3);
    const floatOffsets = new Float32Array(config.particleCount * 3);
    const floatSpeeds = new Float32Array(config.particleCount);

    // Calculate how many particles for each part (roughly proportional to surface area)
    const bodyParticles = Math.floor(config.particleCount * 0.6);
    const shackleArcParticles = Math.floor(config.particleCount * 0.25);
    const shackleLegsParticles = config.particleCount - bodyParticles - shackleArcParticles;

    // Helper to check if point is inside rounded rectangle
    function isInsideRoundedRect(x, y, width, height, radius) {
        const hw = width / 2;
        const hh = height / 2;
        const r = Math.min(radius, hw, hh);
        
        // Check corners
        if (x > hw - r && y > hh - r) {
            return Math.sqrt((x - (hw - r)) ** 2 + (y - (hh - r)) ** 2) <= r;
        }
        if (x > hw - r && y < -hh + r) {
            return Math.sqrt((x - (hw - r)) ** 2 + (y - (-hh + r)) ** 2) <= r;
        }
        if (x < -hw + r && y > hh - r) {
            return Math.sqrt((x - (-hw + r)) ** 2 + (y - (hh - r)) ** 2) <= r;
        }
        if (x < -hw + r && y < -hh + r) {
            return Math.sqrt((x - (-hw + r)) ** 2 + (y - (-hh + r)) ** 2) <= r;
        }
        
        return x >= -hw && x <= hw && y >= -hh && y <= hh;
    }

    // Body top Y position (shackle connects here)
    const bodyTopY = config.bodyHeight / 2;
    
    // Calculate bounds for the full lock (for gradient calculation)
    const lockTop = bodyTopY + config.shackleLegsHeight + config.shackleRadius;
    const lockBottom = -config.bodyHeight / 2;
    const lockTotalHeight = lockTop - lockBottom;
    const lockCenterY = (lockTop + lockBottom) / 2; // Center point to shift everything to y=0

    for (let i = 0; i < config.particleCount; i++) {
        let x, y, z;
        
        if (i < bodyParticles) {
            // Lock body - rounded rectangle with 3D depth
            const cornerRadius = 5;
            
            // Generate point on surface of rounded box
            const face = Math.random();
            
            if (face < 0.4) {
                // Front face
                do {
                    x = (Math.random() - 0.5) * config.bodyWidth;
                    y = (Math.random() - 0.5) * config.bodyHeight;
                } while (!isInsideRoundedRect(x, y, config.bodyWidth, config.bodyHeight, cornerRadius));
                z = config.bodyDepth / 2;
            } else if (face < 0.8) {
                // Back face
                do {
                    x = (Math.random() - 0.5) * config.bodyWidth;
                    y = (Math.random() - 0.5) * config.bodyHeight;
                } while (!isInsideRoundedRect(x, y, config.bodyWidth, config.bodyHeight, cornerRadius));
                z = -config.bodyDepth / 2;
            } else if (face < 0.85) {
                // Top edge
                x = (Math.random() - 0.5) * config.bodyWidth;
                y = config.bodyHeight / 2;
                z = (Math.random() - 0.5) * config.bodyDepth;
            } else if (face < 0.9) {
                // Bottom edge
                x = (Math.random() - 0.5) * config.bodyWidth;
                y = -config.bodyHeight / 2;
                z = (Math.random() - 0.5) * config.bodyDepth;
            } else if (face < 0.95) {
                // Left edge
                x = -config.bodyWidth / 2;
                y = (Math.random() - 0.5) * config.bodyHeight;
                z = (Math.random() - 0.5) * config.bodyDepth;
            } else {
                // Right edge
                x = config.bodyWidth / 2;
                y = (Math.random() - 0.5) * config.bodyHeight;
                z = (Math.random() - 0.5) * config.bodyDepth;
            }
            
        } else if (i < bodyParticles + shackleArcParticles) {
            // Shackle arc - curved top part
            const angle = Math.random() * Math.PI; // Half circle (0 to PI)
            const tubeAngle = Math.random() * Math.PI * 2; // Around the tube
            
            // Position along the shackle arc (sitting on top of legs)
            const arcX = Math.cos(angle) * config.shackleRadius;
            const arcY = Math.sin(angle) * config.shackleRadius + bodyTopY + config.shackleLegsHeight;
            
            // Add tube thickness
            const tubeOffsetX = Math.cos(tubeAngle) * config.shackleThickness * 0.5;
            const tubeOffsetZ = Math.sin(tubeAngle) * config.shackleThickness * 0.5;
            
            x = arcX + tubeOffsetX * Math.sin(angle);
            y = arcY + Math.cos(tubeAngle) * config.shackleThickness * 0.3;
            z = tubeOffsetZ;
            
        } else {
            // Shackle legs - vertical parts connecting arc to body
            const isLeftLeg = Math.random() < 0.5;
            const tubeAngle = Math.random() * Math.PI * 2;
            
            // X position at left or right side of shackle
            const legX = isLeftLeg ? -config.shackleRadius : config.shackleRadius;
            
            // Y position: from body top to where arc starts
            const legY = bodyTopY + Math.random() * config.shackleLegsHeight;
            
            // Add tube thickness
            const tubeOffsetX = Math.cos(tubeAngle) * config.shackleThickness * 0.5;
            const tubeOffsetZ = Math.sin(tubeAngle) * config.shackleThickness * 0.5;
            
            x = legX + tubeOffsetX;
            y = legY;
            z = tubeOffsetZ;
        }

        // Center the lock vertically (shift down by center offset)
        positions[i * 3] = x;
        positions[i * 3 + 1] = y - lockCenterY;
        positions[i * 3 + 2] = z;
        
        // Store original positions
        originalPositions[i * 3] = x;
        originalPositions[i * 3 + 1] = y - lockCenterY;
        originalPositions[i * 3 + 2] = z;
        
        // Random offsets for organic floating
        floatOffsets[i * 3] = Math.random() * Math.PI * 2;
        floatOffsets[i * 3 + 1] = Math.random() * Math.PI * 2;
        floatOffsets[i * 3 + 2] = Math.random() * Math.PI * 2;
        floatSpeeds[i] = 0.3 + Math.random() * 0.7;

        // Calculate base opacity based on Y position (gradient: bright top, dark bottom)
        // Use the original y (before centering) for gradient calculation
        const normalizedY = (y - lockBottom) / lockTotalHeight; // 0 at bottom, 1 at top
        const gradientOpacity = 0.15 + normalizedY * 0.85; // Range: 0.15 to 1.0
        
        // Consistent opacity for all parts (no depth variation to keep shackle same as body)
        opacities[i] = gradientOpacity;
        sizes[i] = 1.0 + Math.random() * 0.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Custom shader material (same style as surveillance eye)
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

    const lockParticles = new THREE.Points(geometry, material);
    mainGroup.add(lockParticles);

    // Mouse interaction - subtle rotation
    const targetRotation = { x: 0, y: 0 };
    const currentRotation = { x: 0, y: 0 };
    const maxRotation = 0.12; // Subtle rotation
    const smoothing = 0.025;

    window.addEventListener('mousemove', (event) => {
        const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
        
        targetRotation.x = -mouseY * maxRotation;
        targetRotation.y = mouseX * maxRotation;
    });

    // Handle resize
    function updateCameraPosition() {
        const width = window.innerWidth;
        if (width < 600) {
            camera.position.z = 130;
        } else if (width < 900) {
            camera.position.z = 110;
        } else {
            camera.position.z = 95;
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

        // Smooth rotation for 3D effect
        currentRotation.x += (targetRotation.x - currentRotation.x) * smoothing;
        currentRotation.y += (targetRotation.y - currentRotation.y) * smoothing;
        
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
    const scriptTag = document.querySelector('script[src*="familyoffice.js"]');
    if (scriptTag) {
        window.addEventListener('DOMContentLoaded', () => {
            initFamilyOfficeAnimation('hero-canvas');
        });
    }
}
