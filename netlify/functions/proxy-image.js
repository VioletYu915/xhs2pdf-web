const https = require('https');
const http = require('http');

exports.handler = async (event) => {
  // CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const imgUrl = event.queryStringParameters && event.queryStringParameters.url;
  if (!imgUrl) {
    return { statusCode: 400, headers, body: JSON.stringify({ message: '缺少 url 参数' }) };
  }

  try {
    const client = imgUrl.startsWith('https') ? https : http;

    const imageBuffer = await new Promise((resolve, reject) => {
      client.get(imgUrl, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error('HTTP ' + res.statusCode));
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      },
      body: imageBuffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: err.message }),
    };
  }
};
