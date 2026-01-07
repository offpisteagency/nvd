import * as THREE from '../lib/three/three.module.js';

export function initFamilyOfficeAnimation(containerId) {
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
        particleCount: 25000,
        bodyWidth: 44,
        bodyHeight: 38,
        bodyDepth: 16,
        shackleRadius: 16,
        shackleThickness: 5,
        shackleLegsHeight: 8,
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

    // Create particle system for the lock
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.particleCount * 3);
    const opacities = new Float32Array(config.particleCount);
    const sizes = new Float32Array(config.particleCount);
    
    const originalPositions = new Float32Array(config.particleCount * 3);
    const floatOffsets = new Float32Array(config.particleCount * 3);
    const floatSpeeds = new Float32Array(config.particleCount);

    const bodyParticles = Math.floor(config.particleCount * 0.6);
    const shackleArcParticles = Math.floor(config.particleCount * 0.25);
    const shackleLegsParticles = config.particleCount - bodyParticles - shackleArcParticles;

    function isInsideRoundedRect(x, y, width, height, radius) {
        const hw = width / 2;
        const hh = height / 2;
        const r = Math.min(radius, hw, hh);
        
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

    const bodyTopY = config.bodyHeight / 2;
    const lockTop = bodyTopY + config.shackleLegsHeight + config.shackleRadius;
    const lockBottom = -config.bodyHeight / 2;
    const lockTotalHeight = lockTop - lockBottom;
    const lockCenterY = (lockTop + lockBottom) / 2;

    for (let i = 0; i < config.particleCount; i++) {
        let x, y, z;
        
        if (i < bodyParticles) {
            const cornerRadius = 5;
            const face = Math.random();
            
            if (face < 0.4) {
                do {
                    x = (Math.random() - 0.5) * config.bodyWidth;
                    y = (Math.random() - 0.5) * config.bodyHeight;
                } while (!isInsideRoundedRect(x, y, config.bodyWidth, config.bodyHeight, cornerRadius));
                z = config.bodyDepth / 2;
            } else if (face < 0.8) {
                do {
                    x = (Math.random() - 0.5) * config.bodyWidth;
                    y = (Math.random() - 0.5) * config.bodyHeight;
                } while (!isInsideRoundedRect(x, y, config.bodyWidth, config.bodyHeight, cornerRadius));
                z = -config.bodyDepth / 2;
            } else if (face < 0.85) {
                x = (Math.random() - 0.5) * config.bodyWidth;
                y = config.bodyHeight / 2;
                z = (Math.random() - 0.5) * config.bodyDepth;
            } else if (face < 0.9) {
                x = (Math.random() - 0.5) * config.bodyWidth;
                y = -config.bodyHeight / 2;
                z = (Math.random() - 0.5) * config.bodyDepth;
            } else if (face < 0.95) {
                x = -config.bodyWidth / 2;
                y = (Math.random() - 0.5) * config.bodyHeight;
                z = (Math.random() - 0.5) * config.bodyDepth;
            } else {
                x = config.bodyWidth / 2;
                y = (Math.random() - 0.5) * config.bodyHeight;
                z = (Math.random() - 0.5) * config.bodyDepth;
            }
            
        } else if (i < bodyParticles + shackleArcParticles) {
            const angle = Math.random() * Math.PI;
            const tubeAngle = Math.random() * Math.PI * 2;
            
            const arcX = Math.cos(angle) * config.shackleRadius;
            const arcY = Math.sin(angle) * config.shackleRadius + bodyTopY + config.shackleLegsHeight;
            
            const tubeOffsetX = Math.cos(tubeAngle) * config.shackleThickness * 0.5;
            const tubeOffsetZ = Math.sin(tubeAngle) * config.shackleThickness * 0.5;
            
            x = arcX + tubeOffsetX * Math.sin(angle);
            y = arcY + Math.cos(tubeAngle) * config.shackleThickness * 0.3;
            z = tubeOffsetZ;
            
        } else {
            const isLeftLeg = Math.random() < 0.5;
            const tubeAngle = Math.random() * Math.PI * 2;
            
            const legX = isLeftLeg ? -config.shackleRadius : config.shackleRadius;
            const legY = bodyTopY + Math.random() * config.shackleLegsHeight;
            
            const tubeOffsetX = Math.cos(tubeAngle) * config.shackleThickness * 0.5;
            const tubeOffsetZ = Math.sin(tubeAngle) * config.shackleThickness * 0.5;
            
            x = legX + tubeOffsetX;
            y = legY;
            z = tubeOffsetZ;
        }

        positions[i * 3] = x;
        positions[i * 3 + 1] = y - lockCenterY;
        positions[i * 3 + 2] = z;
        
        originalPositions[i * 3] = x;
        originalPositions[i * 3 + 1] = y - lockCenterY;
        originalPositions[i * 3 + 2] = z;
        
        floatOffsets[i * 3] = Math.random() * Math.PI * 2;
        floatOffsets[i * 3 + 1] = Math.random() * Math.PI * 2;
        floatOffsets[i * 3 + 2] = Math.random() * Math.PI * 2;
        floatSpeeds[i] = 0.3 + Math.random() * 0.7;

        const normalizedY = (y - lockBottom) / lockTotalHeight;
        const gradientOpacity = 0.15 + normalizedY * 0.85;
        
        opacities[i] = gradientOpacity;
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

    const lockParticles = new THREE.Points(geometry, material);
    mainGroup.add(lockParticles);

    // Mouse interaction
    const targetRotation = { x: 0, y: 0 };
    const currentRotation = { x: 0, y: 0 };
    const maxRotation = 0.12;
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
            camera.position.z = 130;
        } else if (width < 900) {
            camera.position.z = 110;
        } else {
            camera.position.z = 95;
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
    const scriptTag = document.querySelector('script[src*="familyoffice.js"]');
    if (scriptTag) {
        window.addEventListener('DOMContentLoaded', () => {
            initFamilyOfficeAnimation('hero-canvas');
        });
    }
}
