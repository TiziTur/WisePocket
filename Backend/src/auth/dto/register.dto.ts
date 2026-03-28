import { IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Role } from '../../common/roles/role.enum';

export class RegisterDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/, {
    message: 'La contrasena debe incluir mayuscula, minuscula, numero y simbolo.',
  })
  password: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
