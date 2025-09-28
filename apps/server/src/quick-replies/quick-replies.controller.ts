import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { QuickRepliesService } from './quick-replies.service';
import { QuickReply } from './entities/quick-reply.entity';
import { ModifyQuickReplyDto } from './dto/modify-quick-reply.dto';

@Controller('quick-replies')
export class QuickRepliesController {
  constructor(private readonly quickRepliesService: QuickRepliesService) {}

  @Get()
  list(): QuickReply[] {
    return this.quickRepliesService.list();
  }

  @Get(':userId')
  find(@Param('userId') userId: string): QuickReply {
    return this.quickRepliesService.find(userId);
  }

  @Patch(':userId/add')
  add(
    @Param('userId') userId: string,
    @Body() dto: ModifyQuickReplyDto,
  ): QuickReply {
    return this.quickRepliesService.add(userId, dto.phrase);
  }

  @Patch(':userId/remove')
  remove(
    @Param('userId') userId: string,
    @Body() dto: ModifyQuickReplyDto,
  ): QuickReply {
    return this.quickRepliesService.remove(userId, dto.phrase);
  }
}
