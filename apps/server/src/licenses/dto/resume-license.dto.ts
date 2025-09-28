import { IsNotEmpty, IsString, Length } from 'class-validator';

export class ResumeLicenseDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 60)
  operator!: string;
}
