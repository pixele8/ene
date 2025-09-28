import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WorkOrdersModule } from './work-orders/work-orders.module';
import { LicensesModule } from './licenses/licenses.module';
import { QuickRepliesModule } from './quick-replies/quick-replies.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    WorkOrdersModule,
    LicensesModule,
    QuickRepliesModule,
  ],
})
export class AppModule {}

