import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class StepAssignmentDto {
  @IsString()
  stepCode!: string;

  @IsString()
  stepName!: string;

  @IsString()
  assigneeId!: string;

  @IsString()
  assigneeName!: string;

  @IsInt()
  @Min(1)
  expectedQuantity!: number;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  estimatedCompletionAt?: Date;
}
