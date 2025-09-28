import { IsNotEmpty, IsString, Length } from 'class-validator';

export class ActivateLicenseDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 64)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 60)
  operator!: string;
}
