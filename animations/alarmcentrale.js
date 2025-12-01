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
        radius: 30,
        connectionDistance: 15,
        centralNodeSize: 2.5,
        satelliteNodeSize: 0.6,
        lineOpacity: 0.4
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
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: config.color });
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
        
        // Random position on a sphere surface (or volume)
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        const r = 15 + Math.random() * (config.radius - 15); // Keep them somewhat away from center

        node.position.x = r * Math.sin(phi) * Math.cos(theta);
        node.position.y = r * Math.sin(phi) * Math.sin(theta);
        node.position.z = r * Math.cos(phi);

        // Store initial position for animation
        node.userData = {
            originalPos: node.position.clone(),
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.05,
                (Math.random() - 0.5) * 0.05,
                (Math.random() - 0.5) * 0.05
            ),
            phase: Math.random() * Math.PI * 2
        };

        satellites.push(node);
        mainGroup.add(node);
    }

    // 3. Lines
    // We will update lines in the animation loop, but we need geometry for them
    // Better approach for dynamic lines: create line segments every frame or use a large buffer
    // For simplicity with ~20 nodes, we can recreate geometry or update positions
    // Let's use a pre-allocated LineSegments for performance if we had many, 
    // but for <100 lines, individual Line objects or a single LineSegments geometry updated every frame is fine.
    // Let's go with updating a BufferGeometry for LineSegments.

    // Max possible connections: (n*(n-1)/2) + n (center connections)
    // Actually, let's just draw them.
    const lineGeometry = new THREE.BufferGeometry();
    const lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
    mainGroup.add(lineSegments);

    function updateConnections() {
        const positions = [];

        // Connect satellites to center
        const centerPos = centralNode.position;
        satellites.forEach(sat => {
            positions.push(centerPos.x, centerPos.y, centerPos.z);
            positions.push(sat.position.x, sat.position.y, sat.position.z);
        });

        // Connect satellites to each other
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
        time += 0.005;

        // Rotate entire group slowly
        mainGroup.rotation.y += 0.001;
        mainGroup.rotation.x += 0.0005;

        // Animate satellites (float)
        satellites.forEach(sat => {
            // Simple floating motion around original position
            sat.position.x = sat.userData.originalPos.x + Math.sin(time + sat.userData.phase) * 2;
            sat.position.y = sat.userData.originalPos.y + Math.cos(time + sat.userData.phase * 0.5) * 2;
            sat.position.z = sat.userData.originalPos.z + Math.sin(time * 0.8 + sat.userData.phase) * 2;
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