import { Injectable } from '@nestjs/common';
import { WorkOrderDetail } from '../entities/work-order.entity';

export interface WorkOrdersRepository {
  isEmpty(): boolean;
  findAll(): WorkOrderDetail[];
  findById(id: string): WorkOrderDetail | undefined;
  save(workOrder: WorkOrderDetail): void;
  remove(id: string): boolean;
  clear(): void;
}

export const WORK_ORDERS_REPOSITORY = Symbol('WORK_ORDERS_REPOSITORY');

@Injectable()
export class InMemoryWorkOrdersRepository implements WorkOrdersRepository {
  private readonly workOrders = new Map<string, WorkOrderDetail>();

  isEmpty(): boolean {
    return this.workOrders.size === 0;
  }

  findAll(): WorkOrderDetail[] {
    return Array.from(this.workOrders.values());
  }

  findById(id: string): WorkOrderDetail | undefined {
    return this.workOrders.get(id);
  }

  save(workOrder: WorkOrderDetail): void {
    this.workOrders.set(workOrder.id, workOrder);
  }

  remove(id: string): boolean {
    return this.workOrders.delete(id);
  }

  clear(): void {
    this.workOrders.clear();
  }
}
