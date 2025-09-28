import { IsOptional, IsString } from 'class-validator';

export class CreateCustomerAccessDto {
  @IsString()
  customerName!: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;
}
