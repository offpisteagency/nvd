import * as THREE from 'three';
import { SVGLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/SVGLoader.js';

export function initAboutAnimation(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container #${containerId} not found`);
        return;
    }

    // Get dimensions - fallback to window size if container has no dimensions
    const getWidth = () => container.clientWidth || window.innerWidth;
    const getHeight = () => container.clientHeight || window.innerHeight;

    // Configuration
    const config = {
        color: 0xadadad,
        particleCount: 15000, // Reduced count slightly as precise sampling is more efficient
        logoScale: 1.0, 
        logoDepth: 8,  // Z-depth range for 3D volume
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

    // --- SVG PARSING & PARTICLE GENERATION ---
    // The exact SVG path data provided by the user
    const svgData = `
        <svg width="152" height="48" viewBox="0 0 152 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M35.0325 9.8998L33.2518 7.46069L28.4338 0.839251H18.8913C14.7339 0.839251 10.8853 2.18793 7.76904 4.46203C3.05879 7.8983 0 13.4508 0 19.7208V48H18.8984V19.771L39.4052 47.9928H62.7842L35.0325 9.8998Z" fill="#F5F5F5"/>
        <path d="M77.1651 0.839251V28.9176L56.766 0.839251H33.3799L67.7374 47.9928H77.1722C81.3296 47.9928 85.1782 46.5007 88.2945 44.2194C93.0047 40.7831 96.0635 35.2306 96.0635 28.9607V0.839251H77.1651Z" fill="#F5F5F5"/>
        <path d="M146.169 5.09385H145.789V3.4367H146.234C146.894 3.4367 147.232 3.7093 147.232 4.24017C147.232 4.81407 146.744 5.08668 146.169 5.08668V5.09385ZM147.038 5.62471C147.548 5.45254 148.23 5.05081 148.23 4.13973C148.23 3.22866 147.569 2.61171 146.342 2.61171H144.834V8.21447H145.789V5.89732H146.09C146.342 5.89732 146.787 6.78687 147.663 8.21447H148.79C147.943 6.77253 147.282 5.73232 147.067 5.62471H147.038Z" fill="#F5F5F5"/>
        <path d="M118.116 17.2604L118.935 18.3795L129.425 32.8204H118.116V17.2604ZM151.332 32.8204C151.081 32.1174 150.765 31.4502 150.392 30.8189C150.04 30.2235 149.631 29.6711 149.178 29.1546L134.143 8.50831L134.057 8.38636C130.61 3.79511 125.117 0.832317 118.935 0.832317H100.058V47.9931H140.512C140.548 47.9931 140.591 47.9931 140.626 47.9931C140.662 47.9931 140.705 47.9931 140.741 47.9931C146.967 47.9285 152 42.871 152 36.6297C152 35.2882 151.77 34.0113 151.339 32.8132L151.332 32.8204Z" fill="#F5F5F5"/>
        <path d="M146.435 10.0075C143.98 10.0075 141.983 8.02034 141.983 5.55972C141.983 3.09909 143.972 1.11194 146.435 1.11194C148.898 1.11194 150.887 3.09909 150.887 5.55972C150.887 8.02034 148.898 10.0075 146.435 10.0075ZM146.435 0C143.362 0 140.871 2.48932 140.871 5.55972C140.871 8.63012 143.362 11.1194 146.435 11.1194C149.508 11.1194 152 8.63012 152 5.55972C152 2.48932 149.508 0 146.435 0Z" fill="#F5F5F5"/>
        </svg>
    `;

    const loader = new SVGLoader();
    const svgResult = loader.parse(svgData);
    const shapePaths = svgResult.paths;

    const particles = [];
    
    // We want to sample points evenly across the total area of all shapes
    // First, let's get all shapes and their areas to distribute particles proportionally
    const shapes = [];
    let totalArea = 0;

    shapePaths.forEach((path) => {
        const pathShapes = SVGLoader.createShapes(path);
        pathShapes.forEach((shape) => {
            // Calculate approximate area to distribute particles fairly
            // Three.js ShapeUtils.area() handles signed area, so we take abs
            const area = THREE.ShapeUtils.area(shape.getPoints());
            shapes.push({ shape, area: Math.abs(area) });
            totalArea += Math.abs(area);
        });
    });

    // Generate particles
    shapes.forEach(({ shape, area }) => {
        // Number of particles for this shape based on its area contribution
        const count = Math.floor((area / totalArea) * config.particleCount);
        
        // Improve sampling: Three.js ShapeGeometry doesn't give random points inside.
        // We can triangulate the shape and sample from triangles, or use a simple bounding box rejection sampling.
        // Given the complex curves, rejection sampling on the shape's bounding box is robust.
        
        // Get bounding box of the shape
        const points = shape.getPoints();
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        points.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });
        
        const width = maxX - minX;
        const height = maxY - minY;
        
        let added = 0;
        let attempts = 0;
        // Safety break to prevent infinite loops if shape is degenerate
        const maxAttempts = count * 20; 

        // For larger shapes, triangulation is better, but for this logo rejection is fine and simpler to implement without extra libs
        // But to be safer/faster for 20k particles, let's just use Geometry vertices if we can? 
        // No, let's stick to rejection sampling but optimize:
        // Or actually, let's simply create a Geometry from the shape and use its vertices?
        // That would be regular grid-like. We want random.
        
        // Better approach: Rejection sampling
        while (added < count && attempts < maxAttempts) {
            const x = minX + Math.random() * width;
            const y = minY + Math.random() * height;
            
            // Check if point is inside shape
            // Using a simple raycasting method or Three's built-in utils?
            // Three.js Shape doesn't have a direct "isPointInside" method exposed easily without building simpler structures.
            // Let's use the Path actions.
            
            // Actually, an even easier way in Three.js for "random points in shape":
            // Use ShapeGeometry to triangulate, then sample random points from the triangles (weighted by area).
            // This is standard and fast.
            
            attempts++;
        }
    });

    // RE-IMPLEMENTATION: Triangulation Strategy
    // This is much faster and accurate than rejection sampling for complex shapes
    
    // Create a single geometry for all shapes combined to easily sample from
    const allShapes = shapes.map(s => s.shape);
    const shapeGeo = new THREE.ShapeGeometry(allShapes);
    
    // Now we have vertices and faces (triangles).
    // We can sample random points on the surface of these triangles.
    
    // 1. Calculate area of each triangle to weight probability
    const posAttribute = shapeGeo.attributes.position;
    const indexAttribute = shapeGeo.index;
    
    // If no index, vertices are just sets of 3. If index, use it.
    // ShapeGeometry usually produces indexed geometry? Actually usually non-indexed in newer Three versions?
    // Let's check. Standard is usually non-indexed or indexed.
    // We'll handle both cases or just force one.
    
    // Easier: Let's just loop through faces.
    
    const faces = [];
    let totalGeoArea = 0;
    
    if (indexAttribute) {
        for (let i = 0; i < indexAttribute.count; i += 3) {
            const a = indexAttribute.getX(i);
            const b = indexAttribute.getX(i+1);
            const c = indexAttribute.getX(i+2);
            
            const vA = new THREE.Vector3().fromBufferAttribute(posAttribute, a);
            const vB = new THREE.Vector3().fromBufferAttribute(posAttribute, b);
            const vC = new THREE.Vector3().fromBufferAttribute(posAttribute, c);
            
            // Area of triangle = 0.5 * |AB x AC|
            const area = new THREE.Vector3().crossVectors(
                new THREE.Vector3().subVectors(vB, vA),
                new THREE.Vector3().subVectors(vC, vA)
            ).length() * 0.5;
            
            faces.push({ vA, vB, vC, area });
            totalGeoArea += area;
        }
    } else {
        for (let i = 0; i < posAttribute.count; i += 3) {
            const vA = new THREE.Vector3().fromBufferAttribute(posAttribute, i);
            const vB = new THREE.Vector3().fromBufferAttribute(posAttribute, i+1);
            const vC = new THREE.Vector3().fromBufferAttribute(posAttribute, i+2);
            
            const area = new THREE.Vector3().crossVectors(
                new THREE.Vector3().subVectors(vB, vA),
                new THREE.Vector3().subVectors(vC, vA)
            ).length() * 0.5;
            
            faces.push({ vA, vB, vC, area });
            totalGeoArea += area;
        }
    }
    
    // Generate particles
    for (let i = 0; i < config.particleCount; i++) {
        // Select a random face weighted by area
        let r = Math.random() * totalGeoArea;
        let selectedFace = faces[0];
        for (let face of faces) {
            if (r < face.area) {
                selectedFace = face;
                break;
            }
            r -= face.area;
        }
        
        // Sample random point in triangle
        // P = (1 - sqrt(r1)) * A + (sqrt(r1) * (1 - r2)) * B + (sqrt(r1) * r2) * C
        const r1 = Math.random();
        const r2 = Math.random();
        const sqrtR1 = Math.sqrt(r1);
        
        const w1 = 1 - sqrtR1;
        const w2 = sqrtR1 * (1 - r2);
        const w3 = sqrtR1 * r2;
        
        const p = new THREE.Vector3()
            .addScaledVector(selectedFace.vA, w1)
            .addScaledVector(selectedFace.vB, w2)
            .addScaledVector(selectedFace.vC, w3);
            
        particles.push({
            x: p.x,
            y: p.y,
            z: (Math.random() - 0.5) * config.logoDepth // Add volume
        });
    }

    // --- PARTICLE SYSTEM SETUP ---
    
    const actualCount = particles.length;
    
    const particleGeometry = new THREE.BufferGeometry();
    const posArray = new Float32Array(actualCount * 3);
    const opacityArray = new Float32Array(actualCount);
    const sizeArray = new Float32Array(actualCount);
    
    const originalPosArray = new Float32Array(actualCount * 3);
    const floatOffsets = new Float32Array(actualCount * 3);
    const floatSpeeds = new Float32Array(actualCount);

    // Centering offsets
    // SVG viewBox="0 0 152 48"
    const cx = 152 / 2;
    const cy = 48 / 2;

    for (let i = 0; i < actualCount; i++) {
        const p = particles[i];
        
        // Transform coordinates:
        // 1. Center them (subtract cx, cy)
        // 2. Flip Y (SVG y goes down, 3D y goes up)
        // 3. Apply scale
        
        const x = (p.x - cx) * config.logoScale;
        const y = -(p.y - cy) * config.logoScale; // Flip Y!
        const z = p.z;
        
        posArray[i * 3] = x;
        posArray[i * 3 + 1] = y;
        posArray[i * 3 + 2] = z;
        
        originalPosArray[i * 3] = x;
        originalPosArray[i * 3 + 1] = y;
        originalPosArray[i * 3 + 2] = z;
        
        floatOffsets[i * 3] = Math.random() * Math.PI * 2;
        floatOffsets[i * 3 + 1] = Math.random() * Math.PI * 2;
        floatOffsets[i * 3 + 2] = Math.random() * Math.PI * 2;
        floatSpeeds[i] = 0.3 + Math.random() * 0.7;
        
        // Opacity gradient (brighter at top)
        const normalizedY = (y + 20) / 40; // Approx range -20 to 20
        opacityArray[i] = 0.2 + normalizedY * 0.6;
        sizeArray[i] = 0.8 + Math.random() * 0.6;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    particleGeometry.setAttribute('opacity', new THREE.BufferAttribute(opacityArray, 1));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizeArray, 1));

    // Shader Material (Same as others)
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

    const particleSystem = new THREE.Points(particleGeometry, material);
    mainGroup.add(particleSystem);

    // Mouse Interaction
    const targetRotation = { x: 0, y: 0 };
    const currentRotation = { x: 0, y: 0 };
    const maxRotation = 0.2; 
    const smoothing = 0.05;

    window.addEventListener('mousemove', (event) => {
        const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
        targetRotation.x = -mouseY * maxRotation;
        targetRotation.y = mouseX * maxRotation;
    });

    // Resize
    window.addEventListener('resize', () => {
        const width = getWidth();
        const height = getHeight();
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    });

    // Animate
    let time = 0;
    const posAttr = particleGeometry.getAttribute('position');
    
    function animate() {
        requestAnimationFrame(animate);
        time += 0.01;

        currentRotation.x += (targetRotation.x - currentRotation.x) * smoothing;
        currentRotation.y += (targetRotation.y - currentRotation.y) * smoothing;
        
        mainGroup.rotation.x = currentRotation.x;
        mainGroup.rotation.y = currentRotation.y;

        // Float animation
        for (let i = 0; i < actualCount; i++) {
            const speed = floatSpeeds[i];
            const ox = floatOffsets[i * 3];
            const oy = floatOffsets[i * 3 + 1];
            const oz = floatOffsets[i * 3 + 2];
            
            const dx = Math.sin(time * speed + ox) * 0.3;
            const dy = Math.sin(time * speed * 0.8 + oy) * 0.3;
            const dz = Math.sin(time * speed * 0.6 + oz) * 0.3;
            
            posAttr.array[i * 3] = originalPosArray[i * 3] + dx;
            posAttr.array[i * 3 + 1] = originalPosArray[i * 3 + 1] + dy;
            posAttr.array[i * 3 + 2] = originalPosArray[i * 3 + 2] + dz;
        }
        posAttr.needsUpdate = true;
        
        renderer.render(scene, camera);
    }
    
    animate();
    
    return { scene, camera, renderer };
}

if (typeof window !== 'undefined') {
    const scriptTag = document.querySelector('script[src*="about.js"]');
    if (scriptTag) {
        window.addEventListener('DOMContentLoaded', () => {
            initAboutAnimation('hero-canvas');
        });
    }
}
