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
        particleCount: 25000,
        // Human dimensions
        headRadius: 12,
        headY: 10, // Offset head upwards
        bodyWidth: 36,
        bodyHeight: 22,
        bodyDepth: 14,
        bodyY: -12, // Offset body downwards
        neckRadius: 8,
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

    // Distribution: ~30% head, ~70% body
    const headParticles = Math.floor(config.particleCount * 0.3);
    const bodyParticles = config.particleCount - headParticles;

    // Helper for rounded box (body)
    function isInsideRoundedRect(x, y, width, height, radius) {
        const hw = width / 2;
        const hh = height / 2;
        const r = Math.min(radius, hw, hh);
        
        // Simple bounding box check first
        if (x < -hw || x > hw || y < -hh || y > hh) return false;

        // Check corners
        if (x > hw - r && y > hh - r) return (x - (hw - r))**2 + (y - (hh - r))**2 <= r**2;
        if (x > hw - r && y < -hh + r) return (x - (hw - r))**2 + (y - (-hh + r))**2 <= r**2;
        if (x < -hw + r && y > hh - r) return (x - (-hw + r))**2 + (y - (hh - r))**2 <= r**2;
        if (x < -hw + r && y < -hh + r) return (x - (-hw + r))**2 + (y - (-hh + r))**2 <= r**2;
        
        return true;
    }

    // Calculate bounds for gradient
    const totalTop = config.headY + config.headRadius;
    const totalBottom = config.bodyY - config.bodyHeight/2;
    const totalHeight = totalTop - totalBottom;

    for (let i = 0; i < config.particleCount; i++) {
        let x, y, z;

        if (i < headParticles) {
            // Head (Sphere)
            // Use spherical distribution for surface, or random inside for volume?
            // Let's do surface + volume for a solid look
            const u = Math.random();
            const v = Math.random();
            const theta = 2 * Math.PI * u;
            const phi = Math.acos(2 * v - 1);
            // Random radius for volume (cube root for uniform volume)
            const r = config.headRadius * Math.cbrt(Math.random());
            
            x = r * Math.sin(phi) * Math.cos(theta);
            y = r * Math.sin(phi) * Math.sin(theta) + config.headY;
            z = r * Math.cos(phi);

        } else {
            // Body (Shoulders/Bust)
            // Generate points in a rounded volume
            const cornerRadius = 8;
            
            // Rejection sampling for the body shape
            do {
                x = (Math.random() - 0.5) * config.bodyWidth;
                y = (Math.random() - 0.5) * config.bodyHeight;
                z = (Math.random() - 0.5) * config.bodyDepth;
                
                // Curve the shoulders: top of body is rounded
                // Simple hack: if y is near top, x width reduces? 
                // Or just use the rounded rect logic
            } while (!isInsideRoundedRect(x, y, config.bodyWidth, config.bodyHeight, cornerRadius));

            y += config.bodyY; // Move to body position
            
            // Optional: Connect head and body with "neck" particles or just let them overlap slightly
            // By tuning headY and bodyY they should merge naturally
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

        // Gradient Opacity
        const normalizedY = (y - totalBottom) / totalHeight;
        // Brighter at top (head), darker at bottom (base of bust)
        let opacity = 0.1 + normalizedY * 0.9;
        
        // Depth fade (particles further back are dimmer)
        const normalizedZ = (z + 20) / 40; // Approx range
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

    const humanGroup = new THREE.Points(geometry, material);
    mainGroup.add(humanGroup);

    // Interaction
    const targetRotation = { x: 0, y: 0 };
    const currentRotation = { x: 0, y: 0 };
    const maxRotation = 0.15; // Subtle tilt
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

        // Smooth Rotation
        currentRotation.x += (targetRotation.x - currentRotation.x) * smoothing;
        currentRotation.y += (targetRotation.y - currentRotation.y) * smoothing;
        
        mainGroup.rotation.x = currentRotation.x;
        mainGroup.rotation.y = currentRotation.y;

        // Organic Floating
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
