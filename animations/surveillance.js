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
        particleCount: 30000,
        
        // Dimensions for "User Icon" shape
        headRadius: 16,
        
        bodyWidth: 68,
        bodyHeight: 32, // Height of the semi-ellipse
        bodyDepth: 18,
        
        gapSize: 4, // Clear space between head and body
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

    // Calculate layout to center everything
    // Head sits on top. Body sits below gap.
    // Total visual height calculation:
    // Head top = Head Center Y + Radius
    // Head bottom = Head Center Y - Radius
    // Gap
    // Body top
    // Body bottom
    
    // Let's establish relative Y positions first (centering comes later)
    // Arbitrary anchor: Gap center is 0
    const headCenterY = config.gapSize / 2 + config.headRadius;
    const bodyTopY = -config.gapSize / 2;
    const bodyBottomY = bodyTopY - config.bodyHeight;
    
    // Calculate total bounds to center it in view
    const absoluteTop = headCenterY + config.headRadius;
    const absoluteBottom = bodyBottomY;
    const visualCenterY = (absoluteTop + absoluteBottom) / 2;

    // Helper for semi-ellipsoid body
    function isInsideEllipsoid(x, y, z, width, height, depth) {
        // Normalized distance from center
        const dx = x / (width / 2);
        const dy = y / height; // Semi-ellipse (height is radius)
        const dz = z / (depth / 2);
        return (dx*dx + dy*dy + dz*dz) <= 1;
    }

    // Distribution
    const headParticles = Math.floor(config.particleCount * 0.35);
    const bodyParticles = config.particleCount - headParticles;

    for (let i = 0; i < config.particleCount; i++) {
        let x, y, z;

        if (i < headParticles) {
            // Head (Sphere)
            const u = Math.random();
            const v = Math.random();
            const theta = 2 * Math.PI * u;
            const phi = Math.acos(2 * v - 1);
            const r = config.headRadius * Math.cbrt(Math.random());
            
            x = r * Math.sin(phi) * Math.cos(theta);
            y = r * Math.sin(phi) * Math.sin(theta) + headCenterY;
            z = r * Math.cos(phi);

        } else {
            // Body (Semi-Ellipsoid)
            // Rejection sampling for the perfect curved shape
            do {
                x = (Math.random() - 0.5) * config.bodyWidth;
                // y goes from 0 (top) down to -height (bottom) in local generation space?
                // Actually, let's generate 0 to height (bottom to top)
                y = Math.random() * config.bodyHeight; 
                z = (Math.random() - 0.5) * config.bodyDepth;
            } while (!isInsideEllipsoid(x, y, z, config.bodyWidth, config.bodyHeight, config.bodyDepth));

            // Flip Y so the flat side is at the bottom? 
            // No, the reference body is an arch (flat bottom, curved top).
            // My isInsideEllipsoid treats y=0 as the center (flat side) if using semi-circle logic?
            // Let's assume standard ellipse at (0,0). We want the top half.
            // My previous logic was generating 0 to height. That creates a bottom-flat, top-curved shape if treated as radius.
            
            // Position: The generated shape's "base" (y=0) corresponds to the widest part (shoulders)? 
            // Wait, an icon body is usually widest at the bottom.
            // Reference image: It's a "hill". Rounded top, wider bottom.
            // That's exactly a semi-ellipse (top half).
            // So y=0 is the flat bottom (widest), y=height is the top point?
            // No, ellipse equation x^2 + y^2 = 1.
            // If y goes 0 to 1, x width goes 1 to 0. That makes it pointy at top. Correct.
            
            // So we generated y from 0 to height.
            // At y=0, width is max. At y=height, width is 0.
            // Position this:
            // y=0 corresponds to the bottom of the body.
            // y=height corresponds to the top (neck area).
            
            // Shift to world space:
            // We want the bottom at bodyBottomY.
            y = bodyBottomY + y;
        }

        // Apply Global Centering Shift
        y -= visualCenterY;

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

        // Gradient Opacity
        // Brightest at top (head), darker at bottom
        // Recalculate Y range in centered space
        const totalH = absoluteTop - absoluteBottom;
        const relativeY = (y - (absoluteBottom - visualCenterY)) / totalH;
        
        let opacity = 0.15 + relativeY * 0.85;
        
        // Depth fade
        const normalizedZ = (z + 10) / 25; 
        opacity *= 0.6 + normalizedZ * 0.4;

        opacities[i] = opacity;
        sizes[i] = 1.0 + Math.random() * 0.5;
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
                
                // Size attenuation
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

    const humanGroup = new THREE.Points(geometry, material);
    mainGroup.add(humanGroup);

    // Interaction
    const targetRotation = { x: 0, y: 0 };
    const currentRotation = { x: 0, y: 0 };
    const maxRotation = 0.12; 
    const smoothing = 0.03;

    window.addEventListener('mousemove', (event) => {
        const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
        
        targetRotation.x = -mouseY * maxRotation;
        targetRotation.y = mouseX * maxRotation;
    });

    // Resize
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

    // Animate
    let time = 0;
    const positionAttribute = geometry.getAttribute('position');

    function animate() {
        requestAnimationFrame(animate);
        time += 0.008;

        currentRotation.x += (targetRotation.x - currentRotation.x) * smoothing;
        currentRotation.y += (targetRotation.y - currentRotation.y) * smoothing;
        
        mainGroup.rotation.x = currentRotation.x;
        mainGroup.rotation.y = currentRotation.y;

        for (let i = 0; i < config.particleCount; i++) {
            const speed = floatSpeeds[i];
            const ox = floatOffsets[i * 3];
            const oy = floatOffsets[i * 3 + 1];
            const oz = floatOffsets[i * 3 + 2];
            
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
    const scriptTag = document.querySelector('script[src*="surveillance.js"]');
    if (scriptTag) {
        window.addEventListener('DOMContentLoaded', () => {
            initSurveillanceAnimation('hero-canvas');
        });
    }
}
