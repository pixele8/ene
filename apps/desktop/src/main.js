import { createDemoState } from './data.js';
import {
  calculateCompletion,
  downloadFile,
  formatDate,
  formatDateTime,
  relativeTime,
  randomId,
  generateWorkOrderCode,
  getDueInfo,
  matchesDueFilter,
  copyToClipboard,
  escapeHtml,
  DAY_MS,
  daysUntil
} from './utils.js';

const state = createDemoState();

const TIMELINE_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'communication', label: '沟通记录' },
  { value: 'progress', label: '生产进度' },
  { value: 'automation', label: '自动提醒' },
  { value: 'flash', label: '闪电工单' }
];

const TIMELINE_CONFIRMATION_FILTERS = [
  { value: 'all', label: '全部确认方式' },
  { value: 'fingerprint', label: '仅指纹确认' },
  { value: 'dual', label: '仅双人复核' },
  { value: 'none', label: '仅其他记录' }
];

const EXPORT_OPTIONS = [
  {
    type: 'summary-csv',
    label: '产能对比 CSV',
    description: '工序产量 / 不良统计 / 完成率'
  },
  {
    type: 'timeline-csv',
    label: '生产日志 CSV',
    description: '时间线分类 / 操作人 / 节点记录'
  },
  {
    type: 'daily-report',
    label: '生产日报 CSV',
    description: '日完成 / 不良 / ETA 汇总'
  },
  {
    type: 'delivery-note',
    label: '送货单 TXT',
    description: '客户信息 / 发运明细 / 补料备注'
  },
  {
    type: 'reconciliation',
    label: '对账单 CSV',
    description: '工序金额 / 闪电工单补差'
  },
  {
    type: 'flash-txt',
    label: '闪电工单 TXT',
    description: '补料/返工记录，便于快速抄送'
  },
  {
    type: 'full-json',
    label: '完整 JSON',
    description: '原始字段，供系统对接使用'
  }
];

const EXPORT_META_LABELS = {
  code: '工单编号',
  title: '标题',
  customer: '客户',
  vendor: '采购工厂',
  owner: '负责人',
  watchers: '关注人',
  status: '状态',
  priority: '优先级',
  startDate: '计划开始',
  dueDate: '计划结束',
  quantity: '目标数量',
  produced: '已产出',
  defects: '不良数',
  completionRate: '完成率',
  reportDate: '导出日期',
  exportedBy: '制单人',
  customerContact: '客户联系人',
  customerCompany: '客户公司',
  deliveryDate: '建议发货',
  deliveryAddress: '送货地址',
  deliveryWindow: '送货时间窗',
  reconciliationPeriod: '对账区间',
  flashOrderCount: '闪电工单数',
  flashOrderQuantity: '闪电工单数量汇总'
};

const LICENSE_PLANS = [
  {
    tier: 'starter',
    name: '基础版',
    price: '¥199/月',
    summary: '5 人以内小团队入门，覆盖聊天与导出能力',
    features: ['云端发码激活', '工单聊天 / 闪电工单', '标准导出模板', '客户临时账号']
  },
  {
    tier: 'growth',
    name: '专业版',
    price: '¥499/月',
    summary: '10-30 人成长型团队，附加采购自动化与 OCR',
    features: ['全部基础版功能', '采购自动通知', 'OCR 品质导入', '老板看板与指标']
  },
  {
    tier: 'enterprise',
    name: '旗舰版',
    price: '¥899/月',
    summary: '多工厂协同，适配定制 API 与多端接入',
    features: ['全部专业版功能', 'API 对接与权限中心', '指纹 / 双人复核', '云端发码封停审计']
  }
];

const LICENSE_PLAN_SEATS = {
  starter: 10,
  growth: 30,
  enterprise: 80
};

function timelineCategoryLabel(category) {
  switch (category) {
    case 'communication':
      return '沟通记录';
    case 'progress':
      return '生产进度';
    case 'automation':
      return '自动提醒';
    case 'flash':
      return '闪电工单';
    default:
      return '其他记录';
  }
}

function timelineCategoryClass(category) {
  switch (category) {
    case 'communication':
      return 'timeline-category--communication';
    case 'progress':
      return 'timeline-category--progress';
    case 'automation':
      return 'timeline-category--automation';
    case 'flash':
      return 'timeline-category--flash';
    default:
      return 'timeline-category--other';
  }
}

function resolveTimelineCategory(entry) {
  if (entry.category) return entry.category;
  if (entry.step === '聊天') return 'communication';
  if (/闪电工单/.test(entry.text || '')) return 'flash';
  if (/自动/.test(entry.text || '')) return 'automation';
  return 'progress';
}

function timelineConfirmationLabel(value) {
  switch (value) {
    case 'fingerprint':
      return '指纹确认';
    case 'dual':
      return '双人复核';
    default:
      return '其他记录';
  }
}

function timelineConfirmationClass(value) {
  switch (value) {
    case 'fingerprint':
      return 'timeline-confirmation--fingerprint';
    case 'dual':
      return 'timeline-confirmation--dual';
    default:
      return 'timeline-confirmation--other';
  }
}

function timelineConfirmationFilterLabel(value) {
  const target = TIMELINE_CONFIRMATION_FILTERS.find((item) => item.value === value);
  return target ? target.label : '全部确认方式';
}

function normalizeWatchers(list, ownerName) {
  const items = Array.isArray(list) ? list : [];
  const normalized = items
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((value) => value.length > 0);
  if (ownerName && !normalized.includes(ownerName)) {
    normalized.unshift(ownerName);
  }
  return Array.from(new Set(normalized));
}

function licenseStatusLabel(status) {
  switch (status) {
    case 'trial':
      return '试用中';
    case 'active':
      return '已激活';
    case 'suspended':
      return '已封停';
    default:
      return '未激活';
  }
}

function resolveLicensePlan(tier) {
  return LICENSE_PLANS.find((plan) => plan.tier === tier);
}

function getLicenseMeta(license = state.license) {
  if (!license) {
    return {
      severity: 'muted',
      text: '订阅未激活 · 0/0 个名额',
      tooltip: '暂未配置订阅计划',
      remaining: null,
      tier: null,
      statusLabel: '未激活',
      planName: '未设置',
      countdownLabel: '未设置到期'
    };
  }

  const remaining = daysUntil(license.expiresAt);
  let severity = 'info';
  let countdownLabel = '未设置到期';

  if (license.status === 'suspended') {
    severity = 'danger';
    countdownLabel = '已封停';
  } else if (remaining == null) {
    severity = 'info';
    countdownLabel = '未设置到期';
  } else if (remaining < 0) {
    severity = 'danger';
    countdownLabel = `过期 ${Math.abs(remaining)} 天`;
  } else if (remaining === 0) {
    severity = 'warning';
    countdownLabel = '今日到期';
  } else if (remaining <= 7) {
    severity = 'warning';
    countdownLabel = `剩余 ${remaining} 天`;
  } else {
    severity = 'success';
    countdownLabel = `剩余 ${remaining} 天`;
  }

  const plan = resolveLicensePlan(license.tier);
  const planName = plan?.name || license.plan || '未设置';
  const statusLabel = licenseStatusLabel(license.status);
  const seatsLabel = `${license.seatsUsed}/${license.seats} 个名额`;
  const tooltipParts = [];

  if (license.activationCode) {
    tooltipParts.push(`激活码 ${license.activationCode}`);
  }
  if (license.expiresAt) {
    tooltipParts.push(`到期日 ${formatDate(license.expiresAt)}`);
  }
  tooltipParts.push(license.autoRenew ? '自动续订已开启' : '自动续订未开启');
  if (license.lastRenewedAt) {
    tooltipParts.push(`最近续期 ${relativeTime(license.lastRenewedAt)}`);
  }
  if (license.lastVerifiedAt) {
    tooltipParts.push(`最近校验 ${relativeTime(license.lastVerifiedAt)}`);
  }
  if (license.status === 'suspended' && license.suspendedAt) {
    tooltipParts.push(`封停时间 ${formatDateTime(license.suspendedAt)}`);
  }

  return {
    severity,
    text: `${planName} · ${statusLabel} · ${countdownLabel} · ${seatsLabel}`,
    tooltip: tooltipParts.join(' | '),
    remaining,
    tier: license.tier,
    statusLabel,
    planName,
    countdownLabel,
    seatsLabel,
    autoRenew: Boolean(license.autoRenew)
  };
}
state.apiBase = window.__GXL_BRIDGE__?.apiBase || window.__GXL_API_BASE__ || '';
const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');
const commandRoot = document.getElementById('command-root');
let toastTimer = null;

function isLiveMode() {
  return state.mode === 'live';
}

function getApiUrl(pathname) {
  const base = state.apiBase || '';
  if (!base) return pathname;
  if (pathname.startsWith('http')) return pathname;
  return `${base.replace(/\/$/, '')}${pathname}`;
}

async function syncLive(pathname, options = {}) {
  const { method = 'POST', body = null, onError, force = false } = options;
  if (!force && !isLiveMode()) return null;
  try {
    const response = await fetch(getApiUrl(pathname), {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    state.lastSyncedAt = Date.now();
    if (response.status === 204) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('[syncLive]', error);
    if (onError) {
      onError(error);
    } else {
      showToast('联机同步失败，已保留本地记录');
    }
    return null;
  }
}

function hydrateDemoDataset() {
  const session = state.session;
  const demo = createDemoState();
  Object.assign(state, demo);
  state.session = session;
  state.mode = 'demo';
  state.apiBase = window.__GXL_BRIDGE__?.apiBase || state.apiBase || '';
  state.selectedWorkOrderId = demo.selectedWorkOrderId;
}

function mapPinnedState(workOrders = [], pinnedMap = null) {
  const map = pinnedMap instanceof Map ? pinnedMap : null;
  return (workOrders || []).map((wo) => {
    const nextPinned = map?.has(wo.id) ? map.get(wo.id) : Boolean(wo.pinned);
    const timeline = Array.isArray(wo.timeline)
      ? wo.timeline.map((entry) => ({ ...entry, category: resolveTimelineCategory(entry) }))
      : [];
    const watchers = normalizeWatchers(wo.watchers, wo.owner);
    return { ...wo, pinned: nextPinned, timeline, watchers };
  });
}

function activateDemoMode({ silent = false } = {}) {
  hydrateDemoDataset();
  state.loading = false;
  if (!silent) {
    showToast('已切换到离线演示模式');
  }
  render();
}

async function activateLiveMode({ silent = false } = {}) {
  state.loading = true;
  render();
  try {
    const data = await syncLive('/api/bootstrap', { method: 'GET', onError: () => {}, force: true });
    if (!data) {
      throw new Error('无法获取联机数据');
    }
    const session = state.session;
    const defaults = createDemoState();
    state.mode = 'live';
    state.apiBase = window.__GXL_BRIDGE__?.apiBase || state.apiBase || '';
    state.workOrders = mapPinnedState(data.workOrders);
    state.quickReplies = data.quickReplies || defaults.quickReplies;
    state.filters = { ...defaults.filters };
    state.drafts = {
      ...defaults.drafts,
      messageByWorkOrder: { ...defaults.drafts.messageByWorkOrder }
    };
    state.modals = { ...defaults.modals };
    state.timelineFilter = defaults.timelineFilter;
    state.timelineSearch = defaults.timelineSearch;
    state.selectedWorkOrderId = state.workOrders[0]?.id || null;
    state.session = session;
    state.loading = false;
    state.lastSyncedAt = Date.now();
    if (!silent) {
      showToast('已切换到联机模式');
    }
  } catch (error) {
    console.error('[activateLiveMode]', error);
    state.loading = false;
    showToast('联机模式加载失败，已回退演示数据');
    activateDemoMode({ silent: true });
  }
  render();
}

async function manualSync() {
  if (!isLiveMode()) {
    state.lastSyncedAt = Date.now();
    showToast('演示数据已刷新');
    render();
    return;
  }
  const pinnedMap = new Map(state.workOrders.map((wo) => [wo.id, !!wo.pinned]));
  state.loading = true;
  render();
  try {
    const data = await syncLive('/api/work-orders', { method: 'GET', onError: () => {} });
    if (data?.workOrders) {
      const currentSelection = state.selectedWorkOrderId;
      state.workOrders = mapPinnedState(data.workOrders, pinnedMap);
      if (currentSelection && state.workOrders.some((wo) => wo.id === currentSelection)) {
        state.selectedWorkOrderId = currentSelection;
      } else {
        state.selectedWorkOrderId = state.workOrders[0]?.id || null;
      }
      state.lastSyncedAt = Date.now();
      showToast('联机数据已同步');
    } else {
      showToast('联机同步失败，请检查服务状态');
    }
  } catch (error) {
    console.error('[manualSync]', error);
    showToast('联机同步失败，请检查服务状态');
  }
  state.loading = false;
  render();
}

function getSelectedWorkOrder() {
  return state.workOrders.find((wo) => wo.id === state.selectedWorkOrderId) || state.workOrders[0];
}

function statusLabel(status) {
  switch (status) {
    case 'all':
      return '全部';
    case 'in-progress':
      return '进行中';
    case 'pending':
      return '待启动';
    case 'completed':
      return '已完成';
    case 'cancelled':
      return '已废除';
    default:
      return status;
  }
}

function priorityLabel(priority) {
  switch (priority) {
    case 'high':
      return '高';
    case 'medium':
      return '中';
    case 'low':
      return '低';
    default:
      return '—';
  }
}

function dueFilterLabel(value) {
  switch (value) {
    case 'overdue':
      return '已逾期';
    case 'today':
      return '今日截止';
    case 'week':
      return '7 日内截止';
    case 'scheduled':
      return '7 日后截止';
    case 'unset':
      return '未设置截止';
    default:
      return '全部截止';
  }
}

function showToast(message) {
  state.toast = message;
  renderToast();
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(() => {
    state.toast = null;
    renderToast();
  }, 2600);
}

function getLicenseState() {
  if (!state.license) {
    state.license = {
      plan: '基础版',
      tier: 'starter',
      status: 'trial',
      activationCode: 'GX-DEMO-0000',
      autoRenew: false,
      seats: LICENSE_PLAN_SEATS.starter,
      seatsUsed: 0,
      expiresAt: Date.now() + 30 * DAY_MS,
      lastRenewedAt: Date.now(),
      lastVerifiedAt: Date.now(),
      suspendedAt: null
    };
  }
  return state.license;
}

function renewLicense(days) {
  const license = getLicenseState();
  const numeric = Number(days);
  const duration = Number.isFinite(numeric) && numeric > 0 ? numeric : 30;
  const base = license.expiresAt && license.expiresAt > Date.now() ? license.expiresAt : Date.now();
  license.expiresAt = base + duration * DAY_MS;
  license.status = 'active';
  license.suspendedAt = null;
  license.lastRenewedAt = Date.now();
  license.lastVerifiedAt = Date.now();
  showToast(`订阅已续期至 ${formatDate(license.expiresAt)}`);
  render();
  renderModals();
}

function suspendLicense() {
  const license = getLicenseState();
  if (license.status === 'suspended') return;
  license.status = 'suspended';
  license.suspendedAt = Date.now();
  showToast('订阅已封停');
  render();
  renderModals();
}

function resumeLicense() {
  const license = getLicenseState();
  if (license.status !== 'suspended') return;
  license.status = 'active';
  license.suspendedAt = null;
  license.lastVerifiedAt = Date.now();
  showToast('订阅已恢复');
  render();
  renderModals();
}

function toggleAutoRenew() {
  const license = getLicenseState();
  license.autoRenew = !license.autoRenew;
  showToast(license.autoRenew ? '自动续订已开启' : '自动续订已关闭');
  render();
  renderModals();
}

function adjustLicenseSeats(delta) {
  const license = getLicenseState();
  if (!Number.isFinite(delta) || delta === 0) return;
  const next = Math.min(license.seats, Math.max(0, license.seatsUsed + delta));
  license.seatsUsed = next;
  license.lastVerifiedAt = Date.now();
  showToast(`当前占用 ${next}/${license.seats} 个名额`);
  render();
  renderModals();
}

function selectLicensePlan(tier) {
  const license = getLicenseState();
  const plan = resolveLicensePlan(tier);
  if (!plan) return;
  license.tier = tier;
  license.plan = plan.name;
  const seatLimit = LICENSE_PLAN_SEATS[tier] || license.seats;
  license.seats = seatLimit;
  if (license.seatsUsed > seatLimit) {
    license.seatsUsed = seatLimit;
  }
  license.lastVerifiedAt = Date.now();
  showToast(`已切换至 ${plan.name}`);
  render();
  renderModals();
}

function renderLoadingOverlay() {
  let overlay = document.querySelector('.loading-overlay');
  if (state.loading) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'loading-overlay';
      overlay.innerHTML = '<div class="spinner"></div><span></span>';
      document.body.appendChild(overlay);
    }
    const label = overlay.querySelector('span');
    if (label) {
      label.textContent = isLiveMode() ? '正在同步联机数据…' : '正在刷新演示数据…';
    }
  } else if (overlay) {
    overlay.remove();
  }
}

function renderCommandPalette() {
  if (!commandRoot) return;
  if (!state.commandPalette.open) {
    commandRoot.innerHTML = '';
    return;
  }

  const results = getCommandPaletteResults();
  const safeHighlight = results.length ? Math.min(state.commandPalette.highlight, results.length - 1) : 0;
  if (safeHighlight !== state.commandPalette.highlight) {
    state.commandPalette.highlight = safeHighlight;
  }

  const listMarkup = results.length
    ? results
        .map((wo, index) => {
          const dueInfo = getDueInfo(wo.dueDate);
          const watchers = (wo.watchers || []).slice(0, 3);
          return `
            <li class="command-item ${index === state.commandPalette.highlight ? 'active' : ''}" data-id="${wo.id}" data-index="${index}">
              <div class="command-item__title">
                <span>${escapeHtml(wo.title)}</span>
                ${wo.pinned ? '<span class="command-badge">置顶</span>' : ''}
              </div>
              <div class="command-item__meta">
                <span>${escapeHtml(wo.code)}</span>
                <span>${statusLabel(wo.status)}</span>
                <span class="command-due command-due--${dueInfo.status}">${escapeHtml(dueInfo.label)}</span>
                ${wo.customer ? `<span>${escapeHtml(wo.customer)}</span>` : ''}
                <span>负责人 ${escapeHtml(wo.owner)}</span>
              </div>
              ${watchers.length
                ? `<div class="command-item__watchers">${watchers
                    .map((name) => `<span class="command-chip">${escapeHtml(name)}</span>`)
                    .join('')}</div>`
                : ''}
            </li>
          `;
        })
        .join('')
    : '<li class="command-empty">未找到匹配的工单，可尝试输入工单编号、客户或负责人。</li>';

  const queryValue = escapeHtml(state.commandPalette.query || '');

  commandRoot.innerHTML = `
    <div class="command-backdrop">
      <div class="command-panel">
        <div class="command-search">
          <span class="command-search__icon">🔍</span>
          <input id="command-search" type="search" placeholder="搜索工单编号、标题、客户或负责人" value="${queryValue}" />
          ${state.commandPalette.query
            ? '<button type="button" class="command-clear" data-command-clear>清除</button>'
            : '<span class="command-hint">Ctrl / ⌘ + K</span>'}
        </div>
        <ul class="command-results">${listMarkup}</ul>
      </div>
    </div>
  `;

  const backdrop = commandRoot.querySelector('.command-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) {
        closeCommandPalette();
      }
    });
  }

  const input = commandRoot.querySelector('#command-search');
  if (input) {
    if (document.activeElement !== input) {
      input.focus();
      input.select();
    }
    input.addEventListener('input', (event) => {
      state.commandPalette.query = event.target.value;
      state.commandPalette.highlight = 0;
      renderCommandPalette();
    });
  }

  const clearButton = commandRoot.querySelector('[data-command-clear]');
  if (clearButton) {
    clearButton.addEventListener('click', () => {
      state.commandPalette.query = '';
      state.commandPalette.highlight = 0;
      renderCommandPalette();
    });
  }

  commandRoot.querySelectorAll('.command-item').forEach((item) => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      if (!id) return;
      selectWorkOrder(id);
      closeCommandPalette();
    });
  });
}

function render() {
  if (!state.session) {
    renderLogin();
  } else {
    renderWorkspace();
  }
  renderModals();
  renderToast();
  renderLoadingOverlay();
  renderCommandPalette();
}

function ensureMessageDraftMap() {
  if (!state.drafts.messageByWorkOrder || typeof state.drafts.messageByWorkOrder !== 'object') {
    state.drafts.messageByWorkOrder = {};
  }
  if (typeof state.drafts.fallbackMessage !== 'string') {
    state.drafts.fallbackMessage = '';
  }
}

function getMessageDraft(workOrderId = state.selectedWorkOrderId) {
  ensureMessageDraftMap();
  if (!workOrderId) {
    return state.drafts.fallbackMessage || '';
  }
  return state.drafts.messageByWorkOrder[workOrderId] || '';
}

function setMessageDraft(workOrderId, value) {
  ensureMessageDraftMap();
  const content = typeof value === 'string' ? value : '';
  if (!workOrderId) {
    state.drafts.fallbackMessage = content.trim().length ? content : '';
    return;
  }
  if (content.trim().length) {
    state.drafts.messageByWorkOrder[workOrderId] = content;
  } else {
    delete state.drafts.messageByWorkOrder[workOrderId];
  }
}

function clearMessageDraft(workOrderId) {
  setMessageDraft(workOrderId, '');
}

function getFilteredWorkOrders() {
  const { search, status, owner, priority, pinnedOnly, due, customer, vendor } = state.filters;
  return state.workOrders.filter((wo) => {
    const matchesSearch = !search
      || wo.title.includes(search)
      || wo.code.includes(search)
      || wo.customer.includes(search);
    const matchesStatus = status === 'all' || wo.status === status;
    const matchesOwner = owner === 'all' || wo.owner === owner;
    const matchesPriority = priority === 'all' || wo.priority === priority;
    const matchesCustomer = customer === 'all' || wo.customer === customer;
    const vendorName = wo.procurement?.vendor || '未指定工厂';
    const matchesVendor = vendor === 'all' || vendorName === vendor;
    const matchesPinned = !pinnedOnly || wo.pinned;
    const matchesDue = matchesDueFilter(wo.dueDate, due);
    return (
      matchesSearch
      && matchesStatus
      && matchesOwner
      && matchesPriority
      && matchesCustomer
      && matchesVendor
      && matchesPinned
      && matchesDue
    );
  });
}

function getCommandPaletteResults() {
  const query = state.commandPalette.query.trim().toLowerCase();
  const list = [...state.workOrders].sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }
    const dueA = a.dueDate ? Date.parse(a.dueDate) : Number.MAX_SAFE_INTEGER;
    const dueB = b.dueDate ? Date.parse(b.dueDate) : Number.MAX_SAFE_INTEGER;
    if (!Number.isNaN(dueA) && !Number.isNaN(dueB) && dueA !== dueB) {
      return dueA - dueB;
    }
    return a.code.localeCompare(b.code, 'zh-Hans-CN');
  });

  if (!query) {
    return list.slice(0, 8);
  }

  const terms = query.split(/\s+/).filter(Boolean);

  const filtered = list.filter((wo) => {
    const haystack = [
      wo.code,
      wo.title,
      wo.customer,
      wo.owner,
      ...(wo.watchers || [])
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });

  return filtered.slice(0, 8);
}

function openCommandPalette(initialQuery = null) {
  if (!state.session) return;
  state.commandPalette.open = true;
  if (typeof initialQuery === 'string') {
    state.commandPalette.query = initialQuery;
  } else if (state.commandPalette.query == null) {
    state.commandPalette.query = '';
  }
  state.commandPalette.highlight = 0;
  renderCommandPalette();
}

function closeCommandPalette() {
  state.commandPalette.open = false;
  state.commandPalette.highlight = 0;
  state.commandPalette.query = '';
  renderCommandPalette();
}

function moveCommandHighlight(delta) {
  const results = getCommandPaletteResults();
  if (!results.length) {
    state.commandPalette.highlight = 0;
    renderCommandPalette();
    return;
  }
  let next = state.commandPalette.highlight + delta;
  if (next < 0) {
    next = results.length - 1;
  }
  if (next >= results.length) {
    next = 0;
  }
  state.commandPalette.highlight = next;
  renderCommandPalette();
}

function selectHighlightedCommand() {
  const results = getCommandPaletteResults();
  if (!results.length) return;
  const index = Math.min(state.commandPalette.highlight, results.length - 1);
  const target = results[index];
  if (!target) return;
  selectWorkOrder(target.id);
  closeCommandPalette();
}

function sanitizeMessageForSync(message) {
  return {
    ...message,
    attachments: (message.attachments || []).map((att) => ({
      id: att.id,
      name: att.name,
      type: att.type || 'file',
      size: att.size || '',
      preview: att.preview || ''
    })),
    voice: message.voice ? { duration: message.voice.duration || 0 } : null
  };
}

function selectWorkOrder(id) {
  state.selectedWorkOrderId = id;
  const workOrder = getSelectedWorkOrder();
  if (workOrder) {
    workOrder.unread = 0;
  }
  render();
}

function togglePinnedWorkOrder(id) {
  const workOrder = state.workOrders.find((wo) => wo.id === id);
  if (!workOrder) return;
  workOrder.pinned = !workOrder.pinned;
  showToast(workOrder.pinned ? '已置顶工单' : '已取消置顶');
  render();
}

function markAllWorkOrdersRead() {
  let updated = false;
  state.workOrders.forEach((wo) => {
    if (wo.unread > 0) {
      wo.unread = 0;
      updated = true;
    }
  });
  if (updated) {
    showToast('所有工单消息均已标记为已读');
    render();
  }
}

function addMessage(workOrder, message) {
  workOrder.messages.push(message);
  workOrder.timeline.push({
    id: randomId('timeline'),
    step: '聊天',
    text: `${message.sender} 发送了一条${message.type === 'text' ? '消息' : message.type === 'voice' ? '语音' : '附件'}`,
    by: message.sender,
    timestamp: message.timestamp,
    category: 'communication'
  });
  state.workOrders
    .filter((wo) => wo.id !== workOrder.id)
    .forEach((wo) => {
      wo.unread += 1;
    });
  if (isLiveMode()) {
    syncLive(`/api/work-orders/${workOrder.id}/messages`, {
      body: { message: sanitizeMessageForSync(message) }
    });
  }
}

function sendTextMessage() {
  const workOrder = getSelectedWorkOrder();
  if (!workOrder) {
    showToast('请选择工单后再发送消息');
    return;
  }
  const content = getMessageDraft(workOrder.id).trim();
  if (!content) {
    showToast('请输入消息内容');
    return;
  }
  addMessage(workOrder, {
    id: randomId('msg'),
    type: 'text',
    sender: state.session.name,
    role: state.session.role,
    text: content,
    timestamp: Date.now(),
    attachments: [],
    voice: null,
    system: false
  });
  clearMessageDraft(workOrder.id);
  render();
}

function sendVoiceNote(noteText = '') {
  const workOrder = getSelectedWorkOrder();
  addMessage(workOrder, {
    id: randomId('msg'),
    type: 'voice',
    sender: state.session.name,
    role: state.session.role,
    text: noteText || '语音备注：生产正常推进。',
    timestamp: Date.now(),
    voice: { duration: Math.floor(Math.random() * 35) + 12 },
    attachments: [],
    system: false
  });
  render();
  showToast('语音消息已记录');
}

function sendAttachment(files) {
  const workOrder = getSelectedWorkOrder();
  if (!files.length) return;
  const attachments = Array.from(files).map((file) => ({
    id: randomId('att'),
    name: file.name,
    size: `${Math.round(file.size / 1024)} KB`,
    type: file.type || '文件',
    url: URL.createObjectURL(file),
    preview: ''
  }));
  addMessage(workOrder, {
    id: randomId('msg'),
    type: 'attachment',
    sender: state.session.name,
    role: state.session.role,
    text: `${state.session.name} 上传了 ${attachments.length} 个附件`,
    timestamp: Date.now(),
    attachments,
    voice: null,
    system: false
  });
  render();
  showToast(isLiveMode() ? '附件消息已记录' : '附件上传成功（演示数据）');
}

async function copyWorkOrderCode() {
  const workOrder = getSelectedWorkOrder();
  if (!workOrder) return;
  try {
    await copyToClipboard(workOrder.code);
    showToast(`工单编号 ${workOrder.code} 已复制`);
  } catch (error) {
    console.error('[copyWorkOrderCode]', error);
    showToast('复制失败，请手动复制工单编号');
  }
}

function buildExportPayload(workOrder) {
  const completion = calculateCompletion(workOrder);
  const safeFormatDate = (value) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }
    return formatDate(parsed);
  };
  const startDate = safeFormatDate(workOrder.startDate);
  const dueDate = safeFormatDate(workOrder.dueDate);
  const flashTotals = (workOrder.flashOrders || []).reduce(
    (acc, item) => {
      return {
        count: acc.count + 1,
        quantity: acc.quantity + (item.quantity || 0)
      };
    },
    { count: 0, quantity: 0 }
  );
  return {
    meta: {
      code: workOrder.code,
      title: workOrder.title,
      customer: workOrder.customer,
      vendor: workOrder.procurement?.vendor || '未指定工厂',
      owner: workOrder.owner,
      watchers: Array.isArray(workOrder.watchers) && workOrder.watchers.length
        ? workOrder.watchers.join('、')
        : '未指定',
      status: statusLabel(workOrder.status),
      priority: priorityLabel(workOrder.priority),
      startDate: startDate || workOrder.startDate || '',
      dueDate: dueDate || workOrder.dueDate || '',
      quantity: workOrder.quantity,
      produced: completion.produced,
      defects: completion.defects,
      completionRate: `${completion.completionRate}%`,
      reportDate: formatDate(Date.now()),
      exportedBy: state.session?.name || '系统演示账号',
      customerContact: workOrder.customerAccess?.contact || '未填写',
      customerCompany: workOrder.customerAccess?.company || workOrder.customer,
      deliveryDate: dueDate || '待安排',
      deliveryAddress:
        workOrder.customerAccess?.address || `${workOrder.customer || '客户'} · 待确认收货地址`,
      deliveryWindow: dueDate ? `${dueDate} 08:00-18:00` : '待排期',
      reconciliationPeriod:
        startDate && dueDate
          ? `${startDate} ~ ${dueDate}`
          : startDate || dueDate || '演示阶段待确认',
      flashOrderCount: flashTotals.count,
      flashOrderQuantity: flashTotals.quantity
    },
    steps: workOrder.steps,
    flashOrders: workOrder.flashOrders,
    timeline: workOrder.timeline
  };
}

function createExportArtifact(workOrder, type) {
  const payload = buildExportPayload(workOrder);
  const baseFilename = workOrder.code;
  const steps = Array.isArray(workOrder.steps) ? workOrder.steps : [];
  const flashOrders = Array.isArray(workOrder.flashOrders) ? workOrder.flashOrders : [];
  const formatCurrency = (value) => value.toFixed(2);
  const resolveUnitPrice = (step, index) => {
    const baseRates = {
      CUT: 8.5,
      ASSEMBLE: 12.5,
      QC: 6.5,
      STAMP: 10.5,
      POLISH: 9.5,
      PACK: 5.5
    };
    if (!step) return 10 + index * 1.5;
    return baseRates[step.code] || baseRates[step.name] || 10 + index * 1.5;
  };
  switch (type) {
    case 'summary-csv': {
      const rows = [
        '类型,内容',
        `工单编号,${workOrder.code}`,
        `客户,${workOrder.customer}`,
        `采购工厂,${workOrder.procurement?.vendor || '未指定工厂'}`,
        `状态,${statusLabel(workOrder.status)}`,
        `关注人,${payload.meta.watchers}`,
        `优先级,${priorityLabel(workOrder.priority)}`,
        `完成率,${payload.meta.completionRate}`
      ];
      steps.forEach((step) => {
        rows.push(`工序-${step.name},完成 ${step.completed} 件 / 缺陷 ${step.defects} 件`);
      });
      const content = rows.join('\n');
      return {
        type,
        label: '产能对比 CSV',
        description: '工序产量 / 不良统计 / 完成率',
        filename: `${baseFilename}-summary.csv`,
        mime: 'text/csv;charset=utf-8',
        content,
        preview: content,
        payload
      };
    }
    case 'timeline-csv': {
      const header = '时间,类型,确认方式,节点,描述,操作人';
      const rows = [header];
      const timelineEntries = Array.isArray(payload.timeline)
        ? payload.timeline.slice().sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
        : [];
      timelineEntries.forEach((entry) => {
        const timestamp = entry.timestamp ? formatDateTime(entry.timestamp) : '';
        const category = timelineCategoryLabel(resolveTimelineCategory(entry));
        const step = (entry.step || '').replace(/,/g, '、');
        const description = (entry.text || '').replace(/,/g, '、').replace(/\r?\n/g, ' ');
        const actor = (entry.by || '系统').replace(/,/g, '、');
        const confirmation = entry.confirmation ? timelineConfirmationLabel(entry.confirmation) : '—';
        rows.push(`${timestamp},${category},${confirmation},${step},${description},${actor}`);
      });
      if (rows.length === 1) {
        rows.push('暂无记录,,,,,');
      }
      const content = rows.join('\n');
      return {
        type,
        label: '生产日志 CSV',
        description: '时间线分类 / 操作人 / 节点记录',
        filename: `${baseFilename}-timeline.csv`,
        mime: 'text/csv;charset=utf-8',
        content,
        preview: content,
        payload
      };
    }
    case 'daily-report': {
      const rows = [
        '日期,工序,负责人,完成数量,不良数量,预计完成',
        ...steps.map(
          (step) =>
            `${payload.meta.reportDate},${step.name},${step.assignee || '待分配'},${step.completed},${step.defects},${step.eta || ''}`
        )
      ];
      rows.push(
        `合计,全部工序,${workOrder.owner},${payload.meta.produced},${payload.meta.defects},${payload.meta.dueDate || ''}`
      );
      const content = rows.join('\n');
      return {
        type,
        label: '生产日报 CSV',
        description: '日完成 / 不良 / ETA 汇总',
        filename: `${baseFilename}-daily-report.csv`,
        mime: 'text/csv;charset=utf-8',
        content,
        preview: content,
        payload
      };
    }
    case 'delivery-note': {
      const lines = [
        `送货单 · ${workOrder.code}`,
        '=====================',
        `客户：${workOrder.customer}`,
        `联系人：${payload.meta.customerContact}`,
        `客户公司：${payload.meta.customerCompany}`,
        `关注人：${payload.meta.watchers}`,
        `计划送达：${payload.meta.deliveryDate || '待安排'}`,
        `送货地址：${payload.meta.deliveryAddress}`,
        `送货时间窗：${payload.meta.deliveryWindow}`,
        '',
        '发运明细：'
      ];
      if (steps.length === 0) {
        lines.push('  - 暂无排程');
      } else {
        steps.forEach((step) => {
          lines.push(`  - ${step.name}：${step.completed} 件（不良 ${step.defects} 件）`);
        });
      }
      lines.push('', '补料/返工提醒：');
      if (flashOrders.length === 0) {
        lines.push('  - 暂无补料需求');
      } else {
        flashOrders.forEach((fo) => {
          lines.push(`  - ${formatDateTime(fo.createdAt)} ${fo.note}（${fo.quantity} 件）`);
        });
      }
      lines.push('', `制单：${payload.meta.exportedBy} · ${payload.meta.reportDate}`);
      const content = lines.join('\n');
      return {
        type,
        label: '送货单 TXT',
        description: '客户信息 / 发运明细 / 补料备注',
        filename: `${baseFilename}-delivery.txt`,
        mime: 'text/plain;charset=utf-8',
        content,
        preview: content,
        payload
      };
    }
    case 'reconciliation': {
      const rows = ['项目,说明,数量,单价(元),金额(元)'];
      let totalAmount = 0;
      steps.forEach((step, index) => {
        const quantity = Math.max((step.completed || 0) - (step.defects || 0), 0);
        const unitPrice = resolveUnitPrice(step, index);
        const amount = quantity * unitPrice;
        totalAmount += amount;
        rows.push(
          `${step.name},工序结算,${quantity},${formatCurrency(unitPrice)},${formatCurrency(amount)}`
        );
      });
      flashOrders.forEach((fo, index) => {
        const unitPrice = 15 + index * 2;
        const amount = (fo.quantity || 0) * unitPrice;
        totalAmount += amount;
        rows.push(
          `闪电工单,${(fo.note || '补料记录').replace(/,/g, '、')},${fo.quantity || 0},${formatCurrency(unitPrice)},${formatCurrency(amount)}`
        );
      });
      rows.push(
        `合计,${workOrder.title},${payload.meta.produced},,${formatCurrency(totalAmount)}`
      );
      const content = rows.join('\n');
      return {
        type,
        label: '对账单 CSV',
        description: '工序金额 / 闪电工单补差',
        filename: `${baseFilename}-reconciliation.csv`,
        mime: 'text/csv;charset=utf-8',
        content,
        preview: content,
        payload
      };
    }
    case 'flash-txt': {
      const lines = [
        `工单 ${workOrder.code} 导出`,
        '=====================',
        `客户：${workOrder.customer}`,
        `负责人：${workOrder.owner}`,
        `关注人：${payload.meta.watchers}`,
        `进度：${payload.meta.produced}/${workOrder.quantity}`,
        '',
        '闪电工单：'
      ];
      if (flashOrders.length === 0) {
        lines.push('  暂无记录');
      } else {
        flashOrders.forEach((fo) => {
          lines.push(`  - ${formatDateTime(fo.createdAt)} ${fo.note}（${fo.quantity} 件）`);
        });
      }
      const content = lines.join('\n');
      return {
        type,
        label: '闪电工单 TXT',
        description: '补料/返工记录，便于快速抄送',
        filename: `${baseFilename}-flash.txt`,
        mime: 'text/plain;charset=utf-8',
        content,
        preview: content,
        payload
      };
    }
    case 'full-json':
    default: {
      const json = JSON.stringify(payload, null, 2);
      return {
        type,
        label: '完整 JSON',
        description: '原始字段，供系统对接使用',
        filename: `${baseFilename}.json`,
        mime: 'application/json;charset=utf-8',
        content: json,
        preview: json,
        payload
      };
    }
  }
}

function exportWorkOrder(workOrder, type) {
  if (!workOrder) return;
  const artifact = createExportArtifact(workOrder, type);
  downloadFile(artifact.filename, artifact.content, artifact.mime);
  showToast('导出任务已完成');
}

function openExportPreview(type) {
  const workOrder = getSelectedWorkOrder();
  if (!workOrder) return;
  const artifact = createExportArtifact(workOrder, type);
  const previewLimit = 2000;
  const truncated = artifact.preview.length > previewLimit;
  state.modals.exportPreview = {
    workOrderId: workOrder.id,
    type: artifact.type,
    label: artifact.label,
    description: artifact.description,
    filename: artifact.filename,
    mime: artifact.mime,
    content: artifact.content,
    preview: truncated ? `${artifact.preview.slice(0, previewLimit)}...` : artifact.preview,
    truncated,
    payload: artifact.payload
  };
  renderModals();
}

function openPrintWindow(exportPayload) {
  if (!exportPayload) return;
  const printTarget = window.open('', '_blank', 'noopener=yes,width=900,height=640');
  if (!printTarget) {
    showToast('浏览器拦截了打印窗口，请允许弹窗后重试');
    return;
  }
  const metaEntries = Object.entries(exportPayload.payload?.meta || {});
  const metaList = metaEntries
    .map(
      ([key, value]) => `
        <li>
          <span>${EXPORT_META_LABELS[key] || key}</span>
          <strong>${escapeHtml(value ?? '') || '—'}</strong>
        </li>
      `
    )
    .join('');
  const truncatedNote = exportPayload.truncated
    ? '<p class="print-note">提示：预览弹窗仅显示前 2000 个字符，本打印稿已加载完整内容。</p>'
    : '';
  const documentHtml = `<!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(exportPayload.label || '导出内容')} · ${escapeHtml(
    exportPayload.filename
  )}</title>
        <style>
          :root { color-scheme: light; }
          body {
            font-family: 'SF Pro Display','PingFang SC','Microsoft Yahei',Arial,sans-serif;
            margin: 40px;
            color: #1f2329;
          }
          h1 {
            font-size: 22px;
            margin: 0 0 12px;
          }
          p.subtitle {
            margin: 0 0 24px;
            color: #4c5462;
            font-size: 14px;
          }
          ul.meta {
            list-style: none;
            padding: 0;
            margin: 0 0 24px;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 12px;
          }
          ul.meta li {
            padding: 12px;
            border: 1px solid #e1e4eb;
            border-radius: 10px;
            background: #f7f9fc;
          }
          ul.meta span {
            display: block;
            font-size: 12px;
            color: #69707a;
            margin-bottom: 6px;
          }
          ul.meta strong {
            font-size: 14px;
            color: #1f2329;
            word-break: break-all;
          }
          pre.content {
            white-space: pre-wrap;
            word-break: break-word;
            background: #f0f2f5;
            border: 1px solid #e1e4eb;
            border-radius: 12px;
            padding: 20px;
            font-size: 13px;
            line-height: 1.6;
          }
          .print-note {
            margin-top: 16px;
            color: #b54708;
            font-size: 13px;
          }
          @media print {
            body { margin: 20px; }
            pre.content {
              background: transparent;
              border-color: #d7dae3;
            }
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(exportPayload.label || '导出内容')}打印稿</h1>
        <p class="subtitle">${escapeHtml(exportPayload.description || '')} · 文件名 ${escapeHtml(
    exportPayload.filename
  )}</p>
        <ul class="meta">${metaList}</ul>
        <pre class="content">${escapeHtml(exportPayload.content || '')}</pre>
        ${truncatedNote}
      </body>
    </html>`;
  printTarget.document.open();
  printTarget.document.write(documentHtml);
  printTarget.document.close();
  try {
    printTarget.focus();
  } catch (error) {
    console.warn('[print focus]', error);
  }
  setTimeout(() => {
    try {
      printTarget.print();
    } catch (error) {
      console.error('[print export]', error);
    }
  }, 250);
  showToast('打印预览已在新窗口打开');
}

function upsertWorkOrder(formData, existingId = null) {
  if (existingId) {
    const target = state.workOrders.find((wo) => wo.id === existingId);
    Object.assign(target, formData, { id: existingId });
    target.watchers = normalizeWatchers(formData.watchers, formData.owner || target.owner);
    showToast('工单信息已更新');
    if (isLiveMode()) {
      syncLive(`/api/work-orders/${existingId}`, {
        method: 'PATCH',
        body: {
          title: target.title,
          customer: target.customer,
          owner: target.owner,
          priority: target.priority,
          startDate: target.startDate,
          dueDate: target.dueDate,
          quantity: target.quantity,
          procurement: target.procurement,
          status: target.status,
          watchers: target.watchers
        }
      });
    }
  } else {
    const id = randomId('wo');
    const creationTimestamp = Date.now();
    const watchers = normalizeWatchers(formData.watchers, formData.owner || state.session?.name || '');
    const newOrder = {
      id,
      code: generateWorkOrderCode(),
      title: formData.title,
      customer: formData.customer,
      status: 'pending',
      priority: formData.priority,
      owner: formData.owner,
      pinned: false,
      startDate: formData.startDate,
      dueDate: formData.dueDate,
      quantity: Number(formData.quantity) || 0,
      unread: 0,
      procurement: {
        autoNotify: formData.autoNotify,
        vendor: formData.vendor || '默认工厂'
      },
      steps: formData.steps || [],
      messages: [
        {
          id: randomId('msg'),
          type: 'system',
          sender: '系统',
          role: 'system',
          text: '工单创建成功，等待排产确认。',
          timestamp: creationTimestamp,
          system: true,
          attachments: [],
          voice: null
        }
      ],
      timeline: [
        {
          id: randomId('timeline'),
          step: '系统',
          text: '工单创建成功，等待排产确认。',
          by: state.session?.name || '系统',
          timestamp: creationTimestamp,
          category: 'progress'
        }
      ],
      flashOrders: [],
      customerAccess: {
        enabled: false,
        contact: '',
        company: '',
        expiresAt: ''
      },
      watchers
    };
    state.workOrders.unshift(newOrder);
    state.selectedWorkOrderId = id;
    showToast('新工单已创建');
    if (isLiveMode()) {
      syncLive('/api/work-orders', {
        body: {
          title: newOrder.title,
          customer: newOrder.customer,
          owner: newOrder.owner,
          priority: newOrder.priority,
          startDate: newOrder.startDate,
          dueDate: newOrder.dueDate,
          quantity: newOrder.quantity,
          procurement: newOrder.procurement,
          steps: newOrder.steps,
          timeline: newOrder.timeline,
          flashOrders: newOrder.flashOrders,
          messages: newOrder.messages,
          watchers: newOrder.watchers
        }
      }).then((created) => {
        if (created) {
          Object.assign(newOrder, created);
          state.selectedWorkOrderId = created.id;
          render();
        }
      });
    }
  }
  state.modals.workOrder = null;
  render();
}

function recordStepCompletion(stepCode, data) {
  const workOrder = getSelectedWorkOrder();
  const step = workOrder.steps.find((s) => s.code === stepCode);
  if (!step) return;
  step.completed += Number(data.completed) || 0;
  step.defects += Number(data.defects) || 0;
  const confirmationText = data.confirmation === 'fingerprint' ? '指纹确认' : '双人复核';
  const summary = `${step.name} ${confirmationText}：完成 ${data.completed} 件，缺陷 ${data.defects} 件。`;
  const timestamp = Date.now();
  workOrder.messages.push({
    id: randomId('msg'),
    type: 'system',
    sender: '系统',
    role: 'system',
    text: summary,
    timestamp,
    system: true,
    attachments: [],
    voice: null
  });
  workOrder.timeline.push({
    id: randomId('timeline'),
    step: step.name,
    text: summary,
    by: state.session.name,
    timestamp,
    category: 'progress',
    confirmation: data.confirmation
  });
  if (workOrder.procurement.autoNotify && Number(data.defects) > 0) {
    const autoMessage = `检测到 ${data.defects} 件不良，自动通知 ${workOrder.procurement.vendor} 采购补料 ${data.defects} 件。`;
    const automationTimestamp = Date.now();
    workOrder.messages.push({
      id: randomId('msg'),
      type: 'system',
      sender: '系统',
      role: 'system',
      text: autoMessage,
      timestamp: automationTimestamp,
      system: true,
      attachments: [],
      voice: null
    });
    workOrder.timeline.push({
      id: randomId('timeline'),
      step: step.name,
      text: autoMessage,
      by: '系统',
      timestamp: automationTimestamp,
      category: 'automation',
      confirmation: data.confirmation
    });
    showToast(isLiveMode() ? '已触发自动采购通知' : '已触发自动采购通知（演示）');
  } else {
    showToast('进度已上报');
  }
  if (isLiveMode()) {
    syncLive(`/api/work-orders/${workOrder.id}/steps/progress`, {
      body: {
        stepCode,
        completed: Number(data.completed) || 0,
        defects: Number(data.defects) || 0,
        confirmation: data.confirmation,
        by: state.session.name
      }
    });
  }
  state.modals.stepCompletion = null;
  render();
}

function createFlashOrder(note, quantity) {
  const workOrder = getSelectedWorkOrder();
  workOrder.flashOrders.push({
    id: randomId('flash'),
    note,
    quantity,
    createdAt: Date.now(),
    status: 'completed'
  });
  const timestamp = Date.now();
  workOrder.messages.push({
    id: randomId('msg'),
    type: 'system',
    sender: '系统',
    role: 'system',
    text: `闪电工单：${note}（${quantity} 件）已记录。`,
    timestamp,
    system: true,
    attachments: [],
    voice: null
  });
  workOrder.timeline.push({
    id: randomId('timeline'),
    step: '闪电工单',
    text: `${note}（${quantity} 件）已记录。`,
    by: state.session.name,
    timestamp,
    category: 'flash'
  });
  if (isLiveMode()) {
    syncLive(`/api/work-orders/${workOrder.id}/flash-orders`, {
      body: { note, quantity }
    });
  }
  state.modals.flash = null;
  render();
  showToast(isLiveMode() ? '闪电工单已提交' : '闪电工单已创建');
}

function updateQuickReplies(role, replies) {
  state.quickReplies[role] = replies;
  state.modals.quickReplies = false;
  render();
  showToast('快捷回复已更新');
  if (isLiveMode()) {
    syncLive(`/api/quick-replies/${role}`, {
      method: 'PUT',
      body: { replies }
    });
  }
}

function renderToast() {
  const existing = document.querySelector('.toast');
  if (existing) {
    existing.remove();
  }
  if (state.toast) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = state.toast;
    document.body.appendChild(toast);
  }
}

function renderLogin() {
  app.innerHTML = `
    <div class="login-card">
      <div class="demo-badge">${state.mode === 'live' ? '联机模式 · 需启动后端服务' : '演示模式 · 离线运行'}</div>
      <h1>工小聊桌面端</h1>
      <label>姓名
        <input type="text" id="login-name" placeholder="请输入姓名" value="${state.session ? state.session.name : ''}" />
      </label>
      <label>角色身份
        <select id="login-role">
          <option value="manager">老板 / 管理员</option>
          <option value="worker">工人</option>
          <option value="customer">客户</option>
        </select>
      </label>
      <label>体验模式
        <select id="login-mode">
          <option value="demo">离线演示模式</option>
          <option value="live">联机模式（需运行 node server.js）</option>
        </select>
      </label>
      <div class="login-actions">
        <button type="button" class="btn btn--ghost btn--pill" id="btn-demo">了解演示数据</button>
        <button type="button" class="btn btn--primary btn--pill" id="btn-login">进入工小聊</button>
      </div>
    </div>
  `;

  document.getElementById('btn-demo').addEventListener('click', () => {
    showToast('演示端包含 2 个示例工单，可随意体验');
  });

  document.getElementById('login-role').value = state.session?.role || 'manager';
  document.getElementById('login-mode').value = state.mode || 'demo';

  document.getElementById('btn-login').addEventListener('click', async () => {
    if (state.loading) return;
    const name = document.getElementById('login-name').value.trim() || '访客用户';
    const role = document.getElementById('login-role').value;
    const mode = document.getElementById('login-mode').value;
    state.session = {
      name,
      role
    };
    state.mode = mode;
    if (mode === 'live') {
      await activateLiveMode({ silent: true });
    } else {
      activateDemoMode({ silent: true });
      render();
    }
  });
}

function renderDueBadge(workOrder) {
  const info = getDueInfo(workOrder.dueDate);
  const content = info.status === 'unset' ? info.label : `${info.date} · ${info.label}`;
  return `<span class="due-badge due-${info.status}">${content}</span>`;
}

function renderWorkOrderList(filtered) {
  if (!filtered.length) {
    return '<div class="empty-state">暂无匹配的工单</div>';
  }
  const renderItem = (wo) => {
    const dueBadge = renderDueBadge(wo);
    const unreadBadge = wo.unread > 0 ? `<span class="unread-badge">${wo.unread}</span>` : '';
    const vendorLabel = wo.procurement?.vendor ? wo.procurement.vendor : '未指定工厂';
    return `
      <div class="work-order-item ${state.selectedWorkOrderId === wo.id ? 'active' : ''} ${wo.pinned ? 'pinned' : ''}" data-id="${wo.id}">
        <div class="meta">
          <span>${wo.code}</span>
          <div class="meta-actions">
            <button type="button" class="btn btn--icon btn--ghost pin-toggle ${wo.pinned ? 'is-active' : ''}" data-id="${wo.id}" aria-label="${wo.pinned ? '取消置顶' : '置顶工单'}" title="${wo.pinned ? '取消置顶' : '置顶'}">${wo.pinned ? '★' : '☆'}</button>
            <span>${statusLabel(wo.status)}</span>
          </div>
        </div>
        <div class="title">${wo.title}</div>
        <div class="meta">
          <span>${wo.owner}</span>
          <div class="meta-tags">
            <span class="vendor-badge">${vendorLabel}</span>
            ${dueBadge}
            ${unreadBadge}
          </div>
        </div>
      </div>
    `;
  };
  const pinned = filtered.filter((wo) => wo.pinned);
  const regular = filtered.filter((wo) => !wo.pinned);
  return `
    ${pinned.length ? `<div class="work-order-group"><div class="group-label">置顶工单</div>${pinned.map(renderItem).join('')}</div>` : ''}
    ${regular.length ? `<div class="work-order-group">${pinned.length ? '<div class="group-label">其他工单</div>' : ''}${regular.map(renderItem).join('')}</div>` : ''}
  `;
}

function renderMessages(messages) {
  return messages
    .map((msg) => {
      if (msg.system || msg.type === 'system') {
        return `<div class="message system">${msg.text}</div>`;
      }
      const attachments = (msg.attachments || [])
        .map((att) => `<div class="attachment-card"><span>${att.name}</span><span>${att.preview || att.size || ''}</span></div>`)
        .join('');
      const voice = msg.voice
        ? `<div class="voice-badge">🎤 语音 ${msg.voice.duration}s</div>`
        : '';
      return `
        <div class="message user ${msg.role}">
          <div class="header"><span>${msg.sender}</span><span>${relativeTime(msg.timestamp)}</span></div>
          <div class="body">${msg.text.replace(/\n/g, '<br/>')}</div>
          ${attachments ? `<div class="attachments">${attachments}</div>` : ''}
          ${voice}
        </div>
      `;
    })
    .join('');
}

function renderExportActionList() {
  return EXPORT_OPTIONS.map(
    (option) => `
      <div class="export-action">
        <div class="export-action__info">
          <strong>${option.label}</strong>
          <span>${option.description}</span>
        </div>
        <div class="export-action__buttons">
          <button type="button" class="btn btn--ghost btn--pill" data-preview="${option.type}">预览</button>
          <button type="button" class="btn btn--secondary btn--pill" data-export="${option.type}">下载</button>
        </div>
      </div>
    `
  ).join('');
}

function renderInsights(workOrder) {
  const completion = calculateCompletion(workOrder);
  const watchers = Array.isArray(workOrder.watchers) ? workOrder.watchers : [];
  const watchersContent = watchers.length
    ? `<div class="watcher-chips">${watchers
        .map((name) => `<span class="watcher-chip">${escapeHtml(name)}</span>`)
        .join('')}</div>`
    : '<div class="watcher-empty">暂未指定关注人</div>';
  const timelinePreview = workOrder.timeline
    .slice()
    .reverse()
    .slice(0, 4)
    .map((item) => {
      const category = resolveTimelineCategory(item);
      return `
        <div class="timeline-item">
          <div class="timeline-item__header">
            <strong>${item.step}</strong>
            <span class="timeline-category ${timelineCategoryClass(category)}">${timelineCategoryLabel(category)}</span>
          </div>
          <span>${item.text}</span>
          <span>${formatDateTime(item.timestamp)}${item.by ? ` · ${item.by}` : ''}</span>
        </div>
      `;
    })
    .join('');
  return `
    <header>
      <h3>生产洞察</h3>
      <div class="badge-success">已接入 OCR 预览 · 自动采购提醒</div>
    </header>
    <section class="insights-section">
      <div class="metric-card">
        <span>完成率</span>
        <strong>${completion.completionRate}%</strong>
        <small>产出 ${completion.produced} / ${workOrder.quantity}</small>
      </div>
      <div class="metric-card">
        <span>不良数</span>
        <strong>${completion.defects}</strong>
        <small>自动补料 ${workOrder.procurement.autoNotify ? '开启' : '关闭'}</small>
      </div>
      <div class="metric-card">
        <span>闪电工单</span>
        <strong>${workOrder.flashOrders.length}</strong>
        <small>${workOrder.flashOrders.length ? '最新：' + workOrder.flashOrders[workOrder.flashOrders.length - 1].note : '暂无记录'}</small>
      </div>
    </section>
    <section class="insights-section">
      <h4>关注人</h4>
      ${watchersContent}
    </section>
    <section class="insights-section">
      <h4>时间轴预览</h4>
      <div class="timeline-preview">
        ${timelinePreview || '<div class="timeline-item">暂无最新动态</div>'}
      </div>
      <button type="button" class="btn btn--secondary btn--pill btn--full" data-action="open-timeline">查看全部历史</button>
    </section>
    <section class="insights-section">
      <h4>导出与对账</h4>
      <div class="export-actions">${renderExportActionList()}</div>
    </section>
  `;
}

function renderWorkspace() {
  const filtered = getFilteredWorkOrders();
  const workOrder = getSelectedWorkOrder();
  if (!workOrder && filtered.length) {
    state.selectedWorkOrderId = filtered[0].id;
  }
  const selected = getSelectedWorkOrder();
  const totalUnread = state.workOrders.reduce((sum, wo) => sum + (wo.unread || 0), 0);
  const licenseMeta = getLicenseMeta();
  const watchersLabel =
    selected && Array.isArray(selected.watchers) && selected.watchers.length
      ? ` · 关注 ${selected.watchers.map((name) => escapeHtml(name)).join('、')}`
      : '';
  const composerDraft = selected ? getMessageDraft(selected.id) : getMessageDraft(null);

  app.innerHTML = `
    <div class="workspace">
      <header class="app-header">
        <div class="title">
          <strong>工小聊 · 桌面端</strong>
          <span>${state.session.name} · ${state.session.role === 'manager' ? '老板' : state.session.role === 'worker' ? '工人' : '客户'} · ${state.mode === 'demo' ? '离线演示模式' : '联机模式'}</span>
        </div>
        <div class="header-actions">
          <span class="tag license-tag tag--${licenseMeta.severity}" title="${escapeHtml(licenseMeta.tooltip)}">${escapeHtml(licenseMeta.text)}</span>
          <div class="tag sync-indicator">⟳ <span>上次${state.mode === 'live' ? '联机' : '演示'}同步 ${relativeTime(state.lastSyncedAt)}</span></div>
          <button type="button" class="btn btn--ghost btn--pill" data-action="toggle-mode" ${state.loading ? 'disabled' : ''}>${state.mode === 'demo' ? '切换至联机模式' : '切换至演示模式'}</button>
          <button type="button" class="btn btn--secondary btn--pill" data-action="manual-sync" ${state.loading ? 'disabled' : ''}>${state.mode === 'live' ? '联机同步' : '刷新演示数据'}</button>
          <button type="button" class="btn btn--ghost btn--pill" data-action="open-command">⌘K 全局搜索</button>
          ${state.session.role === 'manager' ? '<button type="button" class="btn btn--primary btn--pill" data-action="open-dashboard">老板看板</button>' : ''}
          <button type="button" class="btn btn--ghost btn--pill" data-action="open-license">订阅 / 激活</button>
        </div>
      </header>
      <div class="layout">
        <aside class="sidebar">
          <div class="sidebar-header">
            <h2>工单</h2>
            ${
              totalUnread > 0
                ? `<button type="button" class="btn btn--ghost btn--pill" data-action="mark-read" title="全部标为已读">✓ 全部已读 (${totalUnread})</button>`
                : ''
            }
          </div>
          <div class="filter-group">
            <input type="search" id="filter-search" placeholder="搜索编号 / 客户 / 标题" value="${state.filters.search}" />
            <select id="filter-owner">
              <option value="all">全部负责人</option>
              ${Array.from(new Set(state.workOrders.map((w) => w.owner)))
                .map((owner) => `<option value="${owner}" ${state.filters.owner === owner ? 'selected' : ''}>${owner}</option>`)
                .join('')}
            </select>
            <select id="filter-customer">
              <option value="all">全部客户</option>
              ${Array.from(new Set(state.workOrders.map((w) => w.customer).filter(Boolean)))
                .map((customer) => `<option value="${customer}" ${state.filters.customer === customer ? 'selected' : ''}>${customer}</option>`)
                .join('')}
            </select>
            <select id="filter-vendor">
              <option value="all">全部采购工厂</option>
              ${Array.from(
                new Set(
                  state.workOrders
                    .map((w) => (w.procurement?.vendor ? w.procurement.vendor.trim() : '未指定工厂'))
                    .filter(Boolean)
                )
              )
                .map(
                  (vendor) =>
                    `<option value="${vendor}" ${state.filters.vendor === vendor ? 'selected' : ''}>${vendor}</option>`
                )
                .join('')}
            </select>
            <div class="filter-pills" data-group="status">
              ${['all', 'in-progress', 'pending', 'completed', 'cancelled']
                .map((key) => `<span class="filter-pill ${state.filters.status === key ? 'active' : ''}" data-value="${key}">${statusLabel(key)}</span>`)
                .join('')}
            </div>
            <div class="filter-pills" data-group="priority">
              ${['all', 'high', 'medium', 'low']
                .map((key) => `<span class="filter-pill ${state.filters.priority === key ? 'active' : ''}" data-value="${key}">优先级 ${priorityLabel(key)}</span>`)
                .join('')}
            </div>
            <div class="filter-pills" data-group="due">
              ${['all', 'overdue', 'today', 'week', 'scheduled', 'unset']
                .map((key) => `<span class="filter-pill ${state.filters.due === key ? 'active' : ''}" data-value="${key}">${dueFilterLabel(key)}</span>`)
                .join('')}
            </div>
            <label class="toggle-pinned">
              <input type="checkbox" id="filter-pinned" ${state.filters.pinnedOnly ? 'checked' : ''} />
              仅看置顶工单
            </label>
            ${state.session.role === 'manager'
              ? '<button type="button" class="btn btn--primary btn--pill btn--full" data-action="create-work-order">+ 新建工单</button>'
              : ''}
          </div>
          <div class="work-order-list">${renderWorkOrderList(filtered)}</div>
        </aside>
        <section class="chat-pane">
          ${selected
            ? `
              <div class="chat-header">
                <div class="details">
                  <strong>${selected.title}</strong>
                  <span>${selected.code} · ${selected.customer} · 负责人 ${selected.owner} · 优先级 ${priorityLabel(selected.priority)} · 采购 ${selected.procurement?.vendor || '未指定工厂'}${watchersLabel}</span>
                </div>
                <div class="chat-actions">
                  <button type="button" class="btn btn--ghost btn--pill" data-action="copy-code">复制编号</button>
                  <button type="button" class="btn btn--ghost btn--pill" data-action="open-settings">设置</button>
                  <button type="button" class="btn btn--secondary btn--pill" data-action="open-flash">闪电工单</button>
                  <button type="button" class="btn btn--ghost btn--pill" data-action="open-step">工序上报</button>
                </div>
              </div>
              <div class="chat-timeline">${renderMessages(selected.messages)}</div>
              <div class="chat-composer">
                <div class="quick-replies">
                  ${(state.quickReplies[state.session.role] || [])
                    .map((reply) => `<span class="quick-reply" data-reply="${reply}">${reply}</span>`)
                    .join('')}
                  <button type="button" class="btn btn--ghost btn--pill" data-action="manage-quick-replies">管理快捷回复</button>
                </div>
                <textarea id="composer-input" placeholder="输入消息...">${composerDraft}</textarea>
                <div class="footer">
                  <div class="composer-actions">
                    <label class="btn btn--ghost btn--pill composer-upload">
                      📎 附件
                      <input type="file" id="upload-attachment" multiple />
                    </label>
                    <button type="button" class="btn btn--ghost btn--pill" data-action="record-voice">🎤 语音</button>
                  </div>
                  <button type="button" class="btn btn--primary btn--pill" data-action="send-message">发送</button>
                </div>
              </div>
            `
            : '<div class="chat-placeholder">请选择工单查看详情</div>'}
        </section>
        <aside class="insights-pane">
          ${selected ? renderInsights(selected) : ''}
        </aside>
      </div>
    </div>
  `;

  attachWorkspaceEvents();
}

function attachWorkspaceEvents() {
  const filtered = getFilteredWorkOrders();
  filtered.forEach((wo) => {
    const el = document.querySelector(`.work-order-item[data-id="${wo.id}"]`);
    if (el) {
      el.addEventListener('click', () => selectWorkOrder(wo.id));
    }
  });

  document.querySelectorAll('.pin-toggle').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      togglePinnedWorkOrder(btn.dataset.id);
    });
  });

  const searchInput = document.getElementById('filter-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.filters.search = e.target.value;
      render();
    });
  }

  const ownerSelect = document.getElementById('filter-owner');
  if (ownerSelect) {
    ownerSelect.addEventListener('change', (e) => {
      state.filters.owner = e.target.value;
      render();
    });
  }

  const customerSelect = document.getElementById('filter-customer');
  if (customerSelect) {
    customerSelect.addEventListener('change', (e) => {
      state.filters.customer = e.target.value;
      render();
    });
  }

  const vendorSelect = document.getElementById('filter-vendor');
  if (vendorSelect) {
    vendorSelect.addEventListener('change', (e) => {
      state.filters.vendor = e.target.value;
      render();
    });
  }

  const pinnedToggle = document.getElementById('filter-pinned');
  if (pinnedToggle) {
    pinnedToggle.addEventListener('change', (e) => {
      state.filters.pinnedOnly = e.target.checked;
      render();
    });
  }

  document.querySelectorAll('.filter-pills').forEach((group) => {
    group.querySelectorAll('.filter-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        const groupName = group.dataset.group;
        state.filters[groupName] = pill.dataset.value;
        render();
      });
    });
  });

  const composer = document.getElementById('composer-input');
  if (composer) {
    composer.addEventListener('input', (e) => {
      const workOrder = getSelectedWorkOrder();
      const workOrderId = workOrder ? workOrder.id : null;
      setMessageDraft(workOrderId, e.target.value);
    });
    composer.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendTextMessage();
      }
    });
  }

  document.querySelectorAll('.quick-reply').forEach((chip) => {
    chip.addEventListener('click', () => {
      const workOrder = getSelectedWorkOrder();
      const workOrderId = workOrder ? workOrder.id : null;
      const current = getMessageDraft(workOrderId);
      const next = `${current.trim()} ${chip.dataset.reply}`.trim();
      setMessageDraft(workOrderId, next);
      render();
    });
  });

  const sendButton = document.querySelector('[data-action="send-message"]');
  if (sendButton) {
    sendButton.addEventListener('click', sendTextMessage);
  }

  const voiceButton = document.querySelector('[data-action="record-voice"]');
  if (voiceButton) {
    voiceButton.addEventListener('click', () => {
      const note = prompt('请输入语音备注内容（演示将自动生成语音时长）', '语音备注：进度正常，无异常');
      if (note !== null) {
        sendVoiceNote(note);
      }
    });
  }

  const attachmentInput = document.getElementById('upload-attachment');
  if (attachmentInput) {
    attachmentInput.addEventListener('change', (e) => {
      sendAttachment(e.target.files);
      attachmentInput.value = '';
    });
  }

  const timelineButton = document.querySelector('[data-action="open-timeline"]');
  if (timelineButton) {
    timelineButton.addEventListener('click', () => {
      state.timelineFilter = 'all';
      state.timelineSearch = '';
      state.modals.timeline = true;
      renderModals();
    });
  }

  const stepButton = document.querySelector('[data-action="open-step"]');
  if (stepButton) {
    stepButton.addEventListener('click', () => {
      const workOrder = getSelectedWorkOrder();
      state.modals.stepCompletion = { workOrderId: workOrder.id, stepCode: workOrder.steps[0]?.code || '' };
      renderModals();
    });
  }

  const flashButton = document.querySelector('[data-action="open-flash"]');
  if (flashButton) {
    flashButton.addEventListener('click', () => {
      state.modals.flash = { workOrderId: getSelectedWorkOrder().id };
      renderModals();
    });
  }

  const copyCodeButton = document.querySelector('[data-action="copy-code"]');
  if (copyCodeButton) {
    copyCodeButton.addEventListener('click', () => {
      copyWorkOrderCode();
    });
  }

  const settingsButton = document.querySelector('[data-action="open-settings"]');
  if (settingsButton) {
    settingsButton.addEventListener('click', () => {
      const workOrder = getSelectedWorkOrder();
      state.modals.workOrder = { mode: 'edit', workOrderId: workOrder.id };
      renderModals();
    });
  }

  const createButton = document.querySelector('[data-action="create-work-order"]');
  if (createButton) {
    createButton.addEventListener('click', () => {
      state.modals.workOrder = { mode: 'create' };
      renderModals();
    });
  }

  const quickReplyButton = document.querySelector('[data-action="manage-quick-replies"]');
  if (quickReplyButton) {
    quickReplyButton.addEventListener('click', () => {
      state.modals.quickReplies = true;
      renderModals();
    });
  }

  const exportButtons = document.querySelectorAll('[data-export]');
  exportButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      exportWorkOrder(getSelectedWorkOrder(), btn.dataset.export);
    });
  });

  const previewButtons = document.querySelectorAll('[data-preview]');
  previewButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      openExportPreview(btn.dataset.preview);
    });
  });

  const syncButton = document.querySelector('[data-action="manual-sync"]');
  if (syncButton) {
    syncButton.addEventListener('click', () => {
      if (state.loading) return;
      manualSync();
    });
  }

  const commandButton = document.querySelector('[data-action="open-command"]');
  if (commandButton) {
    commandButton.addEventListener('click', () => {
      const selected = getSelectedWorkOrder();
      const hint = state.filters.search || (selected ? selected.code : '');
      openCommandPalette(hint);
    });
  }

  const modeButton = document.querySelector('[data-action="toggle-mode"]');
  if (modeButton) {
    modeButton.addEventListener('click', () => {
      if (state.loading) return;
      if (isLiveMode()) {
        activateDemoMode();
      } else {
        activateLiveMode();
      }
    });
  }

  const dashboardButton = document.querySelector('[data-action="open-dashboard"]');
  if (dashboardButton) {
    dashboardButton.addEventListener('click', () => {
      state.modals.managerDashboard = true;
      renderModals();
    });
  }

  const licenseButton = document.querySelector('[data-action="open-license"]');
  if (licenseButton) {
    licenseButton.addEventListener('click', () => {
      state.modals.license = true;
      renderModals();
    });
  }

  const markReadButton = document.querySelector('[data-action="mark-read"]');
  if (markReadButton) {
    markReadButton.addEventListener('click', () => {
      markAllWorkOrdersRead();
    });
  }
}

function renderTimelineModal() {
  if (!state.modals.timeline) return '';
  const workOrder = getSelectedWorkOrder();
  const keyword = state.timelineSearch.trim().toLowerCase();
  const filteredEntries = workOrder.timeline
    .slice()
    .reverse()
    .filter((item) => {
      const category = resolveTimelineCategory(item);
      const categoryMatched = state.timelineFilter === 'all' || category === state.timelineFilter;
      if (!categoryMatched) return false;
      const confirmationMatched =
        state.timelineConfirmation === 'all' ||
        (state.timelineConfirmation === 'none' && !item.confirmation) ||
        item.confirmation === state.timelineConfirmation;
      if (!confirmationMatched) return false;
      if (!keyword) return true;
      const haystack = `${item.step || ''} ${item.text || ''} ${item.by || ''}`.toLowerCase();
      return haystack.includes(keyword);
    });
  const entries = filteredEntries
    .map((item) => {
      const category = resolveTimelineCategory(item);
      const confirmationBadge = item.confirmation
        ? `<span class="timeline-confirmation ${timelineConfirmationClass(item.confirmation)}">${timelineConfirmationLabel(item.confirmation)}</span>`
        : '';
      return `
        <div class="timeline-item">
          <div class="timeline-item__header">
            <strong>${escapeHtml(item.step || '未指定工序')}</strong>
            <div class="timeline-item__badges">
              ${confirmationBadge}
              <span class="timeline-category ${timelineCategoryClass(category)}">${timelineCategoryLabel(category)}</span>
            </div>
          </div>
          <span>${escapeHtml(item.text || '')}</span>
          <span>${formatDateTime(item.timestamp)} · ${escapeHtml(item.by || '系统')}</span>
        </div>
      `;
    })
    .join('');
  const summaryDetails = [];
  if (keyword) {
    summaryDetails.push(`匹配“${escapeHtml(state.timelineSearch.trim())}”`);
  }
  if (state.timelineConfirmation !== 'all') {
    summaryDetails.push(timelineConfirmationFilterLabel(state.timelineConfirmation));
  }
  const summary = `
    <div class="timeline-summary">
      共 ${filteredEntries.length} 条记录${summaryDetails.length ? `，${summaryDetails.join('，')}` : ''}
    </div>
  `;
  const emptyMessage = (() => {
    if (keyword) {
      return `未找到匹配“${escapeHtml(state.timelineSearch.trim())}”的记录`;
    }
    switch (state.timelineConfirmation) {
      case 'fingerprint':
        return '暂无指纹确认记录';
      case 'dual':
        return '暂无双人复核记录';
      case 'none':
        return '暂无其他类型记录';
      default:
        return '暂无记录';
    }
  })();
  const emptyState = `<div class="timeline-item timeline-item--empty">${emptyMessage}</div>`;
  return `
    <div class="modal-backdrop" data-modal="timeline">
      <div class="modal">
        <h2>${workOrder.title} · 进度时间线</h2>
        <div class="timeline-filters">
          ${TIMELINE_FILTERS.map(
            (filter) => `
              <button type="button" class="timeline-filter ${
                state.timelineFilter === filter.value ? 'is-active' : ''
              }" data-timeline-filter="${filter.value}">${filter.label}</button>
            `
          ).join('')}
        </div>
        <div class="timeline-search">
          <input
            type="search"
            placeholder="搜索工序、备注或操作人"
            value="${escapeHtml(state.timelineSearch)}"
            data-timeline-search
          />
          ${
            state.timelineSearch
              ? '<button type="button" class="timeline-search__clear" data-timeline-clear>清除</button>'
              : ''
          }
        </div>
        <div class="timeline-confirmation-filter">
          <label for="timeline-confirmation">确认方式</label>
          <select id="timeline-confirmation" data-timeline-confirmation>
            ${TIMELINE_CONFIRMATION_FILTERS.map(
              (option) => `
                <option value="${option.value}" ${
                  state.timelineConfirmation === option.value ? 'selected' : ''
                }>${option.label}</option>
              `
            ).join('')}
          </select>
        </div>
        ${summary}
        <div class="timeline-preview" style="max-height:420px">${entries || emptyState}</div>
        <div class="modal-actions">
          <button type="button" class="btn btn--ghost btn--pill" data-close>关闭</button>
        </div>
      </div>
    </div>
  `;
}

function renderWorkOrderModal() {
  const payload = state.modals.workOrder;
  if (!payload) return '';
  const workOrder = payload.mode === 'edit' ? state.workOrders.find((wo) => wo.id === payload.workOrderId) : null;
  const title = payload.mode === 'edit' ? '编辑工单' : '新建工单';
  return `
    <div class="modal-backdrop" data-modal="workOrder">
      <div class="modal">
        <h2>${title}</h2>
        <form id="work-order-form">
          <label>标题
            <input name="title" value="${workOrder ? workOrder.title : ''}" required />
          </label>
          <label>客户
            <input name="customer" value="${workOrder ? workOrder.customer : ''}" required />
          </label>
          <label>负责人
            <input name="owner" value="${workOrder ? workOrder.owner : state.session.name}" required />
          </label>
          <label>优先级
            <select name="priority">
              ${['high', 'medium', 'low']
                .map((level) => `<option value="${level}" ${workOrder && workOrder.priority === level ? 'selected' : ''}>${priorityLabel(level)}</option>`)
                .join('')}
            </select>
          </label>
          <label>计划开始时间
            <input type="date" name="startDate" value="${workOrder ? workOrder.startDate : formatDate(Date.now())}" />
          </label>
          <label>计划结束时间
            <input type="date" name="dueDate" value="${workOrder ? workOrder.dueDate : formatDate(Date.now() + 1000 * 60 * 60 * 24 * 5)}" />
          </label>
          <label>目标数量
            <input type="number" name="quantity" value="${workOrder ? workOrder.quantity : 0}" />
          </label>
          <label>是否自动通知采购
            <select name="autoNotify">
              <option value="true" ${workOrder?.procurement?.autoNotify ? 'selected' : ''}>开启</option>
              <option value="false" ${workOrder && !workOrder.procurement.autoNotify ? 'selected' : ''}>关闭</option>
            </select>
          </label>
          <label>指定采购工厂
            <input name="vendor" value="${workOrder?.procurement?.vendor || ''}" placeholder="示例：苏州精工" />
          </label>
          <label>关注人（逗号分隔）
            <input name="watchers" value="${workOrder ? escapeHtml((workOrder.watchers || []).join('、')) : escapeHtml(state.session?.name || '')}" placeholder="示例：王强、李工" />
          </label>
        </form>
        <div class="modal-actions">
          <button type="button" class="btn btn--ghost btn--pill" data-close>取消</button>
          <button type="button" class="btn btn--primary btn--pill" data-save>保存</button>
        </div>
      </div>
    </div>
  `;
}

function renderQuickReplyModal() {
  if (!state.modals.quickReplies) return '';
  const role = state.session.role;
  const replies = [...(state.quickReplies[role] || [])];
  return `
    <div class="modal-backdrop" data-modal="quickReplies">
      <div class="modal">
        <h2>管理快捷回复</h2>
        <div class="quick-replies" style="gap:6px">${replies.map((text, index) => `<span class="quick-reply" data-index="${index}">${text}</span>`).join('')}</div>
        <form id="quick-reply-form">
          <label>新增回复
            <input name="content" placeholder="输入快捷回复内容" />
          </label>
        </form>
        <small style="color:var(--color-subtle)">提示：点击已有回复可删除，新增内容不超过 50 字。</small>
        <div class="modal-actions">
          <button type="button" class="btn btn--ghost btn--pill" data-close>完成</button>
        </div>
      </div>
    </div>
  `;
}

function renderStepCompletionModal() {
  const payload = state.modals.stepCompletion;
  if (!payload) return '';
  const workOrder = state.workOrders.find((wo) => wo.id === payload.workOrderId);
  return `
    <div class="modal-backdrop" data-modal="step">
      <div class="modal">
        <h2>${workOrder.title} · 工序上报</h2>
        <form id="step-form">
          <label>选择工序
            <select name="stepCode">
              ${workOrder.steps
                .map((step) => `<option value="${step.code}" ${payload.stepCode === step.code ? 'selected' : ''}>${step.name} · ${step.assignee}</option>`)
                .join('')}
            </select>
          </label>
          <label>完成数量
            <input type="number" name="completed" min="0" required value="0" />
          </label>
          <label>不良数量
            <input type="number" name="defects" min="0" required value="0" />
          </label>
          <label>确认方式
            <select name="confirmation">
              <option value="fingerprint">指纹识别</option>
              <option value="dual">无指纹，双人确认</option>
            </select>
          </label>
        </form>
        <div class="modal-actions">
          <button type="button" class="btn btn--ghost btn--pill" data-close>取消</button>
          <button type="button" class="btn btn--primary btn--pill" data-save>提交</button>
        </div>
      </div>
    </div>
  `;
}

function renderFlashModal() {
  const payload = state.modals.flash;
  if (!payload) return '';
  const workOrder = state.workOrders.find((wo) => wo.id === payload.workOrderId);
  return `
    <div class="modal-backdrop" data-modal="flash">
      <div class="modal">
        <h2>${workOrder.title} · 闪电工单</h2>
        <form id="flash-form">
          <label>备注
            <textarea name="note" rows="3" placeholder="说明补料/返工原因" required></textarea>
          </label>
          <label>数量
            <input type="number" name="quantity" min="1" value="10" />
          </label>
        </form>
        <div class="modal-actions">
          <button type="button" class="btn btn--ghost btn--pill" data-close>取消</button>
          <button type="button" class="btn btn--primary btn--pill" data-save>保存</button>
        </div>
      </div>
    </div>
  `;
}

function renderExportPreviewModal() {
  const modal = state.modals.exportPreview;
  if (!modal) return '';
  const metaEntries = Object.entries(modal.payload?.meta || {});
  const metaList = metaEntries
    .map(([key, value]) => `
      <li>
        <span>${EXPORT_META_LABELS[key] || key}</span>
        <strong>${escapeHtml(value ?? '') || '—'}</strong>
      </li>
    `)
    .join('');
  return `
    <div class="modal-backdrop" data-modal="exportPreview">
      <div class="modal modal--wide">
        <h2>${modal.label}预览</h2>
        <p class="export-preview__subtitle">${modal.description} · 文件名 ${modal.filename}</p>
        <ul class="export-preview__meta">${metaList}</ul>
        <div class="export-preview__content"><pre>${escapeHtml(modal.preview)}</pre></div>
        ${modal.truncated ? '<p class="export-preview__hint">内容较长，仅展示前 2000 个字符。</p>' : ''}
        <div class="modal-actions">
          <button type="button" class="btn btn--ghost btn--pill" data-close>关闭</button>
          <button type="button" class="btn btn--ghost btn--pill" data-copy-export>复制内容</button>
          <button type="button" class="btn btn--secondary btn--pill" data-print-export>打印</button>
          <button type="button" class="btn btn--primary btn--pill" data-download-export>下载</button>
        </div>
      </div>
    </div>
  `;
}

function renderDashboardModal() {
  if (!state.modals.managerDashboard) return '';
  const cards = state.workOrders.map((wo) => {
    const completion = calculateCompletion(wo);
    return `
      <div class="metric-card">
        <strong>${wo.title}</strong>
        <span>${wo.code} · ${statusLabel(wo.status)}</span>
        <span>负责人：${wo.owner}</span>
        <span>当前工序：${wo.steps.find((s) => s.completed < wo.quantity)?.name || '已全部完成'}</span>
        <span>完成率：${completion.completionRate}%</span>
        <span>预计完成：${wo.steps[wo.steps.length - 1]?.eta || wo.dueDate}</span>
      </div>
    `;
  });
  return `
    <div class="modal-backdrop" data-modal="dashboard">
      <div class="modal" style="width:640px">
        <h2>老板看板（演示）</h2>
        <div class="insights-section" style="max-height:520px; overflow:auto; grid-template-columns:repeat(auto-fill,minmax(260px,1fr));">${cards.join('')}</div>
        <div class="modal-actions">
          <button type="button" class="btn btn--ghost btn--pill" data-close>关闭</button>
        </div>
      </div>
    </div>
  `;
}

function renderLicenseModal() {
  if (!state.modals.license) return '';
  const license = getLicenseState();
  const meta = getLicenseMeta(license);
  const usagePercent = license.seats ? Math.min(100, Math.round((license.seatsUsed / license.seats) * 100)) : 0;
  const renewOptions = [
    { days: 30, label: '续期 30 天' },
    { days: 90, label: '续期 90 天' },
    { days: 365, label: '续期 12 个月' }
  ];
  const planCards = LICENSE_PLANS.map((plan) => {
    const active = meta.tier === plan.tier ? 'active' : '';
    const planName = escapeHtml(plan.name);
    const action =
      meta.tier === plan.tier
        ? '<span class="license-plan__badge">当前套餐</span>'
        : `<button type="button" class="btn btn--ghost btn--pill" data-license-select="${plan.tier}">切换至${planName}</button>`;
    return `
      <article class="license-plan ${active}">
        <header>
          <strong>${planName}</strong>
          <span>${escapeHtml(plan.price)}</span>
        </header>
        <p>${escapeHtml(plan.summary)}</p>
        <ul>${plan.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join('')}</ul>
        ${action}
      </article>
    `;
  }).join('');
  return `
    <div class="modal-backdrop" data-modal="license">
      <div class="modal license-modal">
        <h2>订阅与激活</h2>
        <p>云端发码支持远程激活、续期、封停与名额管理，覆盖基础 / 专业 / 旗舰三档套餐。</p>
        <section class="license-overview">
          <div class="license-overview__meta">
            <strong>${escapeHtml(meta.planName)}</strong>
            <span>${escapeHtml(`${meta.statusLabel} · ${meta.countdownLabel}`)}</span>
            <span>${license.activationCode ? `激活码：${escapeHtml(license.activationCode)}` : '暂未配置激活码'}</span>
            <span>名额：${escapeHtml(meta.seatsLabel)}${license.seats ? ` · ${usagePercent}% 占用` : ''}</span>
            <span>自动续订：${license.autoRenew ? '已开启' : '未开启'}</span>
          </div>
          <div class="license-overview__actions">
            ${renewOptions
              .map(
                (option) =>
                  `<button type="button" class="btn btn--secondary btn--pill" data-license-renew="${option.days}">${option.label}</button>`
              )
              .join('')}
            <button type="button" class="btn btn--ghost btn--pill" data-license-action="${license.status === 'suspended' ? 'resume' : 'suspend'}">${license.status === 'suspended' ? '解除封停' : '立即封停'}</button>
            <button type="button" class="btn btn--ghost btn--pill" data-license-action="toggle-auto-renew">${license.autoRenew ? '关闭自动续订' : '开启自动续订'}</button>
          </div>
        </section>
        <section class="license-usage">
          <div class="license-usage__head">
            <span>当前占用 ${escapeHtml(meta.seatsLabel)}</span>
            <span>${usagePercent}%</span>
          </div>
          <div class="license-usage__bar"><span style="width:${usagePercent}%"></span></div>
          <div class="license-usage__controls">
            <button type="button" class="btn btn--ghost btn--pill" data-license-seat="remove" ${license.seatsUsed ? '' : 'disabled'}>- 释放 1 个名额</button>
            <button type="button" class="btn btn--ghost btn--pill" data-license-seat="add" ${license.seatsUsed >= license.seats ? 'disabled' : ''}>+ 新增 1 个名额</button>
          </div>
        </section>
        <section class="license-plan-list">
          <h3>套餐对比</h3>
          <div class="license-plan-grid">${planCards}</div>
        </section>
        <div class="modal-actions">
          <button type="button" class="btn btn--ghost btn--pill" data-close>关闭</button>
        </div>
      </div>
    </div>
  `;
}

function renderModals() {
  modalRoot.innerHTML = [
    renderTimelineModal(),
    renderWorkOrderModal(),
    renderQuickReplyModal(),
    renderStepCompletionModal(),
    renderFlashModal(),
    renderExportPreviewModal(),
    renderDashboardModal(),
    renderLicenseModal()
  ]
    .filter(Boolean)
    .join('');

  modalRoot.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) {
        closeModal(backdrop.dataset.modal);
      }
    });
    const closeBtn = backdrop.querySelector('[data-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => closeModal(backdrop.dataset.modal));
    }
    const saveBtn = backdrop.querySelector('[data-save]');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => handleModalSave(backdrop.dataset.modal));
    }
    if (backdrop.dataset.modal === 'quickReplies') {
      backdrop.querySelectorAll('.quick-reply').forEach((chip) => {
        chip.addEventListener('click', () => {
          const index = Number(chip.dataset.index);
          const role = state.session.role;
          state.quickReplies[role].splice(index, 1);
          renderModals();
        });
      });
      const form = backdrop.querySelector('#quick-reply-form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const content = form.content.value.trim();
        if (!content) return;
        if (content.length > 50) {
          alert('内容不能超过 50 字');
          return;
        }
        state.quickReplies[state.session.role].push(content);
        form.reset();
        renderModals();
      });
    }
    if (backdrop.dataset.modal === 'timeline') {
      backdrop.querySelectorAll('[data-timeline-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.timelineFilter = btn.dataset.timelineFilter;
          renderModals();
        });
      });
      const searchInput = backdrop.querySelector('[data-timeline-search]');
      if (searchInput) {
        searchInput.addEventListener('input', (event) => {
          state.timelineSearch = event.target.value;
          renderModals();
        });
        if (!state.timelineSearch) {
          searchInput.focus();
        }
      }
      const clearBtn = backdrop.querySelector('[data-timeline-clear]');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          state.timelineSearch = '';
          renderModals();
        });
      }
      const confirmationSelect = backdrop.querySelector('[data-timeline-confirmation]');
      if (confirmationSelect) {
        confirmationSelect.addEventListener('change', (event) => {
          state.timelineConfirmation = event.target.value;
          renderModals();
        });
      }
    }
    if (backdrop.dataset.modal === 'exportPreview') {
      const downloadBtn = backdrop.querySelector('[data-download-export]');
      if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
          const payload = state.modals.exportPreview;
          if (!payload) return;
          downloadFile(payload.filename, payload.content, payload.mime);
          showToast('导出任务已完成');
        });
      }
      const copyBtn = backdrop.querySelector('[data-copy-export]');
      if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
          const payload = state.modals.exportPreview;
          if (!payload) return;
          try {
            await copyToClipboard(payload.content);
            showToast('预览内容已复制');
          } catch (error) {
            console.error('[copy export]', error);
            showToast('复制失败，请稍后再试');
          }
        });
      }
      const printBtn = backdrop.querySelector('[data-print-export]');
      if (printBtn) {
        printBtn.addEventListener('click', () => {
          const payload = state.modals.exportPreview;
          if (!payload) return;
          openPrintWindow(payload);
        });
      }
    }
    if (backdrop.dataset.modal === 'license') {
      backdrop.querySelectorAll('[data-license-renew]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const duration = Number(btn.dataset.licenseRenew);
          renewLicense(Number.isFinite(duration) ? duration : undefined);
        });
      });
      backdrop.querySelectorAll('[data-license-action]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.licenseAction;
          switch (action) {
            case 'suspend':
              suspendLicense();
              break;
            case 'resume':
              resumeLicense();
              break;
            case 'toggle-auto-renew':
              toggleAutoRenew();
              break;
            default:
              break;
          }
        });
      });
      backdrop.querySelectorAll('[data-license-seat]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const mode = btn.dataset.licenseSeat;
          adjustLicenseSeats(mode === 'add' ? 1 : -1);
        });
      });
      backdrop.querySelectorAll('[data-license-select]').forEach((btn) => {
        btn.addEventListener('click', () => {
          selectLicensePlan(btn.dataset.licenseSelect);
        });
      });
    }
  });
}

function closeModal(name) {
  switch (name) {
    case 'timeline':
      state.modals.timeline = false;
      state.timelineFilter = 'all';
      state.timelineConfirmation = 'all';
      state.timelineSearch = '';
      break;
    case 'workOrder':
      state.modals.workOrder = null;
      break;
    case 'quickReplies':
      state.modals.quickReplies = false;
      break;
    case 'step':
      state.modals.stepCompletion = null;
      break;
    case 'flash':
      state.modals.flash = null;
      break;
    case 'exportPreview':
      state.modals.exportPreview = null;
      break;
    case 'dashboard':
      state.modals.managerDashboard = false;
      break;
    case 'license':
      state.modals.license = false;
      break;
    default:
      break;
  }
  renderModals();
}

function handleModalSave(name) {
  switch (name) {
    case 'workOrder': {
      const form = document.getElementById('work-order-form');
      const raw = new FormData(form);
      const formData = Object.fromEntries(raw.entries());
      const watchersRaw = raw.get('watchers');
      formData.autoNotify = formData.autoNotify === 'true';
      formData.watchers = typeof watchersRaw === 'string'
        ? Array.from(
            new Set(
              watchersRaw
                .split(/[，,;；、\s]+/)
                .map((item) => item.trim())
                .filter((item) => item.length > 0),
            ),
          )
        : [];
      upsertWorkOrder(formData, state.modals.workOrder?.workOrderId || null);
      break;
    }
    case 'step': {
      const form = document.getElementById('step-form');
      const formData = Object.fromEntries(new FormData(form).entries());
      recordStepCompletion(formData.stepCode, formData);
      break;
    }
    case 'flash': {
      const form = document.getElementById('flash-form');
      const formData = Object.fromEntries(new FormData(form).entries());
      createFlashOrder(formData.note, Number(formData.quantity) || 0);
      break;
    }
    default:
      break;
  }
}

function handleGlobalKeydown(event) {
  const key = event.key;
  const activeElement = document.activeElement;
  const tagName = activeElement?.tagName?.toLowerCase() || '';
  const isEditable = activeElement?.isContentEditable;
  const isFormField = ['input', 'textarea', 'select'].includes(tagName) || isEditable;

  if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === 'k') {
    event.preventDefault();
    const selected = getSelectedWorkOrder();
    const currentQuery = state.commandPalette.query || (selected ? selected.code : '');
    openCommandPalette(currentQuery);
    return;
  }

  if (!state.commandPalette.open && !event.metaKey && !event.ctrlKey && !event.altKey && key === '/' && !isFormField) {
    event.preventDefault();
    openCommandPalette('');
    return;
  }

  if (!state.commandPalette.open) return;

  if (key === 'Escape') {
    event.preventDefault();
    closeCommandPalette();
    return;
  }

  if (key === 'ArrowDown') {
    event.preventDefault();
    moveCommandHighlight(1);
    return;
  }

  if (key === 'ArrowUp') {
    event.preventDefault();
    moveCommandHighlight(-1);
    return;
  }

  if (key === 'Enter') {
    event.preventDefault();
    selectHighlightedCommand();
  }
}

function init() {
  document.addEventListener('keydown', handleGlobalKeydown);
  render();
}

init();
