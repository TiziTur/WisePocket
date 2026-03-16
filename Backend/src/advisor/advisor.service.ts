import { Injectable } from '@nestjs/common';
import { ExpensesService } from '../expenses/expenses.service';

@Injectable()
export class AdvisorService {
  constructor(private readonly expensesService: ExpensesService) {}

  async getGlobalOverview() {
    const expenses = await this.expensesService.findAllUsersExpenses();

    const totalAmount = expenses.reduce((acc, item) => {
      const participants = Math.max(1, item.participants || 1);
      return acc + item.amount / participants;
    }, 0);

    const users = new Set(expenses.map((expense) => expense.user?.id).filter(Boolean));

    return {
      totalExpenses: expenses.length,
      impactedAmountRaw: Number(totalAmount.toFixed(2)),
      usersWithExpenses: users.size,
    };
  }

  async getUserPatterns(userId: string) {
    const expenses = (await this.expensesService.findAllUsersExpenses()).filter(
      (expense) => expense.user?.id === userId,
    );

    const byCategory = expenses.reduce<Record<string, number>>((acc, expense) => {
      const participants = Math.max(1, expense.participants || 1);
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount / participants;
      return acc;
    }, {});

    const orderedCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    const monthlyAverage = this.getMonthlyAverage(expenses);
    const unusualExpenses = this.detectUnusual(expenses);

    return {
      userId,
      totalExpenses: expenses.length,
      monthlyAverage,
      topCategories: orderedCategories.slice(0, 5).map(([category, value]) => ({
        category,
        amount: Number(value.toFixed(2)),
      })),
      unusualExpenses,
      recommendations: this.generateRecommendations(orderedCategories, monthlyAverage),
    };
  }

  private getMonthlyAverage(expenses: Array<{ date: string; amount: number; participants: number }>) {
    if (!expenses.length) {
      return 0;
    }

    const monthMap = new Map<string, number>();
    expenses.forEach((expense) => {
      const monthKey = expense.date.slice(0, 7);
      const participants = Math.max(1, expense.participants || 1);
      const current = monthMap.get(monthKey) || 0;
      monthMap.set(monthKey, current + expense.amount / participants);
    });

    const values = [...monthMap.values()];
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return Number(avg.toFixed(2));
  }

  private detectUnusual(expenses: Array<{ commerce: string; amount: number; date: string }>) {
    if (expenses.length < 5) {
      return [];
    }

    const amounts = expenses.map((e) => e.amount);
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;

    return expenses
      .filter((e) => e.amount >= avg * 2.5)
      .slice(0, 5)
      .map((e) => ({
        commerce: e.commerce,
        amount: e.amount,
        date: e.date,
      }));
  }

  private generateRecommendations(categories: Array<[string, number]>, monthlyAverage: number): string[] {
    const recommendations: string[] = [];

    if (categories.length > 0) {
      recommendations.push(`Revisar gastos en ${categories[0][0]}, la categoria de mayor impacto.`);
    }

    if (monthlyAverage > 250000) {
      recommendations.push('Activar alertas de gasto alto y definir topes por categoria.');
    }

    if (!recommendations.length) {
      recommendations.push('Mantener el ritmo actual y continuar monitoreando gastos semanales.');
    }

    return recommendations;
  }
}
