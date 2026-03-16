import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  commerce: string;

  @IsDateString()
  date: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  category: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['ARS', 'USD', 'EUR'])
  currency: 'ARS' | 'USD' | 'EUR';

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  participants?: number;
}
