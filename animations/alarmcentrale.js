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
        particleCount: 40, // Increased to form a better sphere
        radius: 25, // Tighter radius for the sphere
        centralNodeSize: 2.5,
        satelliteNodeSize: 0.5,
        lineOpacity: 0.2,
        connectionDistance: 18 // Distance to connect neighbors on surface (increased for better mesh)
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

    // 2. Satellite Nodes (Fibonacci Sphere Distribution)
    const satellites = [];
    const satelliteGeometry = new THREE.SphereGeometry(config.satelliteNodeSize, 16, 16);

    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

    for (let i = 0; i < config.particleCount; i++) {
        const node = new THREE.Mesh(satelliteGeometry, nodeMaterial);
        
        const y = 1 - (i / (config.particleCount - 1)) * 2; // y goes from 1 to -1
        const radiusAtY = Math.sqrt(1 - y * y); // Radius at y
        
        const theta = phi * i; // Golden angle increment
        
        const x = Math.cos(theta) * radiusAtY;
        const z = Math.sin(theta) * radiusAtY;

        // Scale to desired radius
        node.position.set(
            x * config.radius,
            y * config.radius,
            z * config.radius
        );

        // Store original position relative to the group (rigid body)
        // We don't need to store velocity/offset because we rotate the whole group
        
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


    // 3. Connections (Calculated once, as relative positions don't change in a rigid body)
    const lineGeometry = new THREE.BufferGeometry();
    const positions = [];
    const centerPos = centralNode.position; // (0,0,0)

    // Connect all satellites to center
    satellites.forEach(sat => {
        positions.push(0, 0, 0);
        positions.push(sat.position.x, sat.position.y, sat.position.z);
    });

    // Connect satellites to neighbors (Triangular Mesh)
    for (let i = 0; i < satellites.length; i++) {
        for (let j = i + 1; j < satellites.length; j++) {
            const dist = satellites[i].position.distanceTo(satellites[j].position);
            if (dist < config.connectionDistance) {
                positions.push(satellites[i].position.x, satellites[i].position.y, satellites[i].position.z);
                positions.push(satellites[j].position.x, satellites[j].position.y, satellites[j].position.z);
            }
        }
    }
    
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
    mainGroup.add(lineSegments);


    // Mouse Parallax State (REMOVED)
    
    // Function to update camera distance based on screen width
    function updateCameraPosition() {
        const width = window.innerWidth;
        // Mobile: further away (larger z), Desktop: closer (smaller z)
        // Base Z is 80 for desktop (>1200px), maybe 120 for mobile (<600px)
        
        if (width < 600) {
            camera.position.z = 110; // Mobile
        } else if (width < 900) {
            camera.position.z = 95; // Tablet
        } else {
            camera.position.z = 80; // Desktop
        }
    }

    // Initial call
    updateCameraPosition();

    // Handle resize
    window.addEventListener('resize', () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        
        // Update responsiveness
        updateCameraPosition();
    });

    // Animation loop
    let time = 0;
    function animate() {
        requestAnimationFrame(animate);
        time += 0.002;

        // Smooth infinite loop rotation (Continuous Spin)
        // Increment rotation continuously for infinite loop
        // Y-axis spin (Globe style) - Subtle
        mainGroup.rotation.y += 0.002; 
        
        // Optional: Very slight X tilt/wobble if desired, but keeping it clean to Y-axis per request
        // mainGroup.rotation.x = Math.sin(time * 0.5) * 0.1; 

        // Background subtle rotation
        particleSystem.rotation.y = -time * 0.02;

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