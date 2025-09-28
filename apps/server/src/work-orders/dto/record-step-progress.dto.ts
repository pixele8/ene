import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class StepConfirmationDto {
  @IsString()
  @IsIn(['fingerprint', 'double_confirm'])
  method!: 'fingerprint' | 'double_confirm';

  @ValidateIf((value) => value.method === 'fingerprint')
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  fingerprintId?: string;

  @ValidateIf((value) => value.method === 'double_confirm')
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  confirmers?: string[];
}

export class RecordStepProgressDto {
  @IsInt()
  @Min(0)
  completedQuantity!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  defectiveQuantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  reporter?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;

  @ValidateNested()
  @Type(() => StepConfirmationDto)
  confirmation!: StepConfirmationDto;
}
