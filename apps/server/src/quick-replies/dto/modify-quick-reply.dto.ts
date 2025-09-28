import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class ModifyQuickReplyDto {
  @IsString({ message: '快捷回复内容必须为字符串' })
  @IsNotEmpty({ message: '快捷回复内容不能为空' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  phrase!: string;
}
