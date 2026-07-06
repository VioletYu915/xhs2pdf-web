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

  // 清洗1: 移除 desc 末尾的话题标签 #xxx[话题]#（与 hash_tag 重复）
  content = content.replace(/#[^\s#]*\[话题\]#/g, '');

  // 清洗2: 移除菱形/方块等乱码装饰字符（TikHub 抓取时原帖图标转换而来）
  //   ◆◇◆菱形系列 + ■□▲▼等几何块 + �替换字符
  //   注意：❶❷❸❹ 带圈数字保留（用户确认正常显示）
  content = content.replace(/[\u25C6\u25C7\u25C8\u25C9\u25CB\u25CC\u25CE\u25CF]+/g, '');
  content = content.replace(/[\u25A0-\u25A9\u25B0-\u25B9\u25C0\u25CA]+/g, '');
  content = content.replace(/[\uFFFD]/g, '');

  // 清洗3: 清理小红书表情码 [笑哭R][赞R] 等
  content = content.replace(/\[\w+R\]/g, '');

  content = content.trim();

  var images = [];
  (note.images_list || []).forEach(function (img) {
    var url = img.original || img.url_size_large || img.url;
    if (url) {
      // 将 WebP 格式改为 JPG（pdf-lib 不支持 WebP）
      url = url.replace('format/webp', 'format/jpg');
      images.push(url);
    }
  });

  var tags = [];
  (note.hash_tag || []).forEach(function (tag) {
    if (tag.name) tags.push(tag.name);
  });

  var author = note.user ? (note.user.nickname || '') : '';

  return { title: title, content: content, images: images, tags: tags, author: author };
}
