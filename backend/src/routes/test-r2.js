require('dotenv').config();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

(async () => {
  const r2 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: 'debug/test.txt',
    Body: Buffer.from('hello'),
    ContentType: 'text/plain',
  }));

  console.log('✅ OK');
})();
