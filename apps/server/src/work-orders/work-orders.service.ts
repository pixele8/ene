import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { UpdateWorkOrderStatusDto } from './dto/update-work-order-status.dto';
import { RecordStepProgressDto } from './dto/record-step-progress.dto';
import { CreateCustomerAccessDto } from './dto/create-customer-access.dto';
import { ConfirmCustomerAccessDto } from './dto/confirm-customer-access.dto';
import {
  CustomerAccess,
  ProcurementPreference,
  WorkOrderDetail,
  WorkOrderStep,
  WorkOrderSummary,
} from './entities/work-order.entity';
import {
  WORK_ORDERS_REPOSITORY,
  WorkOrdersRepository,
} from './persistence/work-orders.repository';

@Injectable()
export class WorkOrdersService {
  constructor(
    @Inject(WORK_ORDERS_REPOSITORY)
    private readonly workOrders: WorkOrdersRepository,
  ) {
    this.seed();
  }

  findAll(): WorkOrderSummary[] {
    return this.workOrders.findAll().map((detail) => this.toSummary(detail));
  }

  findOne(id: string): WorkOrderDetail {
    const workOrder = this.workOrders.findById(id);
    if (!workOrder) {
      throw new NotFoundException(`未找到工单 ${id}`);
    }
    return workOrder;
  }

  create(dto: CreateWorkOrderDto): WorkOrderDetail {
    const id = nanoid(12);
    const now = new Date();
    const ownerName = dto.ownerName;
    const detail: WorkOrderDetail = {
      id,
      code: dto.code,
      title: dto.title,
      priority: dto.priority,
      description: dto.description,
      ownerId: dto.ownerId,
      ownerName,
      status: 'PLANNED',
      startAt: dto.startAt,
      endAt: dto.endAt,
      targetQuantity: dto.targetQuantity,
      completedQuantity: 0,
      defectiveQuantity: 0,
      procurement: this.toProcurementPreference(dto.procurement),
      steps: this.createSteps(dto.steps),
      createdAt: now,
      updatedAt: now,
      customerAccountId: undefined,
      customerAccountStatus: undefined,
      watchers: this.normalizeWatchers(dto.watchers, ownerName),
    };

    detail.completedQuantity = this.calculateCompletedQuantity(detail.steps);
    detail.defectiveQuantity = this.calculateDefectiveQuantity(detail.steps);
    this.workOrders.save(detail);
    return detail;
  }

  update(id: string, dto: UpdateWorkOrderDto): WorkOrderDetail {
    const existing = this.findOne(id);
    const ownerName = dto.ownerName ?? existing.ownerName;
    const watchers = dto.watchers
      ? this.normalizeWatchers(dto.watchers, ownerName)
      : this.normalizeWatchers(existing.watchers, ownerName);
    const updated: WorkOrderDetail = {
      ...existing,
      code: dto.code ?? existing.code,
      title: dto.title ?? existing.title,
      priority: dto.priority ?? existing.priority,
      description: dto.description ?? existing.description,
      ownerId: dto.ownerId ?? existing.ownerId,
      ownerName,
      startAt: dto.startAt ?? existing.startAt,
      endAt: dto.endAt ?? existing.endAt,
      targetQuantity: dto.targetQuantity ?? existing.targetQuantity,
      procurement: dto.procurement
        ? this.toProcurementPreference(dto.procurement)
        : existing.procurement,
      steps: dto.steps ? this.mergeSteps(existing.steps, dto.steps) : existing.steps,
      watchers,
      updatedAt: new Date(),
    };

    updated.completedQuantity = this.calculateCompletedQuantity(updated.steps);
    updated.defectiveQuantity = this.calculateDefectiveQuantity(updated.steps);
    this.workOrders.save(updated);
    return updated;
  }

  updateStatus(id: string, dto: UpdateWorkOrderStatusDto): WorkOrderDetail {
    const existing = this.findOne(id);
    const updated: WorkOrderDetail = {
      ...existing,
      status: dto.status,
      updatedAt: new Date(),
    };
    this.workOrders.save(updated);
    return updated;
  }

  recordProgress(id: string, stepCode: string, dto: RecordStepProgressDto): WorkOrderDetail {
    const workOrder = this.findOne(id);
    const stepIndex = workOrder.steps.findIndex((step) => step.stepCode === stepCode);

    if (stepIndex === -1) {
      throw new NotFoundException(`未找到工单 ${id} 的工序 ${stepCode}`);
    }

    const step = workOrder.steps[stepIndex];
    const completedIncrement = Math.max(dto.completedQuantity, 0);
    const defectiveIncrement = Math.max(dto.defectiveQuantity ?? 0, 0);

    const nextCompleted = Math.min(step.completedQuantity + completedIncrement, step.expectedQuantity);
    const nextStatus: WorkOrderStep['status'] =
      nextCompleted >= step.expectedQuantity
        ? 'COMPLETED'
        : nextCompleted > 0
        ? 'IN_PROGRESS'
        : step.status;

    const nextStep: WorkOrderStep = {
      ...step,
      completedQuantity: nextCompleted,
      defectiveQuantity: step.defectiveQuantity + defectiveIncrement,
      status: nextStatus,
    };

    const steps = [...workOrder.steps];
    steps[stepIndex] = nextStep;

    const nextCompletedQuantity = this.calculateCompletedQuantity(steps);
    const nextDefectiveQuantity = this.calculateDefectiveQuantity(steps);

    let nextStatusOverall = workOrder.status;
    if (steps.every((item) => item.status === 'COMPLETED' || item.expectedQuantity === 0)) {
      nextStatusOverall = 'COMPLETED';
    } else if (nextCompletedQuantity > 0 && workOrder.status === 'PLANNED') {
      nextStatusOverall = 'IN_PROGRESS';
    }

    const updated: WorkOrderDetail = {
      ...workOrder,
      steps,
      completedQuantity: nextCompletedQuantity,
      defectiveQuantity: nextDefectiveQuantity,
      status: nextStatusOverall,
      updatedAt: new Date(),
    };

    this.workOrders.save(updated);
    return updated;
  }

  createCustomerAccess(id: string, dto: CreateCustomerAccessDto): WorkOrderDetail {
    const workOrder = this.findOne(id);
    const now = new Date();
    const customerName = dto.customerName.trim();
    if (!customerName) {
      throw new BadRequestException('客户名称不能为空');
    }
    const customerAccess: CustomerAccess = {
      id: nanoid(12),
      workOrderId: workOrder.id,
      customerName,
      company: dto.company?.trim() || undefined,
      contactPhone: dto.contactPhone?.trim() || undefined,
      login: this.generateCustomerLogin(),
      password: this.generateCustomerPassword(),
      status: 'ACTIVE',
      createdAt: now,
    };

    const updated: WorkOrderDetail = {
      ...workOrder,
      customerAccess,
      customerAccountId: customerAccess.id,
      customerAccountStatus: customerAccess.status,
      updatedAt: now,
    };

    this.workOrders.save(updated);
    return updated;
  }

  confirmCustomerAccess(
    id: string,
    accessId: string,
    dto: ConfirmCustomerAccessDto,
  ): WorkOrderDetail {
    const workOrder = this.findOne(id);
    const access = workOrder.customerAccess;
    if (!access || access.id !== accessId) {
      throw new NotFoundException(`未找到工单 ${id} 的客户访问凭证`);
    }

    if (access.status !== 'ACTIVE') {
      return workOrder;
    }

    const confirmedAt = new Date();
    const updatedAccess: CustomerAccess = {
      ...access,
      status: 'CONFIRMED',
      confirmedAt,
      confirmedBy: dto.confirmedBy?.trim() || undefined,
    };

    const updated: WorkOrderDetail = {
      ...workOrder,
      customerAccess: updatedAccess,
      customerAccountId: undefined,
      customerAccountStatus: updatedAccess.status,
      updatedAt: confirmedAt,
    };

    this.workOrders.save(updated);
    return updated;
  }

  remove(id: string): void {
    if (!this.workOrders.remove(id)) {
      throw new NotFoundException(`未找到工单 ${id}`);
    }
  }

  private toSummary(detail: WorkOrderDetail): WorkOrderSummary {
    const { steps } = detail;
    const completedQuantity = this.calculateCompletedQuantity(steps);
    const defectiveQuantity = this.calculateDefectiveQuantity(steps);
    const customerAccountId =
      detail.customerAccess && detail.customerAccess.status === 'ACTIVE'
        ? detail.customerAccess.id
        : undefined;
    const customerAccountStatus = detail.customerAccess?.status;
    return {
      id: detail.id,
      code: detail.code,
      title: detail.title,
      priority: detail.priority,
      ownerId: detail.ownerId,
      ownerName: detail.ownerName,
      status: detail.status,
      startAt: detail.startAt,
      endAt: detail.endAt,
      targetQuantity: detail.targetQuantity,
      completedQuantity,
      defectiveQuantity,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
      watchers: detail.watchers,
      customerAccountId,
      customerAccountStatus,
    };
  }

  private toProcurementPreference(preference: CreateWorkOrderDto['procurement']): ProcurementPreference {
    return {
      autoNotify: preference.autoNotify,
      targetFactoryId: preference.targetFactoryId,
      targetFactoryName: preference.targetFactoryName,
    };
  }

  private normalizeWatchers(watchers: string[] | undefined, ownerName: string): string[] {
    const list = Array.isArray(watchers) ? watchers : [];
    const normalized = list
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (ownerName && !normalized.includes(ownerName)) {
      normalized.unshift(ownerName);
    }
    return Array.from(new Set(normalized));
  }

  private createSteps(steps: CreateWorkOrderDto['steps'] = []): WorkOrderStep[] {
    return steps.map((step) => ({
      stepCode: step.stepCode,
      stepName: step.stepName,
      assigneeId: step.assigneeId,
      assigneeName: step.assigneeName,
      expectedQuantity: step.expectedQuantity,
      completedQuantity: 0,
      defectiveQuantity: 0,
      estimatedCompletionAt: step.estimatedCompletionAt,
      status: 'PLANNED',
    }));
  }

  private mergeSteps(
    existing: WorkOrderStep[],
    updates: NonNullable<UpdateWorkOrderDto['steps']>,
  ): WorkOrderStep[] {
    const updateByCode = new Map(updates.map((step) => [step.stepCode, step]));

    const merged = existing.map((step) => {
      const incoming = updateByCode.get(step.stepCode);
      if (!incoming) {
        return step;
      }

      return {
        ...step,
        stepName: incoming.stepName ?? step.stepName,
        assigneeId: incoming.assigneeId ?? step.assigneeId,
        assigneeName: incoming.assigneeName ?? step.assigneeName,
        expectedQuantity: incoming.expectedQuantity ?? step.expectedQuantity,
        estimatedCompletionAt: incoming.estimatedCompletionAt ?? step.estimatedCompletionAt,
      } as WorkOrderStep;
    });

    updates.forEach((incoming) => {
      if (existing.some((step) => step.stepCode === incoming.stepCode)) {
        return;
      }

      merged.push({
        stepCode: incoming.stepCode,
        stepName: incoming.stepName ?? '未命名工序',
        assigneeId: incoming.assigneeId ?? '',
        assigneeName: incoming.assigneeName ?? '',
        expectedQuantity: incoming.expectedQuantity ?? 0,
        completedQuantity: 0,
        defectiveQuantity: 0,
        estimatedCompletionAt: incoming.estimatedCompletionAt,
        status: 'PLANNED',
      });
    });

    return merged;
  }

  private calculateCompletedQuantity(steps: WorkOrderStep[]): number {
    return steps.reduce((total, step) => total + step.completedQuantity, 0);
  }

  private calculateDefectiveQuantity(steps: WorkOrderStep[]): number {
    return steps.reduce((total, step) => total + step.defectiveQuantity, 0);
  }

  private generateCustomerLogin(): string {
    return `cust-${nanoid(8).toLowerCase()}`;
  }

  private generateCustomerPassword(): string {
    return nanoid(10);
  }

  private seed(): void {
    if (!this.workOrders.isEmpty()) {
      return;
    }

    const baseStart = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const baseEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    const welding = this.create({
      code: 'WO-240401-001',
      title: '2304-电子组件焊接',
      description: '批次 2304 焊接作业，需 100 件，检测 NG 自动推送采购。',
      ownerId: 'manager-001',
      ownerName: '王强',
      priority: 'HIGH',
      startAt: baseStart,
      endAt: baseEnd,
      targetQuantity: 100,
      procurement: {
        autoNotify: true,
        targetFactoryId: 'factory-001',
        targetFactoryName: '东莞启明电子',
      },
      watchers: ['王强', '李娜', '赵鹏'],
      steps: [
        {
          stepCode: 'step-1',
          stepName: '焊接',
          assigneeId: 'worker-001',
          assigneeName: '李娜',
          expectedQuantity: 100,
          estimatedCompletionAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        },
        {
          stepCode: 'step-2',
          stepName: '品质检验',
          assigneeId: 'qa-001',
          assigneeName: '赵鹏',
          expectedQuantity: 100,
        },
      ],
    });

    welding.status = 'IN_PROGRESS';
    welding.steps = welding.steps.map((step, index) =>
      index === 0
        ? {
            ...step,
            completedQuantity: 60,
            defectiveQuantity: 2,
            status: 'IN_PROGRESS',
          }
        : { ...step, defectiveQuantity: 0 },
    );
    welding.completedQuantity = this.calculateCompletedQuantity(welding.steps);
    welding.defectiveQuantity = this.calculateDefectiveQuantity(welding.steps);
    welding.updatedAt = new Date();
    this.workOrders.save(welding);
    this.createCustomerAccess(welding.id, {
      customerName: '华强客户',
      company: '华强电子',
      contactPhone: '13800008888',
    });

    const packaging = this.create({
      code: 'WO-240402-001',
      title: '包装与出货',
      description: '确认包装材料准备就绪并生成送货单。',
      ownerId: 'manager-002',
      ownerName: '刘晨',
      priority: 'MEDIUM',
      startAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      endAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      targetQuantity: 200,
      procurement: {
        autoNotify: false,
      },
      watchers: ['刘晨', '陈思', '贺洋'],
      steps: [
        {
          stepCode: 'step-a',
          stepName: '物料准备',
          assigneeId: 'worker-010',
          assigneeName: '陈思',
          expectedQuantity: 200,
        },
        {
          stepCode: 'step-b',
          stepName: '打包',
          assigneeId: 'worker-011',
          assigneeName: '贺洋',
          expectedQuantity: 200,
        },
      ],
    });

    packaging.status = 'PLANNED';
    this.workOrders.save(packaging);
    const packagingAccess = this.createCustomerAccess(packaging.id, {
      customerName: '星辰客户',
    });
    this.confirmCustomerAccess(packaging.id, packagingAccess.customerAccess!.id, {
      confirmedBy: '王强',
    });
  }
}
