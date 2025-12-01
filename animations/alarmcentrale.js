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
        lineOpacity: 0.25,
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
    container.appendChild(renderer.domElement);

    // Group to hold everything
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // Materials
    const nodeMaterial = new THREE.MeshBasicMaterial({ 
        color: config.color
    });

    const lineMaterial = new THREE.LineBasicMaterial({ 
        color: config.color, 
        transparent: true, 
        opacity: config.lineOpacity 
    });

    // 1. Central Node
    const centralGeometry = new THREE.SphereGeometry(config.centralNodeSize, 32, 32);
    const centralNode = new THREE.Mesh(centralGeometry, nodeMaterial);
    mainGroup.add(centralNode);

    // 2. Satellite Nodes
    const satellites = [];
    const satelliteGeometry = new THREE.SphereGeometry(config.satelliteNodeSize, 16, 16);

    for (let i = 0; i < config.particleCount; i++) {
        const node = new THREE.Mesh(satelliteGeometry, nodeMaterial);
        
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        const rBase = 20 + Math.random() * (config.radius - 20);
        
        let x = rBase * Math.sin(phi) * Math.cos(theta);
        let y = rBase * Math.sin(phi) * Math.sin(theta);
        let z = rBase * Math.cos(phi);
        y = Math.max(Math.min(y, config.maxVerticalSpread), -config.maxVerticalSpread) * 0.6;

        node.position.set(x, y, z);

        node.userData = {
            originalPos: node.position.clone(),
            offset: new THREE.Vector3(Math.random()*100, Math.random()*100, Math.random()*100),
        };

        satellites.push(node);
        mainGroup.add(node);
    }

    // Background Particles
    const particlesGeometry = new THREE.BufferGeometry();
    const particleCount = 40;
    const particlePositions = new Float32Array(particleCount * 3);

    for(let i = 0; i < particleCount * 3; i += 3) {
        particlePositions[i] = (Math.random() - 0.5) * 200;
        particlePositions[i+1] = (Math.random() - 0.5) * 100;
        particlePositions[i+2] = (Math.random() - 0.5) * 100 - 20;
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particlesMaterial = new THREE.PointsMaterial({
        color: 0xadadad,
        size: 0.4,
        transparent: true,
        opacity: 0.15,
        sizeAttenuation: true
    });
    const particleSystem = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particleSystem);


    // Pre-calculate neighbors
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

    // Mouse Parallax State
    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;

    // Mouse Move Listener
    document.addEventListener('mousemove', (event) => {
        const windowHalfX = window.innerWidth / 2;
        const windowHalfY = window.innerHeight / 2;
        
        mouseX = (event.clientX - windowHalfX) * 0.0001;
        mouseY = (event.clientY - windowHalfY) * 0.0001;
    });

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

        // 1. Parallax
        targetRotationY = mouseX;
        targetRotationX = mouseY;
        
        mainGroup.rotation.y += (targetRotationY - mainGroup.rotation.y) * 0.05;
        mainGroup.rotation.x += (targetRotationX - mainGroup.rotation.x) * 0.05;
        mainGroup.rotation.y += Math.sin(time * 0.1) * 0.001; 

        // 2. Background
        particleSystem.rotation.y = time * 0.02;

        // 3. Organic movement
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

if (typeof window !== 'undefined') {
    const scriptTag = document.querySelector('script[src*="alarmcentrale.js"]');
    if (scriptTag) {
        window.addEventListener('DOMContentLoaded', () => {
            initAlarmcentraleAnimation('hero-canvas');
        });
    }
}