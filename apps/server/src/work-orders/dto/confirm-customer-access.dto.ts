import { IsOptional, IsString } from 'class-validator';

export class ConfirmCustomerAccessDto {
  @IsOptional()
  @IsString()
  confirmedBy?: string;
}
