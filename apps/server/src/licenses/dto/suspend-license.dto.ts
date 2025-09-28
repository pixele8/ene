import { IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class SuspendLicenseDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 60)
  operator!: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  reason?: string;
}
