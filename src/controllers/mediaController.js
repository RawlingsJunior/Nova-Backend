const path = require('path');
const fs = require('fs');

const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Return the URL to the uploaded file
    // We assume the server is configured to serve the 'uploads' folder as static
    const protocol = req.protocol;
    const host = req.get('host');
    const imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    res.json({ url: imageUrl });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Server error during upload' });
  }
};

module.exports = { uploadImage };
