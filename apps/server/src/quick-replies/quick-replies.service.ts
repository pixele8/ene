import { Injectable } from '@nestjs/common';
import { QuickReply } from './entities/quick-reply.entity';

const defaultQuickReplies: Record<string, string[]> = {
  'manager-wangqiang': ['稍后回复', '请按计划推进', '收到，辛苦了'],
  'worker-lina': ['已完成', '物料不足', '需要支援'],
  'qa-zhaopeng': ['发现异常，稍后反馈', '等待复检结果'],
  'procurement-liuchen': ['已安排补料', '正在联系供应商'],
};

@Injectable()
export class QuickRepliesService {
  private readonly quickReplies = new Map<string, string[]>();

  constructor() {
    this.seed();
  }

  list(): QuickReply[] {
    return Array.from(this.quickReplies.entries()).map(([userId, phrases]) => ({
      userId,
      phrases: [...phrases],
    }));
  }

  find(userId: string): QuickReply {
    const phrases = this.ensureUser(userId);
    return { userId, phrases: [...phrases] };
  }

  add(userId: string, phrase: string): QuickReply {
    const sanitized = this.sanitize(phrase);
    if (!sanitized) {
      return this.find(userId);
    }

    const phrases = this.ensureUser(userId);
    if (!phrases.includes(sanitized)) {
      phrases.push(sanitized);
    }

    return { userId, phrases: [...phrases] };
  }

  remove(userId: string, phrase: string): QuickReply {
    const sanitized = this.sanitize(phrase);
    const phrases = this.ensureUser(userId);
    const next = phrases.filter((item) => item !== sanitized);
    this.quickReplies.set(userId, next);
    return { userId, phrases: [...next] };
  }

  private sanitize(value: string): string {
    return value.trim();
  }

  private ensureUser(userId: string): string[] {
    if (!this.quickReplies.has(userId)) {
      const fallback = defaultQuickReplies[userId] ?? [];
      this.quickReplies.set(userId, [...fallback]);
    }
    return this.quickReplies.get(userId) ?? [];
  }

  private seed(): void {
    Object.entries(defaultQuickReplies).forEach(([userId, phrases]) => {
      this.quickReplies.set(userId, [...phrases]);
    });
  }
}
