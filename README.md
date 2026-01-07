# NVD Particle Animations

Beautiful Three.js particle animations for the NVD website. Self-contained with no external CDN dependencies.

## 🎨 Available Animations

| Animation | File | Description |
|-----------|------|-------------|
| **Home** | `animations/home.js` | Torus ring with animated fill/empty cycle |
| **About** | `animations/about.js` | NVD logo created from particles |
| **Family Office** | `animations/familyoffice.js` | 3D padlock shape |
| **Surveillance** | `animations/surveillance.js` | Human silhouette figure |
| **Alarmcentrale** | `animations/alarmcentrale.js` | Connected sphere network |

## 📁 File Structure

```
nvd-dots/
├── lib/
│   └── three/
│       ├── three.module.js      # Three.js v0.160.0 (local copy)
│       └── SVGLoader.js         # SVG parsing for about animation
├── animations/
│   ├── home.js
│   ├── about.js
│   ├── familyoffice.js
│   ├── surveillance.js
│   └── alarmcentrale.js
├── *.html                        # Test files for local development
└── style.css
```

## 🚀 Webflow Integration Guide

### Step 1: Enable GitHub Pages

1. Go to your GitHub repository settings
2. Navigate to **Pages** in the sidebar
3. Under "Source", select **Deploy from a branch**
4. Choose **main** branch and **/ (root)** folder
5. Click **Save**
6. Your files will be available at: `https://YOUR-USERNAME.github.io/nvd-dots/`

### Step 2: Add Container in Webflow

Add an HTML Embed or a Div block where you want the animation to appear:

```html
<div id="hero-canvas" style="width: 100%; height: 100vh; position: absolute; top: 0; left: 0; z-index: 1;"></div>
```

**Important styling notes:**
- The container needs explicit dimensions (`width` and `height`)
- Use `position: absolute` or `fixed` for full-screen backgrounds
- Adjust `z-index` based on your layout needs

### Step 3: Add Script in Webflow

In Webflow, go to **Project Settings → Custom Code → Footer Code** and add:

```html
<script type="module" crossorigin>
    import { initHomeAnimation } from 'https://YOUR-USERNAME.github.io/nvd-dots/animations/home.js';
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        initHomeAnimation('hero-canvas');
    });
</script>
```

### Available Animation Functions

Replace `initHomeAnimation` with the appropriate function for each page:

```javascript
// Home page
import { initHomeAnimation } from 'https://YOUR-USERNAME.github.io/nvd-dots/animations/home.js';
initHomeAnimation('hero-canvas');

// About page
import { initAboutAnimation } from 'https://YOUR-USERNAME.github.io/nvd-dots/animations/about.js';
initAboutAnimation('hero-canvas');

// Family Office page
import { initFamilyOfficeAnimation } from 'https://YOUR-USERNAME.github.io/nvd-dots/animations/familyoffice.js';
initFamilyOfficeAnimation('hero-canvas');

// Surveillance page
import { initSurveillanceAnimation } from 'https://YOUR-USERNAME.github.io/nvd-dots/animations/surveillance.js';
initSurveillanceAnimation('hero-canvas');

// Alarmcentrale page
import { initAlarmcentraleAnimation } from 'https://YOUR-USERNAME.github.io/nvd-dots/animations/alarmcentrale.js';
initAlarmcentraleAnimation('hero-canvas');
```

### Complete Webflow Example

Here's a complete example for the Home page:

**HTML Embed (in the hero section):**
```html
<div id="hero-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0;"></div>
```

**Footer Code (Project Settings → Custom Code):**
```html
<script type="module" crossorigin>
    import { initHomeAnimation } from 'https://YOUR-USERNAME.github.io/nvd-dots/animations/home.js';
    
    document.addEventListener('DOMContentLoaded', () => {
        const animation = initHomeAnimation('hero-canvas');
        
        // Optional: Store reference for cleanup if needed
        window.nvdAnimation = animation;
    });
</script>
```

## ⚙️ Configuration

Each animation can be customized by modifying the `config` object at the top of each file:

```javascript
const config = {
    color: 0xadadad,        // Particle color (hex)
    particleCount: 25000,   // Number of particles (affects performance)
    // ... animation-specific settings
};
```

## 🔧 API Reference

All animation functions return an object with:

```javascript
{
    scene,      // Three.js Scene
    camera,     // Three.js Camera  
    renderer,   // Three.js WebGLRenderer
    destroy()   // Cleanup function - removes event listeners and disposes resources
}
```

### Cleanup Example

```javascript
const animation = initHomeAnimation('hero-canvas');

// Later, when navigating away or cleaning up:
if (animation) {
    animation.destroy();
}
```

## 🌐 Browser Support

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 16.4+
- ✅ Edge 80+

## 📱 Responsive Behavior

All animations automatically:
- Resize with the container/window
- Adjust camera distance on mobile (zoom out for smaller screens)
- Respond to mouse movement for subtle 3D rotation

## 🔒 Security Notes

This package is fully self-contained:
- **No external CDN dependencies** - Three.js is bundled locally
- **No tracking or analytics**
- **No external network requests** (except loading from your own GitHub Pages)

The only cross-origin request is from the client's website to your GitHub Pages, which uses HTTPS and proper CORS headers.

## 🛠️ Local Development

To test locally, you need a local server (ES modules don't work with `file://` protocol):

```bash
# Using Python
python3 -m http.server 8000

# Using Node.js
npx serve

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## 📝 Version Info

- **Three.js**: v0.160.0
- **Last Updated**: January 2026

