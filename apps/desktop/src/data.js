import { generateWorkOrderCode, randomId, formatDateTime, DAY_MS } from './utils.js';

const now = Date.now();

const demoLicense = {
  plan: '旗舰版',
  tier: 'enterprise',
  status: 'trial',
  activationCode: 'GX-DEMO-9999',
  autoRenew: true,
  seats: 30,
  seatsUsed: 18,
  expiresAt: now + 14 * DAY_MS,
  lastRenewedAt: now - 3 * DAY_MS,
  lastVerifiedAt: now - 2 * 60 * 60 * 1000,
  suspendedAt: null
};

export const demoQuickReplies = {
  manager: [
    '大家辛苦了，保持同步。',
    '确认收货后请立刻更新进度。',
    '库存不足，请检查采购状态。'
  ],
  worker: [
    '材料已领取，准备开工。',
    '本批次有轻微划痕，建议复检。',
    '完成数量已更新，请查收。'
  ]
};

function createMessage({ type = 'text', sender = '张经理', role = 'manager', text = '', timestamp = Date.now(), attachments = [], voice = null, system = false }) {
  return {
    id: randomId('msg'),
    type,
    sender,
    role,
    text,
    timestamp,
    attachments,
    voice,
    system
  };
}

function createTimelineEntry({
  step,
  text,
  timestamp = Date.now(),
  by = '系统',
  category = 'progress',
  confirmation = null
}) {
  return {
    id: randomId('timeline'),
    step,
    text,
    by,
    timestamp,
    category,
    confirmation
  };
}

const demoWorkOrders = [
  {
    id: randomId('wo'),
    code: 'GX-240518-01',
    title: '智能表带组装',
    customer: '星河电子',
    status: 'in-progress',
    priority: 'high',
    owner: '张经理',
    pinned: true,
    startDate: '2024-05-15',
    dueDate: '2024-05-22',
    quantity: 500,
    unread: 4,
    procurement: {
      autoNotify: true,
      vendor: '苏州精工'
    },
    watchers: ['张经理', '李工', '王工'],
    steps: [
      { code: 'CUT', name: '裁剪', assignee: '李工', completed: 220, defects: 3, eta: '2024-05-18' },
      { code: 'ASSEMBLE', name: '组装', assignee: '王工', completed: 160, defects: 2, eta: '2024-05-20' },
      { code: 'QC', name: '品质检验', assignee: '赵工', completed: 120, defects: 6, eta: '2024-05-21' }
    ],
    messages: [
      createMessage({ system: true, role: 'system', text: '工单创建成功，已同步至所有终端。' }),
      createMessage({ text: '本批次材料已到位，请按计划开工。', timestamp: Date.now() - 1000 * 60 * 50 }),
      createMessage({ sender: '李工', role: 'worker', text: '裁剪工序完成 200 件，无缺陷。', timestamp: Date.now() - 1000 * 60 * 34 }),
      createMessage({ sender: 'OCR 机器人', role: 'bot', type: 'attachment', text: '自动导入最新品质数据，可下载 Excel 样表。', attachments: [
        { id: randomId('att'), name: 'QC-Report-240518.xlsx', type: 'excel', url: '#', preview: '良品率 98.6%' }
      ], timestamp: Date.now() - 1000 * 60 * 30 }),
      createMessage({ sender: '李工', role: 'worker', type: 'voice', text: '语音备注：今日裁剪加班到 21:00，预计可完成 300 件。', voice: { duration: 42 }, timestamp: Date.now() - 1000 * 60 * 12 }),
      createMessage({ sender: '系统', role: 'system', system: true, text: '指纹确认：王工确认组装工序阶段完成 120 件，缺陷 1 件。', timestamp: Date.now() - 1000 * 60 * 8 })
    ],
    timeline: [
      createTimelineEntry({
        step: '裁剪',
        text: '李工 完成 200 件，缺陷 0 件。',
        timestamp: Date.now() - 1000 * 60 * 34,
        by: '李工',
        category: 'progress',
        confirmation: 'fingerprint'
      }),
      createTimelineEntry({ step: '裁剪', text: 'OCR 自动判定 3 件尺寸异常，建议复检。', timestamp: Date.now() - 1000 * 60 * 32, by: 'OCR 机器人', category: 'automation' }),
      createTimelineEntry({
        step: '组装',
        text: '王工 指纹确认完成 120 件，缺陷 1 件，自动补料通知苏州精工。',
        timestamp: Date.now() - 1000 * 60 * 8,
        by: '系统',
        category: 'automation',
        confirmation: 'fingerprint'
      })
    ],
    flashOrders: [
      { id: randomId('flash'), note: '补单 30 件备用扣具', quantity: 30, createdAt: Date.now() - 1000 * 60 * 16, status: 'completed' }
    ],
    customerAccess: {
      enabled: true,
      contact: '王小姐',
      company: '星河电子',
      expiresAt: formatDateTime(Date.now() + 1000 * 60 * 60 * 48)
    }
  },
  {
    id: randomId('wo'),
    code: 'GX-240517-02',
    title: '新能源电池壳冲压',
    customer: '南动动力',
    status: 'pending',
    priority: 'medium',
    owner: '陈主管',
    pinned: false,
    startDate: '2024-05-12',
    dueDate: '2024-05-25',
    quantity: 1200,
    unread: 0,
    procurement: {
      autoNotify: false,
      vendor: '默认工厂'
    },
    watchers: ['陈主管', '刘工'],
    steps: [
      { code: 'STAMP', name: '冲压', assignee: '刘工', completed: 600, defects: 12, eta: '2024-05-19' },
      { code: 'POLISH', name: '抛光', assignee: '吴工', completed: 320, defects: 4, eta: '2024-05-21' },
      { code: 'PACK', name: '包装', assignee: '钱工', completed: 0, defects: 0, eta: '2024-05-24' }
    ],
    messages: [
      createMessage({ system: true, role: 'system', text: '工单创建成功，等待排产确认。', timestamp: Date.now() - 1000 * 60 * 220 }),
      createMessage({ sender: '陈主管', role: 'manager', text: '请确认冲压模具是否完成维护。', timestamp: Date.now() - 1000 * 60 * 190 }),
      createMessage({ sender: '刘工', role: 'worker', text: '模具已校准，预计下午试产。', timestamp: Date.now() - 1000 * 60 * 172 })
    ],
    timeline: [
      createTimelineEntry({ step: '冲压', text: '刘工 更新预计开工时间为 5 月 18 日 09:00。', timestamp: Date.now() - 1000 * 60 * 180, by: '刘工', category: 'progress' }),
      createTimelineEntry({
        step: '冲压',
        text: '双人复核完成试产 100 件，缺陷 2 件，待老板确认排产。',
        timestamp: Date.now() - 1000 * 60 * 120,
        by: '系统',
        category: 'progress',
        confirmation: 'dual'
      })
    ],
    flashOrders: [],
    customerAccess: {
      enabled: false,
      contact: '',
      company: '',
      expiresAt: ''
    }
  }
];

export function cloneDemoWorkOrders() {
  return JSON.parse(JSON.stringify(demoWorkOrders));
}

export function cloneDemoQuickReplies() {
  return JSON.parse(JSON.stringify(demoQuickReplies));
}

export function cloneDemoLicense() {
  return JSON.parse(JSON.stringify(demoLicense));
}

export function createDemoState() {
  const [first] = demoWorkOrders;
  return {
    session: null,
    mode: 'demo',
    activeView: 'workspace',
    selectedWorkOrderId: first?.id ?? null,
    filters: {
      search: '',
      status: 'all',
      owner: 'all',
      priority: 'all',
      customer: 'all',
      vendor: 'all',
      due: 'all',
      pinnedOnly: false
    },
    quickReplies: cloneDemoQuickReplies(),
    license: cloneDemoLicense(),
    workOrders: cloneDemoWorkOrders(),
    drafts: {
      messageByWorkOrder: {},
      fallbackMessage: '',
      voiceNote: ''
    },
    modals: {
      workOrder: null,
      quickReplies: false,
      timeline: false,
      stepCompletion: null,
      flash: null,
      managerDashboard: false,
      license: false,
      exportPreview: null
    },
    commandPalette: {
      open: false,
      query: '',
      highlight: 0
    },
    timelineFilter: 'all',
    timelineConfirmation: 'all',
    timelineSearch: '',
    toast: null,
    lastSyncedAt: Date.now(),
    loading: false
  };
}
