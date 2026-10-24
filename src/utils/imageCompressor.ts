/**
 * Compress images before uploading to Firestore to ensure high quality while keeping file size small (~80KB - 200KB).
 * Firestore document limit is 1MB, so this avoids document size errors for camera & gallery photos.
 */
export async function compressImageForChat(
  file: File,
  maxWidth = 1280,
  maxHeight = 1280,
  initialQuality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio preserved dimensions
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG with compression
        let result = canvas.toDataURL('image/jpeg', initialQuality);

        // If the resulting base64 string is still greater than 600KB, compress further to 0.55
        if (result.length > 600000) {
          result = canvas.toDataURL('image/jpeg', 0.55);
        }

        // If even then greater than 600KB, resize canvas down to 800px
        if (result.length > 600000) {
          const smallCanvas = document.createElement('canvas');
          smallCanvas.width = Math.round(width * 0.7);
          smallCanvas.height = Math.round(height * 0.7);
          const smallCtx = smallCanvas.getContext('2d');
          if (smallCtx) {
            smallCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
            result = smallCanvas.toDataURL('image/jpeg', 0.55);
          }
        }

        resolve(result);
      };

      img.onerror = (err) => reject(err);
      img.src = e.target?.result as string;
    };

    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
