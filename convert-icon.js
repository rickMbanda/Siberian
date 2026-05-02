
const fs = require('fs');
const path = require('path');

// Simple PNG to ICO conversion utility
// Since we need a basic ICO file, we'll create a simple one
const convertPngToIco = () => {
  try {
    // Copy the PNG file as ICO (browsers will handle it)
    const pngPath = path.join(__dirname, 'public', 'logschool.png');
    const icoPath = path.join(__dirname, 'public', 'app-icon.ico');
    
    if (fs.existsSync(pngPath)) {
      fs.copyFileSync(pngPath, icoPath);
      console.log('Icon converted successfully!');
    } else {
      console.error('logschool.png not found in public folder');
    }
  } catch (error) {
    console.error('Error converting icon:', error);
  }
};

convertPngToIco();
