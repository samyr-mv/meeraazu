const https = require('https');

const REPO = 'samyr-mv/meeraazu';
const FILE = 'settings.json';

function githubRequest(method, path, body) {
  const token = process.env.GITHUB_TOKEN;
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'Authorization': 'token ' + token,
        'User-Agent': 'meeraazu-blog',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      }
    };
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch(e) { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (event.httpMethod === 'GET') {
      const res = await githubRequest('GET', `/repos/${REPO}/contents/${FILE}`);
      if (res.status === 404) {
        return { statusCode: 200, headers, body: JSON.stringify({ morning_img: '', morning_msg: '', breaking: '' }) };
      }
      const content = Buffer.from(res.data.content, 'base64').toString('utf8');
      return { statusCode: 200, headers, body: content };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      const current = await githubRequest('GET', `/repos/${REPO}/contents/${FILE}`);
      const sha = current.status === 200 ? current.data.sha : undefined;
      const content = Buffer.from(JSON.stringify(body, null, 2)).toString('base64');
      const payload = { message: 'Update settings', content };
      if (sha) payload.sha = sha;
      const result = await githubRequest('PUT', `/repos/${REPO}/contents/${FILE}`, payload);
      if (result.status === 200 || result.status === 201) {
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      } else {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'GitHub error', detail: result.data }) };
      }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
