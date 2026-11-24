# Optional Galal image storage

Local uploads are enabled for development and verification. The existing authenticated Cloudinary upload adapter remains available. No credentials were copied from cg and no Cloudinary assets were uploaded, edited or deleted during the rebrand.

Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET and optionally CLOUDINARY_UPLOAD_PRESET in the new project's ignored environment, then set UPLOAD_STORAGE=cloudinary. The Galal namespace is galal/products. Keep server secrets out of Vite/client variables.

The adapter retains unique IDs, WebP validation, no overwriting and a bounded timeout. Official reference: https://cloudinary.com/documentation/node_image_and_video_upload
