const https = require('https');

exports.handler = async (event) => {
  // CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const noteId = event.queryStringParameters && event.queryStringParameters.note_id;
  if (!noteId) {
    return { statusCode: 400, headers, body: JSON.stringify({ message: '缺少 note_id 参数' }) };
  }

  const apiKey = process.env.TIKHUB_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ message: '未配置 TIKHUB_API_KEY' }) };
  }

  try {
    // 先试图文接口
    let noteData;
    try {
      const rawData = await callTikHub('/api/v1/xiaohongshu/app_v2/get_image_note_detail', noteId, apiKey);
      noteData = parseNoteData(rawData);
    } catch (e) {
      // 图文失败，试视频接口
      const rawData = await callTikHub('/api/v1/xiaohongshu/app_v2/get_video_note_detail', noteId, apiKey);
      noteData = parseNoteData(rawData);
    }

    return { statusCode: 200, headers, body: JSON.stringify(noteData) };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: err.message }),
    };
  }
};

// 调用 TikHub API
function callTikHub(path, noteId, apiKey) {
  return new Promise((resolve, reject) => {
    const url = 'https://api.tikhub.io' + path + '?note_id=' + encodeURIComponent(noteId) + '&share_text=';

    https.get(url, { headers: { Authorization: 'Bearer ' + apiKey } }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('TikHub 返回解析失败'));
        }
      });
    }).on('error', reject);
  });
}

// 解析 TikHub 返回数据
function parseNoteData(rawData) {
  var outer = rawData.data || rawData;
  var inner = outer.data || outer;
  var dataArr = Array.isArray(inner) ? inner : [inner];
  var noteItem = dataArr[0] || {};
  var note = noteItem.note_list ? noteItem.note_list[0] : noteItem;

  var title = note.title || '';
  var content = note.desc || '';

  var images = [];
  (note.images_list || []).forEach(function (img) {
    var url = img.original || img.url_size_large || img.url;
    if (url) images.push(url);
  });

  var tags = [];
  (note.hash_tag || []).forEach(function (tag) {
    if (tag.name) tags.push(tag.name);
  });

  var author = note.user ? (note.user.nickname || '') : '';

  return { title: title, content: content, images: images, tags: tags, author: author };
}
