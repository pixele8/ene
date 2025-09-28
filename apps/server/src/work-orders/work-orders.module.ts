import { Module } from '@nestjs/common';
import { WorkOrdersService } from './work-orders.service';
import { WorkOrdersController } from './work-orders.controller';
import {
  InMemoryWorkOrdersRepository,
  WORK_ORDERS_REPOSITORY,
} from './persistence/work-orders.repository';

@Module({
  controllers: [WorkOrdersController],
  providers: [
    WorkOrdersService,
    {
      provide: WORK_ORDERS_REPOSITORY,
      useClass: InMemoryWorkOrdersRepository,
    },
  ],
})
export class WorkOrdersModule {}

