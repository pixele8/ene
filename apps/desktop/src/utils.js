const pad = (num) => String(num).padStart(2, '0');
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const DAY_MS = MS_PER_DAY;

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

export function formatDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDateTime(date) {
  const d = new Date(date);
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function relativeTime(date) {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s 前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return formatDate(date);
}

let workOrderCounter = 42;
export function generateWorkOrderCode() {
  workOrderCounter += 1;
  return `GX-${pad(workOrderCounter)}${pad(Math.floor(Math.random() * 90) + 10)}`;
}

export function randomId(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function daysUntil(date, from = Date.now()) {
  if (!date) return null;
  const target = new Date(date).getTime();
  if (Number.isNaN(target)) return null;
  const diff = target - from;
  return Math.ceil(diff / MS_PER_DAY);
}

export function sum(arr) {
  return arr.reduce((total, value) => total + value, 0);
}

export function calculateCompletion(workOrder) {
  const produced = sum(workOrder.steps.map((step) => step.completed));
  const defects = sum(workOrder.steps.map((step) => step.defects));
  return {
    produced,
    defects,
    completionRate: workOrder.quantity
      ? Math.min(100, Math.round((produced / workOrder.quantity) * 100))
      : 0,
  };
}

export function downloadFile(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function getDueInfo(dueDate, now = Date.now()) {
  if (!dueDate) {
    return {
      status: 'unset',
      daysDiff: null,
      label: '未设置截止',
      date: ''
    };
  }

  const due = startOfDay(dueDate);
  const today = startOfDay(now);
  const diff = Math.round((due.getTime() - today.getTime()) / MS_PER_DAY);

  if (diff < 0) {
    return {
      status: 'overdue',
      daysDiff: diff,
      label: `逾期 ${Math.abs(diff)} 天`,
      date: formatDate(due)
    };
  }

  if (diff === 0) {
    return {
      status: 'today',
      daysDiff: diff,
      label: '今日截止',
      date: formatDate(due)
    };
  }

  if (diff === 1) {
    return {
      status: 'soon',
      daysDiff: diff,
      label: '明日截止',
      date: formatDate(due)
    };
  }

  if (diff <= 7) {
    return {
      status: 'soon',
      daysDiff: diff,
      label: `剩余 ${diff} 天`,
      date: formatDate(due)
    };
  }

  return {
    status: 'scheduled',
    daysDiff: diff,
    label: `剩余 ${diff} 天`,
    date: formatDate(due)
  };
}

export function matchesDueFilter(dueDate, filter) {
  if (!filter || filter === 'all') {
    return true;
  }

  const info = getDueInfo(dueDate);

  switch (filter) {
    case 'overdue':
      return info.status === 'overdue';
    case 'today':
      return info.status === 'today';
    case 'week':
      return info.status === 'soon' || info.status === 'today';
    case 'scheduled':
      return info.status === 'scheduled';
    case 'unset':
      return info.status === 'unset';
    default:
      return true;
  }
}

export async function copyToClipboard(text) {
  if (!text) return false;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard API 不可用');
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!success) {
      throw new Error('Copy command was not successful');
    }
    return true;
  } catch (error) {
    document.body.removeChild(textarea);
    throw error;
  }
}

export function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
