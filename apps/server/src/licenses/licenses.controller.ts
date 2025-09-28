import { Body, Controller, Get, Post } from '@nestjs/common';
import { LicensesService } from './licenses.service';
import { ActivateLicenseDto } from './dto/activate-license.dto';
import { RenewLicenseDto } from './dto/renew-license.dto';
import { SuspendLicenseDto } from './dto/suspend-license.dto';
import { ResumeLicenseDto } from './dto/resume-license.dto';

@Controller('licenses')
export class LicensesController {
  constructor(private readonly licensesService: LicensesService) {}

  @Get('plans')
  getPlans() {
    return this.licensesService.getPlans();
  }

  @Get('status')
  getStatus() {
    return this.licensesService.getStatus();
  }

  @Post('activate')
  activate(@Body() dto: ActivateLicenseDto) {
    return this.licensesService.activate(dto);
  }

  @Post('renew')
  renew(@Body() dto: RenewLicenseDto) {
    return this.licensesService.renew(dto);
  }

  @Post('suspend')
  suspend(@Body() dto: SuspendLicenseDto) {
    return this.licensesService.suspend(dto);
  }

  @Post('resume')
  resume(@Body() dto: ResumeLicenseDto) {
    return this.licensesService.resume(dto);
  }
}
