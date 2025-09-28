import { IsIn } from 'class-validator';
import { WorkOrderStatus } from '../entities/work-order.entity';

const STATUS_VALUES: WorkOrderStatus[] = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export class UpdateWorkOrderStatusDto {
  @IsIn(STATUS_VALUES, {
    message: '状态必须是 PLANNED/IN_PROGRESS/COMPLETED/CANCELLED 之一',
  })
  status!: WorkOrderStatus;
}
