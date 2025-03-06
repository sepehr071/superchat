// 3D Particles Background using Three.js
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize particles on dashboard page
  if (!document.querySelector('.dashboard-container')) {
    return;
  }

  // Load Three.js from CDN
  const threeScript = document.createElement('script');
  threeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  document.head.appendChild(threeScript);

  threeScript.onload = initParticles;

  // Initialize the particle system
  function initParticles() {
    // Get theme colors from CSS variables
    const style = getComputedStyle(document.documentElement);
    const primaryColor = style.getPropertyValue('--primary-color').trim();
    const primaryLight = style.getPropertyValue('--primary-light').trim();
    const primaryDark = style.getPropertyValue('--primary-dark').trim();
    const accentCyan = style.getPropertyValue('--accent-cyan').trim();
    const accentBlue = style.getPropertyValue('--accent-blue').trim();
    
    // Convert CSS color names to hex for Three.js
    const colorToHex = (color) => {
      // If color is already in hex format, return it
      if (color.startsWith('#')) return color;
      
      // Create a temporary element to get computed color
      const tempElem = document.createElement('div');
      tempElem.style.color = color;
      tempElem.style.display = 'none';
      document.body.appendChild(tempElem);
      
      // Get computed color
      const computedColor = getComputedStyle(tempElem).color;
      document.body.removeChild(tempElem);
      
      // Convert RGB to hex
      if (computedColor.startsWith('rgb')) {
        const rgb = computedColor.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
          return `#${Number(rgb[0]).toString(16).padStart(2, '0')}${Number(rgb[1]).toString(16).padStart(2, '0')}${Number(rgb[2]).toString(16).padStart(2, '0')}`;
        }
      }
      
      return color;
    };

    // Get color values for particles
    const colors = [
      colorToHex(primaryColor),
      colorToHex(primaryLight),
      colorToHex(primaryDark),
      colorToHex(accentCyan),
      colorToHex(accentBlue)
    ];

    // Create container for particles
    const particlesContainer = document.createElement('div');
    particlesContainer.className = 'particles-container';
    particlesContainer.style.position = 'fixed';
    particlesContainer.style.top = '0';
    particlesContainer.style.left = '0';
    particlesContainer.style.width = '100%';
    particlesContainer.style.height = '100%';
    particlesContainer.style.zIndex = '-1';
    particlesContainer.style.pointerEvents = 'none';
    
    // Insert before the first child of body to ensure it's behind everything
    document.body.insertBefore(particlesContainer, document.body.firstChild);

    // Initialize Three.js components
    const scene = new THREE.Scene();
    
    // Perspective camera with sensible defaults
    const camera = new THREE.PerspectiveCamera(
      75, // Field of view
      window.innerWidth / window.innerHeight, // Aspect ratio
      0.1, // Near clipping plane
      1000 // Far clipping plane
    );
    camera.position.z = 50;

    // Renderer with transparency
    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // Transparent background
    particlesContainer.appendChild(renderer.domElement);

    // Determine particle count based on window size and device performance
    // Lower count for mobile devices or smaller screens
    const isMobile = window.innerWidth < 768;
    const particleCount = isMobile ? 50 : 150;

    // Create particles
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colorArray = new Float32Array(particleCount * 3);
    
    // Random positions and colors for each particle
    for (let i = 0; i < particleCount; i++) {
      // Position (x, y, z)
      positions[i * 3] = (Math.random() - 0.5) * 100; // x
      positions[i * 3 + 1] = (Math.random() - 0.5) * 100; // y
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100; // z
      
      // Color from the theme palette
      const color = new THREE.Color(colors[Math.floor(Math.random() * colors.length)]);
      colorArray[i * 3] = color.r;
      colorArray[i * 3 + 1] = color.g;
      colorArray[i * 3 + 2] = color.b;
    }
    
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

    // Material for particles
    const particleMaterial = new THREE.PointsMaterial({
      size: isMobile ? 1 : 2,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });

    // Create particle system
    const particleSystem = new THREE.Points(particles, particleMaterial);
    scene.add(particleSystem);

    // Variables for animation
    let lastTime = 0;
    const rotationSpeed = 0.00015;
    
    // Animation loop with throttling for performance
    function animate(timestamp) {
      requestAnimationFrame(animate);
      
      // Throttle updates to improve performance
      // Only update every 40ms (~25fps) which is sufficient for this effect
      if (timestamp - lastTime >= 40) {
        lastTime = timestamp;
        
        // Gentle rotation of the particle system
        particleSystem.rotation.x += rotationSpeed;
        particleSystem.rotation.y += rotationSpeed * 1.5;
        
        renderer.render(scene, camera);
      }
    }
    
    // Handle window resize
    function handleResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    // Debounce resize handler for performance
    let resizeTimeout;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 100);
    });

    // Start animation loop
    animate(0);
  }
});