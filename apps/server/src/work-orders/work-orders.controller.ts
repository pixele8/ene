import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { WorkOrdersService } from './work-orders.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { UpdateWorkOrderStatusDto } from './dto/update-work-order-status.dto';
import { RecordStepProgressDto } from './dto/record-step-progress.dto';
import { CreateCustomerAccessDto } from './dto/create-customer-access.dto';
import { ConfirmCustomerAccessDto } from './dto/confirm-customer-access.dto';
import { WorkOrderDetail, WorkOrderSummary } from './entities/work-order.entity';

@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Get()
  findAll(): WorkOrderSummary[] {
    return this.workOrdersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): WorkOrderDetail {
    return this.workOrdersService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateWorkOrderDto): WorkOrderDetail {
    return this.workOrdersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWorkOrderDto): WorkOrderDetail {
    return this.workOrdersService.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateWorkOrderStatusDto,
  ): WorkOrderDetail {
    return this.workOrdersService.updateStatus(id, dto);
  }

  @Patch(':id/steps/:stepCode/progress')
  recordProgress(
    @Param('id') id: string,
    @Param('stepCode') stepCode: string,
    @Body() dto: RecordStepProgressDto,
  ): WorkOrderDetail {
    return this.workOrdersService.recordProgress(id, stepCode, dto);
  }

  @Post(':id/customer-access')
  createCustomerAccess(
    @Param('id') id: string,
    @Body() dto: CreateCustomerAccessDto,
  ): WorkOrderDetail {
    return this.workOrdersService.createCustomerAccess(id, dto);
  }

  @Patch(':id/customer-access/:accessId/confirm')
  confirmCustomerAccess(
    @Param('id') id: string,
    @Param('accessId') accessId: string,
    @Body() dto: ConfirmCustomerAccessDto,
  ): WorkOrderDetail {
    return this.workOrdersService.confirmCustomerAccess(id, accessId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): void {
    return this.workOrdersService.remove(id);
  }
}
