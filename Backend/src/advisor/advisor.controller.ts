import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/roles/roles.guard';
import { Roles } from '../common/roles/roles.decorator';
import { Role } from '../common/roles/role.enum';
import { AdvisorService } from './advisor.service';
import { AdvisorAskDto } from './dto/advisor-ask.dto';

@Controller('advisor')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdvisorController {
  constructor(private readonly advisorService: AdvisorService) {}

  @Get('overview')
  @Roles(Role.ADVISOR, Role.ADMIN)
  overview() {
    return this.advisorService.getGlobalOverview();
  }

  @Get('overview/:userId')
  @Roles(Role.ADVISOR, Role.ADMIN)
  userOverview(@Param('userId') userId: string) {
    return this.advisorService.getUserOverview(userId);
  }

  @Get('patterns/:userId')
  @Roles(Role.ADVISOR, Role.ADMIN)
  patternsV2(@Param('userId') userId: string) {
    return this.advisorService.getUserPatterns(userId);
  }

  @Get('users/:userId/patterns')
  @Roles(Role.ADVISOR, Role.ADMIN)
  patterns(@Param('userId') userId: string) {
    return this.advisorService.getUserPatterns(userId);
  }

  @Post('ask')
  @Roles(Role.USER, Role.ADVISOR, Role.ADMIN)
  ask(@Req() req: { user: { id: string; role?: string } }, @Body() dto: AdvisorAskDto) {
    const role = String(req.user?.role || '').toLowerCase();
    if (role === Role.USER) {
      dto.userId = req.user.id;
    }
    return this.advisorService.askAdvisor(req.user.id, dto);
  }

  @Get('recommendations/:userId')
  @Roles(Role.ADVISOR, Role.ADMIN)
  recommendations(@Param('userId') userId: string) {
    return this.advisorService.getRecommendationHistory(userId);
  }

  @Get('clients/health')
  @Roles(Role.ADVISOR, Role.ADMIN)
  clientsHealth() {
    return this.advisorService.getClientsHealth();
  }
}
