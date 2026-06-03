const { BlobServiceClient } = require('@azure/storage-blob');
const { randomUUID } = require('crypto');

const getExtension = (mimetype) => {
  const map = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
  };
  return map[mimetype] || '';
};

const uploadFile = async (buffer, mimetype, folder) => {
  if (process.env.ENABLE_UPLOADS === 'false') {
    return null;
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_CONTAINER_NAME;

  if (!connectionString || !containerName) {
    console.warn('Azure Blob Storage connection string or container name is missing.');
    return null;
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);

  const extension = getExtension(mimetype);
  const filename = `${folder}/${randomUUID()}${extension}`;
  const blockBlobClient = containerClient.getBlockBlobClient(filename);

  await blockBlobClient.upload(buffer, buffer.length, {
    blobHTTPHeaders: { blobContentType: mimetype },
  });

  return blockBlobClient.url;
};

module.exports = {
  uploadFile,
};
