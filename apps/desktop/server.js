import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { cloneDemoWorkOrders, cloneDemoQuickReplies } from './src/data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8'
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function pad(num) {
  return String(num).padStart(2, '0');
}

let workOrderCounter = 0;
function generateWorkOrderCode() {
  const now = new Date();
  workOrderCounter += 1;
  return `GX-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(workOrderCounter)}`;
}

function randomId(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeWatchers(list, owner) {
  const items = Array.isArray(list) ? list : [];
  const normalized = items
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((value) => value.length > 0);
  if (owner && !normalized.includes(owner)) {
    normalized.unshift(owner);
  }
  return Array.from(new Set(normalized));
}

function cloneDataset() {
  const workOrders = cloneDemoWorkOrders().map((wo) => ({
    ...wo,
    watchers: normalizeWatchers(wo.watchers, wo.owner)
  }));
  return {
    workOrders,
    quickReplies: cloneDemoQuickReplies(),
    lastUpdatedAt: Date.now()
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function serveStatic(staticRoot, pathname, res) {
  const normalized = path.normalize(pathname);
  const safePath = path.join(staticRoot, normalized);
  if (!safePath.startsWith(staticRoot)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  let filePath = safePath;
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const type = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(filePath).pipe(res);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk.toString();
      if (raw.length > 1e6) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function upsertWorkOrder(dataset, payload, existingId = null) {
  if (existingId) {
    const target = dataset.workOrders.find((item) => item.id === existingId);
    if (!target) {
      return null;
    }
    const watchers = normalizeWatchers(payload.watchers, payload.owner || target.owner);
    Object.assign(target, payload, { id: existingId, watchers });
    dataset.lastUpdatedAt = Date.now();
    return target;
  }
  const workOrder = {
    id: randomId('wo'),
    code: generateWorkOrderCode(),
    title: payload.title,
    customer: payload.customer,
    status: payload.status || 'pending',
    priority: payload.priority || 'medium',
    owner: payload.owner,
    startDate: payload.startDate,
    dueDate: payload.dueDate,
    quantity: Number(payload.quantity) || 0,
    unread: 0,
    procurement: {
      autoNotify: payload.procurement?.autoNotify ?? false,
      vendor: payload.procurement?.vendor || '默认工厂'
    },
    steps: payload.steps || [],
    messages: payload.messages || [
      {
        id: randomId('msg'),
        type: 'system',
        sender: '系统',
        role: 'system',
        text: '工单创建成功，等待排产确认。',
        timestamp: Date.now(),
        system: true,
        attachments: [],
        voice: null
      }
    ],
    timeline: payload.timeline || [],
    flashOrders: payload.flashOrders || [],
    customerAccess: payload.customerAccess || {
      enabled: false,
      contact: '',
      company: '',
      expiresAt: ''
    },
    watchers: normalizeWatchers(payload.watchers, payload.owner)
  };
  dataset.workOrders.unshift(workOrder);
  dataset.lastUpdatedAt = Date.now();
  return workOrder;
}

function recordStepProgress(workOrder, payload) {
  const step = workOrder.steps.find((item) => item.code === payload.stepCode);
  if (!step) return null;
  const completed = Number(payload.completed) || 0;
  const defects = Number(payload.defects) || 0;
  step.completed += completed;
  step.defects += defects;
  const confirmationText = payload.confirmation === 'fingerprint' ? '指纹确认' : '双人复核';
  const summary = `${step.name} ${confirmationText}：完成 ${completed} 件，缺陷 ${defects} 件。`;
  const timelineEntry = {
    id: randomId('timeline'),
    step: step.name,
    text: summary,
    by: payload.by || '系统',
    timestamp: Date.now()
  };
  const message = {
    id: randomId('msg'),
    type: 'system',
    sender: '系统',
    role: 'system',
    text: summary,
    timestamp: Date.now(),
    system: true,
    attachments: [],
    voice: null
  };
  workOrder.timeline.push(timelineEntry);
  workOrder.messages.push(message);
  if (workOrder.procurement.autoNotify && defects > 0) {
    workOrder.messages.push({
      id: randomId('msg'),
      type: 'system',
      sender: '系统',
      role: 'system',
      text: `检测到 ${defects} 件不良，已通知 ${workOrder.procurement.vendor} 补料 ${defects} 件。`,
      timestamp: Date.now(),
      system: true,
      attachments: [],
      voice: null
    });
  }
  return { message, timelineEntry };
}

function sanitizeMessage(message) {
  return {
    ...message,
    attachments: (message.attachments || []).map((att) => ({
      id: att.id || randomId('att'),
      name: att.name,
      type: att.type || 'file',
      size: att.size || '',
      preview: att.preview || ''
    })),
    voice: message.voice ? { duration: message.voice.duration || 0 } : null
  };
}

async function handleApi(req, res, pathname, dataset) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (pathname === '/api/bootstrap' && req.method === 'GET') {
    sendJson(res, 200, {
      mode: 'live',
      workOrders: dataset.workOrders,
      quickReplies: dataset.quickReplies,
      lastUpdatedAt: dataset.lastUpdatedAt
    });
    return;
  }

  if (pathname === '/api/work-orders' && req.method === 'GET') {
    sendJson(res, 200, { workOrders: dataset.workOrders, lastUpdatedAt: dataset.lastUpdatedAt });
    return;
  }

  if (pathname === '/api/quick-replies' && req.method === 'GET') {
    sendJson(res, 200, dataset.quickReplies);
    return;
  }

  if (pathname === '/api/work-orders' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const created = upsertWorkOrder(dataset, body);
      sendJson(res, 201, created);
    } catch (error) {
      sendJson(res, 400, { message: error.message });
    }
    return;
  }

  const workOrderIdMatch = pathname.match(/^\/api\/work-orders\/([^/]+)(.*)$/);
  if (workOrderIdMatch) {
    const workOrderId = decodeURIComponent(workOrderIdMatch[1]);
    const remainder = workOrderIdMatch[2] || '';
    const workOrder = dataset.workOrders.find((item) => item.id === workOrderId);
    if (!workOrder) {
      sendJson(res, 404, { message: 'Work order not found' });
      return;
    }

    if ((remainder === '' || remainder === '/') && req.method === 'GET') {
      sendJson(res, 200, workOrder);
      return;
    }

    if ((remainder === '' || remainder === '/') && req.method === 'PATCH') {
      try {
        const body = await parseBody(req);
        const updated = upsertWorkOrder(dataset, { ...workOrder, ...body }, workOrderId);
        sendJson(res, 200, updated);
      } catch (error) {
        sendJson(res, 400, { message: error.message });
      }
      return;
    }

    if (remainder === '/messages' && req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const message = sanitizeMessage(body.message || body);
        workOrder.messages.push(message);
        workOrder.unread = 0;
        dataset.workOrders
          .filter((item) => item.id !== workOrder.id)
          .forEach((item) => {
            item.unread += 1;
          });
        dataset.lastUpdatedAt = Date.now();
        sendJson(res, 201, message);
      } catch (error) {
        sendJson(res, 400, { message: error.message });
      }
      return;
    }

    if (remainder === '/steps/progress' && req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const result = recordStepProgress(workOrder, body);
        if (!result) {
          sendJson(res, 404, { message: 'Step not found' });
          return;
        }
        dataset.lastUpdatedAt = Date.now();
        sendJson(res, 201, {
          workOrder,
          ...result
        });
      } catch (error) {
        sendJson(res, 400, { message: error.message });
      }
      return;
    }

    if (remainder === '/flash-orders' && req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const flashOrder = {
          id: randomId('flash'),
          note: body.note,
          quantity: Number(body.quantity) || 0,
          createdAt: Date.now(),
          status: 'completed'
        };
        workOrder.flashOrders.push(flashOrder);
        workOrder.messages.push({
          id: randomId('msg'),
          type: 'system',
          sender: '系统',
          role: 'system',
          text: `闪电工单：${flashOrder.note}（${flashOrder.quantity} 件）已记录。`,
          timestamp: Date.now(),
          system: true,
          attachments: [],
          voice: null
        });
        dataset.lastUpdatedAt = Date.now();
        sendJson(res, 201, flashOrder);
      } catch (error) {
        sendJson(res, 400, { message: error.message });
      }
      return;
    }
  }

  const quickReplyMatch = pathname.match(/^\/api\/quick-replies\/([^/]+)$/);
  if (quickReplyMatch && req.method === 'PUT') {
    try {
      const role = decodeURIComponent(quickReplyMatch[1]);
      const body = await parseBody(req);
      dataset.quickReplies[role] = Array.isArray(body.replies) ? body.replies : [];
      dataset.lastUpdatedAt = Date.now();
      sendJson(res, 200, dataset.quickReplies[role]);
    } catch (error) {
      sendJson(res, 400, { message: error.message });
    }
    return;
  }

  sendJson(res, 404, { message: 'Not found' });
}

export function createDesktopServer(options = {}) {
  const dataset = cloneDataset();
  const staticRoot = options.staticRoot || __dirname;
  return http.createServer((req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = requestUrl.pathname;

    if (pathname.startsWith('/api/')) {
      handleApi(req, res, pathname, dataset);
      return;
    }

    const resolvedPath = pathname === '/' ? '/index.html' : pathname;
    serveStatic(staticRoot, resolvedPath, res);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const port = Number(process.env.PORT) || 4173;
  const server = createDesktopServer();
  server.listen(port, () => {
    console.log(`工小聊演示/联机服务已启动: http://localhost:${port}`);
  });
}
