import * as THREE from '../lib/three/three.module.js';

export function initSurveillanceAnimation(containerId) {
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
        particleCount: 30000,
        headRadius: 16,
        bodyWidth: 68,
        bodyHeight: 32,
        bodyDepth: 18,
        gapSize: 4,
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
    const sizes = new Float32Array(config.particleCount);
    
    const originalPositions = new Float32Array(config.particleCount * 3);
    const floatOffsets = new Float32Array(config.particleCount * 3);
    const floatSpeeds = new Float32Array(config.particleCount);

    const headCenterY = config.gapSize / 2 + config.headRadius;
    const bodyTopY = -config.gapSize / 2;
    const bodyBottomY = bodyTopY - config.bodyHeight;
    
    const absoluteTop = headCenterY + config.headRadius;
    const absoluteBottom = bodyBottomY;
    const visualCenterY = (absoluteTop + absoluteBottom) / 2;

    function isInsideEllipsoid(x, y, z, width, height, depth) {
        const dx = x / (width / 2);
        const dy = y / height;
        const dz = z / (depth / 2);
        return (dx*dx + dy*dy + dz*dz) <= 1;
    }

    const headParticles = Math.floor(config.particleCount * 0.35);
    const bodyParticles = config.particleCount - headParticles;

    for (let i = 0; i < config.particleCount; i++) {
        let x, y, z;

        if (i < headParticles) {
            const u = Math.random();
            const v = Math.random();
            const theta = 2 * Math.PI * u;
            const phi = Math.acos(2 * v - 1);
            const r = config.headRadius * Math.cbrt(Math.random());
            
            x = r * Math.sin(phi) * Math.cos(theta);
            y = r * Math.sin(phi) * Math.sin(theta) + headCenterY;
            z = r * Math.cos(phi);

        } else {
            do {
                x = (Math.random() - 0.5) * config.bodyWidth;
                y = Math.random() * config.bodyHeight; 
                z = (Math.random() - 0.5) * config.bodyDepth;
            } while (!isInsideEllipsoid(x, y, z, config.bodyWidth, config.bodyHeight, config.bodyDepth));

            y = bodyBottomY + y;
        }

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

        const totalH = absoluteTop - absoluteBottom;
        const relativeY = (y - (absoluteBottom - visualCenterY)) / totalH;
        
        let opacity = 0.15 + relativeY * 0.85;
        
        const normalizedZ = (z + 10) / 25; 
        opacity *= 0.6 + normalizedZ * 0.4;

        opacities[i] = opacity;
        sizes[i] = 1.0 + Math.random() * 0.5;
    }

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

    const humanGroup = new THREE.Points(geometry, material);
    mainGroup.add(humanGroup);

    // Interaction
    const targetRotation = { x: 0, y: 0 };
    const currentRotation = { x: 0, y: 0 };
    const maxRotation = 0.12; 
    const smoothing = 0.03;

    function onMouseMove(event) {
        const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
        
        targetRotation.x = -mouseY * maxRotation;
        targetRotation.y = mouseX * maxRotation;
    }
    window.addEventListener('mousemove', onMouseMove);

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

    function onResize() {
        const width = getWidth();
        const height = getHeight();
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        updateCameraPosition();
    }
    window.addEventListener('resize', onResize);

    // Animate
    let time = 0;
    const positionAttribute = geometry.getAttribute('position');
    let animationId = null;
    let isDestroyed = false;

    function animate() {
        if (isDestroyed) return;
        animationId = requestAnimationFrame(animate);
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
    const scriptTag = document.querySelector('script[src*="surveillance.js"]');
    if (scriptTag) {
        window.addEventListener('DOMContentLoaded', () => {
            initSurveillanceAnimation('hero-canvas');
        });
    }
}
