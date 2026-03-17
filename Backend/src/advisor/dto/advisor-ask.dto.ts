import { IsOptional, IsString } from 'class-validator';

export class AdvisorAskDto {
  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  question: string;
}
