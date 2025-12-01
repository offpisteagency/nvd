import * as THREE from 'three';

export function initAlarmcentraleAnimation(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container #${containerId} not found`);
        return;
    }

    // Configuration
    const config = {
        color: 0xadadad,
        particleCount: 20,
        radius: 45,
        centralNodeSize: 2.5,
        satelliteNodeSize: 0.6,
        lineOpacity: 0.3, // Reduced opacity for subtler lines
        maxVerticalSpread: 30
    };

    // Scene setup
    const scene = new THREE.Scene();
    
    // Camera setup
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 80;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Enable shadow map for depth
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    container.appendChild(renderer.domElement);

    // Lighting (New Premium Feature)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); // Soft fill
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    mainLight.position.set(10, 20, 30);
    scene.add(mainLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.5, 100);
    pointLight.position.set(-10, -10, 20);
    scene.add(pointLight);

    // Group to hold everything
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // Materials (New Premium Feature)
    // MeshPhysicalMaterial for high-end look (roughness/metalness)
    const nodeMaterial = new THREE.MeshPhysicalMaterial({ 
        color: config.color,
        metalness: 0.1,
        roughness: 0.4,
        clearcoat: 0.8,
        clearcoatRoughness: 0.2
    });

    const lineMaterial = new THREE.LineBasicMaterial({ 
        color: config.color, 
        transparent: true, 
        opacity: config.lineOpacity 
    });

    // 1. Central Node
    const centralGeometry = new THREE.SphereGeometry(config.centralNodeSize, 64, 64); // Higher poly for smooth shading
    const centralNode = new THREE.Mesh(centralGeometry, nodeMaterial);
    mainGroup.add(centralNode);

    // 2. Satellite Nodes
    const satellites = [];
    const satelliteGeometry = new THREE.SphereGeometry(config.satelliteNodeSize, 32, 32); // Higher poly

    for (let i = 0; i < config.particleCount; i++) {
        const node = new THREE.Mesh(satelliteGeometry, nodeMaterial);
        
        // Random position - Flatter distribution (ellipsoid-like)
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        
        const rBase = 20 + Math.random() * (config.radius - 20);
        
        let x = rBase * Math.sin(phi) * Math.cos(theta);
        let y = rBase * Math.sin(phi) * Math.sin(theta);
        let z = rBase * Math.cos(phi);
        
        y = Math.max(Math.min(y, config.maxVerticalSpread), -config.maxVerticalSpread) * 0.6;

        node.position.set(x, y, z);

        // Store initial position for animation
        node.userData = {
            originalPos: node.position.clone(),
            offset: new THREE.Vector3(Math.random()*100, Math.random()*100, Math.random()*100),
        };

        satellites.push(node);
        mainGroup.add(node);
    }

    // Background Particles (New Premium Feature: Depth)
    const particlesGeometry = new THREE.BufferGeometry();
    const particleCount = 50;
    const particlePositions = new Float32Array(particleCount * 3);

    for(let i = 0; i < particleCount * 3; i += 3) {
        // Spread wide in background
        particlePositions[i] = (Math.random() - 0.5) * 200; // x
        particlePositions[i+1] = (Math.random() - 0.5) * 100; // y
        particlePositions[i+2] = (Math.random() - 0.5) * 100 - 20; // z (behind)
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particlesMaterial = new THREE.PointsMaterial({
        color: 0xadadad,
        size: 0.3,
        transparent: true,
        opacity: 0.2, // Very faint
        sizeAttenuation: true
    });

    const particleSystem = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particleSystem);


    // Pre-calculate fixed neighbors for each satellite (2 neighbors each)
    satellites.forEach((sat, index) => {
        const distances = satellites.map((other, otherIndex) => {
            if (index === otherIndex) return { index: -1, dist: Infinity };
            return { 
                index: otherIndex, 
                dist: sat.position.distanceTo(other.position) 
            };
        }).sort((a, b) => a.dist - b.dist);

        sat.userData.neighbors = [distances[0].index, distances[1].index];
    });

    // 3. Lines
    const lineGeometry = new THREE.BufferGeometry();
    const lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
    mainGroup.add(lineSegments);

    function updateConnections() {
        const positions = [];
        const centerPos = centralNode.position;

        satellites.forEach((sat) => {
            positions.push(centerPos.x, centerPos.y, centerPos.z);
            positions.push(sat.position.x, sat.position.y, sat.position.z);

            sat.userData.neighbors.forEach(neighborIndex => {
                const neighbor = satellites[neighborIndex];
                positions.push(sat.position.x, sat.position.y, sat.position.z);
                positions.push(neighbor.position.x, neighbor.position.y, neighbor.position.z);
            });
        });

        lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    }

    // Handle resize
    window.addEventListener('resize', () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        
        renderer.setSize(width, height);
    });

    // Animation loop
    let time = 0;
    function animate() {
        requestAnimationFrame(animate);
        time += 0.002;

        // Pulse Animation (New Premium Feature)
        // Heartbeat pattern: small pulses
        const pulseScale = 1 + Math.sin(time * 3) * 0.05;
        centralNode.scale.set(pulseScale, pulseScale, pulseScale);

        // Gentle sway
        mainGroup.rotation.y = Math.sin(time * 0.1) * 0.1;
        mainGroup.rotation.x = Math.cos(time * 0.05) * 0.05;

        // Rotate background particles slowly for depth
        particleSystem.rotation.y = time * 0.02;

        // Organic node movement
        satellites.forEach(sat => {
            const ox = sat.userData.offset.x;
            const oy = sat.userData.offset.y;
            const oz = sat.userData.offset.z;

            const floatX = Math.sin(time + ox) * 2;
            const floatY = Math.cos(time * 0.8 + oy) * 1.5;
            const floatZ = Math.sin(time * 0.5 + oz) * 2;

            sat.position.x = sat.userData.originalPos.x + floatX;
            sat.position.y = sat.userData.originalPos.y + floatY;
            sat.position.z = sat.userData.originalPos.z + floatZ;
        });

        updateConnections();
        renderer.render(scene, camera);
    }
    
    animate();

    return { scene, camera, renderer };
}

// Auto-init if running directly (for local testing)
if (typeof window !== 'undefined') {
    const scriptTag = document.querySelector('script[src*="alarmcentrale.js"]');
    if (scriptTag) {
        window.addEventListener('DOMContentLoaded', () => {
            initAlarmcentraleAnimation('hero-canvas');
        });
    }
}