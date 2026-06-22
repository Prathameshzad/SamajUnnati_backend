const Jimp = require('jimp');

async function padImage() {
  try {
    const image = await Jimp.read('d:/samajUnati/mobile/assets/images/front_image2.png');
    
    // Create a transparent canvas that is 1.6x the size of the original
    const newWidth = Math.floor(image.bitmap.width * 1.6);
    const newHeight = Math.floor(image.bitmap.height * 1.6);
    
    new Jimp(newWidth, newHeight, 0x00000000, (err, bg) => {
      if (err) throw err;
      
      const x = Math.floor((newWidth - image.bitmap.width) / 2);
      const y = Math.floor((newHeight - image.bitmap.height) / 2);
      
      bg.composite(image, x, y);
      bg.write('d:/samajUnati/mobile/assets/images/adaptive-icon.png', () => {
          console.log('Successfully created padded adaptive-icon.png!');
      });
    });
  } catch (err) {
    console.error('Error processing image:', err);
  }
}

padImage();
