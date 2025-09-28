import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProcurementPreferenceDto } from './procurement-preference.dto';
import { StepAssignmentDto } from './step-assignment.dto';

export class CreateWorkOrderDto {
  @IsString()
  code!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  ownerId!: string;

  @IsString()
  ownerName!: string;

  @IsEnum(['LOW', 'MEDIUM', 'HIGH'])
  priority!: 'LOW' | 'MEDIUM' | 'HIGH';

  @IsDate()
  @Type(() => Date)
  startAt!: Date;

  @IsDate()
  @Type(() => Date)
  endAt!: Date;

  @IsInt()
  @Min(1)
  targetQuantity!: number;

  @ValidateNested()
  @Type(() => ProcurementPreferenceDto)
  procurement!: ProcurementPreferenceDto;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => StepAssignmentDto)
  steps?: StepAssignmentDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  watchers?: string[];
}
