import { BadRequestException, Injectable } from '@nestjs/common';
import { ActivateLicenseDto } from './dto/activate-license.dto';
import { RenewLicenseDto } from './dto/renew-license.dto';
import { SuspendLicenseDto } from './dto/suspend-license.dto';
import { ResumeLicenseDto } from './dto/resume-license.dto';

export type LicenseTier = 'starter' | 'professional' | 'enterprise';

export interface LicensePlan {
  tier: LicenseTier;
  name: string;
  description: string;
  pricePerQuarter: number;
  pricePerYear: number;
  maxSeats: number;
  ocrCredits: number;
  automationCoverage: string;
  features: string[];
}

interface ActivationCodeRecord {
  code: string;
  tier: LicenseTier;
  durationDays: number;
  purpose: 'activation' | 'renewal' | 'upgrade';
  used: boolean;
}

interface LicenseState {
  status: 'inactive' | 'active' | 'suspended' | 'expired';
  tier: LicenseTier | null;
  planName: string | null;
  licenseKey: string | null;
  activatedAt: Date | null;
  expiresAt: Date | null;
  seats: number | null;
  ocrCredits: number | null;
  automationCoverage: string | null;
  lastActionAt: Date | null;
  lastActionBy: string | null;
  suspensionReason: string | null;
}

export interface LicenseStatusResponse {
  status: LicenseState['status'];
  tier: LicenseTier | null;
  planName: string | null;
  licenseKey: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  remainingDays: number | null;
  seats: number | null;
  ocrCredits: number | null;
  automationCoverage: string | null;
  lastActionAt: string | null;
  lastActionBy: string | null;
  suspensionReason: string | null;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class LicensesService {
  private readonly plans: LicensePlan[] = [
    {
      tier: 'starter',
      name: '云启版',
      description: '适合 15 人以下小微工厂的入门套餐',
      pricePerQuarter: 899,
      pricePerYear: 2999,
      maxSeats: 15,
      ocrCredits: 2000,
      automationCoverage: '工单流转 + 采购提醒 + OCR 品质预览',
      features: [
        '桌面端 / 安卓端互通',
        'OCR 质检自动录入',
        '闪电工单与采购通知'
      ]
    },
    {
      tier: 'professional',
      name: '智控版',
      description: '覆盖多班组协同与成本对账的成长型套餐',
      pricePerQuarter: 1899,
      pricePerYear: 5999,
      maxSeats: 40,
      ocrCredits: 6000,
      automationCoverage: '原材采购 + 产能平衡 + 对账单自动生成',
      features: [
        '多角色权限与流程编排',
        '自动补料与返工追踪',
        '送货单 / 对账单一键导出'
      ]
    },
    {
      tier: 'enterprise',
      name: '旗舰版',
      description: '面向集团化工厂的全流程自动化方案',
      pricePerQuarter: 3299,
      pricePerYear: 10999,
      maxSeats: 120,
      ocrCredits: 18000,
      automationCoverage: '跨厂区协同 + BI 指标看板 + 定制集成',
      features: [
        '跨区域协同与多工厂调度',
        '供应链 API / ERP 对接',
        '专属顾问与季度巡检'
      ]
    }
  ];

  private readonly activationCodes = new Map<string, ActivationCodeRecord>();

  private current: LicenseState = {
    status: 'inactive',
    tier: null,
    planName: null,
    licenseKey: null,
    activatedAt: null,
    expiresAt: null,
    seats: null,
    ocrCredits: null,
    automationCoverage: null,
    lastActionAt: null,
    lastActionBy: null,
    suspensionReason: null
  };

  constructor() {
    this.seedActivationCodes();
  }

  getPlans(): LicensePlan[] {
    return this.plans;
  }

  getStatus(): LicenseStatusResponse {
    this.recalculateStatus();
    return this.toResponse();
  }

  activate(dto: ActivateLicenseDto): LicenseStatusResponse {
    const code = this.consumeActivationCode(dto.code);
    const plan = this.getPlanByTier(code.tier);
    const now = new Date();

    this.current = {
      status: 'active',
      tier: code.tier,
      planName: plan.name,
      licenseKey: code.code,
      activatedAt: now,
      expiresAt: new Date(now.getTime() + code.durationDays * DAY_IN_MS),
      seats: plan.maxSeats,
      ocrCredits: plan.ocrCredits,
      automationCoverage: plan.automationCoverage,
      lastActionAt: now,
      lastActionBy: dto.operator,
      suspensionReason: null
    };

    return this.toResponse();
  }

  renew(dto: RenewLicenseDto): LicenseStatusResponse {
    const code = this.consumeActivationCode(dto.code);
    const plan = this.getPlanByTier(code.tier);
    const now = new Date();

    if (!this.current.activatedAt) {
      this.current.activatedAt = now;
    }

    const baseExpiration = this.current.expiresAt && this.current.expiresAt > now ? this.current.expiresAt : now;

    this.current = {
      ...this.current,
      status: 'active',
      tier: code.tier,
      planName: plan.name,
      licenseKey: code.code,
      expiresAt: new Date(baseExpiration.getTime() + code.durationDays * DAY_IN_MS),
      seats: plan.maxSeats,
      ocrCredits: plan.ocrCredits,
      automationCoverage: plan.automationCoverage,
      lastActionAt: now,
      lastActionBy: dto.operator,
      suspensionReason: null
    };

    return this.toResponse();
  }

  suspend(dto: SuspendLicenseDto): LicenseStatusResponse {
    if (this.current.status === 'inactive') {
      throw new BadRequestException('当前没有可封停的订阅');
    }

    this.current = {
      ...this.current,
      status: 'suspended',
      lastActionAt: new Date(),
      lastActionBy: dto.operator,
      suspensionReason: dto.reason ?? null
    };

    return this.toResponse();
  }

  resume(dto: ResumeLicenseDto): LicenseStatusResponse {
    if (this.current.status !== 'suspended') {
      throw new BadRequestException('当前授权未处于封停状态');
    }

    const now = new Date();
    if (!this.current.expiresAt || this.current.expiresAt.getTime() <= now.getTime()) {
      this.current = {
        ...this.current,
        status: 'expired',
        lastActionAt: now,
        lastActionBy: dto.operator
      };
      throw new BadRequestException('授权已过期，请使用续期码重新激活');
    }

    this.current = {
      ...this.current,
      status: 'active',
      lastActionAt: now,
      lastActionBy: dto.operator,
      suspensionReason: null
    };

    return this.toResponse();
  }

  private seedActivationCodes() {
    this.registerCode({ code: 'GXL-STARTER-90D', tier: 'starter', durationDays: 90, purpose: 'activation' });
    this.registerCode({ code: 'GXL-STARTER-365D', tier: 'starter', durationDays: 365, purpose: 'renewal' });
    this.registerCode({ code: 'GXL-PRO-90D', tier: 'professional', durationDays: 90, purpose: 'upgrade' });
    this.registerCode({ code: 'GXL-PRO-365D', tier: 'professional', durationDays: 365, purpose: 'renewal' });
    this.registerCode({ code: 'GXL-ENT-180D', tier: 'enterprise', durationDays: 180, purpose: 'upgrade' });
    this.registerCode({ code: 'GXL-ENT-365D', tier: 'enterprise', durationDays: 365, purpose: 'renewal' });
  }

  private registerCode(record: Omit<ActivationCodeRecord, 'used'>) {
    this.activationCodes.set(record.code.toUpperCase(), { ...record, code: record.code.toUpperCase(), used: false });
  }

  private consumeActivationCode(input: string): ActivationCodeRecord {
    const normalized = input.trim().toUpperCase();
    const record = this.activationCodes.get(normalized);
    if (!record) {
      throw new BadRequestException('激活码无效，请核对后重新输入');
    }
    if (record.used) {
      throw new BadRequestException('该激活码已被使用，请重新获取');
    }

    record.used = true;
    return record;
  }

  private recalculateStatus() {
    if (!this.current.expiresAt) {
      return;
    }

    const now = new Date();
    if (this.current.expiresAt.getTime() <= now.getTime()) {
      this.current = {
        ...this.current,
        status: 'expired'
      };
    }
  }

  private toResponse(): LicenseStatusResponse {
    const remainingDays = this.current.expiresAt
      ? Math.max(0, Math.ceil((this.current.expiresAt.getTime() - Date.now()) / DAY_IN_MS))
      : null;

    return {
      status: this.current.status,
      tier: this.current.tier,
      planName: this.current.planName,
      licenseKey: this.current.licenseKey,
      activatedAt: this.current.activatedAt ? this.current.activatedAt.toISOString() : null,
      expiresAt: this.current.expiresAt ? this.current.expiresAt.toISOString() : null,
      remainingDays,
      seats: this.current.seats,
      ocrCredits: this.current.ocrCredits,
      automationCoverage: this.current.automationCoverage,
      lastActionAt: this.current.lastActionAt ? this.current.lastActionAt.toISOString() : null,
      lastActionBy: this.current.lastActionBy,
      suspensionReason: this.current.suspensionReason
    };
  }

  private getPlanByTier(tier: LicenseTier): LicensePlan {
    const plan = this.plans.find((item) => item.tier === tier);
    if (!plan) {
      throw new BadRequestException('未找到对应的订阅套餐，请联系管理员');
    }
    return plan;
  }
}
