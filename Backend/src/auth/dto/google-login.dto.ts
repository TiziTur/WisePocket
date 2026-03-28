import { IsString, MaxLength } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  @MaxLength(4096)
  idToken: string;
}
