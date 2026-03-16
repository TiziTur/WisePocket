import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { Role } from '../common/roles/role.enum';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    const advisorEmail = 'advisor@wisepocket.com';
    const existing = await this.findByEmail(advisorEmail);
    if (existing) {
      return;
    }

    const passwordHash = await bcrypt.hash('123456', 10);
    await this.create({
      email: advisorEmail,
      name: 'Asesor Demo',
      passwordHash,
      role: Role.ADVISOR,
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(data: {
    email: string;
    name: string;
    passwordHash: string;
    role?: Role;
  }): Promise<User> {
    const user = this.usersRepository.create({
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash,
      role: data.role ?? Role.USER,
    });

    return this.usersRepository.save(user);
  }

  async updateProfile(id: string, payload: { name?: string; email?: string }): Promise<User | null> {
    const user = await this.findById(id);
    if (!user) {
      return null;
    }

    if (payload.name) {
      user.name = payload.name;
    }

    if (payload.email) {
      user.email = payload.email;
    }

    return this.usersRepository.save(user);
  }

  listAll(): Promise<User[]> {
    return this.usersRepository.find({ order: { name: 'ASC' } });
  }
}
