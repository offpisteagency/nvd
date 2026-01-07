import * as THREE from '../lib/three/three.module.js';

export function initAlarmcentraleAnimation(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`[NVD Animation] Container #${containerId} not found`);
        return null;
    }

    // Get dimensions
    const getWidth = () => container.clientWidth || window.innerWidth;
    const getHeight = () => container.clientHeight || window.innerHeight;

    // Configuration
    const config = {
        color: 0xadadad,
        sphereRadius: 35,
        particleCount: 20000,
        lineParticleCount: 8000,
        satelliteCount: 40,
        connectionDistance: 18,
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

    // Generate satellite positions using Fibonacci sphere distribution
    const satellites = [];
    const phi = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < config.satelliteCount; i++) {
        const y = 1 - (i / (config.satelliteCount - 1)) * 2;
        const radiusAtY = Math.sqrt(1 - y * y);
        const theta = phi * i;
        
        const x = Math.cos(theta) * radiusAtY;
        const z = Math.sin(theta) * radiusAtY;
        
        satellites.push({
            x: x * config.sphereRadius,
            y: y * config.sphereRadius,
            z: z * config.sphereRadius
        });
    }

    // Calculate connections between satellites
    const connections = [];
    satellites.forEach(sat => {
        connections.push({ from: { x: 0, y: 0, z: 0 }, to: sat });
    });
    for (let i = 0; i < satellites.length; i++) {
        for (let j = i + 1; j < satellites.length; j++) {
            const dx = satellites[i].x - satellites[j].x;
            const dy = satellites[i].y - satellites[j].y;
            const dz = satellites[i].z - satellites[j].z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < config.connectionDistance) {
                connections.push({ from: satellites[i], to: satellites[j] });
            }
        }
    }

    const totalParticles = config.particleCount + config.lineParticleCount;
    
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(totalParticles * 3);
    const opacities = new Float32Array(totalParticles);
    const sizes = new Float32Array(totalParticles);
    
    const originalPositions = new Float32Array(totalParticles * 3);
    const floatOffsets = new Float32Array(totalParticles * 3);
    const floatSpeeds = new Float32Array(totalParticles);

    // Sphere surface particles
    for (let i = 0; i < config.particleCount; i++) {
        const y = 1 - (i / (config.particleCount - 1)) * 2;
        const radiusAtY = Math.sqrt(1 - y * y);
        const theta = phi * i;
        
        const x = Math.cos(theta) * radiusAtY * config.sphereRadius;
        const yPos = y * config.sphereRadius;
        const z = Math.sin(theta) * radiusAtY * config.sphereRadius;

        positions[i * 3] = x;
        positions[i * 3 + 1] = yPos;
        positions[i * 3 + 2] = z;
        
        originalPositions[i * 3] = x;
        originalPositions[i * 3 + 1] = yPos;
        originalPositions[i * 3 + 2] = z;
        
        floatOffsets[i * 3] = Math.random() * Math.PI * 2;
        floatOffsets[i * 3 + 1] = Math.random() * Math.PI * 2;
        floatOffsets[i * 3 + 2] = Math.random() * Math.PI * 2;
        floatSpeeds[i] = 0.3 + Math.random() * 0.7;

        const normalizedY = (yPos / config.sphereRadius + 1) / 2;
        const gradientOpacity = 0.15 + normalizedY * 0.85;
        
        const distFromCenter = Math.sqrt(x * x + yPos * yPos + z * z);
        const normalizedDist = distFromCenter / config.sphereRadius;
        const centerBoost = 1.0 - normalizedDist * 0.4;
        
        opacities[i] = gradientOpacity * (1.0 + centerBoost * 0.5);
        sizes[i] = 1.0 + Math.random() * 0.5;
    }

    // Connection line particles
    const particlesPerConnection = Math.floor(config.lineParticleCount / connections.length);
    let lineIndex = config.particleCount;
    
    connections.forEach(conn => {
        for (let j = 0; j < particlesPerConnection && lineIndex < totalParticles; j++) {
            const t = Math.random();
            const x = conn.from.x + (conn.to.x - conn.from.x) * t;
            const y = conn.from.y + (conn.to.y - conn.from.y) * t;
            const z = conn.from.z + (conn.to.z - conn.from.z) * t;
            
            positions[lineIndex * 3] = x;
            positions[lineIndex * 3 + 1] = y;
            positions[lineIndex * 3 + 2] = z;
            
            originalPositions[lineIndex * 3] = x;
            originalPositions[lineIndex * 3 + 1] = y;
            originalPositions[lineIndex * 3 + 2] = z;
            
            floatOffsets[lineIndex * 3] = Math.random() * Math.PI * 2;
            floatOffsets[lineIndex * 3 + 1] = Math.random() * Math.PI * 2;
            floatOffsets[lineIndex * 3 + 2] = Math.random() * Math.PI * 2;
            floatSpeeds[lineIndex] = 0.3 + Math.random() * 0.7;

            const normalizedY = (y / config.sphereRadius + 1) / 2;
            const gradientOpacity = 0.1 + normalizedY * 0.5;
            
            const distFromCenter = Math.sqrt(x * x + y * y + z * z);
            const normalizedDist = distFromCenter / config.sphereRadius;
            const centerBoost = 1.0 - normalizedDist * 0.3;
            
            opacities[lineIndex] = gradientOpacity * (1.0 + centerBoost * 0.4);
            sizes[lineIndex] = 0.8 + Math.random() * 0.3;
            
            lineIndex++;
        }
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

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

    // Mouse interaction
    const targetRotation = { x: 0, y: 0 };
    const currentRotation = { x: 0, y: 0 };
    const maxRotation = 0.1;
    const smoothing = 0.025;

    function onMouseMove(event) {
        const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
        
        targetRotation.x = -mouseY * maxRotation;
        targetRotation.y = mouseX * maxRotation;
    }
    window.addEventListener('mousemove', onMouseMove);

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

    function onResize() {
        const width = getWidth();
        const height = getHeight();
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        updateCameraPosition();
    }
    window.addEventListener('resize', onResize);

    // Animation loop
    let time = 0;
    let autoRotation = 0;
    const positionAttribute = geometry.getAttribute('position');
    let animationId = null;
    let isDestroyed = false;
    
    function animate() {
        if (isDestroyed) return;
        animationId = requestAnimationFrame(animate);
        time += 0.008;
        autoRotation += 0.0008;

        currentRotation.x += (targetRotation.x - currentRotation.x) * smoothing;
        currentRotation.y += (targetRotation.y - currentRotation.y) * smoothing;
        
        mainGroup.rotation.x = currentRotation.x;
        mainGroup.rotation.y = autoRotation + currentRotation.y;

        for (let i = 0; i < totalParticles; i++) {
            const speed = floatSpeeds[i];
            const ox = floatOffsets[i * 3];
            const oy = floatOffsets[i * 3 + 1];
            const oz = floatOffsets[i * 3 + 2];
            
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

    // Cleanup function
    function destroy() {
        isDestroyed = true;
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('resize', onResize);
        
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        
        if (renderer.domElement && renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
    }

    return { scene, camera, renderer, destroy };
}

// Auto-init when loaded directly
if (typeof window !== 'undefined') {
    const scriptTag = document.querySelector('script[src*="alarmcentrale.js"]');
    if (scriptTag) {
        window.addEventListener('DOMContentLoaded', () => {
            initAlarmcentraleAnimation('hero-canvas');
        });
    }
}
