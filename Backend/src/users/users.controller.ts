import { Body, Controller, Get, NotFoundException, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/roles/roles.guard';
import { Roles } from '../common/roles/roles.decorator';
import { Role } from '../common/roles/role.enum';
import { UpdateRoleDto } from './dto/update-role.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADVISOR, Role.ADMIN)
  async listUsers(
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const normalizedRole = role && Object.values(Role).includes(role as Role) ? (role as Role) : undefined;
    const pageNum = page ? Number(page) : undefined;
    const limitNum = limit ? Number(limit) : undefined;

    const result = await this.usersService.listAll({
      q,
      role: normalizedRole,
      page: pageNum,
      limit: limitNum,
    });

    const mapUser = (user: { id: string; name: string; email: string; role: Role; createdAt?: Date }) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    });

    if (Array.isArray(result)) {
      return result.map(mapUser);
    }

    return {
      data: result.data.map(mapUser),
      meta: result.meta,
    };
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    const updated = await this.usersService.updateRole(id, dto.role);
    if (!updated) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
    };
  }
}
