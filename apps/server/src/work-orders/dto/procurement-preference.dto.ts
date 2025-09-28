import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ProcurementPreferenceDto {
  @IsBoolean()
  autoNotify!: boolean;

  @IsOptional()
  @IsString()
  targetFactoryId?: string;

  @IsOptional()
  @IsString()
  targetFactoryName?: string;
}
