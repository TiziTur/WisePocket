import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/roles/roles.guard';
import { Roles } from '../common/roles/roles.decorator';
import { Role } from '../common/roles/role.enum';
import { AdvisorService } from './advisor.service';

@Controller('advisor')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADVISOR)
export class AdvisorController {
  constructor(private readonly advisorService: AdvisorService) {}

  @Get('overview')
  overview() {
    return this.advisorService.getGlobalOverview();
  }

  @Get('users/:userId/patterns')
  patterns(@Param('userId') userId: string) {
    return this.advisorService.getUserPatterns(userId);
  }
}
