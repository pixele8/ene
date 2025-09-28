export type WorkOrderStatus =
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type WorkOrderStepStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';

export type WorkOrderPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ProcurementPreference {
  autoNotify: boolean;
  targetFactoryId?: string;
  targetFactoryName?: string;
}

export type CustomerAccessStatus = 'ACTIVE' | 'CONFIRMED';

export interface CustomerAccess {
  id: string;
  workOrderId: string;
  customerName: string;
  company?: string;
  contactPhone?: string;
  login: string;
  password: string;
  status: CustomerAccessStatus;
  createdAt: Date;
  confirmedBy?: string;
  confirmedAt?: Date;
}

export interface WorkOrderStep {
  stepCode: string;
  stepName: string;
  assigneeId: string;
  assigneeName: string;
  expectedQuantity: number;
  completedQuantity: number;
  defectiveQuantity: number;
  estimatedCompletionAt?: Date;
  status: WorkOrderStepStatus;
}

export interface WorkOrderSummary {
  id: string;
  code: string;
  title: string;
  priority: WorkOrderPriority;
  ownerId: string;
  ownerName: string;
  status: WorkOrderStatus;
  startAt: Date;
  endAt: Date;
  targetQuantity: number;
  completedQuantity: number;
  defectiveQuantity: number;
  createdAt: Date;
  updatedAt: Date;
  watchers: string[];
  customerAccountId?: string;
  customerAccountStatus?: CustomerAccessStatus;
}

export interface WorkOrderDetail extends WorkOrderSummary {
  description?: string;
  procurement: ProcurementPreference;
  steps: WorkOrderStep[];
  customerAccess?: CustomerAccess;
}
