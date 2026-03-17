import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  findAll(
    @Req() req: { user: { id: string; role: string } },
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const role = String(req.user.role || '').toLowerCase();

    const pageNum = page ? Number(page) : undefined;
    const limitNum = limit ? Number(limit) : undefined;
    const isPrivileged = role === 'admin' || role === 'advisor';
    const scopedUserId = isPrivileged ? userId : req.user.id;

    if (!q && !category && !dateFrom && !dateTo && !pageNum && !limitNum && !userId) {
      if (isPrivileged) {
        return this.expensesService.findAllUsersExpenses();
      }
      return this.expensesService.findAllForUser(req.user.id);
    }

    return this.expensesService.findFiltered({
      userId: scopedUserId,
      q,
      category,
      dateFrom,
      dateTo,
      page: pageNum,
      limit: limitNum,
    });
  }

  @Post()
  create(@Req() req: { user: { id: string } }, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(req.user.id, dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Req() req: { user: { id: string } },
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.expensesService.remove(id, req.user.id);
  }
}
